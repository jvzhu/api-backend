import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { User } from '../models/User';
import { loginUser, refreshUserTokens, registerUser, revokeRefreshToken } from '../services/auth-service';
import { loginSchema, refreshTokenSchema, registerSchema } from '../validators/auth';

export const authRouter = Router();

authRouter.post('/register', validate(registerSchema), async (req, res) => {
  const result = await registerUser(req.body);
  res.status(201).json(result);
});

authRouter.post('/login', validate(loginSchema), async (req, res) => {
  const result = await loginUser(req.body);
  res.json(result);
});

authRouter.post('/refresh', validate(refreshTokenSchema), async (req, res) => {
  const result = await refreshUserTokens(req.body.refreshToken);
  res.json(result);
});

authRouter.post('/logout', requireAuth, validate(refreshTokenSchema), async (req, res) => {
  await revokeRefreshToken(req.body.refreshToken);
  res.status(204).send();
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.user!.id);
  res.json({ user });
});
