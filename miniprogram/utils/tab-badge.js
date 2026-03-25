const { getMyDashboard } = require('./api');
const { getCurrentProfile, isProfileComplete } = require('./auth');

const MY_TAB_INDEX = 3;
const BADGE_REFRESH_WINDOW = 30000;

function setMyTabPendingBadge(pendingCount = 0) {
  const safeCount = Number(pendingCount) || 0;
  const app = getApp();
  app.globalData.myPendingRequestCount = safeCount;
  app.globalData.myPendingBadgeUpdatedAt = Date.now();

  if (safeCount > 0) {
    wx.setTabBarBadge({
      index: MY_TAB_INDEX,
      text: safeCount > 99 ? '99+' : String(safeCount)
    });
    return;
  }

  wx.removeTabBarBadge({
    index: MY_TAB_INDEX
  });
}

function clearMyTabPendingBadge() {
  const app = getApp();
  app.globalData.myPendingRequestCount = 0;
  app.globalData.myPendingBadgeUpdatedAt = Date.now();
  wx.removeTabBarBadge({
    index: MY_TAB_INDEX
  });
}

async function refreshMyTabPendingBadge(force = false) {
  const app = getApp();
  const profile = getCurrentProfile();

  if (!isProfileComplete(profile)) {
    clearMyTabPendingBadge();
    return 0;
  }

  const now = Date.now();
  if (
    !force &&
    app.globalData.myPendingBadgeUpdatedAt &&
    now - app.globalData.myPendingBadgeUpdatedAt < BADGE_REFRESH_WINDOW
  ) {
    setMyTabPendingBadge(app.globalData.myPendingRequestCount || 0);
    return app.globalData.myPendingRequestCount || 0;
  }

  if (app.globalData.myPendingBadgePromise) {
    return app.globalData.myPendingBadgePromise;
  }

  const pendingPromise = getMyDashboard(profile)
    .then((dashboard) => {
      const pendingCount = dashboard?.hostPendingRequests?.length || 0;
      setMyTabPendingBadge(pendingCount);
      return pendingCount;
    })
    .catch((error) => {
      console.warn('refreshMyTabPendingBadge failed:', error);
      return app.globalData.myPendingRequestCount || 0;
    })
    .finally(() => {
      app.globalData.myPendingBadgePromise = null;
    });

  app.globalData.myPendingBadgePromise = pendingPromise;
  return pendingPromise;
}

module.exports = {
  setMyTabPendingBadge,
  clearMyTabPendingBadge,
  refreshMyTabPendingBadge
};
