import { Router, Request, Response } from 'express';
import { authMiddleware, getUser } from '../middleware/auth.js';
import { asyncHandler, ValidationError, ConflictError } from '../middleware/errorHandler.js';
import { isValidEmail, isValidPassword, isValidName, getClientIP, normalizePageNumber } from '../utils/validation.js';
import { hashPassword, verifyPassword, generateToken } from '../services/auth.js';
import { query } from '../db.js';
import { User, UserResponse } from '../types.js';

const router = Router();

const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_ATTEMPTS = 5;

/**
 * 로그인 시도 기록을 정리합니다 (15분 이상 된 기록 삭제).
 */
async function cleanupLoginAttempts(): Promise<void> {
  const cutoffTime = new Date(Date.now() - RATE_LIMIT_WINDOW);
  await query(
    'DELETE FROM login_attempts WHERE attempted_at < $1',
    [cutoffTime.toISOString()],
  );
}

/**
 * 특정 IP의 최근 로그인 시도 횟수를 가져옵니다.
 */
async function getLoginAttemptCount(ip: string): Promise<number> {
  await cleanupLoginAttempts();
  const result = await query(
    'SELECT COUNT(*) as count FROM login_attempts WHERE ip_address = $1 AND attempted_at > $2',
    [ip, new Date(Date.now() - RATE_LIMIT_WINDOW).toISOString()],
  );
  return parseInt(result.rows[0]?.count || '0', 10);
}

/**
 * 로그인 시도를 기록합니다.
 */
async function recordLoginAttempt(email: string, ip: string): Promise<void> {
  await query(
    'INSERT INTO login_attempts (email, ip_address, attempted_at) VALUES ($1, $2, CURRENT_TIMESTAMP)',
    [email, ip],
  );
}

/**
 * POST /api/auth/register
 * 사용자 회원가입
 */
router.post(
  '/register',
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password, name } = req.body;

    // 입력 검증
    if (!email || !isValidEmail(email)) {
      throw new ValidationError('유효한 이메일을 입력하세요');
    }
    if (!password || !isValidPassword(password)) {
      throw new ValidationError('비밀번호는 최소 8자 이상이어야 합니다');
    }
    if (!name || !isValidName(name)) {
      throw new ValidationError('이름을 입력하세요');
    }

    // 이메일 중복 확인
    const existingUser = await query<User>(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()],
    );
    if (existingUser.rows.length > 0) {
      throw new ConflictError('이미 가입된 이메일입니다');
    }

    // 비밀번호 해싱
    const passwordHash = await hashPassword(password);

    // 사용자 생성
    const result = await query<User>(
      `INSERT INTO users (email, password_hash, name, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id, email, name, role, created_at, updated_at`,
      [email.toLowerCase(), passwordHash, name, 'user'],
    );

    const user = result.rows[0];
    const token = generateToken({ id: user.id, email: user.email, role: user.role });

    res.status(201).json({
      id: user.id,
      email: user.email,
      name: user.name,
      token,
    });
  }),
);

/**
 * POST /api/auth/login
 * 사용자 로그인
 */
router.post(
  '/login',
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const clientIP = getClientIP(req);

    // 입력 검증
    if (!email || !password) {
      throw new ValidationError('이메일과 비밀번호를 입력하세요');
    }

    // 레이트 제한 확인
    const attemptCount = await getLoginAttemptCount(clientIP);
    if (attemptCount >= RATE_LIMIT_MAX_ATTEMPTS) {
      throw new ValidationError('너무 많은 로그인 시도가 있었습니다. 15분 후 다시 시도하세요');
    }

    // 사용자 조회
    const result = await query<User>(
      'SELECT id, email, password_hash, name, role FROM users WHERE email = $1',
      [email.toLowerCase()],
    );

    if (result.rows.length === 0) {
      // 로그인 시도 기록
      await recordLoginAttempt(email, clientIP);
      // 일반화된 오류 응답
      throw new ValidationError('이메일 또는 비밀번호가 올바르지 않습니다');
    }

    const user = result.rows[0];

    // 비밀번호 검증
    const isPasswordValid = await verifyPassword(password, user.password_hash);
    if (!isPasswordValid) {
      // 로그인 시도 기록
      await recordLoginAttempt(email, clientIP);
      // 일반화된 오류 응답
      throw new ValidationError('이메일 또는 비밀번호가 올바르지 않습니다');
    }

    // 토큰 생성
    const token = generateToken({ id: user.id, email: user.email, role: user.role });

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      token,
    });
  }),
);

/**
 * GET /api/auth/me
 * 현재 사용자 정보 조회
 */
router.get(
  '/me',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const user = getUser(req);

    const result = await query<User>(
      'SELECT id, email, name, role FROM users WHERE id = $1',
      [user.id],
    );

    if (result.rows.length === 0) {
      throw new ValidationError('사용자를 찾을 수 없습니다');
    }

    const userData = result.rows[0];
    res.json({
      id: userData.id,
      email: userData.email,
      name: userData.name,
      role: userData.role,
    });
  }),
);

export default router;
