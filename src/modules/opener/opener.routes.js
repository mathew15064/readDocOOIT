// src/modules/opener/opener.routes.js
const express = require('express');
const router = express.Router();
const { openFile, revealInFolder } = require('./opener.service');
const env = require('../../config/env');
const db = require('../../db');

/**
 * POST /api/open-file
 * Body: { "filePath": "path/to/file" }
 */
router.post('/open-file', async (req, res) => {
  const { filePath } = req.body || {};
  if (!filePath || typeof filePath !== 'string') {
    return res.status(400).json({ error: 'filePath is required' });
  }

  try {
    const result = await openFile(filePath, env);
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
  const doc = db.prepare('SELECT id, file_path FROM documents WHERE id = ?').get(id);
  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }

  try {
    const result = await openFile(doc.file_path, env);
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
  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }

  try {
    const result = await revealInFolder(doc.file_path, env);
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

module.exports = router;
