# Phase 0: Project Setup & Deployment Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **更新履歴**
>
> - 2026-05-24 (初版): Phase 0 計画作成
> - 2026-05-24 (改訂): `docs/conventions.md` 制定に伴い整合(develop ブランチ、CamelModel 基底クラス、PR テンプレ、TypeScript strict 強化、CI 拡充等)
>
> **Phase 0 ブランチ運用上の特例**
> 規約 §1.3 では `main`/`develop` への直接 push を禁止しているが、**Phase 0 のブートストラップ作業中は main → develop の順で直接 push する**。Phase 1 以降は厳密に `feature/* → develop → main` の PR フローへ移行する(Task 22 で確認)。

**Goal:** 新規リポジトリ `splai-app` を作成し、Frontend(Next.js on Vercel)と Backend(FastAPI on Fly.io)のスケルトンを構築。両者が相互通信し、Supabase に接続でき、Sentry/structlog でログとエラートラッキングが動き、CI/CD が GitHub Actions で走る状態を作る。

**Architecture:** Monorepo 構成(`frontend/`, `backend/`, `infra/` を含む単一リポ)。Frontend は Next.js App Router + TypeScript + Zod + axios、Backend は FastAPI + Pydantic + SQLAlchemy + Alembic + structlog。Supabase は外部マネージドサービスとして利用、Backend が Service Role Key で全アクセスを仲介する(RLS不使用)。

**Tech Stack:** Next.js 16(React 19、Turbopack)、TypeScript 5、Tailwind CSS 4(brand tokens 用、`@theme` 形式)、npm、Python 3.12+、FastAPI、uv(Python パッケージマネージャ)、SQLAlchemy 2.x、Alembic、structlog、Sentry、GitHub Actions、Vercel、Fly.io、Supabase。

> **重要**: Next.js 16 / Tailwind v4 / React 19 は学習データの主流(Next 14 / Tailwind v3 / React 18)から大きく変わっている。実装で詰まったら **`frontend/node_modules/next/dist/docs/`** や **`frontend/node_modules/tailwindcss/`** を一次参照する(`frontend/AGENTS.md` の指示通り)。

**前提条件:**

- 開発者が GitHub アカウント所持
- Vercel / Fly.io / Supabase / Sentry のアカウント取得済(各無料枠でOK)
- Node.js 20+(npm 同梱)、Python 3.12+、uv、`flyctl` CLI、`supabase` CLI(任意)、`gh` CLI(任意)がローカルにインストール済

---

## File Structure

このフェーズで作成するリポジトリの最終構造:

```
splai-app/
├── README.md                          ← プロジェクト概要・ローカル起動手順
├── .gitignore
├── .editorconfig
├── .github/
│   ├── pull_request_template.md       ← PR テンプレート(規約 §3.2)
│   └── workflows/
│       ├── frontend-ci.yml            ← Frontend lint + format + typecheck + test + build
│       └── backend-ci.yml             ← Backend lint + format + test
├── frontend/
│   ├── package.json
│   ├── package-lock.json
│   ├── next.config.ts
│   ├── tsconfig.json
│   ├── postcss.config.mjs             ← Tailwind v4 plugin (@tailwindcss/postcss)
│   ├── .eslintrc.json
│   ├── .prettierrc
│   ├── .env.local.example
│   ├── public/
│   ├── app/
│   │   ├── layout.tsx                 ← フォント/ベースレイアウト
│   │   ├── page.tsx                   ← Hello画面(brand適用済)
│   │   ├── globals.css                ← brand tokens 定義
│   │   ├── api/
│   │   │   └── health/route.ts        ← Frontend → Backend 疎通テスト用
│   │   └── (sentry instrumentation)
│   ├── lib/
│   │   ├── api-client.ts              ← axios インスタンス + interceptor
│   │   ├── request-id.ts              ← UUID生成
│   │   └── env.ts                     ← Zod による環境変数検証
│   └── tests/
│       └── smoke.test.ts              ← 最小スモークテスト
├── backend/
│   ├── pyproject.toml
│   ├── uv.lock
│   ├── .python-version
│   ├── .env.example
│   ├── ruff.toml
│   ├── alembic.ini
│   ├── alembic/
│   │   ├── env.py
│   │   ├── script.py.mako
│   │   └── versions/                  ← (空、初回マイグレ作成時)
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                    ← FastAPIエントリ
│   │   ├── config.py                  ← Pydantic Settings
│   │   ├── logging_config.py          ← structlog 設定
│   │   ├── middleware/
│   │   │   ├── __init__.py
│   │   │   ├── request_id.py          ← X-Request-Id ハンドリング
│   │   │   └── logging.py             ← request/response ログ
│   │   ├── exceptions/
│   │   │   ├── __init__.py
│   │   │   ├── handlers.py            ← Global Exception Handler
│   │   │   └── domain.py              ← カスタム例外
│   │   ├── schemas/
│   │   │   ├── __init__.py
│   │   │   └── base.py                ← CamelModel 基底クラス(規約 §8.4)
│   │   ├── db/
│   │   │   ├── __init__.py
│   │   │   ├── session.py             ← SQLAlchemy セッション
│   │   │   └── base.py                ← Declarative Base
│   │   └── routers/
│   │       ├── __init__.py
│   │       └── health.py              ← /health エンドポイント
│   ├── tests/
│   │   ├── __init__.py
│   │   ├── conftest.py
│   │   └── test_health.py             ← /health のスモークテスト
│   ├── Dockerfile                     ← Fly.io デプロイ用
│   └── fly.toml                       ← Fly.io 設定
└── infra/
    └── README.md                      ← Supabase / Vercel / Fly.io / Sentry セットアップ手順
```

---

## Tasks

### Task 1: 新規リポジトリ作成と初期コミット

**Files:**

- Create: `splai-app/.gitignore`
- Create: `splai-app/.editorconfig`
- Create: `splai-app/README.md`

- [ ] **Step 1: 新規ディレクトリを作成しgit初期化**

```bash
mkdir -p ~/dev/git/splai-app
cd ~/dev/git/splai-app
git init -b main
```

- [ ] **Step 2: `.gitignore` を作成**

```
# OS
.DS_Store
Thumbs.db

# Editor
.vscode/
.idea/
*.swp

# Environment variables(両 repo 共通)
# 実値ファイルは無視、テンプレート(.env.example / .env.local.example)は追跡
.env
.env.*
!.env.example
!.env.local.example

# Frontend
frontend/node_modules/
frontend/.next/
frontend/out/
frontend/coverage/

# Backend
backend/__pycache__/
backend/.venv/
backend/.pytest_cache/
backend/.ruff_cache/
backend/dist/
backend/*.egg-info/

# Logs / artifacts
*.log

# Sentry build plugin token (auto-generated by @sentry/wizard)
.env.sentry-build-plugin
.sentryclirc
```

- [ ] **Step 3: `.editorconfig` を作成**

```
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

[*.py]
indent_size = 4

[Makefile]
indent_style = tab
```

- [ ] **Step 4: 最小 README を作成(後続タスクで肉付け)**

```markdown
# splai-app

SPLAI(割り勘アプリ)実装リポジトリ。

設計と計画は別リポジトリ [`application-dev-plan`](https://github.com/<owner>/application-dev-plan) を参照。

## Stack

- Frontend: Next.js + TypeScript (frontend/)
- Backend: FastAPI + Python 3.12 (backend/)
- DB: Supabase PostgreSQL

## Local development

詳細は Phase 0 計画書末尾「ローカル開発手順」を参照。
```

- [ ] **Step 5: 初期コミット**

```bash
git add .gitignore .editorconfig README.md
git commit -m "chore: initial project scaffolding"
```

- [ ] **Step 6: GitHub にリモートリポジトリを作成しpush**

```bash
gh repo create splai-app --private --source=. --remote=origin --push
# または手動: GitHubでリポ作成後
# git remote add origin git@github.com:<owner>/splai-app.git
# git push -u origin main
```

期待出力: GitHub にリポジトリが作成され、main ブランチが push される。

- [ ] **Step 7: `develop` ブランチを作成して push(規約 §1.1)**

```bash
git checkout -b develop
git push -u origin develop
git checkout main   # Phase 0 ブートストラップ中は main で直接作業を続ける
```

期待出力: GitHub に `develop` ブランチが作成される。Phase 1 以降の作業はこのブランチを起点とする feature ブランチ運用に切り替わる。

- [ ] **Step 8: GitHub のブランチ保護を仮設定(Phase 0 ブートストラップ用)**

Phase 0 中は **main / develop ともに保護を緩めて直接 push を許可**する(scaffolding 作業のため)。
Phase 0 完了後、Task 22 で本格運用モードに切り替える(下記 §Branch Protection 設計を参照)。

仮設定として、以下のみ Phase 0 中に有効化:

- `main` / `develop` 共通: **Allow force pushes: ❌**, **Allow deletions: ❌**(誤操作で履歴が飛ぶのを防ぐ)

CI の必須化は Task 20 で workflow を整備した後、Task 22 で有効化する。

---

### Task 2: Frontend スケルトン作成(Next.js + TypeScript)

**Files:**

- Create: `frontend/` 一式(Next.js が自動生成)
- Modify: `frontend/package.json`(追加パッケージ)
- Create: `frontend/.env.local.example`

