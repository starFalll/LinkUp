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
  if (event.profile) {
    await upsertUser(OPENID, event.profile);
  }

  const completedRes = await db.collection('participations').where({
    status: 'completed'
  }).limit(200).get();

  const completedParticipations = completedRes.data;
  const activeMap = new Map();

  completedParticipations.forEach((item) => {
    const previous = activeMap.get(item.userOpenId) || {
      userId: item.userOpenId,
      nickname: item.userName,
      avatarUrl: item.userAvatar,
      count: 0
    };
    previous.count += 1;
    activeMap.set(item.userOpenId, previous);
  });

  const activeRanking = Array.from(activeMap.values())
    .sort((left, right) => right.count - left.count || left.nickname.localeCompare(right.nickname))
    .map((item, index) => ({
      ...item,
      rank: index + 1
    }));

  const myPostIds = new Set(
    completedParticipations
      .filter((item) => item.userOpenId === OPENID)
      .map((item) => item.postId)
  );

  const buddyMap = new Map();
  myPostIds.forEach((postId) => {
    completedParticipations
      .filter((item) => item.postId === postId && item.userOpenId !== OPENID)
      .forEach((item) => {
        const previous = buddyMap.get(item.userOpenId) || {
          userId: item.userOpenId,
          nickname: item.userName,
          avatarUrl: item.userAvatar,
          count: 0
        };
        previous.count += 1;
        buddyMap.set(item.userOpenId, previous);
      });
  });

  const buddyRanking = Array.from(buddyMap.values())
    .sort((left, right) => right.count - left.count || left.nickname.localeCompare(right.nickname))
    .map((item, index) => ({
      ...item,
      rank: index + 1
    }));

  return {
    buddyRanking,
    activeRanking
  };
};
