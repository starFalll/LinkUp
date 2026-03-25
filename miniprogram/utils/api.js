const { buildings } = require('../config/buildings');
const {
  POST_STATUS,
  JOIN_REQUEST_STATUS,
  PARTICIPATION_STATUS,
  JOIN_ACTION_STATE
} = require('./constants');
const {
  derivePostStatus,
  formatDateTime,
  formatRelativeLabel,
  getStatusText
} = require('./format');
const {
  createMockId,
  readMockDb,
  writeMockDb
} = require('./mock-db');

function isCloudAvailable() {
  return getApp().globalData.cloudAvailable;
}

function getBuildingName(buildingId) {
  const matched = buildings.find((item) => item.id === buildingId);
  return matched ? matched.name : '';
}

function getEffectiveStatus(post) {
  return derivePostStatus(post);
}

function getCurrentOpenId(profile) {
  return profile?.mockOpenId || null;
}

function upsertMockUser(db, profile) {
  if (!profile) {
    return null;
  }

  const openId = getCurrentOpenId(profile);
  if (!openId) {
    return null;
  }

  const existing = db.users.find((item) => item.openId === openId);
  const now = Date.now();
  if (existing) {
    existing.nickname = profile.nickName;
    existing.avatarUrl = profile.avatarUrl || '';
    existing.updatedAt = now;
    return existing;
  }

  const user = {
    _id: createMockId('user'),
    openId,
    nickname: profile.nickName,
    avatarUrl: profile.avatarUrl || '',
    createdAt: now,
    updatedAt: now
  };
  db.users.unshift(user);
  return user;
}

function isAdminUser(user) {
  return Boolean(user && user.role === 'admin');
}

function isAdminOpenId(db, openId) {
  if (!openId) {
    return false;
  }
  const user = db.users.find((item) => item.openId === openId);
  return isAdminUser(user);
}

function findPendingRequest(db, postId, openId) {
  return db.joinRequests.find((item) =>
    item.postId === postId &&
    item.applicantOpenId === openId &&
    item.status === JOIN_REQUEST_STATUS.PENDING
  );
}

function findActiveParticipation(db, postId, openId) {
  return db.participations.find((item) =>
    item.postId === postId &&
    item.userOpenId === openId &&
    item.status !== PARTICIPATION_STATUS.CANCELLED
  );
}

function getPostParticipants(db, postId) {
  return db.participations
    .filter((item) =>
      item.postId === postId &&
      item.status !== PARTICIPATION_STATUS.CANCELLED
    )
    .sort((left, right) => {
      if (left.role === right.role) {
        return left.joinedAt - right.joinedAt;
      }
      return left.role === 'host' ? -1 : 1;
    });
}

function canViewLocation(post, openId, db) {
  if (!post.requiresApproval) {
    return true;
  }
  if (!openId) {
    return false;
  }
  if (post.hostOpenId === openId) {
    return true;
  }
  const participation = findActiveParticipation(db, post._id, openId);
  return Boolean(participation);
}

function buildJoinActionState(post, openId, db) {
  const status = getEffectiveStatus(post);
  if (post.hostOpenId === openId) {
    return JOIN_ACTION_STATE.OWNER;
  }
  if (status === POST_STATUS.ENDED || status === POST_STATUS.CANCELLED) {
    return JOIN_ACTION_STATE.ENDED;
  }
  const participation = openId ? findActiveParticipation(db, post._id, openId) : null;
  if (participation) {
    return JOIN_ACTION_STATE.JOINED;
  }
  const pendingRequest = openId ? findPendingRequest(db, post._id, openId) : null;
  if (pendingRequest) {
    return JOIN_ACTION_STATE.PENDING;
  }
  if (status === POST_STATUS.FULL) {
    return JOIN_ACTION_STATE.FULL;
  }
  if (post.requiresApproval) {
    return JOIN_ACTION_STATE.NEED_APPLY;
  }
  return JOIN_ACTION_STATE.CAN_JOIN;
}

function buildPostCardView(post, openId, db) {
  const status = getEffectiveStatus(post);
  const locationVisible = canViewLocation(post, openId, db);
  return {
    id: post._id,
    hostName: post.hostName,
    hostAvatar: post.hostAvatar,
    hostInitial: (post.hostName || 'L').slice(0, 1),
    buildingName: post.buildingName,
    content: post.content,
    locationPreview: locationVisible ? post.location : '申请通过后可见具体位置',
    seatRemaining: post.seatRemaining,
    seatTotal: post.seatTotal,
    mealTime: post.mealTime,
    requiresApproval: post.requiresApproval,
    status,
    statusText: getStatusText(status),
    statusClassName: `tag-status status-${status}`,
    timeLabel: formatRelativeLabel(post.mealTime),
    formattedMealTime: formatDateTime(post.mealTime)
  };
}

