export type UserRole = 'customer' | 'admin';

export interface User {
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
  compare_at_price_cents: number | null;
  stock: number;
  image_url: string | null;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Category {
  name: string;
  count: number;
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

export interface CartResponse {
  items: CartItemWithProduct[];
  total_cents: number;
  item_count: number;
}

export type OrderStatus =
  | 'pending'
  | 'paid'
  | 'preparing'
  | 'shipping'
  | 'completed'
  | 'cancelled'
  | 'expired'
  | 'refunded';

export interface OrderItem {
  id?: number;
  product_id: number | null;
  product_name: string;
  image_url: string | null;
  quantity: number;
  price_cents: number;
}

export interface OrderHistory {
  id: number;
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  note: string | null;
  actor: string;
  created_at: string;
}

export interface Order {
  id: number;
  order_number: string;
  user_id: number;
  status: OrderStatus;
  subtotal_cents: number;
  shipping_fee_cents: number;
  total_cents: number;
  currency: string;
  payment_id: string | null;
  recipient_name: string | null;
  recipient_phone: string | null;
  postal_code: string | null;
  address1: string | null;
  address2: string | null;
  delivery_memo: string | null;
  tracking_carrier: string | null;
  tracking_number: string | null;
  cancel_reason: string | null;
  paid_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at?: string;
  items: OrderItem[];
  history?: OrderHistory[];
  customer_name?: string;
  customer_email?: string;
}

export interface ShippingForm {
  recipient_name: string;
  recipient_phone: string;
  postal_code: string;
  address1: string;
  address2: string;
  delivery_memo: string;
}

export interface CheckoutResponse {
  order_id: number;
  order_number: string;
  status: OrderStatus;
  total_cents: number;
  payment_url: string;
  client_secret: string | null;
  test_mode: boolean;
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

export interface StoreConfig {
  store: {
    name: string;
    companyName: string;
    ceo: string;
    businessNumber: string;
    mailOrderNumber: string;
    address: string;
    phone: string;
    email: string;
    privacyOfficer: string;
    hostingProvider: string;
    csHours: string;
  };
  shipping: { fee_cents: number; free_threshold_cents: number };
  order_payment_timeout_minutes: number;
  test_payment_mode: boolean;
  stripe_publishable_key: string | null;
}

export interface DashboardStats {
  today: { orders: number; revenue: number };
  month: { orders: number; revenue: number };
  status_counts: Record<OrderStatus, number>;
  low_stock: { id: number; name: string; stock: number; image_url: string | null }[];
  daily: { day: string; revenue: number; orders: number }[];
}
