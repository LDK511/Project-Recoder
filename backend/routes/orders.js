import express from 'express';
import db from '../db.js';

const router = express.Router();

// POST /api/orders - 주문 생성
router.post('/', async (req, res) => {
  const client = await db.connect();
  try {
    const { items, customerName, email, address } = req.body;

    // 입력값 검증
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items array is required and must not be empty' });
    }
    if (!customerName || !email || !address) {
      return res.status(400).json({ error: 'customerName, email, and address are required' });
    }

    await client.query('BEGIN');

    // 총액 계산 및 재고 확인
    let total = 0;
    for (const item of items) {
      const productResult = await client.query(
        'SELECT price, stock FROM products WHERE id = $1',
        [item.productId]
      );
      if (productResult.rows.length === 0) {
        throw new Error(`Product ${item.productId} not found`);
      }
      const product = productResult.rows[0];
      if (product.stock < item.quantity) {
        throw new Error(`Insufficient stock for product ${item.productId}`);
      }
      total += parseFloat(product.price) * item.quantity;
    }

    // 주문 생성
    const orderResult = await client.query(
      'INSERT INTO orders (customer_name, email, address, total, status) VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at',
      [customerName, email, address, total, 'pending']
    );
    const orderId = orderResult.rows[0].id;

    // 주문 항목 추가 및 재고 감소
    for (const item of items) {
      await client.query(
        'INSERT INTO order_items (order_id, product_id, quantity) VALUES ($1, $2, $3)',
        [orderId, item.productId, item.quantity]
      );
      await client.query(
        'UPDATE products SET stock = stock - $1 WHERE id = $2',
        [item.quantity, item.productId]
      );
    }

    await client.query('COMMIT');

    res.status(201).json({
      orderId,
      total,
      status: 'pending',
      createdAt: orderResult.rows[0].created_at
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating order:', error);
    res.status(500).json({ error: error.message || 'Failed to create order' });
  } finally {
    client.release();
  }
});

// GET /api/orders/:orderId - 주문 조회
router.get('/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;

    // 주문 정보 조회
    const orderResult = await db.query(
      'SELECT id, customer_name, email, address, total, status, created_at FROM orders WHERE id = $1',
      [orderId]
    );
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    const order = orderResult.rows[0];

    // 주문 항목 조회
    const itemsResult = await db.query(
      `SELECT oi.product_id, oi.quantity, p.name, p.price, p.image
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = $1`,
      [orderId]
    );

    res.json({
      orderId: order.id,
      customerName: order.customer_name,
      email: order.email,
      address: order.address,
      items: itemsResult.rows.map(row => ({
        productId: row.product_id,
        name: row.name,
        price: row.price,
        quantity: row.quantity,
        image: row.image
      })),
      total: order.total,
      status: order.status,
      createdAt: order.created_at
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

export default router;