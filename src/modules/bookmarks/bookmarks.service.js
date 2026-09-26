// src/modules/bookmarks/bookmarks.service.js
const db = require('../../db');
const { toRelativePath } = require('../../utils/relative-path');

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

/**
 * List all groups + item_count.
 * @returns {Promise<Array<Object>>}
 */
async function listGroups() {
  const stmt = db.prepare(`
    SELECT g.id, g.name, g.description, g.color, g.sort_order, COUNT(i.id) AS item_count
    FROM bookmark_groups g
    LEFT JOIN bookmark_items i ON g.id = i.group_id
    GROUP BY g.id
    ORDER BY g.sort_order ASC, g.created_at ASC
  `);
  return stmt.all();
}

/**
 * Create a new group.
 * @param {Object} param0
 * @param {string} param0.name
 * @param {string} [param0.description='']
 * @param {string} [param0.color='#6366f1']
 * @returns {Promise<Object>}
 */
async function createGroup({ name, description = '', color = '#6366f1' }) {
  if (!name || typeof name !== 'string' || name.trim() === '' || name.trim().length > 100) {
    throw new Error('INVALID_GROUP_NAME');
  }

  const validColor = HEX_COLOR_REGEX.test(color) ? color : '#6366f1';
  const cleanName = name.trim();

  const existing = db.prepare('SELECT id FROM bookmark_groups WHERE name = ?').get(cleanName);
  if (existing) {
    throw new Error('GROUP_NAME_EXISTS');
  }

  const stmt = db.prepare(`
    INSERT INTO bookmark_groups (name, description, color, sort_order)
    VALUES (?, ?, ?, 0)
  `);
  const info = stmt.run(cleanName, description || '', validColor);
  const row = db.prepare('SELECT id, name, description, color, sort_order FROM bookmark_groups WHERE id = ?').get(info.lastInsertRowid);
  return { ...row, item_count: 0 };
}

/**
 * Partially update a group.
 * @param {number|string} id
 * @param {Object} param1
 * @returns {Promise<Object>}
 */
async function updateGroup(id, { name, description, color, sort_order }) {
  const group = db.prepare('SELECT * FROM bookmark_groups WHERE id = ?').get(id);
  if (!group) {
    throw new Error('GROUP_NOT_FOUND');
  }

  let newName = group.name;
  if (name !== undefined) {
    if (!name || typeof name !== 'string' || name.trim() === '' || name.trim().length > 100) {
      throw new Error('INVALID_GROUP_NAME');
    }
    const cleanName = name.trim();
    const existing = db.prepare('SELECT id FROM bookmark_groups WHERE name = ? AND id != ?').get(cleanName, id);
    if (existing) {
      throw new Error('GROUP_NAME_EXISTS');
    }
    newName = cleanName;
  }

  const newDesc = description !== undefined ? description : group.description;
  let newColor = group.color;
  if (color !== undefined) {
    newColor = HEX_COLOR_REGEX.test(color) ? color : '#6366f1';
  }
  const newOrder = sort_order !== undefined ? Number(sort_order) : group.sort_order;

  const stmt = db.prepare(`
    UPDATE bookmark_groups 
    SET name = ?, description = ?, color = ?, sort_order = ?, updated_at = unixepoch()
    WHERE id = ?
  `);
  stmt.run(newName, newDesc, newColor, newOrder, id);

  const updated = db.prepare(`
    SELECT g.id, g.name, g.description, g.color, g.sort_order, COUNT(i.id) AS item_count
    FROM bookmark_groups g
    LEFT JOIN bookmark_items i ON g.id = i.group_id
    WHERE g.id = ?
    GROUP BY g.id
  `).get(id);

  return updated;
}

/**
 * Delete a group and cascade delete items.
 * @param {number|string} id
 * @returns {Promise<{deleted: true}>}
 */
