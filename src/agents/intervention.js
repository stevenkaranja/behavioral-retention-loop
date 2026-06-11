/**
 * GPT-4o intervention agent — generates personalised tutorial nudges
 * for users at high churn risk who haven't discovered key features.
 */
const OpenAI = require('openai');
const db = require('../db/client');
const logger = require('../services/logger');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are a product success specialist.
Generate a short, friendly in-app message (max 2 sentences) that helps
a SaaS user discover a specific feature they haven't used yet.
Be specific about the value, not generic. Never sound like a bot.`;

async function generateIntervention(userId, targetFeature) {
  const [userRes, eventsRes] = await Promise.all([
    db.query(`SELECT email, plan, created_at FROM users WHERE id = $1`, [userId]),
    db.query(
      `SELECT event_type, feature FROM user_events
       WHERE user_id = $1 ORDER BY occurred_at DESC LIMIT 20`,
      [userId]
    ),
  ]);

  const user = userRes.rows[0];
  const recentActivity = eventsRes.rows.map((e) => e.event_type).join(', ');

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `User plan: ${user.plan}
Days since signup: ${Math.floor((Date.now() - new Date(user.created_at)) / 86_400_000)}
Recent activity: ${recentActivity || 'minimal'}
Feature to highlight: ${targetFeature}
Generate the intervention message.`,
      },
    ],
    max_tokens: 120,
    temperature: 0.7,
  });

  const content = completion.choices[0].message.content;

  await db.query(
    `INSERT INTO interventions (user_id, trigger_event, intervention_type, content)
     VALUES ($1, 'churn_risk', $2, $3)`,
    [userId, `feature_nudge:${targetFeature}`, content]
  );

  logger.info('Intervention generated', { userId, targetFeature });
  return content;
}

async function getMissingKeyFeatures(userId) {
  const { rows } = await db.query(
    `SELECT f.slug FROM feature_definitions f
     WHERE f.is_key_feature = TRUE
       AND f.slug NOT IN (
         SELECT feature_slug FROM feature_discovery WHERE user_id = $1
       )
     ORDER BY f.onboarding_day`,
    [userId]
  );
  return rows.map((r) => r.slug);
}

module.exports = { generateIntervention, getMissingKeyFeatures };