function buildPostDetailView(post, openId, db) {
  const status = getEffectiveStatus(post);
  const locationVisible = canViewLocation(post, openId, db);
  const canDelete = post.hostOpenId === openId || isAdminOpenId(db, openId);
  const pendingRequests = post.hostOpenId === openId
    ? db.joinRequests
      .filter((item) => item.postId === post._id && item.status === JOIN_REQUEST_STATUS.PENDING)
      .map((item) => ({
        id: item._id,
        applicantName: item.applicantName,
        applicantAvatar: item.applicantAvatar,
        applicantInitial: (item.applicantName || 'L').slice(0, 1),
        createdAt: item.createdAt
      }))
    : [];

  return {
    id: post._id,
    hostOpenId: post.hostOpenId,
    hostName: post.hostName,
    hostAvatar: post.hostAvatar,
    hostInitial: (post.hostName || 'L').slice(0, 1),
    buildingName: post.buildingName,
    content: post.content,
    location: locationVisible ? post.location : '申请通过后可见具体位置',
    canViewLocation: locationVisible,
    locationMutedClass: locationVisible ? '' : 'detail-location__value--muted',
    seatRemaining: post.seatRemaining,
    seatTotal: post.seatTotal,
    mealTime: post.mealTime,
    requiresApproval: post.requiresApproval,
    requiresApprovalText: post.requiresApproval ? '需申请' : '可直接加入',
    status,
    statusText: getStatusText(status),
    formattedMealTime: formatDateTime(post.mealTime),
    canDelete,
    joinActionState: buildJoinActionState(post, openId, db),
    participants: getPostParticipants(db, post._id).map((item) => ({
      ...item,
      userInitial: (item.userName || 'L').slice(0, 1),
      roleText: item.role === 'host' ? '发起人' : '同行饭搭子',
      joinMethodText: item.joinMethod === 'approved' ? '审批通过' : '直接加入'
    })),
    pendingRequests
  };
}

