const {
  getPostDetail,
  joinPostDirect,
  applyToJoinPost,
  leavePost,
  deletePost
} = require('../../utils/api');
const { requestUserProfile, getCurrentProfile } = require('../../utils/auth');
const { JOIN_ACTION_STATE } = require('../../utils/constants');
const {
  buildShareAppMessage,
  buildShareTimeline
} = require('../../utils/share');

const REFRESH_WINDOW = 15000;

function getActionMeta(joinActionState) {
  switch (joinActionState) {
    case JOIN_ACTION_STATE.CAN_JOIN:
      return { text: '直接加入', disabled: false };
    case JOIN_ACTION_STATE.NEED_APPLY:
      return { text: '申请加入', disabled: false };
    case JOIN_ACTION_STATE.PENDING:
      return { text: '取消申请', disabled: false };
    case JOIN_ACTION_STATE.JOINED:
      return { text: '退出约饭', disabled: false };
    case JOIN_ACTION_STATE.OWNER:
      return { text: '管理申请', disabled: false };
    case JOIN_ACTION_STATE.FULL:
      return { text: '已满员', disabled: true };
    case JOIN_ACTION_STATE.ENDED:
    default:
      return { text: '已结束', disabled: true };
  }
}

Page({
  data: {
    postId: '',
    post: null,
    loading: false,
    actionText: '',
    actionDisabled: true,
    lastLoadedAt: 0
  },

  onLoad(options) {
    this.setData({
      postId: options.postId || ''
    });
  },

  onShow() {
    if (this.data.postId) {
      this.loadPostDetail();
    }
  },

  async loadPostDetail(force = false) {
    if (this.data.loading) {
      return;
    }
    if (
      !force &&
      this.data.post &&
      Date.now() - this.data.lastLoadedAt < REFRESH_WINDOW
    ) {
      return;
    }

    this.setData({ loading: true });
    try {
      const { post } = await getPostDetail(this.data.postId, getCurrentProfile());
      const actionMeta = getActionMeta(post.joinActionState);
      this.setData({
        post,
        actionText: actionMeta.text,
        actionDisabled: actionMeta.disabled,
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

  async handlePrimaryAction() {
    const { post } = this.data;
    if (!post || this.data.actionDisabled) {
      return;
    }

    try {
      if (post.joinActionState === JOIN_ACTION_STATE.OWNER) {
        this.setData({
          lastLoadedAt: 0
        });
        wx.navigateTo({
          url: '/pages/host-manage/index'
        });
        return;
      }

      const profile = await requestUserProfile();

      if (post.joinActionState === JOIN_ACTION_STATE.CAN_JOIN) {
        await joinPostDirect(post.id, profile);
        wx.showToast({ title: '加入成功', icon: 'success' });
      } else if (post.joinActionState === JOIN_ACTION_STATE.NEED_APPLY) {
        await applyToJoinPost(post.id, profile);
        wx.showToast({ title: '申请已发送', icon: 'success' });
      } else if (
        post.joinActionState === JOIN_ACTION_STATE.PENDING ||
        post.joinActionState === JOIN_ACTION_STATE.JOINED
      ) {
        await leavePost(post.id, profile);
        wx.showToast({
          title: post.joinActionState === JOIN_ACTION_STATE.PENDING ? '已取消申请' : '已退出约饭',
          icon: 'success'
        });
      }

      this.loadPostDetail(true);
    } catch (error) {
      wx.showToast({
        title: error.message || '操作失败',
        icon: 'none'
      });
    }
  },

  handleManageTap() {
    this.setData({
      lastLoadedAt: 0
    });
    wx.navigateTo({
      url: '/pages/host-manage/index'
    });
  },

  async handleDeletePost() {
    const { post } = this.data;
    if (!post || !post.canDelete) {
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
      await deletePost(post.id, profile);
      wx.showToast({
        title: '帖子已删除',
        icon: 'success'
      });

      setTimeout(() => {
        const pages = getCurrentPages();
        if (pages.length > 1) {
          wx.navigateBack();
          return;
        }

        wx.switchTab({
          url: '/pages/my/index'
        });
      }, 500);
    } catch (error) {
      wx.showToast({
        title: error.message || '删除失败',
        icon: 'none'
      });
    }
  },

  onShareAppMessage() {
    const { post, postId } = this.data;
    const title = post
      ? `LinkUp | ${post.buildingName} 的约饭局`
      : 'LinkUp | 分享一个约饭局';

    return buildShareAppMessage({
      title,
      path: `/pages/post-detail/index?postId=${postId}`
    });
  },

  onShareTimeline() {
    const { post, postId } = this.data;
    const title = post
      ? `LinkUp | ${post.buildingName} 的约饭局`
      : 'LinkUp | 分享一个约饭局';

    return buildShareTimeline({
      title,
      query: `postId=${postId}`
    });
  }
});
