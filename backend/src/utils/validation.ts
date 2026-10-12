/**
 * 입력값 검증/정규화 도우미.
 * 쿼리스트링과 multipart 폼은 값이 문자열로 오므로, 숫자 검증은 문자열도 받아 정수로 변환합니다.
 */
import { ValidationError } from './errors.js';

export interface FieldError {
  field: string;
  message: string;
}

/** 문자열/숫자를 정수로 변환. 정수가 아니면 null */
export function toInt(value: unknown): number | null {
  if (typeof value === 'number') return Number.isInteger(value) ? value : null;
  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) {
    const n = Number(value.trim());
    return Number.isSafeInteger(n) ? n : null;
  }
  return null;
}

export function validateEmail(email: unknown): email is string {
  return typeof email === 'string' && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** 8자 이상, 영문과 숫자를 각각 1자 이상 포함 */
export function validatePassword(password: unknown): password is string {
  return (
    typeof password === 'string' &&
    password.length >= 8 &&
    password.length <= 72 && // bcrypt 는 72바이트까지만 사용
    /[A-Za-z]/.test(password) &&
    /\d/.test(password)
  );
}

export function validatePositiveInteger(value: unknown): boolean {
  const n = toInt(value);
  return n !== null && n > 0;
}

export function validateNonNegativeInteger(value: unknown): boolean {
  const n = toInt(value);
  return n !== null && n >= 0;
}

export function validateString(value: unknown, minLength = 1, maxLength = 255): value is string {
  return typeof value === 'string' && value.trim().length >= minLength && value.length <= maxLength;
}

export const MAX_QUANTITY_PER_ITEM = 99;

export function validateQuantity(value: unknown): boolean {
  const n = toInt(value);
  return n !== null && n >= 1 && n <= MAX_QUANTITY_PER_ITEM;
}

export function validateUUID(value: unknown): boolean {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/** 휴대폰/일반전화 (숫자만 9~11자리) */
export function normalizePhone(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const digits = value.replace(/\D/g, '');
  if (!/^0\d{8,10}$/.test(digits)) return null;
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.startsWith('02')) {
    return digits.length === 9
      ? `02-${digits.slice(2, 5)}-${digits.slice(5)}`
      : `02-${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/** 우편번호(5자리 도로명 우편번호) */
export function validatePostalCode(value: unknown): value is string {
  return typeof value === 'string' && /^\d{5}$/.test(value.trim());
}

export function parsePagination(query: Record<string, unknown>, defaultLimit = 20, maxLimit = 100) {
  const page = toInt(query.page) ?? 1;
  const limit = toInt(query.limit) ?? defaultLimit;
  if (page < 1) throw new ValidationError('page 는 1 이상이어야 합니다.');
  if (limit < 1 || limit > maxLimit) throw new ValidationError(`limit 은 1~${maxLimit} 사이여야 합니다.`);
  return { page, limit, offset: (page - 1) * limit };
}

export function parseId(value: unknown, label = 'id'): number {
  const n = toInt(value);
  if (n === null || n < 1) throw new ValidationError(`${label} 가 올바르지 않습니다.`);
  return n;
}

export function optionalTrimmed(value: unknown, maxLength: number): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new ValidationError('문자열 값이 필요합니다.');
  const t = value.trim();
  if (t.length > maxLength) throw new ValidationError(`최대 ${maxLength}자까지 입력할 수 있습니다.`);
  return t.length ? t : null;
}

export function validatePageNumber(page: unknown): boolean {
  const n = toInt(page);
  return n !== null && n >= 1;
}

export function validateLimit(limit: unknown, max = 100): boolean {
  const n = toInt(limit);
  return n !== null && n >= 1 && n <= max;
}

export function validateSortOption(sort: unknown, validOptions: readonly string[]): boolean {
  return typeof sort === 'string' && validOptions.includes(sort);
}
