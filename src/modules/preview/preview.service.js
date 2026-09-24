// src/modules/preview/preview.service.js
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const db = require('../../db');

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

  if (!resolvedPath.startsWith(rootDir)) {
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

  // Excel (.xlsx, .xls)
  if (ext === 'xlsx' || ext === 'xls') {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(resolvedPath);
    const sheets = [];

    workbook.eachSheet((worksheet) => {
      const rows = [];
      let headers = [];
      let rowIndex = 0;

      worksheet.eachRow({ includeEmpty: false }, (row) => {
        if (rowIndex > 500) return; // Limit to 500 rows
        const rawValues = Array.isArray(row.values) ? row.values.slice(1) : [];
        const cleanValues = rawValues.map((v) => {
          if (v === null || v === undefined) return '';
          if (typeof v === 'object') {
            if (v.text) return String(v.text);
            if (v.result !== undefined) return String(v.result);
            if (v instanceof Date) return v.toISOString().split('T')[0];
            return JSON.stringify(v);
          }
          return String(v);
        });

        if (rowIndex === 0) {
          headers = cleanValues;
        } else {
          rows.push(cleanValues);
        }
        rowIndex++;
      });

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
