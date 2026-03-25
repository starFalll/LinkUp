const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

exports.main = async () => {
  const now = Date.now();
  const postsRes = await db.collection('posts').where({
    mealTime: _.lte(now)
  }).limit(100).get();

  const targetPosts = postsRes.data.filter((post) => !['ended', 'cancelled'].includes(post.status));

  await Promise.all(targetPosts.map(async (post) => {
    await db.collection('posts').doc(post._id).update({
      data: {
        status: 'ended',
        updatedAt: now
      }
    });

    const participationRes = await db.collection('participations').where({
      postId: post._id,
      status: 'active'
    }).limit(100).get();

    await Promise.all(participationRes.data.map((item) =>
      db.collection('participations').doc(item._id).update({
        data: {
          status: 'completed'
        }
      })
    ));
  }));

  return {
    updatedCount: targetPosts.length
  };
};
