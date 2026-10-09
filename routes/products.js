const express = require('express');
const db = require('../db');

const router = express.Router();

// 상품 목록 조회 (페이지네이션 지원)
router.get('/', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // 전체 상품 수
    const countResult = await db.query('SELECT COUNT(*) as total FROM products');
    const total = parseInt(countResult.rows[0].total);

    // 상품 목록 조회
    const result = await db.query(
      'SELECT id, name, description, price, stock, image_url, created_at FROM products ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );

    res.json({
      products: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

// 상품 상세 조회
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'SELECT id, name, description, price, stock, image_url, created_at FROM products WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found', code: 404 });
    }

    res.json({ product: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// 상품 검색
router.get('/search/query', async (req, res, next) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Search query is required', code: 400 });
    }

    const searchTerm = `%${q}%`;
    const result = await db.query(
      'SELECT id, name, description, price, stock, image_url, created_at FROM products WHERE name ILIKE $1 OR description ILIKE $1 ORDER BY created_at DESC',
      [searchTerm]
    );

    res.json({ products: result.rows });
  } catch (error) {
    next(error);
  }
});

module.exports = router;