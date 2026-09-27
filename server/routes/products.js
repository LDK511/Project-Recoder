const express = require('express');
const { query } = require('../db');

const router = express.Router();

// GET /api/products - 모든 상품 조회
router.get('/', async (req, res) => {
  try {
    const result = await query('SELECT id, name, price, image, description FROM products ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// GET /api/products/:id - 특정 상품 조회
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('SELECT id, name, price, image, description FROM products WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching product:', err);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

module.exports = router;
