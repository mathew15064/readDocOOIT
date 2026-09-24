const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Open a file using the OS default application.
 * @param {string} filePath - absolute path to file
 * @param {object} env - validated env object
 * @returns {Promise<{opened: true, filePath: string}>}
 */
async function openFile(filePath, env) {
  const resolved = path.resolve(filePath);

  // Path traversal guard
  if (!resolved.startsWith(path.resolve(env.DOC_ROOT_DIR))) {
    throw new Error('PATH_OUTSIDE_ROOT');
  }

  // File must exist and be a file (not folder)
  const stat = await fs.promises.stat(resolved);
  if (!stat.isFile()) {
    throw new Error('NOT_A_FILE');
  }

  let cmd, args;
  if (process.platform === 'win32') {
    // `start` requires empty title arg to handle quoted paths correctly
    cmd = 'cmd';
    args = ['/c', 'start', '', resolved];
  } else if (process.platform === 'darwin') {
    cmd = 'open';
    args = [resolved];
  } else {
    cmd = 'xdg-open';
    args = [resolved];
  }

  const child = spawn(cmd, args, { detached: true, stdio: 'ignore' });
  if (child && typeof child.on === 'function') {
    child.on('error', () => {});
  }
  if (child && typeof child.unref === 'function') {
    child.unref();
  }

  return { opened: true, filePath: resolved };
}

/**
 * Reveal a file in the OS file explorer.
 * @param {string} filePath - absolute path to file
 * @param {object} env - validated env object
 * @returns {Promise<{revealed: true, folder: string}>}
 */
async function revealInFolder(filePath, env) {
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(env.DOC_ROOT_DIR))) {
    throw new Error('PATH_OUTSIDE_ROOT');
  }
  const stat = await fs.promises.stat(resolved);
  if (!stat.isFile()) throw new Error('NOT_A_FILE');

  let cmd, args;
  if (process.platform === 'win32') {
    cmd = 'explorer';
    args = [`/select,${resolved}`];
  } else if (process.platform === 'darwin') {
    cmd = 'open';
    args = ['-R', resolved];
  } else {
    cmd = 'xdg-open';
    args = [path.dirname(resolved)];
  }

  const child = spawn(cmd, args, { detached: true, stdio: 'ignore' });
  if (child && typeof child.on === 'function') {
    child.on('error', () => {});
  }
  if (child && typeof child.unref === 'function') {
    child.unref();
  }
  return { revealed: true, folder: path.dirname(resolved) };
}

module.exports = { openFile, revealInFolder };
