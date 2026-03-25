const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;
const USER_DOC_PREFIX = 'user_';

function getEffectiveStatus(post, nextSeatRemaining = post.seatRemaining) {
  if (post.status === 'cancelled') {
    return 'cancelled';
  }
  if (post.mealTime <= Date.now()) {
    return 'ended';
  }
  if (nextSeatRemaining <= 0) {
    return 'full';
  }
  return 'open';
}

function buildUserDocId(openId) {
  return `${USER_DOC_PREFIX}${openId}`;
}

function buildUserPayload(openId, user = {}, overrides = {}) {
  return {
    openId,
    role: user.role || 'user',
    nickname: overrides.nickname ?? user.nickname ?? 'LinkUp User',
    avatarUrl: overrides.avatarUrl ?? user.avatarUrl ?? '',
    createdAt: user.createdAt || Date.now(),
    updatedAt: overrides.updatedAt ?? user.updatedAt ?? Date.now()
  };
}

async function findLegacyUser(openId) {
  let { data } = await db.collection('users').where({
    openId
  }).limit(1).get();

  if (data.length) {
    return data[0];
  }

  ({ data } = await db.collection('users').where({
    _openid: openId
  }).limit(1).get());

  return data[0] || null;
}

async function getCurrentUser(openId) {
  if (!openId) {
    return null;
  }

  const docId = buildUserDocId(openId);

  try {
    const result = await db.collection('users').doc(docId).get();
    if (result.data) {
      return result.data;
    }
  } catch (error) {
    // Ignore missing canonical user doc and continue migrating legacy data.
  }

  const legacyUser = await findLegacyUser(openId);
  if (!legacyUser) {
    return null;
  }

  const normalizedUser = buildUserPayload(openId, legacyUser);
  await db.collection('users').doc(docId).set({
    data: normalizedUser
  });

  if (legacyUser._id && legacyUser._id !== docId) {
    await db.collection('users').doc(legacyUser._id).remove();
  }

  return {
    _id: docId,
    ...normalizedUser
  };
}

async function upsertUser(openId, profile = {}) {
  const now = Date.now();
  const currentUser = await getCurrentUser(openId);
  const docId = buildUserDocId(openId);
  const payload = buildUserPayload(openId, currentUser || {}, {
    nickname: profile.nickName || currentUser?.nickname || 'LinkUp User',
    avatarUrl: profile.avatarUrl || currentUser?.avatarUrl || '',
    updatedAt: now
  });

  await db.collection('users').doc(docId).set({
    data: payload
  });

  return {
    _id: docId,
    ...payload
  };
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const postId = event.postId;
  await upsertUser(OPENID, event.profile);

  const transaction = await db.startTransaction();
  try {
    const postRes = await transaction.collection('posts').doc(postId).get();
    const post = postRes.data;
    if (!post) {
      throw new Error('帖子不存在');
    }

    const participationRes = await transaction.collection('participations').where({
      postId,
      userOpenId: OPENID,
      status: 'active'
    }).limit(1).get();

    if (participationRes.data.length) {
      const participation = participationRes.data[0];
      if (participation.role === 'host') {
        throw new Error('发起人不能退出自己的帖子');
      }

      await transaction.collection('participations').doc(participation._id).update({
        data: {
          status: 'cancelled'
        }
      });

      if (post.mealTime > Date.now()) {
        const nextSeatRemaining = post.seatRemaining + 1;
        await transaction.collection('posts').doc(postId).update({
          data: {
            seatRemaining: nextSeatRemaining,
            status: getEffectiveStatus(post, nextSeatRemaining),
            updatedAt: Date.now()
          }
        });
      }

      await transaction.commit();
      return { success: true };
    }

    const requestRes = await transaction.collection('join_requests').where({
      postId,
      applicantOpenId: OPENID,
      status: 'pending'
    }).limit(1).get();

    if (!requestRes.data.length) {
      throw new Error('没有可取消的加入记录');
    }

    await transaction.collection('join_requests').doc(requestRes.data[0]._id).update({
      data: {
        status: 'cancelled',
        reviewedAt: Date.now()
      }
    });

    await transaction.commit();
    return { success: true };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};
