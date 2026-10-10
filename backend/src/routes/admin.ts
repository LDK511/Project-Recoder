import { Router, Request, Response } from 'express';
import { authMiddleware, adminMiddleware, getUser } from '../middleware/auth.js';
import { asyncHandler, ValidationError, NotFoundError } from '../middleware/errorHandler.js';
import { query as dbQuery } from '../db.js';
import {
  normalizePageNumber,
  normalizeLimitNumber,
  normalizeSearchQuery,
  isValidOrderStatus,
} from '../utils/validation.js';
import { Order, OrderItem, PaginatedResponse } from '../types.js';

const router = Router();

/**
 * GET /api/admin/orders
 * 모든 주문을 조회합니다 (관리자만).
 * 쿼리: page, limit, status
 */
router.get(
  '/orders',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const page = normalizePageNumber(req.query.page);
    const limit = normalizeLimitNumber(req.query.limit);
    const status = req.query.status ? normalizeSearchQuery(req.query.status) : undefined;

    // 상태 검증
    if (status && !isValidOrderStatus(status)) {
      throw new ValidationError('Invalid order status');
    }

    const offset = (page - 1) * limit;

    // 조건 구성
    let whereClause = '1=1';
    const params: any[] = [];

    if (status) {
      whereClause += ' AND status = $' + (params.length + 1);
      params.push(status);
    }

    // 총 개수 조회
    const countResult = await dbQuery<{ count: string }>(
      `SELECT COUNT(*) as count FROM orders WHERE ${whereClause}`,
      params,
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // 주문 조회
    const ordersResult = await dbQuery<Order>(
      `SELECT * FROM orders WHERE ${whereClause} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    );

    const response: PaginatedResponse<Order> = {
      items: ordersResult.rows,
      total,
      page,
      limit,
    };

    res.json(response);
  }),
);

/**
 * GET /api/admin/orders/:id
 * 특정 주문의 상세 정보를 조회합니다 (관리자만).
 */
router.get(
  '/orders/:id',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const orderId = parseInt(req.params.id, 10);

    if (!Number.isInteger(orderId) || orderId <= 0) {
      throw new ValidationError('Invalid order ID');
    }

    // 주문 조회
    const orderResult = await dbQuery<Order>(
      'SELECT * FROM orders WHERE id = $1',
      [orderId],
    );

    if (orderResult.rows.length === 0) {
      throw new NotFoundError('Order not found');
    }

    const order = orderResult.rows[0];

    // 주문 항목 조회
    const itemsResult = await dbQuery<OrderItem>(
      'SELECT * FROM order_items WHERE order_id = $1 ORDER BY created_at ASC',
      [orderId],
    );

    res.json({
      ...order,
      items: itemsResult.rows,
    });
  }),
);

/**
 * POST /api/admin/orders/:id/complete
 * 주문을 완료 상태로 변경합니다 (관리자만).
 */
router.post(
  '/orders/:id/complete',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const orderId = parseInt(req.params.id, 10);

    if (!Number.isInteger(orderId) || orderId <= 0) {
      throw new ValidationError('Invalid order ID');
    }

    // 주문 조회
    const orderResult = await dbQuery<Order>(
      'SELECT * FROM orders WHERE id = $1',
      [orderId],
    );

    if (orderResult.rows.length === 0) {
      throw new NotFoundError('Order not found');
    }

    const order = orderResult.rows[0];

    if (order.status !== 'paid') {
      throw new ValidationError('Only paid orders can be completed');
    }

    // 주문 상태 업데이트
    const updatedResult = await dbQuery<Order>(
      'UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      ['completed', orderId],
    );

    // 주문 항목 조회
    const itemsResult = await dbQuery<OrderItem>(
      'SELECT * FROM order_items WHERE order_id = $1 ORDER BY created_at ASC',
      [orderId],
    );

    res.json({
      ...updatedResult.rows[0],
      items: itemsResult.rows,
    });
  }),
);

/**
 * POST /api/admin/orders/:id/cancel
 * 주문을 취소합니다 (관리자만).
 * 재고를 복원합니다.
 */
router.post(
  '/orders/:id/cancel',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const orderId = parseInt(req.params.id, 10);

    if (!Number.isInteger(orderId) || orderId <= 0) {
      throw new ValidationError('Invalid order ID');
    }

    // 주문 조회
    const orderResult = await dbQuery<Order>(
      'SELECT * FROM orders WHERE id = $1',
      [orderId],
    );

    if (orderResult.rows.length === 0) {
      throw new NotFoundError('Order not found');
    }

    const order = orderResult.rows[0];

    if (order.status === 'cancelled') {
      throw new ValidationError('Order is already cancelled');
    }

    if (order.status === 'completed') {
      throw new ValidationError('Cannot cancel completed orders');
    }

    // 재고 예약 조회
    const reservationsResult = await dbQuery<{ product_id: number; quantity: number }>(
      'SELECT product_id, quantity FROM stock_reservations WHERE order_id = $1',
      [orderId],
    );

    // 재고 복원
    for (const reservation of reservationsResult.rows) {
      await dbQuery(
        'UPDATE products SET stock = stock + $1 WHERE id = $2',
        [reservation.quantity, reservation.product_id],
      );
    }

    // 재고 예약 삭제
    await dbQuery('DELETE FROM stock_reservations WHERE order_id = $1', [orderId]);

    // 주문 상태 업데이트
    const updatedResult = await dbQuery<Order>(
      'UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      ['cancelled', orderId],
    );

    // 주문 항목 조회
    const itemsResult = await dbQuery<OrderItem>(
      'SELECT * FROM order_items WHERE order_id = $1 ORDER BY created_at ASC',
      [orderId],
    );

    res.json({
      ...updatedResult.rows[0],
      items: itemsResult.rows,
    });
  }),
);

/**
 * GET /api/admin/stats
 * 관리자 대시보드 통계를 조회합니다.
 */
router.get(
  '/stats',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    // 총 주문 수
    const totalOrdersResult = await dbQuery<{ count: string }>(
      'SELECT COUNT(*) as count FROM orders',
    );
    const totalOrders = parseInt(totalOrdersResult.rows[0].count, 10);

    // 결제 완료 주문 수
    const paidOrdersResult = await dbQuery<{ count: string }>(
      "SELECT COUNT(*) as count FROM orders WHERE status = 'paid' OR status = 'completed'",
    );
    const paidOrders = parseInt(paidOrdersResult.rows[0].count, 10);

    // 총 매출
    const totalRevenueResult = await dbQuery<{ total: string | null }>(
      "SELECT SUM(total_amount) as total FROM orders WHERE status = 'paid' OR status = 'completed'",
    );
    const totalRevenue = totalRevenueResult.rows[0].total
      ? parseInt(totalRevenueResult.rows[0].total, 10)
      : 0;

    // 총 상품 수
    const totalProductsResult = await dbQuery<{ count: string }>(
      'SELECT COUNT(*) as count FROM products',
    );
    const totalProducts = parseInt(totalProductsResult.rows[0].count, 10);

    // 총 사용자 수
    const totalUsersResult = await dbQuery<{ count: string }>(
      'SELECT COUNT(*) as count FROM users',
    );
    const totalUsers = parseInt(totalUsersResult.rows[0].count, 10);

    res.json({
      total_orders: totalOrders,
      paid_orders: paidOrders,
      total_revenue: totalRevenue,
      total_products: totalProducts,
      total_users: totalUsers,
    });
  }),
);

export { router as adminRouter };
