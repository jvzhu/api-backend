import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { cacheResponse } from '../middleware/cache';
import { validate } from '../middleware/validate';
import { Task } from '../models/Task';
import { invalidateCache } from '../utils/cache';
import { AppError } from '../utils/app-error';
import { createTaskSchema, listTasksSchema, taskIdSchema, updateTaskSchema } from '../validators/tasks';

export const taskRouter = Router();

taskRouter.use(requireAuth);

taskRouter.post('/', validate(createTaskSchema), async (req, res) => {
  const task = await Task.create({
    ...req.body,
    dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
    completedAt: req.body.status === 'completed' ? new Date() : null,
    owner: req.user!.id,
  });

  invalidateCache((key) => key.includes('/api/tasks') || key.includes(`/api/users/${req.user!.id}/profile`));
  res.status(201).json({ task });
});

taskRouter.get('/', validate(listTasksSchema), cacheResponse(15_000), async (req, res) => {
  const { page, limit, status, priority, search, sortBy, order } = req.query as unknown as {
    page: number;
    limit: number;
    status?: 'pending' | 'in-progress' | 'completed';
    priority?: 'low' | 'medium' | 'high';
    search?: string;
    sortBy: 'createdAt' | 'updatedAt' | 'dueDate' | 'priority' | 'title';
    order: 'asc' | 'desc';
  };

  const filter: Record<string, unknown> = { owner: req.user!.id };
  if (status) {
    filter.status = status;
  }
  if (priority) {
    filter.priority = priority;
  }
  if (search) {
    filter.$text = { $search: search };
  }

  const [tasks, total] = await Promise.all([
    Task.find(filter)
      .sort({ [sortBy]: order === 'asc' ? 1 : -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Task.countDocuments(filter),
  ]);

  res.json({
    data: tasks,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  });
});

taskRouter.get('/:id', validate(taskIdSchema), async (req, res) => {
  const task = await Task.findOne({ _id: req.params.id, owner: req.user!.id });
  if (!task) {
    throw new AppError('Task not found', 404);
  }

  res.json({ task });
});

taskRouter.put('/:id', validate(updateTaskSchema), async (req, res) => {
  const updates = {
    ...req.body,
    ...(req.body.dueDate !== undefined ? { dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null } : {}),
    ...(req.body.status === 'completed' ? { completedAt: new Date() } : {}),
    ...(req.body.status && req.body.status !== 'completed' ? { completedAt: null } : {}),
  };

  const task = await Task.findOneAndUpdate({ _id: req.params.id, owner: req.user!.id }, updates, {
    returnDocument: 'after',
    runValidators: true,
  });

  if (!task) {
    throw new AppError('Task not found', 404);
  }

  invalidateCache((key) => key.includes('/api/tasks') || key.includes(`/api/users/${req.user!.id}/profile`));
  res.json({ task });
});

taskRouter.delete('/:id', validate(taskIdSchema), async (req, res) => {
  const task = await Task.findOneAndDelete({ _id: req.params.id, owner: req.user!.id });
  if (!task) {
    throw new AppError('Task not found', 404);
  }

  invalidateCache((key) => key.includes('/api/tasks') || key.includes(`/api/users/${req.user!.id}/profile`));
  res.status(204).send();
});

taskRouter.patch('/:id/complete', validate(taskIdSchema), async (req, res) => {
  const task = await Task.findOneAndUpdate(
    { _id: req.params.id, owner: req.user!.id },
    { status: 'completed', completedAt: new Date() },
    { returnDocument: 'after', runValidators: true },
  );

  if (!task) {
    throw new AppError('Task not found', 404);
  }

  invalidateCache((key) => key.includes('/api/tasks') || key.includes(`/api/users/${req.user!.id}/profile`));
  res.json({ task });
});
