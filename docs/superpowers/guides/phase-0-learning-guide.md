# Phase 0 学習ガイド — FastAPI を中心に

> **このドキュメントの位置づけ**
> [`plans/2026-05-24-phase-0-setup.md`](../plans/2026-05-24-phase-0-setup.md) は手順書(WHAT)、本ガイドは解説書(WHY/HOW)。
> 実装はユーザーが行う前提で、各タスクの「なぜそう書くのか」「どこに落とし穴があるか」を補足する。
>
> 想定読者: FastAPI / AI Agent 開発はほぼ未経験、React/Next.js は基本デプロイ経験あり。

---

## 目次

- [0. Phase 0 全体マップ](#0-phase-0-全体マップ)
- [1. 前提知識 — FastAPI を触る前に](#1-前提知識--fastapi-を触る前に)
  - [1.1 uv とは](#11-uv-とは)
  - [1.2 async / await — なぜ FastAPI は async か](#12-async--await--なぜ-fastapi-は-async-か)
  - [1.3 ASGI / WSGI](#13-asgi--wsgi)
  - [1.4 Pydantic v2 の三役](#14-pydantic-v2-の三役)
  - [1.5 FastAPI 中核機能の俯瞰](#15-fastapi-中核機能の俯瞰)
- [2. タスク別ポイント解説(Backend)](#2-タスク別ポイント解説backend)
  - [2.1 Task 6: uv プロジェクト初期化](#21-task-6-uv-プロジェクト初期化)
  - [2.2 Task 7: Pydantic Settings](#22-task-7-pydantic-settings)
  - [2.3 Task 8: structlog](#23-task-8-structlog)
  - [2.4 Task 9-10: ミドルウェア二段構え](#24-task-9-10-ミドルウェア二段構え)
  - [2.5 Task 11: ドメイン例外と RFC 7807](#25-task-11-ドメイン例外と-rfc-7807)
  - [2.6 Task 12: create_app パターンと統合](#26-task-12-create_app-パターンと統合)
  - [2.7 Task 13: SQLAlchemy 2.x async + Supabase](#27-task-13-sqlalchemy-2x-async--supabase)
  - [2.8 Task 14: Alembic async](#28-task-14-alembic-async)
  - [2.9 Task 15: Sentry(Backend)](#29-task-15-sentrybackend)
  - [2.10 Task 18: Dockerfile + Fly.io](#210-task-18-dockerfile--flyio)
- [3. Next.js 15+ 特有メモ](#3-nextjs-15-特有メモ)
- [4. AI Agent 予習(Phase 3)](#4-ai-agent-予習phase-3)
- [5. 落とし穴チェックリスト](#5-落とし穴チェックリスト)

---

## 0. Phase 0 全体マップ

22 タスクを役割で再分類すると、Phase 0 がやっていることは大きく 4 層:

```
┌─────────────────────────────────────────────────────────┐
│ L4. デプロイ・運用基盤 (Task 17, 18, 20)                  │
│     Vercel, Fly.io, GitHub Actions CI                    │
├─────────────────────────────────────────────────────────┤
│ L3. 観測 (Task 8, 10, 15, 16)                            │
│     structlog (JSON), Sentry, X-Request-Id 相関ID        │
├─────────────────────────────────────────────────────────┤
│ L2. アプリ骨格 (Task 6, 7, 9, 11, 12)                    │
│     FastAPI app, Settings, Middleware, Exception, /health │
├─────────────────────────────────────────────────────────┤
│ L1. データ基盤 (Task 13, 14)                              │
│     Supabase Postgres + SQLAlchemy 2.x async + Alembic    │
└─────────────────────────────────────────────────────────┘

並走: Frontend (Task 2-5, 16, 19) — Next.js 15 + Tailwind + Vitest + Sentry
```

**Phase 0 の DoD(完了条件)を一行で言うと**:
「`/health` を本番 URL から呼んだら、構造化ログに request_id 付きで記録され、エラーは Sentry に届き、PR を出すと CI が走る」状態。

ここまで作っておくと、Phase 1 以降は **「業務ロジックを書くだけ」** の状態になる。観測・デプロイ・例外処理は二度と書かなくて良い。

---

## 1. 前提知識 — FastAPI を触る前に

### 1.1 uv とは

`uv` は Astral 社製の Python パッケージマネージャ。`pip` + `pip-tools` + `pyenv` + `virtualenv` を Rust で再実装した置き換え。

**なぜ採用するか:**
- インストールが圧倒的に速い(pip の 10〜100倍)
- `uv.lock` で再現可能なビルド(Node の `package-lock.json` 相当)
- `pyproject.toml` 一本で完結(`requirements.txt` を分けなくて良い)
- Python バージョンの管理(`.python-version`)も統一できる

**最低限のコマンド対応表:**

| やりたいこと | uv |
|---|---|
| プロジェクト初期化 | `uv init --package` |
| 依存追加 | `uv add fastapi` |
| 開発依存追加 | `uv add --dev pytest` |
| 仮想環境同期 | `uv sync`(`.venv` を自動作成) |
| 任意コマンドを仮想環境で実行 | `uv run pytest` |
| 依存ロック厳守でインストール | `uv sync --frozen`(CI/Docker 用) |

**`pyproject.toml` のキモ:**
```toml
[project]
dependencies = ["fastapi>=0.115", ...]   # 本番依存

[dependency-groups]
dev = ["pytest>=8.3", ...]               # 開発依存(uv 独自グループ)
```
`pip install -e .` で良い時代は終わった。`uv sync` で `.venv` ごと用意してくれる。

---

### 1.2 async / await — なぜ FastAPI は async か

#### 同期(sync)コードのイメージ
```python
def get_user(user_id):
    user = db.query(...)        # ← DB 応答を待つ間、このスレッドは何もしない
    profile = api.fetch(...)    # ← API 応答を待つ間も同様
    return {...}
```
1リクエスト = 1スレッドを占有。100リクエスト並列 = 100スレッド必要 = メモリ消費大。

#### 非同期(async)コードのイメージ
```python
async def get_user(user_id):
    user = await db.query(...)      # ← await の瞬間に他のリクエスト処理に切り替わる
    profile = await api.fetch(...)  # ← 同上
    return {...}
```
1スレッド + イベントループ = **多数のリクエストを「待ち時間中だけ」並列処理**できる。
I/O が多い Web API に特に向く(DB 待ち・外部 API 待ちが大半のため)。

#### 大事なルール

1. **`async def` の中でしか `await` は使えない。**
2. **`await` を付けるべき関数を呼んだら必ず付ける。**忘れるとコルーチンオブジェクトを返すだけで実行されない(初学者の罠 No.1)。
3. **CPU 重い処理を `async def` の中で同期的にやるとイベントループが詰まる。**
   → 重い計算は `asyncio.to_thread(...)` か別ワーカーへ。
4. **`def` のままでも FastAPI は受け入れる。** スレッドプールで実行してくれる。
   → 同期 ORM や同期 SDK は無理に async 化しなくて良い。

#### 本プロジェクトの方針
- ルータハンドラは基本 `async def`(FastAPI の流儀)。
- DB は SQLAlchemy 2.x の async ドライバ(`asyncpg`)で統一。
- IBM CA / GCP Vision の SDK は同期かもしれないので、その時だけ `to_thread` でラップ。

---

### 1.3 ASGI / WSGI

- **WSGI** = 同期前提の Python Web 標準(Flask, Django 旧来)
- **ASGI** = 非同期も扱える後継標準(FastAPI, Starlette, Django 4+)

FastAPI は **Starlette + Pydantic** の上に作られた ASGI フレームワーク。
- ルーティング・ミドルウェア・テスト基盤は **Starlette** 由来
- 入出力の型・バリデーション・OpenAPI 生成は **Pydantic** 由来

「FastAPI 独自」と思っているものの大半は Starlette か Pydantic。エラー時にこの 2 つのドキュメントを当たれると詰まりにくい。

サーバプロセスとして本プロジェクトでは **`uvicorn`** を使う(ASGI サーバ実装)。本番は Fly.io 上で `uvicorn app.main:app` を直接起動。Gunicorn は今回は不要。

---

### 1.4 Pydantic v2 の三役

Pydantic は **「Python の型ヒントを実行時バリデーションに使う」**ライブラリ。FastAPI の心臓。

#### 役割 ①: リクエスト/レスポンスのスキーマ
```python
from pydantic import BaseModel

class CreateGroupRequest(BaseModel):
    name: str
    member_names: list[str]

@app.post("/api/groups")
async def create_group(body: CreateGroupRequest):
    # body.name, body.member_names は型保証済
    ...
```
不正な JSON が来たら自動で 422 を返してくれる。OpenAPI スキーマも自動生成される。

#### 役割 ②: 設定読み込み(`pydantic-settings`)
```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str
    log_level: str = "INFO"
```
環境変数を「型付き」で読み込む。型が合わないと起動時に落ちる(早期失敗)。

#### 役割 ③: 内部ドメインモデル
```python
class Transfer(BaseModel):
    from_id: UUID
    to_id: UUID
    amount: int
```
DB 層の SQLAlchemy モデルとは別に、ビジネスロジック層で使う。

#### Pydantic v1 → v2 注意点
- `Config` クラスは廃止 → `model_config = ConfigDict(...)` または `SettingsConfigDict(...)`
- `.dict()` → `.model_dump()`
- `.parse_obj()` → `.model_validate()`
- バリデータ: `@validator` → `@field_validator`

ネット上のサンプルが v1 のままのことがあるので注意。本プロジェクトは v2 前提。

---

### 1.5 FastAPI 中核機能の俯瞰

#### ルーティング(APIRouter)
```python
from fastapi import APIRouter
router = APIRouter(prefix="/api/groups", tags=["groups"])

@router.post("")           # POST /api/groups
async def create(...): ...

@router.get("/{group_id}") # GET /api/groups/{group_id}
async def get(group_id: UUID): ...
```
`app.include_router(router)` で本体に登録。ファイル分割の単位になる。

#### 依存性注入(Depends)
```python
from fastapi import Depends

async def get_db() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session

@router.get("/{id}")
async def get_group(id: UUID, db: AsyncSession = Depends(get_db)):
    ...
```
- ハンドラ実行前に `get_db()` が呼ばれ、`yield` した値が引数 `db` に入る。
- `yield` の後ろにあるコード(セッション close 等)はハンドラ終了後に実行される。
- DB セッション・認可チェック・現在のユーザー解決などはほぼ全部 `Depends` で書く。

本プロジェクトでは「`X-Member-Id` 検証 + group_id 整合チェック」を `Depends` で書く想定(Phase 1 で詳細)。

#### 型ヒントが OpenAPI を生む
ハンドラの引数・戻り値の型 → 自動で `/docs`(Swagger UI)と `/redoc` が生える。Frontend の Zod スキーマもこの OpenAPI から自動生成する戦略(Task 中盤以降で導入)。

→ **「型を書かない」=「ドキュメントを書かない」と同じくらい損。**型は嘘をつかないように書く。

---

## 2. タスク別ポイント解説(Backend)

### 2.1 Task 6: uv プロジェクト初期化

#### `uv init` のフラグ選択
本プロジェクトでは **`--package` を使わない**。理由:

| フラグ | 生成されるレイアウト | 用途 |
|---|---|---|
| (なし) / `--app`(既定) | `<dir>/main.py`(フラット) | アプリケーション(配布しない) |
| `--package` | `<dir>/src/<name>/__init__.py` | 配布する packaged application |
| `--lib` | `<dir>/src/<name>/__init__.py` | ライブラリ |

FastAPI アプリは配布しないので `--app`(既定)が正解。`--package` を付けると `src/` レイアウトになり、計画書の File Structure(`backend/app/main.py`)と矛盾する。

`--no-pin-python`: `.python-version` は手で書く(プロジェクト全体で `3.12` 統一)。

#### 依存の選定理由

| パッケージ | 役割 |
|---|---|
| `fastapi` | Web フレームワーク本体 |
| `uvicorn[standard]` | ASGI サーバ。`[standard]` は高速版依存セット(httptools, uvloop 等) |
| `pydantic-settings` | `BaseSettings` を分離した v2 仕様 |
| `sqlalchemy[asyncio]` | ORM。`[asyncio]` は async 機能の追加依存 |
| `asyncpg` | Postgres 用の高速 async ドライバ |
| `alembic` | マイグレーションツール(ORM とセット) |
| `structlog` | 構造化ログ。stdlib logging を内側で使う |
| `sentry-sdk[fastapi]` | エラートラッキング。`[fastapi]` で自動統合 |
| `httpx` | async HTTP クライアント。AI/OCR 呼び出しと TestClient 両方で使う |

**`[xxx]` (extras) とは:** そのパッケージのオプション機能を有効化する追加依存。`[asyncio]` を付けないと async 関連のクラスがインポートエラーになる。

#### 落とし穴
- Pydantic v1 の `email-validator` などをついで入れると地獄。本プロジェクトは v2 のみ。
- `uvicorn[standard]` を入れずに `uvicorn` だけ入れるとパフォーマンスが出ない(uvloop が入らない)。

---

### 2.2 Task 7: Pydantic Settings

#### なぜ「型付きの環境変数」か
プレーンな `os.getenv("PORT")` は文字列を返す。`int(os.getenv("PORT"))` は欠けてたら TypeError。複数箇所で書くと必ず壊れる。

`Settings` クラスを 1 か所に集約することで:
- 起動時に必要な変数が揃っているか検証(早期失敗)
- 型変換は自動(`int`, `bool`, `Literal[...]` 等)
- IDE が補完してくれる(`settings.database_url` を打ち間違えると怒られる)

#### `Field(...)` の意味
```python
database_url: str = Field(...)   # ... = 必須(デフォルト値なし)
log_level: str = "INFO"          # デフォルト値あり = 任意
```
`Field(...)` は「必須」の明示的なマーカー。設定し忘れたら起動時に ValidationError。

#### `get_settings()` という関数を介す理由
```python
def get_settings() -> Settings:
    return Settings()
```
ハンドラから直接 `Settings()` を呼ばず、関数経由にする。理由:
1. **テスト時に差し替えやすい**: `app.dependency_overrides[get_settings] = ...` でモック可能。
2. **Depends で渡せる**: `Depends(get_settings)` でハンドラに注入可能。
3. **シングルトン化が後で楽**: `@lru_cache` を一行足すだけでキャッシュ化できる。

```python
from functools import lru_cache

@lru_cache
def get_settings() -> Settings:
    return Settings()
```
本番ではこれで十分。設定は起動時に1回読めば良い。

#### `.env` ファイルの扱い
- 開発: `backend/.env.local`(gitignore 済)を読む
- 本番(Fly.io): `flyctl secrets set` で OS 環境変数として注入される
- `SettingsConfigDict(env_file=".env", extra="ignore")`: 読めなくてもエラーにせず、未定義 env は無視

---

### 2.3 Task 8: structlog

#### なぜ stdlib `logging` ではなく structlog か
- stdlib: `logger.info(f"user {user_id} logged in")` → 文字列。集計・検索に弱い。
- structlog: `log.info("user.login", user_id=user_id)` → JSON。

```json
{"event": "user.login", "user_id": "abc", "timestamp": "2026-05-24T...", "level": "info"}
```

Datadog / Cloud Logging / Loki / Sentry いずれでも JSON は構造化検索しやすい。「`user_id=abc` の event を全部出す」が一発で書ける。

#### `processors` の概念
structlog は「ログ生成 → 加工パイプライン → 出力」という流れ。`processors=[...]` のリスト順に呼ばれる。

```python
processors=[
    structlog.contextvars.merge_contextvars,   # コンテキスト変数(後述)を混ぜ込む
    structlog.stdlib.add_log_level,            # level フィールド追加
    structlog.processors.TimeStamper(fmt="iso"), # timestamp 追加
    _mask_sensitive,                            # 自作: API キー等をマスク
    structlog.processors.format_exc_info,       # 例外を整形
    structlog.processors.JSONRenderer(),        # 最後に JSON 文字列化
]
```

#### `merge_contextvars` の使いどころ
リクエスト処理中に `request_id` をコンテキスト変数に入れておけば、その request 中の全ログに自動付与される。

```python
# middleware/logging.py で
import structlog
structlog.contextvars.bind_contextvars(request_id=request_id)
# → 以降そのリクエスト中の log.info(...) すべてに request_id が混ざる
```

#### マスキングの絶対原則(設計書 §9.2)
- `Authorization`, `X-API-Key` 等のヘッダは `***REDACTED***`
- レシート画像のバイト列は出さない(パスのみ)
- `ai_messages.content` は直接ログに出さない(プライバシー + サイズ)

`_mask_sensitive` processor を入れて事故防止。

---

### 2.4 Task 9-10: ミドルウェア二段構え

#### ミドルウェアとは
HTTP リクエストを **ハンドラの前後で加工する仕組み**。Express の middleware、Rails の Rack middleware と同じ発想。

#### 本プロジェクトのミドルウェア順序
```python
app.add_middleware(LoggingMiddleware)     # 後で add した方が「外側」
app.add_middleware(RequestIdMiddleware)   # 内側 = 先に走る
```

⚠️ **FastAPI は「後で `add_middleware` した方が外側」になる。** 直感と逆。

実行順:
```
リクエスト
  ↓ LoggingMiddleware (start)
  ↓ RequestIdMiddleware (request_id を state にセット)
  ↓ ハンドラ
  ↑ RequestIdMiddleware (X-Request-Id をヘッダに付与)
  ↑ LoggingMiddleware (status と duration をログ)
レスポンス
```

LoggingMiddleware が「外側」だと duration に RequestIdMiddleware の処理時間も含まれる(欲しい挙動)。

#### `BaseHTTPMiddleware` vs raw ASGI middleware
- `BaseHTTPMiddleware`(本プロジェクト採用): 書きやすい。ただしストリーミングレスポンスで挙動が微妙な既知の問題あり。
- raw ASGI: `__call__(self, scope, receive, send)` を直接書く。書きにくい。

Phase 0 では `BaseHTTPMiddleware` で十分。SSE ストリーミング(Phase 3)で問題が出たら検討。

#### X-Request-Id の運用上の意味
- **Frontend が UUID を生成 → Backend に送る → Backend は受領した UUID をそのまま使い、ログとレスポンスに乗せる**
- 受領した UUID が形式不正なら破棄して新規生成(防衛)
- 障害調査時に「Frontend のコンソールに出た request_id を Backend のログで grep」が一瞬でできる

---

### 2.5 Task 11: ドメイン例外と RFC 7807

#### なぜ例外を独自に定義するか
ハンドラの中で `raise HTTPException(404, "Group not found")` と書いても動く。が、

- **どこでも同じ文言・同じステータスを保証できない**(コピペで揺れる)
- **ロジック層から例外を投げられない**(HTTPException は HTTP 層の概念)
- **エラーを集計しづらい**(エラー種別ごとの発生数を取りたい)

→ ドメイン例外(`GroupNotFound`, `MemberMismatch` ...)を独自に定義し、Global Handler で HTTP 形式に変換する。

#### RFC 7807 Problem Details
HTTP API のエラーレスポンス形式の標準。
```json
{
  "type": "https://splai.app/problems/group-not-found",
  "title": "Group Not Found",
  "status": 404,
  "detail": "group abc not found",
  "instance": "https://api.splai.app/api/groups/abc"
}
```
`Content-Type: application/problem+json` で返すのが規約。Frontend 側で「`type` を見てエラー画面を分岐」が定型化できる。

#### `register_exception_handlers(app)` 関数化の理由
`@app.exception_handler(...)` は本来デコレータ式。これを関数の中で `app.exception_handler` で動的登録することで:
- `create_app()` で再利用可能(テスト時にミニ FastAPI を組むのが楽)
- ハンドラ群がモジュール内で 1 か所にまとまる

#### `Exception` のキャッチは最後に
```python
@app.exception_handler(SplaiError)   # 先に specific を登録
async def handle_splai_error(...): ...

@app.exception_handler(Exception)    # 後に catch-all
async def handle_unexpected(...): ...
```
順序が逆だと specific が呼ばれない(Python の例外マッチング規則)。

---

### 2.6 Task 12: create_app パターンと統合

#### Application Factory パターン
```python
def create_app() -> FastAPI:
    app = FastAPI(...)
    # middleware, routers, handlers をここで全部組み立てる
    return app

app = create_app()  # モジュールトップで生成
```

なぜこのパターンか:
- **テストで「素のミニ app」を別構成で立てられる**(認可だけ外す等)
- **設定切替が容易**(`create_app(env="test")` 等)
- **モジュール import 時に副作用を避けられる**

Flask の `create_app()` と同じ発想。FastAPI 公式チュートリアルは `app = FastAPI()` をモジュールトップに直接書く例が多いが、規模が大きくなるとこのパターンに移行するのが定番。

#### CORS 設定
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://splai.vercel.app"],
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-Id"],
)
```
- `expose_headers`: ブラウザの JS から読めるカスタムヘッダ。`X-Request-Id` を露出しておかないと axios で読めない。
- `allow_credentials=False`: Cookie ベース認証を使わない方針なので False。Cookie 認証なら True + `allow_origins` を明示列挙(`*` 不可)。

#### ミドルウェアと例外ハンドラの登録順
```python
# 順番に意味がある:
configure_logging(...)      # 1. ログを最初に整える(以降の起動ログを JSON 化)
sentry_sdk.init(...)        # 2. Sentry も早めに(初期化前のエラーは捕捉できない)
app = FastAPI(...)
app.add_middleware(...)     # 3. ミドルウェア
register_exception_handlers # 4. 例外ハンドラ
app.include_router(...)     # 5. ルーター
```

---

### 2.7 Task 13: SQLAlchemy 2.x async + Supabase

#### SQLAlchemy 2.x の変化(1.x からの差分)
- `Session.execute(select(User))` が標準(`Session.query(User)` は legacy)
- `DeclarativeBase` を継承して models を定義(旧: `declarative_base()` 関数)
- `Mapped[type]` 型ヒントが必須に
- async 対応が公式になった(`AsyncSession`)

```python
# 2.x 流の model 定義(Phase 1 で書く)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import String
import uuid

class Base(DeclarativeBase):
    pass

class Group(Base):
    __tablename__ = "groups"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100))
```

#### `create_async_engine` と `async_sessionmaker`
```python
engine = create_async_engine(database_url, echo=False, future=True)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)
```
- `echo=True` にすると SQL がログに出る(開発時のみ)
- `expire_on_commit=False`: commit 後にオブジェクトを再ロードしない設定。FastAPI の使い方では基本これ(commit 後の参照で追加クエリが飛ぶのを防ぐ)。

#### `get_session` を `Depends` で渡す
```python
async def get_session() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session  # ハンドラに渡る
        # ハンドラ終了後にここに戻ってきて、async with が close
```
**`yield` の前後でリソース管理**するのが定石。例外発生時も `async with` が close を保証。

#### Supabase の接続種別と落とし穴

Supabase は 3 種類の接続方法を提供:

| 種別 | ホスト | port | IPv4 対応 | 用途 |
|---|---|---|---|---|
| Direct | `db.<ref>.supabase.co` | 5432 | ❌ **IPv6 only**(2024〜) | IPv6 経路がある環境 |
| Session pooler | `aws-0-<region>.pooler.supabase.com` | 5432 | ✅ | 常駐サーバ向け(Fly.io 等) |
| Transaction pooler | `aws-0-<region>.pooler.supabase.com` | 6543 | ✅ | サーバレス向け(asyncpg は `statement_cache_size=0` 必須) |

⚠️ **大きな罠**: Direct Connection は 2024 年から **IPv6 only** に変更された。日本の家庭インターネットや一部モバイル回線は **IPv6 経路を持たない**ため、ローカル開発で Direct を使うと `socket.gaierror: nodename nor servname provided` エラーで死ぬ。

→ **本プロジェクトは Session Pooler を採用する**。Fly.io 上でも問題なく動き、ローカル/本番で URL 形式を統一できる。

ホスト名フォーマット:
- ホスト: `aws-0-ap-northeast-1.pooler.supabase.com`(東京)
- **ユーザー名は `postgres.<project-ref>`** ← Direct の `postgres` から変わる

例:
```
postgresql+asyncpg://postgres.<ref>:<pwd>@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres
```

**`postgresql+asyncpg://` のスキームに必ず書き換える**こと。Supabase ダッシュボードがコピーする URL は `postgresql://` のままなので忘れがち。

#### Service Role Key と RLS 不使用の意味
- Supabase の典型構成は「フロントが anon key で直接 DB を叩く + RLS で守る」
- 本プロジェクトは「Backend が `service_role` key(全権限)で叩く + アプリ層で認可」
- フロントは Backend にしか話しかけない
- → RLS は無効のまま。Backend が **唯一のゲートキーパー**になる

この方針は設計書 §4 の通り。Phase 0 では DB 接続だけ確認できれば良い。

---

### 2.8 Task 14: Alembic async

Alembic は SQLAlchemy 公式のマイグレーションツール。Django の `makemigrations` 相当。

#### `alembic init -t async alembic` の意味
- `-t async`: async 用テンプレートで `env.py` を生成
- `alembic` ディレクトリが作られる(リネーム不要)

#### `env.py` カスタマイズの理由
デフォルトの `env.py` は `alembic.ini` の `sqlalchemy.url` を読むが、本プロジェクトは:
1. **環境変数から URL を読みたい**(.env に統一したい)
2. **`Base.metadata` を target にしたい**(autogenerate のため)

→ `env.py` で `from app.config import get_settings` し、`config.set_main_option("sqlalchemy.url", settings.database_url)` で上書きする。

#### autogenerate の仕組みと限界
将来モデルを追加したら:
```bash
uv run alembic revision --autogenerate -m "add groups table"
```
で `Base.metadata` と DB の差分から自動でマイグレーションファイルを生成。

ただし autogenerate は:
- ✅ テーブル追加・カラム追加・インデックス追加 は得意
- ⚠️ カラム名変更は「削除+追加」と判定される(データロスト)
- ⚠️ ENUM 型・チェック制約は手書き必要

→ **生成された `versions/xxx.py` は必ず目視レビュー**してからコミット。

#### Phase 0 では空マイグレーションを 1 つ作る理由
- マイグレーションのパイプライン(`upgrade`/`downgrade`)が動くことを確認
- Supabase 側に `alembic_version` テーブルが作られる(以後の管理開始点)

---

### 2.9 Task 15: Sentry(Backend)

#### `sentry-sdk[fastapi]` で何が起きるか
- 未捕捉例外が自動で Sentry に送信される
- リクエスト情報(method, path, query)も自動添付
- パフォーマンストレース(`traces_sample_rate` で取得率を指定)

#### `traces_sample_rate=0.1` の意味
全リクエストのうち 10% だけパフォーマンストレース送信。100% だとイベント数で課金枠を圧迫する(無料枠は 10K events/月など)。

#### `send_default_pii=False` の意味
PII (Personally Identifiable Information) — IP・user-agent・cookie 等の個人情報をデフォルト送信しない。GDPR / 個人情報保護法対応。

#### `environment=settings.env` の意味
Sentry ダッシュボードで `production` / `development` / `test` を切り替えられる。本番ノイズに開発エラーが混ざるのを防ぐ。

#### スモーク確認の重要性
`raise RuntimeError("test")` するエンドポイントを一時追加し、ダッシュボードに **実際に届く** ことを目視確認してから本番へ。DSN 間違い・ネットワーク制限で届かないことがある。

---

### 2.10 Task 18: Dockerfile + Fly.io

#### Multi-stage build を採用していない理由
Phase 0 の Dockerfile は単一ステージ。理由:
- uv の compose レイヤキャッシュが優秀(再ビルドが速い)
- イメージサイズより「ビルド単純さ」を優先
- 後で multi-stage 化は容易

#### `uv sync --frozen --no-dev --no-install-project` の意味
- `--frozen`: `uv.lock` を信頼し、再解決しない(再現性)
- `--no-dev`: 開発依存(pytest 等)を入れない(本番イメージ最小化)
- `--no-install-project`: プロジェクト自身はまだインストールしない(後の `COPY app/` の後で `uv sync` 再実行)

→ **依存だけ先に install してキャッシュ化、コード変更ではこのレイヤを再ビルドしない** のが Docker のセオリー。

#### Fly.io の `auto_stop_machines = "stop"` 経済性
- アクセスがない時間はマシン停止(課金停止)
- 次のリクエストで自動起動(コールドスタート 1〜3秒)
- 個人開発の MVP には十分。常時起動が必要なら `min_machines_running = 1`

#### Region: `nrt`(東京)
ユーザー(日本)・Supabase(`ap-northeast-1`)と同じリージョンに置くことでレイテンシ最小化。

#### `flyctl secrets set` の挙動
シークレットは Fly.io の暗号化ストアに保存され、各マシンの環境変数として注入される。**変更すると自動で再デプロイがトリガー**される(コードを再ビルドせずに新マシンで起動)。

`fly.toml` の `[env]` には**機密でない値だけ**書く(PORT, ENV, LOG_LEVEL)。DSN や DB URL は必ず secrets。

---

## 3. Next.js 16 / Tailwind v4 特有メモ

> 基本は知っている前提。**最近変わった点・最新固有の罠** だけメモ。
> 学習データの中心は Next 14 / Tailwind v3 / React 18 なので、ここから先は `frontend/node_modules/next/dist/docs/` と `frontend/node_modules/tailwindcss/` の内容を一次参照する運用にする(`frontend/AGENTS.md` の指示)。

### 3.0 Tailwind CSS v4 — 最大の落とし穴

`npx create-next-app@latest` は Tailwind v4 を入れる。v3 までの常識が**ほぼ全部変わった**:

| v3 | v4 |
|---|---|
| `@tailwind base; @tailwind components; @tailwind utilities;` | `@import "tailwindcss";` |
| `tailwind.config.ts` の `theme.extend.colors.*` | CSS の `@theme { --color-*: ... }` |
| `tailwind.config.js` 必須 | **既定では使わない**(無視される) |
| PostCSS plugin: `tailwindcss` | `@tailwindcss/postcss` |
| カラー命名: `colors: { primary: '#...' }` → `bg-primary` | `--color-primary: #...` → `bg-primary` |

ポイント:
- `@theme {}` に `--color-foo: value` を書くだけで `bg-foo` / `text-foo` / `border-foo` が自動生成
- `--font-foo: family` を書くと `font-foo` が自動生成(family のみ。weight は別途 `@layer utilities` 等で上乗せ)
- v3 のサンプルやチュートリアルをそのまま貼るとコンパイルは通るが**スタイルが何も当たらない**(無音の沈黙地獄)

SPLAI の `globals.css` は v4 形式で書いてある(Phase 0 計画書 Task 3 Step 1 を参照)。

### 3.1 React 19 ベース、Server Components がデフォルト
- `app/page.tsx` の関数は **デフォルトで Server Component**(サーバ側でレンダリング → HTML を返す)。
- `useState`, `useEffect`, `onClick` 等のクライアントフックを使うときだけファイル先頭に `'use client'` を書く。
- Phase 0 の `app/page.tsx`(Hello画面)は静的なので Server Component のまま。Sentry テストボタン(Task 16)を入れるときだけ `'use client'`。

### 3.2 `params` が Promise になった(Next 15 破壊的変更)
```ts
// Next 14 まで
export default function Page({ params }: { params: { id: string } }) {
  return <div>{params.id}</div>;
}

// Next 15+
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <div>{id}</div>;
}
```
`searchParams` も同様に Promise。Phase 1 で `/g/[uuid]` を作るときに必ずぶつかる。

### 3.3 `instrumentation.ts`
Next.js 15 では Sentry 公式推奨が **`instrumentation.ts`** に移行。
- 旧: `sentry.server.config.ts` を Next.js が自動 import
- 新: `instrumentation.ts` の `register()` から runtime に応じて import

```ts
// instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}
```
この `register()` は **アプリ起動時に 1 回だけ実行される**。古い記事だと `sentry.server.config` を直接置けと書いてあるが、Next 15 では上記が正(Phase 0 計画書通り)。

### 3.4 `next.config.ts`(`.js` → `.ts`)
Next 15 から TypeScript の設定ファイルが正式サポート。`next.config.js` でも動くが、型補完が効くので `.ts` 推奨。

### 3.5 Turbopack が dev / build とも既定
Next 16 では Turbopack が dev / build の両方で既定エンジン。`package.json` の `dev` script は単に `"next dev"` で OK(明示の `--turbopack` フラグは不要、むしろ古い)。
- Webpack より 5〜10倍速い(初回起動・HMR)
- 一部の古いプラグインで非互換なことあり(Sentry は対応済)
- 動作不審時のみ `next dev --webpack` で旧エンジンに退避できる

### 3.6 Route Handler vs Server Action
- **Route Handler** (`app/api/health/route.ts`): 従来の API Route 後継。外部から URL で叩くエンドポイント。
- **Server Action**: フォーム送信を関数として書く新機能。ブラウザからは呼べるが「URL」ではない。

Phase 0 の `/api/health` proxy は Route Handler。Backend FastAPI と通信するクライアント側のラッパとして使う。

### 3.7 axios インターセプタ vs fetch
本プロジェクトは axios 採用(`api-client.ts`)。Next.js 公式は `fetch` 推し(キャッシュ機能あり)だが、

- リクエストID 付与・エラー正規化・ログ出力は axios インターセプタの方が書きやすい
- Server Component で fetch、Client で axios と分けるのもアリ(Phase 1 で再考)

Phase 0 ではクライアント側の axios だけで十分。

### 3.8 環境変数の `NEXT_PUBLIC_` プレフィックス
- `NEXT_PUBLIC_API_BASE_URL`: ブラウザにも露出される(バンドル時に置換)
- それ以外: サーバ側のみ
- 露出させたくない値に `NEXT_PUBLIC_` を付けない(漏れる)

`SENTRY_DSN` を `NEXT_PUBLIC_SENTRY_DSN` にしているのはブラウザでも初期化するため(漏れて問題ない値)。

---

## 4. AI Agent 予習(Phase 3)

> Phase 0 では実装しない。Phase 3 着手時に再読する想定の予習メモ。

### 4.1 Tool Use(関数呼び出し)とは
LLM に「JSON で structured output を強制する」テクニック。
- LLM に「`register_payment` という関数があり、引数はこういう型だ」とスキーマで伝える
- LLM はテキスト返答する代わりに「この関数をこの引数で呼びたい」という JSON を返す
- アプリ側でそれを実行 → 結果を LLM に戻して会話続行

```python
# 設計書 §8.1 のツール定義(Phase 3 で実装)
class RegisterPaymentTool(BaseModel):
    payer_id: UUID
    amount: int
    description: str
    paid_at: datetime
    shares: list[PaymentShareInput]
```
ユーザー文「居酒屋Aで12000円、Bは1000円多め」→ LLM がこの構造化データを生成 → 確認画面で人間承認 → DB 書き込み。

### 4.2 Human-in-the-loop の意義
LLM の生成結果を**勝手に実行しない**。必ず確認 UI を挟む。理由:
- AI は推測で値を埋める(amount を間違える、人を取り違える)
- 金銭が絡む処理は誤りが致命的

→ Phase 3 のフローは「LLM がドラフト生成 → ユーザー承認 → 確定」。`ai_messages.tool_calls` に保存し、ユーザーが画面で確認できる状態にする。

### 4.3 SSE ストリーミング
LLM 応答を「生成しながら少しずつ画面に流す」(ChatGPT のあの体感)。
- HTTP の **Server-Sent Events** を使う(WebSocket より軽量、片方向で十分)
- FastAPI 側は `StreamingResponse` + generator
- Frontend は `EventSource` API(Next.js の Route Handler を proxy にする)

```python
# Phase 3 のイメージ
from fastapi.responses import StreamingResponse

@router.post("/api/ai/chat-payment")
async def chat(body: ChatRequest):
    async def gen():
        async for chunk in ibm_ca_stream(body.message):
            yield f"data: {json.dumps(chunk)}\n\n"
    return StreamingResponse(gen(), media_type="text/event-stream")
```
Phase 0 のミドルウェアが `BaseHTTPMiddleware` だと SSE で挙動が怪しいことがある(既述)。Phase 3 着手時に raw ASGI middleware への置き換えを検討する。

### 4.4 IBM Consulting Advantage API について
- 内部的に Claude Sonnet 4.6 を呼べる API ゲートウェイ
- 認証方式・レスポンス形式は IBM 独自(Anthropic 互換ではない)
- → Phase 3 で実 API 仕様を確認後、Adapter 層を 1 つ挟む(`app/ai/ibm_ca_client.py` 等)
- このプロジェクト構造により、将来 Anthropic 直接接続に切り替えるのも容易

### 4.5 `ai_conversations` / `ai_messages` の役割
- 会話履歴を Postgres に保存(セッション復元・監査・デバッグ)
- `role` を OpenAI 互換(`user`/`assistant`/`system`/`tool`)にしておくとプロバイダ切替が楽
- `tool_calls` を JSONB で持つことで構造化引数も保存できる

### 4.6 プロンプト設計の原則(設計書 §8.1 より)
- **メンバー一覧をシステムプロンプトに含める**(LLM に「誰がいるか」を教える)
- **曖昧情報は推測せず質問させる**(「Bさんって誰?」を生成させる)
- **ツール呼び出し前に必ず確認 UI**(Human-in-the-loop)

### 4.7 コスト管理
- `ai_usage_logs` で feature × token を記録
- `RateLimitExceeded` でグループ単位 50 req/day を強制(設計書 §9.1)
- LLM 呼び出しは I/O 重い → 必ず async + httpx
- in-memory LRU キャッシュ(設計書 §6.6)で同一入力の重複生成を抑止

---

## 5. 落とし穴チェックリスト

Phase 0 でハマりやすい順に列挙。実装中に行き詰まったらここを見る。

### Backend
- [ ] **FastAPI ハンドラの引数に型注釈を忘れる** → Request 等は型から判別されるため、注釈無しだとクエリパラメータ扱いになり 422。`def handler(request: Request):` のように必ず注釈する
- [ ] **`logging.basicConfig` が pytest で no-op 化** → `capsys` が空、JSONDecodeError。`force=True` を付ける(本番でも冪等で副作用なし)
- [ ] **`async def` 内で `await` し忘れ** → コルーチン警告 → 関数が動いていない
- [ ] **`uv run` を付けずに `pytest` を打つ** → グローバル Python が走り依存が見つからない
- [ ] **Pydantic v2 で `.dict()` を使う** → AttributeError → `.model_dump()` に
- [ ] **Supabase URL の `postgresql://` を `postgresql+asyncpg://` に書き換え忘れ** → ドライバが見つからないエラー
- [ ] **Supabase Direct Connection(IPv6 only)を IPv6 未対応回線から使う** → `socket.gaierror: nodename nor servname provided`。Session Pooler(`aws-0-<region>.pooler.supabase.com:5432`)に切り替える。ユーザー名は `postgres.<ref>` 形式
- [ ] **`add_middleware` の順序逆** → 期待した「外側」が「内側」になっている
- [ ] **`@app.exception_handler(Exception)` を先に登録** → specific ハンドラが呼ばれない
- [ ] **CORS の `expose_headers` 忘れ** → axios で `X-Request-Id` が読めない
- [ ] **Alembic `env.py` で `Base.metadata` を import 忘れ** → autogenerate が空マイグレを吐く
- [ ] **`.env` を git にコミット** → secret 漏洩。`.gitignore` を最初に書く理由がこれ
- [ ] **Fly.io secrets を `[env]` に書く** → 機密がリポに残る。secrets コマンド経由で

### Frontend
- [ ] **`vitest.config.ts` で `@vitejs/plugin-react` の `react()` を渡すと `npm run build` で型エラー** → vitest 内部 vite と外側 vite の Plugin 型が不一致。`tsconfig.json` の `exclude` に `"vitest.config.ts"` を追加する(vitest はそれを参照しないので影響なし)
- [ ] **Tailwind v4 で `@tailwind base/components/utilities` を書く** → エラーは出ないがスタイルが何も当たらない。`@import "tailwindcss";` に置き換える
- [ ] **Tailwind v3 のチュートリアル通り `tailwind.config.ts` を作る** → v4 では既定で読まれず無効。`@theme {}` に書き直す
- [ ] **`@theme` の `--font-jp-display` だけで weight も付くと思い込む** → font-family のみ。weight は `@layer utilities` で別途指定
- [ ] **`'use client'` を書き忘れて hooks 使用** → ビルドエラー
- [ ] **Next 15 の `params` を Promise にせずアクセス** → undefined になる
- [ ] **`NEXT_PUBLIC_` を付けずに `process.env.X` をクライアントで参照** → undefined
- [ ] **Sentry DSN を `.env.local` に入れ忘れ** → エラーが届かない(本番デプロイ後に気づく)
- [ ] **`.env.local` を作成・更新した後に dev server を再起動していない** → 古い env が `.next/` にバンドル済みで ZodError が消えない。`Ctrl+C` → `rm -rf .next` → `npm run dev` で完全リスタート
- [ ] **`vercel link` 後に `.vercel/` をコミット** → 個人情報が残る(`.gitignore` 推奨)

### 観測 & デバッグ
- [ ] **ログに API キー/プロンプト本文がそのまま出ている** → マスキング processor 動いてない
- [ ] **request_id が Frontend と Backend で別々** → axios interceptor が `X-Request-Id` を送っていない
- [ ] **Sentry 開発環境のノイズ** → `environment` を分け、開発 DSN を分ける選択肢も

### CI / デプロイ
- [ ] **GitHub Actions で `npm ci` が失敗** → ローカルで `npm install` してから `package-lock.json` を commit する
- [ ] **`flyctl deploy` で `uv.lock` 不整合** → Dockerfile が `--frozen` だと古い lock で落ちる。ローカル sync 後に commit
- [ ] **CORS エラー(本番)** → `flyctl secrets set CORS_ORIGINS=...` を Vercel 本番ドメインに合わせて更新

---

## 付録: 学習リソース

- **FastAPI 公式チュートリアル**: https://fastapi.tiangolo.com/tutorial/ — まず一周流し読み推奨
- **Pydantic v2 移行ガイド**: https://docs.pydantic.dev/latest/migration/
- **SQLAlchemy 2.0 公式 Tutorial**: https://docs.sqlalchemy.org/en/20/tutorial/
- **structlog**: https://www.structlog.org/en/stable/
- **Next.js 15 アップグレードガイド**: https://nextjs.org/docs/app/guides/upgrading/version-15
- **Anthropic Tool Use(Phase 3 用)**: https://docs.anthropic.com/en/docs/build-with-claude/tool-use

---

> 本ガイドは Phase 0 着手時点のスナップショット。実装中に「ここで詰まった」「この説明では足りない」が出たら都度追記する想定。
