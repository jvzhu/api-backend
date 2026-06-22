import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import apicache from 'apicache';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import { env } from './config/env';
import { authRouter } from './routes/auth';
import { usersRouter } from './routes/users';
import { tasksRouter } from './routes/tasks';
import { healthRouter } from './routes/health';
import { errorHandler, notFoundHandler } from './middleware/error-handler';

const cache = apicache.options({
  appendKey: (req: Request, _res: Response) => String(req.headers.authorization ?? req.ip ?? '')
}).middleware;
const swaggerDocument = YAML.load('./docs/openapi.yaml');

export const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));
app.use(
  rateLimit({
    windowMs: env.rateLimitWindowMs,
    max: env.rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false
  })
);

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use(healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/users', cache('30 seconds'), usersRouter);
app.use('/api/tasks', cache('30 seconds'), tasksRouter);

app.use(notFoundHandler);
app.use(errorHandler);
