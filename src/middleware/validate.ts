import { NextFunction, Request, Response } from 'express';
import createError from 'http-errors';

type PrimitiveType = 'string' | 'boolean' | 'number';

type Rule = {
  type: PrimitiveType;
  required?: boolean;
  enum?: Array<string | number | boolean>;
};

type Schema = Record<string, Rule>;

function validateObject(source: Record<string, unknown>, schema: Schema): string[] {
  const errors: string[] = [];
  for (const [key, rule] of Object.entries(schema)) {
    const value = source[key];
    const isEmptyString = typeof value === 'string' && value.trim() === '';
    if (rule.required && (value === undefined || value === null || isEmptyString)) {
      errors.push(`${key} is required`);
      continue;
    }

    if (value === undefined || value === null) {
      continue;
    }

    if (typeof value !== rule.type) {
      errors.push(`${key} must be a ${rule.type}`);
      continue;
    }

    if (rule.enum && !rule.enum.includes(value as never)) {
      errors.push(`${key} must be one of: ${rule.enum.join(', ')}`);
    }
  }
  return errors;
}

export function validateBody(schema: Schema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const errors = validateObject(req.body as Record<string, unknown>, schema);
    if (errors.length > 0) {
      return next(createError(400, 'Validation failed', { errors }));
    }
    return next();
  };
}

export function validateParams(schema: Schema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const errors = validateObject(req.params as Record<string, unknown>, schema);
    if (errors.length > 0) {
      return next(createError(400, 'Validation failed', { errors }));
    }
    return next();
  };
}
