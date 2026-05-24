import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    // lib/env.ts は import 時に process.env を検証するため、テスト環境でも
    // 必須キーを満たす必要がある。.env.local は vitest が自動読み込みしないので
    // ここで明示する。`parseEnv({})` の負系テストは引数で空を渡すので影響しない。
    env: {
      NEXT_PUBLIC_API_BASE_URL: 'http://localhost:8000',
      NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
    },
  },
  resolve: {
    // tsconfig.json の "paths": { "@/*": ["./*"] } を vitest 側にも反映させる。
    // vitest は tsconfig の paths を自動では読まないため、ここで明示する。
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
});
