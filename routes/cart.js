const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

// 장바구니 조회
router.get('/', auth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const result = await db.query(
      `SELECT ci.id, ci.product_id, ci.quantity, p.name, p.price, p.image_url
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       WHERE ci.user_id = $1
       ORDER BY ci.id DESC`,
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// 장바구니에 상품 추가
router.post('/add', auth, async (req, res, next) => {
  try {
    const { product_id, quantity } = req.body;
    const userId = req.user.id;

    if (!product_id || !quantity || quantity < 1) {
      return res.status(400).json({ error: 'Invalid product_id or quantity', code: 400 });
    }

    // 상품 존재 여부 확인
    const productCheck = await db.query('SELECT id FROM products WHERE id = $1', [product_id]);
    if (productCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found', code: 404 });
    }

    // 이미 장바구니에 있으면 수량 증가
    const existingItem = await db.query(
      'SELECT id, quantity FROM cart_items WHERE user_id = $1 AND product_id = $2',
      [userId, product_id]
    );

    if (existingItem.rows.length > 0) {
      const newQuantity = existingItem.rows[0].quantity + quantity;
      await db.query(
        'UPDATE cart_items SET quantity = $1 WHERE id = $2',
        [newQuantity, existingItem.rows[0].id]
      );
    } else {
      await db.query(
        'INSERT INTO cart_items (user_id, product_id, quantity) VALUES ($1, $2, $3)',
        [userId, product_id, quantity]
      );
    }

    res.status(201).json({ message: 'Item added to cart' });
  } catch (error) {
    next(error);
  }
});

// 장바구니 항목 수량 업데이트
router.put('/update/:cartItemId', auth, async (req, res, next) => {
  try {
    const { cartItemId } = req.params;
    const { quantity } = req.body;
    const userId = req.user.id;

    if (!quantity || quantity < 1) {
      return res.status(400).json({ error: 'Invalid quantity', code: 400 });
    }

    // 사용자의 장바구니 항목인지 확인
    const cartItem = await db.query(
      'SELECT id FROM cart_items WHERE id = $1 AND user_id = $2',
      [cartItemId, userId]
    );

    if (cartItem.rows.length === 0) {
      return res.status(404).json({ error: 'Cart item not found', code: 404 });
    }

    await db.query('UPDATE cart_items SET quantity = $1 WHERE id = $2', [quantity, cartItemId]);
    res.json({ message: 'Cart item updated' });
  } catch (error) {
    next(error);
  }
});

// 장바구니 항목 삭제
router.delete('/remove/:cartItemId', auth, async (req, res, next) => {
  try {
    const { cartItemId } = req.params;
    const userId = req.user.id;

    // 사용자의 장바구니 항목인지 확인
    const cartItem = await db.query(
      'SELECT id FROM cart_items WHERE id = $1 AND user_id = $2',
      [cartItemId, userId]
    );

    if (cartItem.rows.length === 0) {
      return res.status(404).json({ error: 'Cart item not found', code: 404 });
    }

    await db.query('DELETE FROM cart_items WHERE id = $1', [cartItemId]);
    res.json({ message: 'Cart item removed' });
  } catch (error) {
    next(error);
  }
});

// 장바구니 비우기
router.delete('/clear', auth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    await db.query('DELETE FROM cart_items WHERE user_id = $1', [userId]);
    res.json({ message: 'Cart cleared' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;