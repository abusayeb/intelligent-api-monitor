const express = require('express');
const cors = require('cors');

const requestLogger = require('./middleware/requestLogger');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const monitorRoutes = require('./routes/monitor');

const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(requestLogger);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: Math.round(process.uptime()) });
});

app.use('/monitor', monitorRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
