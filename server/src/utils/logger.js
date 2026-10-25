const fs = require('fs');
const path = require('path');
const { createLogger, format, transports } = require('winston');
const config = require('../config');

const logDir = path.join(__dirname, '..', '..', 'logs');
fs.mkdirSync(logDir, { recursive: true });

const pretty = format.printf(({ timestamp, level, message, stack, ...meta }) => {
  let line = `${timestamp} ${level}: ${message}`;
  if (Object.keys(meta).length) line += ` ${JSON.stringify(meta)}`;
  if (stack) line += `\n${stack}`;
  return line;
});

const logger = createLogger({
  level: config.logLevel,
  silent: config.env === 'test',
  format: format.combine(format.timestamp(), format.errors({ stack: true })),
  transports: [
    new transports.Console({
      format: format.combine(format.colorize(), pretty),
    }),
    new transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      format: format.json(),
    }),
    new transports.File({
      filename: path.join(logDir, 'app.log'),
      format: format.json(),
      maxsize: 5 * 1024 * 1024,
      maxFiles: 3,
    }),
  ],
});

module.exports = logger;
