const express = require('express');
const db = require('../db/client');
const { generateIntervention, getMissingKeyFeatures } = require('../agents/intervention');

const router = express.Router();

// POST /interventions/trigger — manually trigger intervention check
router.post('/trigger', async (req, res) => {
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });

  const missing = await getMissingKeyFeatures(user_id);
  if (!missing.length) return res.json({ message: 'No intervention needed' });

  const content = await generateIntervention(user_id, missing[0]);
  res.json({ intervention: content, target_feature: missing[0] });
});

// GET /interventions/:userId — intervention history
router.get('/:userId', async (req, res) => {
  const { rows } = await db.query(
    `SELECT * FROM interventions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [req.params.userId]
  );
  res.json({ interventions: rows });
});

// POST /interventions/:id/opened — track open event
router.post('/:id/opened', async (req, res) => {
  await db.query(
    `UPDATE interventions SET opened_at = NOW() WHERE id = $1 AND opened_at IS NULL`,
    [req.params.id]
  );
  res.json({ ok: true });
});

module.exports = router;
