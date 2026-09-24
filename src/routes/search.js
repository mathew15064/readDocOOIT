// src/routes/search.js
const express = require('express');
const router = express.Router();
const { searchDocuments, getModules, getVersions } = require('../modules/search');

/**
 * GET /api/documents
 * Query params: q, module, only_latest, page, pageSize
 */
router.get('/documents', (req, res) => {
  try {
    const { q, module: moduleFilter, only_latest, page, pageSize, tagIds } = req.query;
    const result = searchDocuments({
      q: q || '',
      module: moduleFilter || '',
      only_latest: only_latest === 'true' || only_latest === '1',
      page: page || 1,
      pageSize: pageSize || 50,
      tagIds: tagIds || null
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/search (Backward compatibility endpoint)
 */
router.get('/search', (req, res) => {
  try {
    const { q, module: moduleFilter, only_latest, tagIds } = req.query;
    const result = searchDocuments({
      q: q || '',
      module: moduleFilter || '',
      only_latest: only_latest === 'true' || only_latest === '1',
      tagIds: tagIds || null
    });
    res.json({ results: result.documents });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/modules
 * Distinct list of module directories
 */
router.get('/modules', (req, res) => {
  try {
    const modules = getModules();
    res.json({ modules });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/documents/:id/versions
 * Query params: currentId
 */
router.get('/documents/:id/versions', (req, res) => {
  try {
    const { id } = req.params;
    const { currentId } = req.query;
    const result = getVersions(id, currentId);
    res.json(result);
  } catch (err) {
    if (err.message === 'DOC_NOT_FOUND') {
      return res.status(404).json({ error: 'Document not found' });
    }
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
