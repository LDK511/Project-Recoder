const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { Pool } = require('pg');

const router = express.Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Stripe 웹훅 처리 (raw body 필요)
router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object);
        break;
      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object);
        break;
      case 'charge.refunded':
        await handleChargeRefunded(event.data.object);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
    res.json({ received: true });
  } catch (err) {
    console.error('Webhook processing error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

async function handlePaymentIntentSucceeded(paymentIntent) {
  const { metadata, id: paymentIntentId, amount } = paymentIntent;
  const { orderId, email } = metadata;

  if (!orderId) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 주문 상태 업데이트
    await client.query(
      'UPDATE orders SET status = $1, payment_intent_id = $2, updated_at = NOW() WHERE id = $3',
      ['completed', paymentIntentId, orderId]
    );

    // 결제 기록 저장
    await client.query(
      'INSERT INTO payments (order_id, stripe_payment_intent_id, amount, status, created_at) VALUES ($1, $2, $3, $4, NOW())',
      [orderId, paymentIntentId, amount / 100, 'succeeded']
    );

    await client.query('COMMIT');
    console.log(`Payment succeeded for order ${orderId}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error handling payment success:', err);
    throw err;
  } finally {
    client.release();
  }
}

async function handlePaymentIntentFailed(paymentIntent) {
  const { metadata, id: paymentIntentId, last_payment_error } = paymentIntent;
  const { orderId } = metadata;

  if (!orderId) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 주문 상태 업데이트
    await client.query(
      'UPDATE orders SET status = $1, payment_intent_id = $2, updated_at = NOW() WHERE id = $3',
      ['failed', paymentIntentId, orderId]
    );

    // 결제 실패 기록
    await client.query(
      'INSERT INTO payments (order_id, stripe_payment_intent_id, status, error_message, created_at) VALUES ($1, $2, $3, $4, NOW())',
      [orderId, paymentIntentId, 'failed', last_payment_error?.message || 'Unknown error']
    );

    await client.query('COMMIT');
    console.log(`Payment failed for order ${orderId}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error handling payment failure:', err);
    throw err;
  } finally {
    client.release();
  }
}

async function handleChargeRefunded(charge) {
  const { payment_intent: paymentIntentId, amount_refunded } = charge;

  if (!paymentIntentId) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 환불 기록 저장
    await client.query(
      'INSERT INTO refunds (stripe_payment_intent_id, amount, created_at) VALUES ($1, $2, NOW())',
      [paymentIntentId, amount_refunded / 100]
    );

    // 주문 상태 업데이트
    await client.query(
      'UPDATE orders SET status = $1, updated_at = NOW() WHERE payment_intent_id = $2',
      ['refunded', paymentIntentId]
    );

    await client.query('COMMIT');
    console.log(`Refund processed for payment intent ${paymentIntentId}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error handling refund:', err);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = router;