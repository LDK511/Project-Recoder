import express from 'express';
import db from '../db.js';

const router = express.Router();

// GET /api/products - 모든 상품 조회
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, name, price, description, image, stock, category_id FROM products ORDER BY id ASC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// GET /api/products/:id - 특정 상품 조회
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      'SELECT id, name, price, description, image, stock, category_id FROM products WHERE id = $1',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

export default router;