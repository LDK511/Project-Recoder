import { Request, Response, NextFunction } from 'express';

/**
 * 커스텀 에러 클래스
 */
export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * 검증 에러
 */
export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, message);
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * 인증 에러
 */
export class AuthError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(401, message);
    Object.setPrototypeOf(this, AuthError.prototype);
  }
}

/**
 * 권한 에러
 */
export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(403, message);
    Object.setPrototypeOf(this, ForbiddenError.prototype);
  }
}

/**
 * 찾을 수 없음 에러
 */
export class NotFoundError extends AppError {
  constructor(message: string = 'Not found') {
    super(404, message);
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * 충돌 에러 (예: 중복된 이메일)
 */
export class ConflictError extends AppError {
  constructor(message: string = 'Conflict') {
    super(409, message);
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

/**
 * 전역 에러 핸들러 미들웨어
 * 모든 라우트 핸들러 이후에 등록해야 합니다.
 */
export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  console.error('[error]', err);

  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  // 예상치 못한 에러
  res.status(500).json({ error: 'Internal server error' });
}

/**
 * 비동기 라우트 핸들러를 감싸서 에러를 처리합니다.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
