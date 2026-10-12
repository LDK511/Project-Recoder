import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

/** 요청마다 ID 를 붙이고(X-Request-Id), 완료 시 상태코드·소요시간을 남깁니다. */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers['x-request-id'];
  req.requestId = typeof incoming === 'string' && incoming.length <= 64 ? incoming : randomUUID();
  res.setHeader('X-Request-Id', req.requestId);

  const start = process.hrtime.bigint();
  res.on('finish', () => {
    // 정적 파일·헬스체크는 소음이 많아 debug 로만 남깁니다.
    const quiet = !req.originalUrl.startsWith('/api') || req.originalUrl.startsWith('/api/health');
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const meta = {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl.split('?')[0],
      status: res.statusCode,
      durationMs: Math.round(durationMs),
      userId: req.user?.userId,
    };
    if (quiet) logger.debug('request', meta);
    else logger.info('request', meta);
  });
  next();
}
