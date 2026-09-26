// src/app.js
const express = require('express');
const path = require('path');
const logger = require('./middleware/request-logger');
const sameOrigin = require('./middleware/same-origin');
const openerRouter = require('./modules/opener/opener.routes');
const errorHandler = require('./middleware/error-handler');


const searchRouter = require('./routes/search');
const bookmarkRouter = require('./routes/bookmark');
const scanRouter = require('./routes/scan');
const syncRouter = require('./routes/sync');
const tagsRouter = require('./routes/tags');
const previewRouter = require('./routes/preview');

const app = express();

app.use(express.json());
app.use(logger);
app.use('/api', sameOrigin);

// Health endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Register API routes
app.use('/api', openerRouter);
app.use('/api', searchRouter);
app.use('/api', bookmarkRouter);
app.use('/api', scanRouter);
app.use('/api', syncRouter);
app.use('/api', tagsRouter);
app.use('/api', previewRouter);

// Serve static front-end files
app.use(express.static(path.join(__dirname, '../public')));

// Error handling (must be after routes)
app.use(errorHandler);

module.exports = app;