function validatePostInput(input) {
  if (!input.buildingId || !getBuildingName(input.buildingId)) {
    throw new Error('请选择合法的楼宇');
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
}

function normalizePostShape(post, openId, db) {
  return buildPostCardView(post, openId, db);
}

function updatePostStatus(post) {
  post.status = getEffectiveStatus(post);
  post.updatedAt = Date.now();
}

function finalizeExpiredRecords(db) {
  const now = Date.now();
  db.posts.forEach((post) => {
    if (post.mealTime <= now && post.status !== POST_STATUS.CANCELLED) {
      post.status = POST_STATUS.ENDED;
    } else {
      post.status = getEffectiveStatus(post);
    }
  });

  db.participations.forEach((participation) => {
    const post = db.posts.find((item) => item._id === participation.postId);
    if (
      post &&
      post.mealTime <= now &&
      participation.status === PARTICIPATION_STATUS.ACTIVE
    ) {
      participation.status = PARTICIPATION_STATUS.COMPLETED;
    }
  });
}

function getPostByIdOrThrow(db, postId) {
  const post = db.posts.find((item) => item._id === postId);
  if (!post) {
    throw new Error('帖子不存在');
  }
  return post;
}

function getCanteenByIdOrThrow(db, canteenId) {
  const canteen = getAllAvailableCanteens(db).find((item) => item._id === canteenId);
  if (!canteen) {
    throw new Error('食堂不存在');
  }
  return canteen;
}

function roundToOne(value) {
  return Number((Number(value) || 0).toFixed(1));
}

function buildStarWidth(score) {
  const safeScore = Math.max(0, Math.min(5, Number(score) || 0));
  return `${(safeScore / 5) * 100}%`;
}

function getReviewOverallScore(review) {
  return (
    Number(review.environmentScore || 0) +
    Number(review.tasteScore || 0) +
    Number(review.priceScore || review.serviceScore || 0)
  ) / 3;
}

function getCanteenReviews(db, canteenId) {
  return db.canteenReviews.filter((item) => item.canteenId === canteenId);
}

function getReviewLikes(db, reviewId) {
  return db.canteenReviewLikes.filter((item) => item.reviewId === reviewId);
}

function buildScoreMetric(label, score) {
  return {
    label,
    score,
    scoreText: Number(score || 0).toFixed(1),
    starWidth: buildStarWidth(score)
  };
}

function getCanteenRatingSummary(db, canteenId) {
  const reviews = getCanteenReviews(db, canteenId);
  if (!reviews.length) {
    const zeroMetric = (label) => buildScoreMetric(label, 0);
    return {
      reviewCount: 0,
      reviewCountText: '0 人评分',
      overallScore: 0,
      overallScoreText: '0.0',
      overallStarWidth: buildStarWidth(0),
      environmentScore: 0,
      tasteScore: 0,
      priceScore: 0,
      metrics: [
        zeroMetric('环境'),
        zeroMetric('味道'),
        zeroMetric('价格')
      ]
    };
  }

  const total = reviews.reduce((accumulator, review) => ({
    overall: accumulator.overall + getReviewOverallScore(review),
    environment: accumulator.environment + Number(review.environmentScore || 0),
    taste: accumulator.taste + Number(review.tasteScore || 0),
    price: accumulator.price + Number(review.priceScore || review.serviceScore || 0)
  }), {
    overall: 0,
    environment: 0,
    taste: 0,
    price: 0
  });

  const reviewCount = reviews.length;
  const overallScore = roundToOne(total.overall / reviewCount);
  const environmentScore = roundToOne(total.environment / reviewCount);
  const tasteScore = roundToOne(total.taste / reviewCount);
  const priceScore = roundToOne(total.price / reviewCount);

  return {
    reviewCount,
    reviewCountText: `${reviewCount} 人评分`,
    overallScore,
    overallScoreText: overallScore.toFixed(1),
    overallStarWidth: buildStarWidth(overallScore),
    environmentScore,
    tasteScore,
    priceScore,
    metrics: [
      buildScoreMetric('环境', environmentScore),
      buildScoreMetric('味道', tasteScore),
      buildScoreMetric('价格', priceScore)
    ]
  };
}

function buildCanteenCardView(canteen, db) {
  const summary = getCanteenRatingSummary(db, canteen._id);
  return {
    id: canteen._id,
    name: canteen.name,
    buildingName: canteen.buildingName,
    location: canteen.location,
    description: canteen.description,
    featuredDishes: canteen.featuredDishes || [],
    reviewCount: summary.reviewCount,
    reviewCountText: summary.reviewCountText,
    overallScore: summary.overallScore,
    overallScoreText: summary.overallScoreText,
    overallStarWidth: summary.overallStarWidth,
    metrics: summary.metrics
  };
}

function buildDefaultCanteenCatalog() {
  return buildings.map((building) => ({
    _id: building.id,
    name: building.name,
    buildingId: building.id,
    buildingName: building.name,
    location: building.alias?.[building.alias.length - 1] || '',
    description: '还没有补充更多食堂介绍，欢迎先进去打分和评论。',
    featuredDishes: []
  }));
}

function getAllAvailableCanteens(db) {
  const defaultCatalog = buildDefaultCanteenCatalog();
  const cloudOrMockCatalog = Array.isArray(db.canteens) ? db.canteens : [];
  const mergedMap = new Map();

  defaultCatalog.forEach((canteen) => {
    mergedMap.set(canteen._id, canteen);
  });

  cloudOrMockCatalog.forEach((canteen) => {
    const base = mergedMap.get(canteen._id) || {};
    mergedMap.set(canteen._id, {
      ...base,
      ...canteen,
      _id: canteen._id || base._id,
      buildingId: canteen.buildingId || base.buildingId || canteen._id,
      buildingName: canteen.buildingName || base.buildingName || canteen.name || '',
      name: canteen.name || base.name || canteen.buildingName || '',
      location: canteen.location || base.location || '',
      description: canteen.description || base.description || '还没有补充更多食堂介绍，欢迎先进去打分和评论。',
      featuredDishes: canteen.featuredDishes || base.featuredDishes || []
    });
  });

  return Array.from(mergedMap.values());
}

function buildCanteenReviewView(review, openId, db) {
  const likes = getReviewLikes(db, review._id);
  const overallScore = roundToOne(getReviewOverallScore(review));

  return {
    id: review._id,
    userName: review.userName,
    userAvatar: review.userAvatar,
    userInitial: (review.userName || 'L').slice(0, 1),
    content: review.content,
    formattedCreatedAt: formatDateTime(review.createdAt),
    overallScore,
    overallScoreText: overallScore.toFixed(1),
    overallStarWidth: buildStarWidth(overallScore),
    likeCount: likes.length,
    likeText: likes.length ? `赞 ${likes.length}` : '点赞',
    liked: Boolean(openId && likes.some((item) => item.userOpenId === openId)),
    canDelete: isAdminOpenId(db, openId),
    metricBadges: [
      buildScoreMetric('环境', Number(review.environmentScore || 0)),
      buildScoreMetric('味道', Number(review.tasteScore || 0)),
      buildScoreMetric('价格', Number(review.priceScore || review.serviceScore || 0))
    ]
  };
}

function buildCanteenDetailView(canteen, openId, db) {
  const summary = getCanteenRatingSummary(db, canteen._id);
  const reviews = getCanteenReviews(db, canteen._id)
    .sort((left, right) => right.createdAt - left.createdAt)
    .map((review) => buildCanteenReviewView(review, openId, db));

  return {
    id: canteen._id,
    name: canteen.name,
    buildingName: canteen.buildingName,
    location: canteen.location,
    description: canteen.description,
    featuredDishes: canteen.featuredDishes || [],
    reviewCount: summary.reviewCount,
    reviewCountText: summary.reviewCountText,
    overallScore: summary.overallScore,
    overallScoreText: summary.overallScoreText,
    overallStarWidth: summary.overallStarWidth,
    metrics: summary.metrics,
    viewerIsAdmin: isAdminOpenId(db, openId),
    reviews
  };
}

function normalizeReviewScore(value) {
  const score = Number(value);
  if (!Number.isFinite(score) || score < 1 || score > 5) {
    throw new Error('评分需要在 1 到 5 分之间');
  }
  return Math.round(score);
}

function validateCanteenReviewInput(input = {}) {
  const content = (input.content || '').trim();
  if (!content) {
    throw new Error('请先写下你的评论');
  }

  return {
    content,
    environmentScore: normalizeReviewScore(input.environmentScore),
    tasteScore: normalizeReviewScore(input.tasteScore),
    priceScore: normalizeReviewScore(input.priceScore ?? input.serviceScore)
  };
}

function normalizeCloudPostCard(post) {
  if (!post) {
    return post;
  }

  return {
    ...post,
    formattedMealTime: formatDateTime(post.mealTime),
    timeLabel: formatRelativeLabel(post.mealTime)
  };
}

function normalizeCloudPostDetail(post) {
  if (!post) {
    return post;
  }

  return {
    ...post,
    formattedMealTime: formatDateTime(post.mealTime)
  };
}

function normalizeCloudDashboard(dashboard) {
  if (!dashboard) {
    return dashboard;
  }

  return {
    ...dashboard,
    myHostedPosts: (dashboard.myHostedPosts || []).map(normalizeCloudPostCard),
    myJoinedPosts: (dashboard.myJoinedPosts || []).map(normalizeCloudPostCard),
    myHistoryPosts: (dashboard.myHistoryPosts || []).map(normalizeCloudPostCard)
  };
}

function normalizeCloudCanteenReview(review) {
  if (!review) {
    return review;
  }

  return {
    ...review,
    formattedCreatedAt: formatDateTime(review.createdAt)
  };
}

function normalizeCloudCanteenDetail(canteen) {
  if (!canteen) {
    return canteen;
  }

  return {
    ...canteen,
    reviews: (canteen.reviews || []).map(normalizeCloudCanteenReview)
  };
}

function getRankingsFromDb(db, currentOpenId) {
  finalizeExpiredRecords(db);

  const completedParticipations = db.participations.filter((item) =>
    item.status === PARTICIPATION_STATUS.COMPLETED
  );

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
    .map((item, index) => ({ ...item, rank: index + 1 }));

  const buddyMap = new Map();
  if (currentOpenId) {
    const currentPostIds = new Set(
      completedParticipations
        .filter((item) => item.userOpenId === currentOpenId)
        .map((item) => item.postId)
    );

    currentPostIds.forEach((postId) => {
      completedParticipations
        .filter((item) => item.postId === postId && item.userOpenId !== currentOpenId)
        .forEach((mate) => {
          const previous = buddyMap.get(mate.userOpenId) || {
            userId: mate.userOpenId,
            nickname: mate.userName,
            avatarUrl: mate.userAvatar,
            count: 0
          };
          previous.count += 1;
          buddyMap.set(mate.userOpenId, previous);
        });
    });
  }

  const buddyRanking = Array.from(buddyMap.values())
    .sort((left, right) => right.count - left.count || left.nickname.localeCompare(right.nickname))
    .map((item, index) => ({ ...item, rank: index + 1 }));

  return {
    buddyRanking,
    activeRanking
  };
}

function getLocalListPosts(params = {}) {
  const db = readMockDb();
  finalizeExpiredRecords(db);
  writeMockDb(db);

  const openId = getCurrentOpenId(params.profile);
  const keyword = (params.keyword || '').trim().toLowerCase();

  const posts = db.posts
    .filter((post) => {
      const status = getEffectiveStatus(post);
      if (params.buildingId && post.buildingId !== params.buildingId) {
        return false;
      }
      if (params.status && status !== params.status) {
        return false;
      }
      if (!keyword) {
        return true;
      }
      const text = `${post.content} ${post.buildingName}`.toLowerCase();
      return text.includes(keyword);
    })
    .sort((left, right) => right.createdAt - left.createdAt)
    .map((post) => normalizePostShape(post, openId, db));

  return Promise.resolve({ posts });
}

function getLocalPostDetail(postId, profile) {
  const db = readMockDb();
  finalizeExpiredRecords(db);
  writeMockDb(db);
  const openId = getCurrentOpenId(profile);
  const post = getPostByIdOrThrow(db, postId);
  return Promise.resolve({ post: buildPostDetailView(post, openId, db) });
}

function createLocalPost(input, profile) {
  const db = readMockDb();
  validatePostInput(input);
  const user = upsertMockUser(db, profile);
  if (!user) {
    throw new Error('请先授权登录');
  }

  const now = Date.now();
  const postId = createMockId('post');
  const post = {
    _id: postId,
    hostOpenId: user.openId,
    hostName: user.nickname,
    hostAvatar: user.avatarUrl,
    buildingId: input.buildingId,
    buildingName: getBuildingName(input.buildingId),
    content: input.content.trim(),
    location: input.location.trim(),
    seatTotal: input.seatTotal,
    seatRemaining: input.seatTotal,
    mealTime: input.mealTime,
    requiresApproval: Boolean(input.requiresApproval),
    status: POST_STATUS.OPEN,
    createdAt: now,
    updatedAt: now
  };

  db.posts.unshift(post);
  db.participations.unshift({
    _id: createMockId('part'),
    postId,
    userOpenId: user.openId,
    userName: user.nickname,
    userAvatar: user.avatarUrl,
    role: 'host',
    joinMethod: 'direct',
    status: PARTICIPATION_STATUS.ACTIVE,
    joinedAt: now
  });
  writeMockDb(db);
  return Promise.resolve({ postId });
}

function joinLocalPostDirect(postId, profile) {
  const db = readMockDb();
  finalizeExpiredRecords(db);
  const user = upsertMockUser(db, profile);
  if (!user) {
    throw new Error('请先授权登录');
  }

  const post = getPostByIdOrThrow(db, postId);
  const status = getEffectiveStatus(post);
  if (status !== POST_STATUS.OPEN) {
    throw new Error('当前帖子无法直接加入');
  }
  if (post.requiresApproval) {
    throw new Error('该帖子需要先申请加入');
  }
  if (findActiveParticipation(db, postId, user.openId)) {
    throw new Error('你已经在这个约饭里了');
  }
  post.seatRemaining -= 1;
  updatePostStatus(post);
  db.participations.unshift({
    _id: createMockId('part'),
    postId,
    userOpenId: user.openId,
    userName: user.nickname,
    userAvatar: user.avatarUrl,
    role: 'guest',
    joinMethod: 'direct',
    status: PARTICIPATION_STATUS.ACTIVE,
    joinedAt: Date.now()
  });
  writeMockDb(db);
  return Promise.resolve({ success: true });
}

function applyLocalJoin(postId, profile) {
  const db = readMockDb();
  finalizeExpiredRecords(db);
  const user = upsertMockUser(db, profile);
  if (!user) {
    throw new Error('请先授权登录');
  }
  const post = getPostByIdOrThrow(db, postId);
  const status = getEffectiveStatus(post);
  if (status !== POST_STATUS.OPEN && status !== POST_STATUS.FULL) {
    throw new Error('当前帖子已结束，不能申请加入');
  }
  if (!post.requiresApproval) {
    throw new Error('当前帖子支持直接加入');
  }
  if (findActiveParticipation(db, postId, user.openId)) {
    throw new Error('你已经加入这个帖子了');
  }

  const existing = db.joinRequests.find((item) =>
    item.postId === postId && item.applicantOpenId === user.openId
  );
  const now = Date.now();

  if (existing) {
    existing.status = JOIN_REQUEST_STATUS.PENDING;
    existing.applicantName = user.nickname;
    existing.applicantAvatar = user.avatarUrl;
    existing.createdAt = now;
    existing.reviewedAt = null;
  } else {
    db.joinRequests.unshift({
      _id: createMockId('request'),
      postId,
      applicantOpenId: user.openId,
      applicantName: user.nickname,
      applicantAvatar: user.avatarUrl,
      status: JOIN_REQUEST_STATUS.PENDING,
      createdAt: now,
      reviewedAt: null
    });
  }

  writeMockDb(db);
  return Promise.resolve({ success: true });
}

function reviewLocalJoinRequest(requestId, action, profile) {
  const db = readMockDb();
  finalizeExpiredRecords(db);
  const reviewer = upsertMockUser(db, profile);
  if (!reviewer) {
    throw new Error('请先授权登录');
  }

  const request = db.joinRequests.find((item) => item._id === requestId);
  if (!request || request.status !== JOIN_REQUEST_STATUS.PENDING) {
    throw new Error('申请不存在或已处理');
  }

  const post = getPostByIdOrThrow(db, request.postId);
  if (post.hostOpenId !== reviewer.openId) {
    throw new Error('只有发起人可以审批');
  }

  if (action === 'approve') {
    if (getEffectiveStatus(post) === POST_STATUS.ENDED) {
      throw new Error('帖子已结束，不能再审批');
    }
    if (post.seatRemaining <= 0) {
      throw new Error('没有剩余座位了');
    }
    if (!findActiveParticipation(db, post._id, request.applicantOpenId)) {
      db.participations.unshift({
        _id: createMockId('part'),
        postId: post._id,
        userOpenId: request.applicantOpenId,
        userName: request.applicantName,
        userAvatar: request.applicantAvatar,
        role: 'guest',
        joinMethod: 'approved',
        status: PARTICIPATION_STATUS.ACTIVE,
        joinedAt: Date.now()
      });
      post.seatRemaining -= 1;
      updatePostStatus(post);
    }
    request.status = JOIN_REQUEST_STATUS.APPROVED;
  } else {
    request.status = JOIN_REQUEST_STATUS.REJECTED;
  }

  request.reviewedAt = Date.now();
  writeMockDb(db);
  return Promise.resolve({ success: true });
}

function leaveLocalPost(postId, profile) {
  const db = readMockDb();
  finalizeExpiredRecords(db);
  const user = upsertMockUser(db, profile);
  if (!user) {
    throw new Error('请先授权登录');
  }

  const post = getPostByIdOrThrow(db, postId);
  const participation = db.participations.find((item) =>
    item.postId === postId &&
    item.userOpenId === user.openId &&
    item.status === PARTICIPATION_STATUS.ACTIVE
  );

  if (participation && participation.role === 'host') {
    throw new Error('发起人不能直接退出自己的帖子');
  }

  if (participation) {
    participation.status = PARTICIPATION_STATUS.CANCELLED;
    if (post.mealTime > Date.now()) {
      post.seatRemaining += 1;
      updatePostStatus(post);
    }
    writeMockDb(db);
    return Promise.resolve({ success: true });
  }

  const pendingRequest = findPendingRequest(db, postId, user.openId);
  if (pendingRequest) {
    pendingRequest.status = JOIN_REQUEST_STATUS.CANCELLED;
    pendingRequest.reviewedAt = Date.now();
    writeMockDb(db);
    return Promise.resolve({ success: true });
  }

  throw new Error('你当前没有可退出的加入记录');
}

function deleteLocalPost(postId, profile) {
  const db = readMockDb();
  const user = upsertMockUser(db, profile);
  if (!user) {
    throw new Error('请先授权登录');
  }

  const postIndex = db.posts.findIndex((item) => item._id === postId);
  if (postIndex < 0) {
    throw new Error('帖子不存在');
  }

  const post = db.posts[postIndex];
  if (post.hostOpenId !== user.openId && !isAdminUser(user)) {
    throw new Error('只有发起人或管理员可以删除帖子');
  }

  db.posts.splice(postIndex, 1);
  db.joinRequests = db.joinRequests.filter((item) => item.postId !== postId);
  db.participations = db.participations.filter((item) => item.postId !== postId);
  writeMockDb(db);
  return Promise.resolve({ success: true });
}

function deleteLocalCanteenReview(reviewId, profile) {
  const db = readMockDb();
  const user = upsertMockUser(db, profile);
  if (!user) {
    throw new Error('请先授权登录');
  }
  if (!isAdminUser(user)) {
    throw new Error('只有管理员可以删除评论');
  }

  const reviewIndex = db.canteenReviews.findIndex((item) => item._id === reviewId);
  if (reviewIndex < 0) {
    throw new Error('评论不存在');
  }

  db.canteenReviews.splice(reviewIndex, 1);
  db.canteenReviewLikes = db.canteenReviewLikes.filter((item) => item.reviewId !== reviewId);
  writeMockDb(db);
  return Promise.resolve({ success: true });
}

function getLocalCanteens() {
  const db = readMockDb();
  const canteens = getAllAvailableCanteens(db)
    .map((canteen) => buildCanteenCardView(canteen, db))
    .sort((left, right) => {
      if (right.overallScore !== left.overallScore) {
        return right.overallScore - left.overallScore;
      }
      if (right.reviewCount !== left.reviewCount) {
        return right.reviewCount - left.reviewCount;
      }
      return left.name.localeCompare(right.name);
    });

  return Promise.resolve({ canteens });
}

function getLocalCanteenDetail(canteenId, profile) {
  const db = readMockDb();
  const openId = getCurrentOpenId(profile);
  const canteen = getCanteenByIdOrThrow(db, canteenId);
  return Promise.resolve({
    canteen: buildCanteenDetailView(canteen, openId, db)
  });
}

function createLocalCanteenReview(canteenId, input, profile) {
  const db = readMockDb();
  const user = upsertMockUser(db, profile);
  if (!user) {
    throw new Error('请先授权登录');
  }

  getCanteenByIdOrThrow(db, canteenId);
  const normalizedInput = validateCanteenReviewInput(input);
  const now = Date.now();

  db.canteenReviews.unshift({
    _id: createMockId('canteen_review'),
    canteenId,
    userOpenId: user.openId,
    userName: user.nickname,
    userAvatar: user.avatarUrl,
    content: normalizedInput.content,
    environmentScore: normalizedInput.environmentScore,
    tasteScore: normalizedInput.tasteScore,
    priceScore: normalizedInput.priceScore,
    createdAt: now,
    updatedAt: now
  });

  writeMockDb(db);
  return Promise.resolve({ success: true });
}

function toggleLocalCanteenReviewLike(reviewId, profile) {
  const db = readMockDb();
  const user = upsertMockUser(db, profile);
  if (!user) {
    throw new Error('请先授权登录');
  }

  const review = db.canteenReviews.find((item) => item._id === reviewId);
  if (!review) {
    throw new Error('评论不存在');
  }

  const existingIndex = db.canteenReviewLikes.findIndex((item) =>
    item.reviewId === reviewId && item.userOpenId === user.openId
  );

  let liked = false;
  if (existingIndex >= 0) {
    db.canteenReviewLikes.splice(existingIndex, 1);
  } else {
    db.canteenReviewLikes.unshift({
      _id: createMockId('review_like'),
      reviewId,
      userOpenId: user.openId,
      createdAt: Date.now()
    });
    liked = true;
  }

  writeMockDb(db);
  return Promise.resolve({ liked });
}

function getLocalDashboard(profile) {
  const db = readMockDb();
  finalizeExpiredRecords(db);
  const user = profile ? upsertMockUser(db, profile) : null;
  writeMockDb(db);
  const openId = user ? user.openId : null;

  if (!openId) {
    return Promise.resolve({
      user: null,
      stats: {
        createdCount: 0,
        joinedCount: 0,
        historyCount: 0
      },
      myHostedPosts: [],
      myJoinedPosts: [],
      myHistoryPosts: [],
      hostPendingRequests: []
    });
  }

  const myHostedPosts = db.posts
    .filter((item) => item.hostOpenId === openId && getEffectiveStatus(item) !== POST_STATUS.ENDED)
    .sort((left, right) => left.mealTime - right.mealTime)
    .map((post) => buildPostCardView(post, openId, db));

  const myJoinedPosts = db.posts
    .filter((post) => {
      if (getEffectiveStatus(post) === POST_STATUS.ENDED) {
        return false;
      }
      const participation = db.participations.find((item) =>
        item.postId === post._id &&
        item.userOpenId === openId &&
        item.role === 'guest' &&
        item.status === PARTICIPATION_STATUS.ACTIVE
      );
      return Boolean(participation);
    })
    .sort((left, right) => left.mealTime - right.mealTime)
    .map((post) => buildPostCardView(post, openId, db));

  const myHistoryPosts = db.posts
    .filter((post) => {
      if (getEffectiveStatus(post) !== POST_STATUS.ENDED) {
        return false;
      }
      return db.participations.some((item) =>
        item.postId === post._id &&
        item.userOpenId === openId &&
        item.status === PARTICIPATION_STATUS.COMPLETED
      );
    })
    .sort((left, right) => right.mealTime - left.mealTime)
    .map((post) => buildPostCardView(post, openId, db));

  const hostPendingRequests = db.joinRequests
    .filter((request) => {
      if (request.status !== JOIN_REQUEST_STATUS.PENDING) {
        return false;
      }
      const post = db.posts.find((item) => item._id === request.postId);
      return post && post.hostOpenId === openId;
    })
    .map((request) => {
      const post = db.posts.find((item) => item._id === request.postId);
      return {
        id: request._id,
        applicantName: request.applicantName,
        applicantAvatar: request.applicantAvatar,
        postId: request.postId,
        postContent: post ? post.content : '',
        buildingName: post ? post.buildingName : '',
        createdAt: request.createdAt
      };
    })
    .sort((left, right) => right.createdAt - left.createdAt);

  return Promise.resolve({
    user: {
      openId,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      isAdmin: isAdminUser(user)
    },
    stats: {
      createdCount: db.posts.filter((item) => item.hostOpenId === openId).length,
      joinedCount: db.participations.filter((item) =>
        item.userOpenId === openId &&
        item.role === 'guest' &&
        item.status !== PARTICIPATION_STATUS.CANCELLED
      ).length,
      historyCount: myHistoryPosts.length
    },
    myHostedPosts,
    myJoinedPosts,
    myHistoryPosts,
    hostPendingRequests
  });
}

function getLocalAdminDashboard(profile) {
  const db = readMockDb();
  finalizeExpiredRecords(db);
  const user = profile ? upsertMockUser(db, profile) : null;
  writeMockDb(db);

  if (!isAdminUser(user)) {
    throw new Error('只有管理员可以访问');
  }

  const openId = user.openId;
  const posts = db.posts
    .slice()
    .sort((left, right) => right.createdAt - left.createdAt)
    .map((post) => ({
      ...buildPostCardView(post, openId, db),
      hostOpenId: post.hostOpenId
    }));

  const canteenMap = new Map(
    getAllAvailableCanteens(db).map((item) => [item._id, item])
  );

  const canteenReviews = db.canteenReviews
    .slice()
    .sort((left, right) => right.createdAt - left.createdAt)
    .map((review) => {
      const canteen = canteenMap.get(review.canteenId);
      const overallScore = roundToOne(getReviewOverallScore(review));
      return {
        id: review._id,
        canteenId: review.canteenId,
        canteenName: canteen?.name || review.canteenId,
        userName: review.userName,
        userAvatar: review.userAvatar,
        userInitial: (review.userName || 'L').slice(0, 1),
        content: review.content,
        createdAt: review.createdAt,
        formattedCreatedAt: formatDateTime(review.createdAt),
        overallScore,
        overallScoreText: overallScore.toFixed(1)
      };
    });

  return Promise.resolve({
    user: {
      openId,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      isAdmin: true
    },
    posts,
    canteenReviews
  });
}

function getLocalRankings(profile) {
  const db = readMockDb();
  finalizeExpiredRecords(db);
  const user = profile ? upsertMockUser(db, profile) : null;
  writeMockDb(db);
  return Promise.resolve(getRankingsFromDb(db, user ? user.openId : null));
}

function wrapCallFunction(name, data = {}) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name,
      data,
      success: ({ result }) => resolve(result),
      fail: reject
    });
  });
}

