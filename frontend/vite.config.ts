import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 개발 중에는 /api, /uploads 요청을 백엔드(기본 3000번 포트)로 넘깁니다.
// 같은 출처로 동작하므로 CORS 설정 없이도 로그인·결제 리턴이 그대로 동작합니다.
const backend = process.env.VITE_DEV_BACKEND || 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': backend,
      '/uploads': backend,
    },
  },
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 700,
  },
});
