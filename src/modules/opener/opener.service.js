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
// openWith: open a file using a specific opener configuration
// @param {string} filePath - absolute path to the file
// @param {object} opener - opener object from config
// @param {object} env - validated env object
// @returns {Promise<{opened:true, openerId:string, path:string}>}
async function openWith(filePath, opener, env) {
  const resolved = path.resolve(filePath);
  // Path traversal guard
  if (!resolved.startsWith(path.resolve(env.DOC_ROOT_DIR))) {
    throw new Error('PATH_OUTSIDE_ROOT');
  }
  const stat = await fs.promises.stat(resolved);
  if (!stat.isFile()) {
    throw new Error('NOT_A_FILE');
  }

  // Determine command/args based on opener
  let cmd = opener.command;
  let args = opener.args.map(a => a === '{file}' ? resolved : a);

  // WSL Windows path handling
  if (opener.pathStrategy === 'windows' && require('./wsl-helper').detectWSL()) {
    const { path: winPath } = require('./wsl-helper').convertToWindowsPath(resolved);
    args = opener.args.map(a => a === '{file}' ? winPath : a);
  }

  // OS default fallback
  if (!cmd) {
    return openFile(filePath, env);
  }

  const child = spawn(cmd, args, { detached: true, stdio: 'ignore' });
  if (child && typeof child.on === 'function') child.on('error', () => {});
  if (child && typeof child.unref === 'function') child.unref();

  return { opened: true, openerId: opener.id, path: resolved };
}

async function revealInFolder(filePath, env) {
  const path = require('path');
  const fs = require('fs');
  const { spawn, execSync } = require('child_process');

  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(env.DOC_ROOT_DIR))) {
    throw new Error('PATH_OUTSIDE_ROOT');
  }
  const stat = await fs.promises.stat(resolved);
  if (!stat.isFile()) throw new Error('NOT_A_FILE');

  const isWin = process.platform === 'win32';
  const isWSL = process.platform === 'linux' && (() => {
    try { return /microsoft/i.test(fs.readFileSync('/proc/version', 'utf8')); } catch { return false; }
  })();
  const isMac = process.platform === 'darwin';

  let cmd, args, targetPath = resolved;

  if (isWin) {
    // Native Windows
    cmd = 'explorer.exe';
    args = [`/select,${resolved}`];
    targetPath = resolved;
  } else if (isWSL) {
    const mountMatch = resolved.match(/^\/mnt\/([a-z])\/(.*)$/);

    if (mountMatch) {
      // File on Windows drive: /mnt/c/... → C:\...
      try {
        const winPath = execSync(`wslpath -w "${resolved}"`, { encoding: 'utf8' }).trim();
        cmd = 'explorer.exe';
        args = [`/select,${winPath}`];
        targetPath = winPath;
      } catch (e) {
        throw new Error('PATH_CONVERT_FAILED');
      }
    } else {
      // File on WSL native filesystem (/home/*, /root/*, /opt/*, etc.)
      // Use UNC path: \\wsl.localhost\<distro>\<path>
      // Note: /select does NOT work with UNC paths — use the plain folder path.
      const distro = (process.env.WSL_DISTRO_NAME || 'Ubuntu').trim();
      const parentDir = path.dirname(resolved);
      // Strip leading / from path before joining with UNC prefix
      const rel = parentDir.replace(/^\//, '');
      // Convert / to \ for Windows UNC
      const uncPath = `\\\\wsl.localhost\\${distro}\\${rel.replace(/\//g, '\\')}`;

      cmd = 'explorer.exe';
      args = [uncPath];
      targetPath = uncPath;
    }
  } else if (isMac) {
    cmd = 'open';
    args = ['-R', resolved];
  } else {
    // Plain Linux
    cmd = 'xdg-open';
    args = [path.dirname(resolved)];
  }

  const child = spawn(cmd, args, { detached: true, stdio: 'ignore' });
  child.unref();

  return { revealed: true, path: resolved, targetPath, folder: path.dirname(resolved) };
}

module.exports = { openFile, openWith, revealInFolder };
