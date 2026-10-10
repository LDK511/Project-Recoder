import { query, transaction, withLock } from '../db.js';
import { CartItem, Product, CartResponse } from '../types.js';
import { ValidationError, NotFoundError } from '../middleware/errorHandler.js';
import { isPositiveInteger } from '../utils/validation.js';

/**
 * 사용자의 장바구니를 조회합니다.
 */
export async function getCart(userId: number): Promise<CartResponse> {
  const result = await query<CartItem & { product_name: string; product_price: number; product_stock: number; product_image_url: string | null }>(
    `SELECT ci.id, ci.user_id, ci.product_id, ci.quantity, ci.created_at, ci.updated_at,
            p.name as product_name, p.price as product_price, p.stock as product_stock, p.image_url as product_image_url
     FROM cart_items ci
     JOIN products p ON ci.product_id = p.id
     WHERE ci.user_id = $1
     ORDER BY ci.created_at DESC`,
    [userId],
  );

  const items: CartItem[] = result.rows.map((row) => ({
    id: row.id,
    user_id: row.user_id,
    product_id: row.product_id,
    quantity: row.quantity,
    created_at: row.created_at,
    updated_at: row.updated_at,
    product: {
      id: row.product_id,
      name: row.product_name,
      description: null,
      price: row.product_price,
      stock: row.product_stock,
      image_url: row.product_image_url,
      created_at: '',
      updated_at: '',
    },
  }));

  // 총액 계산
  const totalAmount = items.reduce((sum, item) => {
    const itemPrice = item.product?.price || 0;
    return sum + itemPrice * item.quantity;
  }, 0);

  return {
    items,
    total_amount: totalAmount,
  };
}

/**
 * 장바구니에 상품을 추가합니다.
 */
export async function addToCart(
  userId: number,
  productId: number,
  quantity: number,
): Promise<CartResponse> {
  // 수량 검증
  if (!isPositiveInteger(quantity)) {
    throw new ValidationError('Quantity must be a positive integer');
  }

  // 상품 존재 여부 및 재고 확인
  const productResult = await query<Product>(
    'SELECT * FROM products WHERE id = $1',
    [productId],
  );

  if (productResult.rows.length === 0) {
    throw new NotFoundError('Product not found');
  }

  const product = productResult.rows[0];
  if (product.stock < quantity) {
    throw new ValidationError('Insufficient stock available');
  }

  // 트랜잭션 내에서 장바구니 항목 추가/업데이트
  await transaction(async (client) => {
    // 기존 항목 확인
    const existingResult = await client.query(
      'SELECT * FROM cart_items WHERE user_id = $1 AND product_id = $2 FOR UPDATE',
      [userId, productId],
    );

    if (existingResult.rows.length > 0) {
      // 기존 항목 업데이트
      const newQuantity = existingResult.rows[0].quantity + quantity;
      if (newQuantity > product.stock) {
        throw new ValidationError('Insufficient stock available');
      }
      await client.query(
        `UPDATE cart_items SET quantity = $1, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $2 AND product_id = $3`,
        [newQuantity, userId, productId],
      );
    } else {
      // 새 항목 추가
      await client.query(
        `INSERT INTO cart_items (user_id, product_id, quantity, created_at, updated_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [userId, productId, quantity],
      );
    }
  });

  // 업데이트된 장바구니 반환
  return getCart(userId);
}

/**
 * 장바구니에서 상품을 제거합니다.
 */
export async function removeFromCart(
  userId: number,
  productId: number,
): Promise<CartResponse> {
  // 상품 존재 여부 확인
  const cartResult = await query<CartItem>(
    'SELECT * FROM cart_items WHERE user_id = $1 AND product_id = $2',
    [userId, productId],
  );

  if (cartResult.rows.length === 0) {
    throw new NotFoundError('Item not found in cart');
  }

  // 항목 삭제
  await query(
    'DELETE FROM cart_items WHERE user_id = $1 AND product_id = $2',
    [userId, productId],
  );

  // 업데이트된 장바구니 반환
  return getCart(userId);
}

/**
 * 장바구니를 비웁니다.
 */
export async function clearCart(userId: number): Promise<CartResponse> {
  await query(
    'DELETE FROM cart_items WHERE user_id = $1',
    [userId],
  );

  return {
    items: [],
    total_amount: 0,
  };
}

/**
 * 장바구니 항목의 수량을 업데이트합니다.
 */
export async function updateCartItemQuantity(
  userId: number,
  productId: number,
  quantity: number,
): Promise<CartResponse> {
  // 수량 검증
  if (!isPositiveInteger(quantity)) {
    throw new ValidationError('Quantity must be a positive integer');
  }

  // 상품 존재 여부 및 재고 확인
  const productResult = await query<Product>(
    'SELECT * FROM products WHERE id = $1',
    [productId],
  );

  if (productResult.rows.length === 0) {
    throw new NotFoundError('Product not found');
  }

  const product = productResult.rows[0];
  if (product.stock < quantity) {
    throw new ValidationError('Insufficient stock available');
  }

  // 장바구니 항목 존재 여부 확인
  const cartResult = await query<CartItem>(
    'SELECT * FROM cart_items WHERE user_id = $1 AND product_id = $2',
    [userId, productId],
  );

  if (cartResult.rows.length === 0) {
    throw new NotFoundError('Item not found in cart');
  }

  // 수량 업데이트
  await query(
    `UPDATE cart_items SET quantity = $1, updated_at = CURRENT_TIMESTAMP
     WHERE user_id = $2 AND product_id = $3`,
    [quantity, userId, productId],
  );

  // 업데이트된 장바구니 반환
  return getCart(userId);
}

/**
 * 장바구니 항목 개수를 반환합니다.
 */
export async function getCartItemCount(userId: number): Promise<number> {
  const result = await query<{ count: string }>(
    'SELECT COUNT(*) as count FROM cart_items WHERE user_id = $1',
    [userId],
  );
  return parseInt(result.rows[0]?.count || '0', 10);
}

/**
 * 장바구니가 비어있는지 확인합니다.
 */
export async function isCartEmpty(userId: number): Promise<boolean> {
  const count = await getCartItemCount(userId);
  return count === 0;
}
