import { z } from 'zod';
import { objectIdSchema, paginationQuerySchema } from './common';

const taskBody = {
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(500).optional(),
  status: z.enum(['pending', 'in-progress', 'completed']).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  dueDate: z.string().datetime().optional(),
};

export const createTaskSchema = z.object({
  body: z.object(taskBody),
  params: z.object({}),
  query: z.object({}),
});

export const updateTaskSchema = z.object({
  body: z
    .object({
      title: z.string().trim().min(1).max(160).optional(),
      description: z.string().trim().max(500).optional(),
      status: z.enum(['pending', 'in-progress', 'completed']).optional(),
      priority: z.enum(['low', 'medium', 'high']).optional(),
      dueDate: z.string().datetime().nullable().optional(),
    })
    .refine((value) => Object.keys(value).length > 0, 'At least one field must be provided'),
  params: z.object({
    id: objectIdSchema,
  }),
  query: z.object({}),
});

export const taskIdSchema = z.object({
  body: z.object({}),
  params: z.object({
    id: objectIdSchema,
  }),
  query: z.object({}),
});

export const listTasksSchema = z.object({
  body: z.object({}),
  params: z.object({}),
  query: paginationQuerySchema.extend({
    status: z.enum(['pending', 'in-progress', 'completed']).optional(),
    priority: z.enum(['low', 'medium', 'high']).optional(),
    search: z.string().trim().max(100).optional(),
    sortBy: z.enum(['createdAt', 'updatedAt', 'dueDate', 'priority', 'title']).default('createdAt'),
    order: z.enum(['asc', 'desc']).default('desc'),
  }),
});
