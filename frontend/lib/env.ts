/**
 * 環境変数の検証(クライアント / サーバ両側で評価される)。
 *
 * ⚠️ Next.js の静的置換ルール:
 *   `NEXT_PUBLIC_*` 環境変数は、**`process.env.SPECIFIC_NAME` の形で参照された
 *   箇所のみ**ビルド時に文字列リテラルへ置換される。`process.env` を丸ごと
 *   渡すとブラウザバンドルでは空オブジェクトになり値が取れない。
 *   したがって parseEnv の引数は **各 key を個別に列挙する** こと。
 */
import { z } from 'zod';

const EnvSchema = z.object({
  // backend(Fly.io)の URL。axios baseURL に使う。Phase 1 で必須。
  NEXT_PUBLIC_API_BASE_URL: z.string().url(),
  // 自分自身(Vercel)の URL。Phase 2 で OGP / 共有メッセージ生成に使う予定。
  // Phase 1 では未使用のため optional にしておき、Phase 2 開始時に required へ昇格する。
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  return EnvSchema.parse(source);
}

export const env = parseEnv({
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
});
