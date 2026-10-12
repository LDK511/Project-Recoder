import { query } from '../config/database.js';
import { CartItemWithProduct } from '../types/index.js';
import { MAX_QUANTITY_PER_ITEM, toInt } from '../utils/validation.js';
import { ValidationError, NotFoundError, ConflictError } from '../utils/errors.js';

export interface CartResponse {
  items: CartItemWithProduct[];
  total_cents: number;
  item_count: number;
}

function parseQuantity(value: unknown): number {
  const n = toInt(value);
  if (n === null || n < 1 || n > MAX_QUANTITY_PER_ITEM) {
    throw new ValidationError(`수량은 1~${MAX_QUANTITY_PER_ITEM}개 사이로 선택해 주세요.`);
  }
  return n;
}

export async function getCart(userId: number): Promise<CartResponse> {
  const result = await query(
    `SELECT ci.id, ci.product_id, ci.quantity,
            p.name AS product_name, p.price_cents, p.compare_at_price_cents, p.image_url, p.stock, p.is_active
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
      WHERE ci.user_id = $1
      ORDER BY ci.created_at DESC, ci.id DESC`,
    [userId]
  );
  const items: CartItemWithProduct[] = result.rows.map((r: any) => ({
    id: r.id,
    product_id: r.product_id,
    quantity: r.quantity,
    product_name: r.product_name,
    price_cents: r.price_cents,
    compare_at_price_cents: r.compare_at_price_cents,
    image_url: r.image_url,
    stock: r.stock,
    is_active: r.is_active,
  }));
  // 구매 가능한 상품만 합계에 포함 (품절/판매중지는 제외)
  const purchasable = items.filter((i) => i.is_active && i.stock >= i.quantity);
  return {
    items,
    total_cents: purchasable.reduce((s, i) => s + i.price_cents * i.quantity, 0),
    item_count: items.reduce((s, i) => s + i.quantity, 0),
  };
}

async function getPurchasableProduct(productId: number) {
  const r = await query('SELECT id, stock, is_active FROM products WHERE id = $1', [productId]);
  const p = r.rows[0];
  if (!p || !p.is_active) throw new NotFoundError('판매 중인 상품이 아닙니다.');
  return p as { id: number; stock: number };
}

export async function addToCart(userId: number, input: { product_id: unknown; quantity: unknown }) {
  const productId = toInt(input.product_id);
  if (productId === null || productId < 1) throw new ValidationError('상품 정보가 올바르지 않습니다.');
  const quantity = parseQuantity(input.quantity ?? 1);
  const product = await getPurchasableProduct(productId);
  if (product.stock <= 0) throw new ConflictError('품절된 상품입니다.', 'OUT_OF_STOCK');

  // 이미 담긴 상품이면 수량을 더합니다(재고·최대 수량 이내로).
  const existing = await query('SELECT quantity FROM cart_items WHERE user_id = $1 AND product_id = $2', [userId, productId]);
  const newQty = (existing.rows[0]?.quantity ?? 0) + quantity;
  if (newQty > product.stock) {
    throw new ConflictError(`재고가 부족합니다. (구매 가능 수량: ${product.stock}개)`, 'INSUFFICIENT_STOCK', {
      available: product.stock,
    });
  }
  if (newQty > MAX_QUANTITY_PER_ITEM) {
    throw new ValidationError(`한 상품은 최대 ${MAX_QUANTITY_PER_ITEM}개까지 담을 수 있습니다.`);
  }

  const result = await query(
    `INSERT INTO cart_items (user_id, product_id, quantity)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, product_id)
     DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = CURRENT_TIMESTAMP
     RETURNING id, product_id, quantity`,
    [userId, productId, newQty]
  );
  return result.rows[0] as { id: number; product_id: number; quantity: number };
}

export async function updateCartItem(userId: number, cartItemId: number, input: { quantity: unknown }) {
  const quantity = parseQuantity(input.quantity);
  const item = await query('SELECT product_id FROM cart_items WHERE id = $1 AND user_id = $2', [cartItemId, userId]);
  if (item.rows.length === 0) throw new NotFoundError('장바구니 상품을 찾을 수 없습니다.');
  const product = await getPurchasableProduct(item.rows[0].product_id);
  if (quantity > product.stock) {
    throw new ConflictError(`재고가 부족합니다. (구매 가능 수량: ${product.stock}개)`, 'INSUFFICIENT_STOCK', {
      available: product.stock,
    });
  }
  const result = await query(
    'UPDATE cart_items SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3 RETURNING id, quantity',
    [quantity, cartItemId, userId]
  );
  return result.rows[0] as { id: number; quantity: number };
}

export async function removeFromCart(userId: number, cartItemId: number): Promise<void> {
  const result = await query('DELETE FROM cart_items WHERE id = $1 AND user_id = $2 RETURNING id', [cartItemId, userId]);
  if (result.rows.length === 0) throw new NotFoundError('장바구니 상품을 찾을 수 없습니다.');
}

export async function clearCart(userId: number): Promise<void> {
  await query('DELETE FROM cart_items WHERE user_id = $1', [userId]);
}
