# Shopping Mall — Full-Stack E-Commerce Platform

실제 운영 가능한 풀스택 쇼핑몰. 회원가입/로그인, 상품 관리, 장바구니, 주문, 모의 결제를 포함합니다.

## Prerequisites

- Node.js 18+
- PostgreSQL 12+
- npm 9+

## Environment Variables

`.env` 파일을 루트에 만들고 다음을 설정하세요:

```
DATABASE_URL=postgresql://<user>:<password>@localhost:5432/<dbname>
JWT_SECRET=<min 32 random characters>
STRIPE_SECRET_KEY=sk_test_<your_stripe_test_key>
STRIPE_WEBHOOK_SECRET=whsec_<your_stripe_webhook_secret>
NODE_ENV=test
PAYMENT_MODE=mock
STRIPE_MOCK_HOST=localhost
STRIPE_MOCK_PORT=12111
PORT=3000
```

## Installation

```bash
npm install
npm run db:init
```

## Development

```bash
npm run dev
```

- Backend: http://localhost:3000
- Frontend: http://localhost:5173
- Mock Payment Server: http://localhost:12111 (자동 시작)

## Production Build

```bash
npm run build
npm start
```

## Database

PostgreSQL 스키마는 `backend/scripts/init-db.ts` 에서 자동 생성됩니다.

초기화:
```bash
npm run db:init
```

리셋:
```bash
npm run db:reset
```

## Docker

```bash
docker build -t shopping-mall .
docker run -p 3000:3000 \
  -e DATABASE_URL=postgresql://... \
  -e JWT_SECRET=... \
  -e STRIPE_SECRET_KEY=... \
  -e STRIPE_WEBHOOK_SECRET=... \
  -e NODE_ENV=test \
  -e PAYMENT_MODE=mock \
  shopping-mall
```

## Features

- **Authentication**: JWT 기반 회원가입/로그인, 5회 시도 제한(15분)
- **Products**: 상품 조회, 관리자 CRUD
- **Cart**: 장바구니 추가/제거/조회
- **Orders**: 주문 생성, 재고 예약, 취소
- **Payment**: 모의 결제(테스트 모드), Stripe 웹훅 검증
- **Admin**: 상품/주문 관리 대시보드

## API Health Check

```bash
curl http://localhost:3000/health
```

응답에 `test_payment_mode: true` 이면 모의 결제 모드입니다.
