/**
 * @typedef {Object} PostCardView
 * @property {string} id
 * @property {string} hostName
 * @property {string} hostAvatar
 * @property {string} buildingName
 * @property {string} content
 * @property {string} locationPreview
 * @property {number} seatRemaining
 * @property {number} seatTotal
 * @property {number} mealTime
 * @property {boolean} requiresApproval
 * @property {string} status
 * @property {string} statusText
 * @property {string} timeLabel
 */

/**
 * @typedef {Object} PostDetailView
 * @property {string} id
 * @property {string} hostOpenId
 * @property {string} hostName
 * @property {string} hostAvatar
 * @property {string} buildingName
 * @property {string} content
 * @property {string} location
 * @property {boolean} canViewLocation
 * @property {number} seatRemaining
 * @property {number} seatTotal
 * @property {number} mealTime
 * @property {boolean} requiresApproval
 * @property {string} status
 * @property {Array<Object>} participants
 * @property {Array<Object>} pendingRequests
 * @property {string} joinActionState
 */

/**
 * @typedef {Object} RankingItem
 * @property {string} userId
 * @property {string} nickname
 * @property {string} avatarUrl
 * @property {number} count
 * @property {number} rank
 */

module.exports = {};
