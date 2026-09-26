// src/config/env.js
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const required = ['DOC_ROOT_DIR', 'PORT'];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  throw new Error(`Missing required env vars: ${missing.join(', ')}`);
}

const port = parseInt(process.env.PORT, 10);
if (isNaN(port)) {
  throw new Error('PORT must be a valid number');
}

module.exports = {
  DOC_ROOT_DIR: path.resolve(process.env.DOC_ROOT_DIR),
  PORT: port,
  PLATFORM_MODE: process.env.PLATFORM_MODE || 'auto',
  // Defaults to loopback only: this app has no auth, and a route can trigger
  // `git pull` or open arbitrary files under DOC_ROOT_DIR. Set HOST=0.0.0.0
  // explicitly to expose it on the LAN.
  HOST: process.env.HOST || '127.0.0.1',
  // Optional. When set, `git pull` (POST /api/sync) authenticates with this
  // token instead of relying on whatever credential helper / SSH key is
  // already configured for the repo. GIT_USERNAME defaults to
  // 'x-access-token' (the convention for a GitHub PAT); most providers
  // accept any non-empty username alongside a PAT used as the password.
  GIT_TOKEN: process.env.GIT_TOKEN || null,
  GIT_USERNAME: process.env.GIT_USERNAME || 'x-access-token'
};
