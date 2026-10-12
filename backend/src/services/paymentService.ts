/**
 * 결제 처리 서비스 — 결제사 웹훅 처리, 환불.
 * Stripe 연동 자체(클라이언트, 서명 검증)는 payments/stripe.ts(플랫폼 관리 파일)를 그대로 사용합니다.
 */
import { query, transaction } from '../config/database.js';
import { getStripe, isTestPaymentMode, PaymentEvent } from '../payments/stripe.js';
import { Order, PaymentEventRecord } from '../types/index.js';
import { PaymentError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { addHistory } from './orderService.js';

type EventType = PaymentEventRecord['event_type'];

/** 결제 이벤트를 기록합니다. 이미 처리한 이벤트(event_id 중복)면 false 를 돌려줍니다. */
export async function recordPaymentEvent(
  eventId: string,
  orderId: number,
  eventType: EventType,
  payload: Record<string, unknown> | null
): Promise<boolean> {
  const r = await query(
    `INSERT INTO payment_events (order_id, event_id, event_type, payload)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (event_id) DO NOTHING
     RETURNING id`,
    [orderId, eventId, eventType, payload ? JSON.stringify(payload) : null]
  );
  return r.rows.length > 0;
}

export async function getOrderForPayment(orderId: number) {
  const r = await query('SELECT id, user_id, status, total_cents, currency, payment_id FROM orders WHERE id = $1', [orderId]);
  return (r.rows[0] as Pick<Order, 'id' | 'user_id' | 'status' | 'total_cents' | 'currency' | 'payment_id'>) ?? null;
}

/**
 * 결제 금액을 환불합니다. 멱등키(refund-order-<id>)를 써서 여러 번 호출돼도 한 번만 환불됩니다.
 * 모의 결제(데모) 모드에서는 결제사 호출이 실패해도 진행합니다(실제 돈이 오가지 않음).
 */
export async function refundOrderPayment(order: Pick<Order, 'id' | 'payment_id' | 'total_cents'>): Promise<void> {
  if (!order.payment_id) {
    if (isTestPaymentMode()) return;
    throw new PaymentError('결제 정보가 없어 자동 환불할 수 없습니다. 결제사 관리자 화면에서 환불해 주세요.');
  }
  try {
    await getStripe().refunds.create(
      { payment_intent: order.payment_id, metadata: { orderId: String(order.id) } },
      { idempotencyKey: `refund-order-${order.id}` }
    );
    await recordPaymentEvent(`refund-order-${order.id}`, order.id, 'refunded', {
      paymentIntentId: order.payment_id,
      amount: order.total_cents,
    });
    logger.info('Payment refunded', { orderId: order.id, paymentIntentId: order.payment_id });
  } catch (error) {
    if (isTestPaymentMode()) {
      logger.warn('Refund call failed in mock payment mode; continuing', { orderId: order.id, error });
      await recordPaymentEvent(`refund-order-${order.id}`, order.id, 'refunded', { mock: true }).catch(() => undefined);
      return;
    }
    logger.error('Refund failed', { orderId: order.id, error });
    throw new PaymentError('환불 처리에 실패했습니다. 잠시 후 다시 시도하거나 고객센터로 문의해 주세요.');
  }
}

/**
 * 결제 완료 웹훅 처리 (payment_intent.succeeded).
 *  - 이벤트 기록과 주문 상태 변경을 한 트랜잭션으로 처리해 '기록만 되고 주문은 안 바뀌는' 상태를 막습니다.
 *  - 같은 이벤트가 여러 번 와도 한 번만 반영합니다.
 *  - 금액/통화가 주문과 다르면 결제 완료로 처리하지 않습니다.
 *  - 이미 취소·만료된 주문에 결제가 들어오면 자동 환불합니다.
 */
export async function handlePaymentSucceeded(event: PaymentEvent): Promise<void> {
  const orderId = parseInt(event.orderId, 10);
  if (!Number.isInteger(orderId)) {
    logger.error('Invalid orderId in payment event', { eventId: event.eventId, orderId: event.orderId });
    return;
  }

  const outcome = await transaction(async (client) => {
    const inserted = await client.query(
      `INSERT INTO payment_events (order_id, event_id, event_type, payload)
       SELECT $1, $2, 'completed', $3 WHERE EXISTS (SELECT 1 FROM orders WHERE id = $1)
       ON CONFLICT (event_id) DO NOTHING RETURNING id`,
      [orderId, event.eventId, JSON.stringify(event)]
    );
    if (inserted.rows.length === 0) {
      const exists = await client.query('SELECT 1 FROM orders WHERE id = $1', [orderId]);
      return exists.rows.length ? 'duplicate' : 'order_not_found';
    }

    const r = await client.query(
      'SELECT id, user_id, status, total_cents, currency FROM orders WHERE id = $1 FOR UPDATE',
      [orderId]
    );
    const order = r.rows[0];
    if (order.total_cents !== event.amount || String(order.currency).toLowerCase() !== String(event.currency).toLowerCase()) {
      logger.error('Payment amount or currency mismatch', {
        eventId: event.eventId,
        orderId,
        expected: { amount: order.total_cents, currency: order.currency },
        received: { amount: event.amount, currency: event.currency },
      });
      return 'mismatch';
    }

    if (order.status !== 'pending') {
      if (order.status === 'cancelled' || order.status === 'expired') return 'needs_refund';
      return 'already_processed';
    }

    await client.query(
      `UPDATE orders SET status = 'paid', payment_id = $2, paid_at = CURRENT_TIMESTAMP, expires_at = NULL,
              updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [orderId, event.paymentIntentId]
    );
    await addHistory(client, orderId, 'pending', 'paid', 'payment', '결제 완료');
    // 결제가 끝난 상품은 장바구니에서 비웁니다.
    await client.query(
      `DELETE FROM cart_items WHERE user_id = $1 AND product_id IN (SELECT product_id FROM order_items WHERE order_id = $2)`,
      [order.user_id, orderId]
    );
    return 'paid';
  });

  if (outcome === 'needs_refund') {
    logger.warn('Payment received for cancelled/expired order; refunding automatically', { orderId, eventId: event.eventId });
    await query('UPDATE orders SET payment_id = $2 WHERE id = $1', [orderId, event.paymentIntentId]);
    await refundOrderPayment({ id: orderId, payment_id: event.paymentIntentId, total_cents: event.amount });
    await transaction(async (client) => {
      const r = await client.query('SELECT status FROM orders WHERE id = $1', [orderId]);
      await addHistory(client, orderId, r.rows[0].status, r.rows[0].status, 'payment', '취소된 주문에 결제가 들어와 자동 환불');
    });
    return;
  }
  logger.info('Payment webhook processed', { orderId, eventId: event.eventId, outcome });
}

/** 결제 실패 웹훅 (payment_intent.payment_failed) — 기록만 남깁니다. 주문은 결제 시간 내 재시도할 수 있습니다. */
export async function handlePaymentFailed(event: PaymentEvent): Promise<void> {
  const orderId = parseInt(event.orderId, 10);
  if (!Number.isInteger(orderId)) return;
  const order = await getOrderForPayment(orderId);
  if (!order) return;
  const recorded = await recordPaymentEvent(event.eventId, orderId, 'failed', { ...event });
  if (recorded) logger.info('Payment failed event recorded', { orderId, eventId: event.eventId });
}
