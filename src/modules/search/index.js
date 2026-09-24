// src/modules/search/index.js
const db = require('../../db');

/**
 * Search and filter documents with optional pagination.
 * @param {Object} options
 * @param {string} [options.q='']
 * @param {string} [options.module='']
 * @param {boolean} [options.only_latest=false]
 * @param {number} [options.page=1]
 * @param {number} [options.pageSize=50]
 * @param {string|Array<number>} [options.tagIds=null]
 */
function searchDocuments({ q = '', module = '', only_latest = false, page = 1, pageSize = 50, tagIds = null } = {}) {
  const conditions = [];
  const params = {};

  if (q && q.trim() !== '') {
    conditions.push('(file_name LIKE @q OR base_name LIKE @q OR doc_type LIKE @q OR file_path LIKE @q)');
    params.q = `%${q.trim()}%`;
  }

  if (module && module.trim() !== '') {
    conditions.push('module_path = @module');
    params.module = module.trim();
  }

  if (only_latest === true || only_latest === 'true' || only_latest === '1' || only_latest === 1) {
    conditions.push('is_latest = 1');
  }

  let parsedTagIds = [];
  if (typeof tagIds === 'string' && tagIds.trim()) {
    parsedTagIds = tagIds.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
  } else if (Array.isArray(tagIds)) {
    parsedTagIds = tagIds.map(n => parseInt(n, 10)).filter(n => !isNaN(n));
  }

  if (parsedTagIds.length > 0) {
    const tagPlaceholders = parsedTagIds.map((id, idx) => {
      const key = `tag_${idx}`;
      params[key] = id;
      return `@${key}`;
    }).join(', ');
    conditions.push(`id IN (SELECT document_id FROM document_tags WHERE tag_id IN (${tagPlaceholders}))`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countStmt = db.prepare(`SELECT COUNT(*) as total FROM documents ${whereClause}`);
  const total = countStmt.get(params).total;

  const limit = Math.max(1, parseInt(pageSize, 10) || 50);
  const p = Math.max(1, parseInt(page, 10) || 1);
  const offset = (p - 1) * limit;

  params.limit = limit;
  params.offset = offset;

  const dataStmt = db.prepare(`
    SELECT id, file_path, file_name, file_ext, file_size, mtime, version_num, version_date, module_path, doc_type, base_name, is_latest, indexed_at
    FROM documents
    ${whereClause}
    ORDER BY is_latest DESC, version_num DESC NULLS LAST, file_name ASC
    LIMIT @limit OFFSET @offset
  `);

  const documents = dataStmt.all(params);

  // Attach tags to each document
  if (documents.length > 0) {
    const docIds = documents.map(d => d.id);
    const placeholders = docIds.map(() => '?').join(',');
    const tagRows = db.prepare(`
      SELECT dt.document_id, t.id, t.name, t.color
      FROM document_tags dt
      JOIN tags t ON dt.tag_id = t.id
      WHERE dt.document_id IN (${placeholders})
      ORDER BY t.name ASC
    `).all(...docIds);

    const tagsByDocId = {};
    for (const r of tagRows) {
      if (!tagsByDocId[r.document_id]) {
        tagsByDocId[r.document_id] = [];
      }
      tagsByDocId[r.document_id].push({ id: r.id, name: r.name, color: r.color });
    }

    for (const doc of documents) {
      doc.tags = tagsByDocId[doc.id] || [];
    }
  }

  return {
    documents,
    total,
    page: p,
    pageSize: limit,
    totalPages: Math.ceil(total / limit) || 1
  };
}

/**
 * Get distinct list of module paths.
 */
function getModules() {
  const stmt = db.prepare(`
    SELECT DISTINCT module_path 
    FROM documents 
    WHERE module_path IS NOT NULL AND module_path != '' 
    ORDER BY module_path ASC
  `);
  return stmt.all().map(r => r.module_path);
}

/**
 * Get all versions of a document (siblings with same base_name + module_path).
 * @param {number|string} documentId
 * @param {number|string|null} [currentId=null]
 */
function getVersions(documentId, currentId = null) {
  const doc = db.prepare('SELECT base_name, module_path FROM documents WHERE id = ?').get(documentId);
  if (!doc) throw new Error('DOC_NOT_FOUND');

  const rows = db.prepare(`
    SELECT id, file_name, file_path, version_num, version_date, is_latest,
           file_size, mtime, doc_type
    FROM documents
    WHERE base_name = ? AND module_path = ?
    ORDER BY version_date DESC, version_num DESC
  `).all(doc.base_name, doc.module_path);

  const oldestId = rows[rows.length - 1]?.id;
  const numericCurrentId = (currentId !== null && currentId !== undefined && currentId !== '') ? Number(currentId) : null;

  return {
    base_name: doc.base_name,
    module_path: doc.module_path,
    total: rows.length,
    versions: rows.map(r => ({
      ...r,
      is_current: (numericCurrentId !== null && r.id === numericCurrentId) ? 1 : 0,
      is_oldest: r.id === oldestId ? 1 : 0,
    })),
  };
}

module.exports = { searchDocuments, getModules, getVersions };
