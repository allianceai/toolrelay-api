import winston from 'winston';

const { combine, timestamp, errors, json, colorize, simple } = winston.format;

const isProd = process.env.NODE_ENV === 'production';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    timestamp(),
    errors({ stack: true }),
    isProd ? json() : combine(colorize(), simple())
  ),
  transports: [new winston.transports.Console()],
});
