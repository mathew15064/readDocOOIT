// src/server.js
const http = require('http');
const { cleanupOldTempFiles } = require('./modules/opener/wsl-helper');
const app = require('./app');
const { PORT } = require('./config/env');

const server = http.createServer(app);

// This app has no authentication; do not expose its file APIs on the LAN.
server.listen(PORT, '127.0.0.1', () => {
  console.log(`Server listening on port ${PORT}`);
  cleanupOldTempFiles(); // cleanup stale temp files on startup
});

// Graceful shutdown handling (optional)
process.on('SIGINT', () => {
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
