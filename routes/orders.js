const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

// 주문 생성
router.post('/create', auth, async (req, res, next) => {
  const client = await db.connect();
  try {
    const userId = req.user.id;
    const { items } = req.body; // items: [{product_id, quantity}, ...]

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'No items in order', code: 400 });
    }

    await client.query('BEGIN');

    // 각 상품의 가격과 재고 확인
    let totalPrice = 0;
    const orderItems = [];

    for (const item of items) {
      const productResult = await client.query(
        'SELECT id, price, stock FROM products WHERE id = $1',
        [item.product_id]
      );

      if (productResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: `Product ${item.product_id} not found`, code: 404 });
      }

      const product = productResult.rows[0];
      if (product.stock < item.quantity) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: `Insufficient stock for product ${item.product_id}`,
          code: 400
        });
      }

      const itemTotal = parseFloat(product.price) * item.quantity;
      totalPrice += itemTotal;
      orderItems.push({
        product_id: item.product_id,
        quantity: item.quantity,
        price: product.price
      });
    }

    // 주문 생성
    const orderResult = await client.query(
      'INSERT INTO orders (user_id, total_price, status) VALUES ($1, $2, $3) RETURNING id',
      [userId, totalPrice, 'pending']
    );
    const orderId = orderResult.rows[0].id;

    // 주문 항목 추가
    for (const item of orderItems) {
      await client.query(
        'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ($1, $2, $3, $4)',
        [orderId, item.product_id, item.quantity, item.price]
      );

      // 상품 재고 감소
      await client.query(
        'UPDATE products SET stock = stock - $1 WHERE id = $2',
        [item.quantity, item.product_id]
      );
    }

    // 장바구니 비우기
    await client.query('DELETE FROM cart_items WHERE user_id = $1', [userId]);

    await client.query('COMMIT');
    res.status(201).json({ orderId, totalPrice, status: 'pending' });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

// 주문 조회 (사용자의 모든 주문)
router.get('/', auth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const result = await db.query(
      `SELECT o.id, o.total_price, o.status, o.created_at
       FROM orders o
       WHERE o.user_id = $1
       ORDER BY o.created_at DESC`,
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// 주문 상세 조회
router.get('/:orderId', auth, async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    // 주문 정보 조회
    const orderResult = await db.query(
      'SELECT id, user_id, total_price, status, created_at FROM orders WHERE id = $1',
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found', code: 404 });
    }

    const order = orderResult.rows[0];

    // 사용자의 주문인지 확인
    if (order.user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized', code: 403 });
    }

    // 주문 항목 조회
    const itemsResult = await db.query(
      `SELECT oi.id, oi.product_id, oi.quantity, oi.price, p.name, p.image_url
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = $1`,
      [orderId]
    );

    res.json({
      ...order,
      items: itemsResult.rows
    });
  } catch (error) {
    next(error);
  }
});

// 주문 상태 업데이트 (관리자용)
router.put('/:orderId/status', auth, async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;
    const userId = req.user.id;

    const validStatuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status', code: 400 });
    }

    // 주문 소유자 확인
    const orderResult = await db.query(
      'SELECT user_id FROM orders WHERE id = $1',
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found', code: 404 });
    }

    if (orderResult.rows[0].user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized', code: 403 });
    }

    await db.query('UPDATE orders SET status = $1 WHERE id = $2', [status, orderId]);
    res.json({ message: 'Order status updated', status });
  } catch (error) {
    next(error);
  }
});

module.exports = router;