const deleteGroupTx = db.transaction((id) => {
  // Explicitly delete bookmark_items in case foreign keys pragma is not active in any test environment
  db.prepare('DELETE FROM bookmark_items WHERE group_id = ?').run(id);
  return db.prepare('DELETE FROM bookmark_groups WHERE id = ?').run(id);
});

async function deleteGroup(id) {
  const info = deleteGroupTx(id);
  if (info.changes === 0) {
    throw new Error('GROUP_NOT_FOUND');
  }
  return { deleted: true };
}

/**
 * List files in a group, joined with documents, with outdated detection.
 * @param {number|string} groupId
 * @returns {Promise<Array<Object>>}
 */
async function listGroupItems(groupId) {
  const stmt = db.prepare(`
    SELECT bi.id AS item_id, bi.note, bi.created_at AS item_created_at,
           d.id AS doc_id, d.file_name, d.file_path, d.file_ext, d.file_size,
           d.mtime, d.version_num, d.version_date, d.module_path, d.doc_type,
           d.base_name, d.is_latest,
           (SELECT d2.id FROM documents d2
            WHERE d2.base_name = d.base_name
              AND d2.module_path = d.module_path
              AND d2.is_latest = 1
            LIMIT 1) AS latest_sibling_id
    FROM bookmark_items bi
    JOIN documents d ON bi.document_id = d.id
    WHERE bi.group_id = ?
    ORDER BY bi.created_at ASC
  `);
  const rows = stmt.all(groupId);
  const getDocStmt = db.prepare('SELECT id, file_name, file_path, version_num, version_date FROM documents WHERE id = ?');

  return rows.map((r) => {
    const isOutdated = r.is_latest === 0;
    let latestSibling = null;
    if (isOutdated && r.latest_sibling_id && r.latest_sibling_id !== r.doc_id) {
      const sibRow = getDocStmt.get(r.latest_sibling_id);
      if (sibRow) {
        latestSibling = {
          id: sibRow.id,
          file_name: sibRow.file_name,
          file_path: sibRow.file_path,
          version_num: sibRow.version_num,
          version_date: sibRow.version_date
        };
      }
    }

    return {
      item_id: r.item_id,
      note: r.note || '',
      document: {
        id: r.doc_id,
        file_name: r.file_name,
        file_path: r.file_path,
        relative_path: toRelativePath(r.file_path),
        file_ext: r.file_ext,
        file_size: r.file_size,
        mtime: r.mtime,
        version_num: r.version_num,
        version_date: r.version_date,
        module_path: r.module_path,
        doc_type: r.doc_type,
        base_name: r.base_name,
        is_latest: r.is_latest
      },
      is_outdated: isOutdated,
      latest_sibling: latestSibling
    };
  });
}

/**
 * Add file to a group.
 * @param {number|string} groupId
 * @param {number|string} documentId
 * @param {string} [note='']
 * @returns {Promise<{item_id: number}>}
 */
async function addItemToGroup(groupId, documentId, note = '') {
  const doc = db.prepare('SELECT id FROM documents WHERE id = ?').get(documentId);
  if (!doc) {
    throw new Error('DOC_NOT_FOUND');
  }

  const group = db.prepare('SELECT id FROM bookmark_groups WHERE id = ?').get(groupId);
  if (!group) {
    throw new Error('GROUP_NOT_FOUND');
  }

  const existing = db.prepare('SELECT id FROM bookmark_items WHERE group_id = ? AND document_id = ?').get(groupId, documentId);
  if (existing) {
    throw new Error('ALREADY_EXISTS');
  }

  const stmt = db.prepare(`
    INSERT INTO bookmark_items (group_id, document_id, note)
    VALUES (?, ?, ?)
  `);
  const info = stmt.run(groupId, documentId, note || '');
  return { item_id: info.lastInsertRowid };
}

/**
 * Remove an item from a group.
 * @param {number|string} itemId
 * @returns {Promise<{deleted: true}>}
 */
