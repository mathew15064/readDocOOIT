// src/middleware/error-handler.js
module.exports = (err, req, res, next) => {
  // Log the error (could use pino logger if desired)
  console.error(err);
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  res.status(status).json({ error: message });
};
