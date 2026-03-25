const { STORAGE_KEY } = require('./constants');

function createMockId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function createCanteenSeedData(now) {
  const canteens = [
    {
      _id: 'canteen_commons',
      name: 'Commons Food Hall',
      buildingId: 'microsoft-commons',
      buildingName: 'Microsoft Commons',
      location: 'Commons 1F',
      description: '热食窗口多、翻台快，适合中午和同事快速解决一顿，也适合晚上慢慢挑着吃。',
      featuredDishes: ['现炒意面', '沙拉碗', '现烤披萨']
    },
    {
      _id: 'canteen_cafe99',
      name: 'Cafe 99',
      buildingId: 'microsoft-cafe-99',
      buildingName: 'Microsoft Cafe 99',
      location: 'Building 99',
      description: '偏轻食和日料，整体稳定，座位安静，适合想找个舒服角落慢慢吃饭的人。',
      featuredDishes: ['寿司拼盘', '照烧鸡排', '味噌乌冬']
    },
    {
      _id: 'canteen_esterra',
      name: 'One Esterra Food Hall',
      buildingId: 'microsoft-one-esterra-food-hall',
      buildingName: 'Microsoft One Esterra Food Hall',
      location: 'One Esterra 1F',
      description: '选择很多，热门档口排队会久一点，但适合多人一起吃，口味选择也更杂。',
      featuredDishes: ['麻辣香锅', '热狗堡', '咖喱饭']
    }
  ];

  const canteenReviews = [
    {
      _id: 'review_commons_1',
      canteenId: 'canteen_commons',
      userOpenId: 'local_alex',
      userName: 'Alex',
      userAvatar: '',
      content: '晚饭时段人不算太挤，意面档稳定发挥，环境干净，适合约饭聊天。',
      environmentScore: 5,
      tasteScore: 4,
      priceScore: 4,
      createdAt: now - 32 * 60 * 60 * 1000,
      updatedAt: now - 32 * 60 * 60 * 1000
    },
    {
      _id: 'review_commons_2',
      canteenId: 'canteen_commons',
      userOpenId: 'local_mia',
      userName: 'Mia',
      userAvatar: '',
      content: '窗口选择多，披萨出餐快，整体体验不错，就是饭点略吵。',
      environmentScore: 4,
      tasteScore: 5,
      priceScore: 4,
      createdAt: now - 24 * 60 * 60 * 1000,
      updatedAt: now - 24 * 60 * 60 * 1000
    },
    {
      _id: 'review_commons_3',
      canteenId: 'canteen_commons',
      userOpenId: 'local_jordan',
      userName: 'Jordan',
      userAvatar: '',
      content: '综合来看很稳，没有明显短板，适合工作日懒得纠结时直接来。',
      environmentScore: 4,
      tasteScore: 4,
      priceScore: 4,
      createdAt: now - 18 * 60 * 60 * 1000,
      updatedAt: now - 18 * 60 * 60 * 1000
    },
    {
      _id: 'review_cafe99_1',
      canteenId: 'canteen_cafe99',
      userOpenId: 'local_mia',
      userName: 'Mia',
      userAvatar: '',
      content: '寿司和乌冬都很稳，环境也安静，想一个人安静吃饭的时候会优先来这里。',
      environmentScore: 5,
      tasteScore: 5,
      priceScore: 4,
      createdAt: now - 40 * 60 * 60 * 1000,
      updatedAt: now - 40 * 60 * 60 * 1000
    },
    {
      _id: 'review_cafe99_2',
      canteenId: 'canteen_cafe99',
      userOpenId: 'local_sage',
      userName: 'Sage',
      userAvatar: '',
      content: '座位舒服，整体节奏比较慢一点，价格感知也比较友好，体验很平衡。',
      environmentScore: 4,
      tasteScore: 4,
      priceScore: 5,
      createdAt: now - 12 * 60 * 60 * 1000,
      updatedAt: now - 12 * 60 * 60 * 1000
    },
    {
      _id: 'review_esterra_1',
      canteenId: 'canteen_esterra',
      userOpenId: 'local_alex',
      userName: 'Alex',
      userAvatar: '',
      content: '适合多人一起吃，选择非常多，不过热门窗口需要排队，味道属于中上。',
      environmentScore: 4,
      tasteScore: 4,
      priceScore: 3,
      createdAt: now - 28 * 60 * 60 * 1000,
      updatedAt: now - 28 * 60 * 60 * 1000
    },
    {
      _id: 'review_esterra_2',
      canteenId: 'canteen_esterra',
      userOpenId: 'local_jordan',
      userName: 'Jordan',
      userAvatar: '',
      content: '味道选择挺丰富，但高峰期有点乱，价格感知一般，适合结伴拼桌。',
      environmentScore: 3,
      tasteScore: 4,
      priceScore: 4,
      createdAt: now - 16 * 60 * 60 * 1000,
      updatedAt: now - 16 * 60 * 60 * 1000
    },
    {
      _id: 'review_esterra_3',
      canteenId: 'canteen_esterra',
      userOpenId: 'local_sage',
      userName: 'Sage',
      userAvatar: '',
      content: '如果赶时间不太推荐高峰期来，不过麻辣香锅还不错，整体能吃得开心。',
      environmentScore: 4,
      tasteScore: 4,
      priceScore: 5,
      createdAt: now - 8 * 60 * 60 * 1000,
      updatedAt: now - 8 * 60 * 60 * 1000
    }
  ];

  const canteenReviewLikes = [
    {
      _id: 'review_like_1',
      reviewId: 'review_commons_1',
      userOpenId: 'local_mia',
      createdAt: now - 20 * 60 * 60 * 1000
    },
    {
      _id: 'review_like_2',
      reviewId: 'review_commons_1',
      userOpenId: 'local_jordan',
      createdAt: now - 19 * 60 * 60 * 1000
    },
    {
      _id: 'review_like_3',
      reviewId: 'review_cafe99_1',
      userOpenId: 'local_alex',
      createdAt: now - 10 * 60 * 60 * 1000
    },
    {
      _id: 'review_like_4',
      reviewId: 'review_esterra_3',
      userOpenId: 'local_mia',
      createdAt: now - 6 * 60 * 60 * 1000
    }
  ];

  return {
    canteens,
    canteenReviews,
    canteenReviewLikes
  };
}

