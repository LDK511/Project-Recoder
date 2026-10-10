import { Router, Request, Response } from 'express';
import { authMiddleware, getUser } from '../middleware/auth.js';
import { asyncHandler, ValidationError, NotFoundError } from '../middleware/errorHandler.js';
import { query as dbQuery, transaction } from '../db.js';
import { createPaymentIntent, createStripeWebhookRouter, STRIPE_WEBHOOK_PATH } from '../payments/stripe.js';
import { isPositiveInteger } from '../utils/validation.js';
import { Order, Payment, WebhookEvent } from '../types.js';

const router = Router();

/**
 * POST /api/payment/checkout
 * 주문에 대한 결제 의도를 생성합니다.
 */
router.post(
  '/checkout',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const user = getUser(req);
    const { order_id } = req.body;

    if (!isPositiveInteger(order_id)) {
      throw new ValidationError('order_id must be a positive integer');
    }

    // 주문 조회
    const orderResult = await dbQuery<Order>(
      'SELECT * FROM orders WHERE id = $1 AND user_id = $2',
      [order_id, user.id],
    );

    if (orderResult.rows.length === 0) {
      throw new NotFoundError('Order not found');
    }

    const order = orderResult.rows[0];

    if (order.status !== 'pending') {
      throw new ValidationError(`Order status is ${order.status}, cannot initiate payment`);
    }

    // 결제 의도 생성
    const payment = await createPaymentIntent({
      amount: order.total_amount,
      currency: 'krw',
      orderId: order.id,
      idempotencyKey: `order-${order.id}`,
    });

    // 결제 기록 저장
    const paymentResult = await dbQuery<Payment>(
      `INSERT INTO payments (payment_id, order_id, amount, currency, status)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (payment_id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [payment.id, order.id, order.total_amount, 'KRW', 'pending'],
    );

    res.json({
      payment_id: payment.id,
      order_id: order.id,
      amount: order.total_amount,
      currency: 'KRW',
      status: 'pending',
      client_secret: payment.clientSecret,
      test_mode: payment.testMode,
    });
  }),
);

/**
 * 웹훅 핸들러: 결제 완료 처리
 */
async function onPaymentSucceeded(event: {
  eventId: string;
  orderId: string;
  paymentIntentId: string;
  amount: number;
  currency: string;
}): Promise<void> {
  await transaction(async (client) => {
    // 이벤트 중복 확인
    const eventCheckResult = await client.query(
      'SELECT id FROM webhook_events WHERE event_id = $1',
      [event.eventId],
    );

    if (eventCheckResult.rows.length > 0) {
      // 이미 처리된 이벤트
      return;
    }

    // 주문 조회
    const orderResult = await client.query<Order>(
      'SELECT * FROM orders WHERE id = $1 FOR UPDATE',
      [event.orderId],
    );

    if (orderResult.rows.length === 0) {
      throw new Error(`Order ${event.orderId} not found`);
    }

    const order = orderResult.rows[0];

    // 금액 검증
    if (order.total_amount !== event.amount) {
      throw new Error(
        `Amount mismatch: order ${order.total_amount}, payment ${event.amount}`,
      );
    }

    // 주문 상태를 'paid'로 업데이트
    await client.query(
      'UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['paid', order.id],
    );

    // 결제 상태 업데이트
    await client.query(
      'UPDATE payments SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE payment_id = $2',
      ['completed', event.paymentIntentId],
    );

    // 웹훅 이벤트 기록 (중복 방지)
    await client.query(
      'INSERT INTO webhook_events (event_id, payment_id, status) VALUES ($1, $2, $3)',
      [event.eventId, event.paymentIntentId, 'completed'],
    );
  });
}

/**
 * 웹훅 핸들러: 결제 실패 처리
 */
async function onPaymentFailed(event: {
  eventId: string;
  orderId: string;
  paymentIntentId: string;
  amount: number;
  currency: string;
}): Promise<void> {
  await transaction(async (client) => {
    // 이벤트 중복 확인
    const eventCheckResult = await client.query(
      'SELECT id FROM webhook_events WHERE event_id = $1',
      [event.eventId],
    );

    if (eventCheckResult.rows.length > 0) {
      // 이미 처리된 이벤트
      return;
    }

    // 결제 상태 업데이트
    await client.query(
      'UPDATE payments SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE payment_id = $2',
      ['failed', event.paymentIntentId],
    );

    // 웹훅 이벤트 기록
    await client.query(
      'INSERT INTO webhook_events (event_id, payment_id, status) VALUES ($1, $2, $3)',
      [event.eventId, event.paymentIntentId, 'failed'],
    );
  });
}

/**
 * Stripe 웹훅 라우터 등록
 * 이 라우터는 express.json() 보다 먼저 등록되어야 합니다.
 */
const webhookRouter = createStripeWebhookRouter({
  onPaymentSucceeded,
  onPaymentFailed,
});

export { router as paymentRouter, webhookRouter, STRIPE_WEBHOOK_PATH };
