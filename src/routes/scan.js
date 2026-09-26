// src/routes/scan.js
const express = require('express');
const path = require('path');
const { scanDirectory, getScanStatus, scanEvents } = require('../modules/scanner');
const env = require('../config/env');
const router = express.Router();

function normalizeForCompare(p) {
  return process.platform === 'win32' || process.platform === 'darwin' ? p.toLowerCase() : p;
}

/**
 * POST /api/scan
 * Body: { rootDir: string, ignorePatterns?: string[] }
 * Starts a scan and returns scan_id immediately.
 */
router.post('/scan', async (req, res) => {
  const { rootDir, ignorePatterns } = req.body;
  if (!rootDir) {
    return res.status(400).json({ error: 'rootDir is required' });
  }

  // Only allow scanning within the configured document root — otherwise an
  // arbitrary caller could index (and later open/preview) any path on disk.
  const resolvedRequested = path.resolve(rootDir);
  const resolvedAllowedRoot = path.resolve(env.DOC_ROOT_DIR);
  const a = normalizeForCompare(resolvedRequested);
  const b = normalizeForCompare(resolvedAllowedRoot);
  if (a !== b && !a.startsWith(b + path.sep)) {
    return res.status(403).json({ error: 'rootDir must be inside the configured DOC_ROOT_DIR' });
  }

  try {
    const result = await scanDirectory(rootDir, ignorePatterns || []);
    res.json({ scan_id: result.scanId, status: 'completed', result });
  } catch (err) {
    if (err.message === 'SCAN_ALREADY_RUNNING') {
      return res.status(409).json({ error: 'A scan is already running' });
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
