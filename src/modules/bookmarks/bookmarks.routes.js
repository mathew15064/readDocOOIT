// src/modules/bookmarks/bookmarks.routes.js
const express = require('express');
const router = express.Router();
const bookmarksService = require('./bookmarks.service');
const db = require('../../db');

/**
 * GET /api/bookmark-groups
 */
router.get('/bookmark-groups', async (req, res) => {
  try {
    const groups = await bookmarksService.listGroups();
    res.json(groups);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/bookmark-groups
 */
router.post('/bookmark-groups', async (req, res) => {
  const { name, description, color } = req.body || {};
  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ error: 'Group name is required' });
  }

  try {
    const group = await bookmarksService.createGroup({ name, description, color });
    res.status(201).json(group);
  } catch (err) {
    if (err.message === 'GROUP_NAME_EXISTS') {
      return res.status(409).json({ error: 'Group name already exists' });
    }
    if (err.message === 'INVALID_GROUP_NAME') {
      return res.status(400).json({ error: 'Invalid group name' });
    }
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/bookmark-groups/:id
 */
router.patch('/bookmark-groups/:id', async (req, res) => {
  const { id } = req.params;
  const { name, description, color, sort_order } = req.body || {};

  try {
    const updated = await bookmarksService.updateGroup(id, { name, description, color, sort_order });
    res.json(updated);
  } catch (err) {
    if (err.message === 'GROUP_NOT_FOUND') {
      return res.status(404).json({ error: 'Group not found' });
    }
    if (err.message === 'GROUP_NAME_EXISTS') {
      return res.status(409).json({ error: 'Group name already exists' });
    }
    if (err.message === 'INVALID_GROUP_NAME') {
      return res.status(400).json({ error: 'Invalid group name' });
    }
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/bookmark-groups/:id
 */
router.delete('/bookmark-groups/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await bookmarksService.deleteGroup(id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/bookmark-groups/:id/items
 */
router.get('/bookmark-groups/:id/items', async (req, res) => {
  const { id } = req.params;
  try {
    const items = await bookmarksService.listGroupItems(id);
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/bookmark-groups/:id/items
 */
router.post('/bookmark-groups/:id/items', async (req, res) => {
  const { id } = req.params;
  const { documentId, note } = req.body || {};

  if (!documentId) {
    return res.status(400).json({ error: 'documentId is required' });
  }

  try {
    const result = await bookmarksService.addItemToGroup(id, documentId, note);
    res.status(201).json(result);
  } catch (err) {
    if (err.message === 'DOC_NOT_FOUND') {
      return res.status(404).json({ error: 'Document not found' });
    }
    if (err.message === 'GROUP_NOT_FOUND') {
      return res.status(404).json({ error: 'Group not found' });
    }
    if (err.message === 'ALREADY_EXISTS') {
      return res.status(409).json({ error: 'Document already in this group' });
    }
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/bookmark-items/:id
 */
router.delete('/bookmark-items/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await bookmarksService.removeItem(id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/bookmark-items/:id
 */
router.patch('/bookmark-items/:id', async (req, res) => {
  const { id } = req.params;
  const { note } = req.body || {};
  try {
    const updated = await bookmarksService.updateItemNote(id, note);
    res.json(updated);
  } catch (err) {
    if (err.message === 'ITEM_NOT_FOUND') {
      return res.status(404).json({ error: 'Bookmark item not found' });
    }
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/bookmark-items/outdated-count
 */
router.get('/bookmark-items/outdated-count', async (req, res) => {
  try {
    const result = await bookmarksService.countOutdated();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/bookmark-items/:id/update-to-latest
 */
router.post('/bookmark-items/:id/update-to-latest', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await bookmarksService.updateItemToLatest(id);
    res.json(result);
  } catch (err) {
    if (err.message === 'ITEM_NOT_FOUND') {
      return res.status(404).json({ error: 'Bookmark item not found' });
    }
    if (err.message === 'NO_LATEST_SIBLING') {
      return res.status(404).json({ error: 'NO_LATEST_SIBLING' });
    }
    if (err.message === 'ALREADY_IN_GROUP') {
      return res.status(409).json({ error: 'ALREADY_IN_GROUP', existingItemId: err.existingItemId });
    }
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/documents/:docId/bookmark-groups
 */
router.get('/documents/:docId/bookmark-groups', (req, res) => {
  const { docId } = req.params;
  try {
    const items = db.prepare(`
      SELECT 
        bi.id AS item_id,
        bi.note,
        bi.created_at,
        bg.id AS group_id,
        bg.name AS group_name,
        bg.color
      FROM bookmark_items bi
      JOIN bookmark_groups bg ON bg.id = bi.group_id
      WHERE bi.document_id = ?
      ORDER BY bi.created_at DESC
    `).all(docId);
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
