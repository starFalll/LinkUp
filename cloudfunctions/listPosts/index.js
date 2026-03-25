const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

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

function formatRelativeLabel(timestamp) {
  const diff = timestamp - Date.now();
  if (diff <= 0) {
    return '已结束';
  }
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;
  if (diff < hour) {
    return `${Math.max(1, Math.floor(diff / (60 * 1000)))} 分钟后`;
  }
  if (diff < day) {
    return `${Math.floor(diff / hour)} 小时后`;
  }
  return `${Math.floor(diff / day)} 天后`;
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const query = {};
  if (event.buildingId) {
    query.buildingId = event.buildingId;
  }

  const postRes = await db.collection('posts')
    .where(query)
    .orderBy('createdAt', 'desc')
    .limit(100)
    .get();

  const participationRes = OPENID
    ? await db.collection('participations').where({
      userOpenId: OPENID,
      status: _.in(['active', 'completed'])
    }).limit(100).get()
    : { data: [] };

  const approvedPostIds = new Set(participationRes.data.map((item) => item.postId));
  const keyword = (event.keyword || '').trim().toLowerCase();

  const posts = postRes.data
    .map((post) => {
      const status = getEffectiveStatus(post);
      const canViewLocation = !post.requiresApproval || post.hostOpenId === OPENID || approvedPostIds.has(post._id);
      return {
        id: post._id,
        hostName: post.hostName,
        hostAvatar: post.hostAvatar,
        hostInitial: (post.hostName || 'L').slice(0, 1),
        buildingName: post.buildingName,
        content: post.content,
        locationPreview: canViewLocation ? post.location : '申请通过后可见具体位置',
        seatRemaining: post.seatRemaining,
        seatTotal: post.seatTotal,
        mealTime: post.mealTime,
        requiresApproval: post.requiresApproval,
        status,
        statusText: getStatusText(status),
        statusClassName: `tag-status status-${status}`,
        timeLabel: formatRelativeLabel(post.mealTime)
      };
    })
    .filter((post) => {
      if (event.status && post.status !== event.status) {
        return false;
      }
      if (!keyword) {
        return true;
      }
      return `${post.content} ${post.buildingName}`.toLowerCase().includes(keyword);
    });

  return { posts };
};
