import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * 모의 결제 서버 라우트
 * NODE_ENV=test 이고 PAYMENT_MODE=mock 일 때만 활성화됩니다.
 * 실제 Stripe 서버 대신 로컬에서 결제를 시뮬레이션합니다.
 */

const mockPaymentRouter = Router();

// 메모리에 저장된 결제 의도 (실제 환경에서는 DB 사용)
const paymentIntents: Map<
  string,
  {
    id: string;
    amount: number;
    currency: string;
    status: string;
    client_secret: string;
    metadata: { orderId: string };
    created: number;
  }
> = new Map();

// 메모리에 저장된 웹훅 이벤트
const webhookEvents: Map<
  string,
  {
    id: string;
    type: string;
    data: {
      object: {
        id: string;
        amount: number;
        currency: string;
        status: string;
        metadata: { orderId: string };
      };
    };
    created: number;
  }
> = new Map();

/**
 * POST /v1/payment_intents
 * 결제 의도를 생성합니다 (Stripe API 호환)
 */
mockPaymentRouter.post('/v1/payment_intents', (req: Request, res: Response) => {
  const { amount, currency, metadata, idempotency_key } = req.body;

  // 멱등성 키가 있으면 기존 결제 의도 반환
  if (idempotency_key) {
    for (const intent of paymentIntents.values()) {
      if (intent.metadata.orderId === metadata?.orderId) {
        res.json({
          id: intent.id,
          amount: intent.amount,
          currency: intent.currency,
          status: intent.status,
          client_secret: intent.client_secret,
          metadata: intent.metadata,
        });
        return;
      }
    }
  }

  // 새로운 결제 의도 생성
  const paymentIntentId = `pi_${uuidv4().replace(/-/g, '').slice(0, 24)}`;
  const clientSecret = `${paymentIntentId}_secret_${uuidv4().replace(/-/g, '').slice(0, 24)}`;

  const intent = {
    id: paymentIntentId,
    amount: Number(amount),
    currency: String(currency).toLowerCase(),
    status: 'requires_payment_method',
    client_secret: clientSecret,
    metadata: metadata || {},
    created: Date.now(),
  };

  paymentIntents.set(paymentIntentId, intent);

  res.json({
    id: intent.id,
    amount: intent.amount,
    currency: intent.currency,
    status: intent.status,
    client_secret: intent.client_secret,
    metadata: intent.metadata,
  });
});

/**
 * GET /v1/payment_intents/:id
 * 결제 의도 상태를 조회합니다
 */
mockPaymentRouter.get('/v1/payment_intents/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const intent = paymentIntents.get(id);

  if (!intent) {
    res.status(404).json({ error: { message: 'No such payment_intent' } });
    return;
  }

  res.json({
    id: intent.id,
    amount: intent.amount,
    currency: intent.currency,
    status: intent.status,
    client_secret: intent.client_secret,
    metadata: intent.metadata,
  });
});

/**
 * POST /v1/payment_intents/:id/confirm
 * 결제를 확인하고 성공 상태로 변경합니다 (테스트용)
 */
mockPaymentRouter.post('/v1/payment_intents/:id/confirm', (req: Request, res: Response) => {
  const { id } = req.params;
  const intent = paymentIntents.get(id);

  if (!intent) {
    res.status(404).json({ error: { message: 'No such payment_intent' } });
    return;
  }

  // 결제 상태를 succeeded로 변경
  intent.status = 'succeeded';
  paymentIntents.set(id, intent);

  // 웹훅 이벤트 생성
  const eventId = `evt_${uuidv4().replace(/-/g, '').slice(0, 24)}`;
  const event = {
    id: eventId,
    type: 'payment_intent.succeeded',
    data: {
      object: {
        id: intent.id,
        amount: intent.amount,
        currency: intent.currency,
        status: intent.status,
        metadata: intent.metadata,
      },
    },
    created: Date.now(),
  };

  webhookEvents.set(eventId, event);

  res.json({
    id: intent.id,
    amount: intent.amount,
    currency: intent.currency,
    status: intent.status,
    client_secret: intent.client_secret,
    metadata: intent.metadata,
  });
});

/**
 * POST /v1/events
 * 웹훅 이벤트를 생성합니다 (테스트용)
 */
mockPaymentRouter.post('/v1/events', (req: Request, res: Response) => {
  const { type, data } = req.body;

  const eventId = `evt_${uuidv4().replace(/-/g, '').slice(0, 24)}`;
  const event = {
    id: eventId,
    type,
    data,
    created: Date.now(),
  };

  webhookEvents.set(eventId, event);

  res.json(event);
});

/**
 * GET /v1/events/:id
 * 웹훅 이벤트를 조회합니다
 */
mockPaymentRouter.get('/v1/events/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const event = webhookEvents.get(id);

  if (!event) {
    res.status(404).json({ error: { message: 'No such event' } });
    return;
  }

  res.json(event);
});

/**
 * POST /v1/webhook_endpoints
 * 웹훅 엔드포인트를 등록합니다 (테스트용, 실제로는 아무것도 하지 않음)
 */
mockPaymentRouter.post('/v1/webhook_endpoints', (req: Request, res: Response) => {
  const { url, enabled_events } = req.body;

  res.json({
    id: `we_${uuidv4().replace(/-/g, '').slice(0, 24)}`,
    url,
    enabled_events,
    status: 'enabled',
    created: Date.now(),
  });
});

/**
 * 헬스 체크
 */
mockPaymentRouter.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'mock-payment-server' });
});

export default mockPaymentRouter;
