import { Router } from 'express';
import bcrypt from 'bcryptjs';
import createError from 'http-errors';
import { Types, isValidObjectId } from 'mongoose';
import { User } from '../models/User';
import { requireAuth, requireRole } from '../middleware/auth';
import { validateBody, validateParams } from '../middleware/validate';
import { idParamSchema, userCreateSchema, userUpdateSchema } from '../validators/schemas';
import { Task } from '../models/Task';

export const usersRouter = Router();

function parseUserId(id: string): Types.ObjectId {
  if (!isValidObjectId(id)) {
    throw createError(400, 'Invalid user id');
  }
  return new Types.ObjectId(id);
}

function hasUnsafeKeys(payload: Record<string, unknown>): boolean {
  return Object.keys(payload).some((key) => key.startsWith('$') || key.includes('.'));
}

function pickAllowedUserFields(payload: Record<string, unknown>): Record<string, unknown> {
  const allowed = new Set(['name', 'email', 'role']);
  return Object.fromEntries(Object.entries(payload).filter(([key]) => allowed.has(key)));
}

usersRouter.use(requireAuth);

usersRouter.post('/', requireRole('admin'), validateBody(userCreateSchema), async (req, res, next) => {
  try {
    const payload = req.body as Record<string, unknown>;
    if (hasUnsafeKeys(payload)) {
      throw createError(400, 'Invalid payload keys');
    }
    const email = String(payload.email).toLowerCase();
    const name = String(payload.name);
    const password = String(payload.password);
    const role = payload.role === 'admin' ? 'admin' : 'user';
    const existing = await User.findOne({ email }).lean();
    if (existing) {
      throw createError(409, 'Email already in use');
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ email, name, password: hash, role });
    res.status(201).json({ id: user.id, email: user.email, name: user.name, role: user.role });
  } catch (error) {
    next(error);
  }
});

usersRouter.get('/', requireRole('admin'), async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page ?? 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit ?? 10), 1), 100);
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find({}, { password: 0, refreshTokens: 0 }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      User.countDocuments()
    ]);

    res.json({
      data: users,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    next(error);
  }
});

usersRouter.get('/:id', validateParams(idParamSchema), async (req, res, next) => {
  try {
    const userId = parseUserId(String(req.params.id));
    if (req.user?.role !== 'admin' && req.user?.sub !== req.params.id) {
      throw createError(403, 'Forbidden');
    }

    const user = await User.findById(userId, { password: 0, refreshTokens: 0 }).lean();
    if (!user) {
      throw createError(404, 'User not found');
    }

    res.json(user);
  } catch (error) {
    next(error);
  }
});

usersRouter.put('/:id', validateParams(idParamSchema), validateBody(userUpdateSchema), async (req, res, next) => {
  try {
    const payload = req.body as Record<string, unknown>;
    if (hasUnsafeKeys(payload)) {
      throw createError(400, 'Invalid payload keys');
    }
    const userId = parseUserId(String(req.params.id));
    if (req.user?.role !== 'admin' && req.user?.sub !== req.params.id) {
      throw createError(403, 'Forbidden');
    }

    const updates = pickAllowedUserFields(payload) as { name?: string; email?: string; role?: 'user' | 'admin' };
    if (req.user?.role !== 'admin') {
      delete updates.role;
    }

    const user = await User.findByIdAndUpdate(userId, updates, {
      new: true,
      runValidators: true,
      projection: { password: 0, refreshTokens: 0 }
    }).lean();

    if (!user) {
      throw createError(404, 'User not found');
    }

    res.json(user);
  } catch (error) {
    next(error);
  }
});

usersRouter.delete('/:id', requireRole('admin'), validateParams(idParamSchema), async (req, res, next) => {
  try {
    const userId = parseUserId(String(req.params.id));
    const user = await User.findByIdAndDelete(userId);
    if (!user) {
      throw createError(404, 'User not found');
    }
    await Task.deleteMany({ userId: user._id });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

usersRouter.get('/:id/profile', validateParams(idParamSchema), async (req, res, next) => {
  try {
    const userId = parseUserId(String(req.params.id));
    if (req.user?.role !== 'admin' && req.user?.sub !== req.params.id) {
      throw createError(403, 'Forbidden');
    }

    const user = await User.findById(userId, { password: 0, refreshTokens: 0 }).lean();
    if (!user) {
      throw createError(404, 'User not found');
    }

    const [taskCount, completedTaskCount] = await Promise.all([
      Task.countDocuments({ userId: user._id }),
      Task.countDocuments({ userId: user._id, completed: true })
    ]);

    res.json({
      ...user,
      profile: {
        taskCount,
        completedTaskCount,
        completionRate: taskCount ? Number((completedTaskCount / taskCount).toFixed(2)) : 0
      }
    });
  } catch (error) {
    next(error);
  }
});