function createSeedData() {
  const now = Date.now();
  const users = [
    {
      _id: 'user_alex',
      openId: 'local_alex',
      role: 'admin',
      nickname: 'Alex',
      avatarUrl: '',
      createdAt: now - 9 * 24 * 60 * 60 * 1000,
      updatedAt: now - 9 * 24 * 60 * 60 * 1000
    },
    {
      _id: 'user_mia',
      openId: 'local_mia',
      nickname: 'Mia',
      avatarUrl: '',
      createdAt: now - 7 * 24 * 60 * 60 * 1000,
      updatedAt: now - 7 * 24 * 60 * 60 * 1000
    },
    {
      _id: 'user_jordan',
      openId: 'local_jordan',
      nickname: 'Jordan',
      avatarUrl: '',
      createdAt: now - 6 * 24 * 60 * 60 * 1000,
      updatedAt: now - 6 * 24 * 60 * 60 * 1000
    },
    {
      _id: 'user_sage',
      openId: 'local_sage',
      nickname: 'Sage',
      avatarUrl: '',
      createdAt: now - 5 * 24 * 60 * 60 * 1000,
      updatedAt: now - 5 * 24 * 60 * 60 * 1000
    }
  ];

  const posts = [
    {
      _id: 'post_today_pasta',
      hostOpenId: 'local_alex',
      hostName: 'Alex',
      hostAvatar: '',
      buildingId: 'microsoft-commons',
      buildingName: 'Microsoft Commons',
      content: '今晚 7 点一起去 Commons 吃意面，想找两个不赶时间的饭搭子。',
      location: 'Commons 1F Pasta Bar',
      seatTotal: 2,
      seatRemaining: 1,
      mealTime: now + 5 * 60 * 60 * 1000,
      requiresApproval: false,
      status: 'open',
      createdAt: now - 2 * 60 * 60 * 1000,
      updatedAt: now - 2 * 60 * 60 * 1000
    },
    {
      _id: 'post_hotpot_request',
      hostOpenId: 'local_mia',
      hostName: 'Mia',
      hostAvatar: '',
      buildingId: 'microsoft-one-esterra-food-hall',
      buildingName: 'Microsoft One Esterra Food Hall',
      content: 'One Esterra 的午饭局，想找愿意聊天的人，社恐也欢迎。',
      location: 'One Esterra 1F Hotpot Corner',
      seatTotal: 3,
      seatRemaining: 3,
      mealTime: now + 26 * 60 * 60 * 1000,
      requiresApproval: true,
      status: 'open',
      createdAt: now - 50 * 60 * 1000,
      updatedAt: now - 50 * 60 * 1000
    },
    {
      _id: 'post_finished_sushi',
      hostOpenId: 'local_mia',
      hostName: 'Mia',
      hostAvatar: '',
      buildingId: 'microsoft-cafe-99',
      buildingName: 'Microsoft Cafe 99',
      content: '午休寿司局，快进快出，已经吃完可以看下历史效果。',
      location: 'Building 99 Sushi Bar',
      seatTotal: 2,
      seatRemaining: 0,
      mealTime: now - 20 * 60 * 60 * 1000,
      requiresApproval: false,
      status: 'ended',
      createdAt: now - 30 * 60 * 60 * 1000,
      updatedAt: now - 20 * 60 * 60 * 1000
    }
  ];

  const joinRequests = [
    {
      _id: 'request_sage_hotpot',
      postId: 'post_hotpot_request',
      applicantOpenId: 'local_sage',
      applicantName: 'Sage',
      applicantAvatar: '',
      status: 'pending',
      createdAt: now - 20 * 60 * 1000,
      reviewedAt: null
    }
  ];

  const participations = [
    {
      _id: 'part_host_alex_pasta',
      postId: 'post_today_pasta',
      userOpenId: 'local_alex',
      userName: 'Alex',
      userAvatar: '',
      role: 'host',
      joinMethod: 'direct',
      status: 'active',
      joinedAt: now - 2 * 60 * 60 * 1000
    },
    {
      _id: 'part_jordan_pasta',
      postId: 'post_today_pasta',
      userOpenId: 'local_jordan',
      userName: 'Jordan',
      userAvatar: '',
      role: 'guest',
      joinMethod: 'direct',
      status: 'active',
      joinedAt: now - 90 * 60 * 1000
    },
    {
      _id: 'part_host_mia_hotpot',
      postId: 'post_hotpot_request',
      userOpenId: 'local_mia',
      userName: 'Mia',
      userAvatar: '',
      role: 'host',
      joinMethod: 'direct',
      status: 'active',
      joinedAt: now - 50 * 60 * 1000
    },
    {
      _id: 'part_host_mia_sushi',
      postId: 'post_finished_sushi',
      userOpenId: 'local_mia',
      userName: 'Mia',
      userAvatar: '',
      role: 'host',
      joinMethod: 'direct',
      status: 'completed',
      joinedAt: now - 30 * 60 * 60 * 1000
    },
    {
      _id: 'part_alex_sushi',
      postId: 'post_finished_sushi',
      userOpenId: 'local_alex',
      userName: 'Alex',
      userAvatar: '',
      role: 'guest',
      joinMethod: 'direct',
      status: 'completed',
      joinedAt: now - 29 * 60 * 60 * 1000
    },
    {
      _id: 'part_jordan_sushi',
      postId: 'post_finished_sushi',
      userOpenId: 'local_jordan',
      userName: 'Jordan',
      userAvatar: '',
      role: 'guest',
      joinMethod: 'direct',
      status: 'completed',
      joinedAt: now - 29 * 60 * 60 * 1000
    }
  ];

  const {
    canteens,
    canteenReviews,
    canteenReviewLikes
  } = createCanteenSeedData(now);

  return {
    users,
    posts,
    joinRequests,
    participations,
    canteens,
    canteenReviews,
    canteenReviewLikes
  };
}

