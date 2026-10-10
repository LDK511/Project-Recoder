import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL 환경변수가 필요합니다');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false,
});

async function initializeDatabase(): Promise<void> {
  const client = await pool.connect();

  try {
    console.log('데이터베이스 초기화 시작...');

    // users 테이블
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ users 테이블 생성됨');

    // products 테이블
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price INTEGER NOT NULL,
        stock INTEGER NOT NULL DEFAULT 0,
        image_url VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ products 테이블 생성됨');

    // cart_items 테이블
    await client.query(`
      CREATE TABLE IF NOT EXISTS cart_items (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, product_id)
      );
    `);
    console.log('✓ cart_items 테이블 생성됨');

    // orders 테이블
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        total_amount INTEGER NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ orders 테이블 생성됨');

    // order_items 테이블
    await client.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id),
        quantity INTEGER NOT NULL,
        unit_price INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ order_items 테이블 생성됨');

    // stock_reservations 테이블
    await client.query(`
      CREATE TABLE IF NOT EXISTS stock_reservations (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id),
        quantity INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ stock_reservations 테이블 생성됨');

    // payments 테이블
    await client.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        payment_id VARCHAR(255) UNIQUE NOT NULL,
        order_id INTEGER NOT NULL REFERENCES orders(id),
        amount INTEGER NOT NULL,
        currency VARCHAR(10) DEFAULT 'KRW',
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ payments 테이블 생성됨');

    // webhook_events 테이블
    await client.query(`
      CREATE TABLE IF NOT EXISTS webhook_events (
        id SERIAL PRIMARY KEY,
        event_id VARCHAR(255) UNIQUE NOT NULL,
        payment_id VARCHAR(255) NOT NULL,
        status VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ webhook_events 테이블 생성됨');

    // idempotency_keys 테이블
    await client.query(`
      CREATE TABLE IF NOT EXISTS idempotency_keys (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        key VARCHAR(255) NOT NULL,
        order_id INTEGER NOT NULL REFERENCES orders(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, key)
      );
    `);
    console.log('✓ idempotency_keys 테이블 생성됨');

    // login_attempts 테이블
    await client.query(`
      CREATE TABLE IF NOT EXISTS login_attempts (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        ip_address VARCHAR(45),
        attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ login_attempts 테이블 생성됨');

    // 인덱스 생성
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_cart_items_user_id ON cart_items(user_id);
      CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
      CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
      CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
      CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email);
      CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_address);
    `);
    console.log('✓ 인덱스 생성됨');

    // 데모 데이터 시드 (SEED_DEMO=true일 때만)
    if (process.env.SEED_DEMO === 'true') {
      console.log('데모 데이터 시드 중...');

      // 기존 데이터 확인
      const productsCheck = await client.query('SELECT COUNT(*) as count FROM products');
      if (parseInt(productsCheck.rows[0].count, 10) === 0) {
        // 샘플 상품 추가
        const sampleProducts = [
          {
            name: '무선 헤드폰',
            description: '고음질 무선 헤드폰, 30시간 배터리',
            price: 150000,
            stock: 50,
            image_url: 'https://placehold.co/300x200?text=무선헤드폰',
          },
          {
            name: '스마트워치',
            description: '피트니스 추적 기능이 있는 스마트워치',
            price: 250000,
            stock: 30,
            image_url: 'https://placehold.co/300x200?text=스마트워치',
          },
          {
            name: '포터블 스피커',
            description: '방수 포터블 블루투스 스피커',
            price: 80000,
            stock: 100,
            image_url: 'https://placehold.co/300x200?text=포터블스피커',
          },
          {
            name: 'USB-C 케이블',
            description: '고속 충전 USB-C 케이블 2m',
            price: 15000,
            stock: 200,
            image_url: 'https://placehold.co/300x200?text=USB-C케이블',
          },
          {
            name: '무선 마우스',
            description: '정밀한 센서가 있는 무선 마우스',
            price: 45000,
            stock: 75,
            image_url: 'https://placehold.co/300x200?text=무선마우스',
          },
          {
            name: '키보드',
            description: '기계식 게이밍 키보드 RGB 백라이트',
            price: 120000,
            stock: 40,
            image_url: 'https://placehold.co/300x200?text=키보드',
          },
          {
            name: '웹캠',
            description: '1080p HD 웹캠 자동 초점',
            price: 60000,
            stock: 35,
            image_url: 'https://placehold.co/300x200?text=웹캠',
          },
          {
            name: '외장 SSD',
            description: '1TB 포터블 외장 SSD 고속 전송',
            price: 120000,
            stock: 25,
            image_url: 'https://placehold.co/300x200?text=외장SSD',
          },
        ];

        for (const product of sampleProducts) {
          await client.query(
            `INSERT INTO products (name, description, price, stock, image_url, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [product.name, product.description, product.price, product.stock, product.image_url],
          );
        }
        console.log(`✓ ${sampleProducts.length}개의 샘플 상품 추가됨`);
      }

      // 테스트 사용자 추가
      const usersCheck = await client.query('SELECT COUNT(*) as count FROM users');
      if (parseInt(usersCheck.rows[0].count, 10) === 0) {
        // bcryptjs로 미리 해시된 비밀번호 (password: "password123")
        const hashedPassword = '$2a$10$YourHashedPasswordHere'; // 실제로는 bcryptjs로 생성해야 함

        await client.query(
          `INSERT INTO users (email, password_hash, name, role, created_at, updated_at)
           VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          ['user@example.com', hashedPassword, 'Test User', 'user'],
        );

        await client.query(
          `INSERT INTO users (email, password_hash, name, role, created_at, updated_at)
           VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          ['admin@example.com', hashedPassword, 'Admin User', 'admin'],
        );

        console.log('✓ 테스트 사용자 추가됨 (user@example.com, admin@example.com)');
      }
    }

    console.log('✅ 데이터베이스 초기화 완료!');
  } catch (error) {
    console.error('❌ 데이터베이스 초기화 실패:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

initializeDatabase();
