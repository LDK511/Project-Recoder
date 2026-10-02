# 쇼핑몰 애플리케이션

Node.js + Express + PostgreSQL + React 기반의 풀스택 쇼핑몰 애플리케이션입니다.

## 프로젝트 구조

```
.
├── backend/              # Express 서버
│   ├── server.js         # 서버 진입점
│   ├── db.js             # PostgreSQL 연결 및 초기화
│   ├── routes/           # API 라우트
│   ├── package.json
│   └── .env.example
├── frontend/             # React + Vite 앱
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx
│   │   ├── context/      # 상태관리
│   │   ├── pages/        # 페이지 컴포넌트
│   │   ├── components/   # 재사용 컴포넌트
│   │   └── App.css
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── package.json          # 루트 워크스페이스
└── README.md
```

## 기술 스택

- **백엔드**: Node.js, Express.js
- **데이터베이스**: PostgreSQL
- **프론트엔드**: React 18, Vite, React Router v6
- **상태관리**: React Context API
- **스타일**: CSS

## 설치 및 실행

### 1. 저장소 클론 및 의존성 설치

```bash
# 루트 디렉토리에서
npm install
```

### 2. 환경변수 설정

#### 백엔드 환경변수

```bash
cd backend
cp .env.example .env
```

`.env` 파일을 편집하여 PostgreSQL 연결 정보를 설정합니다:

```
DATABASE_URL=postgresql://username:password@localhost:5432/shopping_mall
PORT=5000
NODE_ENV=development
```

### 3. PostgreSQL 데이터베이스 생성

```bash
# PostgreSQL 클라이언트에서
CREATE DATABASE shopping_mall;
```

### 4. 개발 서버 실행

```bash
# 루트 디렉토리에서 (백엔드 + 프론트엔드 동시 실행)
npm run dev
```

또는 개별 실행:

```bash
# 터미널 1: 백엔드 (포트 5000)
cd backend
npm run dev

# 터미널 2: 프론트엔드 (포트 5173)
cd frontend
npm run dev
```

### 5. 프로덕션 빌드

```bash
# 프론트엔드 빌드
cd frontend
npm run build

# 루트에서 백엔드 시작 (빌드된 프론트엔드 정적 제공)
cd ..
NODE_ENV=production npm start
```

## API 엔드포인트

### 헬스 체크
- `GET /api/health` - 서버 상태 확인

### 상품
- `GET /api/products` - 모든 상품 조회
- `GET /api/products/:id` - 특정 상품 조회

### 카테고리
- `GET /api/categories` - 모든 카테고리 조회

### 주문
- `POST /api/orders` - 주문 생성
  - Body: `{items: [{productId, quantity}], customerName, email, address}`
- `GET /api/orders/:orderId` - 주문 조회

## 주요 기능

- ✅ 상품 목록 조회 및 필터링
- ✅ 상품 상세 정보 조회
- ✅ 장바구니 관리 (Context API)
- ✅ 주문 생성 및 조회
- ✅ 반응형 UI
- ✅ 정적 파일 제공

## 데이터베이스 스키마

### categories 테이블
```sql
CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### products 테이블
```sql
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price NUMERIC(10, 2) NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  image VARCHAR(255),
  category_id INTEGER REFERENCES categories(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### orders 테이블
```sql
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  customer_name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL,
  address TEXT NOT NULL,
  total NUMERIC(10, 2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### order_items 테이블
```sql
CREATE TABLE order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 환경변수

### 백엔드
- `DATABASE_URL`: PostgreSQL 연결 문자열
- `PORT`: 서버 포트 (기본값: 5000)
- `NODE_ENV`: 실행 환경 (development/production)

## 문제 해결

### PostgreSQL 연결 오류
- `DATABASE_URL`이 올바르게 설정되었는지 확인
- PostgreSQL 서버가 실행 중인지 확인
- 데이터베이스가 생성되었는지 확인

### 포트 충돌
- 백엔드: `PORT` 환경변수로 포트 변경
- 프론트엔드: `vite.config.js`에서 포트 설정

## 라이선스

MIT
