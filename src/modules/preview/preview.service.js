// src/modules/preview/preview.service.js
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const db = require('../../db');
const { isPathInsideRoot } = require('../opener/opener.service');

const MIME_MAP = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  txt: 'text/plain; charset=utf-8',
  md: 'text/markdown; charset=utf-8',
  csv: 'text/csv; charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xlsm: 'application/vnd.ms-excel.sheet.macroEnabled.12',
  xls: 'application/vnd.ms-excel',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword'
};

/**
 * Validates document and path traversal security.
 */
function getDocumentAndValidate(documentId, env = process.env) {
  const doc = db.prepare('SELECT id, file_path, file_name, file_ext, doc_type, file_size FROM documents WHERE id = ?').get(documentId);
  if (!doc) {
    const err = new Error('DOC_NOT_FOUND');
    err.status = 404;
    throw err;
  }

  const rootDir = path.resolve(env.DOC_ROOT_DIR || process.cwd());
  const resolvedPath = path.resolve(doc.file_path);

  if (!isPathInsideRoot(resolvedPath, rootDir)) {
    const err = new Error('PATH_OUTSIDE_ROOT');
    err.status = 403;
    throw err;
  }

  if (!fs.existsSync(resolvedPath)) {
    const err = new Error('FILE_NOT_FOUND');
    err.status = 404;
    throw err;
  }

  return { doc, resolvedPath };
}

/**
 * Get raw file stream with content type and filename headers.
 */
async function getFileRaw(documentId, env = process.env) {
  const { doc, resolvedPath } = getDocumentAndValidate(documentId, env);
  const stat = await fs.promises.stat(resolvedPath);
  if (!stat.isFile()) {
    const err = new Error('NOT_A_FILE');
    err.status = 400;
    throw err;
  }

  const ext = (doc.file_ext || path.extname(doc.file_name).slice(1) || '').toLowerCase();
  const mimeType = MIME_MAP[ext] || 'application/octet-stream';
  const stream = fs.createReadStream(resolvedPath);

  return {
    stream,
    mimeType,
    fileName: doc.file_name,
    fileSize: stat.size
  };
}

/**
 * Helper to parse CSV line handling quotes.
 */
function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

// Cleans one ExcelJS cell value into a plain string for JSON preview.
// Handles rich text runs, formula results, hyperlinks and error cells —
// ExcelJS returns objects for all of these instead of primitives.
function cleanCellValue(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().split('T')[0];
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return v.richText.map((rt) => rt.text || '').join('');
    if (v.result !== undefined) return cleanCellValue(v.result);
    if (v.text !== undefined) return cleanCellValue(v.text);
    if (v.error !== undefined) return String(v.error);
    return JSON.stringify(v);
  }
  return String(v);
}

const MAX_PREVIEW_ROWS = 500;
// Sentinel thrown to break out of ExcelJS's eachRow callback early —
// eachRow has no native "stop" signal, and `return` inside its callback
// only skips the current row while still visiting every remaining one.
const STOP_ROW_ITERATION = Symbol('stop-row-iteration');

/**
 * Get structured preview data for in-app viewing.
 */
async function getFilePreview(documentId, env = process.env) {
  const { doc, resolvedPath } = getDocumentAndValidate(documentId, env);
  const stat = await fs.promises.stat(resolvedPath);

  // Maximum file size limit (15MB)
  if (stat.size > 15 * 1024 * 1024) {
    const err = new Error('PAYLOAD_TOO_LARGE');
    err.status = 413;
    throw err;
  }

  const ext = (doc.file_ext || path.extname(doc.file_name).slice(1) || '').toLowerCase();

  // Excel (.xlsx, .xlsm). Legacy binary .xls is a different format that
  // ExcelJS cannot parse — fail gracefully instead of throwing a 500.
  if (ext === 'xlsx' || ext === 'xlsm') {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(resolvedPath);
    const sheets = [];

    workbook.eachSheet((worksheet) => {
      const rows = [];
      let headers = [];
      let rowIndex = 0;

      try {
        worksheet.eachRow({ includeEmpty: false }, (row) => {
          // rowIndex 0 is the header; cap data rows at MAX_PREVIEW_ROWS.
          if (rowIndex > MAX_PREVIEW_ROWS) {
            throw STOP_ROW_ITERATION;
          }
          // Array.isArray(row.values) is a sparse array where a fully-empty
          // leading cell leaves a hole; Array.from() (unlike .slice()) fills
          // holes with `undefined` so .map() below doesn't silently drop
          // columns and shift every value after the gap.
          const rawValues = Array.isArray(row.values) ? Array.from(row.values).slice(1) : [];
          const cleanValues = rawValues.map(cleanCellValue);

          if (rowIndex === 0) {
            headers = cleanValues;
          } else {
            rows.push(cleanValues);
          }
          rowIndex++;
        });
      } catch (e) {
        if (e !== STOP_ROW_ITERATION) throw e;
      }

      sheets.push({
        name: worksheet.name,
        headers,
        rows,
        totalRows: worksheet.rowCount || 0
      });
    });

    return {
      type: 'xlsx',
      file_name: doc.file_name,
      file_size: stat.size,
      sheets
    };
  }

  if (ext === 'xls') {
    return {
      type: 'unsupported',
      file_name: doc.file_name,
      file_size: stat.size,
      ext,
      error: 'Legacy .xls files cannot be previewed in-browser. Open the file directly instead.',
      url: `/api/documents/${doc.id}/raw`
    };
  }

  // CSV (.csv)
  if (ext === 'csv') {
    const rawContent = await fs.promises.readFile(resolvedPath, 'utf8');
    const lines = rawContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const headers = lines[0] ? parseCsvLine(lines[0]) : [];
    const rows = lines.slice(1, 501).map(parseCsvLine);

    return {
      type: 'csv',
      file_name: doc.file_name,
      file_size: stat.size,
      headers,
      rows,
      totalRows: lines.length - 1
    };
  }

  // Text & Markdown (.txt, .md, .log)
  if (ext === 'txt' || ext === 'md' || ext === 'log') {
    if (stat.size > 500 * 1024) {
      const err = new Error('PAYLOAD_TOO_LARGE');
      err.status = 413;
      throw err;
    }
    const content = await fs.promises.readFile(resolvedPath, 'utf8');
    return {
      type: 'text',
      file_name: doc.file_name,
      file_size: stat.size,
      is_markdown: ext === 'md',
      content
    };
  }

  // Images & PDF
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'pdf'].includes(ext)) {
    return {
      type: 'raw',
      file_name: doc.file_name,
      file_size: stat.size,
      mimeType: MIME_MAP[ext] || 'application/octet-stream',
      url: `/api/documents/${doc.id}/raw`
    };
  }

  // Unsupported fallback
  return {
    type: 'unsupported',
    file_name: doc.file_name,
    file_size: stat.size,
    ext,
    url: `/api/documents/${doc.id}/raw`
  };
}

module.exports = {
  getFileRaw,
  getFilePreview,
  getDocumentAndValidate,
  MIME_MAP
};
