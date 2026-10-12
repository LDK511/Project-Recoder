import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

const skipInUnitTests = () => process.env.NODE_ENV === 'test' && process.env.RATE_LIMIT_DISABLED === 'true';

function handler(message: string) {
  return (_req: Request, res: Response) => {
    res.status(429).json({ error: message, code: 'RATE_LIMIT_EXCEEDED' });
  };
}

/** 로그인: 같은 IP 에서 15분 동안 '실패' 10회까지 (성공한 로그인은 세지 않음) */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: skipInUnitTests,
  handler: handler('로그인 시도가 너무 많습니다. 15분 후 다시 시도해 주세요.'),
});

/** 회원가입: 같은 IP 에서 1시간 동안 10회 */
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: skipInUnitTests,
  handler: handler('가입 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.'),
});

/** 일반 API: 같은 IP 에서 1분 동안 300회 */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: skipInUnitTests,
  handler: handler('요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.'),
});

export function createRateLimiter(windowMs: number, limit: number, message = '요청이 너무 많습니다.') {
  return rateLimit({ windowMs, limit, standardHeaders: 'draft-7', legacyHeaders: false, skip: skipInUnitTests, handler: handler(message) });
}
