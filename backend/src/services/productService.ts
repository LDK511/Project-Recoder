import { query } from '../config/database.js';
import { Product, PaginationMeta } from '../types/index.js';
import { uploadFile, deleteFile } from '../utils/s3.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';
import { toInt } from '../utils/validation.js';

export const PRODUCT_SORTS = ['newest', 'popular', 'price_asc', 'price_desc'] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

export interface ProductListOptions {
  page: number;
  limit: number;
  search?: string;
  category?: string;
  sort?: ProductSort;
  /** 관리자 목록: 숨김 상품 포함 */
  includeInactive?: boolean;
}

export interface ProductInput {
  name?: unknown;
  description?: unknown;
  category?: unknown;
  price_cents?: unknown;
  compare_at_price_cents?: unknown;
  stock?: unknown;
  is_active?: unknown;
  image?: Buffer;
}

const SELECT_COLUMNS = `id, name, description, category, price_cents, compare_at_price_cents, stock, image_url, is_active, created_at, updated_at`;

function mapRow(row: any): Product {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    price_cents: row.price_cents,
    compare_at_price_cents: row.compare_at_price_cents,
    stock: row.stock,
    image_url: row.image_url,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function getProducts(options: ProductListOptions): Promise<{ products: Product[]; pagination: PaginationMeta }> {
  const { page, limit, search, category, sort = 'newest', includeInactive = false } = options;
  const where: string[] = [];
  const params: unknown[] = [];

  if (!includeInactive) where.push('p.is_active = TRUE');
  if (search && search.trim()) {
    params.push(`%${search.trim().replace(/[\\%_]/g, (m) => '\\' + m)}%`);
    where.push(`(p.name ILIKE $${params.length} OR p.description ILIKE $${params.length} OR p.category ILIKE $${params.length})`);
  }
  if (category && category.trim()) {
    params.push(category.trim());
    where.push(`p.category = $${params.length}`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const orderSql = {
    newest: 'p.created_at DESC, p.id DESC',
    price_asc: 'p.price_cents ASC, p.id DESC',
    price_desc: 'p.price_cents DESC, p.id DESC',
    popular: 'COALESCE(s.sold, 0) DESC, p.created_at DESC',
  }[sort];

  const countResult = await query<{ total: number }>(`SELECT COUNT(*)::int AS total FROM products p ${whereSql}`, params);
  const total = countResult.rows[0].total;

  const salesJoin =
    sort === 'popular'
      ? `LEFT JOIN (
           SELECT oi.product_id, SUM(oi.quantity) AS sold
             FROM order_items oi JOIN orders o ON o.id = oi.order_id
            WHERE o.status IN ('paid','preparing','shipping','completed')
            GROUP BY oi.product_id
         ) s ON s.product_id = p.id`
      : '';

  params.push(limit, (page - 1) * limit);
  const rows = await query(
    `SELECT ${SELECT_COLUMNS.split(', ').map((c) => 'p.' + c).join(', ')}
       FROM products p ${salesJoin}
       ${whereSql}
      ORDER BY ${orderSql}
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return {
    products: rows.rows.map(mapRow),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

export async function getCategories(): Promise<{ name: string; count: number }[]> {
  const result = await query<{ name: string; count: number }>(
    `SELECT category AS name, COUNT(*)::int AS count
       FROM products
      WHERE is_active = TRUE AND category IS NOT NULL AND category <> ''
      GROUP BY category
      ORDER BY category`
  );
  return result.rows;
}

export async function getProductById(id: number, opts: { includeInactive?: boolean } = {}): Promise<Product> {
  const result = await query(`SELECT ${SELECT_COLUMNS} FROM products WHERE id = $1`, [id]);
  const row = result.rows[0];
  if (!row || (!row.is_active && !opts.includeInactive)) {
    throw new NotFoundError('상품을 찾을 수 없거나 판매가 종료되었습니다.');
  }
  return mapRow(row);
}

/** 폼(multipart)이나 JSON 으로 들어온 값을 검증·변환합니다. partial=true 면 수정(일부 필드만) */
function parseInput(input: ProductInput, partial: boolean) {
  const out: Record<string, unknown> = {};
  const fail = (m: string) => {
    throw new ValidationError(m);
  };

  if (input.name !== undefined || !partial) {
    if (typeof input.name !== 'string' || !input.name.trim() || input.name.trim().length > 255)
      fail('상품명을 1~255자로 입력해 주세요.');
    out.name = (input.name as string).trim();
  }
  if (input.description !== undefined) {
    if (typeof input.description !== 'string' || input.description.length > 5000) fail('상품 설명은 5,000자 이하로 입력해 주세요.');
    out.description = (input.description as string).trim() || null;
  }
  if (input.category !== undefined) {
    if (typeof input.category !== 'string' || input.category.length > 50) fail('카테고리는 50자 이하로 입력해 주세요.');
    out.category = (input.category as string).trim() || null;
  }
  if (input.price_cents !== undefined || !partial) {
    const n = toInt(input.price_cents);
    if (n === null || n < 100 || n > 100_000_000) fail('판매가는 100원 ~ 1억원 사이의 정수로 입력해 주세요.');
    out.price_cents = n;
  }
  if (input.compare_at_price_cents !== undefined) {
    if (input.compare_at_price_cents === '' || input.compare_at_price_cents === null) {
      out.compare_at_price_cents = null;
    } else {
      const n = toInt(input.compare_at_price_cents);
      if (n === null || n < 1) fail('정가는 양의 정수로 입력해 주세요.');
      out.compare_at_price_cents = n;
    }
  }
  if (input.stock !== undefined || !partial) {
    const n = toInt(input.stock ?? 0);
    if (n === null || n < 0 || n > 1_000_000) fail('재고는 0 이상의 정수로 입력해 주세요.');
    out.stock = n;
  }
  if (input.is_active !== undefined) {
    out.is_active = input.is_active === true || input.is_active === 'true' || input.is_active === '1';
  }
  const price = out.price_cents as number | undefined;
  const compare = out.compare_at_price_cents as number | null | undefined;
  if (price !== undefined && compare && compare <= price) {
    out.compare_at_price_cents = null; // 정가가 판매가 이하이면 할인 표시를 하지 않음
  }
  return out;
}

export async function createProduct(input: ProductInput): Promise<Product> {
  const data = parseInput(input, false);
  const imageUrl = input.image ? await uploadFile(input.image) : null;
  const result = await query(
    `INSERT INTO products (name, description, category, price_cents, compare_at_price_cents, stock, image_url, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING ${SELECT_COLUMNS}`,
    [
      data.name,
      data.description ?? null,
      data.category ?? null,
      data.price_cents,
      data.compare_at_price_cents ?? null,
      data.stock,
      imageUrl,
      data.is_active ?? true,
    ]
  );
  return mapRow(result.rows[0]);
}

export async function updateProduct(id: number, input: ProductInput): Promise<Product> {
  const existing = await getProductById(id, { includeInactive: true });
  const data = parseInput(input, true);

  if (data.compare_at_price_cents && data.price_cents === undefined && (data.compare_at_price_cents as number) <= existing.price_cents) {
    data.compare_at_price_cents = null;
  }

  if (input.image) {
    data.image_url = await uploadFile(input.image);
  }

  const keys = Object.keys(data);
  if (keys.length === 0) return existing;

  const sets = keys.map((k, i) => `${k} = $${i + 1}`);
  const values = keys.map((k) => data[k]);
  values.push(id);
  const result = await query(
    `UPDATE products SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${values.length} RETURNING ${SELECT_COLUMNS}`,
    values
  );

  if (input.image && existing.image_url && existing.image_url !== data.image_url) {
    await deleteFile(existing.image_url);
  }
  if (data.is_active === false) {
    await query('DELETE FROM cart_items WHERE product_id = $1', [id]);
  }
  return mapRow(result.rows[0]);
}

/**
 * 상품 삭제.
 * 주문 이력이 있는 상품은 주문서·정산 기록을 지키기 위해 '판매 중지(숨김)' 처리만 하고,
 * 주문 이력이 없는 상품만 실제로 삭제합니다.
 */
export async function deleteProduct(id: number): Promise<{ deleted: boolean; deactivated: boolean }> {
  const product = await getProductById(id, { includeInactive: true });
  const used = await query<{ n: number }>('SELECT COUNT(*)::int AS n FROM order_items WHERE product_id = $1', [id]);
  if (used.rows[0].n > 0) {
    await query('UPDATE products SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);
    await query('DELETE FROM cart_items WHERE product_id = $1', [id]);
    return { deleted: false, deactivated: true };
  }
  await query('DELETE FROM products WHERE id = $1', [id]);
  if (product.image_url) await deleteFile(product.image_url);
  return { deleted: true, deactivated: false };
}
