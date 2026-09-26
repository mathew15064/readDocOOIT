// src/utils/relative-path.js
const path = require('path');
const env = require('../config/env');

/**
 * Converts an absolute file path stored in the DB into a path relative to
 * DOC_ROOT_DIR, using forward slashes so it's portable across OSes (useful
 * for pasting into code/docs instead of a machine-specific absolute path).
 * Falls back to the absolute path if it isn't actually under the root.
 * @param {string} absolutePath
 * @returns {string}
 */
function toRelativePath(absolutePath) {
  if (!absolutePath) return '';
  const rel = path.relative(env.DOC_ROOT_DIR, absolutePath);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
    return absolutePath;
  }
  return rel.split(path.sep).join('/');
}

module.exports = { toRelativePath };
