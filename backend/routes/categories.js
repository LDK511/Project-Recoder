import express from 'express';
import db from '../db.js';

const router = express.Router();

// GET /api/categories - 모든 카테고리 조회
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, name FROM categories ORDER BY id ASC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

export default router;