
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // 현재 작업 디렉토리에서 환경 변수를 로드합니다.
  // Cast process to any to access cwd() and avoid TypeScript error in environments where Process type is incomplete.
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  // 우선순위: VITE_API_KEY -> API_KEY
  const apiKey = env.VITE_API_KEY || env.API_KEY || "";

  return {
    plugins: [react()],
    define: {
      // 클라이언트 코드에서 process.env.API_KEY로 접근할 수 있게 정의합니다.
      'process.env.API_KEY': JSON.stringify(apiKey)
    },
    server: {
      host: true,
      allowedHosts: ['suny.keymedidev.com']
    }
  };
});
