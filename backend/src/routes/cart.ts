import { Router } from 'express';
import { authenticate, getUserId } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/validateRequest.js';
import { getCart, addToCart, updateCartItem, removeFromCart, clearCart } from '../services/cartService.js';
import { parseId } from '../utils/validation.js';

const router = Router();
router.use(authenticate);

/** GET /api/cart → { items, total_cents, item_count } */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await getCart(getUserId(req)));
  })
);

/** POST /api/cart/items { product_id, quantity } — 이미 담긴 상품이면 수량 추가 */
router.post(
  '/items',
  asyncHandler(async (req, res) => {
    const item = await addToCart(getUserId(req), req.body ?? {});
    res.status(201).json(item);
  })
);

/** PUT /api/cart/items/:id { quantity } */
router.put(
  '/items/:id',
  asyncHandler(async (req, res) => {
    res.json(await updateCartItem(getUserId(req), parseId(req.params.id), req.body ?? {}));
  })
);

/** DELETE /api/cart/items/:id */
router.delete(
  '/items/:id',
  asyncHandler(async (req, res) => {
    await removeFromCart(getUserId(req), parseId(req.params.id));
    res.json({ message: 'success' });
  })
);

/** DELETE /api/cart — 전체 비우기 */
router.delete(
  '/',
  asyncHandler(async (req, res) => {
    await clearCart(getUserId(req));
    res.json({ message: 'success' });
  })
);

export default router;
