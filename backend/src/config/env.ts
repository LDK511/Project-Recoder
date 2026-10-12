/**
 * 환경변수를 한곳에서 읽어 타입이 있는 설정 객체로 제공합니다.
 * (dotenv 는 src/index.ts 에서 가장 먼저 로드됩니다)
 */

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

function str(name: string, fallback = ''): string {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : v;
}

export const config = {
  nodeEnv: str('NODE_ENV', 'development'),
  port: int('PORT', 3000),
  /** 프런트엔드 주소(CORS 허용, 결제 후 돌아올 주소). 콤마로 여러 개 지정 가능 */
  frontendUrls: str('FRONTEND_URL', 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  /** 리버스 프록시(로드밸런서, Nginx 등) 뒤에서 실행할 때 신뢰할 홉 수 */
  trustProxy: int('TRUST_PROXY', 1),

  jwtSecret: str('JWT_SECRET'),
  jwtExpiresIn: str('JWT_EXPIRES_IN', '7d'),

  uploadDir: str('UPLOAD_DIR', 'uploads'),

  /** 결제 대기 주문이 자동 만료되기까지의 시간(분). 만료 시 재고가 복구됩니다. */
  orderPaymentTimeoutMinutes: int('ORDER_PAYMENT_TIMEOUT_MINUTES', 30),

  shipping: {
    /** 기본 배송비(원) */
    feeKrw: int('SHIPPING_FEE_KRW', 3000),
    /** 이 금액 이상 구매 시 무료배송(원). 0 이면 항상 무료 */
    freeThresholdKrw: int('FREE_SHIPPING_THRESHOLD_KRW', 50000),
  },

  stripePublishableKey: str('STRIPE_PUBLISHABLE_KEY'),

  /**
   * 전자상거래법 제10조에 따라 사이버몰 화면에 표시해야 하는 사업자 정보.
   * 운영 전에 반드시 실제 정보로 바꾸세요.
   */
  store: {
    name: str('STORE_NAME', '데일리데스크'),
    companyName: str('STORE_COMPANY_NAME', '(주)데일리데스크'),
    ceo: str('STORE_CEO', '홍길동'),
    businessNumber: str('STORE_BUSINESS_NUMBER', '000-00-00000'),
    mailOrderNumber: str('STORE_MAIL_ORDER_NUMBER', '제2026-서울강남-00000호'),
    address: str('STORE_ADDRESS', '서울특별시 강남구 테헤란로 000, 0층'),
    phone: str('STORE_PHONE', '1600-0000'),
    email: str('STORE_EMAIL', 'help@dailydesk.example'),
    privacyOfficer: str('STORE_PRIVACY_OFFICER', '홍길동'),
    hostingProvider: str('STORE_HOSTING_PROVIDER', '호스팅 사업자명'),
    csHours: str('STORE_CS_HOURS', '평일 10:00 - 17:00 (점심 12:30 - 13:30, 주말·공휴일 휴무)'),
  },
} as const;

export const isProduction = config.nodeEnv === 'production';

/** 주문 금액(상품 합계)에 대한 배송비를 계산합니다. */
export function calculateShippingFee(subtotalKrw: number): number {
  if (subtotalKrw <= 0) return 0;
  const { feeKrw, freeThresholdKrw } = config.shipping;
  if (freeThresholdKrw > 0 && subtotalKrw >= freeThresholdKrw) return 0;
  return Math.max(0, feeKrw);
}
