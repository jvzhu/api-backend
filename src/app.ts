import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import { getConfig } from './config/env';
import { logger } from './config/logger';
import { swaggerDocument } from './docs/swagger';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { authRouter } from './routes/auth.routes';
import { bookRouter } from './routes/book.routes';
import { booksRouter } from './routes/books.routes';
import { healthRouter } from './routes/health.routes';
import { payoutRouter } from './routes/payout.routes';
import { royaltyRouter } from './routes/royalty.routes';
import { stripeConnectRouter } from './routes/stripe-connect.routes';
import { stripeWebhookRouter } from './routes/stripe-webhook.routes';
import { taskRouter } from './routes/task.routes';
import { userRouter } from './routes/user.routes';

export const createApp = () => {
  const app = express();
  const config = getConfig();
  const stripeWebhookRateLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use(helmet());
  app.use(cors());

  // Stripe webhook must receive the raw body — only apply raw parsing to this specific path.
  // Mount it before the global limiter, but keep a generous route-specific cap in place.
  app.use('/api/stripe/webhooks', stripeWebhookRateLimit, express.raw({ type: 'application/json' }), stripeWebhookRouter);

  app.use(
    rateLimit({
      windowMs: config.RATE_LIMIT_WINDOW_MS,
      max: config.RATE_LIMIT_MAX,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  app.use(express.json({ limit: '1mb' }));
  // Also support text/csv bodies for the royalties import endpoint
  app.use(express.text({ type: 'text/csv', limit: '2mb' }));
  app.use(
    morgan('combined', {
      stream: {
        write: (message) => logger.http(message.trim()),
      },
    }),
  );

  app.use('/health', healthRouter);
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  app.get('/docs.json', (_req, res) => res.json(swaggerDocument));
  app.use('/api/auth', authRouter);
  app.use('/api/books', booksRouter);
  app.use('/api/users', userRouter);
  app.use('/api/tasks', taskRouter);
  app.use('/api/stripe/connect', stripeConnectRouter);
  app.use('/api/royalties', royaltyRouter);
  app.use('/api/payouts', payoutRouter);
  app.use('/books', bookRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
