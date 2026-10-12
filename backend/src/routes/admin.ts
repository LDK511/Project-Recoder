import { Router } from 'express';
import { adminOnly } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/validateRequest.js';
import * as orderService from '../services/orderService.js';
import { getProducts } from '../services/productService.js';
import { refundOrderPayment } from '../services/paymentService.js';
import { optionalTrimmed, parseId, parsePagination } from '../utils/validation.js';
import { parseListQuery } from './products.js';
import { OrderStatus } from '../types/index.js';

const router = Router();
router.use(...adminOnly);

const actorOf = (req: any) => `admin:${req.user?.email ?? req.user?.userId}`;

/** GET /api/admin/stats — 대시보드 지표 */
router.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(await orderService.getDashboardStats());
  })
);

/** GET /api/admin/orders?page&limit&status&q — 전체 주문(고객 정보 포함) */
router.get(
  '/orders',
  asyncHandler(async (req, res) => {
    const q = req.query as Record<string, unknown>;
    const { page, limit } = parsePagination(q, 20, 100);
    res.json(
      await orderService.getAllOrders({
        page,
        limit,
        status: optionalTrimmed(q.status, 20) ?? undefined,
        q: optionalTrimmed(q.q, 100) ?? undefined,
      })
    );
  })
);

/** GET /api/admin/orders/:id */
router.get(
  '/orders/:id',
  asyncHandler(async (req, res) => {
    res.json(await orderService.getOrderById(parseId(req.params.id), 0, true));
  })
);

/**
 * PUT /api/admin/orders/:id/status { status, tracking_carrier?, tracking_number?, note? }
 * 허용 흐름: 결제완료→상품준비중→배송중(송장 필수)→배송완료, 배송완료→환불, 배송 전 취소(자동 환불)
 */
router.put(
  '/orders/:id/status',
  asyncHandler(async (req, res) => {
    const orderId = parseId(req.params.id);
    const status = String(req.body?.status ?? '') as OrderStatus;
    if (status === 'cancelled') {
      await orderService.cancelOrder(orderId, {
        actor: actorOf(req),
        reason: optionalTrimmed(req.body?.note, 255) ?? '판매자 취소',
        allowedFrom: ['pending', 'paid', 'preparing'],
        refund: refundOrderPayment,
      });
    } else {
      await orderService.updateOrderStatus(orderId, status, actorOf(req), {
        tracking_carrier: req.body?.tracking_carrier,
        tracking_number: req.body?.tracking_number,
        note: req.body?.note,
        refund: refundOrderPayment,
      });
    }
    res.json(await orderService.getOrderById(orderId, 0, true));
  })
);

/** GET /api/admin/products — 판매중지 상품 포함 전체 목록 */
router.get(
  '/products',
  asyncHandler(async (req, res) => {
    const opts = parseListQuery(req.query as Record<string, unknown>, 100);
    const result = await getProducts({ ...opts, includeInactive: true });
    res.json({ data: result.products, pagination: result.pagination });
  })
);

export default router;
