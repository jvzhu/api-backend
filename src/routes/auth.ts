import { Router } from 'express';
import bcrypt from 'bcryptjs';
import createError from 'http-errors';
import { User } from '../models/User';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { loginSchema, refreshSchema, registerSchema } from '../validators/schemas';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';

export const authRouter = Router();

function tokenPair(userId: string, role: 'user' | 'admin') {
  const payload = { sub: userId, role };
  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload)
  };
}

authRouter.post('/register', validateBody(registerSchema), async (req, res, next) => {
  try {
    const { email, name, password } = req.body;
    const existing = await User.findOne({ email: String(email).toLowerCase() }).lean();
    if (existing) {
      throw createError(409, 'Email already in use');
    }

    const hash = await bcrypt.hash(String(password), 10);
    const user = await User.create({ email, name, password: hash });
    const tokens = tokenPair(user.id, user.role);
    user.refreshTokens.push(tokens.refreshToken);
    await user.save();

    res.status(201).json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      ...tokens
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/login', validateBody(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: String(email).toLowerCase() }).select('+password');
    if (!user) {
      throw createError(401, 'Invalid credentials');
    }

    const ok = await bcrypt.compare(String(password), user.password);
    if (!ok) {
      throw createError(401, 'Invalid credentials');
    }

    const tokens = tokenPair(user.id, user.role);
    user.refreshTokens.push(tokens.refreshToken);
    await user.save();

    res.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      ...tokens
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/refresh', validateBody(refreshSchema), async (req, res, next) => {
  try {
    const { refreshToken } = req.body as { refreshToken: string };
    const payload = verifyRefreshToken(refreshToken);
    const user = await User.findById(payload.sub);
    if (!user || !user.refreshTokens.includes(refreshToken)) {
      throw createError(401, 'Invalid refresh token');
    }

    const tokens = tokenPair(user.id, user.role);
    user.refreshTokens = user.refreshTokens.filter((token) => token !== refreshToken);
    user.refreshTokens.push(tokens.refreshToken);
    await user.save();

    res.json(tokens);
  } catch {
    next(createError(401, 'Invalid refresh token'));
  }
});

authRouter.post('/logout', validateBody(refreshSchema), async (req, res, next) => {
  try {
    const { refreshToken } = req.body as { refreshToken: string };
    const payload = verifyRefreshToken(refreshToken);
    await User.findByIdAndUpdate(payload.sub, { $pull: { refreshTokens: refreshToken } });
    res.status(204).send();
  } catch {
    next(createError(401, 'Invalid refresh token'));
  }
});

authRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user?.sub).lean();
    if (!user) {
      throw createError(404, 'User not found');
    }

    res.json({ id: user._id, email: user.email, name: user.name, role: user.role });
  } catch (error) {
    next(error);
  }
});
