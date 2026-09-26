// src/modules/gitsync/index.js
const { spawn } = require('child_process');
const path = require('path');
const env = require('../../config/env');
const { scanDirectory } = require('../scanner');

/**
 * Builds the `git -c ...` args needed to authenticate with GIT_TOKEN, if one
 * is configured. Passed as a one-off `-c` flag on the child process's argv
 * instead of `git remote set-url` / a token-embedded URL, so the token is
 * never written to .git/config or persisted anywhere on disk.
 * Returns [] when GIT_TOKEN is unset, in which case git falls back to
 * whatever credential helper / SSH key is already configured for the repo.
 */
function buildGitAuthArgs() {
  if (!env.GIT_TOKEN) return [];
  const basicAuth = Buffer.from(`${env.GIT_USERNAME}:${env.GIT_TOKEN}`).toString('base64');
  return ['-c', `http.extraHeader=AUTHORIZATION: basic ${basicAuth}`];
}

/**
 * Executes `git pull` via spawn in the doc repository and triggers rescan.
 * Authenticates with GIT_TOKEN from the environment when present.
 * @returns {Promise<{ status: string, output: string }>}
 */
function gitPull() {
  return new Promise((resolve, reject) => {
    const repoDir = path.resolve(env.DOC_ROOT_DIR);
    const args = [...buildGitAuthArgs(), 'pull'];

    const child = spawn('git', args, {
      cwd: repoDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      // Without a token/credential helper, a private repo would otherwise
      // hang the request waiting on an interactive username/password prompt.
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    // Defense in depth: git shouldn't ever echo the auth header back, but
    // strip the token from anything that reaches an error/log just in case.
    const redact = (text) => (env.GIT_TOKEN ? text.split(env.GIT_TOKEN).join('***') : text);

    child.on('error', (err) => {
      reject(new Error(`Git pull spawn error: ${redact(err.message)}`));
    });

    child.on('close', async (code) => {
      if (code !== 0) {
        return reject(new Error(`Git pull failed with code ${code}: ${redact(stderr || stdout)}`));
      }

      // Trigger auto-rescan after git pull
      try {
        await scanDirectory(repoDir);
      } catch (scanErr) {
        console.error('Post-pull rescan error:', scanErr);
      }

      resolve({ status: 'ok', output: stdout });
    });
  });
}

module.exports = { gitPull };
