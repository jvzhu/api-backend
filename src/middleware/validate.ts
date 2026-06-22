import { NextFunction, Request, Response } from 'express';
import { ZodError, ZodTypeAny } from 'zod';
import { AppError } from '../utils/app-error';

export const validate = (schema: ZodTypeAny) => (req: Request, _res: Response, next: NextFunction): void => {
  try {
    const parsed = schema.parse({
      body: req.body ?? {},
      params: req.params ?? {},
      query: req.query ?? {},
    }) as {
      body: Request['body'];
      params: Request['params'];
      query: Request['query'];
    };

    req.body = parsed.body;
    Object.assign(req.params, parsed.params);
    Object.assign(req.query, parsed.query);
    next();
  } catch (error) {
    if (error instanceof ZodError) {
      next(new AppError('Validation failed', 400, error.flatten()));
      return;
    }

    next(error);
  }
};
