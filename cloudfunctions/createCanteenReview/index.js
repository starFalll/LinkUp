const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const USER_DOC_PREFIX = 'user_';
const DEFAULT_CANTEEN_IDS = new Set([
  'microsoft-cafe-83',
  'microsoft-cafe-16',
  'microsoft-cafe-86',
  'microsoft-cafe-25',
  'microsoft-cafe-112',
  'microsoft-cafe-99',
  'microsoft-cafe-121',
  'microsoft-cafe-34',
  'microsoft-one-esterra-food-hall',
  'microsoft-food-hall-9',
  'microsoft-food-hall-6',
  'microsoft-food-hall-4',
  'microsoft-commons'
]);

function normalizeReviewScore(value) {
  const score = Number(value);
  if (!Number.isFinite(score) || score < 1 || score > 5) {
    throw new Error('评分需要在 1 到 5 分之间');
  }
  return Math.round(score);
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
  const canteenId = event.canteenId;
  const input = event.input || {};

  if (!canteenId) {
    throw new Error('缺少食堂 ID');
  }

  const content = (input.content || '').trim();
  if (!content) {
    throw new Error('请先写下你的评论');
  }

  let canteenExists = DEFAULT_CANTEEN_IDS.has(canteenId);
  if (!canteenExists) {
    try {
      const canteenRes = await db.collection('canteens').doc(canteenId).get();
      canteenExists = Boolean(canteenRes.data);
    } catch (error) {
      canteenExists = false;
    }
  }

  if (!canteenExists) {
    throw new Error('食堂不存在');
  }

  const user = await upsertUser(OPENID, event.profile);
  const now = Date.now();

  await db.collection('canteen_reviews').add({
    data: {
      canteenId,
      userOpenId: OPENID,
      userName: user.nickname,
      userAvatar: user.avatarUrl,
      content,
      environmentScore: normalizeReviewScore(input.environmentScore),
      tasteScore: normalizeReviewScore(input.tasteScore),
      priceScore: normalizeReviewScore(input.priceScore ?? input.serviceScore),
      createdAt: now,
      updatedAt: now
    }
  });

  return { success: true };
};
