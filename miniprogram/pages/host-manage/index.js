const { getMyDashboard, reviewJoinRequest, deletePost } = require('../../utils/api');
const { requestUserProfile, getCurrentProfile } = require('../../utils/auth');
const { setMyTabPendingBadge } = require('../../utils/tab-badge');
const {
  buildShareAppMessage,
  buildShareTimeline
} = require('../../utils/share');

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
      const profile = getCurrentProfile();
      const dashboard = await getMyDashboard(profile);
      this.setData({
        dashboard,
        lastLoadedAt: Date.now()
      });
      setMyTabPendingBadge(dashboard?.hostPendingRequests?.length || 0);
    } catch (error) {
      wx.showToast({
        title: error.message || '加载失败',
        icon: 'none'
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  async handleReview(event) {
    const { id, action } = event.currentTarget.dataset;
    try {
      const profile = await requestUserProfile();
      await reviewJoinRequest(id, action, profile);
      wx.showToast({
        title: action === 'approve' ? '已通过申请' : '已拒绝申请',
        icon: 'success'
      });
      this.loadData(true);
    } catch (error) {
      wx.showToast({
        title: error.message || '处理失败',
        icon: 'none'
      });
    }
  },

  handlePostTap(event) {
    const postId = event.currentTarget.dataset.postId;
    wx.navigateTo({
      url: `/pages/post-detail/index?postId=${postId}`
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

  onShareAppMessage() {
    return buildShareAppMessage({
      title: 'LinkUp | 处理约饭申请',
      path: '/pages/my/index'
    });
  },

  onShareTimeline() {
    return buildShareTimeline({
      title: 'LinkUp | 处理约饭申请'
    });
  }
});
