import { Router } from 'express';
import { registerUser, loginUser, getUserById } from '../services/authService.js';
import { authenticate, getUserId } from '../middleware/auth.js';
import { loginLimiter, registerLimiter } from '../middleware/rateLimiter.js';
import { asyncHandler } from '../middleware/validateRequest.js';

const router = Router();

/** POST /api/auth/register  { email, password, name } → { user, token } */
router.post(
  '/register',
  registerLimiter,
  asyncHandler(async (req, res) => {
    const { email, password, name } = req.body ?? {};
    const result = await registerUser(email, password, name);
    res.status(201).json(result);
  })
);

/** POST /api/auth/login  { email, password } → { user, token } */
router.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = req.body ?? {};
    res.json(await loginUser(email, password));
  })
);

/** GET /api/auth/me — 저장된 토큰이 아직 유효한지 확인하고 최신 사용자 정보를 돌려줍니다. */
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    res.json({ user: await getUserById(getUserId(req)) });
  })
);

/** POST /api/auth/logout — 토큰은 클라이언트에서 삭제합니다(무상태 JWT). */
router.post('/logout', (_req, res) => {
  res.json({ message: 'success' });
});

export default router;