function normalizeMockDb(existing = {}) {
  const seed = createSeedData();
  const normalized = {
    ...seed,
    ...existing
  };
  const keys = [
    'users',
    'posts',
    'joinRequests',
    'participations',
    'canteens',
    'canteenReviews',
    'canteenReviewLikes'
  ];

  keys.forEach((key) => {
    if (!Array.isArray(normalized[key])) {
      normalized[key] = seed[key];
    }
  });

  return normalized;
}

function needsMigration(data) {
  if (!data || typeof data !== 'object') {
    return true;
  }

  return !Array.isArray(data.posts) ||
    !Array.isArray(data.users) ||
    !Array.isArray(data.joinRequests) ||
    !Array.isArray(data.participations) ||
    !Array.isArray(data.canteens) ||
    !Array.isArray(data.canteenReviews) ||
    !Array.isArray(data.canteenReviewLikes);
}

function ensureMockSeedData() {
  const existing = wx.getStorageSync(STORAGE_KEY);
  if (existing && !needsMigration(existing)) {
    return existing;
  }
  if (existing && typeof existing === 'object') {
    const normalized = normalizeMockDb(existing);
    wx.setStorageSync(STORAGE_KEY, normalized);
    return normalized;
  }
  const seeded = createSeedData();
  wx.setStorageSync(STORAGE_KEY, seeded);
  return seeded;
}

function readMockDb() {
  return ensureMockSeedData();
}

function writeMockDb(data) {
  wx.setStorageSync(STORAGE_KEY, data);
}

module.exports = {
  createMockId,
  ensureMockSeedData,
  readMockDb,
  writeMockDb
};
