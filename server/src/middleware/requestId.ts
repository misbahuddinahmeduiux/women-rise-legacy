import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export function requestId(req: Request, res: Response, next: NextFunction) {
  const id = String(req.header('x-request-id') || randomUUID());
  req.requestId = id;
  res.setHeader('x-request-id', id);
  next();
}
