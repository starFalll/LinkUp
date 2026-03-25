function buildShareAppMessage({ title, path, imageUrl } = {}) {
  const payload = {
    title: title || 'LinkUp | 一起找饭搭子'
  };

  if (path) {
    payload.path = path;
  }
  if (imageUrl) {
    payload.imageUrl = imageUrl;
  }

  return payload;
}

function buildShareTimeline({ title, query, imageUrl } = {}) {
  const payload = {
    title: title || 'LinkUp | 一起找饭搭子'
  };

  if (query) {
    payload.query = query;
  }
  if (imageUrl) {
    payload.imageUrl = imageUrl;
  }

  return payload;
}

module.exports = {
  buildShareAppMessage,
  buildShareTimeline
};
