const express = require('express');
const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/client');
const queue = require('../services/queue');

const router = express.Router();

const eventSchema = Joi.object({
  user_id:    Joi.string().uuid().required(),
  event_type: Joi.string().max(100).required(),
  feature:    Joi.string().max(100),
  properties: Joi.object().default({}),
  occurred_at: Joi.date().iso().default(() => new Date()),
});

// POST /events — ingest a user interaction event
router.post('/', async (req, res) => {
  const { error, value } = eventSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  const { rows } = await db.query(
    `INSERT INTO user_events (user_id, event_type, feature, properties, occurred_at)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [value.user_id, value.event_type, value.feature, value.properties, value.occurred_at]
  );

  // Update feature discovery if applicable
  if (value.feature) {
    await db.query(
      `INSERT INTO feature_discovery (user_id, feature_slug)
       VALUES ($1, $2)
       ON CONFLICT (user_id, feature_slug)
       DO UPDATE SET use_count = feature_discovery.use_count + 1`,
      [value.user_id, value.feature]
    );
  }

  // Queue async churn score refresh
  await queue.add('refresh-churn-score', { userId: value.user_id }, { delay: 0 });

  res.status(201).json({ id: rows[0].id });
});

// GET /events/:userId — fetch recent events for a user
router.get('/:userId', async (req, res) => {
  const { rows } = await db.query(
    `SELECT * FROM user_events WHERE user_id = $1 ORDER BY occurred_at DESC LIMIT 100`,
    [req.params.userId]
  );
  res.json({ events: rows });
});

module.exports = router;
