const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { Pool } = require('pg');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/shopping_mall'
});

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Products
app.get('/api/products', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
    res.json(result.rows[0] || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Orders
app.post('/api/orders', async (req, res) => {
  const { user_id, items, total_price, payment_method } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO orders (user_id, items, total_price, payment_method, status, created_at) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *',
      [user_id, JSON.stringify(items), total_price, payment_method, 'pending']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/orders/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
    res.json(result.rows[0] || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Payment processing
app.post('/api/payment', async (req, res) => {
  const { order_id, card_number, amount } = req.body;
  try {
    if (!card_number || card_number.length < 13) {
      return res.status(400).json({ error: 'Invalid card number' });
    }
    await pool.query(
      'UPDATE orders SET status = $1 WHERE id = $2',
      ['completed', order_id]
    );
    res.json({ success: true, order_id, amount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
