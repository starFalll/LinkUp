function getCurrentProfile() {
  return getApp().globalData.currentUserProfile || null;
}

function isProfileComplete(profile) {
  return Boolean(profile && profile.nickName && profile.nickName.trim());
}

function buildMockOpenId(existingProfile) {
  return existingProfile?.mockOpenId || `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getFileExtension(filePath = '') {
  const matched = filePath.match(/(\.[a-zA-Z0-9]+)(?:\?|$)/);
  return matched ? matched[1].toLowerCase() : '.png';
}

async function uploadAvatarIfNeeded(avatarFilePath, existingAvatarUrl) {
  const app = getApp();
  if (!avatarFilePath || avatarFilePath === existingAvatarUrl) {
    return existingAvatarUrl || '';
  }

  if (!app.globalData.cloudAvailable || !wx.cloud) {
    return avatarFilePath;
  }

  const extension = getFileExtension(avatarFilePath);
  const cloudPath = `avatars/${Date.now()}_${Math.random().toString(36).slice(2, 8)}${extension}`;
  const { fileID } = await wx.cloud.uploadFile({
    cloudPath,
    filePath: avatarFilePath
  });
  return fileID;
}

async function saveUserProfile({ nickName, avatarFilePath, avatarUrl } = {}) {
  const app = getApp();
  const existingProfile = getCurrentProfile();
  const trimmedNickName = (nickName || existingProfile?.nickName || '').trim();

  if (!trimmedNickName) {
    throw new Error('请先填写昵称');
  }

  const nextAvatarUrl = await uploadAvatarIfNeeded(
    avatarFilePath,
    avatarUrl || existingProfile?.avatarUrl || ''
  );

  const profile = {
    ...existingProfile,
    nickName: trimmedNickName,
    avatarUrl: nextAvatarUrl,
    mockOpenId: buildMockOpenId(existingProfile)
  };

  app.setCurrentUserProfile(profile);
  return profile;
}

function requestUserProfile() {
  const profile = getCurrentProfile();
  if (isProfileComplete(profile)) {
    return Promise.resolve(profile);
  }
  return Promise.reject(new Error('请先到我的页完善资料'));
}

module.exports = {
  requestUserProfile,
  getCurrentProfile,
  isProfileComplete,
  saveUserProfile
};
