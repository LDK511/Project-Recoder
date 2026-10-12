import type { OrderStatus } from '../types';

/** 원화 금액 표시. (DB 의 *_cents 는 원화의 최소 단위인 '원'입니다) */
export function formatPrice(won: number | null | undefined): string {
  if (won === null || won === undefined || !Number.isFinite(won)) return '0원';
  return `${Math.round(won).toLocaleString('ko-KR')}원`;
}

export function discountRate(price: number, compareAt: number | null | undefined): number {
  if (!compareAt || compareAt <= price) return 0;
  return Math.floor(((compareAt - price) / compareAt) * 100);
}

export function formatDate(iso: string | null | undefined, withTime = true): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...(withTime ? { hour: '2-digit', minute: '2-digit', hour12: false } : {}),
  });
}

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: '결제대기',
  paid: '결제완료',
  preparing: '상품준비중',
  shipping: '배송중',
  completed: '배송완료',
  cancelled: '주문취소',
  expired: '결제기한만료',
  refunded: '환불완료',
};

export function formatOrderStatus(status: string): string {
  return ORDER_STATUS_LABEL[status as OrderStatus] ?? status;
}

export function truncateText(text: string, maxLength: number): string {
  return text.length <= maxLength ? text : `${text.slice(0, maxLength)}…`;
}

/** 01012345678 → 010-1234-5678 (입력 중 자동 하이픈) */
export function formatPhoneInput(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.startsWith('02')) {
    if (d.length <= 2) return d;
    if (d.length <= 5) return `${d.slice(0, 2)}-${d.slice(2)}`;
    if (d.length <= 9) return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`;
    return `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6, 10)}`;
  }
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
  if (d.length <= 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}

/** 브라우저 crypto 로 UUID v4 생성 (HTTP 환경에서도 동작) */
export function uuidv4(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto && window.isSecureContext) {
    return crypto.randomUUID();
  }
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** 송장 조회 링크 (네이버 택배 배송조회 검색) */
export function trackingUrl(carrier: string | null, number: string | null): string | null {
  if (!number) return null;
  const q = encodeURIComponent(`${carrier ?? ''} ${number}`.trim());
  return `https://search.naver.com/search.naver?query=${q}`;
}
