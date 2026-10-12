# 데일리데스크 쇼핑몰 — 실행·배포·운영 가이드

## 구성
```
backend/   Express + TypeScript API (포트 3000). 운영에서는 frontend/dist 를 함께 서비스합니다.
frontend/  React + Vite + Tailwind. `npm run build` → frontend/dist
docs/      설계 기록(ADR), 이 문서
```

## 로컬 실행 (개발)
```bash
# 1) PostgreSQL 준비 후
cd backend && cp .env.example .env     # DATABASE_URL, JWT_SECRET 등 수정
npm install && npm run dev             # 시작 시 마이그레이션·데모 데이터 자동 적용

# 2) 다른 터미널
cd frontend && npm install && npm run dev   # http://localhost:5173 (API 는 3000 으로 프록시)
```

## 배포 (단일 서버/컨테이너)
```bash
cd frontend && npm ci && npm run build
cd ../backend && npm ci && npm run build && npm start   # http://<host>:3000
```
- 서버가 시작할 때 **DB 마이그레이션을 자동 적용**합니다(여러 인스턴스가 동시에 떠도 한 번만). 별도로 실행하려면 `npm run db:init`.
- 헬스체크: `GET /health` → DB 연결이 끊기면 503.
- 결제대기 주문은 `ORDER_PAYMENT_TIMEOUT_MINUTES`(기본 30분)가 지나면 자동 취소되고 재고가 복구됩니다(서버 내 1분 주기 작업).

### 데모 모드 (실제 결제 없음)
`NODE_ENV=test`, `PAYMENT_MODE=mock`, `SEED_DEMO=true`  
→ 로그인 화면에 데모 계정 버튼이 보이고, 주문서에서 '테스트 결제'로 결제 완료까지 진행됩니다.

| 계정 | 이메일 | 비밀번호 |
|---|---|---|
| 관리자 | admin@example.com | Admin@123456 |
| 고객 | customer@example.com | Customer@123456 |

## 오픈 전 체크리스트
- [ ] `NODE_ENV=production`, `PAYMENT_MODE` 비우기
- [ ] `JWT_SECRET` 무작위 값 (`openssl rand -base64 48`) — 예시 값이면 서버가 시작을 거부합니다
- [ ] Stripe 실키: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`
- [ ] Stripe 대시보드 웹훅: `https://<도메인>/api/webhooks/stripe` — `payment_intent.succeeded`, `payment_intent.payment_failed`
- [ ] HTTPS(로드밸런서·Nginx 등) 적용, `PUBLIC_URL`·`FRONTEND_URL` 을 실제 도메인으로
- [ ] 사업자 정보 `STORE_*` 를 실제 값으로 (전자상거래법 제10조 표시 의무)
- [ ] 이용약관·개인정보처리방침 문안 검토 (`frontend/src/pages/PolicyPage.tsx`) — 위탁 업체(택배사·PG) 기재
- [ ] `SEED_DEMO=false` 또는 데모 관리자 계정 삭제/비밀번호 변경
- [ ] 상품 이미지: S3(`S3_BUCKET` 등) 설정 또는 `UPLOAD_DIR` 을 영구 볼륨에 마운트
- [ ] DB 자동 백업(관리형 DB 스냅샷 등)과 복구 연습
- [ ] 배송비 정책 `SHIPPING_FEE_KRW`, `FREE_SHIPPING_THRESHOLD_KRW` 확인

## 일상 운영 (관리자 센터 `/admin`)
1. **대시보드**: 오늘/이번 달 매출, '출고 처리할 주문'(결제완료), 재고 부족 상품
2. **주문 관리**: 결제완료 → `상품 준비 시작` → `송장 등록하고 발송`(택배사·송장번호) → `배송 완료 처리`  
   배송 전 취소는 `취소 및 환불`(재고 자동 복구), 배송완료 후 반품은 `반품 환불 처리`
3. **상품 관리**: 등록·수정·판매중지. 주문 이력이 있는 상품은 삭제 대신 판매중지 처리됩니다.

## 장애 대응
- 로그는 운영에서 한 줄 JSON 으로 출력됩니다. 응답 헤더/오류 본문의 `requestId` 로 해당 요청 로그를 찾으세요.
- 결제는 됐는데 주문이 '결제대기'인 경우: Stripe 대시보드에서 웹훅 전송 실패 여부 확인 → 재전송. 이벤트는 멱등 처리되므로 여러 번 보내도 안전합니다.
- 취소·만료된 주문에 결제가 들어오면 서버가 자동 환불하고 주문 이력에 남깁니다.
