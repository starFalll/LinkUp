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

function getStatusText(status) {
  if (status === 'open') {
    return '可加入';
  }
  if (status === 'full') {
    return '已满员';
  }
  if (status === 'ended') {
    return '已结束';
  }
  return '已取消';
}

function buildCard(post) {
  const status = getEffectiveStatus(post);
  return {
    id: post._id,
    hostName: post.hostName,
    hostAvatar: post.hostAvatar,
    buildingName: post.buildingName,
    content: post.content,
    locationPreview: post.location,
    seatRemaining: post.seatRemaining,
    seatTotal: post.seatTotal,
    mealTime: post.mealTime,
    requiresApproval: post.requiresApproval,
    status,
    statusText: getStatusText(status),
    statusClassName: `tag-status status-${status}`
  };
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
  const user = event.profile ? await upsertUser(OPENID, event.profile) : await getCurrentUser(OPENID);

  if (!OPENID) {
    return {
      user: null,
      stats: { createdCount: 0, joinedCount: 0, historyCount: 0 },
      myHostedPosts: [],
      myJoinedPosts: [],
      myHistoryPosts: [],
      hostPendingRequests: []
    };
  }

  const [hostedRes, myParticipationRes] = await Promise.all([
    db.collection('posts').where({
      hostOpenId: OPENID
    }).orderBy('mealTime', 'asc').limit(100).get(),
    db.collection('participations').where({
      userOpenId: OPENID,
      status: _.in(['active', 'completed'])
    }).limit(100).get()
  ]);

  const participationPostIds = myParticipationRes.data.map((item) => item.postId);
  const joinedOnlyPostIds = myParticipationRes.data
    .filter((item) => item.role === 'guest')
    .map((item) => item.postId);

  const joinedPostsRes = joinedOnlyPostIds.length
    ? await db.collection('posts').where({
      _id: _.in(joinedOnlyPostIds)
    }).limit(100).get()
    : { data: [] };

  const hostPostIds = hostedRes.data.map((item) => item._id);
  const requestRes = hostPostIds.length
    ? await db.collection('join_requests').where({
      postId: _.in(hostPostIds),
      status: 'pending'
    }).limit(100).get()
    : { data: [] };

  const myHostedPosts = hostedRes.data
    .filter((item) => getEffectiveStatus(item) !== 'ended')
    .map(buildCard);

  const myJoinedPosts = joinedPostsRes.data
    .filter((item) => getEffectiveStatus(item) !== 'ended')
    .map(buildCard);

  const myHistoryPosts = [...hostedRes.data, ...joinedPostsRes.data]
    .filter((post, index, list) => list.findIndex((item) => item._id === post._id) === index)
    .filter((item) => participationPostIds.includes(item._id) && getEffectiveStatus(item) === 'ended')
    .sort((left, right) => right.mealTime - left.mealTime)
    .map(buildCard);

  const hostPendingRequests = requestRes.data.map((request) => {
    const post = hostedRes.data.find((item) => item._id === request.postId);
    return {
      id: request._id,
      applicantName: request.applicantName,
      applicantAvatar: request.applicantAvatar,
      postId: request.postId,
      postContent: post ? post.content : '',
      buildingName: post ? post.buildingName : '',
      createdAt: request.createdAt
    };
  });

  return {
    user: user ? {
      openId: OPENID,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      isAdmin: user.role === 'admin'
    } : null,
    stats: {
      createdCount: hostedRes.data.length,
      joinedCount: myParticipationRes.data.filter((item) => item.role === 'guest').length,
      historyCount: myHistoryPosts.length
    },
    myHostedPosts,
    myJoinedPosts,
    myHistoryPosts,
    hostPendingRequests
  };
};
