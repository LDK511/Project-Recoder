# 운영형 쇼핑몰 플랫폼

PostgreSQL, Express, React를 사용한 완전한 전자상거래 시스템입니다. 상품 관리, 회원 인증, 장바구니, 주문, 모의 결제, S3 이미지 저장, 페이지네이션을 지원합니다.

## 준비물

- Node.js 20+
- PostgreSQL 14+
- AWS S3 계정 (또는 S3 호환 서비스)
- Docker & Docker Compose (선택)

## 설치

```bash
npm install
```

## 환경 변수

### 백엔드 (`backend/.env`)

```
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://user:password@localhost:5432/shopping_mall
JWT_SECRET=<32자 이상의 임의 문자열>
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<AWS 액세스 키>
AWS_SECRET_ACCESS_KEY=<AWS 비밀 키>
S3_BUCKET=<S3 버킷 이름>
MOCK_PAYMENT_HOST=localhost
MOCK_PAYMENT_PORT=3001
SEED_DEMO=true
```

### 프론트엔드 (`frontend/.env`)

```
VITE_API_BASE_URL=http://localhost:3000
```

## 데이터베이스 초기화

```bash
npm run db:init
```

이 명령은 PostgreSQL 스키마를 생성하고 필요시 샘플 데이터를 삽입합니다.

## 개발 실행

### 터미널 1: 백엔드

```bash
cd backend
npm run dev
```

백엔드는 `http://localhost:3000`에서 실행됩니다.

### 터미널 2: 프론트엔드

```bash
cd frontend
npm run dev
```

프론트엔드는 `http://localhost:5173`에서 실행됩니다.

### 터미널 3: 모의 결제 서버 (자동 시작)

모의 결제 서버는 백엔드 시작 시 자동으로 `http://localhost:3001`에서 실행됩니다.

## 모의 결제 모드

로컬 개발은 기본적으로 모의 결제 모드(`NODE_ENV=test`, `PAYMENT_MODE=mock`)로 실행됩니다. 실제 Stripe 키 없이 결제를 테스트할 수 있습니다.

결제 화면에서 "테스트 결제 진행 중" 메시지가 표시되고, 주문 상태가 자동으로 업데이트됩니다.

## 프로덕션 빌드

```bash
npm run build
```

프론트엔드 빌드 결과는 `frontend/dist`에 생성되며, 백엔드가 정적 파일로 제공합니다.

## Docker 실행

### 전체 스택 (PostgreSQL + 백엔드 + 프론트엔드)

```bash
docker-compose up
```

- 프론트엔드: `http://localhost:80`
- 백엔드 API: `http://localhost:3000/api`
- 모의 결제 서버: `http://localhost:3001`

### 개별 이미지 빌드

```bash
docker build -t shopping-mall-backend ./backend
docker build -t shopping-mall-frontend ./frontend
```

## API 엔드포인트

### 인증
- `POST /api/auth/register` - 회원가입
- `POST /api/auth/login` - 로그인
- `POST /api/auth/logout` - 로그아웃

### 상품
- `GET /api/products` - 상품 목록 (페이지네이션, 검색, 정렬)
- `GET /api/products/:id` - 상품 상세
- `POST /api/products` - 상품 생성 (관리자)
- `PUT /api/products/:id` - 상품 수정 (관리자)
- `DELETE /api/products/:id` - 상품 삭제 (관리자)

### 장바구니
- `GET /api/cart` - 장바구니 조회
- `POST /api/cart/items` - 항목 추가
- `PUT /api/cart/items/:id` - 항목 수량 수정
- `DELETE /api/cart/items/:id` - 항목 삭제

### 주문
- `POST /api/orders/checkout` - 주문 생성
- `GET /api/orders` - 주문 목록
- `GET /api/orders/:id` - 주문 상세
- `POST /api/orders/:id/cancel` - 주문 취소

### 결제
- `POST /api/webhooks/stripe` - 결제 완료 웹훅

### 헬스 체크
- `GET /health` - 서버 상태 확인

## 주요 기능

### 보안
- JWT 기반 인증 (24시간 만료)
- bcryptjs로 비밀번호 해싱
- 로그인 시도 횟수 제한 (5회/15분)
- CORS 및 CSRF 보호
- 결제 웹훅 HMAC-SHA256 서명 검증

### 데이터 무결성
- PostgreSQL 트랜잭션으로 동시 주문 초과 판매 방지
- 행 잠금(FOR UPDATE)으로 재고 예약
- 주문 재시도 방지 (idempotency key)
- 결제 이벤트 중복 처리 방지 (event_id UNIQUE)

### 상품 이미지
- AWS S3 (또는 호환 서비스)에 저장
- 멀티파트 폼 데이터로 업로드
- 서명된 URL로 접근

### 페이지네이션
- Offset/Limit 기반
- 상품 목록, 주문 목록 지원

## 문제 해결

### 데이터베이스 연결 오류

`DATABASE_URL`이 올바른지 확인하세요:
```
postgresql://user:password@host:5432/database_name
```

### S3 업로드 실패

AWS 자격증명과 버킷 이름을 확인하세요. IAM 사용자는 `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` 권한이 필요합니다.

### 모의 결제 서버 포트 충돌

`MOCK_PAYMENT_PORT` 환경변수를 다른 포트로 변경하세요.

## 라이선스

MIT