function listPosts(params = {}) {
  if (isCloudAvailable()) {
    return wrapCallFunction('listPosts', params).then((result) => ({
      ...result,
      posts: (result.posts || []).map(normalizeCloudPostCard)
    }));
  }
  return getLocalListPosts(params);
}

function getPostDetail(postId, profile) {
  if (isCloudAvailable()) {
    return wrapCallFunction('getPostDetail', { postId, profile }).then((result) => ({
      ...result,
      post: normalizeCloudPostDetail(result.post)
    }));
  }
  return getLocalPostDetail(postId, profile);
}

function createPost(input, profile) {
  const normalizedInput = {
    ...input,
    buildingName: getBuildingName(input.buildingId)
  };
  if (isCloudAvailable()) {
    return wrapCallFunction('createPost', { input: normalizedInput, profile });
  }
  return createLocalPost(normalizedInput, profile);
}

function joinPostDirect(postId, profile) {
  if (isCloudAvailable()) {
    return wrapCallFunction('joinPostDirect', { postId, profile });
  }
  return joinLocalPostDirect(postId, profile);
}

function applyToJoinPost(postId, profile) {
  if (isCloudAvailable()) {
    return wrapCallFunction('applyToJoinPost', { postId, profile });
  }
  return applyLocalJoin(postId, profile);
}

