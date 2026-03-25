const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const DEFAULT_CANTEENS = [
  { _id: 'microsoft-cafe-83', name: 'Microsoft Cafe 83', buildingId: 'microsoft-cafe-83', buildingName: 'Microsoft Cafe 83', location: '4480 154th Pl NE', description: '还没有补充更多食堂介绍，欢迎先进去打分和评论。', featuredDishes: [] },
  { _id: 'microsoft-cafe-16', name: 'Microsoft Cafe 16', buildingId: 'microsoft-cafe-16', buildingName: 'Microsoft Cafe 16', location: '3600 157th Ave NE', description: '还没有补充更多食堂介绍，欢迎先进去打分和评论。', featuredDishes: [] },
  { _id: 'microsoft-cafe-86', name: 'Microsoft Cafe 86', buildingId: 'microsoft-cafe-86', buildingName: 'Microsoft Cafe 86', location: '5074 156th Ave NE', description: '还没有补充更多食堂介绍，欢迎先进去打分和评论。', featuredDishes: [] },
  { _id: 'microsoft-cafe-25', name: 'Microsoft Cafe 25', buildingId: 'microsoft-cafe-25', buildingName: 'Microsoft Cafe 25', location: '15700 NE 39th St', description: '还没有补充更多食堂介绍，欢迎先进去打分和评论。', featuredDishes: [] },
  { _id: 'microsoft-cafe-112', name: 'Microsoft Cafe 112', buildingId: 'microsoft-cafe-112', buildingName: 'Microsoft Cafe 112', location: '14865 NE 31st Cir', description: '还没有补充更多食堂介绍，欢迎先进去打分和评论。', featuredDishes: [] },
  { _id: 'microsoft-cafe-99', name: 'Microsoft Cafe 99', buildingId: 'microsoft-cafe-99', buildingName: 'Microsoft Cafe 99', location: '14820 NE 36th St', description: '还没有补充更多食堂介绍，欢迎先进去打分和评论。', featuredDishes: [] },
  { _id: 'microsoft-cafe-121', name: 'Microsoft Cafe 121', buildingId: 'microsoft-cafe-121', buildingName: 'Microsoft Cafe 121', location: '15220 NE 40th St', description: '还没有补充更多食堂介绍，欢迎先进去打分和评论。', featuredDishes: [] },
  { _id: 'microsoft-cafe-34', name: 'Microsoft Cafe 34', buildingId: 'microsoft-cafe-34', buildingName: 'Microsoft Cafe 34', location: '3720 159th Ave NE', description: '还没有补充更多食堂介绍，欢迎先进去打分和评论。', featuredDishes: [] },
  { _id: 'microsoft-one-esterra-food-hall', name: 'Microsoft One Esterra Food Hall', buildingId: 'microsoft-one-esterra-food-hall', buildingName: 'Microsoft One Esterra Food Hall', location: '15550 NE Turing St', description: '还没有补充更多食堂介绍，欢迎先进去打分和评论。', featuredDishes: [] },
  { _id: 'microsoft-food-hall-9', name: 'Microsoft Food Hall 9', buildingId: 'microsoft-food-hall-9', buildingName: 'Microsoft Food Hall 9', location: '3400 156th Ave NE', description: '还没有补充更多食堂介绍，欢迎先进去打分和评论。', featuredDishes: [] },
  { _id: 'microsoft-food-hall-6', name: 'Microsoft Food Hall 6', buildingId: 'microsoft-food-hall-6', buildingName: 'Microsoft Food Hall 6', location: '15885 NE 36th St', description: '还没有补充更多食堂介绍，欢迎先进去打分和评论。', featuredDishes: [] },
  { _id: 'microsoft-food-hall-4', name: 'Microsoft Food Hall 4', buildingId: 'microsoft-food-hall-4', buildingName: 'Microsoft Food Hall 4', location: '15835 NE 36th St', description: '还没有补充更多食堂介绍，欢迎先进去打分和评论。', featuredDishes: [] },
  { _id: 'microsoft-commons', name: 'Microsoft Commons', buildingId: 'microsoft-commons', buildingName: 'Microsoft Commons', location: '15255 NE 40th St', description: '还没有补充更多食堂介绍，欢迎先进去打分和评论。', featuredDishes: [] }
];

function roundToOne(value) {
  return Number((Number(value) || 0).toFixed(1));
}

function buildStarWidth(score) {
  const safeScore = Math.max(0, Math.min(5, Number(score) || 0));
  return `${(safeScore / 5) * 100}%`;
}

function getReviewOverallScore(review) {
  return (
    Number(review.environmentScore || 0) +
    Number(review.tasteScore || 0) +
    Number(review.priceScore || review.serviceScore || 0)
  ) / 3;
}

