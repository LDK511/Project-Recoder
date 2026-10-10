import { Router, Request, Response } from 'express';
import { authMiddleware, getUser, adminMiddleware } from '../middleware/auth.js';
import { asyncHandler, ValidationError, NotFoundError } from '../middleware/errorHandler.js';
import { isPositiveInteger, normalizePageNumber, normalizeLimitNumber, normalizeSearchQuery } from '../utils/validation.js';
import { query } from '../db.js';
import { Product } from '../types.js';

const router = Router();

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * GET /api/products
 * 상품 목록 조회 (페이지네이션, 검색 지원)
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const page = normalizePageNumber(req.query.page, DEFAULT_PAGE);
    const limit = normalizeLimitNumber(req.query.limit, DEFAULT_LIMIT, MAX_LIMIT);
    const search = normalizeSearchQuery(req.query.search);

    const offset = (page - 1) * limit;

    let countQuery = 'SELECT COUNT(*) as total FROM products';
    let dataQuery = 'SELECT * FROM products';
    const params: any[] = [];

    if (search) {
      const searchPattern = `%${search}%`;
      countQuery += ' WHERE name ILIKE $1 OR description ILIKE $1';
      dataQuery += ' WHERE name ILIKE $1 OR description ILIKE $1';
      params.push(searchPattern);
    }

    // 총 개수 조회
    const countResult = await query<{ total: string }>(
      countQuery,
      params,
    );
    const total = parseInt(countResult.rows[0]?.total || '0', 10);

    // 상품 목록 조회
    dataQuery += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);

    const result = await query<Product>(
      dataQuery,
      params,
    );

    res.json({
      items: result.rows,
      total,
      page,
      limit,
    });
  }),
);

/**
 * GET /api/products/:id
 * 상품 상세 조회
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!isPositiveInteger(id)) {
      throw new ValidationError('유효한 상품 ID를 입력하세요');
    }

    const result = await query<Product>(
      'SELECT * FROM products WHERE id = $1',
      [parseInt(id, 10)],
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('상품을 찾을 수 없습니다');
    }

    res.json(result.rows[0]);
  }),
);

/**
 * POST /api/products
 * 상품 생성 (관리자만)
 */
router.post(
  '/',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { name, description, price, stock, image_url } = req.body;

    // 입력 검증
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new ValidationError('상품명을 입력하세요');
    }

    if (!isPositiveInteger(price)) {
      throw new ValidationError('가격은 0보다 큰 정수여야 합니다');
    }

    if (!isPositiveInteger(stock)) {
      throw new ValidationError('재고는 0보다 큰 정수여야 합니다');
    }

    const priceInt = parseInt(price, 10);
    const stockInt = parseInt(stock, 10);

    const result = await query<Product>(
      `INSERT INTO products (name, description, price, stock, image_url, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [
        name.trim(),
        description || null,
        priceInt,
        stockInt,
        image_url || null,
      ],
    );

    res.status(201).json(result.rows[0]);
  }),
);

/**
 * PUT /api/products/:id
 * 상품 수정 (관리자만)
 */
router.put(
  '/:id',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, description, price, stock, image_url } = req.body;

    if (!isPositiveInteger(id)) {
      throw new ValidationError('유효한 상품 ID를 입력하세요');
    }

    const productId = parseInt(id, 10);

    // 상품 존재 확인
    const existingProduct = await query<Product>(
      'SELECT * FROM products WHERE id = $1',
      [productId],
    );

    if (existingProduct.rows.length === 0) {
      throw new NotFoundError('상품을 찾을 수 없습니다');
    }

    const current = existingProduct.rows[0];

    // 업데이트할 필드 준비
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        throw new ValidationError('상품명을 입력하세요');
      }
      updates.push(`name = $${paramIndex}`);
      values.push(name.trim());
      paramIndex++;
    }

    if (description !== undefined) {
      updates.push(`description = $${paramIndex}`);
      values.push(description || null);
      paramIndex++;
    }

    if (price !== undefined) {
      if (!isPositiveInteger(price)) {
        throw new ValidationError('가격은 0보다 큰 정수여야 합니다');
      }
      updates.push(`price = $${paramIndex}`);
      values.push(parseInt(price, 10));
      paramIndex++;
    }

    if (stock !== undefined) {
      if (!isPositiveInteger(stock)) {
        throw new ValidationError('재고는 0보다 큰 정수여야 합니다');
      }
      updates.push(`stock = $${paramIndex}`);
      values.push(parseInt(stock, 10));
      paramIndex++;
    }

    if (image_url !== undefined) {
      updates.push(`image_url = $${paramIndex}`);
      values.push(image_url || null);
      paramIndex++;
    }

    if (updates.length === 0) {
      res.json(current);
      return;
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(productId);

    const result = await query<Product>(
      `UPDATE products SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values,
    );

    res.json(result.rows[0]);
  }),
);

export default router;
