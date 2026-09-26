const { spawn, execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Windows/macOS filesystems are case-insensitive; comparing raw strings with
// startsWith() both misses same-path-different-case matches (false 403s) and
// can be fooled by a sibling dir that merely shares a prefix, e.g. root
// "/docs" vs a target "/docs-private/secret.txt".
function isPathInsideRoot(resolved, rootDir) {
  const root = path.resolve(rootDir);
  const rel = path.relative(root, resolved);
  const isCaseInsensitiveFs = process.platform === 'win32' || process.platform === 'darwin';
  const relToCheck = isCaseInsensitiveFs ? rel.toLowerCase() : rel;
  return relToCheck === '' || (!relToCheck.startsWith('..') && !path.isAbsolute(rel));
}

// Spawn a detached child and resolve/reject based on whether the OS actually
// managed to start it, instead of assuming success the instant spawn() returns.
function spawnDetached(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const child = spawn(cmd, args, { detached: true, stdio: 'ignore', ...options });
    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    });
    child.on('spawn', () => {
      if (settled) return;
      settled = true;
      if (typeof child.unref === 'function') child.unref();
      resolve(child);
    });
  });
}

/**
 * Open a file using the OS default application.
 * @param {string} filePath - absolute path to file
 * @param {object} env - validated env object
 * @returns {Promise<{opened: true, filePath: string}>}
 */
async function openFile(filePath, env) {
  const resolved = path.resolve(filePath);

  // Path traversal guard
  if (!isPathInsideRoot(resolved, env.DOC_ROOT_DIR)) {
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

  await spawnDetached(cmd, args, { windowsHide: true });

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
  if (!isPathInsideRoot(resolved, env.DOC_ROOT_DIR)) {
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

  await spawnDetached(cmd, args, { windowsHide: true });

  return { opened: true, openerId: opener.id, path: resolved };
}

async function revealInFolder(filePath, env) {
  const resolved = path.resolve(filePath);
  if (!isPathInsideRoot(resolved, env.DOC_ROOT_DIR)) {
    throw new Error('PATH_OUTSIDE_ROOT');
  }
  const stat = await fs.promises.stat(resolved);
  if (!stat.isFile()) throw new Error('NOT_A_FILE');

  const isWin = process.platform === 'win32';
  const isMac = process.platform === 'darwin';
  const isWSL = process.platform === 'linux' && (() => {
    try { return /microsoft/i.test(fs.readFileSync('/proc/version', 'utf8')); } catch { return false; }
  })();

  let targetPath = resolved;

  if (isWin) {
    // shell:true → Node routes through cmd.exe which handles Windows quoting correctly.
    // cmd.exe strips the outer quotes and passes /select + path properly to Explorer.
    await spawnDetached(`explorer.exe /select,"${resolved}"`, [], { shell: true, windowsHide: true });
    return { revealed: true, path: resolved, targetPath: resolved, folder: path.dirname(resolved) };
  }

  if (isWSL) {
    const mountMatch = resolved.match(/^\/mnt\/([a-z])\/(.*)$/);
    let cmd, args;

    if (mountMatch) {
      try {
        const winPath = execFileSync('wslpath', ['-w', resolved], { encoding: 'utf8' }).trim();
        cmd = 'explorer.exe';
        args = [`/select,"${winPath}"`];
        targetPath = winPath;
      } catch {
        throw new Error('PATH_CONVERT_FAILED');
      }
    } else {
      // WSL native file — open parent folder via UNC path
      const distro = (process.env.WSL_DISTRO_NAME || 'Ubuntu').trim();
      const parentDir = path.dirname(resolved);
      const rel = parentDir.replace(/^\//, '').replace(/\//g, '\\');
      const uncPath = `\\\\wsl.localhost\\${distro}\\${rel}`;
      cmd = 'explorer.exe';
      args = [uncPath];
      targetPath = uncPath;
    }

    await spawnDetached(cmd, args, { windowsHide: true });
    return { revealed: true, path: resolved, targetPath, folder: path.dirname(resolved) };
  }

  if (isMac) {
    await spawnDetached('open', ['-R', resolved]);
    return { revealed: true, path: resolved, targetPath: resolved, folder: path.dirname(resolved) };
  }

  // Plain Linux — xdg-open may not be installed; surface that instead of crashing the server.
  try {
    await spawnDetached('xdg-open', [path.dirname(resolved)]);
  } catch (err) {
    const e = new Error(`REVEAL_FAILED: ${err.message}`);
    throw e;
  }
  return { revealed: true, path: resolved, targetPath: path.dirname(resolved), folder: path.dirname(resolved) };
}

module.exports = { openFile, openWith, revealInFolder, isPathInsideRoot };
