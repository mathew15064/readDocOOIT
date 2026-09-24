// src/server.js
const http = require('http');
const { cleanupOldTempFiles } = require('./modules/opener/wsl-helper');
const app = require('./app');
const { PORT } = require('./config/env');

const server = http.createServer(app);

server.listen(PORT, () => {
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
