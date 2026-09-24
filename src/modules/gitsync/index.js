// src/modules/gitsync/index.js
const { spawn } = require('child_process');
const path = require('path');
const env = require('../../config/env');
const { scanDirectory } = require('../scanner');

/**
 * Executes `git pull` via spawn in the doc repository and triggers rescan.
 * @returns {Promise<{ status: string, output: string }>}
 */
function gitPull() {
  return new Promise((resolve, reject) => {
    const repoDir = path.resolve(env.DOC_ROOT_DIR);

    const child = spawn('git', ['pull'], { cwd: repoDir, stdio: ['ignore', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (err) => {
      reject(new Error(`Git pull spawn error: ${err.message}`));
    });

    child.on('close', async (code) => {
      if (code !== 0) {
        return reject(new Error(`Git pull failed with code ${code}: ${stderr || stdout}`));
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
