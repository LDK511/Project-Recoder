/**
 * 입력 검증 유틸리티
 */

/**
 * 이메일 형식을 검증합니다.
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * 비밀번호 길이를 검증합니다 (최소 8자).
 */
export function isValidPassword(password: string): boolean {
  return password && password.length >= 8;
}

/**
 * 이름이 비어있지 않은지 검증합니다.
 */
export function isValidName(name: string): boolean {
  return name && name.trim().length > 0;
}

/**
 * 양의 정수인지 검증합니다.
 */
export function isPositiveInteger(value: any): boolean {
  const num = Number(value);
  return Number.isInteger(num) && num > 0;
}

/**
 * 음이 아닌 정수인지 검증합니다.
 */
export function isNonNegativeInteger(value: any): boolean {
  const num = Number(value);
  return Number.isInteger(num) && num >= 0;
}

/**
 * 페이지 번호를 검증하고 정규화합니다.
 */
export function normalizePageNumber(page: any, defaultPage: number = 1): number {
  const num = Number(page);
  if (!Number.isInteger(num) || num < 1) {
    return defaultPage;
  }
  return num;
}

/**
 * 페이지 크기를 검증하고 정규화합니다.
 */
export function normalizeLimitNumber(limit: any, defaultLimit: number = 20, maxLimit: number = 100): number {
  const num = Number(limit);
  if (!Number.isInteger(num) || num < 1) {
    return defaultLimit;
  }
  if (num > maxLimit) {
    return maxLimit;
  }
  return num;
}

/**
 * 검색 문자열을 정규화합니다 (공백 제거, 길이 제한).
 */
export function normalizeSearchQuery(query: any, maxLength: number = 100): string {
  if (typeof query !== 'string') {
    return '';
  }
  return query.trim().slice(0, maxLength);
}

/**
 * UUID 형식을 검증합니다.
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * IP 주소를 추출합니다 (프록시 고려).
 */
export function getClientIP(req: any): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || req.connection?.remoteAddress || 'unknown';
}

/**
 * 통화 코드를 검증합니다.
 */
export function isValidCurrency(currency: string): boolean {
  const validCurrencies = ['KRW', 'USD', 'EUR', 'JPY', 'GBP', 'CNY'];
  return validCurrencies.includes(currency.toUpperCase());
}

/**
 * 주문 상태를 검증합니다.
 */
export function isValidOrderStatus(status: string): boolean {
  const validStatuses = ['pending', 'paid', 'completed', 'cancelled'];
  return validStatuses.includes(status.toLowerCase());
}

/**
 * 결제 상태를 검증합니다.
 */
export function isValidPaymentStatus(status: string): boolean {
  const validStatuses = ['pending', 'completed', 'failed'];
  return validStatuses.includes(status.toLowerCase());
}

/**
 * 사용자 역할을 검증합니다.
 */
export function isValidRole(role: string): boolean {
  const validRoles = ['user', 'admin'];
  return validRoles.includes(role.toLowerCase());
}

/**
 * 멱등성 키 형식을 검증합니다.
 */
export function isValidIdempotencyKey(key: string): boolean {
  return key && key.length > 0 && key.length <= 255;
}
