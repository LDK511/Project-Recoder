/**
 * /api/client/* — 외부 채널(앱, 제휴몰 등)용 공개 상품 API.
 * 내부 필드(생성/수정 시각, 판매여부)를 빼고 꼭 필요한 정보만 내려줍니다.
 */
import { Router } from 'express';
import { asyncHandler } from '../middleware/validateRequest.js';
import { getProducts, getProductById } from '../services/productService.js';
import { parseId } from '../utils/validation.js';
import { parseListQuery } from './products.js';
import { Product } from '../types/index.js';

const router = Router();

const toPublic = (p: Product) => ({
  id: p.id,
  name: p.name,
  description: p.description,
  category: p.category,
  price_cents: p.price_cents,
  compare_at_price_cents: p.compare_at_price_cents,
  stock: p.stock,
  image_url: p.image_url,
});

router.get(
  '/products',
  asyncHandler(async (req, res) => {
    const result = await getProducts(parseListQuery(req.query as Record<string, unknown>));
    res.json({ data: result.products.map(toPublic), pagination: result.pagination });
  })
);

router.get(
  '/products/:id',
  asyncHandler(async (req, res) => {
    res.json(toPublic(await getProductById(parseId(req.params.id, '상품 번호'))));
  })
);

export default router;
