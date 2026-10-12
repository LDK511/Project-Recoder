/**
 * 버전 관리되는 DB 마이그레이션.
 * - 서버 시작 시(그리고 `npm run db:init`) 순서대로 한 번씩만 적용됩니다.
 * - 적용 이력은 schema_migrations 테이블에 남습니다.
 * - 이미 배포된 마이그레이션은 절대 수정하지 말고, 새 버전을 뒤에 추가하세요.
 */
export interface Migration {
  version: number;
  name: string;
  sql: string;
}

export const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    sql: `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL CHECK (price_cents > 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  image_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at);

CREATE TABLE IF NOT EXISTS cart_items (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_cart_items_user_id ON cart_items(user_id);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'completed', 'cancelled', 'expired')),
  total_cents INTEGER NOT NULL CHECK (total_cents > 0),
  currency VARCHAR(3) DEFAULT 'KRW',
  idempotency_key VARCHAR(255) UNIQUE NOT NULL,
  payment_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);

CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price_cents INTEGER NOT NULL CHECK (price_cents > 0),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

CREATE TABLE IF NOT EXISTS payment_events (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  event_id VARCHAR(255) UNIQUE NOT NULL,
  event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('completed', 'failed', 'cancelled')),
  payload JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_payment_events_order_id ON payment_events(order_id);

CREATE TABLE IF NOT EXISTS inventory_reservations (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  reserved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  released_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_inventory_reservations_order_id ON inventory_reservations(order_id);
CREATE INDEX IF NOT EXISTS idx_inventory_reservations_product_id ON inventory_reservations(product_id);
`,
  },
  {
    version: 2,
    name: 'commerce_operations',
    sql: `
-- 사용자: 이메일 대소문자 무시 중복 방지
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));

-- 상품: 카테고리, 정가(할인 표시), 판매 여부(삭제 대신 숨김)
ALTER TABLE products ADD COLUMN IF NOT EXISTS category VARCHAR(50);
ALTER TABLE products ADD COLUMN IF NOT EXISTS compare_at_price_cents INTEGER CHECK (compare_at_price_cents IS NULL OR compare_at_price_cents > 0);
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
CREATE INDEX IF NOT EXISTS idx_products_active_created ON products(is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

-- 주문: 주문번호, 금액 구성, 배송지, 송장, 단계별 시각
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_number VARCHAR(32);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal_cents INTEGER;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_fee_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS recipient_name VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS recipient_phone VARCHAR(20);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS postal_code VARCHAR(10);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS address1 VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS address2 VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_memo VARCHAR(200);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_carrier VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_number VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancel_reason VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP;

UPDATE orders SET subtotal_cents = total_cents WHERE subtotal_cents IS NULL;
UPDATE orders
   SET order_number = TO_CHAR(created_at, 'YYYYMMDD') || LPAD(id::text, 6, '0')
 WHERE order_number IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_pending_expiry ON orders(expires_at) WHERE status = 'pending';

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending', 'paid', 'preparing', 'shipping', 'completed', 'cancelled', 'expired', 'refunded'));

-- 주문 상품: 주문 시점의 상품명/이미지 스냅샷 (상품이 바뀌거나 숨겨져도 주문서는 그대로)
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS product_name VARCHAR(255);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS image_url VARCHAR(500);
UPDATE order_items oi SET product_name = p.name, image_url = p.image_url
  FROM products p WHERE oi.product_id = p.id AND oi.product_name IS NULL;
ALTER TABLE order_items ALTER COLUMN product_id DROP NOT NULL;
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_product_id_fkey;
ALTER TABLE order_items ADD CONSTRAINT order_items_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;

-- 결제 이벤트: 환불 기록
ALTER TABLE payment_events DROP CONSTRAINT IF EXISTS payment_events_event_type_check;
ALTER TABLE payment_events ADD CONSTRAINT payment_events_event_type_check
  CHECK (event_type IN ('completed', 'failed', 'cancelled', 'refunded'));

-- 재고 예약: 상품 삭제 시 함께 정리
ALTER TABLE inventory_reservations DROP CONSTRAINT IF EXISTS inventory_reservations_product_id_fkey;
ALTER TABLE inventory_reservations ADD CONSTRAINT inventory_reservations_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

-- 주문 상태 변경 이력 (CS 대응·감사 로그)
CREATE TABLE IF NOT EXISTS order_status_history (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status VARCHAR(20),
  to_status VARCHAR(20) NOT NULL,
  note VARCHAR(255),
  actor VARCHAR(100) NOT NULL DEFAULT 'system',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_order_status_history_order ON order_status_history(order_id, created_at);
`,
  },
];
