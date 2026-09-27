const express = require('express');
const router = express.Router();
const db = require('../db');

// POST /api/cart - 장바구니 생성 및 총액 계산
router.post('/', async (req, res) => {
  try {
    const { items } = req.body; // [{productId, quantity}, ...]

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Invalid items' });
    }

    let total = 0;
    const cartItems = [];

    // 각 상품의 가격을 조회하여 총액 계산
    for (const item of items) {
      const result = await db.query(
        'SELECT id, price FROM products WHERE id = $1',
        [item.productId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: `Product ${item.productId} not found` });
      }

      const product = result.rows[0];
      const itemTotal = parseFloat(product.price) * item.quantity;
      total += itemTotal;

      cartItems.push({
        productId: product.id,
        quantity: item.quantity,
        price: product.price,
        subtotal: itemTotal
      });
    }

    // 장바구니 ID 생성 (UUID 또는 간단한 ID)
    const cartId = `cart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    res.json({
      cartId,
      items: cartItems,
      total: parseFloat(total.toFixed(2))
    });
  } catch (error) {
    console.error('Cart error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;