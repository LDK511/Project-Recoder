import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt.js';
import { JWTPayload, UserRole } from '../types/index.js';
import { AuthenticationError, AuthorizationError } from '../utils/errors.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JWTPayload;
      token?: string;
      requestId?: string;
    }
  }
}

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) return header.slice(7).trim() || null;
  return null;
}

/** JWT 를 검증해 req.user 를 채웁니다. 없거나 유효하지 않으면 401. */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) return next(new AuthenticationError());
  try {
    req.user = verifyToken(token);
    req.token = token;
    next();
  } catch {
    next(new AuthenticationError('로그인이 만료되었습니다. 다시 로그인해 주세요.'));
  }
}

/** 토큰이 있으면 검증하고, 없으면 그냥 통과합니다. */
export function optionalAuthenticate(req: Request, _res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (token) {
    try {
      req.user = verifyToken(token);
      req.token = token;
    } catch {
      /* 무시 */
    }
  }
  next();
}

/** authenticate 다음에 사용: 지정한 역할만 허용 */
export function authorize(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(new AuthenticationError());
    if (!allowedRoles.includes(req.user.role)) return next(new AuthorizationError());
    next();
  };
}

/** 관리자 전용 라우트용 미들웨어 체인 */
export const adminOnly = [authenticate, authorize('admin')];

export function getUserId(req: Request): number {
  if (!req.user) throw new AuthenticationError();
  return req.user.userId;
}

export function isAdmin(req: Request): boolean {
  return req.user?.role === 'admin';
}
