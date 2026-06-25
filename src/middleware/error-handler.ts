import { NextFunction, Request, Response } from 'express';

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ message: 'Not Found' });
}

export function errorHandler(
  err: { status?: number; message?: string; errors?: unknown; code?: number; name?: string },
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const anyErr = err as { status?: number; message?: string; errors?: unknown; code?: number; name?: string };

  let status = anyErr.status ?? 500;
  let message = anyErr.message ?? 'Internal Server Error';

  if (anyErr.name === 'MongoServerError' && anyErr.code === 11000) {
    status = 409;
    message = 'Duplicate key';
  } else if (anyErr.name === 'CastError') {
    status = 400;
    message = 'Invalid request parameter';
  }

  res.status(status).json({ message, errors: anyErr.errors });
}
