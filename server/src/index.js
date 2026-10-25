const app = require('./app');
const config = require('./config');
const logger = require('./utils/logger');
const { connectDb, disconnectDb } = require('./db');

let server;

async function start() {
  try {
    await connectDb();
  } catch (err) {
    logger.error(`Could not connect to MongoDB: ${err.message}`);
    process.exit(1);
  }

  server = app.listen(config.port, () => {
    logger.info(`Server listening on port ${config.port} (${config.env})`);
  });
}

function shutdown(signal) {
  logger.info(`${signal} received, shutting down`);
  // don't hang forever if a connection refuses to close
  setTimeout(() => process.exit(1), 10000).unref();

  server.close(async () => {
    await disconnectDb();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason: String(reason) });
});

start();
