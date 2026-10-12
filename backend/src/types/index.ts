export type UserRole = 'customer' | 'admin';

export interface User {
  id: number;
  email: string;
  password_hash: string;
  name: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface PublicUser {
  id: number;
  email: string;
  name: string;
  role: UserRole;
}

export interface Product {
  id: number;
  name: string;
  description: string | null;
  category: string | null;
  price_cents: number;
  /** 정가(할인 전 가격). 판매가보다 클 때만 할인 표시 */
  compare_at_price_cents: number | null;
  stock: number;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CartItemWithProduct {
  id: number;
  product_id: number;
  quantity: number;
  product_name: string;
  price_cents: number;
  compare_at_price_cents: number | null;
  image_url: string | null;
  stock: number;
  is_active: boolean;
}

/**
 * 주문 상태 (국내 쇼핑몰 표준 흐름)
 *  pending(결제대기) → paid(결제완료) → preparing(상품준비중) → shipping(배송중) → completed(배송완료)
 *  취소/만료/환불: cancelled, expired, refunded
 */
export const ORDER_STATUSES = [
  'pending',
  'paid',
  'preparing',
  'shipping',
  'completed',
  'cancelled',
  'expired',
  'refunded',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface ShippingInfo {
  recipient_name: string;
  recipient_phone: string;
  postal_code: string;
  address1: string;
  address2: string | null;
  delivery_memo: string | null;
}

export interface Order extends ShippingInfo {
  id: number;
  order_number: string;
  user_id: number;
  status: OrderStatus;
  subtotal_cents: number;
  shipping_fee_cents: number;
  total_cents: number;
  currency: string;
  idempotency_key: string;
  payment_id: string | null;
  tracking_carrier: string | null;
  tracking_number: string | null;
  cancel_reason: string | null;
  paid_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number | null;
  product_name: string;
  image_url: string | null;
  quantity: number;
  price_cents: number;
}

export interface OrderStatusHistory {
  id: number;
  order_id: number;
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  note: string | null;
  actor: string;
  created_at: string;
}

export interface OrderWithItems extends Order {
  items: OrderItem[];
  history?: OrderStatusHistory[];
  customer_name?: string;
  customer_email?: string;
}

export interface InventoryReservation {
  id: number;
  order_id: number;
  product_id: number;
  quantity: number;
  reserved_at: string;
  released_at: string | null;
}

export interface PaymentEventRecord {
  id: number;
  order_id: number;
  event_id: string;
  event_type: 'completed' | 'failed' | 'cancelled' | 'refunded';
  payload: Record<string, unknown> | null;
  created_at: string;
}

export interface JWTPayload {
  userId: number;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface AuthResponse {
  user: PublicUser;
  token: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}