function buildScoreMetric(label, score) {
  return {
    label,
    score,
    scoreText: Number(score || 0).toFixed(1),
    starWidth: buildStarWidth(score)
  };
}

function isCollectionMissing(error) {
  return error && (
    error.errCode === -502005 ||
    String(error.message || '').includes('collection not exist')
  );
}

async function safeGetCollectionRecords(collectionName, options = {}) {
  try {
    let query = db.collection(collectionName);
    if (options.where) {
      query = query.where(options.where);
    }
    if (options.orderBy) {
      query = query.orderBy(options.orderBy.field, options.orderBy.order);
    }
    if (options.limit) {
      query = query.limit(options.limit);
    }
    const result = await query.get();
    return result.data || [];
  } catch (error) {
    if (isCollectionMissing(error)) {
      return [];
    }
    throw error;
  }
}

function mergeCanteenCatalog(records = []) {
  const mergedMap = new Map();
  DEFAULT_CANTEENS.forEach((canteen) => {
    mergedMap.set(canteen._id, canteen);
  });

  records.forEach((canteen) => {
    const base = mergedMap.get(canteen._id) || {};
    mergedMap.set(canteen._id, {
      ...base,
      ...canteen,
      _id: canteen._id || base._id,
      buildingId: canteen.buildingId || base.buildingId || canteen._id,
      buildingName: canteen.buildingName || base.buildingName || canteen.name || '',
      name: canteen.name || base.name || canteen.buildingName || '',
      location: canteen.location || base.location || '',
      description: canteen.description || base.description || '还没有补充更多食堂介绍，欢迎先进去打分和评论。',
      featuredDishes: canteen.featuredDishes || base.featuredDishes || []
    });
  });

  return Array.from(mergedMap.values());
}

function buildRatingSummary(reviews) {
  if (!reviews.length) {
    return {
      reviewCount: 0,
      reviewCountText: '0 人评分',
      overallScore: 0,
      overallScoreText: '0.0',
      overallStarWidth: buildStarWidth(0),
      metrics: [
        buildScoreMetric('环境', 0),
        buildScoreMetric('味道', 0),
        buildScoreMetric('价格', 0)
      ]
    };
  }

  const total = reviews.reduce((accumulator, review) => ({
    overall: accumulator.overall + getReviewOverallScore(review),
    environment: accumulator.environment + Number(review.environmentScore || 0),
    taste: accumulator.taste + Number(review.tasteScore || 0),
    price: accumulator.price + Number(review.priceScore || review.serviceScore || 0)
  }), {
    overall: 0,
    environment: 0,
    taste: 0,
    price: 0
  });

  const reviewCount = reviews.length;
  const overallScore = roundToOne(total.overall / reviewCount);
  const environmentScore = roundToOne(total.environment / reviewCount);
  const tasteScore = roundToOne(total.taste / reviewCount);
  const priceScore = roundToOne(total.price / reviewCount);

  return {
    reviewCount,
    reviewCountText: `${reviewCount} 人评分`,
    overallScore,
    overallScoreText: overallScore.toFixed(1),
    overallStarWidth: buildStarWidth(overallScore),
    metrics: [
      buildScoreMetric('环境', environmentScore),
      buildScoreMetric('味道', tasteScore),
      buildScoreMetric('价格', priceScore)
    ]
  };
}

exports.main = async () => {
  const canteenRecords = await safeGetCollectionRecords('canteens', {
    orderBy: { field: 'createdAt', order: 'asc' },
    limit: 100
  });

  const canteens = await Promise.all(mergeCanteenCatalog(canteenRecords).map(async (canteen) => {
    const reviewRecords = await safeGetCollectionRecords('canteen_reviews', {
      where: { canteenId: canteen._id },
      limit: 100
    });

    const summary = buildRatingSummary(reviewRecords);
    return {
      id: canteen._id,
      name: canteen.name,
      buildingId: canteen.buildingId || '',
      buildingName: canteen.buildingName || '',
      location: canteen.location || '',
      description: canteen.description || '',
      featuredDishes: canteen.featuredDishes || [],
      reviewCount: summary.reviewCount,
      reviewCountText: summary.reviewCountText,
      overallScore: summary.overallScore,
      overallScoreText: summary.overallScoreText,
      overallStarWidth: summary.overallStarWidth,
      metrics: summary.metrics
    };
  }));

  canteens.sort((left, right) => {
    if (right.overallScore !== left.overallScore) {
      return right.overallScore - left.overallScore;
    }
    if (right.reviewCount !== left.reviewCount) {
      return right.reviewCount - left.reviewCount;
    }
    return left.name.localeCompare(right.name);
  });

  return { canteens };
};
