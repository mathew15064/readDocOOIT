// src/modules/opener/opener.routes.js
const express = require('express');
const router = express.Router();
const { openFile, revealInFolder, openWith } = require('./opener.service');
const env = require('../../config/env');
const db = require('../../db');

/**
 * POST /api/open-file
 * Body: { "filePath": "path/to/file" }
 */
router.post('/open-file', async (req, res) => {
  const { filePath, openerId } = req.body || {};
  if (!filePath || typeof filePath !== 'string') {
    return res.status(400).json({ error: 'filePath is required' });
  }

  try {
    let result;
    if (openerId) {
      const { loadOpeners } = require('../../config/openers');
      const openers = loadOpeners();
      const opener = openers.find(o => o.id === openerId);
      if (!opener) return res.status(400).json({ error: 'Invalid openerId' });
      result = await openWith(filePath, opener, env);
    } else {
      result = await openFile(filePath, env);
    }
    return res.status(200).json(result);
  } catch (err) {
    if (err.message === 'PATH_OUTSIDE_ROOT') {
      return res.status(403).json({ error: 'PATH_OUTSIDE_ROOT' });
    }
    if (err.message === 'NOT_A_FILE' || err.code === 'ENOENT') {
      return res.status(404).json({ error: err.message || 'NOT_FOUND' });
    }
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/documents/:id/open
 */
router.post('/documents/:id/open', async (req, res) => {
  const { id } = req.params;
  const { openerId } = req.body || {};
  const doc = db.prepare('SELECT id, file_path FROM documents WHERE id = ?').get(id);
  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }

  try {
    let result;
    if (openerId) {
      const { loadOpeners } = require('../../config/openers');
      const openers = loadOpeners();
      const opener = openers.find(o => o.id === openerId);
      if (!opener) return res.status(400).json({ error: 'Invalid openerId' });
      result = await openWith(doc.file_path, opener, env);
    } else {
      result = await openFile(doc.file_path, env);
    }
    return res.status(200).json(result);
  } catch (err) {
    if (err.message === 'PATH_OUTSIDE_ROOT') {
      return res.status(403).json({ error: 'PATH_OUTSIDE_ROOT' });
    }
    if (err.message === 'NOT_A_FILE' || err.code === 'ENOENT') {
      return res.status(404).json({ error: err.message || 'NOT_FOUND' });
    }
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/documents/:id/reveal
 */
router.post('/documents/:id/reveal', async (req, res) => {
  const { id } = req.params;
  const doc = db.prepare('SELECT id, file_path FROM documents WHERE id = ?').get(id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  try {
    const result = await revealInFolder(doc.file_path, env);
    res.json(result);
  } catch (err) {
    if (err.message === 'PATH_OUTSIDE_ROOT') return res.status(403).json({ error: 'PATH_OUTSIDE_ROOT' });
    if (err.message === 'NOT_A_FILE' || err.code === 'ENOENT') return res.status(404).json({ error: 'NOT_A_FILE' });
    if (err.message === 'PATH_CONVERT_FAILED') return res.status(500).json({ error: 'PATH_CONVERT_FAILED' });
    return res.status(500).json({ error: err.message });
  }
});

// GET list of openers
router.get('/openers', (req, res) => {
  const { loadOpeners } = require('../../config/openers');
  const openers = loadOpeners();
  // Return without command/pathStrategy details for security
  const sanitized = openers.map(o => ({ id: o.id, label: o.label, icon: o.icon, platform: o.platform, default: !!o.default }));
  res.json(sanitized);
});

module.exports = router;
