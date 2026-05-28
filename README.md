# splai-app

SPLAI(割り勘アプリ)実装リポジトリ。

設計・計画・規約は別リポジトリ [`splai`](https://github.com/<owner>/splai) を参照:

- 設計仕様: [`docs/superpowers/specs/design.md`](https://github.com/<owner>/splai/blob/main/docs/superpowers/specs/design.md)
- 開発規約: [`docs/conventions.md`](https://github.com/<owner>/splai/blob/main/docs/conventions.md)
- フェーズ計画: [`docs/superpowers/plans/`](https://github.com/<owner>/splai/tree/main/docs/superpowers/plans)
- ブランド: [`docs/design/splai-brand-identity.html`](https://github.com/<owner>/splai/blob/main/docs/design/splai-brand-identity.html)

## Stack

- Frontend: Next.js 15 + TypeScript (frontend/)
- Backend: FastAPI + Python 3.12 (backend/)
- DB: Supabase PostgreSQL

## Branch strategy

Git Flow Lite(詳細は規約 §1):

- `main` — 本番デプロイ(Vercel Production / Fly.io)
- `develop` — 開発統合(Vercel Preview)
- `feature/* | fix/* | chore/*` — 作業ブランチ → develop へ PR

## Local development

### Prerequisites

- Node.js 20+, npm 10+
- Python 3.12+, uv
- Supabase project (DATABASE_URL を取得)
- Sentry project (DSN を取得、任意)

### Setup

```bash
# Frontend
cd frontend
cp .env.local.example .env.local   # 値を埋める
npm install
npm run dev                             # http://localhost:3000

# Backend (別ターミナル)
cd backend
cp .env.example .env.local           # 値を埋める
uv sync
uv run alembic upgrade head          # マイグレーション適用
uv run uvicorn app.main:app --reload --port 8000
```

````

### Smoke check

```bash
curl http://localhost:3000/api/health
# → {"frontend":"ok","backend":{"status":"ok"}}
```

### Quality checks

```bash
# Frontend
cd frontend
npm run lint && npm run format:check && npm run typecheck && npm test

# Backend
cd backend
uv run ruff check . && uv run ruff format --check . && uv run pytest -v
```

## Deployment

- Frontend: Vercel(main → Production / develop → Preview の自動デプロイ)
- Backend: Fly.io(`flyctl deploy` または GitHub Actions、後者は Phase 1+ で導入)

## Phase

現在: Phase 0(Setup) 完了。
````
