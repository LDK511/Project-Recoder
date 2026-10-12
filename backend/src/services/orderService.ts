import type { PoolClient } from '../config/database.js';
import { query, transaction } from '../config/database.js';
import { config, calculateShippingFee } from '../config/env.js';
import {
  Order,
  OrderStatus,
  OrderWithItems,
  PaginatedResponse,
  ShippingInfo,
  ORDER_STATUSES,
} from '../types/index.js';
import {
  MAX_QUANTITY_PER_ITEM,
  normalizePhone,
  optionalTrimmed,
  toInt,
  validatePostalCode,
  validateUUID,
} from '../utils/validation.js';
import { NotFoundError, ConflictError, ValidationError } from '../utils/errors.js';
import { reserveInventory, releaseInventory } from './inventoryService.js';
import { logger } from '../utils/logger.js';

export interface CheckoutItem {
  product_id: unknown;
  quantity: unknown;
}

export interface CheckoutRequest {
  idempotency_key: unknown;
  cart_items: unknown;
  shipping: unknown;
}

const ORDER_COLUMNS = `o.id, o.order_number, o.user_id, o.status, o.subtotal_cents, o.shipping_fee_cents, o.total_cents,
  o.currency, o.idempotency_key, o.payment_id, o.recipient_name, o.recipient_phone, o.postal_code, o.address1,
  o.address2, o.delivery_memo, o.tracking_carrier, o.tracking_number, o.cancel_reason, o.paid_at, o.shipped_at,
  o.delivered_at, o.cancelled_at, o.expires_at, o.created_at, o.updated_at`;

const ITEMS_JSON = `COALESCE((
  SELECT json_agg(json_build_object(
           'id', oi.id, 'order_id', oi.order_id, 'product_id', oi.product_id,
           'product_name', COALESCE(oi.product_name, p.name, '삭제된 상품'),
           'image_url', COALESCE(oi.image_url, p.image_url),
           'quantity', oi.quantity, 'price_cents', oi.price_cents) ORDER BY oi.id)
    FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id
   WHERE oi.order_id = o.id), '[]'::json) AS items`;

/** 국내 쇼핑몰 주문 흐름에 맞춘 상태 전이 규칙 */
export const ADMIN_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['cancelled'],
  paid: ['preparing', 'cancelled'],
  preparing: ['shipping', 'cancelled'],
  shipping: ['completed'],
  completed: ['refunded'],
  cancelled: [],
  expired: [],
  refunded: [],
};

/** 고객이 직접 취소할 수 있는 상태 (상품 준비 전까지) */
export const CUSTOMER_CANCELLABLE: OrderStatus[] = ['pending', 'paid'];

/** 결제가 이뤄진 상태 — 취소 시 환불이 필요 */
export const PAID_STATUSES: OrderStatus[] = ['paid', 'preparing', 'shipping', 'completed'];

function parseShipping(raw: unknown): ShippingInfo {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const fields: { field: string; message: string }[] = [];

  const name = typeof s.recipient_name === 'string' ? s.recipient_name.trim() : '';
  if (name.length < 1 || name.length > 50) fields.push({ field: 'recipient_name', message: '받는 분 이름을 입력해 주세요.' });

  const phone = normalizePhone(s.recipient_phone);
  if (!phone) fields.push({ field: 'recipient_phone', message: '연락처를 정확히 입력해 주세요. (예: 010-1234-5678)' });

  const postal = typeof s.postal_code === 'string' ? s.postal_code.trim() : '';
  if (!validatePostalCode(postal)) fields.push({ field: 'postal_code', message: '우편번호 5자리를 입력해 주세요.' });

  const address1 = typeof s.address1 === 'string' ? s.address1.trim() : '';
  if (address1.length < 2 || address1.length > 255) fields.push({ field: 'address1', message: '주소를 입력해 주세요.' });

  let address2: string | null = null;
  let memo: string | null = null;
  try {
    address2 = optionalTrimmed(s.address2, 255);
  } catch {
    fields.push({ field: 'address2', message: '상세주소는 255자 이하로 입력해 주세요.' });
  }
  try {
    memo = optionalTrimmed(s.delivery_memo, 200);
  } catch {
    fields.push({ field: 'delivery_memo', message: '배송 메모는 200자 이하로 입력해 주세요.' });
  }

  if (fields.length) throw new ValidationError(fields[0].message, { fields });
  return {
    recipient_name: name,
    recipient_phone: phone!,
    postal_code: postal,
    address1,
    address2,
    delivery_memo: memo,
  };
}

