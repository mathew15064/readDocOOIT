// src/modules/gitsync/index.js
const { spawn } = require('child_process');
const path = require('path');
const env = require('../../config/env');
const { scanDirectory } = require('../scanner');

const GIT_TIMEOUT_MS = 60_000;
let pendingSync = null;

function runGit(args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      finish(new Error('Git sync timed out after 60 seconds'));
    }, GIT_TIMEOUT_MS);

    function finish(error, output) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(output);
    }

    child.stdout.on('data', chunk => { stdout += chunk.toString(); });
    child.stderr.on('data', chunk => { stderr += chunk.toString(); });
    child.on('error', err => finish(new Error(`Git could not start: ${err.message}`)));
    child.on('close', code => {
      if (code !== 0) {
        finish(new Error(`Git ${args.join(' ')} failed (exit ${code}): ${(stderr || stdout).trim()}`));
      } else {
        finish(null, stdout.trim());
      }
    });
  });
}

async function syncOnce() {
  const repoDir = path.resolve(env.DOC_ROOT_DIR);
  const before = await runGit(['rev-parse', 'HEAD'], repoDir);
  const output = await runGit(['pull', '--ff-only'], repoDir);
  const after = await runGit(['rev-parse', 'HEAD'], repoDir);

  if (before === after) {
    return { status: 'ok', changed: false, scanStatus: 'skipped', output: output || 'Already up to date.' };
  }

  const result = await scanDirectory(repoDir);
  if (result.errors && result.errors.length) {
    return {
      status: 'partial',
      changed: true,
      scanStatus: 'completed_with_errors',
      filesIndexed: result.filesIndexed,
      errors: result.errors.slice(0, 10),
      output
    };
  }
  return { status: 'ok', changed: true, scanStatus: 'completed', filesIndexed: result.filesIndexed, output };
}

function gitPull() {
  if (pendingSync) return pendingSync;
  pendingSync = syncOnce().finally(() => { pendingSync = null; });
  return pendingSync;
}

module.exports = { gitPull };
