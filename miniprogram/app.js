const { cloudEnvId, useLocalMockWhenCloudUnavailable } = require('./config/runtime');
const { ensureMockSeedData } = require('./utils/mock-db');
const { clearMyTabPendingBadge } = require('./utils/tab-badge');

App({
  globalData: {
    cloudAvailable: false,
    currentUserProfile: wx.getStorageSync('linkup-user-profile') || null,
    myPendingRequestCount: 0,
    myPendingBadgeUpdatedAt: 0,
    myPendingBadgePromise: null
  },

  onLaunch() {
    const canUseCloud = Boolean(wx.cloud) && Boolean(cloudEnvId) && cloudEnvId !== 'replace-with-your-env-id';

    if (canUseCloud) {
      wx.cloud.init({
        env: cloudEnvId,
        traceUser: true
      });
      this.globalData.cloudAvailable = true;
      return;
    }

    this.globalData.cloudAvailable = false;
    if (useLocalMockWhenCloudUnavailable) {
      ensureMockSeedData();
    }
  },

  setCurrentUserProfile(profile) {
    this.globalData.currentUserProfile = profile;
    wx.setStorageSync('linkup-user-profile', profile);
  },

  clearCurrentUserProfile() {
    this.globalData.currentUserProfile = null;
    wx.removeStorageSync('linkup-user-profile');
    clearMyTabPendingBadge();
  }
});
