import type { User } from '../types';

const KEYS = { TOKEN: 'auth_token', USER: 'auth_user' } as const;

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export const saveToken = (token: string) => safe(() => localStorage.setItem(KEYS.TOKEN, token), undefined);
export const getToken = (): string | null => safe(() => localStorage.getItem(KEYS.TOKEN), null);
export const removeToken = () => safe(() => localStorage.removeItem(KEYS.TOKEN), undefined);

export const saveUser = (user: User) => safe(() => localStorage.setItem(KEYS.USER, JSON.stringify(user)), undefined);
export const getUser = (): User | null =>
  safe(() => {
    const raw = localStorage.getItem(KEYS.USER);
    return raw ? (JSON.parse(raw) as User) : null;
  }, null);
export const removeUser = () => safe(() => localStorage.removeItem(KEYS.USER), undefined);

export function clearAuthStorage(): void {
  removeToken();
  removeUser();
}

export const isAuthenticated = () => getToken() !== null;
export const isAdmin = () => getUser()?.role === 'admin';

/** 체크아웃 배송지 기억하기 (다음 주문 시 자동 입력) */
const SHIPPING_KEY = 'last_shipping';
export const saveLastShipping = (v: unknown) => safe(() => localStorage.setItem(SHIPPING_KEY, JSON.stringify(v)), undefined);
export const getLastShipping = <T,>(): T | null =>
  safe(() => {
    const raw = localStorage.getItem(SHIPPING_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  }, null);