function reviewJoinRequest(requestId, action, profile) {
  if (isCloudAvailable()) {
    return wrapCallFunction('reviewJoinRequest', { requestId, action, profile });
  }
  return reviewLocalJoinRequest(requestId, action, profile);
}

function leavePost(postId, profile) {
  if (isCloudAvailable()) {
    return wrapCallFunction('leavePost', { postId, profile });
  }
  return leaveLocalPost(postId, profile);
}

function deletePost(postId, profile) {
  if (isCloudAvailable()) {
    return wrapCallFunction('deletePost', { postId, profile });
  }
  return deleteLocalPost(postId, profile);
}

function getMyDashboard(profile) {
  if (isCloudAvailable()) {
    return wrapCallFunction('getMyDashboard', { profile }).then(normalizeCloudDashboard);
  }
  return getLocalDashboard(profile);
}

function getAdminDashboard(profile) {
  if (isCloudAvailable()) {
    return wrapCallFunction('getAdminDashboard', { profile }).then((dashboard) => ({
      ...dashboard,
      posts: (dashboard.posts || []).map(normalizeCloudPostCard),
      canteenReviews: (dashboard.canteenReviews || []).map(normalizeCloudCanteenReview)
    }));
  }
  return getLocalAdminDashboard(profile);
}

function getRankings(profile) {
  if (isCloudAvailable()) {
    return wrapCallFunction('getRankings', { profile });
  }
  return getLocalRankings(profile);
}

