// src/middleware/same-origin.js
//
// This app has no authentication and several endpoints trigger real side
// effects (git pull, launching desktop apps, filesystem scans). Some of
// those routes are reachable from a browser via a "simple" cross-origin
// fetch (no custom headers), which the browser will send even though the
// page can't read the response — a classic CSRF vector against whatever is
// running on localhost. Block state-changing requests whose Origin header
// doesn't match this server's own Host. Requests with no Origin header
// (curl, same-site navigations, server-to-server calls) are allowed through,
// since browsers always attach Origin to cross-origin fetch/XHR.
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

module.exports = function sameOrigin(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();

  const origin = req.get('origin');
  if (!origin) return next();

  try {
    const originHost = new URL(origin).host;
    if (originHost === req.get('host')) return next();
  } catch (e) {
    // Malformed Origin header — fall through to reject.
  }

  return res.status(403).json({ error: 'Cross-origin requests are not allowed' });
};
