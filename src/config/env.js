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
  PLATFORM_MODE: process.env.PLATFORM_MODE || 'auto'
};