function parseItems(raw: unknown): { productId: number; quantity: number }[] {
  if (!Array.isArray(raw) || raw.length === 0) throw new ValidationError('주문할 상품이 없습니다.');
  if (raw.length > 50) throw new ValidationError('한 번에 50종류까지 주문할 수 있습니다.');
  const merged = new Map<number, number>();
  for (const it of raw as CheckoutItem[]) {
    const pid = toInt(it?.product_id);
    const qty = toInt(it?.quantity);
    if (pid === null || pid < 1 || qty === null || qty < 1 || qty > MAX_QUANTITY_PER_ITEM) {
      throw new ValidationError('주문 상품 정보가 올바르지 않습니다.');
    }
    merged.set(pid, (merged.get(pid) ?? 0) + qty);
  }
  return [...merged.entries()].map(([productId, quantity]) => ({ productId, quantity }));
}

export async function addHistory(
  client: PoolClient,
  orderId: number,
  from: OrderStatus | null,
  to: OrderStatus,
  actor: string,
  note?: string | null
): Promise<void> {
  await client.query(
    'INSERT INTO order_status_history (order_id, from_status, to_status, actor, note) VALUES ($1, $2, $3, $4, $5)',
    [orderId, from, to, actor.slice(0, 100), note ? note.slice(0, 255) : null]
  );
}

async function loadOrder(client: PoolClient | null, orderId: number, forUpdate = false): Promise<Order | null> {
  const sql = `SELECT ${ORDER_COLUMNS} FROM orders o WHERE o.id = $1 ${forUpdate ? 'FOR UPDATE' : ''}`;
  const r = client ? await client.query(sql, [orderId]) : await query(sql, [orderId]);
  return (r.rows[0] as Order) ?? null;
}

/**
 * 주문서 생성 (결제 대기).
 *  - 같은 idempotency_key 로 다시 요청하면 새 주문을 만들지 않고 기존 주문을 돌려줍니다(중복 결제 방지).
 *  - 가격은 클라이언트가 보낸 값이 아니라 DB 의 현재 판매가로 계산합니다.
 *  - 재고는 주문 생성 시 바로 차감(예약)하고, 결제 시간이 지나면 자동으로 복구됩니다.
 */
export async function createOrder(userId: number, req: CheckoutRequest): Promise<{ order: OrderWithItems; created: boolean }> {
  if (!validateUUID(req.idempotency_key)) throw new ValidationError('주문 요청 키가 올바르지 않습니다. 페이지를 새로고침해 주세요.');
  const idempotencyKey = req.idempotency_key as string;
  const items = parseItems(req.cart_items);
  const shipping = parseShipping(req.shipping);

  const result = await transaction(async (client) => {
    const existing = await client.query('SELECT id, user_id FROM orders WHERE idempotency_key = $1', [idempotencyKey]);
    if (existing.rows.length > 0) {
      if (existing.rows[0].user_id !== userId) throw new ConflictError('이미 사용된 주문 요청입니다.');
      return { orderId: existing.rows[0].id as number, created: false };
    }

    const ids = items.map((i) => i.productId);
    const products = await client.query(
      'SELECT id, name, price_cents, stock, image_url, is_active FROM products WHERE id = ANY($1::int[]) ORDER BY id FOR UPDATE',
      [ids]
    );
    const byId = new Map<number, any>(products.rows.map((p: any) => [p.id, p]));

    let subtotal = 0;
    const lines = items.map((it) => {
      const p = byId.get(it.productId);
      if (!p || !p.is_active) throw new ConflictError('판매가 종료된 상품이 포함되어 있습니다. 장바구니를 확인해 주세요.', 'PRODUCT_UNAVAILABLE');
      if (p.stock < it.quantity) {
        throw new ConflictError(`'${p.name}' 상품의 재고가 부족합니다. (남은 수량: ${p.stock}개)`, 'INSUFFICIENT_STOCK', {
          product_id: p.id,
          available: p.stock,
        });
      }
      subtotal += p.price_cents * it.quantity;
      return { ...it, name: p.name as string, price: p.price_cents as number, image: p.image_url as string | null };
    });

    const shippingFee = calculateShippingFee(subtotal);
    const total = subtotal + shippingFee;

    const inserted = await client.query(
      `INSERT INTO orders (user_id, status, subtotal_cents, shipping_fee_cents, total_cents, currency, idempotency_key,
                           recipient_name, recipient_phone, postal_code, address1, address2, delivery_memo, expires_at)
       VALUES ($1, 'pending', $2, $3, $4, 'KRW', $5, $6, $7, $8, $9, $10, $11,
               CURRENT_TIMESTAMP + ($12 || ' minutes')::interval)
       RETURNING id`,
      [
        userId,
        subtotal,
        shippingFee,
        total,
        idempotencyKey,
        shipping.recipient_name,
        shipping.recipient_phone,
        shipping.postal_code,
        shipping.address1,
        shipping.address2,
        shipping.delivery_memo,
        String(config.orderPaymentTimeoutMinutes),
      ]
    );
    const orderId: number = inserted.rows[0].id;
    // 주문번호: 접수일(한국시간) + 일련번호. 예) 20261011000123
    await client.query(
      `UPDATE orders SET order_number = TO_CHAR(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul', 'YYYYMMDD') || LPAD(id::text, 6, '0')
        WHERE id = $1`,
      [orderId]
    );

    for (const l of lines) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, product_name, image_url, quantity, price_cents)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [orderId, l.productId, l.name, l.image, l.quantity, l.price]
      );
    }
    await reserveInventory(client, orderId, lines.map((l) => ({ productId: l.productId, quantity: l.quantity })));
    await addHistory(client, orderId, null, 'pending', 'customer', '주문 접수');
    return { orderId, created: true };
  });

  const order = await getOrderById(result.orderId, userId, false);
  return { order, created: result.created };
}

