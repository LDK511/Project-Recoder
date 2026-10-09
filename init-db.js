const { Pool } = require('pg');
// ReCoder: NUMERIC/DECIMAL 을 문자열이 아닌 숫자로 받는다(화면의 toFixed 등).
require('pg').types.setTypeParser(1700, (value) => parseFloat(value));
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const initDb = async () => {
  const client = await pool.connect();
  try {
    console.log('Initializing database...');

    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ users table created');

    // Create products table
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price NUMERIC(10, 2) NOT NULL,
        stock INTEGER NOT NULL DEFAULT 0,
        image_url VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ products table created');

    // Create cart_items table
    await client.query(`
      CREATE TABLE IF NOT EXISTS cart_items (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL DEFAULT 1,
        UNIQUE(user_id, product_id)
      );
    `);
    console.log('✓ cart_items table created');

    // Create orders table
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        total_price NUMERIC(10, 2) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ orders table created');

    // Create order_items table
    await client.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id),
        quantity INTEGER NOT NULL,
        price NUMERIC(10, 2) NOT NULL
      );
    `);
    console.log('✓ order_items table created');

    // Insert sample products
    await client.query(`
      INSERT INTO products (name, description, price, stock, image_url)
      VALUES
        ('노트북', '고성능 개발용 노트북', 1500000, 10, 'https://placehold.co/300x200?text=노트북'),
        ('마우스', '무선 에르고노믹 마우스', 45000, 50, 'https://placehold.co/300x200?text=마우스'),
        ('키보드', '기계식 RGB 키보드', 150000, 30, 'https://placehold.co/300x200?text=키보드'),
        ('모니터', '4K 울트라와이드 모니터', 600000, 15, 'https://placehold.co/300x200?text=모니터'),
        ('헤드폰', '노이즈캔슬링 무선 헤드폰', 350000, 25, 'https://placehold.co/300x200?text=헤드폰')
      ON CONFLICT DO NOTHING;
    `);
    console.log('✓ sample products inserted');

    console.log('Database initialization completed successfully!');
  } catch (error) {
    console.error('Database initialization error:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
};

initDb();
