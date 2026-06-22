import { NextFunction, Request, Response } from 'express';
import { User } from '../models/User';
import { AppError } from '../utils/app-error';
import { verifyAccessToken } from '../utils/tokens';

export const requireAuth = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const authorization = req.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) {
      throw new AppError('Authentication required', 401);
    }

    const token = authorization.replace('Bearer ', '');
    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.sub);

    if (!user) {
      throw new AppError('User no longer exists', 401);
    }

    req.user = {
      id: String(user._id),
      email: String(user.email),
      role: user.role as 'admin' | 'user',
    };

    next();
  } catch (error) {
    next(error);
  }
};

export const requireRole = (...roles: Array<'admin' | 'user'>) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError('Authentication required', 401));
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(new AppError('Forbidden', 403));
      return;
    }

    next();
  };

export const requireSelfOrAdmin = (paramName = 'id') =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError('Authentication required', 401));
      return;
    }

    if (req.user.role === 'admin' || req.user.id === req.params[paramName]) {
      next();
      return;
    }

    next(new AppError('Forbidden', 403));
  };
