import pg from 'pg';
// ReCoder: NUMERIC/DECIMAL 을 문자열이 아닌 숫자로 받는다(화면의 toFixed 등).
pg.types.setTypeParser(1700, (value) => parseFloat(value));
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/shopping_mall',
});

export const query = (text, params) => pool.query(text, params);

export const initializeDatabase = async () => {
  try {
    // Create categories table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create products table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        price NUMERIC(10, 2) NOT NULL,
        description TEXT,
        image VARCHAR(500),
        stock INTEGER NOT NULL DEFAULT 0,
        category_id INTEGER REFERENCES categories(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create orders table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        customer_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        address TEXT NOT NULL,
        total NUMERIC(10, 2) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create order_items table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id),
        quantity INTEGER NOT NULL,
        price NUMERIC(10, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Seed sample data if tables are empty
    const categoryCheck = await pool.query('SELECT COUNT(*) FROM categories');
    if (categoryCheck.rows[0].count === '0') {
      await pool.query(`
        INSERT INTO categories (name) VALUES
        ('Electronics'),
        ('Clothing'),
        ('Books'),
        ('Home & Garden')
      `);

      await pool.query(`
        INSERT INTO products (name, price, description, image, stock, category_id) VALUES
        ('Wireless Headphones', 79.99, 'High-quality wireless headphones with noise cancellation', 'https://via.placeholder.com/300?text=Headphones', 50, 1),
        ('USB-C Cable', 12.99, 'Durable USB-C charging cable', 'https://via.placeholder.com/300?text=Cable', 200, 1),
        ('T-Shirt', 19.99, 'Comfortable cotton t-shirt', 'https://via.placeholder.com/300?text=TShirt', 100, 2),
        ('Jeans', 49.99, 'Classic blue jeans', 'https://via.placeholder.com/300?text=Jeans', 75, 2),
        ('Programming Book', 39.99, 'Learn JavaScript in 30 days', 'https://via.placeholder.com/300?text=Book', 30, 3),
        ('Garden Tools Set', 89.99, 'Complete garden tools set with 10 pieces', 'https://via.placeholder.com/300?text=Tools', 20, 4),
        ('Desk Lamp', 34.99, 'LED desk lamp with adjustable brightness', 'https://via.placeholder.com/300?text=Lamp', 45, 4),
        ('Smartphone Stand', 14.99, 'Adjustable phone stand for desk', 'https://via.placeholder.com/300?text=Stand', 120, 1)
      `);
    }

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
};

export default pool;
