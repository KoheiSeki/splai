import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // kubb による自動生成コード(lib/api/gen/)。再生成で上書きされるため lint 対象外。
    // 型安全性は typecheck(`tsc --noEmit`)で別途担保している。
    'lib/api/gen/**',
  ]),
]);

export default eslintConfig;
