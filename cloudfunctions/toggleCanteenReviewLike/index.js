const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const USER_DOC_PREFIX = 'user_';

function isCollectionMissing(error) {
  return error && (
    error.errCode === -502005 ||
    String(error.message || '').includes('collection not exist')
  );
}

async function safeGetLikeRecord(reviewId, openId) {
  try {
    const result = await db.collection('canteen_review_likes').where({
      reviewId,
      userOpenId: openId
    }).limit(1).get();
    return result.data || [];
  } catch (error) {
    if (isCollectionMissing(error)) {
      return [];
    }
    throw error;
  }
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
  const reviewId = event.reviewId;

  if (!reviewId) {
    throw new Error('缺少评论 ID');
  }

  const reviewRes = await db.collection('canteen_reviews').doc(reviewId).get();
  if (!reviewRes.data) {
    throw new Error('评论不存在');
  }

  await upsertUser(OPENID, event.profile);

  const existingRecords = await safeGetLikeRecord(reviewId, OPENID);

  if (existingRecords.length) {
    await db.collection('canteen_review_likes').doc(existingRecords[0]._id).remove();
    return { liked: false };
  }

  await db.collection('canteen_review_likes').add({
    data: {
      reviewId,
      userOpenId: OPENID,
      createdAt: Date.now()
    }
  });

  return { liked: true };
};