async function removeItem(itemId) {
  db.prepare('DELETE FROM bookmark_items WHERE id = ?').run(itemId);
  return { deleted: true };
}

/**
 * Update note for a bookmark item.
 * @param {number|string} itemId
 * @param {string} note
 * @returns {Promise<Object>}
 */
async function updateItemNote(itemId, note) {
  const item = db.prepare('SELECT * FROM bookmark_items WHERE id = ?').get(itemId);
  if (!item) {
    throw new Error('ITEM_NOT_FOUND');
  }
  db.prepare('UPDATE bookmark_items SET note = ? WHERE id = ?').run(note || '', itemId);
  return { id: item.id, group_id: item.group_id, document_id: item.document_id, note: note || '' };
}

/**
 * Update a bookmark item to its latest sibling document version.
 * @param {number|string} itemId
 * @returns {Promise<Object>}
 */
async function updateItemToLatest(itemId) {
  // 1. Load bookmark_item → document_id → base_name, module_path
  const item = db.prepare('SELECT * FROM bookmark_items WHERE id = ?').get(itemId);
  if (!item) {
    throw new Error('ITEM_NOT_FOUND');
  }

  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(item.document_id);
  if (!doc) {
    throw new Error('DOC_NOT_FOUND');
  }

  // 2. Find latest sibling (same base_name + module_path, is_latest = 1)
  const latestSibling = db.prepare(`
    SELECT * FROM documents 
    WHERE base_name = ? AND module_path = ? AND is_latest = 1 AND id != ?
    LIMIT 1
  `).get(doc.base_name, doc.module_path, doc.id);

  // 3. If no sibling → throw NO_LATEST_SIBLING
  if (!latestSibling) {
    throw new Error('NO_LATEST_SIBLING');
  }

  // 4. Check UNIQUE(group_id, new_document_id) — if exists, DELETE current item 
  //    (to avoid duplicate) and throw ALREADY_IN_GROUP
  const existingInGroup = db.prepare(`
    SELECT id FROM bookmark_items 
    WHERE group_id = ? AND document_id = ?
  `).get(item.group_id, latestSibling.id);

  if (existingInGroup) {
    db.prepare('DELETE FROM bookmark_items WHERE id = ?').run(itemId);
    const err = new Error('ALREADY_IN_GROUP');
    err.existingItemId = existingInGroup.id;
    throw err;
  }

  // 5. UPDATE bookmark_items SET document_id = new_doc_id WHERE id = itemId
  db.prepare('UPDATE bookmark_items SET document_id = ? WHERE id = ?').run(latestSibling.id, itemId);

  // 6. Return updated item with new document info
  return {
    item_id: Number(itemId),
    note: item.note || '',
    document: latestSibling,
    is_outdated: false,
    latest_sibling: null
  };
}

/**
 * Return total count of outdated bookmark items across all groups.
 * @returns {Promise<{ count: number }>}
 */
async function countOutdated() {
  const stmt = db.prepare(`
    SELECT COUNT(bi.id) AS count
    FROM bookmark_items bi
    JOIN documents d ON bi.document_id = d.id
    WHERE d.is_latest = 0
  `);
  const row = stmt.get();
  return { count: row ? row.count : 0 };
}

/**
 * List group IDs this document belongs to.
 * @param {number|string} documentId
 * @returns {Promise<Array<number>>}
 */
async function getDocumentGroups(documentId) {
  const stmt = db.prepare('SELECT group_id FROM bookmark_items WHERE document_id = ?');
  const rows = stmt.all(documentId);
  return rows.map((r) => r.group_id);
}

module.exports = {
  listGroups,
  createGroup,
  updateGroup,
  deleteGroup,
  listGroupItems,
  addItemToGroup,
  removeItem,
  updateItemNote,
  updateItemToLatest,
  countOutdated,
  getDocumentGroups
};
