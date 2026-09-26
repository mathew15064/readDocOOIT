// scripts/scan-cli.js
// CLI equivalent of the UI's "Rescan Repo" button — scans DOC_ROOT_DIR (or an
// override passed as the first argument) and reports the result.
const env = require('../src/config/env');
const { scanDirectory } = require('../src/modules/scanner');

async function main() {
  const rootDir = process.argv[2] || env.DOC_ROOT_DIR;
  console.log(`Scanning: ${rootDir}`);

  const start = Date.now();
  const result = await scanDirectory(rootDir);
  const seconds = ((Date.now() - start) / 1000).toFixed(1);

  console.log(`Scan complete in ${seconds}s — found ${result.filesFound}, indexed ${result.filesIndexed}.`);
  if (result.errors.length > 0) {
    console.log(`${result.errors.length} error(s):`);
    result.errors.slice(0, 20).forEach((e) => console.log(`  - ${e}`));
    if (result.errors.length > 20) {
      console.log(`  ...and ${result.errors.length - 20} more`);
    }
  }
}

main().catch((err) => {
  console.error('Scan failed:', err.message);
  process.exit(1);
});
