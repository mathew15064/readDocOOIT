// src/modules/preview/preview.routes.js
const express = require('express');
const router = express.Router();
const previewService = require('./preview.service');

/**
 * GET /api/documents/:id/raw
 * Streams raw file bytes with content-type and inline disposition.
 */
router.get('/documents/:id/raw', async (req, res) => {
  try {
    const { id } = req.params;
    const { stream, mimeType, fileName } = await previewService.getFileRaw(id, process.env);

    // ASCII fallback for old clients (`?` for anything non-ASCII) plus a
    // filename*= UTF-8 form so accented/non-Latin names come through intact.
    const asciiFallback = fileName.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, "'");
    res.setHeader('Content-Type', mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
    );
    stream.pipe(res);
  } catch (err) {
    if (err.message === 'DOC_NOT_FOUND' || err.message === 'FILE_NOT_FOUND') {
      return res.status(404).json({ error: 'Document or file not found' });
    }
    if (err.message === 'PATH_OUTSIDE_ROOT') {
      return res.status(403).json({ error: 'Access denied' });
    }
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * GET /api/documents/:id/preview
 * Returns structured JSON for in-app browser preview.
 */
router.get('/documents/:id/preview', async (req, res) => {
  try {
    const { id } = req.params;
    const preview = await previewService.getFilePreview(id, process.env);
    res.json(preview);
  } catch (err) {
    if (err.message === 'DOC_NOT_FOUND' || err.message === 'FILE_NOT_FOUND') {
      return res.status(404).json({ error: 'Document or file not found' });
    }
    if (err.message === 'PATH_OUTSIDE_ROOT') {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (err.message === 'PAYLOAD_TOO_LARGE' || err.status === 413) {
      return res.status(413).json({ error: err.message || 'File too large for preview' });
    }
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