/** 주문 상세. 본인 주문이 아니면(관리자 제외) 존재 자체를 숨기기 위해 404 를 돌려줍니다. */
export async function getOrderById(orderId: number, userId: number, isAdmin: boolean): Promise<OrderWithItems> {
  const r = await query(
    `SELECT ${ORDER_COLUMNS}, ${ITEMS_JSON}, u.name AS customer_name, u.email AS customer_email,
            COALESCE((SELECT json_agg(h ORDER BY h.created_at, h.id)
                        FROM (SELECT id, from_status, to_status, note, actor, created_at AT TIME ZONE 'UTC' AS created_at
                                FROM order_status_history WHERE order_id = o.id) h), '[]'::json) AS history
       FROM orders o JOIN users u ON u.id = o.user_id
      WHERE o.id = $1`,
    [orderId]
  );
  const order = r.rows[0] as OrderWithItems | undefined;
  if (!order || (!isAdmin && order.user_id !== userId)) throw new NotFoundError('주문을 찾을 수 없습니다.');
  if (!isAdmin) {
    // 고객에게는 내부 처리자 정보를 노출하지 않습니다.
    order.history = (order.history || []).map((h) => ({ ...h, actor: h.actor.startsWith('admin') ? 'admin' : h.actor }));
  }
  return order;
}

