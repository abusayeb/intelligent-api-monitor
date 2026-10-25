const express = require('express');
const cors = require('cors');

const requestLogger = require('./middleware/requestLogger');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const monitorRoutes = require('./routes/monitor');
const alertRoutes = require('./routes/alerts');
const { dbState } = require('./db');

const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(requestLogger);

app.get('/health', (req, res) => {
  const db = dbState();
  res.status(db === 'connected' ? 200 : 503).json({
    status: db === 'connected' ? 'ok' : 'degraded',
    db,
    uptime: Math.round(process.uptime()),
  });
});

app.use('/monitor', monitorRoutes);
app.use('/alerts', alertRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
