CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  stock INT DEFAULT 0,
  image_url VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  items JSONB,
  total_price DECIMAL(10, 2),
  payment_method VARCHAR(50),
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO products (name, description, price, stock, image_url) VALUES
('Laptop', 'High-performance laptop', 1200.00, 10, 'https://via.placeholder.com/300?text=Laptop'),
('Mouse', 'Wireless mouse', 25.00, 50, 'https://via.placeholder.com/300?text=Mouse'),
('Keyboard', 'Mechanical keyboard', 80.00, 30, 'https://via.placeholder.com/300?text=Keyboard'),
('Monitor', '4K monitor', 400.00, 15, 'https://via.placeholder.com/300?text=Monitor'),
('Headphones', 'Noise-cancelling headphones', 150.00, 25, 'https://via.placeholder.com/300?text=Headphones')
ON CONFLICT DO NOTHING;
