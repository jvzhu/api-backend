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
import { healthRouter } from './routes/health.routes';
import { taskRouter } from './routes/task.routes';
import { userRouter } from './routes/user.routes';

export const createApp = () => {
  const app = express();
  const config = getConfig();

  app.use(helmet());
  app.use(cors());
  app.use(
    rateLimit({
      windowMs: config.RATE_LIMIT_WINDOW_MS,
      max: config.RATE_LIMIT_MAX,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
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
  app.use('/api/users', userRouter);
  app.use('/api/tasks', taskRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
