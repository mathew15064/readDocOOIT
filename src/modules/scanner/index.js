// src/modules/scanner/index.js
const fs = require('fs').promises;
const path = require('path');
const EventEmitter = require('events');
const { parseFilename } = require('../parser');
const db = require('../../db');

const scanEvents = new EventEmitter();
const activeScans = new Map();

/**
 * Get active scan status or logs by ID.
 */
function getScanStatus(scanId) {
  if (activeScans.has(Number(scanId))) {
    return activeScans.get(Number(scanId));
  }
  const row = db.prepare('SELECT * FROM scan_logs WHERE id = ?').get(scanId);
  if (!row) return null;
  return {
    id: row.id,
    started_at: row.started_at,
    finished_at: row.finished_at,
    filesFound: row.files_found,
    filesIndexed: row.files_indexed,
    errors: row.errors ? JSON.parse(row.errors) : [],
    status: row.finished_at ? 'completed' : 'running'
  };
}

const DEFAULT_IGNORED_SEGMENTS = [
  '.git',
  'node_modules',
  'coverage',
  'dist',
  'build',
  'out',
  '.cache',
  '.next',
  '.nuxt',
  'test-results',
  'playwright-report'
];

const DEFAULT_IGNORED_FILES = [
  '.ds_store',
  'thumbs.db'
];

const ALLOWED_EXTENSIONS = new Set([
  // Office documents
  '.xlsx', '.xls', '.xlsm',
  '.docx', '.doc',
  '.pptx', '.ppt',
  '.pdf',
  // Text
  '.csv', '.txt', '.md',
  // Diagrams
  '.drawio', '.a5er', '.vsdx', '.vsd',
  // Images
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'
]);

// Ignore rules are matched against the path *relative to the scan root* so
// that a root directory that itself happens to live under a folder named
// e.g. "out" or "build" doesn't get skipped entirely.
function isPathIgnored(relativePath, customIgnorePatterns = []) {
  const normalized = relativePath.toLowerCase().replace(/\\/g, '/');
  const segments = normalized.split('/').filter(Boolean);
  const baseName = segments[segments.length - 1] || '';

  for (const seg of DEFAULT_IGNORED_SEGMENTS) {
    if (segments.includes(seg)) return true;
  }

  // Exact file matches or temp/lock file patterns
  if (DEFAULT_IGNORED_FILES.includes(baseName)) return true;
  if (baseName.endsWith('.tmp') || baseName.endsWith('.lock')) return true;
  // Office "file is open" lock files, e.g. "~$Report.xlsx"
  if (baseName.startsWith('~$')) return true;

  // Custom patterns passed in
  for (const pat of customIgnorePatterns) {
    if (pat && normalized.includes(pat.toLowerCase())) return true;
  }

  return false;
}

// Windows/macOS filesystems are case-insensitive; normalize paths before
// comparing/deduping so casing differences don't cause false mismatches.
function normalizeForCompare(p) {
  return process.platform === 'win32' || process.platform === 'darwin' ? p.toLowerCase() : p;
}

const BATCH_SIZE = 500;

/**
 * Recursively walks a directory, respecting ignore patterns, and upserts file metadata into the DB.
 * Existing rows are updated in place (never deleted+reinserted) so bookmarks/tags on unchanged
 * files survive a rescan. Files that disappeared from disk since the last scan of this root are
 * removed. Writes are batched into a handful of transactions instead of one per file.
 * @param {string} rootDir - Absolute path to start scanning.
 * @param {Array<string>} ignorePatterns - Array of glob-like patterns to ignore (e.g., ['node_modules', '.git']).
 * @param {function(Object)} [progressCallback] - Optional callback invoked after each batch processed.
 */
let scanInProgress = false;

async function scanDirectory(rootDir, ignorePatterns = [], progressCallback) {
  if (scanInProgress) {
    throw new Error('SCAN_ALREADY_RUNNING');
  }
  scanInProgress = true;
  try {
    return await runScan(rootDir, ignorePatterns, progressCallback);
  } finally {
    scanInProgress = false;
  }
}

