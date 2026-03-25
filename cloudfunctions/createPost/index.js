const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
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
  const input = event.input || {};

  if (!input.buildingId || !input.buildingName) {
    throw new Error('缺少楼宇信息');
  }
  if (!input.content || !input.content.trim()) {
    throw new Error('请填写约饭内容');
  }
  if (!input.location || !input.location.trim()) {
    throw new Error('请填写具体位置');
  }
  if (!Number.isFinite(input.seatTotal) || input.seatTotal <= 0) {
    throw new Error('剩余座位数必须大于 0');
  }
  if (!input.mealTime || input.mealTime <= Date.now()) {
    throw new Error('约饭时间必须晚于当前时间');
  }

  const user = await upsertUser(OPENID, event.profile);
  const now = Date.now();
  const postData = {
    hostOpenId: OPENID,
    hostName: user.nickname,
    hostAvatar: user.avatarUrl,
    buildingId: input.buildingId,
    buildingName: input.buildingName,
    content: input.content.trim(),
    location: input.location.trim(),
    seatTotal: input.seatTotal,
    seatRemaining: input.seatTotal,
    mealTime: input.mealTime,
    requiresApproval: Boolean(input.requiresApproval),
    status: 'open',
    createdAt: now,
    updatedAt: now
  };

  const postResult = await db.collection('posts').add({
    data: postData
  });

  await db.collection('participations').add({
    data: {
      postId: postResult._id,
      userOpenId: OPENID,
      userName: user.nickname,
      userAvatar: user.avatarUrl,
      role: 'host',
      joinMethod: 'direct',
      status: getEffectiveStatus(postData) === 'ended' ? 'completed' : 'active',
      joinedAt: now
    }
  });

  return {
    postId: postResult._id
  };
};
