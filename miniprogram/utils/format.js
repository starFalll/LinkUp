const { POST_STATUS } = require('./constants');

function pad(number) {
  return `${number}`.padStart(2, '0');
}

function formatDateTime(timestamp) {
  if (!timestamp) {
    return '';
  }
  const date = new Date(timestamp);
  return `${date.getMonth() + 1}/${date.getDate()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatRelativeLabel(timestamp) {
  if (!timestamp) {
    return '';
  }

  const now = Date.now();
  const diff = timestamp - now;
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;

  if (diff < 0) {
    return '已结束';
  }
  if (diff < hour) {
    return `${Math.max(1, Math.floor(diff / (60 * 1000)))} 分钟后`;
  }
  if (diff < day) {
    return `${Math.floor(diff / hour)} 小时后`;
  }
  return `${Math.floor(diff / day)} 天后`;
}

function derivePostStatus(post) {
  const now = Date.now();
  if (!post) {
    return POST_STATUS.ENDED;
  }
  if (post.status === POST_STATUS.CANCELLED) {
    return POST_STATUS.CANCELLED;
  }
  if (post.mealTime <= now) {
    return POST_STATUS.ENDED;
  }
  if (post.seatRemaining <= 0) {
    return POST_STATUS.FULL;
  }
  return POST_STATUS.OPEN;
}

function getStatusText(status) {
  switch (status) {
    case POST_STATUS.OPEN:
      return '可加入';
    case POST_STATUS.FULL:
      return '已满员';
    case POST_STATUS.ENDED:
      return '已结束';
    case POST_STATUS.CANCELLED:
      return '已取消';
    default:
      return '未知状态';
  }
}

function buildStatusClass(status) {
  return `tag-status status-${status}`;
}

function toDateValue(timestamp) {
  const date = new Date(timestamp || Date.now() + 60 * 60 * 1000);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toTimeValue(timestamp) {
  const date = new Date(timestamp || Date.now() + 60 * 60 * 1000);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function mergeDateTime(dateValue, timeValue) {
  return new Date(`${dateValue}T${timeValue}:00`).getTime();
}

module.exports = {
  formatDateTime,
  formatRelativeLabel,
  derivePostStatus,
  getStatusText,
  buildStatusClass,
  toDateValue,
  toTimeValue,
  mergeDateTime
};
