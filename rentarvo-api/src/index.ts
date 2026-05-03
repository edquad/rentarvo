import * as Sentry from '@sentry/node';
import { app } from './app.js';
import { config } from './config/index.js';
import pino from 'pino';

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: config.nodeEnv,
    tracesSampleRate: 0.2,
  });
}

const logger = pino({ name: 'rentarvo-api' });

// Process-level error handlers — prevent silent crashes
process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled Promise Rejection — NOT crashing');
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught Exception — shutting down');
  process.exit(1);
});

app.listen(config.port, () => {
  logger.info(`🚀 Rentarvo API running on http://localhost:${config.port}`);
  logger.info(`   Environment: ${config.nodeEnv}`);
});
