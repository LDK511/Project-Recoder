import { Router } from 'express';
import multer from 'multer';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/validateRequest.js';
import * as productService from '../services/productService.js';
import { MAX_IMAGE_BYTES } from '../utils/s3.js';
import { ValidationError } from '../utils/errors.js';
import { parseId, parsePagination, optionalTrimmed } from '../utils/validation.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_IMAGE_BYTES, files: 1 } });

export function parseListQuery(q: Record<string, unknown>, maxLimit = 60) {
  const { page, limit } = parsePagination(q, 12, maxLimit);
  const sort = (q.sort as string) || 'newest';
  if (!(productService.PRODUCT_SORTS as readonly string[]).includes(sort)) {
    throw new ValidationError('정렬 옵션이 올바르지 않습니다.');
  }
  return {
    page,
    limit,
    sort: sort as productService.ProductSort,
    search: optionalTrimmed(q.search, 100) ?? undefined,
    category: optionalTrimmed(q.category, 50) ?? undefined,
  };
}

/** GET /api/products?page&limit&search&category&sort — 판매 중인 상품 목록 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const opts = parseListQuery(req.query as Record<string, unknown>);
    const result = await productService.getProducts(opts);
    res.set('Cache-Control', 'public, max-age=15');
    res.json({ data: result.products, pagination: result.pagination });
  })
);

/** GET /api/products/categories — 카테고리와 상품 수 */
router.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    res.set('Cache-Control', 'public, max-age=60');
    res.json({ data: await productService.getCategories() });
  })
);

/** GET /api/products/:id */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const product = await productService.getProductById(parseId(req.params.id, '상품 번호'));
    res.json(product);
  })
);

/** POST /api/products (관리자, multipart: image 파일 + 필드) */
router.post(
  '/',
  authenticate,
  authorize('admin'),
  upload.single('image'),
  asyncHandler(async (req, res) => {
    const product = await productService.createProduct({ ...req.body, image: req.file?.buffer });
    res.status(201).json(product);
  })
);

/** PUT /api/products/:id (관리자, multipart) */
router.put(
  '/:id',
  authenticate,
  authorize('admin'),
  upload.single('image'),
  asyncHandler(async (req, res) => {
    const product = await productService.updateProduct(parseId(req.params.id, '상품 번호'), {
      ...req.body,
      image: req.file?.buffer,
    });
    res.json(product);
  })
);

/** DELETE /api/products/:id (관리자) — 주문 이력이 있으면 판매중지로 전환 */
router.delete(
  '/:id',
  authenticate,
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const result = await productService.deleteProduct(parseId(req.params.id, '상품 번호'));
    res.json({
      message: result.deleted ? '상품을 삭제했습니다.' : '주문 이력이 있어 판매 중지(숨김) 처리했습니다.',
      ...result,
    });
  })
);

export default router;
