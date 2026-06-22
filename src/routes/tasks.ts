import { Router } from 'express';
import createError from 'http-errors';
import { Types, isValidObjectId } from 'mongoose';
import { requireAuth } from '../middleware/auth';
import { validateBody, validateParams } from '../middleware/validate';
import { Task } from '../models/Task';
import { idParamSchema, taskCreateSchema, taskUpdateSchema } from '../validators/schemas';

export const tasksRouter = Router();

function parseTaskId(id: string): Types.ObjectId {
  if (!isValidObjectId(id)) {
    throw createError(400, 'Invalid task id');
  }
  return new Types.ObjectId(id);
}

function hasUnsafeKeys(payload: Record<string, unknown>): boolean {
  return Object.keys(payload).some((key) => key.startsWith('$') || key.includes('.'));
}

function pickAllowedTaskFields(payload: Record<string, unknown>): Record<string, unknown> {
  const allowed = new Set(['title', 'description', 'priority', 'completed']);
  return Object.fromEntries(Object.entries(payload).filter(([key]) => allowed.has(key)));
}

tasksRouter.use(requireAuth);

tasksRouter.post('/', validateBody(taskCreateSchema), async (req, res, next) => {
  try {
    const payload = req.body as Record<string, unknown>;
    if (hasUnsafeKeys(payload)) {
      throw createError(400, 'Invalid payload keys');
    }
    const task = await Task.create({ ...pickAllowedTaskFields(payload), userId: req.user?.sub });
    res.status(201).json(task);
  } catch (error) {
    next(error);
  }
});

tasksRouter.get('/', async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page ?? 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit ?? 10), 1), 100);
    const sortBy = String(req.query.sortBy ?? 'createdAt');
    const order = req.query.order === 'asc' ? 1 : -1;
    const completed = req.query.completed;

    const filter: Record<string, unknown> = { userId: req.user?.sub };
    if (completed !== undefined) {
      filter.completed = completed === 'true';
    }

    const [tasks, total] = await Promise.all([
      Task.find(filter)
        .sort({ [sortBy]: order })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Task.countDocuments(filter)
    ]);

    res.json({
      data: tasks,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    next(error);
  }
});

tasksRouter.get('/:id', validateParams(idParamSchema), async (req, res, next) => {
  try {
    const taskId = parseTaskId(String(req.params.id));
    const task = await Task.findOne({ _id: taskId, userId: req.user?.sub }).lean();
    if (!task) {
      throw createError(404, 'Task not found');
    }
    res.json(task);
  } catch (error) {
    next(error);
  }
});

tasksRouter.put('/:id', validateParams(idParamSchema), validateBody(taskUpdateSchema), async (req, res, next) => {
  try {
    const payload = req.body as Record<string, unknown>;
    if (hasUnsafeKeys(payload)) {
      throw createError(400, 'Invalid payload keys');
    }
    const updates = pickAllowedTaskFields(payload);
    const taskId = parseTaskId(String(req.params.id));
    const task = await Task.findOneAndUpdate({ _id: taskId, userId: req.user?.sub }, updates, {
      new: true,
      runValidators: true
    }).lean();

    if (!task) {
      throw createError(404, 'Task not found');
    }

    res.json(task);
  } catch (error) {
    next(error);
  }
});

tasksRouter.delete('/:id', validateParams(idParamSchema), async (req, res, next) => {
  try {
    const taskId = parseTaskId(String(req.params.id));
    const task = await Task.findOneAndDelete({ _id: taskId, userId: req.user?.sub });
    if (!task) {
      throw createError(404, 'Task not found');
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

tasksRouter.patch('/:id/complete', validateParams(idParamSchema), async (req, res, next) => {
  try {
    const taskId = parseTaskId(String(req.params.id));
    const task = await Task.findOneAndUpdate(
      { _id: taskId, userId: req.user?.sub },
      { completed: true },
      { new: true }
    ).lean();

    if (!task) {
      throw createError(404, 'Task not found');
    }

    res.json(task);
  } catch (error) {
    next(error);
  }
});
