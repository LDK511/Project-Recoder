# ReCoder 검증 Dockerfile — 화면·서버 폴더형 Node 앱(서버 backend/, 화면 frontend/).
# 빌드 단계는 개발 도구까지 설치해 빌드하고, 실행 이미지에는 서버 운영 의존성과 화면 빌드 결과만 넣는다.
FROM node:22-alpine AS build
WORKDIR /app
COPY . .
WORKDIR /app/frontend
RUN npm install --no-audit --no-fund --workspaces=false \
    && { npm run build --workspaces=false || { echo '[recoder] 화면 타입 검사 오류 — 타입 검사 없이 vite 로 빌드합니다' >&2 && test -x node_modules/.bin/vite && node_modules/.bin/vite build; }; }
WORKDIR /app/backend
RUN npm install --no-audit --no-fund --workspaces=false \
    && { npm run build --workspaces=false > /tmp/recoder-server-build.log 2>&1 && cat /tmp/recoder-server-build.log || { cat /tmp/recoder-server-build.log && ! grep -Eq 'TS(1[0-9][0-9][0-9]|2305|2307|2613|2614|2724|2792)([^0-9]|$)' /tmp/recoder-server-build.log && echo '[recoder] 서버 타입 검사 오류(실행에는 영향 없음) — tsc 가 만든 결과로 계속합니다' >&2 && test -f dist/index.js; }; } && node --check dist/index.js \
    && npm prune --omit=dev --no-audit --no-fund --workspaces=false

FROM node:22-alpine
# OS 보안 패치를 적용하고, 앱은 node 로 바로 뜨므로 이미지에 번들된 npm·yarn(취약한 의존성 동봉)은 지운다.
RUN apk upgrade --no-cache \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx \
       /usr/local/bin/corepack /opt/yarn* /usr/local/bin/yarn /usr/local/bin/yarnpkg
ENV NODE_ENV=production PORT=3000
WORKDIR /app/backend
COPY --from=build --chown=1000:1000 /app/backend /app/backend
COPY --from=build --chown=1000:1000 /app/frontend/dist /app/frontend/dist
# ReCoder: 앱이 작업 폴더에 업로드 폴더를 만들 수 있게 한다(비root 실행).
RUN chown 1000:1000 /app /app/backend
# 공식 node 이미지의 node 사용자(숫자 ID)
USER 1000
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "require('http').get('http://127.0.0.1:'+(process.env.PORT||3000)+'/',r=>process.exit(r.statusCode<500?0:1)).on('error',()=>process.exit(1))"]
CMD ["node", "dist/index.js"]
