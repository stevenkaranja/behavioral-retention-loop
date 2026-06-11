/**
 * User lifecycle monitor v2 — fixed 14-day onboarding window boundary.
 */
const { Worker } = require('bullmq');
const db = require('../db/client');
const cache = require('../services/redis');
const logger = require('../services/logger');

const ONBOARDING_DAYS = 14;
const KEY_FEATURES = ['dashboard', 'automation', 'integrations', 'team-invite'];

async function computeChurnScore(userId) {
  const [eventsRes, discoveryRes, userRes] = await Promise.all([
    db.query(
      `SELECT event_type, feature, occurred_at FROM user_events
       WHERE user_id = $1 AND occurred_at > NOW() - INTERVAL '30 days'
       ORDER BY occurred_at DESC`,
      [userId]
    ),
    db.query(`SELECT feature_slug FROM feature_discovery WHERE user_id = $1`, [userId]),
    db.query(`SELECT created_at, plan FROM users WHERE id = $1`, [userId]),
  ]);

  const events = eventsRes.rows;
  const discovered = new Set(discoveryRes.rows.map((r) => r.feature_slug));
  const user = userRes.rows[0];
  if (!user) return null;

  const signupMs = new Date(user.created_at).getTime();
  // FIX: use precise ms diff, not Date subtraction which breaks at month boundaries
  const daysSinceSignup = (Date.now() - signupMs) / 86_400_000;
  const inOnboardingWindow = daysSinceSignup <= ONBOARDING_DAYS;

  const keyFeaturesUsed = KEY_FEATURES.filter((f) => discovered.has(f)).length;
  const eventsLast7Days = events.filter(
    (e) => new Date(e.occurred_at).getTime() > Date.now() - 7 * 86_400_000
  ).length;

  let score = 0.5;
  score -= keyFeaturesUsed * 0.1;
  score -= Math.min(eventsLast7Days / 20, 0.2);
  if (!inOnboardingWindow && keyFeaturesUsed < 2) score += 0.3;
  if (inOnboardingWindow && keyFeaturesUsed === 0 && daysSinceSignup > 3) score += 0.15;
  score = Math.max(0, Math.min(1, score));

  const tier =
    score >= 0.8 ? 'critical' : score >= 0.6 ? 'high' : score >= 0.4 ? 'medium' : 'low';

  await db.query(
    `INSERT INTO churn_scores (user_id, score, risk_tier, features_used, last_active_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id) DO UPDATE
     SET score=$2, risk_tier=$3, features_used=$4, last_active_at=$5, computed_at=NOW()`,
    [userId, score, tier, discovered.size, events[0]?.occurred_at ?? null]
  );

  return { userId, score, tier };
}

async function getCachedScore(userId) {
  const cached = await cache.get(`churn:${userId}`);
  if (cached) return cached;
  const score = await computeChurnScore(userId);
  if (score) await cache.set(`churn:${userId}`, score, 300);
  return score;
}

const worker = new Worker(
  'refresh-churn-score',
  async (job) => {
    const result = await computeChurnScore(job.data.userId);
    if (result?.tier === 'high' || result?.tier === 'critical') {
      await cache.publish('intervention-needed', result);
    }
    return result;
  },
  { connection: { url: process.env.REDIS_URL }, concurrency: 10 }
);

worker.on('failed', (job, err) =>
  logger.error('Churn score job failed', { jobId: job.id, err: err.message })
);

module.exports = { computeChurnScore, getCachedScore };
