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
  const postId = event.postId;
  const user = await upsertUser(OPENID, event.profile);

  const postRes = await db.collection('posts').doc(postId).get();
  const post = postRes.data;
  if (!post) {
    throw new Error('帖子不存在');
  }
  if (!post.requiresApproval) {
    throw new Error('当前帖子支持直接加入');
  }
  if (post.hostOpenId === OPENID) {
    throw new Error('发起人不能申请自己的帖子');
  }
  if (!['open', 'full'].includes(getEffectiveStatus(post))) {
    throw new Error('帖子已结束，无法申请');
  }

  const participationRes = await db.collection('participations').where({
    postId,
    userOpenId: OPENID,
    status: _.in(['active', 'completed'])
  }).limit(1).get();

  if (participationRes.data.length) {
    throw new Error('你已经加入过这个帖子');
  }

  const requestRes = await db.collection('join_requests').where({
    postId,
    applicantOpenId: OPENID
  }).limit(1).get();

  const now = Date.now();
  if (requestRes.data.length) {
    await db.collection('join_requests').doc(requestRes.data[0]._id).update({
      data: {
        applicantName: user.nickname,
        applicantAvatar: user.avatarUrl,
        status: 'pending',
        createdAt: now,
        reviewedAt: null
      }
    });
  } else {
    await db.collection('join_requests').add({
      data: {
        postId,
        applicantOpenId: OPENID,
        applicantName: user.nickname,
        applicantAvatar: user.avatarUrl,
        status: 'pending',
        createdAt: now,
        reviewedAt: null
      }
    });
  }

  return { success: true };
};