export async function getUserOrders(userId: number, page = 1, limit = 10): Promise<PaginatedResponse<OrderWithItems>> {
  const count = await query<{ total: number }>('SELECT COUNT(*)::int AS total FROM orders WHERE user_id = $1', [userId]);
  const total = count.rows[0].total;
  const rows = await query(
    `SELECT ${ORDER_COLUMNS}, ${ITEMS_JSON}
       FROM orders o WHERE o.user_id = $1
      ORDER BY o.created_at DESC, o.id DESC
      LIMIT $2 OFFSET $3`,
    [userId, limit, (page - 1) * limit]
  );
  return { data: rows.rows, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

export interface AdminOrderFilter {
  page: number;
  limit: number;
  status?: string;
  q?: string;
}

export async function getAllOrders(filter: AdminOrderFilter): Promise<PaginatedResponse<OrderWithItems>> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.status) {
    if (!(ORDER_STATUSES as readonly string[]).includes(filter.status)) throw new ValidationError('알 수 없는 주문 상태입니다.');
    params.push(filter.status);
    where.push(`o.status = $${params.length}`);
  }
  if (filter.q && filter.q.trim()) {
    params.push(`%${filter.q.trim()}%`);
    const i = params.length;
    where.push(`(o.order_number ILIKE $${i} OR o.recipient_name ILIKE $${i} OR u.email ILIKE $${i} OR u.name ILIKE $${i} OR o.recipient_phone ILIKE $${i})`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const count = await query<{ total: number }>(
    `SELECT COUNT(*)::int AS total FROM orders o JOIN users u ON u.id = o.user_id ${whereSql}`,
    params
  );
  const total = count.rows[0].total;
  params.push(filter.limit, (filter.page - 1) * filter.limit);
  const rows = await query(
    `SELECT ${ORDER_COLUMNS}, ${ITEMS_JSON}, u.name AS customer_name, u.email AS customer_email
       FROM orders o JOIN users u ON u.id = o.user_id
       ${whereSql}
      ORDER BY o.created_at DESC, o.id DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return {
    data: rows.rows,
    pagination: { page: filter.page, limit: filter.limit, total, pages: Math.ceil(total / filter.limit) },
  };
}

/**
 * 주문 취소(재고 복구 포함). 결제된 주문이면 refund 콜백으로 환불을 먼저 처리합니다.
 * 환불이 실패하면 주문 상태를 바꾸지 않습니다.
 */
export async function cancelOrder(
  orderId: number,
  opts: {
    userId?: number;
    actor: string;
    reason?: string | null;
    allowedFrom: OrderStatus[];
    refund?: (order: Order) => Promise<void>;
  }
): Promise<Order> {
  const before = await loadOrder(null, orderId);
  if (!before || (opts.userId !== undefined && before.user_id !== opts.userId)) throw new NotFoundError('주문을 찾을 수 없습니다.');
  if (!opts.allowedFrom.includes(before.status)) {
    throw new ConflictError(
      before.status === 'preparing' || before.status === 'shipping'
        ? '상품 준비가 시작되어 바로 취소할 수 없습니다. 고객센터로 문의해 주세요.'
        : '이 주문은 취소할 수 없는 상태입니다.',
      'INVALID_ORDER_STATE'
    );
  }

  const needsRefund = PAID_STATUSES.includes(before.status);
  if (needsRefund && opts.refund) {
    await opts.refund(before); // 멱등키를 쓰므로 재시도해도 이중 환불되지 않습니다.
  }

  return transaction(async (client) => {
    const order = await loadOrder(client, orderId, true);
    if (!order) throw new NotFoundError('주문을 찾을 수 없습니다.');
    if (!opts.allowedFrom.includes(order.status)) throw new ConflictError('주문 상태가 변경되었습니다. 새로고침 후 다시 시도해 주세요.');
    await releaseInventory(client, orderId);
    const reason = opts.reason?.trim() || (opts.actor === 'customer' ? '고객 요청 취소' : '판매자 취소');
    const updated = await client.query(
      `UPDATE orders SET status = 'cancelled', cancel_reason = $2, cancelled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 RETURNING *`,
      [orderId, reason.slice(0, 255)]
    );
    await addHistory(client, orderId, order.status, 'cancelled', opts.actor, needsRefund ? `${reason} (결제 금액 환불)` : reason);
    return updated.rows[0] as Order;
  });
}

/** 관리자 상태 변경(취소 제외). 송장 번호는 배송중으로 바꿀 때 필수입니다. */
export async function updateOrderStatus(
  orderId: number,
  to: OrderStatus,
  actor: string,
  opts: { tracking_carrier?: unknown; tracking_number?: unknown; note?: unknown; refund?: (order: Order) => Promise<void> } = {}
): Promise<Order> {
  if (!(ORDER_STATUSES as readonly string[]).includes(to)) throw new ValidationError('알 수 없는 주문 상태입니다.');
  const current = await loadOrder(null, orderId);
  if (!current) throw new NotFoundError('주문을 찾을 수 없습니다.');
  if (!ADMIN_TRANSITIONS[current.status].includes(to)) {
    throw new ConflictError(`'${current.status}' 상태에서 '${to}' 상태로 변경할 수 없습니다.`, 'INVALID_TRANSITION');
  }

  let carrier: string | null = null;
  let tracking: string | null = null;
  if (to === 'shipping') {
    carrier = optionalTrimmed(opts.tracking_carrier, 50);
    tracking = optionalTrimmed(opts.tracking_number, 50);
    if (!carrier || !tracking) throw new ValidationError('택배사와 송장번호를 입력해 주세요.');
  }
  const note = optionalTrimmed(opts.note, 255);

  if (to === 'refunded' && opts.refund) {
    await opts.refund(current);
  }

  return transaction(async (client) => {
    const order = await loadOrder(client, orderId, true);
    if (!order || order.status !== current.status) throw new ConflictError('주문 상태가 변경되었습니다. 새로고침 후 다시 시도해 주세요.');
    const timestampColumn: Partial<Record<OrderStatus, string>> = {
      shipping: 'shipped_at',
      completed: 'delivered_at',
      refunded: 'cancelled_at',
    };
    const sets = ['status = $2', 'updated_at = CURRENT_TIMESTAMP'];
    const params: unknown[] = [orderId, to];
    if (timestampColumn[to]) sets.push(`${timestampColumn[to]} = CURRENT_TIMESTAMP`);
    if (to === 'shipping') {
      params.push(carrier, tracking);
      sets.push(`tracking_carrier = $${params.length - 1}`, `tracking_number = $${params.length}`);
    }
    if (to === 'refunded') {
      params.push(note || '반품 환불');
      sets.push(`cancel_reason = $${params.length}`);
    }
    const updated = await client.query(`UPDATE orders SET ${sets.join(', ')} WHERE id = $1 RETURNING *`, params);
    await addHistory(
      client,
      orderId,
      order.status,
      to,
      actor,
      note || (to === 'shipping' ? `${carrier} ${tracking}` : null)
    );
    return updated.rows[0] as Order;
  });
}

/** 결제 시간이 지난 결제대기 주문을 만료 처리하고 재고를 복구합니다. 처리한 건수를 돌려줍니다. */
export async function expirePendingOrders(batchSize = 50): Promise<number> {
  return transaction(async (client) => {
    const due = await client.query(
      `SELECT id FROM orders
        WHERE status = 'pending' AND expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP
        ORDER BY expires_at
        LIMIT $1
        FOR UPDATE SKIP LOCKED`,
      [batchSize]
    );
    for (const row of due.rows) {
      await releaseInventory(client, row.id);
      await client.query(
        `UPDATE orders SET status = 'expired', cancelled_at = CURRENT_TIMESTAMP, cancel_reason = '결제 시간 초과',
                updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [row.id]
      );
      await addHistory(client, row.id, 'pending', 'expired', 'system', `결제 대기 ${config.orderPaymentTimeoutMinutes}분 초과로 자동 취소`);
    }
    if (due.rows.length) logger.info('Expired unpaid orders', { count: due.rows.length });
    return due.rows.length;
  });
}

