import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { closePool } from './config/database.js';
import { config, isProduction } from './config/env.js';
import { assertPaymentConfig, createStripeWebhookRouter, STRIPE_WEBHOOK_PATH, isTestPaymentMode } from './payments/stripe.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import healthRouter, { configRouter } from './routes/health.js';
import authRouter from './routes/auth.js';
import productsRouter from './routes/products.js';
import clientRouter from './routes/client.js';
import cartRouter from './routes/cart.js';
import ordersRouter from './routes/orders.js';
import paymentRouter from './routes/payment.js';
import adminRouter from './routes/admin.js';
import { runMigrations } from './db/migrate.js';
import { seedDatabase } from './db/seed.js';
import { expirePendingOrders } from './services/orderService.js';
import { handlePaymentSucceeded, handlePaymentFailed } from './services/paymentService.js';
import { getUploadDir, initializeUploadsDir } from './utils/s3.js';
import { NotFoundError } from './utils/errors.js';
import { logger } from './utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** 필수 환경변수와 위험한 설정을 시작 시점에 검사합니다. */
function validateEnvironment(): void {
  const missing = ['DATABASE_URL', 'JWT_SECRET'].filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  const jwtSecret = process.env.JWT_SECRET!;
  if (jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long');
  }
  if (isProduction && /your_jwt_secret|change_me|example/i.test(jwtSecret)) {
    throw new Error('JWT_SECRET 이 예시 값입니다. 운영에서는 무작위 값(예: openssl rand -base64 48)으로 바꾸세요.');
  }
  assertPaymentConfig();
  if (isProduction && process.env.SEED_DEMO === 'true') {
    logger.warn('SEED_DEMO=true in production: 데모 관리자 계정(admin@example.com)이 만들어집니다. 오픈 전 비밀번호를 바꾸거나 계정을 삭제하세요.');
  }
}

/** 프런트엔드 빌드 폴더 후보 (배포 구조에 따라 위치가 다를 수 있음) */
function findFrontendBuildDir(): string | null {
  const candidates = [
    process.env.FRONTEND_DIST_DIR,
    path.join(__dirname, '..', '..', 'frontend', 'dist'),
    path.join(process.cwd(), '..', 'frontend', 'dist'),
    path.join(process.cwd(), 'public'),
  ].filter(Boolean) as string[];
  return candidates.find((dir) => fs.existsSync(path.join(dir, 'index.html'))) ?? null;
}

function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');
  // 로드밸런서/리버스 프록시 뒤에서 실제 클라이언트 IP·프로토콜을 인식 (rate limit, 결제 리턴 URL)
  app.set('trust proxy', config.trustProxy);

  // 보안 헤더. CSP 는 결제(Stripe)·주소검색(다음 우편번호)·상품 이미지(외부 CDN)를 허용하도록 맞췄습니다.
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'script-src': ["'self'", 'https://js.stripe.com', 'https://t1.daumcdn.net', 'https://t1.kakaocdn.net', 'http://dmaps.daum.net'],
          'frame-src': ["'self'", 'https://js.stripe.com', 'https://hooks.stripe.com', 'https://postcode.map.daum.net', 'http://postcode.map.daum.net'],
          'img-src': ["'self'", 'data:', 'blob:', 'https:'],
          'connect-src': ["'self'", 'https://api.stripe.com'],
          'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com', 'https://cdn.jsdelivr.net'],
          'form-action': ["'self'", 'http:', 'https:'],
          'upgrade-insecure-requests': isProduction && process.env.DISABLE_HTTPS_UPGRADE !== 'true' ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false,
      // HTTPS 를 쓰지 않는 로컬/데모 환경에서 HSTS 가 브라우저에 남지 않도록 운영에서만 켭니다.
      strictTransportSecurity: isProduction ? { maxAge: 15552000, includeSubDomains: true } : false,
    })
  );

  app.use(
    cors({
      origin: (origin, cb) => {
        // 같은 출처 요청(origin 없음)과 허용 목록만 통과
        if (!origin || config.frontendUrls.includes(origin)) return cb(null, true);
        return cb(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id'],
      maxAge: 600,
    })
  );

  app.use(requestLogger);

  // 헬스체크
  app.use('/health', healthRouter);
  app.use('/api/health', healthRouter);

  // 결제 웹훅 (서명 검증을 위해 raw body 가 필요하므로 JSON 파서보다 먼저)
  app.use(
    STRIPE_WEBHOOK_PATH,
    createStripeWebhookRouter({
      onPaymentSucceeded: handlePaymentSucceeded,
      onPaymentFailed: handlePaymentFailed,
    })
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ limit: '1mb', extended: false }));

  app.use('/api/', apiLimiter);
  app.use('/api/config', configRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/products', productsRouter);
  app.use('/api/client', clientRouter);
  app.use('/api/cart', cartRouter);
  app.use('/api/orders', ordersRouter);
  app.use('/api/payment', paymentRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api', (_req, _res, next) => next(new NotFoundError('요청한 API 를 찾을 수 없습니다.')));

  // 업로드한 상품 이미지 (로컬 저장소 사용 시)
  app.use('/uploads', express.static(getUploadDir(), { maxAge: '30d', immutable: true, fallthrough: false }));

  // 프런트엔드 정적 파일 + SPA 라우팅 (개발 모드에서는 Vite 개발 서버가 담당)
  const frontendBuildDir = config.nodeEnv !== 'development' ? findFrontendBuildDir() : null;
  if (frontendBuildDir) {
    logger.info('Serving frontend build', { dir: frontendBuildDir });
    app.use(
      express.static(frontendBuildDir, {
        index: false,
        setHeaders: (res, filePath) => {
          // 해시가 붙은 빌드 산출물은 1년 캐시, 그 외는 매번 확인
          if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          } else {
            res.setHeader('Cache-Control', 'public, max-age=3600');
          }
        },
      })
    );
    app.get('*', (req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(frontendBuildDir, 'index.html'));
    });
  }

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: '페이지를 찾을 수 없습니다.', code: 'NOT_FOUND' });
  });
  app.use(errorHandler);
  return app;
}

async function startServer(): Promise<void> {
  try {
    validateEnvironment();
    logger.info('Environment variables validated');

    await runMigrations();
    logger.info('Database migrations are up to date');
    if (process.env.SEED_DEMO === 'true') {
      await seedDatabase();
    }
    await initializeUploadsDir();

    const app = createApp();
    const server = app.listen(config.port, () => {
      logger.info(`Server started on port ${config.port}`, {
        env: config.nodeEnv,
        testPaymentMode: isTestPaymentMode(),
      });
    });
    // 느린 클라이언트로부터 연결 고갈 방지
    server.headersTimeout = 65_000;
    server.requestTimeout = 60_000;

    // 결제 시간이 지난 주문 자동 만료(재고 복구) — 1분마다
    const sweeper = setInterval(() => {
      expirePendingOrders().catch((error) => logger.error('Order expiry job failed', { error }));
    }, 60_000);
    sweeper.unref();
    expirePendingOrders().catch((error) => logger.error('Order expiry job failed', { error }));

    let shuttingDown = false;
    const shutdown = (signal: string) => {
      if (shuttingDown) return;
      shuttingDown = true;
      logger.info(`${signal} received, shutting down gracefully`);
      clearInterval(sweeper);
      server.close(async () => {
        await closePool().catch(() => undefined);
        logger.info('Server closed');
        process.exit(0);
      });
      setTimeout(() => process.exit(1), 10_000).unref();
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('unhandledRejection', (reason) => logger.error('Unhandled promise rejection', { reason: String(reason) }));
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

startServer();
