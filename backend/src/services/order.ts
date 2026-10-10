import { PoolClient } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { query, transaction, withLock } from '../db.js';
import {
  Order,
  OrderDetail,
  OrderItem,
  StockReservation,
  IdempotencyKey,
} from '../types.js';
import { ValidationError, NotFoundError, ConflictError } from '../middleware/errorHandler.js';

/**
 * 주문을 생성합니다.
 * 장바구니 항목을 주문 항목으로 변환하고, 재고를 예약합니다.
 * 멱등성 키를 사용하여 중복 주문을 방지합니다.
 */
export async function createOrder(
  userId: number,
  idempotencyKey: string,
): Promise<OrderDetail> {
  return transaction(async (client) => {
    // 1. 멱등성 키 확인 (이미 처리된 요청인지)
    const existingKeyResult = await client.query(
      'SELECT order_id FROM idempotency_keys WHERE user_id = $1 AND key = $2',
      [userId, idempotencyKey],
    );

    if (existingKeyResult.rows.length > 0) {
      // 이미 처리된 요청 - 기존 주문을 반환
      const orderId = existingKeyResult.rows[0].order_id;
      return getOrderDetail(client, orderId, userId);
    }

    // 2. 장바구니 항목 조회
    const cartResult = await client.query(
      `SELECT ci.id, ci.product_id, ci.quantity, p.price, p.stock
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       WHERE ci.user_id = $1`,
      [userId],
    );

    if (cartResult.rows.length === 0) {
      throw new ValidationError('Cart is empty');
    }

    const cartItems = cartResult.rows;

    // 3. 재고 확인 및 예약 (FOR UPDATE로 동시성 제어)
    let totalAmount = 0;
    const reservations: Array<{ productId: number; quantity: number; price: number }> = [];

    for (const item of cartItems) {
      const productId = item.product_id;
      const quantity = item.quantity;
      const price = item.price;
      const availableStock = item.stock;

      if (quantity > availableStock) {
        throw new ValidationError(
          `Insufficient stock for product ${productId}. Available: ${availableStock}, Requested: ${quantity}`,
        );
      }

      totalAmount += price * quantity;
      reservations.push({ productId, quantity, price });
    }

    // 4. 주문 생성
    const orderResult = await client.query(
      `INSERT INTO orders (user_id, total_amount, status)
       VALUES ($1, $2, 'pending')
       RETURNING id, user_id, total_amount, status, created_at, updated_at`,
      [userId, totalAmount],
    );

    const order = orderResult.rows[0] as Order;

    // 5. 주문 항목 생성
    const orderItems: OrderItem[] = [];
    for (const reservation of reservations) {
      const itemResult = await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price)
         VALUES ($1, $2, $3, $4)
         RETURNING id, order_id, product_id, quantity, unit_price, created_at`,
        [order.id, reservation.productId, reservation.quantity, reservation.price],
      );
      orderItems.push(itemResult.rows[0] as OrderItem);
    }

    // 6. 재고 예약 생성
    for (const reservation of reservations) {
      await client.query(
        `INSERT INTO stock_reservations (order_id, product_id, quantity)
         VALUES ($1, $2, $3)`,
        [order.id, reservation.productId, reservation.quantity],
      );
    }

    // 7. 멱등성 키 저장
    await client.query(
      `INSERT INTO idempotency_keys (user_id, key, order_id)
       VALUES ($1, $2, $3)`,
      [userId, idempotencyKey, order.id],
    );

    // 8. 장바구니 비우기
    await client.query('DELETE FROM cart_items WHERE user_id = $1', [userId]);

    return {
      ...order,
      items: orderItems,
    };
  });
}

/**
 * 주문 상세 정보를 조회합니다.
 * 클라이언트 함수 (트랜잭션 내에서 사용 가능)
 */
async function getOrderDetail(
  client: PoolClient,
  orderId: number,
  userId: number,
): Promise<OrderDetail> {
  const orderResult = await client.query(
    `SELECT id, user_id, total_amount, status, created_at, updated_at
     FROM orders
     WHERE id = $1 AND user_id = $2`,
    [orderId, userId],
  );

  if (orderResult.rows.length === 0) {
    throw new NotFoundError('Order not found');
  }

  const order = orderResult.rows[0] as Order;

  const itemsResult = await client.query(
    `SELECT id, order_id, product_id, quantity, unit_price, created_at
     FROM order_items
     WHERE order_id = $1`,
    [orderId],
  );

  return {
    ...order,
    items: itemsResult.rows as OrderItem[],
  };
}

/**
 * 주문을 조회합니다 (사용자 소유 확인).
 */
export async function getOrder(orderId: number, userId: number): Promise<OrderDetail> {
  const orderResult = await query(
    `SELECT id, user_id, total_amount, status, created_at, updated_at
     FROM orders
     WHERE id = $1`,
    [orderId],
  );

  if (orderResult.rows.length === 0) {
    throw new NotFoundError('Order not found');
  }

  const order = orderResult.rows[0] as Order;

  // 사용자 소유 확인
  if (order.user_id !== userId) {
    throw new NotFoundError('Order not found');
  }

  const itemsResult = await query(
    `SELECT id, order_id, product_id, quantity, unit_price, created_at
     FROM order_items
     WHERE order_id = $1`,
    [orderId],
  );

  return {
    ...order,
    items: itemsResult.rows as OrderItem[],
  };
}

/**
 * 사용자의 주문 목록을 조회합니다 (페이지네이션).
 */
export async function getOrders(
  userId: number,
  page: number = 1,
  limit: number = 20,
): Promise<{ items: OrderDetail[]; total: number; page: number; limit: number }> {
  const offset = (page - 1) * limit;

  const countResult = await query(
    'SELECT COUNT(*) as count FROM orders WHERE user_id = $1',
    [userId],
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const ordersResult = await query(
    `SELECT id, user_id, total_amount, status, created_at, updated_at
     FROM orders
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset],
  );

  const orders = ordersResult.rows as Order[];

  // 각 주문의 항목 조회
  const items: OrderDetail[] = [];
  for (const order of orders) {
    const itemsResult = await query(
      `SELECT id, order_id, product_id, quantity, unit_price, created_at
       FROM order_items
       WHERE order_id = $1`,
      [order.id],
    );
    items.push({
      ...order,
      items: itemsResult.rows as OrderItem[],
    });
  }

  return { items, total, page, limit };
}

