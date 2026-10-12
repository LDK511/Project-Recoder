import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { AppError, formatErrorResponse, ValidationError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction): void {
  let err = error;

  // 업로드 오류를 사용자용 메시지로 변환
  if (error instanceof multer.MulterError) {
    err =
      error.code === 'LIMIT_FILE_SIZE'
        ? new ValidationError('이미지는 5MB 이하만 업로드할 수 있습니다.')
        : new ValidationError('파일 업로드 형식이 올바르지 않습니다.');
  }
  // 잘못된 JSON 본문
  if ((error as any)?.type === 'entity.parse.failed') {
    err = new ValidationError('요청 본문(JSON) 형식이 올바르지 않습니다.');
  }
  if ((error as any)?.type === 'entity.too.large') {
    err = new AppError(413, '요청 크기가 너무 큽니다.', 'PAYLOAD_TOO_LARGE');
  }

  const { status, body } = formatErrorResponse(err);
  if (status >= 500) {
    logger.error('Unhandled error', { requestId: req.requestId, method: req.method, path: req.originalUrl, error: err });
  } else {
    logger.debug('Request failed', { requestId: req.requestId, status, code: body.code, message: body.error });
  }
  if (res.headersSent) return;
  res.status(status).json({ ...body, ...(req.requestId ? { requestId: req.requestId } : {}) });
}