- [ ] **Step 1: Next.js プロジェクトを作成**

```bash
cd ~/dev/git/splai-app
npx create-next-app@latest frontend \
  --typescript \
  --eslint \
  --tailwind \
  --app \
  --no-src-dir \
  --import-alias "@/*" \
  --turbopack
```

- [ ] **Step 2: 追加依存をインストール**

```bash
cd frontend
npm install zod axios @sentry/nextjs
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom @vitejs/plugin-react
npm install -D prettier eslint-config-prettier
```

- [ ] **Step 3: `.env.local.example` を作成**

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SENTRY_DSN=
```

- [ ] **Step 4: `.prettierrc` を作成**

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "printWidth": 100,
  "trailingComma": "all"
}
```

- [ ] **Step 5: `tsconfig.json` の strict オプションを強化(規約 §6.1)**

`npx create-next-app` が生成する `tsconfig.json` の `compilerOptions` に以下を追加(または既存値を上書き):

```jsonc
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true, // arr[0] が T | undefined になる
    "noImplicitReturns": true,
    "forceConsistentCasingInFileNames": true,
  },
}
```

`noUncheckedIndexedAccess` は後から有効化すると配列/Record アクセス箇所すべてで型エラーが出るため、**最初から有効化する**のが鉄則。

- [ ] **Step 6: コミット**

```bash
git add frontend/
git commit -m "feat(frontend): scaffold Next.js app with TypeScript, Tailwind, Vitest"
```

---

### Task 3: Frontend ブランドトークン適用

> **重要: Tailwind CSS v4 + Next.js 16 前提**
> `npx create-next-app@latest` は現時点(2026-05)で Next.js 16 系 + Tailwind CSS 4 系を生成する。v4 では:
>
> - `@tailwind base/components/utilities` は **廃止**。`@import "tailwindcss";` 1 行に置き換わる
> - `tailwind.config.ts` は**標準では使わない**。テーマトークンは CSS の `@theme {}` ブロックで定義する
> - `@theme` に `--color-*` を定義すると `bg-*` / `text-*` / `border-*` ユーティリティが自動生成される
> - 同様に `--font-*` を定義すると `font-*` ユーティリティが自動生成される(font-family のみ。weight は別途)

**Files:**

- Modify: `frontend/app/globals.css`
- Modify: `frontend/app/layout.tsx`
- Modify: `frontend/app/page.tsx`

- [ ] **Step 1: `globals.css` をブランドトークンで上書き**

設計書 12.3 / 12.4 に基づく(Tailwind v4 形式):

```css
@import 'tailwindcss';

@theme {
  /* SPLAI brand colors (design.md §12.3) */
  --color-ink: #0a0a0a;
  --color-paper: #f4f1e8;
  --color-red: #e8000c;
  --color-rule-grey: #cfd0cc;

  /* SPLAI typography family (design.md §12.4) */
  --font-display: 'Archivo Black', sans-serif;
  --font-jp-display: 'Noto Sans JP', sans-serif;
  --font-editorial: 'Shippori Mincho', serif;
  --font-mono: 'IBM Plex Mono', monospace;
}

@layer base {
  html {
    background: var(--color-paper);
    color: var(--color-ink);
  }
  body {
    font-family: var(--font-mono);
  }
}

@layer utilities {
  /* @theme で自動生成された font-* ユーティリティに、ブランド既定 weight を上乗せする */
  .font-jp-display {
    font-weight: 900;
  }
  .font-editorial {
    font-weight: 700;
  }
}
```

> **`tailwind.config.ts` は作成しない**。v4 では既定で読まれず、テーマは上記 `@theme` で完結する。`npx create-next-app` も v4 系プロジェクトでは config ファイルを生成しないので何も削除する必要はない。

- [ ] **Step 2: `app/layout.tsx` でフォントを読み込み**

