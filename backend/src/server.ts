import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initPool, closePool } from './db.js';
import { errorHandler, asyncHandler } from './middleware/errorHandler.js';
import { authMiddleware, adminMiddleware } from './middleware/auth.js';
import { isTestPaymentMode, assertPaymentConfig, createStripeWebhookRouter } from './payments/stripe.js';
import { processWebhook } from './services/payment.js';
import { updateOrderStatus } from './services/order.js';
import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import cartRoutes from './routes/cart.js';
import orderRoutes from './routes/orders.js';
import paymentRoutes from './routes/payment.js';
import adminRoutes from './routes/admin.js';
import mockPaymentRoutes from './routes/mock-payment.js';
import { HealthResponse } from './types.js';

// 환경변수 로드
dotenv.config();

// 결제 설정 검증
assertPaymentConfig();

const app = express();
const port = process.env.PORT || 3000;

// CORS 설정
app.use(
  cors({
    origin: process.env.NODE_ENV === 'production' ? process.env.FRONTEND_URL : '*',
    credentials: true,
  }),
);

// 결제 웹훅 라우터 (JSON 파서보다 먼저 등록)
app.use(
  '/api/webhooks/stripe',
  createStripeWebhookRouter({
    onPaymentSucceeded: async (event) => {
      console.log('[payment] Payment succeeded:', event);
      const orderId = parseInt(event.orderId, 10);
      await processWebhook({
        eventId: event.eventId,
        orderId,
        paymentIntentId: event.paymentIntentId,
        amount: event.amount,
        currency: event.currency,
        status: 'completed',
      });
    },
    onPaymentFailed: async (event) => {
      console.log('[payment] Payment failed:', event);
      const orderId = parseInt(event.orderId, 10);
      await processWebhook({
        eventId: event.eventId,
        orderId,
        paymentIntentId: event.paymentIntentId,
        amount: event.amount,
        currency: event.currency,
        status: 'failed',
      });
    },
  }),
);

// JSON 파서
app.use(express.json());

// 헬스 체크 엔드포인트
app.get(
  '/health',
  asyncHandler(async (req: Request, res: Response) => {
    const response: HealthResponse = {
      status: 'ok',
      test_payment_mode: isTestPaymentMode(),
    };
    res.json(response);
  }),
);

// API 라우트
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/mock-payment', mockPaymentRoutes);

// 정적 파일 제공 (프론트엔드 빌드 폴더)
if (process.env.NODE_ENV !== 'development') {
  app.use(express.static('frontend/dist'));
  // SPA 라우팅: 모든 미매칭 경로를 index.html로 리다이렉트
  app.get('*', (req: Request, res: Response) => {
    res.sendFile('frontend/dist/index.html', { root: process.cwd() });
  });
}

// 전역 에러 핸들러
app.use(errorHandler);

// 데이터베이스 초기화 및 데모 데이터 시드
async function initializeDatabase(): Promise<void> {
  try {
    const pool = initPool();
    console.log('[db] Database pool initialized');

    // 데모 데이터 시드 (SEED_DEMO=true 일 때)
    if (process.env.SEED_DEMO === 'true') {
      const { query } = await import('./db.js');
      const productCount = await query('SELECT COUNT(*) as count FROM products');
      const count = parseInt(productCount.rows[0]?.count || '0', 10);

      if (count === 0) {
        console.log('[db] Seeding demo products...');
        const demoProducts = [
          {
            name: '무선 이어폰',
            description: '고음질 무선 이어폰',
            price: 89000,
            stock: 50,
            image_url: 'https://placehold.co/300x200?text=무선이어폰',
          },
          {
            name: '스마트워치',
            description: '피트니스 추적 기능이 있는 스마트워치',
            price: 199000,
            stock: 30,
            image_url: 'https://placehold.co/300x200?text=스마트워치',
          },
          {
            name: '휴대용 충전기',
            description: '20000mAh 대용량 휴대용 충전기',
            price: 39000,
            stock: 100,
            image_url: 'https://placehold.co/300x200?text=충전기',
          },
          {
            name: 'USB-C 케이블',
            description: '고속 충전 USB-C 케이블',
            price: 15000,
            stock: 200,
            image_url: 'https://placehold.co/300x200?text=USB케이블',
          },
          {
            name: '블루투스 스피커',
            description: '방수 블루투스 스피커',
            price: 79000,
            stock: 40,
            image_url: 'https://placehold.co/300x200?text=스피커',
          },
        ];

        for (const product of demoProducts) {
          await query(
            `INSERT INTO products (name, description, price, stock, image_url, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [product.name, product.description, product.price, product.stock, product.image_url],
          );
        }
        console.log('[db] Demo products seeded successfully');
      }
    }
  } catch (err) {
    console.error('[db] Failed to initialize database:', err);
    throw err;
  }
}

// 서버 시작
async function start(): Promise<void> {
  try {
    // 데이터베이스 초기화
    await initializeDatabase();

    // 서버 시작
    app.listen(port, () => {
      console.log(`[server] Server running on port ${port}`);
      console.log(`[server] Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`[server] Payment mode: ${process.env.PAYMENT_MODE || 'production'}`);
      if (isTestPaymentMode()) {
        console.log(`[server] Test payment mode enabled (mock server at ${process.env.STRIPE_MOCK_HOST}:${process.env.STRIPE_MOCK_PORT})`);
      }
    });
  } catch (err) {
    console.error('[server] Failed to start server:', err);
    process.exit(1);
  }
}

// 우아한 종료
process.on('SIGTERM', async () => {
  console.log('[server] SIGTERM received, shutting down gracefully...');
  await closePool();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[server] SIGINT received, shutting down gracefully...');
  await closePool();
  process.exit(0);
});

// 서버 시작
start();

export default app;
