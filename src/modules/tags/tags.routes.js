// src/modules/tags/tags.routes.js
const express = require('express');
const router = express.Router();
const tagsService = require('./tags.service');

/**
 * GET /api/tags
 */
router.get('/tags', (req, res) => {
  try {
    const tags = tagsService.listTags();
    res.json(tags);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/tags
 */
router.post('/tags', (req, res) => {
  const { name, color } = req.body || {};
  try {
    const tag = tagsService.createTag({ name, color });
    res.status(201).json(tag);
  } catch (err) {
    if (err.message === 'TAG_NAME_EXISTS') {
      return res.status(409).json({ error: 'Tag name already exists' });
    }
    if (err.message === 'INVALID_TAG_NAME') {
      return res.status(400).json({ error: 'Tag name is required' });
    }
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/tags/:id
 */
router.patch('/tags/:id', (req, res) => {
  const { id } = req.params;
  const { name, color } = req.body || {};
  try {
    const updated = tagsService.updateTag(id, { name, color });
    res.json(updated);
  } catch (err) {
    if (err.message === 'TAG_NOT_FOUND') {
      return res.status(404).json({ error: 'Tag not found' });
    }
    if (err.message === 'TAG_NAME_EXISTS') {
      return res.status(409).json({ error: 'Tag name already exists' });
    }
    if (err.message === 'INVALID_TAG_NAME') {
      return res.status(400).json({ error: 'Tag name is required' });
    }
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/tags/:id
 */
router.delete('/tags/:id', (req, res) => {
  const { id } = req.params;
  try {
    const result = tagsService.deleteTag(id);
    res.json(result);
  } catch (err) {
    if (err.message === 'TAG_NOT_FOUND') {
      return res.status(404).json({ error: 'Tag not found' });
    }
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/documents/:id/tags
 */
router.get('/documents/:id/tags', (req, res) => {
  const { id } = req.params;
  try {
    const tags = tagsService.getDocumentTags(id);
    res.json(tags);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/documents/:id/tags
 */
router.put('/documents/:id/tags', (req, res) => {
  const { id } = req.params;
  const { tagIds } = req.body || {};
  try {
    const tags = tagsService.setDocumentTags(id, tagIds || []);
    res.json(tags);
  } catch (err) {
    if (err.message === 'DOC_NOT_FOUND') {
      return res.status(404).json({ error: 'Document not found' });
    }
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/documents/:id/tags/:tagId
 */
router.post('/documents/:id/tags/:tagId', (req, res) => {
  const { id, tagId } = req.params;
  try {
    const result = tagsService.addTagToDocument(id, tagId);
    res.status(201).json(result);
  } catch (err) {
    if (err.message === 'DOC_NOT_FOUND' || err.message === 'TAG_NOT_FOUND') {
      return res.status(404).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/documents/:id/tags/:tagId
 */
router.delete('/documents/:id/tags/:tagId', (req, res) => {
  const { id, tagId } = req.params;
  try {
    const result = tagsService.removeTagFromDocument(id, tagId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
