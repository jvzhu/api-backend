import { Router } from 'express';
import mongoose from 'mongoose';
import { requireAuth, requireRole, requireSelfOrAdmin } from '../middleware/auth';
import { cacheResponse } from '../middleware/cache';
import { validate } from '../middleware/validate';
import { Task } from '../models/Task';
import { User } from '../models/User';
import { removeUserTokens } from '../services/auth-service';
import { invalidateCache } from '../utils/cache';
import { AppError } from '../utils/app-error';
import { hashPassword } from '../utils/password';
import { createUserSchema, listUsersSchema, updateUserSchema, userIdSchema } from '../validators/users';

export const userRouter = Router();

userRouter.use(requireAuth);

userRouter.post('/', requireRole('admin'), validate(createUserSchema), async (req, res) => {
  const email = String(req.body.email);
  const existing = await User.findOne(mongoose.sanitizeFilter({ email }));
  if (existing) {
    throw new AppError('A user with that email already exists', 409);
  }

  const user = await User.create({
    ...req.body,
    email,
    password: await hashPassword(req.body.password),
  });

  res.status(201).json({ user });
});

userRouter.get('/', requireRole('admin'), validate(listUsersSchema), async (req, res) => {
  const { page, limit, search } = req.query as unknown as { page: number; limit: number; search?: string };
  const escapedSearch = search ? search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : undefined;
  const filter = escapedSearch
    ? {
        $or: [
          { name: { $regex: escapedSearch, $options: 'i' } },
          { email: { $regex: escapedSearch, $options: 'i' } },
        ],
      }
    : {};

  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    User.countDocuments(filter),
  ]);

  res.json({
    data: users,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  });
});

userRouter.get('/:id', validate(userIdSchema), requireSelfOrAdmin(), async (req, res) => {
  const userId = new mongoose.Types.ObjectId(String(req.params.id));
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  res.json({ user });
});

userRouter.put('/:id', validate(updateUserSchema), requireSelfOrAdmin(), async (req, res) => {
  const userId = new mongoose.Types.ObjectId(String(req.params.id));
  const updates = { ...req.body } as Record<string, unknown>;

  if (updates.role && req.user!.role !== 'admin') {
    throw new AppError('Only admins can change roles', 403);
  }

  if (updates.password) {
    updates.password = await hashPassword(String(updates.password));
  }

  const user = await User.findByIdAndUpdate(userId, updates, {
    returnDocument: 'after',
    runValidators: true,
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  invalidateCache((key) => key.includes(`/api/users/${req.params.id}/profile`));
  res.json({ user });
});

userRouter.delete('/:id', validate(userIdSchema), requireRole('admin'), async (req, res) => {
  const userId = String(req.params.id);
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const user = await User.findByIdAndDelete(userObjectId);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  await Task.deleteMany({ owner: userObjectId });
  await removeUserTokens(userId);
  invalidateCache((key) => key.includes(`/api/users/${userId}/`) || key.endsWith(`:${userId}`));
  res.status(204).send();
});

userRouter.get('/:id/profile', validate(userIdSchema), requireSelfOrAdmin(), cacheResponse(15_000), async (req, res) => {
  const userId = new mongoose.Types.ObjectId(String(req.params.id));
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  const [taskSummary, recentTasks] = await Promise.all([
    Task.aggregate([
      { $match: { owner: user._id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]),
    Task.find({ owner: user._id }).sort({ createdAt: -1 }).limit(5),
  ]);

  const summary = taskSummary.reduce<Record<string, number>>((acc, item) => {
    acc[item._id as string] = item.count as number;
    return acc;
  }, {});

  res.json({
    user,
    profile: {
      taskSummary: {
        pending: summary.pending ?? 0,
        ['in-progress']: summary['in-progress'] ?? 0,
        completed: summary.completed ?? 0,
      },
      recentTasks,
    },
  });
});
