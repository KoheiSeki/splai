# SPLAI 開発規約

> プロジェクト共通の命名規則・ブランチ運用・コーディング規約。
> **守れない規約は規約ではない**ので、ツールで自動化できるものは自動化、できないものだけ目視レビューの観点に。

最終更新: 2026-05-24

---

## 目次

- [1. ブランチ運用](#1-ブランチ運用)
- [2. コミットメッセージ](#2-コミットメッセージ)
- [3. プルリクエスト](#3-プルリクエスト)
- [4. ファイル/ディレクトリ命名](#4-ファイルディレクトリ命名)
- [5. コーディング規約 — Python (Backend)](#5-コーディング規約--python-backend)
- [6. コーディング規約 — TypeScript (Frontend)](#6-コーディング規約--typescript-frontend)
- [7. データベース・SQL](#7-データベースsql)
- [8. API 規約](#8-api-規約)
- [9. テスト規約](#9-テスト規約)
- [10. 環境変数・シークレット](#10-環境変数シークレット)
- [11. 自動化(linter / formatter / CI)](#11-自動化linter--formatter--ci)
- [12. ログ・エラーメッセージ規約](#12-ログエラーメッセージ規約)

---

## 1. ブランチ運用

### 1.1 ブランチ構成(Git Flow Lite)

```
main          ─●────●──────●───────●────  ← 本番(Vercel/Fly.io 自動デプロイ)
                ↑    ↑      ↑       ↑
                ├ release PR(develop → main)
develop  ────●──┴────┴──────┴───────┘     ← 開発統合(Vercel Preview)
              ↑       ↑       ↑
              ├ feature/xxx
              ├ fix/xxx
              └ chore/xxx
```

| ブランチ | 用途 | 直接 push | デプロイ先 |
|---|---|---|---|
| `main` | 本番。常にデプロイ可能な状態 | ❌(release PR のみ) | Vercel Production / Fly.io |
| `develop` | 開発統合。Phase 内で feature を集約 | ❌(feature PR のみ) | Vercel Preview |
| `feature/<slug>` | 機能追加 | ✅ | — |
| `fix/<slug>` | バグ修正 | ✅ | — |
| `chore/<slug>` | 雑務(設定、依存更新、リファクタ) | ✅ | — |
| `docs/<slug>` | ドキュメントのみ | ✅ | — |

### 1.2 ブランチ命名

```
<type>/<short-kebab-case-summary>

例:
  feature/group-create
  feature/payment-ocr-upload
  fix/cors-preflight
  chore/upgrade-fastapi
  docs/conventions
```

- `<type>`: `feature` / `fix` / `chore` / `docs` / `test` / `refactor`
- `<short-summary>`: 英語、kebab-case、3〜5語以内
- 日本語は使わない(GitHub UI で文字化けの恐れ)
- Phase の区切りは type には入れない(commit/PR の本文で十分)

### 1.3 マージフロー

```
feature/xxx ──(PR)──► develop ──(release PR)──► main
                          │
                          └→ Phase 完了時にまとめてリリース
```

- **feature → develop**: 機能単位の小さい PR(目安 1日〜数日で出せるサイズ)
- **develop → main**: Phase 完了 or 安定区切りで一括リリース PR
- マージ方式は **squash merge** に統一(履歴が直線になる)
  - 例外: develop → main の release PR は **merge commit**(個別の機能履歴を残したい場合)

### 1.4 リリース

- main へのマージ = 本番デプロイ
- タグは `v0.1.0` 等の semver で打つ(`gh release create` 推奨)
- リリースノートは PR 本文 + `gh release create --generate-notes` で自動生成可

---

## 2. コミットメッセージ

### 2.1 Conventional Commits 採用

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

- 1行目は **72 文字以内**、英語、現在形、ピリオドなし
- subject は **「何を変えたか」**(Why は body へ)

### 2.2 type 一覧

| type | 用途 |
|---|---|
| `feat` | 新機能 |
| `fix` | バグ修正 |
| `docs` | ドキュメントのみ |
| `style` | フォーマットのみ(機能影響なし) |
| `refactor` | 機能変更なしの内部リファクタ |
| `perf` | パフォーマンス改善 |
| `test` | テスト追加・修正 |
| `chore` | ビルド・ツール・依存関係 |
| `ci` | CI 設定 |

### 2.3 scope 一覧(SPLAI 用)

| scope | 範囲 |
|---|---|
| `frontend` | `frontend/` 全般 |
| `backend` | `backend/` 全般 |
| `infra` | `infra/`, `Dockerfile`, `fly.toml`, GitHub Actions |
| `db` | マイグレーション・スキーマ |
| `ai` | AI 関連(チャット入力、メッセージ生成、清算解説) |
| `auth` | 認可ミドルウェア、メンバー識別 |
| なし | リポジトリ横断(README、規約、ライセンス) |

### 2.4 例

```
feat(backend): add X-Request-Id middleware
fix(frontend): handle 401 response by re-prompting member selection
refactor(ai): extract IBM CA client into adapter module
test(backend): cover settlement greedy edge cases
chore(infra): bump uv to 0.5.0
docs: add coding conventions
```

### 2.5 やらないこと

- ❌ `WIP:` プレフィックス(必要なら Draft PR で表現)
- ❌ Co-authored 行を AI ツールで自動付与(本プロジェクトでは付けない)
- ❌ 巨大コミット(目安: 1コミット = 100行未満、超えるなら分割)

---

## 3. プルリクエスト

### 3.1 PR タイトル

ブランチ名と同じ規則:`<type>(<scope>): <subject>`

### 3.2 PR 本文テンプレート

`.github/pull_request_template.md` に配置(Phase 0 Task 21 と同時に作成):

```markdown
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

### 3.3 セルフレビュー観点(個人開発)

PR 作成 → **必ず一度ブラウザで Files Changed タブを通読**してから merge。

- [ ] デバッグ用の `console.log` / `print` / `dump` が残ってないか
- [ ] `// TODO` / `# TODO` を残すなら理由と issue 番号
- [ ] シークレットがコミットされてないか(キー、トークン、DSN)
- [ ] ファイルに無関係な diff が混入してないか(自動フォーマット由来の大量変更)
- [ ] エラーメッセージは規約(§12)準拠か

### 3.4 マージ条件

- [ ] CI 全通過(Frontend CI / Backend CI 両方)
- [ ] Conflict なし
- [ ] セルフレビュー済
- [ ] (該当時)Vercel Preview で確認済

---

## 4. ファイル/ディレクトリ命名

### 4.1 全体ルール

| 種類 | 規則 | 例 |
|---|---|---|
| ディレクトリ | kebab-case | `frontend/lib/api-client/` |
| ドキュメントファイル | kebab-case `.md` | `phase-0-learning-guide.md` |
| 環境変数ファイル | `.env`, `.env.local`, `.env.example` | — |
| 設定ファイル | ツール慣習に従う | `next.config.ts`, `pyproject.toml` |

### 4.2 Frontend (Next.js)

| 種類 | 規則 | 例 |
|---|---|---|
| ルートセグメント(`app/`) | kebab-case | `app/group-share/page.tsx` |
| 動的セグメント | `[param]` | `app/g/[uuid]/page.tsx` |
| 規約ファイル | Next.js 規約 | `page.tsx`, `layout.tsx`, `route.ts`, `loading.tsx`, `error.tsx` |
| コンポーネントファイル | kebab-case `.tsx` | `components/group-card.tsx` |
| エクスポート名 | PascalCase | `export function GroupCard()` |
| カスタムフック | `use-` prefix kebab + camel export | `lib/hooks/use-group.ts` → `useGroup` |
| ライブラリ | kebab-case | `lib/api-client.ts`, `lib/request-id.ts` |
| テスト | `*.test.ts(x)` | `tests/lib/env.test.ts` |
| Zod スキーマ | `*.schema.ts` | `lib/schemas/group.schema.ts` |

### 4.3 Backend (Python)

| 種類 | 規則 | 例 |
|---|---|---|
| モジュール/パッケージ | snake_case | `app/middleware/request_id.py` |
| クラス | PascalCase | `class GroupNotFound:` |
| 関数・変数 | snake_case | `def get_settings():` |
| 定数 | UPPER_SNAKE | `SENSITIVE_KEYS = {...}` |
| プライベート | 先頭 `_` | `_mask_sensitive`, `_log` |
| テスト | `test_*.py` | `tests/test_health.py` |
| Pydantic Schema | `<Name>Request` / `<Name>Response` | `CreateGroupRequest` |
| SQLAlchemy Model | 単数形 PascalCase | `class Group(Base):` |
| Router 変数 | `router` 固定 | `router = APIRouter(...)` |

---

## 5. コーディング規約 — Python (Backend)

### 5.1 一般

- **PEP 8 準拠**(ruff が自動チェック)
- **行長 100 文字**(`ruff.toml` の `line-length = 100`)
- **型ヒント必須**(関数の引数・戻り値・クラス属性)
- **docstring**: public 関数/クラスのみ。内部関数は不要(自明な命名で十分)

### 5.2 import 順序(ruff isort で自動)

```python
# 1. 標準ライブラリ
import asyncio
from datetime import datetime

# 2. サードパーティ
from fastapi import FastAPI
import structlog

# 3. ローカル
from app.config import get_settings
from app.db.session import get_session
```

### 5.3 型ヒント

- Python 3.12 構文を使う:`list[str]` / `dict[str, int]` / `X | None`(× `List[str]`, `Optional[X]`)
- UUID は `from uuid import UUID`(`str` で扱わない)
- 日時は `from datetime import datetime`(常に timezone-aware、`datetime.now(tz=UTC)`)

### 5.4 async / sync の使い分け

- ルータハンドラは原則 `async def`
- DB アクセス・HTTP クライアント・ファイル I/O は async ライブラリで統一
- 同期 SDK しかない場合は `asyncio.to_thread(...)` でラップ
- 純粋関数(計算ロジック)は `def`(清算アルゴリズム等)

### 5.5 例外

- ドメイン例外は `app/exceptions/domain.py` に集約
- ルータ層で `raise HTTPException(...)` を直書きしない(Global Handler に任せる)
- catch-all `except Exception:` は本当に必要な場所のみ。基本は具体的に

### 5.6 設定アクセス

- `Settings` は `get_settings()` 経由で取得(キャッシュ + DI 差し替え可能)
- ハンドラ内で `os.getenv(...)` を直接使わない

### 5.7 Pydantic

- v2 のみ使用(`.model_dump()`, `.model_validate()`, `model_config`)
- リクエストモデル: `<Action>Request` / レスポンス: `<Resource>Response`
- レスポンスでは **`alias_generator=to_camel`** を使い JSON は camelCase で出す(§8.4)

### 5.8 SQLAlchemy 2.x

- `class Foo(Base):` + `Mapped[]` + `mapped_column()` 形式
- 1.x の `Column()` 直書きは使わない
- セッションは `Depends(get_session)` で注入、ハンドラ内で生成しない

### 5.9 やらないこと

- ❌ `from x import *`(明示 import のみ)
- ❌ ミュータブルなデフォルト引数(`def f(x=[])` ではなく `def f(x=None)`)
- ❌ 例外を pass で握りつぶす(必ずログか再 raise)
- ❌ コメントアウトされたコードを残す(git に消えても残る)

---

## 6. コーディング規約 — TypeScript (Frontend)

### 6.1 tsconfig 設定

`strict: true` を最低保証。以下を明示:

```jsonc
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,   // arr[0] が T | undefined になる
    "noImplicitReturns": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

### 6.2 Lint / Format

- ESLint(`next/core-web-vitals` ベース)+ Prettier
- 行長は Prettier 既定(80)、`printWidth: 100` で `.prettierrc` に統一
- import 順序は ESLint で自動修正

### 6.3 型

- **`any` 禁止**。どうしても必要な場合は `unknown` + 型ガードで絞る
- API レスポンス型は OpenAPI → Zod 自動生成(Phase 1 で導入)
- 関数の戻り値型は明示(`function foo(): User { ... }`)

### 6.4 React / Next.js 15

- **Server Components がデフォルト**。`'use client'` は本当に必要なときだけ
  - `useState`, `useEffect`, `onClick`, `useRouter` を使う場合 → `'use client'`
  - 単に表示するだけ → 付けない(バンドル削減)
- `params` / `searchParams` は **Promise**(Next 15)→ `await params` を忘れない
- データ取得は Server Component なら `fetch` 直書き、Client なら axios(`@/lib/api-client`)

### 6.5 命名・ディレクトリ構造(Frontend)

#### 識別子の命名

- 変数・関数: camelCase(`getUserName`)
- React コンポーネント: PascalCase(`GroupCard`)。**階層タグ(`Section` / `Block` / `Page` 等)の suffix は付けない**(階層は配置で表現する)
- フック: `use` + camelCase(`useGroup`)
- 型・interface: PascalCase(`GroupResponse`、prefix の `I` は付けない)
- 定数: 場面に応じて。モジュールスコープで再代入しない真の定数のみ UPPER_SNAKE
- 環境変数の参照: `env.NEXT_PUBLIC_API_BASE_URL`(`@/lib/env` 経由)

#### ファイル名

**全ファイル kebab-case**(suffix は `.test.ts(x)` のみ)。`.utils.ts` `.types.ts` `.hook.ts` `.section.tsx` 等の suffix は使わない — ディレクトリ位置で役割を表現する。

| 種別 | ファイル名 | export 名 | 例 |
|---|---|---|---|
| Page(Next.js) | `page.tsx`(規約) | default export | `app/g/[uuid]/page.tsx` |
| Component(全階層) | kebab-case + `.tsx` | PascalCase | `payment-form.tsx` exports `PaymentForm` |
| Hook | `use-<name>.ts` | `use<Name>` | `use-group.ts` exports `useGroup` |
| API client | `api.ts` | named exports(camelCase) | `features/groups/api.ts` exports `createGroup` |
| Types | `types.ts` | named type exports | `features/payments/types.ts` exports `Payment` |
| Pure utils | `<topic>.ts` | named exports | `utils/format.ts` exports `formatYen` |
| Infra primitive | `<purpose>.ts` | named exports | `lib/api/client.ts` exports `apiClient` |
| Test | `<source>.test.ts(x)` | (test 関数) | `payment-form.test.tsx` |

#### ディレクトリ階層(feature-based)

```
frontend/
├── app/                    # Next.js routing 専用(page / layout のみ、薄い shell)
├── features/               # ★ ドメイン単位の自己完結スライス
│   └── <domain>/           #   例: groups, payments, settlement
│       ├── components/     #   feature 特化の UI(Section / Component 級)
│       ├── hooks/          #   feature 特化の hooks
│       ├── api.ts          #   その feature の HTTP ラッパ
│       └── types.ts        #   その feature の型
├── components/             # 共有 UI primitives(複数 feature が使う)
├── hooks/                  # 共有 hooks(複数 feature が使う)
├── utils/                  # ★ 純粋関数 helper(format, calc 等、副作用なし)
└── lib/                    # ★ 副作用 / Web API 依存の infra primitives
    ├── api/                #   axios インスタンス、生成型
    ├── auth/               #   localStorage 低レベル
    ├── env.ts
    └── request-id.ts
```

**配置の判定**:
- 「消えると影響する feature 数が **1 個** か?」→ `features/<X>/` 内に閉じる
- 「**2 個以上** か?」→ 共有層(`components/` `hooks/` `utils/` `lib/`)へ
- 「外部依存があるか(localStorage / fetch / process.env / 時刻 / random)?」→ `lib/`(infra)
- 「pure(同じ入力 → 同じ出力)か?」→ `utils/`

#### コンポーネント階層(語彙のみ、ディレクトリ強制なし)

レビュー / 議論で使う語彙(物理ディレクトリでは強制しない):

| 階層 | 役割 | 例 |
|---|---|---|
| **Page** | 完全な画面(Next.js routing entry) | `app/g/[uuid]/page.tsx` |
| **Section** | ページ内の大きな区画 | `GroupDashboard`、`PaymentForm`(現在の Phase 1 はほぼ全部 Section 級) |
| **Block** | Section の中で区切りたい中間階層(必要時のみ導入) | (Phase 3 以降) |
| **Component(primitive)** | 単機能の UI 構成要素 | (Phase 2 以降の `Button`, `Input` 等) |

階層が変わってもファイル名は変えない(ディレクトリ移動のみ)。これにより階層判断のリファクタが import 全箇所に波及しない。

### 6.6 やらないこと

- ❌ default export(named export 統一、リファクタしやすい)
  - 例外: `app/page.tsx`, `app/layout.tsx` 等の Next.js 規約ファイル
- ❌ `// @ts-ignore`(必要時は `// @ts-expect-error: <理由>` を使う)
- ❌ `useEffect` での fetch(Server Component / TanStack Query 等を検討)
- ❌ インラインのマジックナンバー(意味のある定数化)

---

## 7. データベース・SQL

### 7.1 命名

| 対象 | 規則 |
|---|---|
| テーブル名 | 複数形 snake_case (`groups`, `payment_shares`) |
| カラム名 | snake_case (`group_id`, `created_at`) |
| 主キー | `id` 単独(UUIDv4) |
| 外部キー | `<table_singular>_id` (`group_id`, `member_id`) |
| インデックス名 | `ix_<table>_<columns>` |
| ユニーク制約 | `ux_<table>_<columns>` |
| ENUM 型 | snake_case (`payment_source`) |

### 7.2 必須フィールド

すべてのテーブルに:
- `id` UUID PK
- `created_at` TIMESTAMPTZ DEFAULT now()

論理削除を使うテーブルに:
- `deleted_at` TIMESTAMPTZ NULL

更新を追跡するテーブルに:
- `updated_at` TIMESTAMPTZ(トリガー or アプリ層で更新)

### 7.3 タイムゾーン

- **常に `TIMESTAMPTZ`(timestamp with time zone)** を使う
- アプリ層では UTC で保持、表示は Frontend でローカル時刻に変換
- `TIMESTAMP`(without tz)は使わない

### 7.4 金額

- JPY は `INTEGER`(円単位、小数なし)
- 将来の多通貨対応のため `currency` 列で分離(設計書 §5)
- 計算は整数演算のみ(浮動小数点禁止)

### 7.5 マイグレーション

- すべての DDL は Alembic 経由(直接 DB 触らない)
- 1 マイグレーション = 1 論理変更(複数機能を1つに混ぜない)
- ファイル名は `<rev>_<verb>_<resource>.py`(`add_groups_table.py`)
- autogenerate 結果は **必ず目視レビュー**(カラムリネーム検出ミス等)

---

## 8. API 規約

### 8.1 URL 設計

- 全エンドポイントは `/api/` 配下
- リソースは複数形:`/api/groups`, `/api/payments`
- ID は path に:`/api/groups/{group_id}`
- 動詞は使わない(REST 原則):× `/api/groups/create`、◯ `POST /api/groups`
- ネストは1段まで:◯ `/api/groups/{id}/payments`、▲ それ以上は別リソース化を検討

### 8.2 HTTP メソッド

| メソッド | 用途 |
|---|---|
| GET | 取得(冪等・副作用なし) |
| POST | 作成、または非冪等な操作 |
| PATCH | 部分更新 |
| PUT | 全置換(本プロジェクトでは原則使わない) |
| DELETE | 削除(論理削除でも HTTP は DELETE) |

### 8.3 ステータスコード

| コード | 用途 |
|---|---|
| 200 | 取得・更新成功 |
| 201 | 作成成功(Location ヘッダで作成リソースを返す) |
| 204 | 成功・本文なし(削除等) |
| 400 | リクエスト形式不正 |
| 401 | 認可失敗(`X-Member-Id` 不整合等) |
| 404 | リソース未存在 |
| 409 | 競合 |
| 422 | バリデーションエラー(Pydantic 自動) |
| 429 | レート超過 |
| 500 | サーバ予期せぬエラー |
| 502 | 上流(IBM CA / GCP Vision)失敗 |
| 503 | DB 接続失敗 等 |

### 8.4 JSON ケース変換 ⭐重要

**ワイヤフォーマット(JSON over HTTP)は camelCase で統一。**
- Backend Python 内部: snake_case のまま
- Frontend TypeScript 内部: camelCase のまま
- 変換は **Backend 側の Pydantic alias_generator で実装**(片側に閉じる)

```python
# backend/app/schemas/base.py(共通基底クラス)
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,   # snake でも camel でもパース可
    )


# 使用例
class GroupResponse(CamelModel):
    id: UUID
    name: str
    event_date: date | None
    created_at: datetime
    # → JSON では eventDate, createdAt として出力される
```

リクエストも同様に `CamelModel` を継承し、Frontend が camelCase で送る前提にする。

### 8.5 共通ヘッダ

すべての API:
- リクエスト: `X-Request-Id`(任意、なければ Backend 生成)、`X-Member-Id`(`POST /api/groups` を除く必須)
- レスポンス: `X-Request-Id`(常に)

### 8.6 エラーレスポンス

RFC 7807 Problem Details(`Content-Type: application/problem+json`):

```json
{
  "type": "https://splai.app/problems/group-not-found",
  "title": "Group Not Found",
  "status": 404,
  "detail": "group abc not found",
  "instance": "https://api.splai.app/api/groups/abc"
}
```

`type` の slug は **kebab-case**(`group-not-found`、`member-mismatch`)。

### 8.7 ページネーション(将来拡張)

- カーソルベース(`?cursor=xxx&limit=50`)を採用予定
- offset/limit は使わない(MVP は一覧が小さいので未実装)

---

## 9. テスト規約

### 9.1 ファイル配置

| 種類 | 配置 |
|---|---|
| Backend ユニット | `backend/tests/test_*.py`(対象モジュールと並行構造) |
| Backend 統合 | `backend/tests/integration/test_*.py` |
| Frontend ユニット | `frontend/tests/**/*.test.ts(x)`(or 対象と同階層) |
| E2E | `e2e/`(将来 Playwright で追加、Phase 5) |

### 9.2 命名

- Python: `def test_<対象>_<条件>_<期待結果>():` 形式
  - 例: `def test_settlement_returns_empty_when_balanced():`
- TypeScript: `describe('<対象>', () => { it('<条件・期待>', ...) })`
  - 例: `describe('parseEnv', () => { it('throws when required env var is missing') })`

### 9.3 構造(AAA)

```python
def test_xxx():
    # Arrange — 前提を作る
    monkeypatch.setenv("DATABASE_URL", "...")

    # Act — 対象を実行
    result = Settings()

    # Assert — 期待を検証
    assert result.database_url == "..."
```

空行で 3 ブロックを視覚的に分離。

### 9.4 TDD 適用範囲(設計書 §10 に準拠)

- **必須**: 清算最適化アルゴリズム、API 認可ロジック、ミドルウェア、例外ハンドラ
- **任意**: AI 機能(プロンプトはスナップショット中心)、UI コンポーネント

### 9.5 モック方針

- DB モックは作らない。テスト用 Postgres(or sqlite + 工夫)を使う
- 外部 API(IBM CA / GCP Vision)は VCR or `respx`(httpx 用モック)で録画再生
- 時刻は `freezegun` か固定値の引数注入で固定

### 9.6 やらないこと

- ❌ プロダクションコードのテストカバレッジ 100% を目標にする(質より無意味な数字に陥る)
- ❌ private 関数を直接テスト(public API 経由で十分)
- ❌ テスト内で sleep(flaky の元 → イベント駆動 or タイムアウト戦略で書き直す)

---

## 10. 環境変数・シークレット

### 10.1 命名

- すべて UPPER_SNAKE
- Frontend で公開してよい変数: `NEXT_PUBLIC_` プレフィックス必須
- それ以外は **絶対に** `NEXT_PUBLIC_` を付けない(漏洩する)

### 10.2 ファイル配置

| ファイル | 用途 | git |
|---|---|---|
| `frontend/.env.local.example` | テンプレート、値は空 | 追跡する |
| `frontend/.env.local` | ローカル開発の実値 | gitignore |
| `backend/.env.example` | テンプレート、値は空 | 追跡する |
| `backend/.env.local` | ローカル開発の実値(`APP_ENV` 未設定時の既定) | gitignore |
| `backend/.env.prod` | 本番シミュレーション用(`APP_ENV=prod` で読み込む) | gitignore |
| 本番(Vercel) | Vercel ダッシュボードの env vars | — |
| 本番(Fly.io) | `flyctl secrets set` | — |

### 10.3 ルール

- 新しい env var を追加したら **同じ PR で `.env.example` も更新**
- 値の例(default 値ではない、形式ガイド)を `.env.example` のコメントで補足
- シークレット(DSN、API キー、DB パスワード)は **絶対にコードや commit メッセージに書かない**
- 漏洩したと思ったら即ローテーション(該当サービスでキー再発行)

---

## 11. 自動化(linter / formatter / CI)

### 11.1 Python

| ツール | 役割 |
|---|---|
| `ruff check` | Lint(import順、未使用、規則違反) |
| `ruff format` | フォーマッタ(black 互換) |
| `pytest` | テストランナー |
| `mypy` | 型チェック(Phase 1 で導入検討) |

```bash
# ローカルで全部実行
uv run ruff check .
uv run ruff format .
uv run pytest -v
```

### 11.2 TypeScript

| ツール | 役割 |
|---|---|
| `next lint` | ESLint(Next.js プリセット) |
| `prettier` | フォーマッタ |
| `vitest` | テストランナー |
| `tsc --noEmit` | 型チェック(CI で実施) |

```bash
cd frontend
npm run lint
npm run format    # package.json に "format": "prettier --write ." を追加
npm test
```

### 11.3 pre-commit(任意・推奨)

`lefthook` を採用(Go 製・両言語対応・速い)。CI と同じチェックをローカルでも走らせる。

`lefthook.yml`(リポルート):
```yaml
pre-commit:
  parallel: true
  commands:
    frontend-lint:
      glob: "frontend/**/*.{ts,tsx,js,jsx}"
      run: cd frontend && npm run lint --fix {staged_files}
      stage_fixed: true
    frontend-format:
      glob: "frontend/**/*.{ts,tsx,css,md}"
      run: cd frontend && npx prettier --write {staged_files}
      stage_fixed: true
    backend-ruff:
      glob: "backend/**/*.py"
      run: cd backend && uv run ruff check --fix {staged_files} && uv run ruff format {staged_files}
      stage_fixed: true
```

導入は Phase 0 の安定後でも可(必須ではない)。

### 11.4 CI(GitHub Actions)

- **Frontend CI**: `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build`
- **Backend CI**: `uv run ruff check . && uv run ruff format --check . && uv run pytest -v`
- すべての PR で実行(`pull_request` トリガーには `paths` フィルタを付けない — Branch Protection の必須 check が起動しなくなる罠を避ける)
- `push: main` / `push: develop` は `paths` フィルタで該当変更時のみ実行可

#### Required Status Check 名(Branch Protection で必須化する)

| Check 名 | 由来 workflow / job |
|---|---|
| `frontend` | `.github/workflows/frontend-ci.yml` の `jobs.frontend` |
| `backend` | `.github/workflows/backend-ci.yml` の `jobs.backend` |

- workflow を追加する際は **job 名(jobs.<name>)を Branch Protection 用に意図して命名**する(`test` 等の汎用名は避ける)
- 新たな必須 check を追加した場合、Branch Protection ルールも追従して更新する(自動同期はされない)

main ブランチへのマージは上記 check が緑であることが必須(GitHub の Branch Protection で強制)。詳細ルールは Phase 0 計画書 Task 22 を参照。

### 11.5 エディタ設定

VSCode を想定:
- `editor.formatOnSave: true`
- 保存時に ESLint/Prettier/ruff が自動実行されるよう設定
- `settings.json` をリポにコミットして共有(`.vscode/settings.json`)

---

## 12. ログ・エラーメッセージ規約

### 12.1 構造化ログ(Backend)

`event` フィールドは **`<noun>.<verb>`** 形式の小文字 dot.notation:

```python
log.info("group.created", group_id=str(group.id), member_count=5)
log.warning("auth.member_mismatch", group_id=..., member_id=..., reason="not in group")
log.info("ai.tool_called", conversation_id=..., tool="register_payment")
```

レベルの基準:
- `debug`: 開発時のみ。本番では出さない
- `info`: 主要なドメインイベント(作成、更新、AI呼び出し)
- `warning`: 許容できる異常(認可失敗、レート超過、リトライ)
- `error`: 復旧不能なエラー(プロバイダ全断、DB ダウン)

### 12.2 ユーザー向けエラーメッセージ(Frontend / Problem Details `detail`)

- 日本語、丁寧体だが過剰に長くしない
- 何が起きたか + 次のアクション を 1〜2文で
- 技術用語(stack trace、SQL、HTTP コード)を入れない

```
◯ 「このグループは見つかりませんでした。URL が正しいかご確認ください。」
× 「Error: 404 Not Found - group_id=abc"」
```

### 12.3 ブランド Voice 準拠(設計書 §12.5)

UI に出すテキストは設計書のVoice & Tone に従う:
- 体言止め・短文
- AI の働きは事実として淡々と(「AI が3回の送金で済む組み合わせを見つけました」)
- 大仰な煽り・絵文字濫用は禁止

---

## 付録: 規約の更新ルール

- 規約変更は PR で議論(本人 1 人でも、変更理由を本文に書く)
- 大きな変更は `chore: update conventions` ではなく `docs: update conventions for X reason` で目立たせる
- 既存コードへの遡及適用は無理にやらない(触ったとき直す方針)

---

> 本ドキュメントは生きた規約。実装中に「この規約は機能していない」「この観点が抜けていた」が出たら遠慮なく更新する。
