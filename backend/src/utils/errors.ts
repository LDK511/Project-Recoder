/**
 * 애플리케이션 오류 클래스.
 * 모든 API 오류 응답은 { error: "사용자에게 보여줄 메시지", code: "MACHINE_CODE", details? } 형태입니다.
 */

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, message: string, code = 'APP_ERROR', details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message = '입력값을 확인해 주세요.', details?: unknown) {
    super(400, message, 'VALIDATION_ERROR', details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message = '로그인이 필요합니다.') {
    super(401, message, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends AppError {
  constructor(message = '접근 권한이 없습니다.') {
    super(403, message, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(message = '요청한 정보를 찾을 수 없습니다.') {
    super(404, message, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message: string, code = 'CONFLICT', details?: unknown) {
    super(409, message, code, details);
  }
}

export class RateLimitError extends AppError {
  constructor(message = '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.') {
    super(429, message, 'RATE_LIMIT_EXCEEDED');
  }
}

export class PaymentError extends AppError {
  constructor(message = '결제 처리 중 문제가 발생했습니다.') {
    super(502, message, 'PAYMENT_ERROR');
  }
}

export interface ErrorResponse {
  error: string;
  code: string;
  details?: unknown;
}

export function formatErrorResponse(error: unknown): { status: number; body: ErrorResponse } {
  if (error instanceof AppError) {
    return {
      status: error.statusCode,
      body: {
        error: error.message,
        code: error.code,
        ...(error.details !== undefined ? { details: error.details } : {}),
      },
    };
  }
  return {
    status: 500,
    body: { error: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.', code: 'INTERNAL_SERVER_ERROR' },
  };
}
