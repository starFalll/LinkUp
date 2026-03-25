const POST_STATUS = {
  OPEN: 'open',
  FULL: 'full',
  ENDED: 'ended',
  CANCELLED: 'cancelled'
};

const JOIN_REQUEST_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled'
};

const PARTICIPATION_STATUS = {
  ACTIVE: 'active',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed'
};

const JOIN_ACTION_STATE = {
  CAN_JOIN: 'canJoin',
  NEED_APPLY: 'needApply',
  PENDING: 'pending',
  JOINED: 'joined',
  FULL: 'full',
  ENDED: 'ended',
  OWNER: 'owner'
};

const STORAGE_KEY = 'linkup-mock-db-v1';

module.exports = {
  POST_STATUS,
  JOIN_REQUEST_STATUS,
  PARTICIPATION_STATUS,
  JOIN_ACTION_STATE,
  STORAGE_KEY
};
