import { NextFunction, Request, Response } from 'express';
import createError from 'http-errors';
import { verifyAccessToken } from '../utils/jwt';
import type { UserRole } from '../models/User';

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return next(createError(401, 'Missing bearer token'));
  }

  try {
    const token = auth.slice(7);
    req.user = verifyAccessToken(token);
    return next();
  } catch {
    return next(createError(401, 'Invalid or expired token'));
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(createError(401, 'Unauthorized'));
    }

    if (!roles.includes(req.user.role)) {
      return next(createError(403, 'Forbidden'));
    }

    return next();
  };
}
