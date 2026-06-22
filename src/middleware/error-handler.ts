import { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { logger } from '../config/logger';
import { AppError } from '../utils/app-error';

export const notFoundHandler = (req: Request, _res: Response, next: NextFunction): void => {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
};

export const errorHandler = (error: unknown, _req: Request, res: Response, _next: NextFunction): void => {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    });
    return;
  }

  if (error instanceof mongoose.Error.ValidationError) {
    res.status(400).json({ message: 'Database validation failed', details: error.errors });
    return;
  }

  if (error instanceof mongoose.Error.CastError) {
    res.status(400).json({ message: 'Invalid identifier provided' });
    return;
  }

  if ((error as { code?: number })?.code === 11000) {
    res.status(409).json({ message: 'Resource already exists' });
    return;
  }

  if (error instanceof TokenExpiredError || error instanceof JsonWebTokenError) {
    res.status(401).json({ message: 'Invalid or expired token' });
    return;
  }

  logger.error('Unhandled error', error);
  res.status(500).json({ message: 'Internal server error' });
};
