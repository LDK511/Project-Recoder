const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

const initializeDatabase = async () => {
  const client = await pool.connect();
  try {
    // Create customers table
    await client.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create products table
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        description TEXT,
        image VARCHAR(500),
        stock INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create orders table
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        customer_id INT REFERENCES customers(id),
        total DECIMAL(10, 2) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        stripe_session_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create order_items table
    await client.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INT REFERENCES orders(id),
        product_id INT REFERENCES products(id),
        quantity INT NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Seed sample products if table is empty
    const result = await client.query('SELECT COUNT(*) FROM products');
    if (result.rows[0].count === '0') {
      await client.query(`
        INSERT INTO products (name, price, description, image, stock) VALUES
        ('노트북', 1299.99, '고성능 개발용 노트북', 'https://via.placeholder.com/300?text=Laptop', 10),
        ('마우스', 29.99, '무선 마우스', 'https://via.placeholder.com/300?text=Mouse', 50),
        ('키보드', 79.99, '기계식 키보드', 'https://via.placeholder.com/300?text=Keyboard', 30),
        ('모니터', 299.99, '4K 모니터', 'https://via.placeholder.com/300?text=Monitor', 15),
        ('헤드폰', 149.99, '노이즈 캔슬링 헤드폰', 'https://via.placeholder.com/300?text=Headphones', 25);
      `);
    }

    console.log('Database initialized successfully');
  } catch (err) {
    console.error('Error initializing database:', err);
    throw err;
  } finally {
    client.release();
  }
};

const query = (text, params) => pool.query(text, params);

module.exports = {
  pool,
  query,
  initializeDatabase,
};
