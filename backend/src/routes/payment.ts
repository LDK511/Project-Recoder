/**
 * 결제 세션 생성 도우미와 /api/payment 라우트.
 * 결제 웹훅(/api/webhooks/stripe)은 server.ts 에서 JSON 파서보다 먼저 등록합니다.
 */
import { Router, Request } from 'express';
import { createPaymentIntent, isTestPaymentMode } from '../payments/stripe.js';
import { authenticate, getUserId, isAdmin } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/validateRequest.js';
import { getOrderById, setPaymentId } from '../services/orderService.js';
import { ConflictError, PaymentError } from '../utils/errors.js';
import { parseId } from '../utils/validation.js';
import { logger } from '../utils/logger.js';
import { OrderWithItems } from '../types/index.js';

export interface PaymentSession {
  payment_url: string;
  client_secret: string | null;
  test_mode: boolean;
  expires_at: string | null;
}

/** 결제 후 돌아올 주소. PUBLIC_URL 이 있으면 그것을, 없으면 요청 호스트를 사용합니다. */
function returnUrlFor(req: Request, orderId: number): string {
  const base = (process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
  return `${base}/orders/${orderId}?from=payment`;
}

/**
 * 주문에 대한 결제를 시작(또는 이어서 진행)합니다.
 * 같은 주문은 멱등키 order-<id>-<주문키> 로 같은 결제(PaymentIntent)를 돌려받습니다.
 */
export async function createPaymentSession(req: Request, order: OrderWithItems): Promise<PaymentSession> {
  let payment;
  try {
    payment = await createPaymentIntent({
      amount: order.total_cents,
      currency: 'krw',
      orderId: order.id.toString(),
      // 주문 id 만 쓰면 DB 를 초기화했을 때 결제사에 남은 예전 결제와 충돌하므로 주문 고유키를 함께 씁니다.
      idempotencyKey: `order-${order.id}-${order.idempotency_key}`,
    });
  } catch (error) {
    logger.error('Failed to create payment intent', { orderId: order.id, error });
    throw new PaymentError('결제를 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.');
  }
  await setPaymentId(order.id, payment.id);

  // 모의 결제(데모) 모드: 모의 결제 페이지로 이동
  let paymentUrl = '';
  if (isTestPaymentMode()) {
    const mockHost = process.env.STRIPE_MOCK_HOST || 'localhost';
    const mockPort = process.env.STRIPE_MOCK_PORT || '3001';
    const returnUrl = returnUrlFor(req, order.id);
    paymentUrl = `http://${mockHost}:${mockPort}/pay?order_id=${order.id}&amount_cents=${order.total_cents}&currency=krw&return_url=${encodeURIComponent(returnUrl)}`;
  }

  return {
    payment_url: paymentUrl,
    client_secret: payment.clientSecret,
    test_mode: payment.testMode,
    expires_at: order.expires_at,
  };
}

const router = Router();

/** POST /api/payment/orders/:id — 결제대기 주문의 결제를 다시 진행(결제창을 닫았을 때 등) */
router.post(
  '/orders/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const order = await getOrderById(parseId(req.params.id), getUserId(req), isAdmin(req));
    if (order.user_id !== getUserId(req)) throw new ConflictError('본인 주문만 결제할 수 있습니다.');
    if (order.status !== 'pending') throw new ConflictError('결제 대기 중인 주문이 아닙니다.', 'INVALID_ORDER_STATE');
    if (order.expires_at && new Date(order.expires_at).getTime() < Date.now()) {
      throw new ConflictError('결제 가능 시간이 지났습니다. 다시 주문해 주세요.', 'ORDER_EXPIRED');
    }
    res.json({ order_id: order.id, total_cents: order.total_cents, ...(await createPaymentSession(req, order)) });
  })
);

export default router;
