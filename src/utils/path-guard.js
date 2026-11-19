const fs = require('fs').promises;
const path = require('path');

function isOutsideRoot(root, target) {
  const relative = path.relative(root, target);
  return relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative);
}

/**
 * Check both the requested path and its real target so sibling-prefix paths
 * and symlinks cannot escape the configured document directory.
 */
async function resolveWithinRoot(targetPath, rootDir) {
  const root = path.resolve(rootDir);
  const target = path.resolve(targetPath);
  if (isOutsideRoot(root, target)) {
    throw new Error('PATH_OUTSIDE_ROOT');
  }

  const [realRoot, realTarget] = await Promise.all([fs.realpath(root), fs.realpath(target)]);
  if (isOutsideRoot(realRoot, realTarget)) {
    throw new Error('PATH_OUTSIDE_ROOT');
  }
  return target;
}

module.exports = { resolveWithinRoot };
