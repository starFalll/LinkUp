const { buildings } = require('../../config/buildings');
const { createPost } = require('../../utils/api');
const { getCurrentProfile, isProfileComplete } = require('../../utils/auth');
const { toDateValue, toTimeValue, mergeDateTime } = require('../../utils/format');
const {
  buildShareAppMessage,
  buildShareTimeline
} = require('../../utils/share');

const buildingOptions = buildings.map((item) => ({
  ...item,
  aliasText: item.alias.join(' / ')
}));

Page({
  data: {
    profile: null,
    profileName: '完善资料后才能发布约饭',
    profileDescription: '请先到“我的”页选择头像并填写昵称，再发起新的饭局。',
    form: {
      buildingId: '',
      content: '',
      location: '',
      seatTotal: 2,
      requiresApproval: false
    },
    buildingQuery: '',
    filteredBuildings: buildingOptions,
    selectedBuildingName: '',
    dateValue: toDateValue(),
    timeValue: toTimeValue(),
    submitting: false
  },

  onShow() {
    this.syncProfile();
  },

  syncProfile() {
    const profile = getCurrentProfile();
    const profileReady = isProfileComplete(profile);
    this.setData({
      profile,
      profileName: profileReady ? (profile.nickName || 'LinkUp User') : '完善资料后才能发布约饭',
      profileDescription: profileReady
        ? '已登录，可以继续填写信息并发布约饭。'
        : '请先到“我的”页选择头像并填写昵称，再发起新的饭局。'
    });
  },

  handleBuildingQueryInput(event) {
    const query = event.detail.value.trim().toLowerCase();
    const filteredBuildings = buildingOptions.filter((item) => {
      if (!query) {
        return true;
      }
      const haystack = `${item.name} ${item.alias.join(' ')}`.toLowerCase();
      return haystack.includes(query);
    });
    this.setData({
      buildingQuery: event.detail.value,
      filteredBuildings
    });
  },

  handleSelectBuilding(event) {
    const { id, name } = event.currentTarget.dataset;
    this.setData({
      'form.buildingId': id,
      selectedBuildingName: name,
      buildingQuery: name,
      filteredBuildings: buildingOptions
    });
  },

  handleContentInput(event) {
    this.setData({
      'form.content': event.detail.value
    });
  },

  handleLocationInput(event) {
    this.setData({
      'form.location': event.detail.value
    });
  },

  handleSeatChange(event) {
    this.setData({
      'form.seatTotal': Number(event.detail.value) || 0
    });
  },

  handleApprovalSwitch(event) {
    this.setData({
      'form.requiresApproval': event.detail.value
    });
  },

  handleDateChange(event) {
    this.setData({
      dateValue: event.detail.value
    });
  },

  handleTimeChange(event) {
    this.setData({
      timeValue: event.detail.value
    });
  },

  handleGoProfile() {
    wx.switchTab({
      url: '/pages/my/index'
    });
  },

  async handleSubmit() {
    if (this.data.submitting) {
      return;
    }

    const profile = getCurrentProfile();
    if (!isProfileComplete(profile)) {
      wx.showToast({
        title: '请先完善资料',
        icon: 'none'
      });
      return;
    }

    try {
      this.setData({ submitting: true });
      const mealTime = mergeDateTime(this.data.dateValue, this.data.timeValue);
      const result = await createPost(
        {
          ...this.data.form,
          mealTime
        },
        profile
      );

      wx.showToast({
        title: '发布成功',
        icon: 'success'
      });

      setTimeout(() => {
        wx.navigateTo({
          url: `/pages/post-detail/index?postId=${result.postId}`
        });
      }, 350);
    } catch (error) {
      wx.showToast({
        title: error.message || '发布失败',
        icon: 'none'
      });
    } finally {
      this.setData({ submitting: false });
    }
  },

  onShareAppMessage() {
    return buildShareAppMessage({
      title: 'LinkUp | 发起一个新的约饭局',
      path: '/pages/create/index'
    });
  },

  onShareTimeline() {
    return buildShareTimeline({
      title: 'LinkUp | 发起一个新的约饭局'
    });
  }
});
