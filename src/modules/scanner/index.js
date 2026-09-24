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

function isPathIgnored(targetPath, customIgnorePatterns = []) {
  const normalized = targetPath.toLowerCase().replace(/\\/g, '/');
  const segments = normalized.split('/').filter(Boolean);
  const baseName = path.basename(normalized);

  // Match anywhere in path: segment check or direct containment
  for (const seg of DEFAULT_IGNORED_SEGMENTS) {
    if (segments.includes(seg) || normalized.includes(`/${seg}/`) || normalized.endsWith(`/${seg}`) || normalized === seg) {
      return true;
    }
  }

  // Exact file matches or temp/lock file patterns
  if (DEFAULT_IGNORED_FILES.includes(baseName)) return true;
  if (baseName.endsWith('.tmp') || baseName.endsWith('.lock')) return true;

  // Custom patterns passed in
  for (const pat of customIgnorePatterns) {
    if (pat && normalized.includes(pat.toLowerCase())) return true;
  }

  return false;
}

/**
 * Recursively walks a directory, respecting ignore patterns, and upserts file metadata into the DB.
 * @param {string} rootDir - Absolute path to start scanning.
 * @param {Array<string>} ignorePatterns - Array of glob-like patterns to ignore (e.g., ['node_modules', '.git']).
 * @param {function(Object)} [progressCallback] - Optional callback invoked after each file processed.
 */
async function scanDirectory(rootDir, ignorePatterns = [], progressCallback) {
  let filesFound = 0;
  let filesIndexed = 0;
  const errors = [];

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
      if (isPathIgnored(fullPath, ignorePatterns)) continue;

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
          const stmt = db.prepare(`
            INSERT OR REPLACE INTO documents 
            (file_path, file_name, file_ext, file_size, mtime, version_num, version_date, module_path, doc_type, base_name, indexed_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          stmt.run(
            fullPath,
            entry.name,
            parsed.file_ext,
            stats.size,
            new Date(stats.mtimeMs).toISOString(),
            parsed.version_num,
            parsed.version_date,
            path.dirname(fullPath),
            parsed.doc_type,
            parsed.base_name,
            new Date().toISOString()
          );
          filesIndexed++;
          scanState.filesIndexed = filesIndexed;
        } catch (e) {
          errors.push(`FILE_PROCESS_ERROR: ${fullPath} - ${e.message}`);
          scanState.errors = errors;
        }

        const payload = { scanId: logId, filesFound, filesIndexed, errors: errors.length };
        scanEvents.emit(`progress:${logId}`, payload);
        if (progressCallback) {
          progressCallback(payload);
        }
      }
    }
  }

  await walk(rootDir);

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
  scanEvents.emit(`complete:${logId}`, { scanId: logId, filesFound, filesIndexed, errors });

  return { scanId: logId, filesFound, filesIndexed, errors };
}

module.exports = { scanDirectory, getScanStatus, scanEvents };
