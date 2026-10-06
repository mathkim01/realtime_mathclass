import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
  if (key && key !== 'sb_publishable_REPLACE_ME' && !key.startsWith('sb_publishable_')) {
    throw new Error('VITE_SUPABASE_PUBLISHABLE_KEY에는 sb_publishable_로 시작하는 공개 키만 넣으세요. 비밀 키는 브라우저 빌드에 사용할 수 없습니다.');
  }
  return {
    plugins: [react()],
    base: env.VITE_BASE_PATH || '/',
    build: { sourcemap: false, target: 'es2022' },
  };
});
