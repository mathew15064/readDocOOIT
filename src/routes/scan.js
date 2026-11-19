// src/routes/scan.js
const express = require('express');
const { scanDirectory, getScanStatus, scanEvents } = require('../modules/scanner');
const router = express.Router();
const fs = require('fs').promises;
const env = require('../config/env');
const { resolveWithinRoot } = require('../utils/path-guard');

/**
 * POST /api/scan
 * Body: { rootDir: string, ignorePatterns?: string[] }
 * Starts a scan and returns scan_id immediately.
 */
router.post('/scan', async (req, res) => {
  const { rootDir, ignorePatterns } = req.body || {};
  if (typeof rootDir !== 'string' || !rootDir.trim()) {
    return res.status(400).json({ error: 'rootDir is required' });
  }
  if (ignorePatterns !== undefined &&
      (!Array.isArray(ignorePatterns) || !ignorePatterns.every(p => typeof p === 'string'))) {
    return res.status(400).json({ error: 'ignorePatterns must be an array of strings' });
  }
  try {
    const safeRoot = await resolveWithinRoot(rootDir, env.DOC_ROOT_DIR);
    if (!(await fs.stat(safeRoot)).isDirectory()) {
      return res.status(400).json({ error: 'rootDir must be a directory' });
    }
    const result = await scanDirectory(safeRoot, ignorePatterns || []);
    res.json({ scan_id: result.scanId, status: 'completed', result });
  } catch (err) {
    if (err.message === 'PATH_OUTSIDE_ROOT') {
      return res.status(403).json({ error: 'PATH_OUTSIDE_ROOT' });
    }
    if (err.code === 'ENOENT') {
      return res.status(404).json({ error: 'Directory not found' });
    }
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/scan/:id/status
 * Returns scan status and logs by ID.
 */
router.get('/scan/:id/status', (req, res) => {
  const status = getScanStatus(req.params.id);
  if (!status) {
    return res.status(404).json({ error: 'Scan not found' });
  }
  res.json(status);
});

/**
 * GET /api/scan/:id/stream
 * Server-Sent Events (SSE) progress stream.
 */
router.get('/scan/:id/stream', (req, res) => {
  const scanId = Number(req.params.id);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const status = getScanStatus(scanId);
  if (status && status.status === 'completed') {
    res.write(`data: ${JSON.stringify({ event: 'complete', data: status })}\n\n`);
    return res.end();
  }

  const onProgress = (data) => {
    res.write(`data: ${JSON.stringify({ event: 'progress', data })}\n\n`);
  };

  const onComplete = (data) => {
    res.write(`data: ${JSON.stringify({ event: 'complete', data })}\n\n`);
    cleanup();
    res.end();
  };

  const cleanup = () => {
    scanEvents.removeListener(`progress:${scanId}`, onProgress);
    scanEvents.removeListener(`complete:${scanId}`, onComplete);
  };

  scanEvents.on(`progress:${scanId}`, onProgress);
  scanEvents.on(`complete:${scanId}`, onComplete);

  req.on('close', cleanup);
});

module.exports = router;
