const {
  getCanteenDetail,
  createCanteenReview,
  toggleCanteenReviewLike,
  deleteCanteenReview
} = require('../../utils/api');
const { requestUserProfile, getCurrentProfile } = require('../../utils/auth');
const {
  buildShareAppMessage,
  buildShareTimeline
} = require('../../utils/share');

const REFRESH_WINDOW = 15000;

const SCORE_OPTIONS = [1, 2, 3, 4, 5];
const DEFAULT_DRAFT = {
  environmentScore: 4,
  tasteScore: 4,
  priceScore: 4,
  content: ''
};

function buildDraftScoreFields(draft) {
  return [
    {
      key: 'environmentScore',
      label: '环境',
      value: draft.environmentScore
    },
    {
      key: 'tasteScore',
      label: '味道',
      value: draft.tasteScore
    },
    {
      key: 'priceScore',
      label: '价格',
      value: draft.priceScore
    }
  ];
}

function buildDraftMeta(draft) {
  const overall = (
    (draft.environmentScore + draft.tasteScore + draft.priceScore) / 3
  ).toFixed(1);

  return {
    draftOverallText: overall,
    draftOverallStarWidth: `${(Number(overall) / 5) * 100}%`,
    draftScoreFields: buildDraftScoreFields(draft)
  };
}

Page({
  data: {
    canteenId: '',
    canteen: null,
    loading: false,
    submitting: false,
    scoreOptions: SCORE_OPTIONS,
    draft: { ...DEFAULT_DRAFT },
    draftScoreFields: buildDraftScoreFields(DEFAULT_DRAFT),
    draftOverallText: '4.0',
    draftOverallStarWidth: '80%',
    lastLoadedAt: 0
  },

  onLoad(options) {
    this.setData({
      canteenId: options.canteenId || ''
    });
  },

  onShow() {
    if (this.data.canteenId) {
      this.loadCanteenDetail();
    }
  },

  async loadCanteenDetail(force = false) {
    if (this.data.loading) {
      return;
    }
    if (
      !force &&
      this.data.canteen &&
      Date.now() - this.data.lastLoadedAt < REFRESH_WINDOW
    ) {
      return;
    }

    this.setData({ loading: true });
    try {
      const { canteen } = await getCanteenDetail(this.data.canteenId, getCurrentProfile());
      this.setData({
        canteen,
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

  handleReviewInput(event) {
    this.setData({
      'draft.content': event.detail.value
    });
  },

  handleScoreTap(event) {
    const { field, value } = event.currentTarget.dataset;
    const draft = {
      ...this.data.draft,
      [field]: Number(value)
    };

    this.setData({
      draft,
      ...buildDraftMeta(draft)
    });
  },

  async handleSubmitReview() {
    if (this.data.submitting) {
      return;
    }

    try {
      const profile = await requestUserProfile();
      this.setData({ submitting: true });
      await createCanteenReview(this.data.canteenId, this.data.draft, profile);
      wx.showToast({
        title: '已发布评分',
        icon: 'success'
      });

      this.setData({
        draft: { ...DEFAULT_DRAFT },
        ...buildDraftMeta(DEFAULT_DRAFT)
      });

      this.loadCanteenDetail(true);
    } catch (error) {
      wx.showToast({
        title: error.message || '发布失败',
        icon: 'none'
      });
    } finally {
      this.setData({ submitting: false });
    }
  },

  async handleLikeTap(event) {
    const { id } = event.currentTarget.dataset;

    try {
      const profile = await requestUserProfile();
      await toggleCanteenReviewLike(id, profile);
      this.loadCanteenDetail(true);
    } catch (error) {
      wx.showToast({
        title: error.message || '操作失败',
        icon: 'none'
      });
    }
  },

  async handleDeleteReview(event) {
    const { id } = event.currentTarget.dataset;
    if (!id) {
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
      await deleteCanteenReview(id, profile);
      wx.showToast({
        title: '评论已删除',
        icon: 'success'
      });
      this.loadCanteenDetail(true);
    } catch (error) {
      wx.showToast({
        title: error.message || '删除失败',
        icon: 'none'
      });
    }
  },

  onPullDownRefresh() {
    Promise.resolve(this.loadCanteenDetail(true)).finally(() => wx.stopPullDownRefresh());
  },

  onShareAppMessage() {
    const { canteen, canteenId } = this.data;
    const title = canteen
      ? `LinkUp | ${canteen.name} 食堂评分`
      : 'LinkUp | 分享一个食堂评分页';

    return buildShareAppMessage({
      title,
      path: `/pages/canteen-detail/index?canteenId=${canteenId}`
    });
  },

  onShareTimeline() {
    const { canteen, canteenId } = this.data;
    const title = canteen
      ? `LinkUp | ${canteen.name} 食堂评分`
      : 'LinkUp | 分享一个食堂评分页';

    return buildShareTimeline({
      title,
      query: `canteenId=${canteenId}`
    });
  }
});
