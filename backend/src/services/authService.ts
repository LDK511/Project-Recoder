import bcryptjs from 'bcryptjs';
import { query } from '../config/database.js';
import { AuthResponse, PublicUser } from '../types/index.js';
import { generateToken } from '../utils/jwt.js';
import { validateEmail, validatePassword, validateString } from '../utils/validation.js';
import { ValidationError, AuthenticationError, ConflictError, NotFoundError } from '../utils/errors.js';

const BCRYPT_ROUNDS = 12;
// 존재하지 않는 계정에도 같은 시간만큼 bcrypt 비교를 해서, 응답 시간으로 가입 여부를 추측하지 못하게 합니다.
const DUMMY_HASH = bcryptjs.hashSync('timing-attack-guard-password', BCRYPT_ROUNDS);

function toPublic(row: any): PublicUser {
  return { id: row.id, email: row.email, name: row.name, role: row.role };
}

function issue(user: PublicUser): AuthResponse {
  return { user, token: generateToken({ userId: user.id, email: user.email, role: user.role }) };
}

export async function registerUser(email: unknown, password: unknown, name: unknown): Promise<AuthResponse> {
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const fields: { field: string; message: string }[] = [];
  if (!validateEmail(normalizedEmail)) fields.push({ field: 'email', message: '올바른 이메일 주소를 입력해 주세요.' });
  if (!validatePassword(password))
    fields.push({ field: 'password', message: '비밀번호는 영문과 숫자를 포함해 8자 이상이어야 합니다.' });
  if (!validateString(name, 1, 50)) fields.push({ field: 'name', message: '이름을 1~50자로 입력해 주세요.' });
  if (fields.length) throw new ValidationError(fields[0].message, { fields });

  const existing = await query('SELECT id FROM users WHERE LOWER(email) = $1', [normalizedEmail]);
  if (existing.rows.length > 0) {
    throw new ConflictError('이미 가입된 이메일입니다. 로그인하거나 다른 이메일을 사용해 주세요.', 'EMAIL_TAKEN');
  }

  const passwordHash = await bcryptjs.hash(password as string, BCRYPT_ROUNDS);
  try {
    const result = await query(
      `INSERT INTO users (email, password_hash, name, role)
       VALUES ($1, $2, $3, 'customer')
       RETURNING id, email, name, role`,
      [normalizedEmail, passwordHash, (name as string).trim()]
    );
    return issue(toPublic(result.rows[0]));
  } catch (error: any) {
    if (error?.code === '23505') {
      throw new ConflictError('이미 가입된 이메일입니다.', 'EMAIL_TAKEN');
    }
    throw error;
  }
}

export async function loginUser(email: unknown, password: unknown): Promise<AuthResponse> {
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!normalizedEmail || typeof password !== 'string' || !password) {
    throw new ValidationError('이메일과 비밀번호를 입력해 주세요.');
  }

  const result = await query('SELECT id, email, password_hash, name, role FROM users WHERE LOWER(email) = $1', [
    normalizedEmail,
  ]);
  const row = result.rows[0];
  const ok = await bcryptjs.compare(password, row ? row.password_hash : DUMMY_HASH);
  if (!row || !ok) {
    throw new AuthenticationError('이메일 또는 비밀번호가 올바르지 않습니다.');
  }
  return issue(toPublic(row));
}

export async function getUserById(userId: number): Promise<PublicUser> {
  const result = await query('SELECT id, email, name, role FROM users WHERE id = $1', [userId]);
  if (result.rows.length === 0) throw new NotFoundError('사용자를 찾을 수 없습니다.');
  return toPublic(result.rows[0]);
}

export async function verifyPassword(plainPassword: string, passwordHash: string): Promise<boolean> {
  return bcryptjs.compare(plainPassword, passwordHash);
}
