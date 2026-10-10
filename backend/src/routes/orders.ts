import { Router, Request, Response } from 'express';
import { authMiddleware, getUser, adminMiddleware } from '../middleware/auth.js';
import { asyncHandler, ValidationError, NotFoundError, ForbiddenError } from '../middleware/errorHandler.js';
import {
  createOrder,
  getOrder,
  getOrders,
  cancelOrder,
  getOrdersByAdmin,
} from '../services/order.js';
import { createPaymentIntent } from '../payments/stripe.js';
import { isPositiveInteger, normalizePageNumber, normalizeLimitNumber, isValidIdempotencyKey } from '../utils/validation.js';

const router = Router();

/**
 * POST /api/orders
 * 새 주문을 생성합니다.
 * 요청: { idempotency_key: string }
 * 응답: { id, user_id, total_amount, status, items, created_at }
 */
router.post(
  '/',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const user = getUser(req);
    const { idempotency_key } = req.body;

    // 입력 검증
    if (!idempotency_key || !isValidIdempotencyKey(idempotency_key)) {
      throw new ValidationError('idempotency_key is required and must be valid');
    }

    const order = await createOrder(user.id, idempotency_key);
    res.status(201).json(order);
  }),
);

/**
 * GET /api/orders
 * 현재 사용자의 주문 목록을 조회합니다.
 * 쿼리: { page?: number, limit?: number }
 */
router.get(
  '/',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const user = getUser(req);
    const page = normalizePageNumber(req.query.page);
    const limit = normalizeLimitNumber(req.query.limit);

    const result = await getOrders(user.id, page, limit);
    res.json(result);
  }),
);

/**
 * GET /api/orders/:id
 * 특정 주문의 상세 정보를 조회합니다.
 * 사용자는 자신의 주문만 조회 가능, 관리자는 모든 주문 조회 가능
 */
router.get(
  '/:id',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const user = getUser(req);
    const { id } = req.params;

    if (!isPositiveInteger(id)) {
      throw new ValidationError('id must be a positive integer');
    }

    const order = await getOrder(Number(id));
    if (!order) {
      throw new NotFoundError('Order not found');
    }

    // 권한 확인: 자신의 주문이거나 관리자
    if (order.user_id !== user.id && user.role !== 'admin') {
      throw new ForbiddenError('You do not have permission to view this order');
    }

    res.json(order);
  }),
);

/**
 * POST /api/orders/:id/cancel
 * 주문을 취소합니다.
 * 상태가 'pending'일 때만 취소 가능
 */
router.post(
  '/:id/cancel',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const user = getUser(req);
    const { id } = req.params;

    if (!isPositiveInteger(id)) {
      throw new ValidationError('id must be a positive integer');
    }

    const order = await getOrder(Number(id));
    if (!order) {
      throw new NotFoundError('Order not found');
    }

    // 권한 확인: 자신의 주문이어야 함
    if (order.user_id !== user.id) {
      throw new ForbiddenError('You do not have permission to cancel this order');
    }

    // 상태 확인: pending 상태만 취소 가능
    if (order.status !== 'pending') {
      throw new ValidationError(`Cannot cancel order with status '${order.status}'`);
    }

    const cancelledOrder = await cancelOrder(Number(id));
    res.json(cancelledOrder);
  }),
);

/**
 * POST /api/payment/checkout
 * 주문에 대한 결제를 시작합니다.
 * 요청: { order_id: number }
 * 응답: { payment_id, order_id, amount, currency, status, client_secret?, test_mode }
 */
router.post(
  '/payment/checkout',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const user = getUser(req);
    const { order_id } = req.body;

    if (!isPositiveInteger(order_id)) {
      throw new ValidationError('order_id must be a positive integer');
    }

    const order = await getOrder(Number(order_id));
    if (!order) {
      throw new NotFoundError('Order not found');
    }

    // 권한 확인
    if (order.user_id !== user.id) {
      throw new ForbiddenError('You do not have permission to checkout this order');
    }

    // 상태 확인: pending 상태만 결제 가능
    if (order.status !== 'pending') {
      throw new ValidationError(`Cannot checkout order with status '${order.status}'`);
    }

    // Stripe PaymentIntent 생성
    const payment = await createPaymentIntent({
      amount: order.total_amount,
      currency: 'krw',
      orderId: order.id,
      idempotencyKey: `order-${order.id}`,
    });

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
 * GET /api/admin/orders
 * 관리자용: 모든 주문을 조회합니다.
 * 쿼리: { page?: number, limit?: number, status?: string }
 */
router.get(
  '/admin/orders',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const page = normalizePageNumber(req.query.page);
    const limit = normalizeLimitNumber(req.query.limit);
    const status = req.query.status ? String(req.query.status) : undefined;

    const result = await getOrdersByAdmin(page, limit, status);
    res.json(result);
  }),
);

export default router;
