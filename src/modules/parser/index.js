// src/modules/parser/index.js
/**
 * Parse a document filename to extract version and date information.
 * Expected pattern: <any>_V<versionNum>_<yyyymmdd>.<ext>
 *   e.g., "Design_V12_20230101.pdf"
 * Returns an object with:
 *   - version_num: number | null
 *   - version_date: string | null (YYYYMMDD)
 *   - base_name: string (filename without version/date and extension)
 *   - file_ext: string (extension without dot)
 *   - doc_type: string | null (placeholder for future classification)
 */
function parseFilename(fileName) {
  const extMatch = fileName.match(/\.([^.]+)$/);
  const file_ext = extMatch ? extMatch[1] : '';
  const nameWithoutExt = extMatch ? fileName.slice(0, -file_ext.length - 1) : fileName;

  // Regex to capture version and date: look for _V<number>_<yyyymmdd>
  const versionRegex = /_V(\d+)_?(\d{8})?/i;
  const match = nameWithoutExt.match(versionRegex);

  let version_num = null;
  let version_date = null;
  let base_name = nameWithoutExt;

  if (match) {
    version_num = parseInt(match[1], 10);
    version_date = match[2] || null;
    // Remove the version part from the base name
    base_name = nameWithoutExt.replace(versionRegex, '').replace(/[_-]+$/g, '');
  }

  return {
    version_num,
    version_date,
    base_name,
    file_ext,
    doc_type: null, // To be determined by future logic
  };
}

module.exports = { parseFilename };