/**
 * 주문을 취소합니다 (pending 상태만 가능).
 * 재고 예약을 해제합니다.
 */
export async function cancelOrder(orderId: number, userId: number): Promise<OrderDetail> {
  return transaction(async (client) => {
    // 1. 주문 조회
    const orderResult = await client.query(
      `SELECT id, user_id, total_amount, status, created_at, updated_at
       FROM orders
       WHERE id = $1`,
      [orderId],
    );

    if (orderResult.rows.length === 0) {
      throw new NotFoundError('Order not found');
    }

    const order = orderResult.rows[0] as Order;

    // 2. 사용자 소유 확인
    if (order.user_id !== userId) {
      throw new NotFoundError('Order not found');
    }

    // 3. 상태 확인 (pending만 취소 가능)
    if (order.status !== 'pending') {
      throw new ValidationError(`Cannot cancel order with status: ${order.status}`);
    }

    // 4. 주문 상태 업데이트
    const updatedResult = await client.query(
      `UPDATE orders
       SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, user_id, total_amount, status, created_at, updated_at`,
      [orderId],
    );

    const updatedOrder = updatedResult.rows[0] as Order;

    // 5. 재고 예약 해제 (삭제)
    await client.query('DELETE FROM stock_reservations WHERE order_id = $1', [orderId]);

    // 6. 주문 항목 조회
    const itemsResult = await client.query(
      `SELECT id, order_id, product_id, quantity, unit_price, created_at
       FROM order_items
       WHERE order_id = $1`,
      [orderId],
    );

    return {
      ...updatedOrder,
      items: itemsResult.rows as OrderItem[],
    };
  });
}

/**
 * 주문 상태를 업데이트합니다 (내부용).
 * 결제 완료 시 'paid' 상태로 변경합니다.
 */
export async function updateOrderStatus(
  orderId: number,
  status: 'pending' | 'paid' | 'completed' | 'cancelled',
): Promise<Order> {
  const result = await query(
    `UPDATE orders
     SET status = $1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2
     RETURNING id, user_id, total_amount, status, created_at, updated_at`,
    [status, orderId],
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('Order not found');
  }

  return result.rows[0] as Order;
}

/**
 * 재고를 예약합니다 (주문 생성 시).
 * 트랜잭션 내에서만 호출됩니다.
 */
export async function reserveStock(
  client: PoolClient,
  orderId: number,
  productId: number,
  quantity: number,
): Promise<StockReservation> {
  const result = await client.query(
    `INSERT INTO stock_reservations (order_id, product_id, quantity)
     VALUES ($1, $2, $3)
     RETURNING id, order_id, product_id, quantity, created_at`,
    [orderId, productId, quantity],
  );

  return result.rows[0] as StockReservation;
}

/**
 * 재고 예약을 해제합니다 (주문 취소 시).
 * 트랜잭션 내에서만 호출됩니다.
 */
export async function releaseStock(
  client: PoolClient,
  orderId: number,
): Promise<void> {
  await client.query('DELETE FROM stock_reservations WHERE order_id = $1', [orderId]);
}

/**
 * 모든 주문을 조회합니다 (관리자용, 페이지네이션).
 */
export async function getAllOrders(
  page: number = 1,
  limit: number = 20,
  status?: string,
): Promise<{ items: OrderDetail[]; total: number; page: number; limit: number }> {
  const offset = (page - 1) * limit;

  let countQuery = 'SELECT COUNT(*) as count FROM orders';
  let ordersQuery = `SELECT id, user_id, total_amount, status, created_at, updated_at
                     FROM orders`;
  const params: any[] = [];

  if (status) {
    countQuery += ' WHERE status = $1';
    ordersQuery += ' WHERE status = $1';
    params.push(status);
  }

  const countResult = await query(countQuery, params);
  const total = parseInt(countResult.rows[0].count, 10);

  ordersQuery += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
  params.push(limit, offset);

  const ordersResult = await query(ordersQuery, params);
  const orders = ordersResult.rows as Order[];

  // 각 주문의 항목 조회
  const items: OrderDetail[] = [];
  for (const order of orders) {
    const itemsResult = await query(
      `SELECT id, order_id, product_id, quantity, unit_price, created_at
       FROM order_items
       WHERE order_id = $1`,
      [order.id],
    );
    items.push({
      ...order,
      items: itemsResult.rows as OrderItem[],
    });
  }

  return { items, total, page, limit };
}
