import { Router } from 'express';
import { isTestPaymentMode } from '../payments/stripe.js';
import { pingDatabase } from '../config/database.js';
import { config } from '../config/env.js';

const router = Router();

/**
 * GET /health, /api/health — 로드밸런서/오케스트레이터 헬스체크.
 * DB 에 연결할 수 없으면 503 을 돌려 트래픽에서 빠지도록 합니다.
 */
router.get('/', async (_req, res) => {
  const db = await pingDatabase();
  res.set('Cache-Control', 'no-store');
  res.status(db ? 200 : 503).json({
    status: db ? 'ok' : 'degraded',
    database: db ? 'up' : 'down',
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.round(process.uptime()),
    test_payment_mode: isTestPaymentMode(),
  });
});

export default router;

/** GET /api/config — 프런트엔드가 화면에 쓰는 공개 설정(배송비 정책, 사업자 정보, 결제 모드) */
export const configRouter = Router();
configRouter.get('/', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=60');
  res.json({
    store: config.store,
    shipping: {
      fee_cents: config.shipping.feeKrw,
      free_threshold_cents: config.shipping.freeThresholdKrw,
    },
    order_payment_timeout_minutes: config.orderPaymentTimeoutMinutes,
    test_payment_mode: isTestPaymentMode(),
    stripe_publishable_key: config.stripePublishableKey || null,
  });
});