```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SPLAI',
  description: '割り勘を、AIで終わらせる。',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Noto+Sans+JP:wght@400;700;900&family=Shippori+Mincho:wght@400;700&family=IBM+Plex+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 3: `app/page.tsx` を Hello画面に置き換え**

```tsx
export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 className="font-display text-8xl tracking-tighter">
        SPL<span className="text-red">AI</span>.
      </h1>
      <p className="font-mono text-sm mt-4 tracking-widest">/splaɪ/ — phase 0 hello</p>
    </main>
  );
}
```

- [ ] **Step 4: ローカル起動して確認**

```bash
cd frontend
npm run dev
# http://localhost:3000 を開き、SPLAIロゴが表示されることを確認
```

期待出力: クリーム背景に黒の "SPL" + 赤の "AI" のロゴ表示、下部にモノスペースのキャプション。

- [ ] **Step 5: コミット**

```bash
git add frontend/
git commit -m "feat(frontend): apply SPLAI brand tokens (color, type)"
```

---

### Task 4: Frontend axios + 環境変数バリデーション + リクエストID

**Files:**

- Create: `frontend/vitest.config.ts`(Task 5 の内容を前倒し)
- Create: `frontend/lib/env.ts`
- Create: `frontend/lib/request-id.ts`
- Create: `frontend/lib/api-client.ts`

> **前提**: 本タスクは vitest が動作することを前提とする。`npx create-next-app` は vitest を生成しないため、**最初に Task 5 Step 1(`vitest.config.ts` 作成)を前倒しで実施してから本 Task 4 Step 1 に入る**。`@/*` パスエイリアスを vitest 側にも明示し、`test.env` で env 検証用のデフォルト値を注入する必要がある(`lib/env.ts` の top-level `export const env = parseEnv(process.env)` がテスト import 時にも評価されるため)。

- [ ] **Step 1: 失敗するテストを書く(`tests/lib/env.test.ts`)**

```ts
// frontend/tests/lib/env.test.ts
import { describe, it, expect } from 'vitest';
import { parseEnv } from '@/lib/env';

describe('parseEnv', () => {
  it('throws when required env var is missing', () => {
    expect(() => parseEnv({})).toThrow(/NEXT_PUBLIC_API_BASE_URL/);
  });

  it('returns parsed env when all required vars are present', () => {
    const result = parseEnv({
      NEXT_PUBLIC_API_BASE_URL: 'http://localhost:8000',
      NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
    });
    expect(result.NEXT_PUBLIC_API_BASE_URL).toBe('http://localhost:8000');
  });
});
```

- [ ] **Step 2: テスト実行 → 失敗を確認**

```bash
cd frontend
npx vitest run tests/lib/env.test.ts
```

期待出力: FAIL `Cannot find module '@/lib/env'`

- [ ] **Step 3: `lib/env.ts` を実装**

```ts
import { z } from 'zod';

const EnvSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z.string().url(),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  return EnvSchema.parse(source);
}

export const env = parseEnv(process.env as Record<string, string | undefined>);
```

- [ ] **Step 4: テスト実行 → PASS確認**

```bash
npx vitest run tests/lib/env.test.ts
```

期待出力: 2 passed.

- [ ] **Step 5: `lib/request-id.ts` を実装**

```ts
export function generateRequestId(): string {
  return crypto.randomUUID();
}
```

- [ ] **Step 6: `lib/api-client.ts` を実装**

```ts
import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { env } from './env';
import { generateRequestId } from './request-id';

export const apiClient = axios.create({
  baseURL: env.NEXT_PUBLIC_API_BASE_URL,
  timeout: 15000,
});

apiClient.interceptors.request.use((config) => {
  const requestId = generateRequestId();
  config.headers['X-Request-Id'] = requestId;
  if (typeof window !== 'undefined') {
    console.debug(`[req ${requestId}] ${config.method?.toUpperCase()} ${config.url}`);
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    const requestId = response.config.headers['X-Request-Id'];
    if (typeof window !== 'undefined') {
      console.debug(`[res ${requestId}] ${response.status} ${response.config.url}`);
    }
    return response;
  },
  (error: AxiosError) => {
    const requestId = error.config?.headers?.['X-Request-Id'];
    if (typeof window !== 'undefined') {
      console.warn(
        `[err ${requestId}] ${error.response?.status ?? 'NETWORK'} ${error.config?.url}`,
      );
    }
    return Promise.reject(error);
  },
);
```

- [ ] **Step 7: コミット**

```bash
git add frontend/lib/ frontend/tests/
git commit -m "feat(frontend): add env validation, axios client with request-id interceptors"
```

---

### Task 5: Frontend Vitest 設定とスモークテスト

**Files:**

- Create: `frontend/vitest.config.ts`
- Create: `frontend/tests/smoke.test.ts`

- [ ] **Step 1: `vitest.config.ts` を作成**

```ts
// frontend/vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    // lib/env.ts は import 時に process.env を検証するため、テスト環境でも
    // 必須キーを満たす必要がある。.env.local は vitest が自動読み込みしない
    // ので、ここで明示する。`parseEnv({})` の負系テストは引数で空オブジェクトを
    // 渡すので、この env 注入の影響を受けない。
    env: {
      NEXT_PUBLIC_API_BASE_URL: 'http://localhost:8000',
      NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
    },
  },
  resolve: {
    // tsconfig.json の "paths": { "@/*": ["./*"] } を vitest 側にも反映。
    // vitest は tsconfig の paths を自動で読まないため、明示的に渡す。
    // ESM 環境で安全な fileURLToPath 形式を採用(`__dirname` は使えない)。
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
});
```

> **`__dirname` は使わない**: ESM ビルド前提なので CJS 専用変数の `__dirname` はエラーになる。`import.meta.url` ベースで書く。

- [ ] **Step 2: スモークテストを作成**

```ts
// frontend/tests/smoke.test.ts
import { describe, it, expect } from 'vitest';

describe('smoke', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 3: テスト実行**

```bash
cd frontend
npx vitest run
```

期待出力: 全テストPASS。

- [ ] **Step 4: `package.json` のスクリプトを完全版に更新(規約 §11.2)**

```json
{
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

`format:check` と `typecheck` は CI(Task 20)で呼び出す。ローカルでは `format` を保存時に走らせるのが基本。

- [ ] **Step 5: コミット**

```bash
git add frontend/
git commit -m "test(frontend): configure vitest with jsdom and add smoke test"
```

---

### Task 6: Backend スケルトン作成(FastAPI + uv)

**Files:**

- Create: `backend/pyproject.toml`
- Create: `backend/.python-version`
- Create: `backend/ruff.toml`
- Create: `backend/.env.example`
- Create: `backend/app/__init__.py`
- Create: `backend/app/main.py`

- [ ] **Step 1: `backend/` ディレクトリを作成して uv プロジェクト初期化**

```bash
cd ~/dev/git/splai-app
mkdir backend && cd backend
echo "3.12" > .python-version
uv init --no-readme --no-pin-python
```

> **`--package` を付けない**: `--package` は `src/<name>/` 形式のパッケージレイアウトを強制する(配布ライブラリ向け)。FastAPI アプリは配布しないので不要。フラット配置(`backend/app/main.py`)で本計画書の File Structure と一致させる。
>
> なお、デフォルトでは uv が `main.py` 等を自動生成する場合があるので、不要なら削除して構わない(本タスクの後続 Step で `app/main.py` を改めて作る)。

- [ ] **Step 2: 依存パッケージを追加**

```bash
# zsh では [...] が glob 展開されるため、extras を含む引数はすべて
# シングルクォートで囲む(bash でも問題ない)。
uv add fastapi 'uvicorn[standard]' pydantic pydantic-settings 'sqlalchemy[asyncio]' alembic asyncpg structlog 'sentry-sdk[fastapi]' httpx
uv add --dev pytest pytest-asyncio pytest-cov ruff httpx
```

> **zsh 落とし穴**: クォート無しで `sqlalchemy[asyncio]` を書くと `zsh: no matches found` エラーになる(zsh の `nomatch` がデフォルト ON のため)。bash 環境では通るが、Mac の既定シェルは zsh なので **常にクォートする**のが安全。

- [ ] **Step 3: `pyproject.toml` を確認・整理**

```toml
[project]
name = "splai-backend"
version = "0.1.0"
description = "SPLAI backend - FastAPI"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.115",
    "uvicorn[standard]>=0.30",
    "pydantic>=2.9",
    "pydantic-settings>=2.5",
    "sqlalchemy[asyncio]>=2.0",
    "alembic>=1.13",
    "asyncpg>=0.29",
    "structlog>=24.4",
    "sentry-sdk[fastapi]>=2.16",
    "httpx>=0.27",
]

[dependency-groups]
dev = [
    "pytest>=8.3",
    "pytest-asyncio>=0.24",
    "pytest-cov>=5.0",
    "ruff>=0.7",
    "httpx>=0.27",
]

[tool.pytest.ini_options]
testpaths = ["tests"]
asyncio_mode = "auto"

[tool.coverage.run]
source = ["app"]
```

- [ ] **Step 4: `ruff.toml` を作成**

```toml
line-length = 100
target-version = "py312"

[lint]
select = ["E", "F", "W", "I", "B", "UP", "N"]
ignore = ["E501"]

[lint.per-file-ignores]
"tests/*" = ["E501"]
```

- [ ] **Step 5: `.env.example` を作成**

```
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/splai
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
IBM_CA_API_KEY=
IBM_CA_BASE_URL=
GCP_VISION_CREDENTIALS_JSON=
SENTRY_DSN=
ENV=development
LOG_LEVEL=INFO
CORS_ORIGINS=http://localhost:3000
```

- [ ] **Step 6: `app/main.py` を最小実装**

```python
from fastapi import FastAPI

app = FastAPI(title="SPLAI Backend", version="0.1.0")


@app.get("/")
def root() -> dict[str, str]:
    return {"app": "splai", "phase": "0"}
```

- [ ] **Step 7: 起動して動作確認**

```bash
cd backend
uv run uvicorn app.main:app --reload --port 8000
# 別ターミナルで:
curl http://localhost:8000/
```

期待出力: `{"app":"splai","phase":"0"}`

- [ ] **Step 8: コミット**

```bash
cd ..
git add backend/
git commit -m "feat(backend): scaffold FastAPI app with uv"
```

---

### Task 7: Backend Pydantic Settings(設定読み込み)

**Files:**

- Create: `backend/app/config.py`
- Create: `backend/tests/test_config.py`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/conftest.py`

- [ ] **Step 1: 失敗するテストを書く**

```python
# backend/tests/test_config.py
import os
from app.config import Settings


def test_settings_loads_from_env(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://x@y/z")
    monkeypatch.setenv("ENV", "test")
    s = Settings()
    assert s.database_url == "postgresql+asyncpg://x@y/z"
    assert s.env == "test"


def test_settings_defaults(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://x@y/z")
    s = Settings()
    assert s.log_level == "INFO"
    assert s.env == "development"
```

- [ ] **Step 2: `tests/__init__.py` と `tests/conftest.py` を作成**

```python
# backend/tests/__init__.py
```

```python
# backend/tests/conftest.py
import os
import pytest


@pytest.fixture(autouse=True)
def _isolate_env(monkeypatch):
    """Each test gets a clean env by default."""
    for key in [
        "DATABASE_URL", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY",
        "ICA_API_KEY", "ICA_BASE_URL", "GCP_VISION_CREDENTIALS_JSON",
        "SENTRY_DSN", "ENV", "LOG_LEVEL",
    ]:
        monkeypatch.delenv(key, raising=False)
```

- [ ] **Step 3: テスト実行 → 失敗を確認**

```bash
cd backend
uv run pytest tests/test_config.py -v
```

期待出力: FAIL `ModuleNotFoundError: No module named 'app.config'`

- [ ] **Step 4: `app/config.py` を実装**

```python
import os
from typing import Literal
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# 既定で `.env.local` を読み込む(Next.js / JS エコシステムと命名統一)。
# 必要なら APP_ENV で別ファイルに切り替え可能:
#   APP_ENV 未設定 → .env.local (ローカル開発)
#   APP_ENV=test   → .env.test  (CI / テスト。実体不要、conftest.py が
#                                   os.environ.setdefault で値を注入する)
#   APP_ENV=prod   → .env.prod  (本番シミュレーション。通常は Fly.io secrets で代替)
#
# 環境変数(os.environ)は env_file よりも優先されるので、Fly.io secrets や
# CI の env で渡された値はファイルの値を上書きする。
_APP_ENV = os.getenv("APP_ENV")
_ENV_FILE = f".env.{_APP_ENV}" if _APP_ENV else ".env.local"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=_ENV_FILE, case_sensitive=False, extra="ignore")

    env: Literal["development", "staging", "production", "test"] = "development"
    log_level: str = "INFO"
    database_url: str = Field(...)
    cors_origins: str = "http://localhost:3000"  # カンマ区切りで複数指定可
    supabase_url: str | None = None
    supabase_service_role_key: str | None = None
    ibm_ca_api_key: str | None = None
    ibm_ca_base_url: str | None = None
    gcp_vision_credentials_json: str | None = None
    sentry_dsn: str | None = None


def get_settings() -> Settings:
    return Settings()
```

- [ ] **Step 5: テスト実行 → PASS確認**

```bash
uv run pytest tests/test_config.py -v
```

期待出力: 2 passed.

- [ ] **Step 6: コミット**

```bash
git add backend/app/config.py backend/tests/
git commit -m "feat(backend): add pydantic-settings based config"
```

---

### Task 8: Backend structlog 設定

**Files:**

- Create: `backend/app/logging_config.py`
- Create: `backend/tests/test_logging.py`

- [ ] **Step 1: 失敗するテストを書く**

```python
# backend/tests/test_logging.py
import json
import logging
import structlog
from app.logging_config import configure_logging


def test_logging_emits_json(capsys):
    configure_logging(log_level="INFO")
    log = structlog.get_logger("test")
    log.info("hello", foo="bar")
    out = capsys.readouterr().out.strip()
    parsed = json.loads(out)
    assert parsed["event"] == "hello"
    assert parsed["foo"] == "bar"
    assert parsed["level"] == "info"
```

- [ ] **Step 2: テスト実行 → 失敗を確認**

```bash
uv run pytest tests/test_logging.py -v
```

期待出力: FAIL `ModuleNotFoundError`

- [ ] **Step 3: `app/logging_config.py` を実装**

```python
import logging
import sys
import structlog


SENSITIVE_KEYS = {"authorization", "x-api-key", "password", "token", "api_key"}


def _mask_sensitive(_, __, event_dict: dict) -> dict:
    for key in list(event_dict.keys()):
        if key.lower() in SENSITIVE_KEYS:
            event_dict[key] = "********"
    return event_dict


def configure_logging(log_level: str = "INFO") -> None:
    # force=True で既存 handler(pytest が仕込むもの等)を撤去してから再設定する。
    # これが無いと basicConfig が no-op 化し、structlog 出力が capsys に届かず
    # tests/test_logging.py が "Expecting value: line 1 column 1" で失敗する。
    # 本番起動でも冪等で副作用が無いため常時 True でよい。
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=log_level.upper(),
        force=True,
    )

    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.stdlib.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            _mask_sensitive,
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(getattr(logging, log_level.upper())),
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )
```

- [ ] **Step 4: テスト実行 → PASS確認**

```bash
uv run pytest tests/test_logging.py -v
```

期待出力: 1 passed.

- [ ] **Step 5: コミット**

```bash
git add backend/app/logging_config.py backend/tests/test_logging.py
git commit -m "feat(backend): add structlog JSON logging with sensitive masking"
```

---

### Task 9: Backend X-Request-Id ミドルウェア

**Files:**

- Create: `backend/app/middleware/__init__.py`
- Create: `backend/app/middleware/request_id.py`
- Create: `backend/tests/test_middleware_request_id.py`

- [ ] **Step 1: `__init__.py` を作成**

```python
# backend/app/middleware/__init__.py
```

- [ ] **Step 2: 失敗するテストを書く**

```python
# backend/tests/test_middleware_request_id.py
import re
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient
from app.middleware.request_id import RequestIdMiddleware


def _build_app() -> FastAPI:
    app = FastAPI()
    app.add_middleware(RequestIdMiddleware)

    @app.get("/")
    def _root(request: Request):  # 型注釈必須: 無いとクエリパラメータ扱いになり 422 が返る
        return {"request_id": request.state.request_id}

    return app


def test_generates_uuid_when_header_missing():
    client = TestClient(_build_app())
    res = client.get("/")
    body = res.json()
    assert re.fullmatch(r"[0-9a-f-]{36}", body["request_id"])
    assert res.headers["X-Request-Id"] == body["request_id"]


def test_uses_provided_header_when_valid():
    client = TestClient(_build_app())
    valid_uuid = "7f3a9c2e-8b1d-4f6e-bd92-1a2b3c4d5e6f"
    res = client.get("/", headers={"X-Request-Id": valid_uuid})
    assert res.json()["request_id"] == valid_uuid
    assert res.headers["X-Request-Id"] == valid_uuid


def test_rejects_invalid_header_and_regenerates():
    client = TestClient(_build_app())
    res = client.get("/", headers={"X-Request-Id": "not-a-uuid"})
    body = res.json()
    assert body["request_id"] != "not-a-uuid"
    assert re.fullmatch(r"[0-9a-f-]{36}", body["request_id"])
```

- [ ] **Step 3: テスト実行 → 失敗を確認**

```bash
uv run pytest tests/test_middleware_request_id.py -v
```

期待出力: FAIL `ModuleNotFoundError`

- [ ] **Step 4: ミドルウェアを実装**

```python
# backend/app/middleware/request_id.py
import re
from uuid import uuid4

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp


_UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")


class RequestIdMiddleware(BaseHTTPMiddleware):
    """X-Request-Id ヘッダを正規化し、request.state.request_id にセットする。

    - ヘッダが UUIDv4 形式でない場合は新規生成して上書き。
    - レスポンスにも同じ X-Request-Id を返す。
    """

    def __init__(self, app: ASGIApp, header_name: str = "X-Request-Id") -> None:
        super().__init__(app)
        self.header_name = header_name

    async def dispatch(self, request: Request, call_next):
        incoming = request.headers.get(self.header_name, "")
        request_id = incoming if _UUID_RE.fullmatch(incoming.lower()) else str(uuid4())
        request.state.request_id = request_id

        response = await call_next(request)
        response.headers[self.header_name] = request_id
        return response
```

- [ ] **Step 5: テスト実行 → PASS確認**

```bash
uv run pytest tests/test_middleware_request_id.py -v
```

期待出力: 3 passed.

- [ ] **Step 6: コミット**

```bash
git add backend/app/middleware/ backend/tests/test_middleware_request_id.py
git commit -m "feat(backend): add X-Request-Id middleware"
```

---

### Task 10: Backend ロギングミドルウェア

**Files:**

- Create: `backend/app/middleware/logging.py`
- Create: `backend/tests/test_middleware_logging.py`

- [ ] **Step 1: 失敗するテストを書く**

```python
# backend/tests/test_middleware_logging.py
import json
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.middleware.request_id import RequestIdMiddleware
from app.middleware.logging import LoggingMiddleware
from app.logging_config import configure_logging


def _build_app() -> FastAPI:
    configure_logging("INFO")
    app = FastAPI()
    app.add_middleware(LoggingMiddleware)
    app.add_middleware(RequestIdMiddleware)

    @app.get("/ping")
    def _ping():
        return {"pong": True}

    return app


def test_logs_request_and_response(capsys):
    client = TestClient(_build_app())
    res = client.get("/ping")
    assert res.status_code == 200

    lines = [l for l in capsys.readouterr().out.splitlines() if l.strip()]
    parsed = [json.loads(l) for l in lines]
    events = [p["event"] for p in parsed]
    assert "request.start" in events
    assert "request.end" in events

    end = next(p for p in parsed if p["event"] == "request.end")
    assert end["status_code"] == 200
    assert end["method"] == "GET"
    assert end["path"] == "/ping"
    assert "request_id" in end
    assert "duration_ms" in end
```

- [ ] **Step 2: テスト実行 → 失敗を確認**

```bash
uv run pytest tests/test_middleware_logging.py -v
```

期待出力: FAIL `ModuleNotFoundError`

- [ ] **Step 3: ロギングミドルウェアを実装**

```python
# backend/app/middleware/logging.py
import time
import structlog
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware


_log = structlog.get_logger("http")


class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = getattr(request.state, "request_id", None)
        start = time.perf_counter()

        _log.info(
            "request.start",
            request_id=request_id,
            method=request.method,
            path=request.url.path,
        )

        response = await call_next(request)
        duration_ms = round((time.perf_counter() - start) * 1000, 2)

        _log.info(
            "request.end",
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            duration_ms=duration_ms,
        )
        return response
```

- [ ] **Step 4: テスト実行 → PASS確認**

```bash
uv run pytest tests/test_middleware_logging.py -v
```

期待出力: 1 passed.

- [ ] **Step 5: コミット**

```bash
git add backend/app/middleware/logging.py backend/tests/test_middleware_logging.py
git commit -m "feat(backend): add structured request/response logging middleware"
```

---

### Task 11: Backend ドメイン例外と Global Exception Handler

**Files:**

- Create: `backend/app/exceptions/__init__.py`
- Create: `backend/app/exceptions/domain.py`
- Create: `backend/app/exceptions/handlers.py`
- Create: `backend/tests/test_exception_handlers.py`

- [ ] **Step 1: `__init__.py` を作成**

```python
# backend/app/exceptions/__init__.py
```

- [ ] **Step 2: 失敗するテストを書く**

```python
# backend/tests/test_exception_handlers.py
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.exceptions.domain import GroupNotFound, RateLimitExceeded
from app.exceptions.handlers import register_exception_handlers


def _build_app() -> FastAPI:
    app = FastAPI()
    register_exception_handlers(app)

    @app.get("/notfound")
    def _nf():
        raise GroupNotFound("group abc not found")

    @app.get("/rate")
    def _rate():
        raise RateLimitExceeded("too many requests")

    @app.get("/boom")
    def _boom():
        raise RuntimeError("unexpected")

    return app


def test_group_not_found_returns_404_problem_details():
    res = TestClient(_build_app(), raise_server_exceptions=False).get("/notfound")
    assert res.status_code == 404
    body = res.json()
    assert body["type"].endswith("/group-not-found")
    assert body["title"] == "Group Not Found"
    assert body["status"] == 404
    assert body["detail"] == "group abc not found"


def test_rate_limit_returns_429():
    res = TestClient(_build_app(), raise_server_exceptions=False).get("/rate")
    assert res.status_code == 429


def test_unexpected_error_returns_500():
    res = TestClient(_build_app(), raise_server_exceptions=False).get("/boom")
    assert res.status_code == 500
    body = res.json()
    assert body["status"] == 500
    assert body["title"] == "Internal Server Error"
```

- [ ] **Step 3: テスト実行 → 失敗を確認**

```bash
uv run pytest tests/test_exception_handlers.py -v
```

期待出力: FAIL `ModuleNotFoundError`

- [ ] **Step 4: ドメイン例外を実装**

```python
# backend/app/exceptions/domain.py
class SplaiError(Exception):
    status_code: int = 500
    type_slug: str = "internal-error"
    title: str = "Internal Server Error"


class GroupNotFound(SplaiError):
    status_code = 404
    type_slug = "group-not-found"
    title = "Group Not Found"


class MemberMismatch(SplaiError):
    status_code = 401
    type_slug = "member-mismatch"
    title = "Member Mismatch"


class RateLimitExceeded(SplaiError):
    status_code = 429
    type_slug = "rate-limit-exceeded"
    title = "Rate Limit Exceeded"


class OCRFailed(SplaiError):
    status_code = 502
    type_slug = "ocr-failed"
    title = "OCR Failed"


class AIProviderError(SplaiError):
    status_code = 502
    type_slug = "ai-provider-error"
    title = "AI Provider Error"
```

- [ ] **Step 5: ハンドラを実装**

```python
# backend/app/exceptions/handlers.py
import structlog
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from .domain import SplaiError


_log = structlog.get_logger("exceptions")
PROBLEM_BASE = "https://splai.app/problems"


def _problem(status: int, type_slug: str, title: str, detail: str, instance: str | None) -> dict:
    return {
        "type": f"{PROBLEM_BASE}/{type_slug}",
        "title": title,
        "status": status,
        "detail": detail,
        "instance": instance,
    }


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(SplaiError)
    async def handle_splai_error(request: Request, exc: SplaiError) -> JSONResponse:
        request_id = getattr(request.state, "request_id", None)
        _log.warning(
            "domain_error",
            request_id=request_id,
            error_type=exc.type_slug,
            detail=str(exc),
            path=request.url.path,
        )
        return JSONResponse(
            status_code=exc.status_code,
            content=_problem(exc.status_code, exc.type_slug, exc.title, str(exc), str(request.url)),
            media_type="application/problem+json",
        )

    @app.exception_handler(Exception)
    async def handle_unexpected(request: Request, exc: Exception) -> JSONResponse:
        request_id = getattr(request.state, "request_id", None)
        _log.exception(
            "unexpected_error",
            request_id=request_id,
            path=request.url.path,
        )
        return JSONResponse(
            status_code=500,
            content=_problem(500, "internal-error", "Internal Server Error", "An unexpected error occurred.", str(request.url)),
            media_type="application/problem+json",
        )
```

- [ ] **Step 6: テスト実行 → PASS確認**

```bash
uv run pytest tests/test_exception_handlers.py -v
```

期待出力: 3 passed.

- [ ] **Step 7: コミット**

```bash
git add backend/app/exceptions/ backend/tests/test_exception_handlers.py
git commit -m "feat(backend): add domain exceptions and RFC 7807 problem details handler"
```

---

### Task 12: Backend FastAPI app 統合と /health エンドポイント

**Files:**

- Create: `backend/app/schemas/__init__.py`
- Create: `backend/app/schemas/base.py`
- Create: `backend/tests/test_schemas_base.py`
- Create: `backend/app/routers/__init__.py`
- Create: `backend/app/routers/health.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/test_health.py`

- [ ] **Step 1: `schemas/__init__.py` を作成**

```python
# backend/app/schemas/__init__.py
```

- [ ] **Step 2: `CamelModel` 基底クラスの失敗するテストを書く(規約 §8.4)**

```python
# backend/tests/test_schemas_base.py
from app.schemas.base import CamelModel


class _Sample(CamelModel):
    user_id: str
    event_date: str | None = None


def test_serializes_to_camel_case():
    obj = _Sample(user_id="abc", event_date="2026-05-24")
    dumped = obj.model_dump(by_alias=True)
    assert dumped == {"userId": "abc", "eventDate": "2026-05-24"}


def test_parses_camel_case_input():
    obj = _Sample.model_validate({"userId": "abc", "eventDate": "2026-05-24"})
    assert obj.user_id == "abc"
    assert obj.event_date == "2026-05-24"


def test_parses_snake_case_input_for_backward_compat():
    obj = _Sample.model_validate({"user_id": "abc"})
    assert obj.user_id == "abc"
```

- [ ] **Step 3: テスト実行 → 失敗を確認**

```bash
cd backend
uv run pytest tests/test_schemas_base.py -v
```

期待出力: FAIL `ModuleNotFoundError: No module named 'app.schemas.base'`

- [ ] **Step 4: `app/schemas/base.py` を実装**

```python
# backend/app/schemas/base.py
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    """全 Request / Response スキーマの基底クラス。

    Backend 内部は snake_case のまま、JSON ワイヤフォーマットは camelCase に
    変換する(規約 §8.4)。`populate_by_name=True` により snake / camel どちらの
    入力もパース可能とし、後方互換を保つ。

    使用例:
        class GroupResponse(CamelModel):
            id: UUID
            event_date: date | None
            # → JSON: {"id": "...", "eventDate": "..."}
    """
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )
```

- [ ] **Step 5: テスト実行 → PASS確認**

```bash
uv run pytest tests/test_schemas_base.py -v
```

期待出力: 3 passed.

- [ ] **Step 6: `routers/__init__.py` を作成**

```python
# backend/app/routers/__init__.py
```

- [ ] **Step 7: 失敗するテストを書く**

```python
# backend/tests/test_health.py
from fastapi.testclient import TestClient
from app.main import app


def test_health_returns_ok():
    client = TestClient(app)
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_health_includes_request_id_header():
    client = TestClient(app)
    res = client.get("/health")
    assert "X-Request-Id" in res.headers
```

- [ ] **Step 8: テスト実行 → 失敗を確認**

```bash
uv run pytest tests/test_health.py -v
```

期待出力: FAIL(`/health` 未実装)

- [ ] **Step 9: `routers/health.py` を実装**

```python
# backend/app/routers/health.py
from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
```

- [ ] **Step 10: `app/main.py` を統合バージョンに置き換え**

```python
# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.exceptions.handlers import register_exception_handlers
from app.logging_config import configure_logging
from app.middleware.logging import LoggingMiddleware
from app.middleware.request_id import RequestIdMiddleware
from app.routers import health


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings.log_level)

    app = FastAPI(title="SPLAI Backend", version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-Id"],
    )
    app.add_middleware(LoggingMiddleware)
    app.add_middleware(RequestIdMiddleware)

    register_exception_handlers(app)

    app.include_router(health.router)

    return app


app = create_app()
```

> **メモ**: CORS_ORIGINS は `Settings` クラス経由で読む(`os.getenv` 直書きを避ける、規約 §5.6)。カンマ区切り文字列を split する際は空要素や前後空白を除去するのが堅牢。

- [ ] **Step 11: `tests/conftest.py` を更新(DATABASE_URL を test 用にデフォルト設定)**

```python
# backend/tests/conftest.py
import os

# pytest の collection 中に test_health.py 等が `from app.main import app` を実行する。
# その時点で `app = create_app()` → `Settings()` 評価が走るため、fixture が呼ばれる
# 前に DATABASE_URL を os.environ に入れておく必要がある。conftest.py の top-level
# は collection の最初に評価されるので、ここに書けば全ての test 収集前に有効になる。
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")

import pytest  # noqa: E402  ← 上記 setdefault を先に走らせるため意図的に下に置く


@pytest.fixture(autouse=True)
def _isolate_env(monkeypatch):
    """Each test gets a clean env, with test-friendly defaults."""
    for key in [
        "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY",
        "IBM_CA_API_KEY", "IBM_CA_BASE_URL", "GCP_VISION_CREDENTIALS_JSON",
        "SENTRY_DSN", "ENV", "LOG_LEVEL", "CORS_ORIGINS",
    ]:
        monkeypatch.delenv(key, raising=False)
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")
```

- [ ] **Step 12: テスト実行 → PASS確認**

```bash
uv run pytest tests/test_health.py -v
```

期待出力: 2 passed.

- [ ] **Step 13: 全テスト実行**

```bash
uv run pytest -v
```

期待出力: 全テストPASS。

- [ ] **Step 14: コミット**

```bash
git add backend/
git commit -m "feat(backend): add CamelModel base, integrate middlewares and /health endpoint"
```

---

### Task 13: Supabase プロジェクト作成と DB 接続

**Files:**

- Create: `backend/app/db/__init__.py`
- Create: `backend/app/db/base.py`
- Create: `backend/app/db/session.py`
- Create: `infra/README.md`

> **手動作業含む**: Supabase ダッシュボードでプロジェクトを作成。

- [ ] **Step 1: Supabase プロジェクトを作成(手動)**

1. https://supabase.com/dashboard で新規プロジェクト「splai」作成
2. Region: Tokyo(`ap-northeast-1`)
3. Database password を生成し記録
4. プロジェクト作成後、Settings → Database → Connection string → URI を取得
   - 例: `postgresql://postgres.<ref>:<pwd>@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres`
5. Settings → API → `service_role` key を取得(後の Storage 連携で使用)

- [ ] **Step 2: `infra/README.md` を作成して手順を記録**

```markdown
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
```

- [ ] **Step 3: `app/db/__init__.py` を作成**

```python
# backend/app/db/__init__.py
```

- [ ] **Step 4: `app/db/base.py` を作成**

```python
# backend/app/db/base.py
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """SQLAlchemy 2.x Declarative Base for all ORM models."""
    pass
```

- [ ] **Step 5: `app/db/session.py` を作成**

```python
# backend/app/db/session.py
from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings


_settings = get_settings()
engine = create_async_engine(_settings.database_url, echo=False, future=True)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_session() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session
```

- [ ] **Step 6: ローカル `.env` を作成し DATABASE_URL を設定**

```bash
cp backend/.env.example backend/.env.local
# .env を編集して、Step 1 で取得した接続文字列を asyncpg 形式で設定
```

- [ ] **Step 7: 接続スモークテスト**

```bash
cd backend
uv run python -c "
import asyncio
from app.db.session import engine
from sqlalchemy import text

async def main():
    async with engine.connect() as conn:
        r = await conn.execute(text('SELECT 1'))
        print('DB OK:', r.scalar())

asyncio.run(main())
"
```

期待出力: `DB OK: 1`

- [ ] **Step 8: コミット**

```bash
git add backend/app/db/ infra/
git commit -m "feat(backend): set up SQLAlchemy async engine and session for Supabase"
```

---

### Task 14: Alembic セットアップ(空マイグレーション)

**Files:**

- Create: `backend/alembic.ini`
- Create: `backend/alembic/env.py`(自動生成後カスタマイズ)
- Create: `backend/alembic/script.py.mako`(自動生成)

- [ ] **Step 1: Alembic 初期化**

```bash
cd backend
uv run alembic init -t async alembic
```

- [ ] **Step 2: `alembic.ini` の `sqlalchemy.url` をコメントアウト**

```ini
# sqlalchemy.url = driver://user:pass@localhost/dbname  # ← コメントアウト
```

- [ ] **Step 3: `alembic/env.py` を更新して環境変数から URL を読む**

```python
# alembic/env.py の上部に追加 / 既存を置き換え
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from app.config import get_settings
from app.db.base import Base

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

settings = get_settings()
config.set_main_option("sqlalchemy.url", settings.database_url)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    import asyncio
    asyncio.run(run_migrations_online())
```

- [ ] **Step 4: 初回(空)マイグレーション作成**

```bash
uv run alembic revision -m "initial empty migration"
```

期待出力: `alembic/versions/<rev>_initial_empty_migration.py` が生成される。

- [ ] **Step 5: マイグレーション実行**

```bash
uv run alembic upgrade head
```

期待出力: Supabase 上で `alembic_version` テーブルが作成される。

- [ ] **Step 6: ダッシュボードで確認**

Supabase Dashboard → Table Editor で `alembic_version` テーブルが存在することを確認。

- [ ] **Step 7: コミット**

```bash
git add backend/alembic.ini backend/alembic/
git commit -m "feat(backend): set up Alembic with async config and initial empty migration"
```

---

### Task 15: Backend Sentry 統合

**Files:**

- Modify: `backend/app/main.py`

- [ ] **Step 1: Sentry プロジェクト作成(手動)**

1. https://sentry.io で新規プロジェクト「splai-backend」(Platform: FastAPI)
2. DSN を取得し、`backend/.env.local` の `SENTRY_DSN` に設定

- [ ] **Step 2: `app/main.py` の `create_app` 内に Sentry 初期化を追加**

```python
# backend/app/main.py の create_app 関数の先頭付近に追加
import sentry_sdk

def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings.log_level)

    if settings.sentry_dsn and settings.env != "test":
        sentry_sdk.init(
            dsn=settings.sentry_dsn,
            environment=settings.env,
            traces_sample_rate=0.1,
            send_default_pii=False,
        )

    # ... 残りは既存通り
```

- [ ] **Step 3: 動作確認 — テスト用エラーエンドポイント(後で削除)を追加**

```python
# backend/app/routers/health.py の末尾に一時追加
@router.get("/__sentry-test__")
def sentry_test():
    raise RuntimeError("Sentry smoke test")
```

- [ ] **Step 4: ローカル起動 → エラーを発火 → Sentry に届くことを確認**

```bash
uv run uvicorn app.main:app
# 別ターミナル
curl http://localhost:8000/__sentry-test__
```

Sentry ダッシュボードに `RuntimeError: Sentry smoke test` が表示されることを確認。

- [ ] **Step 5: テスト用エンドポイントを削除**

```python
# backend/app/routers/health.py から __sentry-test__ ハンドラを削除
```

- [ ] **Step 6: コミット**

```bash
git add backend/app/main.py backend/app/routers/health.py
git commit -m "feat(backend): integrate Sentry SDK for error tracking"
```

---

### Task 16: Frontend Sentry 統合

**Files:**

- Create: `frontend/sentry.client.config.ts`
- Create: `frontend/sentry.server.config.ts`
- Create: `frontend/sentry.edge.config.ts`
- Create: `frontend/instrumentation.ts`
- Modify: `frontend/next.config.ts`

- [ ] **Step 1: Sentry プロジェクト作成(手動)**

1. https://sentry.io で新規プロジェクト「splai-frontend」(Platform: Next.js)
2. DSN を取得し、`frontend/.env.local` の `NEXT_PUBLIC_SENTRY_DSN` に設定

- [ ] **Step 2: Sentry ウィザードを使わず、手動で最小設定**

```ts
// frontend/sentry.client.config.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
});
```

```ts
// frontend/sentry.server.config.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
});
```

```ts
// frontend/sentry.edge.config.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
});
```

```ts
// frontend/instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}
```

- [ ] **Step 3: `next.config.ts` で Sentry プラグインを wrap**

```ts
// frontend/next.config.ts
import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {};

export default withSentryConfig(nextConfig, {
  silent: true,
});
```

- [ ] **Step 4: 確認用エラーボタンを `app/page.tsx` に一時追加**

```tsx
'use client';
// app/page.tsx
export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 gap-4">
      <h1 className="font-display text-8xl tracking-tighter">
        SPL<span className="text-red">AI</span>.
      </h1>
      <p className="font-mono text-sm tracking-widest">/splaɪ/ — phase 0 hello</p>
      <button
        className="font-mono text-xs px-3 py-1 border-2 border-ink"
        onClick={() => {
          throw new Error('Sentry frontend smoke test');
        }}
      >
        ▶ Sentry test
      </button>
    </main>
  );
}
```

- [ ] **Step 5: 動作確認**

```bash
cd frontend
npm run dev
# ブラウザで http://localhost:3000 を開き、ボタンをクリック
# Sentry frontend ダッシュボードにエラーが届くことを確認
```

- [ ] **Step 6: テスト用ボタンを削除して `'use client'` も外す**

```tsx
// app/page.tsx を Task 3 の状態に戻す
```

- [ ] **Step 7: コミット**

```bash
git add frontend/
git commit -m "feat(frontend): integrate Sentry for error tracking"
```

---

### Task 17: Vercel デプロイ

**Files:**

- Modify: `frontend/.env.local.example`(本番用環境変数のリスト追加)

- [ ] **Step 1: Vercel にログインしてプロジェクト作成(手動)**

```bash
cd frontend
npx vercel login
npx vercel link
# プロジェクト名: splai-frontend
# Root Directory: ./
```

- [ ] **Step 2: Vercel プロジェクトの環境変数を設定(ダッシュボード)**

Production / Preview / Development の各環境に:

- `NEXT_PUBLIC_API_BASE_URL` = (Fly.io の URL は Task 18 で取得後)
- `NEXT_PUBLIC_APP_URL` = `https://<vercel-domain>`
- `NEXT_PUBLIC_SENTRY_DSN` = Sentry frontend DSN

- [ ] **Step 3: 初回デプロイ**

```bash
npx vercel --prod
```

期待出力: 本番URLが発行され、ブラウザで開くと SPLAI ロゴ画面が表示される。

- [ ] **Step 4: GitHub 連携設定(自動デプロイ + ブランチ運用、規約 §1.1)**

Vercel Dashboard → Settings → Git → Connect GitHub → splai-app リポジトリを連携。

さらに **Settings → Git → Production Branch** を `main` のまま維持し、`develop` を Preview Branch として明示する:

- `main` への push → **Production** デプロイ(本番ドメイン)
- `develop` への push → **Preview** デプロイ(専用 Preview ドメインが発行される)
- feature/\* ブランチの PR → 個別 **Preview** デプロイ

これで規約のブランチ戦略(main = 本番、develop = 統合テスト)が Vercel 側でそのまま実現される。

- [ ] **Step 5: `infra/README.md` に Vercel 手順を追記**

```markdown
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
```

- [ ] **Step 6: コミット**

```bash
git add infra/README.md frontend/
git commit -m "chore(infra): connect Vercel deployment"
```

---

### Task 18: Fly.io デプロイ

**Files:**

- Create: `backend/Dockerfile`
- Create: `backend/fly.toml`
- Create: `backend/.dockerignore`

- [ ] **Step 1: `Dockerfile` を作成**

```dockerfile
# backend/Dockerfile
FROM python:3.12-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_LINK_MODE=copy

RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Install dependencies (use lockfile for reproducibility)
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

# Copy app source
COPY app/ ./app/
COPY alembic/ ./alembic/
COPY alembic.ini ./

# Re-sync to install the project itself
RUN uv sync --frozen --no-dev

ENV PORT=8080
EXPOSE 8080

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
```

- [ ] **Step 2: `.dockerignore` を作成**

```
__pycache__
.venv
.pytest_cache
.ruff_cache
tests
.env
*.md
```

- [ ] **Step 3: Fly.io にログインしてアプリ作成(手動)**

```bash
cd backend
flyctl auth login
flyctl apps create splai-backend
# `flyctl apps create` は --region フラグを受け付けない(廃止された)。
# region は次の Step で作る fly.toml の primary_region = "nrt" で指定する。
```

- [ ] **Step 4: `fly.toml` を作成**

```toml
app = "splai-backend"
primary_region = "nrt"

[build]

[env]
  PORT = "8080"
  ENV = "production"
  LOG_LEVEL = "INFO"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = "stop"
  auto_start_machines = true
  min_machines_running = 0

  [[http_service.checks]]
    interval = "30s"
    method = "GET"
    path = "/health"
    timeout = "5s"

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 256
```

- [ ] **Step 5: シークレット(本番用環境変数)を設定**

```bash
flyctl secrets set DATABASE_URL="postgresql+asyncpg://postgres.<ref>:<pwd>@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres"
flyctl secrets set SUPABASE_URL="https://<ref>.supabase.co"
flyctl secrets set SUPABASE_SERVICE_ROLE_KEY="<service_role_key>"
flyctl secrets set SENTRY_DSN="<sentry-backend-dsn>"
flyctl secrets set CORS_ORIGINS="https://<vercel-prod-domain>,https://<vercel-preview-domain-pattern>"
```

- [ ] **Step 6: 初回デプロイ**

```bash
flyctl deploy
```

期待出力: ビルド成功、`https://splai-backend.fly.dev` が発行される。

- [ ] **Step 7: 動作確認**

```bash
curl https://splai-backend.fly.dev/health
```

期待出力: `{"status":"ok"}`

- [ ] **Step 8: Vercel 側の環境変数 `NEXT_PUBLIC_API_BASE_URL` を `https://splai-backend.fly.dev` に更新し再デプロイ**

```bash
cd ../frontend
npx vercel --prod
```

- [ ] **Step 9: `infra/README.md` に Fly.io 手順追記**

```markdown
## Fly.io

1. `flyctl auth login` & `flyctl apps create splai-backend --region nrt`
2. `flyctl secrets set ...` で環境変数を設定
3. `flyctl deploy` でデプロイ
4. `https://splai-backend.fly.dev/health` で疎通確認
```

- [ ] **Step 10: コミット**

```bash
cd ..
git add backend/Dockerfile backend/.dockerignore backend/fly.toml infra/README.md
git commit -m "chore(infra): add Dockerfile and fly.toml for Fly.io deployment"
```

---

### Task 19: Frontend → Backend エンドツーエンド疎通確認

> **アーキテクチャ注記**: SPLAI の設計(設計書 §3)では **ブラウザが FastAPI を直接呼ぶ**(Next.js サーバを経由しない)。`/api/health/route.ts`(Next.js Route Handler)は **Phase 0 のみの一時的な疎通確認ツール**で、Vercel → Fly.io の server-to-server 経路を確認するためのもの。本来の CORS 検証は **ブラウザ → FastAPI 直接**で行う必要がある(Step 3-4 で実施)。Phase 1 着手時に削除する。

**Files:**

- Create: `frontend/app/api/health/route.ts`(Phase 0 限定、Phase 1 で削除)
- Modify: `frontend/app/page.tsx`(本番疎通確認用に一時拡張)

- [ ] **Step 1: Frontend に health proxy ルートを作成(Phase 0 限定)**

```ts
// frontend/app/api/health/route.ts
// ⚠️ Phase 0 限定: Vercel → Fly.io の server-to-server 接続を確認するための proxy。
// SPLAI の本番設計ではブラウザが FastAPI を直接叩く(設計書 §3)ため、
// Phase 1 着手時にこのファイルは削除する。
import { NextResponse } from 'next/server';
import { apiClient } from '@/lib/api-client';

export async function GET() {
  try {
    const res = await apiClient.get('/health');
    return NextResponse.json({ frontend: 'ok', backend: res.data });
  } catch (e) {
    return NextResponse.json(
      { frontend: 'ok', backend: 'unreachable', error: String(e) },
      { status: 502 },
    );
  }
}
```

- [ ] **Step 2: ローカル疎通確認**

```bash
# ターミナル1
cd backend && uv run uvicorn app.main:app --port 8000

# ターミナル2
cd frontend && npm run dev

# ターミナル3
curl http://localhost:3000/api/health
```

期待出力: `{"frontend":"ok","backend":{"status":"ok"}}`

- [ ] **Step 3: 本番疎通確認(Server-to-Server)**

Vercel + Fly.io をデプロイ済の状態で、**Vercel → Fly.io** の経路を確認:

```bash
curl https://<vercel-prod-domain>/api/health
```

期待出力: `{"frontend":"ok","backend":{"status":"ok"}}`

> これは Vercel 側 Node.js から Fly.io への接続。CORS は介在しない(同一サーバ間通信)。

- [ ] **Step 4: ブラウザ起点の疎通確認(Browser → Backend、CORS 検証)** ⭐

設計書 §3 通り、**ブラウザから FastAPI に直接接続できるか**を確認する。これが SPLAI の本来の通信経路。

ブラウザの DevTools コンソールで以下を実行:

```js
// https://<vercel-prod-domain> を開いて DevTools コンソールへ
fetch('https://splai-backend.fly.dev/health').then(r => r.json()).then(console.log)
```

期待出力: `{status: "ok"}`

確認ポイント:
- ✅ レスポンスが返る → CORS が正しく設定されている(Fly.io 側 `CORS_ORIGINS` に Vercel ドメインが含まれている)
- ❌ `CORS error: ...` が出る → Fly.io secrets の `CORS_ORIGINS` を確認、Vercel の本番ドメインを含めて再 deploy
- DevTools の Network タブで **Response Headers に `X-Request-Id`** が含まれていることも確認(規約 §8.5、`expose_headers` の動作確認)

- [ ] **Step 5: Backend のログを Fly.io で確認**

```bash
flyctl logs -a splai-backend
```

期待出力: 構造化JSONログ(`request.start`, `request.end`)が `X-Request-Id` 付きで出力される。

- [ ] **Step 6: コミット**

```bash
git add frontend/app/api/health/
git commit -m "feat(frontend): add /api/health proxy for backend connectivity check"
```

---

### Task 20: GitHub Actions CI と PR テンプレート

**Files:**

- Create: `.github/pull_request_template.md`
- Create: `.github/workflows/frontend-ci.yml`
- Create: `.github/workflows/backend-ci.yml`

- [ ] **Step 1: PR テンプレートを作成(規約 §3.2)**

```markdown
<!-- .github/pull_request_template.md -->

## Summary

<!-- 何を・なぜ。1〜3行で -->

## Changes

<!-- 主要な変更点を箇条書き -->

-

## Test plan

<!-- 検証方法のチェックリスト -->

- [ ] `npm test` / `uv run pytest` 全通過
- [ ] ローカルで動作確認:
- [ ] (該当時)Vercel Preview で目視確認

## Related

<!-- 関連 PR / Issue / 設計書セクション -->

- design.md §

## Checklist

- [ ] 自分でセルフレビュー済
- [ ] テスト追加 or テスト不要の理由を本文に明記
- [ ] 環境変数追加時は `.env.example` も更新
- [ ] ドキュメントの追従が必要なら更新済
```

- [ ] **Step 2: Frontend CI を作成(規約 §11.4)**

```yaml
# .github/workflows/frontend-ci.yml
name: Frontend CI

on:
  # PR では paths フィルタを使わず常に走らせる(Branch Protection の必須チェックが
  # 起動しない問題を防ぐ)
  pull_request:
  push:
    branches: [main, develop]
    paths: ['frontend/**', '.github/workflows/frontend-ci.yml']

jobs:
  frontend: # ← Branch Protection で要求する check 名
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: frontend/package-lock.json
      - run: npm ci
      - name: Lint
        run: npm run lint
      - name: Format check
        run: npm run format:check
      - name: Type check
        run: npm run typecheck
      - name: Test
        run: npm test
      - name: Build
        run: npm run build
        env:
          NEXT_PUBLIC_API_BASE_URL: http://localhost:8000
          NEXT_PUBLIC_APP_URL: http://localhost:3000
```

- [ ] **Step 3: Backend CI を作成(規約 §11.4)**

```yaml
# .github/workflows/backend-ci.yml
name: Backend CI

on:
  pull_request:
  push:
    branches: [main, develop]
    paths: ['backend/**', '.github/workflows/backend-ci.yml']

jobs:
  backend: # ← Branch Protection で要求する check 名
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.12' }
      - name: Install uv
        run: curl -LsSf https://astral.sh/uv/install.sh | sh
      - name: Install dependencies
        run: uv sync --frozen
      - name: Lint
        run: uv run ruff check .
      - name: Format check
        run: uv run ruff format --check .
      - name: Test
        run: uv run pytest -v
        env:
          DATABASE_URL: postgresql+asyncpg://test:test@localhost/test
          ENV: test
```

- [ ] **Step 4: 確認のため空PRを作成**

```bash
git checkout -b ci-test
echo "" >> README.md
git add README.md
git commit -m "test: trigger CI"
git push origin ci-test
gh pr create --title "Test CI" --body "Phase 0 CI smoke test" --base develop
```

> base ブランチは `develop`(規約 §1.3:feature → develop が基本フロー)。

- [ ] **Step 5: GitHub 上で両 workflow が PASS することを確認**

期待出力: `Frontend CI` `Backend CI` 両方が緑チェック。

- [ ] **Step 6: PR をクローズ(マージしない)、ブランチ削除**

```bash
gh pr close <pr-number> --delete-branch
```

- [ ] **Step 7: コミット(main ブランチ)**

```bash
git checkout main
git add .github/
git commit -m "ci(infra): add CI workflows and PR template"
git push origin main
# develop にも追従
git checkout develop
git merge main --ff-only
git push origin develop
```

---

### Task 21: ローカル開発手順を README に追記

**Files:**

- Modify: `splai-app/README.md`

- [ ] **Step 1: README を完全版に更新**

````markdown
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

- [ ] **Step 2: コミット**

```bash
git add README.md
git commit -m "docs: complete README with local development and deployment guide"
git push origin main
````

---

### Task 22: Phase 0 完了確認(Definition of Done チェック)

このタスクには新規ファイルなし。Phase 0 の完了基準を全て満たしているかチェック。

- [ ] **Step 1: 全 DoD 項目を確認**

計画書 `docs/superpowers/plans/README.md` の Phase 0 DoD と照合:

- [ ] 別リポジトリ `splai-app` が作成され、初期コミット完了 — Task 1
- [ ] `develop` ブランチが作成され、main / develop 両方が remote に存在 — Task 1
- [ ] `.github/pull_request_template.md` が配置されている — Task 20
- [ ] Frontend(Next.js) が Vercel にデプロイされ、ブランドカラー/フォントが適用された Hello画面 が表示される — Task 17
- [ ] Vercel が main → Production / develop → Preview を自動運用している — Task 17
- [ ] Backend(FastAPI) が Fly.io にデプロイされ、`/health` エンドポイントが応答する — Task 18
- [ ] Frontend から Backend に CORS 越しでリクエストが通る — Task 19
- [ ] Supabase プロジェクトが作成され、Backend から PostgreSQL に接続できる — Task 13
- [ ] Alembic で初期マイグレーション(空)が実行できる — Task 14
- [ ] Sentry が Frontend / Backend 両方に組み込まれ、エラーが Sentry に届く — Task 15-16
- [ ] GitHub Actions で PR 時に lint / format / typecheck / test が走る — Task 20
- [ ] structlog による JSON ログが Backend で出力される — Task 8, 10
- [ ] X-Request-Id ミドルウェアが動作している — Task 9
- [ ] Global Exception Handler が RFC 7807 形式でエラーを返す — Task 11
- [ ] `CamelModel` 基底クラスが実装され、camelCase ⇄ snake_case の変換テストが通る — Task 12
- [ ] TypeScript の strict 設定(`noUncheckedIndexedAccess` 等)が tsconfig に反映 — Task 2
- [ ] Frontend の lint / format:check / typecheck / test が CI で実行されている — Task 5, 20

- [ ] **Step 2: ブランチ保護を本格運用モードに切り替え(規約 §1.1)**

#### Required Status Checks(両ブランチ共通)

CI workflow の job 名と完全一致させる必要がある。Task 20 のリネーム結果に従う:

| Status check 名 | 由来 workflow                                          |
| --------------- | ------------------------------------------------------ |
| `frontend`      | `.github/workflows/frontend-ci.yml` の `jobs.frontend` |
| `backend`       | `.github/workflows/backend-ci.yml` の `jobs.backend`   |

> Vercel が PR ごとに `Vercel – splai-frontend` という deployment status check を自動投稿する。これは**必須化しない**(Vercel 側の障害で PR がブロックされるのを避ける)。手動で目視確認する運用にする。

#### `main` ブランチ保護ルール

| 設定                                                               | 値                                 |
| ------------------------------------------------------------------ | ---------------------------------- |
| Require a pull request before merging                              | ✅                                 |
| └ Require approvals                                                | `0`(個人開発のため、self-merge 可) |
| └ Dismiss stale pull request approvals when new commits are pushed | ✅                                 |
| └ Require review from Code Owners                                  | ❌(CODEOWNERS 未導入)              |
| Require status checks to pass before merging                       | ✅                                 |
| └ Require branches to be up to date before merging                 | ✅                                 |
| └ Required status checks                                           | `frontend`, `backend`              |
| Require conversation resolution before merging                     | ✅                                 |
| Require linear history                                             | ✅(squash merge を強制)            |
| Require deployments to succeed before merging                      | ❌                                 |
| Lock branch                                                        | ❌                                 |
| Do not allow bypassing the above settings                          | ✅(管理者にも同等の制約)           |
| Allow force pushes                                                 | ❌                                 |
| Allow deletions                                                    | ❌                                 |

#### `develop` ブランチ保護ルール(main より緩め)

| 設定                                                               | 値                                                     |
| ------------------------------------------------------------------ | ------------------------------------------------------ |
| Require a pull request before merging                              | ✅                                                     |
| └ Require approvals                                                | `0`                                                    |
| └ Dismiss stale pull request approvals when new commits are pushed | ✅                                                     |
| Require status checks to pass before merging                       | ✅                                                     |
| └ Require branches to be up to date before merging                 | ❌(integration ブランチのため up-to-date 強制は緩める) |
| └ Required status checks                                           | `frontend`, `backend`                                  |
| Require conversation resolution before merging                     | ✅                                                     |
| Require linear history                                             | ❌(release PR は merge commit を許可するため)          |
| Allow force pushes                                                 | ❌                                                     |
| Allow deletions                                                    | ❌                                                     |

#### 設定方法 A: GitHub Web UI

`https://github.com/<owner>/splai-app/settings/branches` → "Add branch protection rule" → 上記表通りに設定。

#### 設定方法 B: `gh` CLI(推奨・冪等)

```bash
# main の保護ルール
gh api -X PUT "repos/{owner}/splai-app/branches/main/protection" \
  -F required_status_checks.strict=true \
  -F 'required_status_checks.contexts[]=frontend' \
  -F 'required_status_checks.contexts[]=backend' \
  -F enforce_admins=true \
  -F required_pull_request_reviews.required_approving_review_count=0 \
  -F required_pull_request_reviews.dismiss_stale_reviews=true \
  -F required_conversation_resolution=true \
  -F required_linear_history=true \
  -F allow_force_pushes=false \
  -F allow_deletions=false \
  -F restrictions=

# develop の保護ルール(strict / linear_history を緩めた)
gh api -X PUT "repos/{owner}/splai-app/branches/develop/protection" \
  -F required_status_checks.strict=false \
  -F 'required_status_checks.contexts[]=frontend' \
  -F 'required_status_checks.contexts[]=backend' \
  -F enforce_admins=true \
  -F required_pull_request_reviews.required_approving_review_count=0 \
  -F required_pull_request_reviews.dismiss_stale_reviews=true \
  -F required_conversation_resolution=true \
  -F required_linear_history=false \
  -F allow_force_pushes=false \
  -F allow_deletions=false \
  -F restrictions=
```

> `restrictions=` は空指定で「制限なし(全員 push 可、ただし PR 経由)」を意味する。
> `<owner>` を実際の GitHub Org/User 名に置き換えること。

#### 動作確認

- [ ] `git push origin main` を直接試みる → リモートが reject すれば成功(`protected branch hook declined`)
- [ ] CI が赤の状態で merge ボタンが押せないことを確認
- [ ] CI が緑かつセルフ approve で squash merge が押せることを確認

Phase 0 のブートストラップ特例はここで終了。Phase 1 以降の作業はすべて `feature/* → develop → main` の PR フローで進める。

- [ ] **Step 3: 計画リポの計画書を「Phase 0 完了」に更新**

`application-dev-plan/docs/superpowers/plans/README.md` の Phase 0 行の状態を 📝 計画作成中 → ✅ 完了 に変更。

```bash
cd ~/dev/git/application-dev-plan
# README.md を編集して Phase 0 を ✅ に
git add docs/superpowers/plans/README.md
git commit -m "docs: mark Phase 0 as complete"
```

- [ ] **Step 4: Phase 1 の詳細計画作成を開始**

Phase 0 が安定したら、計画リポで `superpowers:writing-plans` スキルを呼び出して Phase 1 の詳細計画を作成する。

---

## ローカル開発手順(参考)

Phase 0 完了後、開発者は以下の手順でローカル環境を立ち上げられる:

```bash
git clone git@github.com:<owner>/splai-app.git
cd splai-app

# Frontend
cd frontend
cp .env.local.example .env.local
# .env.local を編集
npm install
npm run dev          # → http://localhost:3000

# Backend
cd ../backend
cp .env.example .env
# .env を編集
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --port 8000
```

---

## このフェーズで作成する成果物まとめ

- ✅ 新規 GitHub リポジトリ `splai-app`(main + develop ブランチ、保護ルール設定済)
- ✅ `.github/pull_request_template.md`(規約準拠の PR テンプレ)
- ✅ Next.js 15 フロントエンド(ブランド適用済 Hello画面、TypeScript strict 強化)
- ✅ FastAPI バックエンド(`/health`、構造化ログ、リクエストID、グローバル例外ハンドラ、`CamelModel` 基底クラス)
- ✅ Supabase プロジェクトと接続済 SQLAlchemy エンジン
- ✅ Alembic マイグレーション基盤
- ✅ Vercel 本番デプロイ(main = Production / develop = Preview)
- ✅ Fly.io 本番デプロイ
- ✅ Sentry エラートラッキング(Frontend / Backend)
- ✅ GitHub Actions CI(lint + format + typecheck + test、main / develop 両対応)
- ✅ 開発者向け README とインフラ手順書(`docs/conventions.md` への参照含む)

これで Phase 1 以降の機能開発に集中できる土台が完成する。
