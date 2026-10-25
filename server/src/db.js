const mongoose = require('mongoose');
const config = require('./config');
const logger = require('./utils/logger');

const STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];

mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
mongoose.connection.on('reconnected', () => logger.info('MongoDB reconnected'));

async function connectDb(uri = config.mongoUri) {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  logger.info('Connected to MongoDB');
}

function disconnectDb() {
  return mongoose.disconnect();
}

function dbState() {
  return STATES[mongoose.connection.readyState] || 'unknown';
}

module.exports = { connectDb, disconnectDb, dbState };
