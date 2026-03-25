#!/usr/bin/env node

const cloud = require('wx-server-sdk');

const USER_DOC_PREFIX = 'user_';
const PAGE_SIZE = 100;

function parseArgs(argv) {
  const args = {
    apply: false,
    env: process.env.CLOUD_ENV_ID || '',
    secretId: process.env.TENCENTCLOUD_SECRETID || process.env.SECRET_ID || '',
    secretKey: process.env.TENCENTCLOUD_SECRETKEY || process.env.SECRET_KEY || '',
    sessionToken: process.env.TENCENTCLOUD_SESSIONTOKEN || process.env.SESSION_TOKEN || ''
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (current === '--apply') {
      args.apply = true;
      continue;
    }
    if (current === '--env') {
      args.env = argv[index + 1] || '';
      index += 1;
      continue;
    }
    if (current === '--secret-id') {
      args.secretId = argv[index + 1] || '';
      index += 1;
      continue;
    }
    if (current === '--secret-key') {
      args.secretKey = argv[index + 1] || '';
      index += 1;
      continue;
    }
    if (current === '--session-token') {
      args.sessionToken = argv[index + 1] || '';
      index += 1;
    }
  }

  return args;
}

function buildCanonicalDocId(openId) {
  return `${USER_DOC_PREFIX}${openId}`;
}

function compareUsers(left, right) {
  const leftAdmin = left.role === 'admin' ? 1 : 0;
  const rightAdmin = right.role === 'admin' ? 1 : 0;
  if (leftAdmin !== rightAdmin) {
    return rightAdmin - leftAdmin;
  }

  const leftCanonical = left._id === buildCanonicalDocId(left.openId || left._openid || '') ? 1 : 0;
  const rightCanonical = right._id === buildCanonicalDocId(right.openId || right._openid || '') ? 1 : 0;
  if (leftCanonical !== rightCanonical) {
    return rightCanonical - leftCanonical;
  }

  const leftUpdatedAt = Number(left.updatedAt || 0);
  const rightUpdatedAt = Number(right.updatedAt || 0);
  if (leftUpdatedAt !== rightUpdatedAt) {
    return rightUpdatedAt - leftUpdatedAt;
  }

  const leftCreatedAt = Number(left.createdAt || 0);
  const rightCreatedAt = Number(right.createdAt || 0);
  if (leftCreatedAt !== rightCreatedAt) {
    return leftCreatedAt - rightCreatedAt;
  }

  return String(left._id || '').localeCompare(String(right._id || ''));
}

function pickFirstFilled(records, fieldName, fallback = '') {
  for (const record of records) {
    const value = record[fieldName];
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }
  return fallback;
}

function mergeUsers(openId, records) {
  const sorted = [...records].sort(compareUsers);
  const primary = sorted[0];
  const canonicalId = buildCanonicalDocId(openId);
  const createdAtCandidates = sorted
    .map((item) => Number(item.createdAt || 0))
    .filter((value) => Number.isFinite(value) && value > 0);
  const updatedAtCandidates = sorted
    .map((item) => Number(item.updatedAt || 0))
    .filter((value) => Number.isFinite(value) && value > 0);

  return {
    canonicalId,
    deleteIds: sorted
      .map((item) => item._id)
      .filter((id) => id && id !== canonicalId),
    payload: {
      openId,
      role: sorted.some((item) => item.role === 'admin') ? 'admin' : 'user',
      nickname: pickFirstFilled(sorted, 'nickname', 'LinkUp User'),
      avatarUrl: pickFirstFilled(sorted, 'avatarUrl', ''),
      createdAt: createdAtCandidates.length ? Math.min(...createdAtCandidates) : Date.now(),
      updatedAt: updatedAtCandidates.length ? Math.max(...updatedAtCandidates) : Date.now()
    },
    records: sorted,
    primaryId: primary._id
  };
}

async function listAllUsers(db) {
  const _ = db.command;
  const users = [];
  let lastId = '';

  while (true) {
    const query = lastId
      ? db.collection('users').where({ _id: _.gt(lastId) })
      : db.collection('users');
    const { data } = await query
      .orderBy('_id', 'asc')
      .limit(PAGE_SIZE)
      .get();

    if (!data.length) {
      break;
    }

    users.push(...data);
    lastId = data[data.length - 1]._id;
  }

  return users;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.env) {
    throw new Error('缺少云环境 ID，请通过 --env 或 CLOUD_ENV_ID 提供。');
  }

  if (!args.secretId || !args.secretKey) {
    throw new Error('缺少腾讯云密钥，请通过 TENCENTCLOUD_SECRETID / TENCENTCLOUD_SECRETKEY 或 --secret-id / --secret-key 提供。');
  }

  const initConfig = {
    env: args.env,
    secretId: args.secretId,
    secretKey: args.secretKey
  };

  if (args.sessionToken) {
    initConfig.sessionToken = args.sessionToken;
  }

  cloud.init(initConfig);
  const db = cloud.database();

  const users = await listAllUsers(db);
  const grouped = new Map();
  const skipped = [];

  users.forEach((user) => {
    const openId = user.openId || user._openid || '';
    if (!openId) {
      skipped.push(user._id);
      return;
    }

    if (!grouped.has(openId)) {
      grouped.set(openId, []);
    }
    grouped.get(openId).push(user);
  });

  const plans = Array.from(grouped.entries())
    .map(([openId, records]) => mergeUsers(openId, records))
    .filter((plan) =>
      plan.records.length > 1 ||
      plan.primaryId !== plan.canonicalId ||
      plan.records[0].nickname !== plan.payload.nickname ||
      (plan.records[0].avatarUrl || '') !== plan.payload.avatarUrl ||
      (plan.records[0].role || 'user') !== plan.payload.role ||
      plan.records[0].openId !== plan.payload.openId
    );

  console.log(`扫描完成：users=${users.length}，需要处理的 openId=${plans.length}，缺少 openId 的记录=${skipped.length}`);

  if (skipped.length) {
    console.log('这些 users 记录缺少 openId / _openid，脚本已跳过：');
    skipped.forEach((id) => console.log(`- ${id}`));
  }

  if (!plans.length) {
    console.log('没有发现需要合并的重复用户。');
    return;
  }

  plans.forEach((plan) => {
    console.log(`\nopenId=${plan.payload.openId}`);
    console.log(`  主文档: ${plan.primaryId} -> ${plan.canonicalId}`);
    console.log(`  删除: ${plan.deleteIds.length ? plan.deleteIds.join(', ') : '(无)'}`);
    console.log(`  合并后: nickname="${plan.payload.nickname}", role="${plan.payload.role}", avatarUrl="${plan.payload.avatarUrl}"`);
  });

  if (!args.apply) {
    console.log('\n当前是预演模式。确认无误后，用 --apply 真正执行。');
    return;
  }

  for (const plan of plans) {
    await db.collection('users').doc(plan.canonicalId).set({
      data: plan.payload
    });

    for (const docId of plan.deleteIds) {
      await db.collection('users').doc(docId).remove();
    }
  }

  console.log(`\n已完成去重，共处理 ${plans.length} 个 openId。`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
