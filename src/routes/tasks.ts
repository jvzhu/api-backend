import { Router } from 'express';
import createError from 'http-errors';
import { requireAuth } from '../middleware/auth';
import { validateBody, validateParams } from '../middleware/validate';
import { Task } from '../models/Task';
import { idParamSchema, taskCreateSchema, taskUpdateSchema } from '../validators/schemas';

export const tasksRouter = Router();

tasksRouter.use(requireAuth);

tasksRouter.post('/', validateBody(taskCreateSchema), async (req, res, next) => {
  try {
    const task = await Task.create({ ...req.body, userId: req.user?.sub });
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
    const task = await Task.findOne({ _id: req.params.id, userId: req.user?.sub }).lean();
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
    const task = await Task.findOneAndUpdate({ _id: req.params.id, userId: req.user?.sub }, req.body, {
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
    const task = await Task.findOneAndDelete({ _id: req.params.id, userId: req.user?.sub });
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
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, userId: req.user?.sub },
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
