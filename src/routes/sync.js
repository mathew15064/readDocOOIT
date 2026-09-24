// src/routes/sync.js
const express = require('express');
const router = express.Router();
const { gitPull } = require('../modules/gitsync');

/**
 * POST /api/sync
 * Runs git pull and triggers document rescan.
 */
router.post('/sync', async (req, res) => {
  try {
    const result = await gitPull();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
