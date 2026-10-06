import { createClient } from '@supabase/supabase-js';
import { createSupabaseBackend } from './supabase-backend';

const url = import.meta.env.VITE_SUPABASE_URL || '';
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
const isConfigured = /^https:\/\/.+\.supabase\.co\/?$/.test(url) && !url.includes('YOUR_PROJECT') && key.startsWith('sb_publishable_') && !key.includes('REPLACE_ME');

// 정답을 포함한 데모 모듈은 운영 빌드에 포함하지 않습니다.
let backend;
if (import.meta.env.VITE_DEMO_MODE === 'true') {
  const { createDemoBackend } = await import('./demo-backend');
  backend = createDemoBackend();
} else {
  backend = createSupabaseBackend(isConfigured ? createClient(url, key) : null);
}
backend.isConfigured = isConfigured;
export { backend };
