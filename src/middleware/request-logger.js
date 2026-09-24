// src/middleware/request-logger.js
const pino = require('pino');
const pinoHttp = require('pino-http');

const logger = pino({ level: 'info' });

module.exports = pinoHttp({ logger });
