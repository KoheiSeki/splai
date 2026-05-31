import { defineConfig } from '@kubb/core';
import { pluginClient } from '@kubb/plugin-client';
import { pluginOas } from '@kubb/plugin-oas';
import { pluginTs } from '@kubb/plugin-ts';
import { pluginZod } from '@kubb/plugin-zod';

/**
 * kubb 設定。
 *
 * 入力: backend が出力する OpenAPI スキーマ(`backend/openapi.json`)
 * 出力先: `lib/api/gen/` 配下に types / zod / clients を分離して配置
 *
 * 生成された client は X-Request-Id interceptor 付きの `lib/api/kubb-client.ts`
 * 経由で実 HTTP を打つ。これにより SPLAI 既存の axios apiClient(env 由来の
 * baseURL、リクエスト ID 付与、ロギング)を維持しつつ、関数の引数・戻り値を
 * OpenAPI から自動生成する。
 */
export default defineConfig({
  root: '.',
  input: { path: '../backend/openapi.json' },
  output: {
    path: './lib/api/gen',
    clean: true,
  },
  plugins: [
    pluginOas(),
    pluginTs({
      output: { path: 'types' },
      group: { type: 'tag' },
    }),
    pluginZod({
      output: { path: 'zod' },
      group: { type: 'tag' },
      typed: true,
    }),
    pluginClient({
      output: { path: 'clients' },
      group: { type: 'tag' },
      // X-Request-Id interceptor 付きの自前 axios wrapper を使う。
      // tsconfig の `@/*` alias 経由で解決(group の階層数に依存しない)。
      importPath: '@/lib/api/kubb-client',
    }),
  ],
});