async function runScan(rootDir, ignorePatterns, progressCallback) {
  const resolvedRoot = path.resolve(rootDir);
  let filesFound = 0;
  let filesIndexed = 0;
  const errors = [];
  const scannedKeys = new Set();

  const startTime = new Date();
  const logInsert = db.prepare('INSERT INTO scan_logs (started_at, files_found, files_indexed, errors) VALUES (?, 0, 0, ?)');
  const logId = Number(logInsert.run(startTime.toISOString(), '').lastInsertRowid);

  const scanState = {
    id: logId,
    status: 'running',
    started_at: startTime.toISOString(),
    filesFound: 0,
    filesIndexed: 0,
    errors: []
  };
  activeScans.set(logId, scanState);

  const pendingRows = [];

  const upsertStmt = db.prepare(`
    INSERT INTO documents
      (file_path, file_name, file_ext, file_size, mtime, version_num, version_date, module_path, doc_type, base_name, indexed_at)
    VALUES
      (@file_path, @file_name, @file_ext, @file_size, @mtime, @version_num, @version_date, @module_path, @doc_type, @base_name, @indexed_at)
    ON CONFLICT(file_path) DO UPDATE SET
      file_name = excluded.file_name,
      file_ext = excluded.file_ext,
      file_size = excluded.file_size,
      mtime = excluded.mtime,
      version_num = excluded.version_num,
      version_date = excluded.version_date,
      module_path = excluded.module_path,
      doc_type = excluded.doc_type,
      base_name = excluded.base_name,
      indexed_at = excluded.indexed_at
  `);

  const insertBatch = db.transaction((rows) => {
    for (const row of rows) {
      upsertStmt.run(row);
    }
  });

  function flushBatch() {
    if (pendingRows.length === 0) return;
    const batch = pendingRows.splice(0, pendingRows.length);
    try {
      insertBatch(batch);
      filesIndexed += batch.length;
    } catch (e) {
      errors.push(`DB_WRITE_ERROR: batch of ${batch.length} - ${e.message}`);
    }
    scanState.filesIndexed = filesIndexed;
    const payload = { scanId: logId, filesFound, filesIndexed, errors: errors.length };
    scanEvents.emit(`progress:${logId}`, payload);
    if (progressCallback) progressCallback(payload);
  }

  async function walk(dir) {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (err) {
      errors.push(`READ_DIR_ERROR: ${dir} - ${err.message}`);
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(resolvedRoot, fullPath);
      if (isPathIgnored(relativePath, ignorePatterns)) continue;

      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (!ALLOWED_EXTENSIONS.has(ext)) continue;

        filesFound++;
        scanState.filesFound = filesFound;
        try {
          const stats = await fs.stat(fullPath);
          const parsed = parseFilename(entry.name);
          pendingRows.push({
            file_path: fullPath,
            file_name: entry.name,
            file_ext: parsed.file_ext,
            file_size: stats.size,
            mtime: new Date(stats.mtimeMs).toISOString(),
            version_num: parsed.version_num,
            version_date: parsed.version_date,
            module_path: path.dirname(fullPath),
            doc_type: parsed.doc_type,
            base_name: parsed.base_name,
            indexed_at: new Date().toISOString()
          });
          scannedKeys.add(normalizeForCompare(fullPath));
        } catch (e) {
          errors.push(`FILE_PROCESS_ERROR: ${fullPath} - ${e.message}`);
          scanState.errors = errors;
        }

        if (pendingRows.length >= BATCH_SIZE) {
          flushBatch();
        }
      }
    }
  }

  await walk(resolvedRoot);
  flushBatch();

  // Remove documents under this root that no longer exist on disk (deleted/renamed
  // since the last scan). Cascades to bookmark_items / document_tags via FK.
  try {
    const rootPrefix = normalizeForCompare(resolvedRoot + path.sep);
    const existing = db.prepare('SELECT id, file_path FROM documents').all();
    const staleIds = existing
      .filter((d) => {
        const norm = normalizeForCompare(d.file_path);
        return norm.startsWith(rootPrefix) && !scannedKeys.has(norm);
      })
      .map((d) => d.id);

    if (staleIds.length > 0) {
      const deleteStmt = db.prepare('DELETE FROM documents WHERE id = ?');
      const deleteBatch = db.transaction((ids) => {
        for (const id of ids) deleteStmt.run(id);
      });
      deleteBatch(staleIds);
    }
  } catch (e) {
    errors.push(`STALE_CLEANUP_ERROR: ${e.message}`);
  }

  const finishedAt = new Date().toISOString();
  const updateLog = db.prepare('UPDATE scan_logs SET finished_at = ?, files_found = ?, files_indexed = ?, errors = ? WHERE id = ?');
  updateLog.run(finishedAt, filesFound, filesIndexed, JSON.stringify(errors), logId);

  // Compute is_latest flag using partition window strategy per ADR-004
  const latestStmt = db.prepare(`
    UPDATE documents SET is_latest = CASE WHEN id IN (
      SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (
          PARTITION BY module_path, base_name
          ORDER BY version_num DESC NULLS LAST, version_date DESC NULLS LAST, id DESC
        ) as rn FROM documents
      ) WHERE rn = 1
    ) THEN 1 ELSE 0 END
  `);
  latestStmt.run();

  scanState.status = 'completed';
  scanState.finished_at = finishedAt;
  activeScans.delete(logId);
  scanEvents.emit(`complete:${logId}`, { scanId: logId, filesFound, filesIndexed, errors });

  return { scanId: logId, filesFound, filesIndexed, errors };
}

module.exports = { scanDirectory, getScanStatus, scanEvents, isPathIgnored };
