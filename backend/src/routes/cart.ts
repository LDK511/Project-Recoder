import { Router, Request, Response } from 'express';
import { authMiddleware, getUser } from '../middleware/auth.js';
import { asyncHandler, ValidationError } from '../middleware/errorHandler.js';
import { getCart, addToCart, removeFromCart, clearCart } from '../services/cart.js';
import { isPositiveInteger } from '../utils/validation.js';

const router = Router();

/**
 * GET /api/cart
 * 현재 사용자의 장바구니를 조회합니다.
 */
router.get(
  '/',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const user = getUser(req);
    const cart = await getCart(user.id);
    res.json(cart);
  }),
);

/**
 * POST /api/cart/add
 * 장바구니에 상품을 추가합니다.
 * 요청: { product_id: number, quantity: number }
 */
router.post(
  '/add',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const user = getUser(req);
    const { product_id, quantity } = req.body;

    // 입력 검증
    if (!isPositiveInteger(product_id)) {
      throw new ValidationError('product_id must be a positive integer');
    }
    if (!isPositiveInteger(quantity)) {
      throw new ValidationError('quantity must be a positive integer');
    }

    const cart = await addToCart(user.id, Number(product_id), Number(quantity));
    res.json(cart);
  }),
);

/**
 * DELETE /api/cart/remove/:product_id
 * 장바구니에서 상품을 제거합니다.
 */
router.delete(
  '/remove/:product_id',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const user = getUser(req);
    const { product_id } = req.params;

    if (!isPositiveInteger(product_id)) {
      throw new ValidationError('product_id must be a positive integer');
    }

    const cart = await removeFromCart(user.id, Number(product_id));
    res.json(cart);
  }),
);

/**
 * POST /api/cart/clear
 * 장바구니를 비웁니다.
 */
router.post(
  '/clear',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const user = getUser(req);
    const cart = await clearCart(user.id);
    res.json(cart);
  }),
);

export default router;
