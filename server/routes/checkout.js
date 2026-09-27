const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const db = require('../db');

// POST /api/checkout - Stripe Payment Intent 생성 및 주문 저장
router.post('/', async (req, res) => {
  try {
    const { cartId, email, items, total } = req.body;

    if (!email || !items || !total) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // 고객 정보 저장 또는 조회
    let customerResult = await db.query(
      'SELECT id FROM customers WHERE email = $1',
      [email]
    );

    let customerId;
    if (customerResult.rows.length === 0) {
      const insertResult = await db.query(
        'INSERT INTO customers (email) VALUES ($1) RETURNING id',
        [email]
      );
      customerId = insertResult.rows[0].id;
    } else {
      customerId = customerResult.rows[0].id;
    }

    // Stripe Payment Intent 생성
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(total * 100), // 센트 단위
      currency: 'usd',
      metadata: {
        cartId,
        customerId,
        email
      }
    });

    // 주문 저장
    const orderResult = await db.query(
      'INSERT INTO orders (customer_id, total, status, stripe_payment_intent_id) VALUES ($1, $2, $3, $4) RETURNING id',
      [customerId, total, 'pending', paymentIntent.id]
    );

    const orderId = orderResult.rows[0].id;

    // 주문 항목 저장
    for (const item of items) {
      await db.query(
        'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ($1, $2, $3, $4)',
        [orderId, item.productId, item.quantity, item.price]
      );
    }

    res.json({
      clientSecret: paymentIntent.client_secret,
      sessionId: orderId,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;