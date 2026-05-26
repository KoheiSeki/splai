# Infrastructure Setup

## Supabase

1. https://supabase.com で新規プロジェクト作成(Region: Tokyo)
2. Connection String (asyncpg 形式に変換):
   - 元: `postgresql://postgres:...@host:5432/postgres`
   - 変換: `postgresql+asyncpg://postgres:...@host:5432/postgres`
3. service_role key を Backend の SUPABASE_SERVICE_ROLE_KEY にセット
4. ストレージバケット `receipts` を作成(private、公開アクセス不可)

## Vercel

- (Task 17 で実施)

## Fly.io

- (Task 18 で実施)

## Sentry

- (Task 19 で実施)
