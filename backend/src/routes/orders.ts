import { Router } from 'express';
import { authenticate, getUserId, isAdmin } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/validateRequest.js';
import { createRateLimiter } from '../middleware/rateLimiter.js';
import * as orderService from '../services/orderService.js';
import { refundOrderPayment } from '../services/paymentService.js';
import { createPaymentSession } from './payment.js';
import { optionalTrimmed, parseId, parsePagination } from '../utils/validation.js';
import { logger } from '../utils/logger.js';

const router = Router();
router.use(authenticate);

const checkoutLimiter = createRateLimiter(60 * 1000, 20, '주문 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.');

/**
 * POST /api/orders/checkout
 * { idempotency_key, cart_items: [{product_id, quantity}], shipping: {recipient_name, recipient_phone, postal_code, address1, address2?, delivery_memo?} }
 * → 주문(결제대기)을 만들고 결제 정보를 돌려줍니다.
 */
router.post(
  '/checkout',
  checkoutLimiter,
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const { order } = await orderService.createOrder(userId, req.body ?? {});

    if (order.status !== 'pending') {
      // 같은 요청이 이미 결제까지 끝난 경우
      return res.status(200).json({ order_id: order.id, order_number: order.order_number, status: order.status, total_cents: order.total_cents, currency: order.currency, payment_url: '', client_secret: null, test_mode: false });
    }

    try {
      const session = await createPaymentSession(req, order);
      res.status(201).json({
        order_id: order.id,
        order_number: order.order_number,
        status: order.status,
        subtotal_cents: order.subtotal_cents,
        shipping_fee_cents: order.shipping_fee_cents,
        total_cents: order.total_cents,
        currency: order.currency,
        ...session,
      });
    } catch (error) {
      // 결제를 시작하지 못하면 재고가 묶이지 않도록 주문을 바로 취소합니다.
      await orderService
        .cancelOrder(order.id, { actor: 'system', reason: '결제 시작 실패', allowedFrom: ['pending'] })
        .catch((e) => logger.error('Failed to roll back order after payment error', { orderId: order.id, e }));
      throw error;
    }
  })
);

/** GET /api/orders?page&limit — 내 주문 목록 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, limit } = parsePagination(req.query as Record<string, unknown>, 10, 50);
    res.json(await orderService.getUserOrders(getUserId(req), page, limit));
  })
);

/** GET /api/orders/:id — 주문 상세(상태 이력 포함) */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(await orderService.getOrderById(parseId(req.params.id), getUserId(req), isAdmin(req)));
  })
);

/** POST /api/orders/:id/cancel { reason? } — 결제대기/결제완료 단계에서 고객 직접 취소(결제됐으면 환불) */
router.post(
  '/:id/cancel',
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const orderId = parseId(req.params.id);
    await orderService.cancelOrder(orderId, {
      userId,
      actor: 'customer',
      reason: optionalTrimmed(req.body?.reason, 255),
      allowedFrom: orderService.CUSTOMER_CANCELLABLE,
      refund: refundOrderPayment,
    });
    res.json(await orderService.getOrderById(orderId, userId, false));
  })
);

export default router;
