// src/modules/opener/wsl-helper.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

// Cache WSL detection result
let _isWSL = null;
function detectWSL() {
  const mode = process.env.PLATFORM_MODE || 'auto';
  if (mode === 'wsl') return true;
  if (mode === 'windows') return false;
  // auto detection (cached)
  if (_isWSL !== null) return _isWSL;
  if (process.platform !== 'linux') {
    _isWSL = false;
    return _isWSL;
  }
  try {
    const version = fs.readFileSync('/proc/version', 'utf8');
    _isWSL = /microsoft/i.test(version);
  } catch (e) {
    _isWSL = false;
  }
  return _isWSL;
}

// Convert a Linux file path to a Windows path according to the strategy
// Returns { path: <WindowsPath>, tempCopied: boolean }
function convertToWindowsPath(filePath) {
  if (!detectWSL()) {
    return { path: filePath, tempCopied: false };
  }
  // If path already on a mounted drive, use wslpath
  if (/^\/mnt\/[a-z]\//.test(filePath)) {
    try {
      const winPath = execFileSync('wslpath', ['-w', filePath]).toString().trim();
      return { path: winPath, tempCopied: false };
    } catch (e) {
      // fallback to copy
    }
  }
  // Otherwise copy to a temp folder on the Windows side
  const tempDir = '/mnt/c/temp/doc-reader';
  try {
    fs.mkdirSync(tempDir, { recursive: true });
  } catch (e) {}
  const stat = fs.statSync(filePath);
  const hash = crypto.createHash('sha1')
    .update(filePath + ':' + stat.mtimeMs)
    .digest('hex')
    .slice(0, 12);
  const safeBase = path.basename(filePath).replace(/[\/]/g, '_').replace(/^\.+/, '_');
  const tempName = `${hash}-${safeBase}`;
  const destPath = path.posix.join(tempDir, tempName);
  // Copy only if not already present
  if (!fs.existsSync(destPath)) {
    fs.copyFileSync(filePath, destPath);
  }
  const winPath = execFileSync('wslpath', ['-w', destPath]).toString().trim();
  return { path: winPath, tempCopied: true };
}

function cleanupOldTempFiles(maxAgeMs = 24 * 60 * 60 * 1000) {
  if (!detectWSL()) return;
  const tempDir = '/mnt/c/temp/doc-reader';
  let files = [];
  try {
    files = fs.readdirSync(tempDir);
  } catch (e) {
    return; // nothing to clean
  }
  const now = Date.now();
  files.forEach(f => {
    const full = path.posix.join(tempDir, f);
    try {
      const stats = fs.statSync(full);
      if (now - stats.mtimeMs > maxAgeMs) {
        fs.unlinkSync(full);
      }
    } catch (e) {}
  });
}

module.exports = { detectWSL, convertToWindowsPath, cleanupOldTempFiles };
