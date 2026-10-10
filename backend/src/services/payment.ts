import { PoolClient } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { query, transaction, withLock } from '../db.js';
import { Payment, WebhookEvent, Order } from '../types.js';
import { createPaymentIntent, isTestPaymentMode } from '../payments/stripe.js';

/**
 * 결제 의도를 생성하고 결제를 시작합니다.
 * 주문이 pending 상태여야 하고, 결제 정보를 DB에 저장합니다.
 */
export async function initiatePayment(orderId: number): Promise<{
  payment_id: string;
  order_id: number;
  amount: number;
  currency: string;
  status: string;
  client_secret: string | null;
  test_mode: boolean;
}> {
  // 주문 정보 조회
  const orderResult = await query<Order>(
    'SELECT * FROM orders WHERE id = $1',
    [orderId],
  );

  if (orderResult.rows.length === 0) {
    throw new Error('Order not found');
  }

  const order = orderResult.rows[0];

  if (order.status !== 'pending') {
    throw new Error('Order is not in pending status');
  }

  if (order.total_amount <= 0) {
    throw new Error('Order amount must be greater than 0');
  }

  // Stripe PaymentIntent 생성
  const paymentIntentResult = await createPaymentIntent({
    amount: order.total_amount,
    currency: 'krw',
    orderId: orderId,
    idempotencyKey: `order-${orderId}`,
  });

  // 결제 정보를 DB에 저장
  const paymentId = uuidv4();
  const paymentResult = await query<Payment>(
    `INSERT INTO payments (payment_id, order_id, amount, currency, status)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [paymentId, orderId, order.total_amount, 'KRW', 'pending'],
  );

  const payment = paymentResult.rows[0];

  return {
    payment_id: payment.payment_id,
    order_id: payment.order_id,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
    client_secret: paymentIntentResult.clientSecret,
    test_mode: isTestPaymentMode(),
  };
}

/**
 * 웹훅 서명을 검증합니다.
 * Stripe 웹훅의 경우 stripe.js 모듈에서 처리하므로 여기서는 기본 구조만 제공합니다.
 */
export async function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  // Stripe 웹훅은 stripe.js 모듈의 constructEvent에서 검증됩니다.
  // 이 함수는 다른 결제 제공자 지원 시 확장될 수 있습니다.
  return true;
}

/**
 * 웹훅 이벤트를 처리합니다.
 * 결제 완료 시 주문 상태를 'paid'로 변경하고, 재고 예약을 확정합니다.
 * 같은 eventId는 한 번만 처리됩니다 (멱등성).
 */
export async function processWebhook(params: {
  eventId: string;
  orderId: number;
  paymentIntentId: string;
  amount: number;
  currency: string;
  status: 'completed' | 'failed';
}): Promise<void> {
  await transaction(async (client: PoolClient) => {
    // 이미 처리된 이벤트인지 확인
    const existingEventResult = await client.query<WebhookEvent>(
      'SELECT * FROM webhook_events WHERE event_id = $1',
      [params.eventId],
    );

    if (existingEventResult.rows.length > 0) {
      // 이미 처리된 이벤트 - 멱등성 보장
      return;
    }

    // 주문 정보 조회 및 잠금
    const orderResult = await client.query<Order>(
      'SELECT * FROM orders WHERE id = $1 FOR UPDATE',
      [params.orderId],
    );

    if (orderResult.rows.length === 0) {
      throw new Error('Order not found');
    }

    const order = orderResult.rows[0];

    // 결제 정보 조회
    const paymentResult = await client.query<Payment>(
      'SELECT * FROM payments WHERE order_id = $1',
      [params.orderId],
    );

    if (paymentResult.rows.length === 0) {
      throw new Error('Payment not found');
    }

    const payment = paymentResult.rows[0];

    // 금액 검증 (클라이언트 입력을 신뢰하지 않음)
    if (params.amount !== order.total_amount) {
      throw new Error('Payment amount does not match order total');
    }

    // 통화 검증
    if (params.currency.toUpperCase() !== 'KRW') {
      throw new Error('Invalid currency');
    }

    if (params.status === 'completed') {
      // 결제 완료 처리
      await client.query(
        'UPDATE payments SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['completed', payment.id],
      );

      // 주문 상태를 'paid'로 변경
      await client.query(
        'UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['paid', params.orderId],
      );

      // 웹훅 이벤트 기록 (중복 처리 방지)
      await client.query(
        `INSERT INTO webhook_events (event_id, payment_id, status)
         VALUES ($1, $2, $3)`,
        [params.eventId, params.paymentIntentId, 'completed'],
      );
    } else if (params.status === 'failed') {
      // 결제 실패 처리
      await client.query(
        'UPDATE payments SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['failed', payment.id],
      );

      // 주문 상태를 'cancelled'로 변경
      await client.query(
        'UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['cancelled', params.orderId],
      );

      // 재고 예약 해제 (재고 복원)
      const reservationsResult = await client.query(
        'SELECT * FROM stock_reservations WHERE order_id = $1',
        [params.orderId],
      );

      for (const reservation of reservationsResult.rows) {
        await client.query(
          `UPDATE products SET stock = stock + $1, updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [reservation.quantity, reservation.product_id],
        );
      }

      // 재고 예약 삭제
      await client.query(
        'DELETE FROM stock_reservations WHERE order_id = $1',
        [params.orderId],
      );

      // 웹훅 이벤트 기록
      await client.query(
        `INSERT INTO webhook_events (event_id, payment_id, status)
         VALUES ($1, $2, $3)`,
        [params.eventId, params.paymentIntentId, 'failed'],
      );
    }
  });
}

/**
 * 결제 정보를 조회합니다.
 */
export async function getPayment(paymentId: string): Promise<Payment | null> {
  const result = await query<Payment>(
    'SELECT * FROM payments WHERE payment_id = $1',
    [paymentId],
  );

  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * 주문의 결제 정보를 조회합니다.
 */
export async function getPaymentByOrderId(orderId: number): Promise<Payment | null> {
  const result = await query<Payment>(
    'SELECT * FROM payments WHERE order_id = $1',
    [orderId],
  );

  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * 미결제 주문을 취소합니다 (타임아웃 또는 사용자 요청).
 * 재고 예약을 해제하고 주문 상태를 'cancelled'로 변경합니다.
 */
export async function cancelPendingOrder(orderId: number): Promise<void> {
  await transaction(async (client: PoolClient) => {
    // 주문 정보 조회 및 잠금
    const orderResult = await client.query<Order>(
      'SELECT * FROM orders WHERE id = $1 FOR UPDATE',
      [orderId],
    );

    if (orderResult.rows.length === 0) {
      throw new Error('Order not found');
    }

    const order = orderResult.rows[0];

    if (order.status !== 'pending') {
      throw new Error('Only pending orders can be cancelled');
    }

    // 주문 상태를 'cancelled'로 변경
    await client.query(
      'UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['cancelled', orderId],
    );

    // 재고 예약 해제
    const reservationsResult = await client.query(
      'SELECT * FROM stock_reservations WHERE order_id = $1',
      [orderId],
    );

    for (const reservation of reservationsResult.rows) {
      await client.query(
        `UPDATE products SET stock = stock + $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [reservation.quantity, reservation.product_id],
      );
    }

    // 재고 예약 삭제
    await client.query(
      'DELETE FROM stock_reservations WHERE order_id = $1',
      [orderId],
    );

    // 결제 정보 상태 업데이트
    await client.query(
      'UPDATE payments SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE order_id = $2',
      ['failed', orderId],
    );
  });
}
