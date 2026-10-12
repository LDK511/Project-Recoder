import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * async 라우트 핸들러에서 던진 오류를 Express 오류 처리기로 넘깁니다.
 * (Express 4 는 Promise 거부를 자동으로 잡지 않습니다)
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

export {
  validateEmail,
  validatePassword,
  validatePositiveInteger,
  validateNonNegativeInteger,
  validateString,
  validateQuantity,
  validateUUID,
  validatePageNumber,
  validateLimit,
  validateSortOption,
} from '../utils/validation.js';
