const { buildings } = require('../../config/buildings');
const { listPosts } = require('../../utils/api');
const {
  buildShareAppMessage,
  buildShareTimeline
} = require('../../utils/share');

const REFRESH_WINDOW = 15000;

function splitWaterfall(posts) {
  const leftColumn = [];
  const rightColumn = [];

  posts.forEach((post, index) => {
    if (index % 2 === 0) {
      leftColumn.push(post);
      return;
    }
    rightColumn.push(post);
  });

  return {
    leftColumn,
    rightColumn
  };
}

Page({
  data: {
    posts: [],
    leftColumn: [],
    rightColumn: [],
    buildingOptions: [{ id: '', name: '全部楼宇' }, ...buildings],
    statusOptions: [
      { value: '', label: '全部状态' },
      { value: 'open', label: '可加入' },
      { value: 'full', label: '已满员' },
      { value: 'ended', label: '已结束' }
    ],
    activeBuildingId: '',
    activeStatus: '',
    keyword: '',
    loading: false,
    lastLoadedAt: 0
  },

  onShow() {
    this.loadPosts();
  },

  async loadPosts(force = false) {
    if (this.data.loading) {
      return;
    }
    if (
      !force &&
      this.data.posts.length &&
      Date.now() - this.data.lastLoadedAt < REFRESH_WINDOW
    ) {
      return;
    }

    this.setData({ loading: true });
    try {
      const app = getApp();
      const { posts } = await listPosts({
        buildingId: this.data.activeBuildingId,
        status: this.data.activeStatus,
        keyword: this.data.keyword,
        profile: app.globalData.currentUserProfile
      });
      this.setData({
        posts,
        ...splitWaterfall(posts),
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

  handleBuildingFilterTap(event) {
    this.setData({
      activeBuildingId: event.currentTarget.dataset.id
    });
    this.loadPosts(true);
  },

  handleStatusFilterTap(event) {
    this.setData({
      activeStatus: event.currentTarget.dataset.value
    });
    this.loadPosts(true);
  },

  handleKeywordInput(event) {
    this.setData({
      keyword: event.detail.value
    });
  },

  handleKeywordConfirm() {
    this.loadPosts(true);
  },

  handleCardTap(event) {
    const postId = event.detail.postId;
    wx.navigateTo({
      url: `/pages/post-detail/index?postId=${postId}`
    });
  },

  handleCreateTap() {
    wx.switchTab({
      url: '/pages/create/index'
    });
  },

  onPullDownRefresh() {
    Promise.resolve(this.loadPosts(true)).finally(() => wx.stopPullDownRefresh());
  },

  onShareAppMessage() {
    return buildShareAppMessage({
      title: 'LinkUp | 发现附近约饭局',
      path: '/pages/feed/index'
    });
  },

  onShareTimeline() {
    return buildShareTimeline({
      title: 'LinkUp | 发现附近约饭局'
    });
  }
});
