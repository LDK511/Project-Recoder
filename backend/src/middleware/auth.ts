import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWTPayload, UserResponse } from '../types.js';

/**
 * 요청에 JWT 토큰을 검증하고 사용자 정보를 추가합니다.
 * Authorization: Bearer <token> 형식을 기대합니다.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.slice(7);
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    res.status(500).json({ error: 'JWT_SECRET not configured' });
    return;
  }

  try {
    const payload = jwt.verify(token, secret) as JWTPayload;
    (req as any).user = payload;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * 요청에서 사용자 정보를 가져옵니다.
 * authMiddleware 이후에만 사용 가능합니다.
 */
export function getUser(req: Request): JWTPayload {
  return (req as any).user as JWTPayload;
}

/**
 * 관리자 권한을 확인합니다.
 * authMiddleware 이후에 사용해야 합니다.
 */
export function adminMiddleware(req: Request, res: Response, next: NextFunction): void {
  const user = (req as any).user as JWTPayload | undefined;
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (user.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden: Admin access required' });
    return;
  }
  next();
}
