# 云开发数据结构

## 集合

### `users`

```json
{
  "_id": "doc id",
  "_openid": "用户 openid",
  "openId": "用户 openid（云函数内显式存储，用于幂等更新）",
  "role": "user 或 admin",
  "nickname": "显示昵称",
  "avatarUrl": "头像地址",
  "createdAt": 1710000000000,
  "updatedAt": 1710000000000
}
```

### `posts`

```json
{
  "_id": "doc id",
  "hostOpenId": "发起人 openid",
  "hostName": "发起人昵称",
  "hostAvatar": "发起人头像",
  "buildingId": "bldg-1",
  "buildingName": "Innovation Center",
  "content": "一起吃晚饭",
  "location": "2F north cafe",
  "seatTotal": 4,
  "seatRemaining": 2,
  "mealTime": 1770000000000,
  "requiresApproval": true,
  "status": "open",
  "createdAt": 1770000000000,
  "updatedAt": 1770000000000
}
```

### `join_requests`

```json
{
  "_id": "doc id",
  "postId": "帖子 ID",
  "applicantOpenId": "申请人 openid",
  "applicantName": "申请人昵称",
  "applicantAvatar": "申请人头像",
  "status": "pending",
  "createdAt": 1770000000000,
  "reviewedAt": null
}
```

### `participations`

```json
{
  "_id": "doc id",
  "postId": "帖子 ID",
  "userOpenId": "用户 openid",
  "userName": "用户昵称",
  "userAvatar": "用户头像",
  "role": "host",
  "joinMethod": "direct",
  "status": "active",
  "joinedAt": 1770000000000
}
```

### `canteens`

```json
{
  "_id": "doc id",
  "name": "Commons Food Hall",
  "buildingId": "microsoft-commons",
  "buildingName": "Microsoft Commons",
  "location": "Commons 1F",
  "description": "热食窗口多，适合多人一起吃",
  "featuredDishes": ["现炒意面", "沙拉碗", "披萨"],
  "createdAt": 1770000000000,
  "updatedAt": 1770000000000
}
```

说明：这个集合现在是“可选覆盖表”。
如果你还没有预填 `canteens` 数据，小程序会先按当前内置的食堂名单渲染列表，默认所有分数为 `0.0`；后续你再往这个集合里补充 `location`、`description`、`featuredDishes` 等详细信息即可。

### `canteen_reviews`

```json
{
  "_id": "doc id",
  "canteenId": "食堂 ID",
  "userOpenId": "评论人 openid",
  "userName": "评论人昵称",
  "userAvatar": "评论人头像",
  "content": "高峰期有点挤，但味道不错",
  "environmentScore": 4,
  "tasteScore": 5,
  "priceScore": 4,
  "createdAt": 1770000000000,
  "updatedAt": 1770000000000
}
```

### `canteen_review_likes`

```json
{
  "_id": "doc id",
  "reviewId": "评论 ID",
  "userOpenId": "点赞人 openid",
  "createdAt": 1770000000000
}
```

## 推荐索引

- `posts.mealTime`
- `posts.status`
- `join_requests.postId`
- `join_requests.applicantOpenId`
- `participations.postId`
- `participations.userOpenId`
- `canteen_reviews.canteenId`
- `canteen_reviews.createdAt`
- `canteen_review_likes.reviewId`
- `canteen_review_likes.userOpenId`

## 需要上传的云函数

- `listPosts`
- `getPostDetail`
- `createPost`
- `joinPostDirect`
- `applyToJoinPost`
- `reviewJoinRequest`
- `leavePost`
- `deletePost`
- `getMyDashboard`
- `getAdminDashboard`
- `getRankings`
- `listCanteens`
- `getCanteenDetail`
- `createCanteenReview`
- `deleteCanteenReview`
- `toggleCanteenReviewLike`
- `refreshExpiredPosts`

## 管理员设置

当前版本通过 `users.role` 控制管理员权限。

你需要在云开发控制台里，把目标用户在 `users` 集合中的文档补上：

```json
{
  "role": "admin"
}
```

常见做法是先让这个用户登录一次小程序，等 `users` 集合里出现对应 `_openid` 的文档后，再手动把 `role` 改成 `admin`。

## 定时任务

- `refreshExpiredPosts` 建议配置为周期触发。
- MVP 阶段可以先设置为每 10 分钟一次，用来把过期帖子标记为 `ended`，并把参与记录改成 `completed`。
