/**
 * 사용자 타입
 */
export interface User {
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
 * 주문 타입
 */
export interface Order {
  id: number;
  user_id: number;
  total_amount: number;
  status: 'pending' | 'paid' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
}

/**
 * 결제 의도 응답 타입
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
 * 장바구니 응답 타입
 */
export interface CartResponse {
  items: CartItem[];
  total_amount: number;
}

/**
 * 페이지네이션 응답 타입
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

/**
 * 상태 확인 응답 타입
 */
export interface HealthResponse {
  status: 'ok';
  test_payment_mode: boolean;
}

/**
 * 로그인 요청 타입
 */
export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * 회원가입 요청 타입
 */
export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

/**
 * 인증 응답 타입
 */
export interface AuthResponse {
  id: number;
  email: string;
  name: string;
  role: 'user' | 'admin';
  token: string;
}

/**
 * 상품 생성/수정 요청 타입
 */
export interface ProductRequest {
  name: string;
  description?: string;
  price: number;
  stock: number;
  image_url?: string;
}

/**
 * 장바구니 추가 요청 타입
 */
export interface AddToCartRequest {
  product_id: number;
  quantity: number;
}

/**
 * 주문 생성 요청 타입
 */
export interface CreateOrderRequest {
  idempotency_key: string;
}

/**
 * API 에러 응답 타입
 */
export interface ApiErrorResponse {
  error: string;
}
