const {
  getAdminDashboard,
  deletePost,
  deleteCanteenReview
} = require('../../utils/api');
const { requestUserProfile, getCurrentProfile } = require('../../utils/auth');

const REFRESH_WINDOW = 15000;

Page({
  data: {
    dashboard: null,
    loading: false,
    lastLoadedAt: 0
  },

  onShow() {
    this.loadData();
  },

  async loadData(force = false) {
    if (this.data.loading) {
      return;
    }
    if (
      !force &&
      this.data.dashboard &&
      Date.now() - this.data.lastLoadedAt < REFRESH_WINDOW
    ) {
      return;
    }

    this.setData({ loading: true });
    try {
      const dashboard = await getAdminDashboard(getCurrentProfile());
      this.setData({
        dashboard,
        lastLoadedAt: Date.now()
      });
    } catch (error) {
      wx.showToast({
        title: error.message || '加载失败',
        icon: 'none'
      });

      if ((error.message || '').includes('管理员')) {
        setTimeout(() => {
          wx.navigateBack({
            fail: () => {
              wx.switchTab({
                url: '/pages/my/index'
              });
            }
          });
        }, 400);
      }
    } finally {
      this.setData({ loading: false });
    }
  },

  handlePostTap(event) {
    const postId = event.currentTarget.dataset.postId;
    wx.navigateTo({
      url: `/pages/post-detail/index?postId=${postId}`
    });
  },

  handleCanteenTap(event) {
    const canteenId = event.currentTarget.dataset.canteenId;
    wx.navigateTo({
      url: `/pages/canteen-detail/index?canteenId=${canteenId}`
    });
  },

  async handleDeletePost(event) {
    const postId = event.currentTarget.dataset.postId;
    if (!postId) {
      return;
    }

    const { confirm } = await wx.showModal({
      title: '删除帖子',
      content: '删除后，这条约饭和相关申请记录都会被清理，且无法恢复。',
      confirmColor: '#bf5a2f'
    });

    if (!confirm) {
      return;
    }

    try {
      const profile = await requestUserProfile();
      await deletePost(postId, profile);
      wx.showToast({
        title: '帖子已删除',
        icon: 'success'
      });
      this.loadData(true);
    } catch (error) {
      wx.showToast({
        title: error.message || '删除失败',
        icon: 'none'
      });
    }
  },

  async handleDeleteReview(event) {
    const reviewId = event.currentTarget.dataset.reviewId;
    if (!reviewId) {
      return;
    }

    const { confirm } = await wx.showModal({
      title: '删除评论',
      content: '删除后，这条食堂评论和相关点赞都会被清理，且无法恢复。',
      confirmColor: '#bf5a2f'
    });

    if (!confirm) {
      return;
    }

    try {
      const profile = await requestUserProfile();
      await deleteCanteenReview(reviewId, profile);
      wx.showToast({
        title: '评论已删除',
        icon: 'success'
      });
      this.loadData(true);
    } catch (error) {
      wx.showToast({
        title: error.message || '删除失败',
        icon: 'none'
      });
    }
  },

  onPullDownRefresh() {
    Promise.resolve(this.loadData(true)).finally(() => wx.stopPullDownRefresh());
  }
});
