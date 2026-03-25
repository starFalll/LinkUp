const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const USER_DOC_PREFIX = 'user_';

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
  const currentUser = event.profile
    ? await upsertUser(OPENID, event.profile)
    : await getCurrentUser(OPENID);

  if (!postId) {
    throw new Error('缺少帖子 ID');
  }

  const transaction = await db.startTransaction();
  try {
    const postRes = await transaction.collection('posts').doc(postId).get();
    const post = postRes.data;

    if (!post) {
      throw new Error('帖子不存在');
    }
    if (post.hostOpenId !== OPENID && currentUser?.role !== 'admin') {
      throw new Error('只有发起人或管理员可以删除帖子');
    }

    const [requestRes, participationRes] = await Promise.all([
      transaction.collection('join_requests').where({
        postId
      }).limit(100).get(),
      transaction.collection('participations').where({
        postId
      }).limit(100).get()
    ]);

    for (const request of requestRes.data) {
      await transaction.collection('join_requests').doc(request._id).remove();
    }

    for (const participation of participationRes.data) {
      await transaction.collection('participations').doc(participation._id).remove();
    }

    await transaction.collection('posts').doc(postId).remove();
    await transaction.commit();
    return { success: true };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};
