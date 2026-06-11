const { Queue } = require('bullmq');

const connection = { url: process.env.REDIS_URL || 'redis://localhost:6379' };

const queues = {
  'refresh-churn-score': new Queue('refresh-churn-score', { connection }),
  'send-intervention':   new Queue('send-intervention',   { connection }),
  'ltv-recalculate':     new Queue('ltv-recalculate',     { connection }),
};

module.exports = {
  add: (name, data, opts = {}) => queues[name].add(name, data, opts),
  queues,
};
