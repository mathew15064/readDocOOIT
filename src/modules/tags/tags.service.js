// src/modules/tags/tags.service.js
const db = require('../../db');

/**
 * List all tags with document count.
 */
function listTags() {
  const stmt = db.prepare(`
    SELECT t.id, t.name, t.color, t.created_at,
           COUNT(dt.document_id) AS doc_count
    FROM tags t
    LEFT JOIN document_tags dt ON t.id = dt.tag_id
    GROUP BY t.id
    ORDER BY t.name ASC
  `);
  return stmt.all();
}

/**
 * Create a new tag.
 * @param {Object} data
 * @param {string} data.name
 * @param {string} [data.color='#6366f1']
 */
function createTag({ name, color = '#6366f1' }) {
  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new Error('INVALID_TAG_NAME');
  }
  const cleanName = name.trim();
  const existing = db.prepare('SELECT id FROM tags WHERE name = ? COLLATE NOCASE').get(cleanName);
  if (existing) {
    throw new Error('TAG_NAME_EXISTS');
  }

  const hexColor = (color && typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color.trim())) ? color.trim() : '#6366f1';
  const stmt = db.prepare('INSERT INTO tags (name, color) VALUES (?, ?)');
  const info = stmt.run(cleanName, hexColor);
  return { id: info.lastInsertRowid, name: cleanName, color: hexColor, doc_count: 0 };
}

/**
 * Update tag name or color.
 * @param {number|string} id
 * @param {Object} data
 */
function updateTag(id, { name, color }) {
  const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(id);
  if (!tag) {
    throw new Error('TAG_NOT_FOUND');
  }

  let newName = tag.name;
  if (name !== undefined) {
    if (!name || typeof name !== 'string' || !name.trim()) {
      throw new Error('INVALID_TAG_NAME');
    }
    const cleanName = name.trim();
    const existing = db.prepare('SELECT id FROM tags WHERE name = ? COLLATE NOCASE AND id != ?').get(cleanName, id);
    if (existing) {
      throw new Error('TAG_NAME_EXISTS');
    }
    newName = cleanName;
  }

  let newColor = tag.color;
  if (color !== undefined) {
    newColor = (color && typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color.trim())) ? color.trim() : tag.color;
  }

  db.prepare('UPDATE tags SET name = ?, color = ? WHERE id = ?').run(newName, newColor, id);
  return { id: Number(id), name: newName, color: newColor };
}

/**
 * Delete a tag (cascades document_tags via DB constraint).
 * @param {number|string} id
 */
function deleteTag(id) {
  const info = db.prepare('DELETE FROM tags WHERE id = ?').run(id);
  if (info.changes === 0) {
    throw new Error('TAG_NOT_FOUND');
  }
  return { deleted: true };
}

/**
 * Get all tags for a document.
 * @param {number|string} documentId
 */
function getDocumentTags(documentId) {
  const stmt = db.prepare(`
    SELECT t.id, t.name, t.color
    FROM tags t
    JOIN document_tags dt ON t.id = dt.tag_id
    WHERE dt.document_id = ?
    ORDER BY t.name ASC
  `);
  return stmt.all(documentId);
}

/**
 * Replace all tags for a document in a transaction.
 * @param {number|string} documentId
 * @param {Array<number>} tagIds
 */
function setDocumentTags(documentId, tagIds = []) {
  const doc = db.prepare('SELECT id FROM documents WHERE id = ?').get(documentId);
  if (!doc) {
    throw new Error('DOC_NOT_FOUND');
  }

  const setTransaction = db.transaction((dId, ids) => {
    db.prepare('DELETE FROM document_tags WHERE document_id = ?').run(dId);
    if (Array.isArray(ids) && ids.length > 0) {
      const insertStmt = db.prepare('INSERT OR IGNORE INTO document_tags (document_id, tag_id) VALUES (?, ?)');
      for (const tId of ids) {
        insertStmt.run(dId, tId);
      }
    }
    return getDocumentTags(dId);
  });

  return setTransaction(documentId, tagIds);
}

/**
 * Add a tag to a document.
 * @param {number|string} documentId
 * @param {number|string} tagId
 */
function addTagToDocument(documentId, tagId) {
  const doc = db.prepare('SELECT id FROM documents WHERE id = ?').get(documentId);
  if (!doc) {
    throw new Error('DOC_NOT_FOUND');
  }
  const tag = db.prepare('SELECT id FROM tags WHERE id = ?').get(tagId);
  if (!tag) {
    throw new Error('TAG_NOT_FOUND');
  }

  db.prepare('INSERT OR IGNORE INTO document_tags (document_id, tag_id) VALUES (?, ?)').run(documentId, tagId);
  return { added: true, document_id: Number(documentId), tag_id: Number(tagId) };
}

/**
 * Remove a tag from a document.
 * @param {number|string} documentId
 * @param {number|string} tagId
 */
function removeTagFromDocument(documentId, tagId) {
  db.prepare('DELETE FROM document_tags WHERE document_id = ? AND tag_id = ?').run(documentId, tagId);
  return { removed: true, document_id: Number(documentId), tag_id: Number(tagId) };
}

module.exports = {
  listTags,
  createTag,
  updateTag,
  deleteTag,
  getDocumentTags,
  setDocumentTags,
  addTagToDocument,
  removeTagFromDocument
};
