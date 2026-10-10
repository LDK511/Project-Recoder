/**
 * 사용자 타입
 */
export interface User {
  id: number;
  email: string;
  password_hash: string;
  name: string;
  role: 'user' | 'admin';
  created_at: string;
  updated_at: string;
}

/**
 * 사용자 응답 타입 (비밀번호 제외)
 */
export interface UserResponse {
  id: number;
  email: string;
  name: string;
  role: 'user' | 'admin';
}

/**
 * 상품 타입
 */
export interface Product {
  id: number;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * 장바구니 항목 타입
 */
export interface CartItem {
  id: number;
  user_id: number;
  product_id: number;
  quantity: number;
  product?: Product;
  created_at: string;
  updated_at: string;
}

/**
 * 주문 타입
 */
export interface Order {
  id: number;
  user_id: number;
  total_amount: number;
  status: 'pending' | 'paid' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

/**
 * 주문 항목 타입
 */
export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number;
  quantity: number;
  unit_price: number;
  created_at: string;
}

/**
 * 주문 상세 응답 타입
 */
export interface OrderDetail extends Order {
  items: OrderItem[];
}

/**
 * 재고 예약 타입
 */
export interface StockReservation {
  id: number;
  order_id: number;
  product_id: number;
  quantity: number;
  created_at: string;
}

/**
 * 결제 타입
 */
export interface Payment {
  id: number;
  payment_id: string;
  order_id: number;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
}

/**
 * 웹훅 이벤트 타입
 */
export interface WebhookEvent {
  id: number;
  event_id: string;
  payment_id: string;
  status: string;
  created_at: string;
}

/**
 * 멱등성 키 타입
 */
export interface IdempotencyKey {
  id: number;
  user_id: number;
  key: string;
  order_id: number;
  created_at: string;
}

/**
 * 로그인 시도 타입
 */
export interface LoginAttempt {
  id: number;
  email: string;
  ip_address: string | null;
  attempted_at: string;
}

/**
 * JWT 토큰 페이로드
 */
export interface JWTPayload {
  id: number;
  email: string;
  role: 'user' | 'admin';
}

/**
 * API 응답 래퍼
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * 페이지네이션 응답
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

/**
 * 장바구니 응답
 */
export interface CartResponse {
  items: CartItem[];
  total_amount: number;
}

/**
 * 결제 의도 응답
 */
export interface PaymentIntentResponse {
  payment_id: string;
  order_id: number;
  amount: number;
  currency: string;
  status: string;
  client_secret?: string | null;
  test_mode: boolean;
}

/**
 * 상태 확인 응답
 */
export interface HealthResponse {
  status: 'ok';
  test_payment_mode: boolean;
}
