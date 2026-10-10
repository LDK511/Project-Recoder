import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query, transaction } from '../db.js';
import { User, UserResponse, JWTPayload } from '../types.js';
import { isValidEmail, isValidPassword, isValidName, getClientIP } from '../utils/validation.js';
import { ValidationError, ConflictError, AuthError } from '../middleware/errorHandler.js';

/**
 * 비밀번호를 해시합니다.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcryptjs.genSalt(10);
  return bcryptjs.hash(password, salt);
}

/**
 * 비밀번호를 검증합니다.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcryptjs.compare(password, hash);
}

/**
 * JWT 토큰을 생성합니다.
 */
export function generateToken(user: User): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET not configured');
  }
  const payload: JWTPayload = {
    id: user.id,
    email: user.email,
    role: user.role,
  };
  return jwt.sign(payload, secret, { expiresIn: '24h' });
}

/**
 * JWT 토큰을 검증합니다.
 */
export function verifyToken(token: string): JWTPayload {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET not configured');
  }
  try {
    return jwt.verify(token, secret) as JWTPayload;
  } catch (err) {
    throw new AuthError('Invalid or expired token');
  }
}

/**
 * 사용자를 등록합니다.
 */
export async function register(
  email: string,
  password: string,
  name: string,
): Promise<{ user: UserResponse; token: string }> {
  // 입력 검증
  if (!isValidEmail(email)) {
    throw new ValidationError('Invalid email format');
  }
  if (!isValidPassword(password)) {
    throw new ValidationError('Password must be at least 8 characters');
  }
  if (!isValidName(name)) {
    throw new ValidationError('Name cannot be empty');
  }

  // 이메일 중복 확인
  const existingUser = await query<User>(
    'SELECT id FROM users WHERE email = $1',
    [email.toLowerCase()],
  );
  if (existingUser.rows.length > 0) {
    throw new ConflictError('Email already registered');
  }

  // 비밀번호 해시
  const passwordHash = await hashPassword(password);

  // 사용자 생성
  const result = await query<User>(
    `INSERT INTO users (email, password_hash, name, role, created_at, updated_at)
     VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     RETURNING id, email, name, role, created_at, updated_at`,
    [email.toLowerCase(), passwordHash, name, 'user'],
  );

  const user = result.rows[0];
  const token = generateToken(user);

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    token,
  };
}

/**
 * 로그인 시도를 기록합니다.
 */
async function recordLoginAttempt(email: string, ipAddress: string): Promise<void> {
  await query(
    `INSERT INTO login_attempts (email, ip_address, attempted_at)
     VALUES ($1, $2, CURRENT_TIMESTAMP)`,
    [email.toLowerCase(), ipAddress],
  );
}

/**
 * 최근 15분 내 로그인 시도 횟수를 확인합니다.
 */
async function getRecentLoginAttempts(email: string, ipAddress: string): Promise<number> {
  const result = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM login_attempts
     WHERE email = $1 AND ip_address = $2
     AND attempted_at > CURRENT_TIMESTAMP - INTERVAL '15 minutes'`,
    [email.toLowerCase(), ipAddress],
  );
  return parseInt(result.rows[0]?.count || '0', 10);
}

/**
 * 사용자가 로그인합니다.
 */
export async function login(
  email: string,
  password: string,
  ipAddress: string,
): Promise<{ user: UserResponse; token: string }> {
  // 입력 검증
  if (!isValidEmail(email)) {
    throw new ValidationError('Invalid email format');
  }
  if (!password || password.length === 0) {
    throw new ValidationError('Password is required');
  }

  // 로그인 시도 횟수 확인 (5회 이상이면 거부)
  const attempts = await getRecentLoginAttempts(email, ipAddress);
  if (attempts >= 5) {
    throw new AuthError('Too many login attempts. Please try again later.');
  }

  // 사용자 조회
  const result = await query<User>(
    'SELECT * FROM users WHERE email = $1',
    [email.toLowerCase()],
  );

  if (result.rows.length === 0) {
    // 로그인 시도 기록 (사용자 없음)
    await recordLoginAttempt(email, ipAddress);
    throw new AuthError('Invalid email or password');
  }

  const user = result.rows[0];

  // 비밀번호 검증
  const isPasswordValid = await verifyPassword(password, user.password_hash);
  if (!isPasswordValid) {
    // 로그인 시도 기록 (비밀번호 오류)
    await recordLoginAttempt(email, ipAddress);
    throw new AuthError('Invalid email or password');
  }

  // 토큰 생성
  const token = generateToken(user);

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    token,
  };
}

/**
 * 사용자 정보를 조회합니다.
 */
export async function getUserById(userId: number): Promise<UserResponse> {
  const result = await query<User>(
    'SELECT id, email, name, role, created_at, updated_at FROM users WHERE id = $1',
    [userId],
  );

  if (result.rows.length === 0) {
    throw new AuthError('User not found');
  }

  const user = result.rows[0];
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

/**
 * 사용자 정보를 업데이트합니다.
 */
export async function updateUser(
  userId: number,
  updates: { name?: string; email?: string },
): Promise<UserResponse> {
  const user = await query<User>(
    'SELECT * FROM users WHERE id = $1',
    [userId],
  );

  if (user.rows.length === 0) {
    throw new AuthError('User not found');
  }

  const currentUser = user.rows[0];
  const newName = updates.name || currentUser.name;
  const newEmail = updates.email || currentUser.email;

  // 이메일 변경 시 중복 확인
  if (newEmail !== currentUser.email) {
    if (!isValidEmail(newEmail)) {
      throw new ValidationError('Invalid email format');
    }
    const existing = await query<User>(
      'SELECT id FROM users WHERE email = $1 AND id != $2',
      [newEmail.toLowerCase(), userId],
    );
    if (existing.rows.length > 0) {
      throw new ConflictError('Email already in use');
    }
  }

  // 이름 검증
  if (!isValidName(newName)) {
    throw new ValidationError('Name cannot be empty');
  }

  const result = await query<User>(
    `UPDATE users SET name = $1, email = $2, updated_at = CURRENT_TIMESTAMP
     WHERE id = $3
     RETURNING id, email, name, role, created_at, updated_at`,
    [newName, newEmail.toLowerCase(), userId],
  );

  const updatedUser = result.rows[0];
  return {
    id: updatedUser.id,
    email: updatedUser.email,
    name: updatedUser.name,
    role: updatedUser.role,
  };
}

/**
 * 비밀번호를 변경합니다.
 */
export async function changePassword(
  userId: number,
  oldPassword: string,
  newPassword: string,
): Promise<void> {
  // 새 비밀번호 검증
  if (!isValidPassword(newPassword)) {
    throw new ValidationError('New password must be at least 8 characters');
  }

  // 사용자 조회
  const result = await query<User>(
    'SELECT * FROM users WHERE id = $1',
    [userId],
  );

  if (result.rows.length === 0) {
    throw new AuthError('User not found');
  }

  const user = result.rows[0];

  // 기존 비밀번호 검증
  const isPasswordValid = await verifyPassword(oldPassword, user.password_hash);
  if (!isPasswordValid) {
    throw new AuthError('Current password is incorrect');
  }

  // 새 비밀번호 해시
  const newPasswordHash = await hashPassword(newPassword);

  // 비밀번호 업데이트
  await query(
    `UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2`,
    [newPasswordHash, userId],
  );
}
