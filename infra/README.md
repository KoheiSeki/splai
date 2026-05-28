# Infrastructure Setup

## Supabase

1. https://supabase.com で新規プロジェクト作成(Region: Tokyo)
2. Connection String (asyncpg 形式に変換):
   - 元: `postgresql://postgres:...@host:5432/postgres`
   - 変換: `postgresql+asyncpg://postgres:...@host:5432/postgres`
3. service_role key を Backend の SUPABASE_SERVICE_ROLE_KEY にセット
4. ストレージバケット `receipts` を作成(private、公開アクセス不可)

## Vercel

1. `npx vercel link` でプロジェクト紐付け
2. ダッシュボードで環境変数を設定:
   - NEXT_PUBLIC_API_BASE_URL (Fly.io URL)
   - NEXT_PUBLIC_APP_URL
   - NEXT_PUBLIC_SENTRY_DSN
3. GitHub 連携で自動デプロイ:
   - main → Production
   - develop → Preview
   - feature/\* → Preview

## Fly.io

1. `flyctl auth login` & `flyctl apps create splai-backend --region nrt`
2. `flyctl secrets set ...` で環境変数を設定
3. `flyctl deploy` でデプロイ
4. `https://splai-backend.fly.dev/health` で疎通確認

## Sentry

- (Task 19 で実施)