export async function setPaymentId(orderId: number, paymentId: string): Promise<void> {
  await query('UPDATE orders SET payment_id = $2 WHERE id = $1 AND payment_id IS DISTINCT FROM $2', [orderId, paymentId]);
}

/** 관리자 대시보드 지표 */
export async function getDashboardStats() {
  const [today, month, byStatus, lowStock, recent] = await Promise.all([
    query(
      `SELECT COUNT(*)::int AS orders, COALESCE(SUM(total_cents), 0)::bigint AS revenue
         FROM orders
        WHERE status IN ('paid','preparing','shipping','completed')
          AND (paid_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul')::date = (NOW() AT TIME ZONE 'Asia/Seoul')::date`
    ),
    query(
      `SELECT COUNT(*)::int AS orders, COALESCE(SUM(total_cents), 0)::bigint AS revenue
         FROM orders
        WHERE status IN ('paid','preparing','shipping','completed')
          AND DATE_TRUNC('month', paid_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul') = DATE_TRUNC('month', NOW() AT TIME ZONE 'Asia/Seoul')`
    ),
    query(`SELECT status, COUNT(*)::int AS count FROM orders GROUP BY status`),
    query(
      `SELECT id, name, stock, image_url FROM products WHERE is_active = TRUE AND stock <= 5 ORDER BY stock ASC, name LIMIT 8`
    ),
    query(
      `SELECT TO_CHAR(d, 'MM/DD') AS day,
              COALESCE(SUM(o.total_cents) FILTER (WHERE o.id IS NOT NULL), 0)::bigint AS revenue,
              COUNT(o.id)::int AS orders
         FROM GENERATE_SERIES((NOW() AT TIME ZONE 'Asia/Seoul')::date - 6, (NOW() AT TIME ZONE 'Asia/Seoul')::date, '1 day') d
         LEFT JOIN orders o
           ON (o.paid_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul')::date = d::date
          AND o.status IN ('paid','preparing','shipping','completed')
        GROUP BY d ORDER BY d`
    ),
  ]);
  const statusCounts: Record<string, number> = {};
  for (const s of ORDER_STATUSES) statusCounts[s] = 0;
  for (const r of byStatus.rows) statusCounts[r.status] = r.count;
  return {
    today: today.rows[0],
    month: month.rows[0],
    status_counts: statusCounts,
    low_stock: lowStock.rows,
    daily: recent.rows,
  };
}
