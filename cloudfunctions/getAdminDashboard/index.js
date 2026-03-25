const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const USER_DOC_PREFIX = 'user_';
const DEFAULT_CANTEENS = [
  { _id: 'microsoft-cafe-83', name: 'Microsoft Cafe 83' },
  { _id: 'microsoft-cafe-16', name: 'Microsoft Cafe 16' },
  { _id: 'microsoft-cafe-86', name: 'Microsoft Cafe 86' },
  { _id: 'microsoft-cafe-25', name: 'Microsoft Cafe 25' },
  { _id: 'microsoft-cafe-112', name: 'Microsoft Cafe 112' },
  { _id: 'microsoft-cafe-99', name: 'Microsoft Cafe 99' },
  { _id: 'microsoft-cafe-121', name: 'Microsoft Cafe 121' },
  { _id: 'microsoft-cafe-34', name: 'Microsoft Cafe 34' },
  { _id: 'microsoft-one-esterra-food-hall', name: 'Microsoft One Esterra Food Hall' },
  { _id: 'microsoft-food-hall-9', name: 'Microsoft Food Hall 9' },
  { _id: 'microsoft-food-hall-6', name: 'Microsoft Food Hall 6' },
  { _id: 'microsoft-food-hall-4', name: 'Microsoft Food Hall 4' },
  { _id: 'microsoft-commons', name: 'Microsoft Commons' }
];

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

function getReviewOverallScore(review) {
  return (
    Number(review.environmentScore || 0) +
    Number(review.tasteScore || 0) +
    Number(review.priceScore || review.serviceScore || 0)
  ) / 3;
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

function roundToOne(value) {
  return Number((Number(value) || 0).toFixed(1));
}

function isCollectionMissing(error) {
  return error && (
    error.errCode === -502005 ||
    String(error.message || '').includes('collection not exist')
  );
}

async function safeGetCollectionRecords(collectionName, options = {}) {
  try {
    let query = db.collection(collectionName);
    if (options.where) {
      query = query.where(options.where);
    }
    if (options.orderBy) {
      query = query.orderBy(options.orderBy.field, options.orderBy.order);
    }
    if (options.limit) {
      query = query.limit(options.limit);
    }
    const result = await query.get();
    return result.data || [];
  } catch (error) {
    if (isCollectionMissing(error)) {
      return [];
    }
    throw error;
  }
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const currentUser = event.profile
    ? await upsertUser(OPENID, event.profile)
    : await getCurrentUser(OPENID);

  if (!currentUser || currentUser.role !== 'admin') {
    throw new Error('只有管理员可以访问');
  }

  const [posts, reviews, canteenRecords] = await Promise.all([
    safeGetCollectionRecords('posts', {
      orderBy: { field: 'createdAt', order: 'desc' },
      limit: 100
    }),
    safeGetCollectionRecords('canteen_reviews', {
      orderBy: { field: 'createdAt', order: 'desc' },
      limit: 100
    }),
    safeGetCollectionRecords('canteens', {
      limit: 100
    })
  ]);

  const canteenMap = new Map(DEFAULT_CANTEENS.map((item) => [item._id, item.name]));
  canteenRecords.forEach((item) => {
    if (item && item._id) {
      canteenMap.set(item._id, item.name || item.buildingName || item._id);
    }
  });

  return {
    user: {
      openId: OPENID,
      nickname: currentUser.nickname,
      avatarUrl: currentUser.avatarUrl || '',
      isAdmin: true
    },
    posts: posts.map((post) => {
      const status = getEffectiveStatus(post);
      return {
        id: post._id,
        hostOpenId: post.hostOpenId,
        hostName: post.hostName,
        hostAvatar: post.hostAvatar,
        hostInitial: (post.hostName || 'L').slice(0, 1),
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
    }),
    canteenReviews: reviews.map((review) => {
      const overallScore = roundToOne(getReviewOverallScore(review));
      return {
        id: review._id,
        canteenId: review.canteenId,
        canteenName: canteenMap.get(review.canteenId) || review.canteenId,
        userName: review.userName,
        userAvatar: review.userAvatar,
        userInitial: (review.userName || 'L').slice(0, 1),
        content: review.content,
        createdAt: review.createdAt,
        overallScore,
        overallScoreText: overallScore.toFixed(1)
      };
    })
  };
};
