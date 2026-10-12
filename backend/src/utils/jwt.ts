import jwt from 'jsonwebtoken';
import { JWTPayload } from '../types/index.js';

function secret(): string {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) {
    throw new Error('JWT_SECRET must be set and at least 32 characters long');
  }
  return s;
}

export function generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  const expiresIn = (process.env.JWT_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn'];
  return jwt.sign(payload, secret(), { expiresIn: expiresIn as jwt.SignOptions['expiresIn'], algorithm: 'HS256' });
}

export function verifyToken(token: string): JWTPayload {
  return jwt.verify(token, secret(), { algorithms: ['HS256'] }) as JWTPayload;
}

export function decodeToken(token: string): JWTPayload | null {
  try {
    return jwt.decode(token) as JWTPayload | null;
  } catch {
    return null;
  }
}
