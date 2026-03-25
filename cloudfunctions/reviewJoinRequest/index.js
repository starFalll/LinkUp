const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;
const USER_DOC_PREFIX = 'user_';

function getEffectiveStatus(post) {
  if (post.status === 'cancelled') {
    return 'cancelled';
  }
  if (post.mealTime <= Date.now()) {
    return 'ended';
  }
  if (post.seatRemaining <= 0) {
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
  const { requestId, action } = event;
  await upsertUser(OPENID, event.profile);

  const transaction = await db.startTransaction();
  try {
    const requestRes = await transaction.collection('join_requests').doc(requestId).get();
    const request = requestRes.data;
    if (!request || request.status !== 'pending') {
      throw new Error('申请不存在或已处理');
    }

    const postRes = await transaction.collection('posts').doc(request.postId).get();
    const post = postRes.data;
    if (!post) {
      throw new Error('帖子不存在');
    }
    if (post.hostOpenId !== OPENID) {
      throw new Error('只有发起人可以审批');
    }

    if (action === 'approve') {
      if (getEffectiveStatus(post) === 'ended') {
        throw new Error('帖子已结束，不能再审批');
      }
      if (post.seatRemaining <= 0) {
        throw new Error('已经没有剩余座位了');
      }
      const existingParticipation = await transaction.collection('participations').where({
        postId: request.postId,
        userOpenId: request.applicantOpenId,
        status: _.in(['active', 'completed'])
      }).limit(1).get();

      if (!existingParticipation.data.length) {
        await transaction.collection('participations').add({
          data: {
            postId: request.postId,
            userOpenId: request.applicantOpenId,
            userName: request.applicantName,
            userAvatar: request.applicantAvatar,
            role: 'guest',
            joinMethod: 'approved',
            status: 'active',
            joinedAt: Date.now()
          }
        });

        const nextSeatRemaining = post.seatRemaining - 1;
        await transaction.collection('posts').doc(request.postId).update({
          data: {
            seatRemaining: nextSeatRemaining,
            status: nextSeatRemaining <= 0 ? 'full' : 'open',
            updatedAt: Date.now()
          }
        });
      }

      await transaction.collection('join_requests').doc(requestId).update({
        data: {
          status: 'approved',
          reviewedAt: Date.now()
        }
      });
    } else {
      await transaction.collection('join_requests').doc(requestId).update({
        data: {
          status: 'rejected',
          reviewedAt: Date.now()
        }
      });
    }

    await transaction.commit();
    return { success: true };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};
