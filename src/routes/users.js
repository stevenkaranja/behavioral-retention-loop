const express = require('express');
const db = require('../db/client');

const router = express.Router();

router.get('/:id/lifecycle', async (req, res) => {
  const [user, score, interventions, discovery] = await Promise.all([
    db.query('SELECT * FROM users WHERE id = $1', [req.params.id]),
    db.query('SELECT * FROM churn_scores WHERE user_id = $1', [req.params.id]),
    db.query('SELECT * FROM interventions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10', [req.params.id]),
    db.query('SELECT fd.*, f.display_name FROM feature_discovery fd JOIN feature_definitions f ON f.slug = fd.feature_slug WHERE fd.user_id = $1', [req.params.id]),
  ]);
  res.json({
    user: user.rows[0],
    churn_score: score.rows[0],
    interventions: interventions.rows,
    feature_discovery: discovery.rows,
  });
});

module.exports = router;
