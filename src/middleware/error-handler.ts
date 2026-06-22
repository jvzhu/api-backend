import { NextFunction, Request, Response } from 'express';

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ message: 'Not Found' });
}

export function errorHandler(
  err: { status?: number; message?: string; errors?: unknown },
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const status = err.status ?? 500;
  const message = err.message ?? 'Internal Server Error';
  res.status(status).json({ message, errors: err.errors });
}
