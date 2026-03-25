const { listCanteens } = require('../../utils/api');
const {
  buildShareAppMessage,
  buildShareTimeline
} = require('../../utils/share');

const REFRESH_WINDOW = 15000;

Page({
  data: {
    canteens: [],
    loading: false,
    lastLoadedAt: 0
  },

  onShow() {
    this.loadCanteens();
  },

  async loadCanteens(force = false) {
    if (this.data.loading) {
      return;
    }
    if (
      !force &&
      this.data.canteens.length &&
      Date.now() - this.data.lastLoadedAt < REFRESH_WINDOW
    ) {
      return;
    }

    this.setData({ loading: true });
    try {
      const { canteens } = await listCanteens();
      this.setData({
        canteens,
        lastLoadedAt: Date.now()
      });
    } catch (error) {
      wx.showToast({
        title: error.message || '加载失败',
        icon: 'none'
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  handleCardTap(event) {
    const { id } = event.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/canteen-detail/index?canteenId=${id}`
    });
  },

  onPullDownRefresh() {
    Promise.resolve(this.loadCanteens(true)).finally(() => wx.stopPullDownRefresh());
  },

  onShareAppMessage() {
    return buildShareAppMessage({
      title: 'LinkUp | 看看今天食堂吃什么',
      path: '/pages/canteen/index'
    });
  },

  onShareTimeline() {
    return buildShareTimeline({
      title: 'LinkUp | 看看今天食堂吃什么'
    });
  }
});