function listCanteens() {
  if (isCloudAvailable()) {
    return wrapCallFunction('listCanteens');
  }
  return getLocalCanteens();
}

function getCanteenDetail(canteenId, profile) {
  if (isCloudAvailable()) {
    return wrapCallFunction('getCanteenDetail', { canteenId, profile }).then((result) => ({
      ...result,
      canteen: normalizeCloudCanteenDetail(result.canteen)
    }));
  }
  return getLocalCanteenDetail(canteenId, profile);
}

function createCanteenReview(canteenId, input, profile) {
  if (isCloudAvailable()) {
    return wrapCallFunction('createCanteenReview', { canteenId, input, profile });
  }
  return createLocalCanteenReview(canteenId, input, profile);
}

function toggleCanteenReviewLike(reviewId, profile) {
  if (isCloudAvailable()) {
    return wrapCallFunction('toggleCanteenReviewLike', { reviewId, profile });
  }
  return toggleLocalCanteenReviewLike(reviewId, profile);
}

function deleteCanteenReview(reviewId, profile) {
  if (isCloudAvailable()) {
    return wrapCallFunction('deleteCanteenReview', { reviewId, profile });
  }
  return deleteLocalCanteenReview(reviewId, profile);
}

module.exports = {
  listPosts,
  getPostDetail,
  createPost,
  joinPostDirect,
  applyToJoinPost,
  reviewJoinRequest,
  leavePost,
  deletePost,
  getMyDashboard,
  getAdminDashboard,
  getRankings,
  listCanteens,
  getCanteenDetail,
  createCanteenReview,
  toggleCanteenReviewLike,
  deleteCanteenReview,
  getBuildingName
};
