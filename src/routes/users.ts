import { Router } from 'express';
import bcrypt from 'bcryptjs';
import createError from 'http-errors';
import { User } from '../models/User';
import { requireAuth, requireRole } from '../middleware/auth';
import { validateBody, validateParams } from '../middleware/validate';
import { idParamSchema, userCreateSchema, userUpdateSchema } from '../validators/schemas';
import { Task } from '../models/Task';

export const usersRouter = Router();

usersRouter.use(requireAuth);

usersRouter.post('/', requireRole('admin'), validateBody(userCreateSchema), async (req, res, next) => {
  try {
    const { email, name, password, role } = req.body;
    const existing = await User.findOne({ email: String(email).toLowerCase() }).lean();
    if (existing) {
      throw createError(409, 'Email already in use');
    }

    const hash = await bcrypt.hash(String(password), 10);
    const user = await User.create({ email, name, password: hash, role: role ?? 'user' });
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
    if (req.user?.role !== 'admin' && req.user?.sub !== req.params.id) {
      throw createError(403, 'Forbidden');
    }

    const user = await User.findById(req.params.id, { password: 0, refreshTokens: 0 }).lean();
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
    if (req.user?.role !== 'admin' && req.user?.sub !== req.params.id) {
      throw createError(403, 'Forbidden');
    }

    const updates = req.body as { name?: string; email?: string; role?: 'user' | 'admin' };
    if (req.user?.role !== 'admin') {
      delete updates.role;
    }

    const user = await User.findByIdAndUpdate(req.params.id, updates, {
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
    const user = await User.findByIdAndDelete(req.params.id);
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
    if (req.user?.role !== 'admin' && req.user?.sub !== req.params.id) {
      throw createError(403, 'Forbidden');
    }

    const user = await User.findById(req.params.id, { password: 0, refreshTokens: 0 }).lean();
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
