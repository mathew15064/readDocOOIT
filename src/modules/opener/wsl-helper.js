// src/modules/opener/wsl-helper.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

// Cache WSL detection result
let _isWSL = null;
function detectWSL() {
  const mode = process.env.PLATFORM_MODE || 'auto';
  if (mode === 'wsl') return true;
  if (mode === 'windows') return false;
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

// Convert Linux paths to Windows paths without evaluating filenames in a shell.
async function convertToWindowsPath(filePath) {
  if (!detectWSL()) {
    return { path: filePath, tempCopied: false };
  }
  async function toWindowsPath(target) {
    const { stdout } = await execFileAsync('wslpath', ['-w', target], { encoding: 'utf8' });
    return stdout.trim();
  }

  if (/^\/mnt\/[a-z]\//.test(filePath)) {
    try {
      return { path: await toWindowsPath(filePath), tempCopied: false };
    } catch (err) {
      // Fall back to the Windows temp copy if the mount cannot be converted.
    }
  }

  const tempDir = '/mnt/c/temp/doc-reader';
  await fs.promises.mkdir(tempDir, { recursive: true });
  const stat = await fs.promises.stat(filePath);
  const hash = crypto.createHash('sha1')
    .update(filePath + ':' + stat.mtimeMs)
    .digest('hex')
    .slice(0, 12);
  const safeBase = path.basename(filePath).replace(/[\\/]/g, '_').replace(/^\.+/, '_');
  const tempName = `${hash}-${safeBase}`;
  const destPath = path.posix.join(tempDir, tempName);

  try {
    await fs.promises.copyFile(filePath, destPath, fs.constants.COPYFILE_EXCL);
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
  return { path: await toWindowsPath(destPath), tempCopied: true };
}

// Called on server startup; separate from user requests.
function cleanupOldTempFiles(maxAgeMs = 24 * 60 * 60 * 1000) {
  if (!detectWSL()) return;
  const tempDir = '/mnt/c/temp/doc-reader';
  let files = [];
  try {
    files = fs.readdirSync(tempDir);
  } catch (e) {
    return;
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
