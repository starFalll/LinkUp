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

function buildJoinActionState(post, openId, participation, pendingRequest) {
  const status = getEffectiveStatus(post);
  if (post.hostOpenId === openId) {
    return 'owner';
  }
  if (status === 'ended' || status === 'cancelled') {
    return 'ended';
  }
  if (participation) {
    return 'joined';
  }
  if (pendingRequest) {
    return 'pending';
  }
  if (status === 'full') {
    return 'full';
  }
  if (post.requiresApproval) {
    return 'needApply';
  }
  return 'canJoin';
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

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const postId = event.postId;
  const currentUser = await getCurrentUser(OPENID);
  const isAdmin = Boolean(currentUser && currentUser.role === 'admin');

  const postRes = await db.collection('posts').doc(postId).get();
  const post = postRes.data;

  if (!post) {
    throw new Error('帖子不存在');
  }

  const [participationRes, pendingRes, participantsRes] = await Promise.all([
    OPENID ? db.collection('participations').where({
      postId,
      userOpenId: OPENID,
      status: _.in(['active', 'completed'])
    }).limit(1).get() : Promise.resolve({ data: [] }),
    OPENID ? db.collection('join_requests').where({
      postId,
      applicantOpenId: OPENID,
      status: 'pending'
    }).limit(1).get() : Promise.resolve({ data: [] }),
    db.collection('participations').where({
      postId,
      status: _.in(['active', 'completed'])
    }).limit(100).get()
  ]);

  const pendingRequests = post.hostOpenId === OPENID
    ? await db.collection('join_requests').where({
      postId,
      status: 'pending'
    }).limit(100).get()
    : { data: [] };

  const status = getEffectiveStatus(post);
  const participation = participationRes.data[0] || null;
  const pendingRequest = pendingRes.data[0] || null;
  const canViewLocation = !post.requiresApproval || post.hostOpenId === OPENID || Boolean(participation);

  return {
    post: {
      id: post._id,
      hostOpenId: post.hostOpenId,
      hostName: post.hostName,
      hostAvatar: post.hostAvatar,
      hostInitial: (post.hostName || 'L').slice(0, 1),
      buildingName: post.buildingName,
      content: post.content,
      location: canViewLocation ? post.location : '申请通过后可见具体位置',
      canViewLocation,
      locationMutedClass: canViewLocation ? '' : 'detail-location__value--muted',
      seatRemaining: post.seatRemaining,
      seatTotal: post.seatTotal,
      mealTime: post.mealTime,
      requiresApproval: post.requiresApproval,
      requiresApprovalText: post.requiresApproval ? '需申请' : '可直接加入',
      status,
      statusText: getStatusText(status),
      canDelete: post.hostOpenId === OPENID || isAdmin,
      joinActionState: buildJoinActionState(post, OPENID, participation, pendingRequest),
      participants: participantsRes.data.sort((left, right) => {
        if (left.role === right.role) {
          return left.joinedAt - right.joinedAt;
        }
        return left.role === 'host' ? -1 : 1;
      }).map((item) => ({
        ...item,
        userInitial: (item.userName || 'L').slice(0, 1),
        roleText: item.role === 'host' ? '发起人' : '同行饭搭子',
        joinMethodText: item.joinMethod === 'approved' ? '审批通过' : '直接加入'
      })),
      pendingRequests: pendingRequests.data.map((item) => ({
        id: item._id,
        applicantName: item.applicantName,
        applicantAvatar: item.applicantAvatar,
        applicantInitial: (item.applicantName || 'L').slice(0, 1),
        createdAt: item.createdAt
      }))
    }
  };
};
