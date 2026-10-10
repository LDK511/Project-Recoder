/**
 * ReCoder 결제 모듈 — Stripe(PaymentIntents) 클라이언트·결제 만들기·웹훅 서명 검증.
 * 이 파일은 ReCoder 가 넣은 검증된 코드입니다. 앱 코드는 여기서 불러 쓰기만 하세요(직접 고치지 않음).
 *
 *  - 환경변수: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, NODE_ENV, PAYMENT_MODE, STRIPE_MOCK_HOST, STRIPE_MOCK_PORT
 *  - NODE_ENV=test 이고 PAYMENT_MODE=mock 일 때만 모의 결제 서버(http)로 보냅니다(로컬 데모). 운영에서는 거부합니다.
 *  - 결제 완료는 POST /api/webhooks/stripe 의 서명 검증된 payment_intent.succeeded 로만 처리합니다.
 */
import Stripe from 'stripe';
import express, { Router, Request, Response } from 'express';

export const STRIPE_WEBHOOK_PATH = '/api/webhooks/stripe';

/** 모의 결제(로컬 데모) 모드인가 — 화면이 "테스트 결제" 를 보여 줄지 정할 때 씁니다. */
export function isTestPaymentMode(): boolean {
  return process.env.NODE_ENV === 'test' && process.env.PAYMENT_MODE === 'mock';
}

/** 서버 시작 때 한 번 부르세요 — 잘못된 결제 설정이면 시작을 거부합니다. */
export function assertPaymentConfig(): void {
  if (process.env.PAYMENT_MODE === 'mock' && process.env.NODE_ENV !== 'test') {
    throw new Error('PAYMENT_MODE=mock 은 NODE_ENV=test 에서만 쓸 수 있습니다');
  }
  if (process.env.NODE_ENV === 'production' && process.env.STRIPE_MOCK_HOST) {
    throw new Error('운영(NODE_ENV=production)에서는 STRIPE_MOCK_HOST 를 설정할 수 없습니다');
  }
}

let client: Stripe | null = null;

/** Stripe 클라이언트(한 번만 만듭니다). */
export function getStripe(): Stripe {
  if (client) return client;
  assertPaymentConfig();
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY 가 없습니다');
  }
  if (isTestPaymentMode()) {
    client = new Stripe(key, {
      host: process.env.STRIPE_MOCK_HOST || 'localhost',
      port: parseInt(process.env.STRIPE_MOCK_PORT || '12111', 10),
      protocol: 'http',
    });
  } else {
    client = new Stripe(key);
  }
  return client;
}

export interface CreatedPayment {
  id: string;
  clientSecret: string | null;
  status: string;
  testMode: boolean;
}

/**
 * 결제 의도를 만듭니다. amount 는 통화의 가장 작은 단위 정수(원화는 원, 달러는 센트)입니다.
 * 같은 주문을 다시 결제하면 idempotencyKey(예: `order-<id>`)로 같은 결제를 돌려받습니다.
 */
export async function createPaymentIntent(params: {
  amount: number;
  currency: string;
  orderId: string | number;
  idempotencyKey?: string;
}): Promise<CreatedPayment> {
  const amount = Math.round(Number(params.amount));
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('결제 금액이 올바르지 않습니다');
  }
  const intent = await getStripe().paymentIntents.create(
    {
      amount,
      currency: String(params.currency || 'krw').toLowerCase(),
      metadata: { orderId: String(params.orderId) },
      automatic_payment_methods: { enabled: true },
    },
    { idempotencyKey: params.idempotencyKey || `order-${params.orderId}` },
  );
  return { id: intent.id, clientSecret: intent.client_secret, status: intent.status, testMode: isTestPaymentMode() };
}

export interface PaymentEvent {
  eventId: string;
  orderId: string;
  paymentIntentId: string;
  amount: number;
  currency: string;
}

export interface PaymentEventHandlers {
  /** 결제 완료 — 주문을 결제 완료로 바꾸세요. 같은 eventId 로 두 번 와도 한 번만 반영되게(멱등) 만드세요. */
  onPaymentSucceeded(event: PaymentEvent): Promise<void>;
  /** 결제 실패(선택) */
  onPaymentFailed?(event: PaymentEvent): Promise<void>;
}

/**
 * 결제 웹훅 라우터. **express.json() 보다 먼저** 이렇게 등록하세요:
 *   app.use(STRIPE_WEBHOOK_PATH, createStripeWebhookRouter({ onPaymentSucceeded, onPaymentFailed }));
 */
export function createStripeWebhookRouter(handlers: PaymentEventHandlers): Router {
  const router = express.Router();
  router.post('/', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    const signature = req.headers['stripe-signature'];
    if (!secret || typeof signature !== 'string') {
      res.status(400).json({ error: 'missing webhook signature' });
      return;
    }
    let event: Stripe.Event;
    try {
      event = getStripe().webhooks.constructEvent(req.body as Buffer, signature, secret);
    } catch {
      res.status(400).json({ error: 'invalid webhook signature' });
      return;
    }
    const intent = event.data.object as Stripe.PaymentIntent;
    const orderId = intent && intent.metadata ? intent.metadata.orderId : undefined;
    if (!orderId) {
      res.json({ received: true, ignored: 'no orderId' });
      return;
    }
    const payload: PaymentEvent = {
      eventId: event.id,
      orderId: String(orderId),
      paymentIntentId: intent.id,
      amount: intent.amount,
      currency: intent.currency,
    };
    try {
      if (event.type === 'payment_intent.succeeded') {
        await handlers.onPaymentSucceeded(payload);
      } else if (event.type === 'payment_intent.payment_failed' && handlers.onPaymentFailed) {
        await handlers.onPaymentFailed(payload);
      }
    } catch (err) {
      console.error('[payments] webhook handler failed', err);
      res.status(500).json({ error: 'webhook handling failed' });
      return;
    }
    res.json({ received: true });
  });
  return router;
}
