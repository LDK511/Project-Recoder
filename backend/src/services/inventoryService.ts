import type { PoolClient } from '../config/database.js';
import { query } from '../config/database.js';
import { InventoryReservation } from '../types/index.js';
import { ConflictError, NotFoundError } from '../utils/errors.js';

export interface ReservationItem {
  productId: number;
  quantity: number;
  productName?: string;
}

/**
 * 주문 생성 시 재고를 차감하고 예약 기록을 남깁니다. 트랜잭션 안에서 호출해야 합니다.
 * 데드락을 피하려고 항상 product id 오름차순으로 잠급니다.
 */
export async function reserveInventory(client: PoolClient, orderId: number, items: ReservationItem[]): Promise<void> {
  const sorted = [...items].sort((a, b) => a.productId - b.productId);
  for (const item of sorted) {
    const updated = await client.query(
      `UPDATE products SET stock = stock - $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2 AND stock >= $1
        RETURNING id`,
      [item.quantity, item.productId]
    );
    if (updated.rowCount === 0) {
      const p = await client.query('SELECT name, stock FROM products WHERE id = $1', [item.productId]);
      if (p.rows.length === 0) throw new NotFoundError('주문하신 상품을 찾을 수 없습니다.');
      throw new ConflictError(
        `'${p.rows[0].name}' 상품의 재고가 부족합니다. (남은 수량: ${p.rows[0].stock}개)`,
        'INSUFFICIENT_STOCK',
        { product_id: item.productId, available: p.rows[0].stock }
      );
    }
    await client.query(
      `INSERT INTO inventory_reservations (order_id, product_id, quantity) VALUES ($1, $2, $3)`,
      [orderId, item.productId, item.quantity]
    );
  }
}

/**
 * 취소·만료·결제실패 시 아직 풀리지 않은 예약 재고를 복구합니다. 트랜잭션 안에서 호출해야 합니다.
 * 같은 주문에 두 번 호출해도 한 번만 복구됩니다(released_at 으로 멱등 처리).
 */
export async function releaseInventory(client: PoolClient, orderId: number): Promise<void> {
  const reservations = await client.query(
    `UPDATE inventory_reservations SET released_at = CURRENT_TIMESTAMP
      WHERE order_id = $1 AND released_at IS NULL
      RETURNING product_id, quantity`,
    [orderId]
  );
  const sorted = [...reservations.rows].sort((a: any, b: any) => a.product_id - b.product_id);
  for (const r of sorted) {
    await client.query('UPDATE products SET stock = stock + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [
      r.quantity,
      r.product_id,
    ]);
  }
}

export async function getOrderReservations(orderId: number): Promise<InventoryReservation[]> {
  const result = await query(
    `SELECT id, order_id, product_id, quantity, reserved_at, released_at
       FROM inventory_reservations WHERE order_id = $1 ORDER BY reserved_at DESC`,
    [orderId]
  );
  return result.rows;
}

export async function getProductStock(productId: number): Promise<number> {
  const result = await query('SELECT stock FROM products WHERE id = $1', [productId]);
  if (result.rows.length === 0) throw new NotFoundError('상품을 찾을 수 없습니다.');
  return result.rows[0].stock;
}
