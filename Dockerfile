# Build stage for backend
FROM node:18-alpine AS backend-builder
WORKDIR /app

# Copy root and backend files
COPY package.json package-lock.json* ./
COPY backend ./backend

# Install dependencies
RUN npm install --omit=dev

# Build backend TypeScript
# ReCoder: build 스크립트가 frontend/ 에서 빌드하므로 그 의존성도 설치한다.
WORKDIR /app/frontend
RUN if [ -f package-lock.json ]; then npm ci || npm install; else npm install; fi
WORKDIR /app
RUN npm run build --workspace=backend
# ReCoder: 빌드에만 쓰는 하위 폴더 의존성은 실행 이미지에 넣지 않는다(크기·보안 검사).
RUN rm -rf frontend/node_modules

# Build stage for frontend
FROM node:18-alpine AS frontend-builder
WORKDIR /app

# Copy root and frontend files
COPY package.json package-lock.json* ./
COPY frontend ./frontend

# Install dependencies
RUN npm install --omit=dev

# Build frontend
RUN npm run build --workspace=frontend

# Runtime stage
FROM node:18-alpine

# hadolint ignore=DL3018
# Install dumb-init for proper signal handling
# ReCoder: OS 패키지는 기본 이미지 태그가 버전을 정합니다(저장소가 옛 버전을 지우면 고정한 버전 때문에 빌드가 깨짐)
# hadolint ignore=DL3018
RUN apk add --no-cache dumb-init

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S app && adduser -S -u 1001 -G app app

# Copy package files
COPY package.json package-lock.json* ./

# Install production dependencies only
RUN npm install --no-audit --no-fund --omit=dev

# Copy built backend from builder
COPY --from=backend-builder /app/backend/dist ./backend/dist
COPY --from=backend-builder /app/backend/src/payments ./backend/src/payments

# Copy built frontend from builder
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Change ownership
RUN chown -R app:app /app

# Switch to non-root user
USER 1001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD ["/bin/sh", "-c", "node -e \"require('http').get('http://localhost:' + (process.env.PORT || 3000) + '/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})\""]

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the backend server
CMD ["npm", "start", "--workspace=backend"]
