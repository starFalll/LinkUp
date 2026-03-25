const { getMyDashboard, getRankings } = require('../../utils/api');
const { getCurrentProfile, isProfileComplete, saveUserProfile } = require('../../utils/auth');
const { setMyTabPendingBadge } = require('../../utils/tab-badge');
const {
  buildShareAppMessage,
  buildShareTimeline
} = require('../../utils/share');

const REFRESH_WINDOW = 15000;

Page({
  data: {
    profile: null,
    profileReady: false,
    profileInitial: '?',
    profileName: '完善资料后开始积累饭搭子',
    profileDescription: '使用微信推荐的头像和昵称填写能力，完善资料后再参与约饭。',
    draftNickName: '',
    draftAvatarUrl: '',
    dashboard: null,
    rankings: {
      buddyRanking: [],
      activeRanking: []
    },
    loading: false,
    savingProfile: false,
    lastLoadedAt: 0
  },

  onShow() {
    this.loadDashboard();
  },

  async loadDashboard(force = false) {
    if (this.data.loading) {
      return;
    }

    const profile = getCurrentProfile();
    const profileReady = isProfileComplete(profile);
    const profileForApi = profileReady ? profile : null;
    if (
      !force &&
      this.data.dashboard &&
      Date.now() - this.data.lastLoadedAt < REFRESH_WINDOW &&
      this.data.profileReady === profileReady &&
      this.data.draftNickName === (profile?.nickName || '') &&
      this.data.draftAvatarUrl === (profile?.avatarUrl || '')
    ) {
      return;
    }

    this.setData({
      loading: true,
      profile,
      profileReady,
      profileInitial: profile ? (profile.nickName || 'L').slice(0, 1) : '?',
      profileName: profileReady ? profile.nickName : '完善资料后开始积累饭搭子',
      profileDescription: profileReady
        ? '查看你的历史约饭、待审批申请和排名表现。'
        : '使用微信推荐的头像和昵称填写能力，完善资料后再参与约饭。',
      draftNickName: profile?.nickName || '',
      draftAvatarUrl: profile?.avatarUrl || ''
    });
    try {
      const [dashboard, rankings] = await Promise.all([
        getMyDashboard(profileForApi),
        getRankings(profileForApi)
      ]);
      this.setData({
        profile,
        dashboard,
        rankings,
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

  handleChooseAvatar(event) {
    const avatarUrl = event.detail.avatarUrl;
    if (!avatarUrl) {
      return;
    }
    this.setData({
      draftAvatarUrl: avatarUrl
    });
  },

  handleNicknameInput(event) {
    this.setData({
      draftNickName: event.detail.value
    });
  },

  handleNicknameBlur(event) {
    this.setData({
      draftNickName: event.detail.value
    });
  },

  async handleSaveProfile() {
    if (this.data.savingProfile) {
      return;
    }

    try {
      this.setData({ savingProfile: true });
      await saveUserProfile({
        nickName: this.data.draftNickName,
        avatarFilePath: this.data.draftAvatarUrl,
        avatarUrl: this.data.profile?.avatarUrl || ''
      });
      wx.showToast({
        title: '资料已保存',
        icon: 'success'
      });
      await this.loadDashboard(true);
    } catch (error) {
      wx.showToast({
        title: error.message || '保存失败',
        icon: 'none'
      });
    } finally {
      this.setData({ savingProfile: false });
    }
  },

  handlePostTap(event) {
    const postId = event.currentTarget.dataset.postId;
    wx.navigateTo({
      url: `/pages/post-detail/index?postId=${postId}`
    });
  },

  handleCreateTap() {
    wx.switchTab({
      url: '/pages/create/index'
    });
  },

  handleHostManageTap() {
    wx.navigateTo({
      url: '/pages/host-manage/index'
    });
  },

  handleAdminManageTap() {
    wx.navigateTo({
      url: '/pages/admin-manage/index'
    });
  },

  onPullDownRefresh() {
    Promise.resolve(this.loadDashboard(true)).finally(() => wx.stopPullDownRefresh());
  },

  onShareAppMessage() {
    return buildShareAppMessage({
      title: 'LinkUp | 我的约饭与饭搭子',
      path: '/pages/my/index'
    });
  },

  onShareTimeline() {
    return buildShareTimeline({
      title: 'LinkUp | 我的约饭与饭搭子'
    });
  }
});
