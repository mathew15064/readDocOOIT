// tests/unit/env.test.js
import { describe, it, expect, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';

// Helper to reload env module after clearing cache
function loadEnv(envPath) {
  delete require.cache[require.resolve(envPath)];
  return require(envPath);
}

describe('Environment configuration', () => {
  const envFile = path.resolve(process.cwd(), '.env');
  const originalEnv = { ...process.env };
  let originalEnvFileContent = null;

  if (fs.existsSync(envFile)) {
    originalEnvFileContent = fs.readFileSync(envFile, 'utf-8');
  }

  afterEach(() => {
    // Restore original env
    process.env = { ...originalEnv };
    // Restore or remove .env file
    if (originalEnvFileContent !== null) {
      fs.writeFileSync(envFile, originalEnvFileContent);
    } else if (fs.existsSync(envFile)) {
      fs.unlinkSync(envFile);
    }
  });

  it('throws when required vars are missing', () => {
    // Ensure .env does not contain required vars
    fs.writeFileSync(envFile, 'PORT=3081\n');
    expect(() => loadEnv(path.resolve('src/config/env.js'))).toThrow(
      /Missing required env vars: DOC_ROOT_DIR/,
    );
  });

  it('loads correctly when all required vars are present', () => {
    fs.writeFileSync(
      envFile,
      `DOC_ROOT_DIR=${process.cwd()}/data\nPORT=3081\nEXCEL_PATH=excel\nLIBREOFFICE_PATH=libreoffice\n`,
    );
    const config = loadEnv(path.resolve('src/config/env.js'));
    expect(config.DOC_ROOT_DIR).toBe(path.resolve(process.env.DOC_ROOT_DIR));
    expect(config.PORT).toBe(3081);
  });

  it('throws when PORT is not a number', () => {
    fs.writeFileSync(envFile, `DOC_ROOT_DIR=${process.cwd()}/data\nPORT=notanumber\n`);
    expect(() => loadEnv(path.resolve('src/config/env.js'))).toThrow(
      /PORT must be a valid number/,
    );
  });
});
