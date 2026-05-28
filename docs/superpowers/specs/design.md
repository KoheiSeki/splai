# SPLAI(スプライ) 設計書

- アプリ名: **SPLAI** (`/splaɪ/` — split + AI)
- 作成日: 2026-05-24
- ステータス: ドラフト(レビュー待ち)
- 対象: MVP リリース

---

## 1. コンセプトと差別化

### コンセプト
> **「URLを共有するだけ、レシートを撮るだけ、AIが面倒を全部やる割り勘アプリ」**

### 既存サービス(Wallica等)に対する差別化
1. **AIによる入力摩擦の最小化**: レシートOCR・自然文/チャット入力で「誰が何をいくら払ったか」を最小操作で記録
2. **共有体験の磨き込み**: Web Share API・LINE専用共有・動的OGP・QRコード・AIメッセージ生成
3. **清算の自動最適化**: 貪欲法による最少送金回数化 + AI による解説文
4. **ログイン不要**: URL ベースのカジュアルアクセス(Wallica方式を継承)

### 非ゴール(MVPでやらないこと)
- ユーザー認証(SNS/メール)
- 通知機能(Push/メール)
- 多通貨対応(JPY 固定)
- 銀行口座連携・送金実行
- 履歴のエクスポート(CSV等)
- 共有後アクセス可視化(後フェーズ検討)

---

## 2. 認可モデル(MVP)

### 方針: Security through Obscurity(Wallica方式)
- グループURL に UUIDv4 を含める(`/g/{uuid}`、推測困難性で守る)
- ログイン不要、Cookie ベースの認証も導入しない
- リスクは受容し、後フェーズで段階的に強化(PIN、デバイス紐付け等)

### メンバー識別
- 初回アクセス時に「あなたは誰?」を選択(ハイブリッド方式: 作成時に登録 + 後から追加可)
- 選択結果を `localStorage.setItem('g_${group_id}', member_id)` で保存
- 全 API 呼び出し時に `X-Member-Id` ヘッダで送信、FastAPI が `group_id` との整合性を検証

---

## 3. アーキテクチャ

### 全体構成
```
┌─────────────────┐         ┌──────────────────┐
│  Next.js (App)  │  HTTPS  │  FastAPI Backend │
│   on Vercel     │◄───────►│  on Fly.io       │
│                 │         │                  │
│ - UI/UX         │         │ - ビジネスロジック    │
│ - 動的OGP生成    │         │ - AI呼び出し中継     │
│ - QRコード描画   │         │ - 清算最適化ロジック  │
│ - Web Share API │         │ - 認可ミドルウェア    │
└─────────────────┘         └──────┬───────────┘
                                   │
                  ┌────────────────┼────────────────┐
                  ▼                ▼                ▼
           ┌───────────┐   ┌────────────┐   ┌──────────────┐
           │ Supabase  │   │  IBM CA    │   │ GCP Vision   │
           │ Postgres  │   │  API       │   │ API          │
           │ + Storage │   │ (Sonnet 4.6)│   │              │
           └───────────┘   └────────────┘   └──────────────┘
```

### 役割分担

| 層 | 主担当 |
|---|---|
| Next.js | UI、動的OGP、QR描画、共有体験 |
| FastAPI | ビジネスロジック、AI中継、認可、清算最適化 |
| Supabase | データ永続化、レシート画像一時保存 |
| IBM CA API | チャット入力解析、文章生成、清算解説 |
| GCP Vision API | レシートOCR |

---

## 4. 技術スタック

| 層 | 技術 |
|---|---|
| Frontend | Next.js (App Router) + Vercel |
| Frontend Schema | Zod |
| HTTP Client | axios |
| Backend | FastAPI + Pydantic |
| Backend Hosting | Fly.io |
| ORM | SQLAlchemy + Alembic |
| DB / Storage | Supabase PostgreSQL + Supabase Storage |
| AI(チャット/文章) | IBM Consulting Advantage API → Claude Sonnet 4.6 |
| OCR | GCP Vision API |
| QR | Frontend 生成(`qrcode` 等) |
| 監視・エラートラッキング | Sentry + Vercel Analytics |
| 定期ジョブ | Supabase Scheduled Functions |
| ロギング(Backend) | structlog(構造化ログ) |
| スキーマ生成 | OpenAPI → Zod 自動生成(`openapi-zod-client` 等) |

### 設計判断ノート
- **Supabase Auth は使わない**: FastAPI がゲートキーパーとなり、Service Role Key で全 DB アクセスを実施。RLS 不使用、アプリ層で認可制御。
- **OCR は GCP Vision API 専用**: コストと精度のバランス。Adapter は導入せず、シンプルに統合。
- **AI Provider 抽象化は MVP 段階では非対応**: IBM CA に直接依存。フォールバックは後フェーズで検討。

---

## 5. データモデル

### ER 概念図
```
groups ──┬── members
         │
         ├── payments ── payment_shares ── members
         │
         ├── ai_conversations ── ai_messages
         │
         ├── ocr_jobs
         │
         └── ai_usage_logs
```

### テーブル定義

#### `groups`
| カラム | 型 | 説明 |
|---|---|---|
| id | UUID PK | グループ識別子(URL に使用) |
| name | TEXT | グループ名 |
| event_date | DATE NULL | イベント日(任意) |
| currency | TEXT default 'JPY' | 通貨(将来拡張) |
| created_at | TIMESTAMPTZ | |
| deleted_at | TIMESTAMPTZ NULL | 論理削除 |

#### `members`
| カラム | 型 | 説明 |
|---|---|---|
| id | UUID PK | |
| group_id | UUID FK | |
| name | TEXT | 表示名 |
| created_at | TIMESTAMPTZ | |

#### `payments`
| カラム | 型 | 説明 |
|---|---|---|
| id | UUID PK | |
| group_id | UUID FK | |
| payer_id | UUID FK → members | 支払者 |
| amount | INTEGER | JPY は整数で保持 |
| description | TEXT | |
| paid_at | TIMESTAMPTZ | |
| source | ENUM('manual','ocr','chat') | 入力経路 |
| ocr_image_path | TEXT NULL | Supabase Storage パス |
| created_at | TIMESTAMPTZ | |
| deleted_at | TIMESTAMPTZ NULL | 論理削除 |

#### `payment_shares`
| カラム | 型 | 説明 |
|---|---|---|
| id | UUID PK | |
| payment_id | UUID FK | |
| member_id | UUID FK | |
| share_type | ENUM('equal','ratio','amount') | 等分/比率/金額指定 |
| share_value | NUMERIC | share_type に応じた値 |

#### `ai_conversations`
| カラム | 型 | 説明 |
|---|---|---|
| id | UUID PK | |
| group_id | UUID FK | |
| member_id | UUID FK NULL | 開始したメンバー |
| purpose | ENUM('payment_input','message_gen','settlement_explain') | |
| status | ENUM('active','completed','aborted') | |
| created_at / updated_at | TIMESTAMPTZ | |

#### `ai_messages`
| カラム | 型 | 説明 |
|---|---|---|
| id | UUID PK | |
| conversation_id | UUID FK | |
| role | ENUM('user','assistant','system','tool') | OpenAI 互換 |
| content | TEXT | |
| tool_calls | JSONB NULL | tool/function call 情報 |
| created_at | TIMESTAMPTZ | |

#### `ocr_jobs`
| カラム | 型 | 説明 |
|---|---|---|
| id | UUID PK | |
| group_id | UUID FK | |
| image_path | TEXT | Supabase Storage パス |
| provider | ENUM('gcp_vision') | MVP では `gcp_vision` 固定 |
| status | ENUM('pending','processing','succeeded','failed') | |
| result_json | JSONB NULL | 構造化結果(品目・金額・店名等) |
| payment_id | UUID FK NULL | 確定後にひも付く |
| error_message | TEXT NULL | |
| created_at / completed_at | TIMESTAMPTZ | |

#### `ai_usage_logs`
| カラム | 型 | 説明 |
|---|---|---|
| id | UUID PK | |
| group_id | UUID FK NULL | |
| feature | ENUM('chat_input','ocr','message_gen','settlement_explain') | |
| provider | TEXT | 'ibm_ca' / 'gcp_vision' 等 |
| model | TEXT | 'claude-sonnet-4-6' 等 |
| input_tokens / output_tokens | INTEGER | |
| latency_ms | INTEGER | |
| success | BOOLEAN | |
| client_ip_hash | TEXT | SHA256 ハッシュ |
| created_at | TIMESTAMPTZ | |

### インデックス
- `members(group_id)`
- `payments(group_id, deleted_at)`
- `payment_shares(payment_id)`
- `ai_messages(conversation_id, created_at)`
- `ocr_jobs(group_id, status)`
- `ai_usage_logs(group_id, feature, created_at)`

### データ保持ポリシー
- グループは作成から **180日** 無アクセスで自動削除
- レシート画像は `payments` 確定から **24時間** で自動削除

---

## 6. 主要ユーザーフロー

### 6.1 グループ作成
1. ユーザーがグループ名・日付・メンバーを入力
2. `POST /api/groups` → groups + members を作成
3. 作成者の member_id を localStorage に保存
4. `/g/{uuid}/share` 画面に遷移

### 6.2 URL 共有(差別化の核)
共有画面で以下を提供:
- 編集可能なメッセージテンプレート
- LINE 直接共有ボタン(`https://line.me/R/share?text=...`)
- Web Share API による OS ネイティブ共有メニュー
- QR コード表示
- ワンタップコピー
- AI によるトーン変換(カジュアル/フォーマル/絵文字多め)
- 動的 OGP 画像(LINE トーク内でリッチプレビュー)

### 6.3 メンバー初回アクセス
1. `/g/{uuid}` にアクセス
2. localStorage に `g_{group_id}` が無い場合、メンバー選択モーダル表示
3. 既存メンバー選択 or 新メンバー追加
4. localStorage に member_id を保存し、メイン画面へ

### 6.4 支払い入力(3経路)

#### 6.4.1 手動入力
シンプルなフォーム: 支払者・金額・内容・分担方法・日時。

#### 6.4.2 レシート OCR(非同期)
1. 画像撮影 → POST 送信
2. Backend が Storage にアップロード、`ocr_jobs` に登録、即 job_id 返却
3. Backend が非同期で GCP Vision API を呼び出し
4. Frontend は 2秒間隔でポーリング(最大 30秒)
5. 結果を確認画面で編集可能な状態で提示
6. ユーザー確定で `payments` 作成、画像は 24時間後削除

#### 6.4.3 AI チャット入力
1. ユーザーが自然文で入力(例: 「居酒屋Aで12000円、Bは1000円多め」)
2. IBM CA Sonnet 4.6 が Tool Use(`register_payment`)で構造化
3. AI が確認画面相当の内容を返答
4. ユーザー承認(Human-in-the-loop)で `payments` 作成
5. 会話履歴は `ai_conversations` + `ai_messages` に保存

### 6.5 一覧表示・編集
- 支払い一覧表示、編集・削除は誰でも可能(MVPは信頼ベース)
- 削除は `deleted_at` による論理削除

### 6.6 清算結果と AI 解説
1. FastAPI が貪欲法で最少送金回数を算出
2. 清算結果を IBM CA Sonnet 4.6 に渡し、200文字以内の解説文を生成
3. プロセス内 in-memory キャッシュ(payments の updated_at + memberリストをキー、最大100件、LRU)で重複生成を抑止
4. 「LINE で送る」ボタンで結果と URL を共有

---

## 7. API 設計

### エンドポイント一覧

| Method | Path | 用途 |
|---|---|---|
| POST | /api/groups | グループ作成 |
| GET | /api/groups/{id} | グループ情報+メンバー+支払い一覧取得 |
| POST | /api/groups/{id}/members | メンバー追加 |
| POST | /api/groups/{id}/payments | 支払い登録 |
| PATCH | /api/payments/{id} | 支払い編集 |
| DELETE | /api/payments/{id} | 支払い論理削除 |
| GET | /api/groups/{id}/settlement | 清算結果(貪欲法 + AI解説) |
| POST | /api/ocr/upload | レシート画像アップロード→ジョブ作成 |
| GET | /api/ocr-jobs/{id} | OCR ジョブ状態確認 |
| POST | /api/ai/chat-payment | AIチャット入力(SSEストリーミング) |
| POST | /api/ai/rewrite-share-message | 共有メッセージのトーン変換 |

### 共通仕様
- `POST /api/groups` を **除く** 全エンドポイントで `X-Member-Id` ヘッダ要求(group_id との整合性を検証)
  - 例外理由: グループ作成時はまだ member が存在しないため
  - グループ作成のレスポンスで返される creator_member_id をフロントが localStorage に保存し、以降のリクエストに付与する
- 全エンドポイントで `X-Request-Id` ヘッダを尊重(無ければバックエンドで生成)
- レスポンスは Pydantic モデル → OpenAPI スキーマ → Zod 自動生成
- エラーレスポンスは RFC 7807(Problem Details)形式に統一

---

## 8. AI 機能の詳細

### 8.1 チャット入力(Tool Use)

`register_payment` ツールを定義し、AI が構造化データを生成:

```python
class PaymentShareInput(BaseModel):
    member_id: UUID
    share_type: Literal["equal", "ratio", "amount"]
    share_value: float

class RegisterPaymentTool(BaseModel):
    payer_id: UUID
    amount: int
    description: str
    paid_at: datetime
    shares: list[PaymentShareInput]
```

**プロンプト方針**:
- グループのメンバー一覧をコンテキストに含める
- 曖昧な情報があれば必ずユーザーに質問(勝手な推測を禁止)
- 確定前に必ずツール呼び出しでドラフトを提示し、人間に承認を求める

### 8.2 共有メッセージのトーン変換
`tone` enum: `casual` / `formal` / `emoji_heavy`。URL は変更せず、文体のみ書き直し。

### 8.3 清算結果の AI 解説
- 入力: 清算結果(送金リスト) + 元の支払い履歴
- 出力: 200文字以内の自然文
- 同一入力に対するプロセス内 in-memory キャッシュを実装(LRU、最大100件)

---

## 9. 非機能要件

### 9.1 レート制限

| 対象 | 制限 | 実装 |
|---|---|---|
| IP単位(全API) | 60 req/min | FastAPI ミドルウェア(slowapi 等) |
| グループ単位 AI 機能 | 50 req/day | `ai_usage_logs` を集計 |
| OCR アップロード | 10 req/hour/group | `ocr_jobs` を集計 |
| 画像サイズ | 10MB 上限 | アップロード時バリデーション |

レート超過時は `429 Too Many Requests` + Problem Details で返却。

### 9.2 エラーハンドリング戦略

#### Frontend
- **HTTP クライアント**: axios 統合
- **インターセプタ**:
  - リクエスト: `X-Request-Id`(uuidv4)を付与、リクエストログ出力
  - レスポンス: レスポンスログ出力、4xx/5xx の正規化
- **エラーハンドリング**:
  - Promise 系: カスタム hook(例: `useApi`)で catch、トースト通知
  - レンダリング系: `ErrorBoundary` コンポーネント + Sentry の `Sentry.ErrorBoundary` で全画面と画面単位の二段構え
- **ログ出力先**: 開発環境はコンソール、本番は Sentry

#### Backend
- **ロギング**: `structlog` で JSON 構造化ログ
- **Middleware 層**:
  - リクエスト/レスポンスログ(機微情報マスク済み)
  - 相関ID(`X-Request-Id`)伝播: ヘッダから読み取り、無ければ UUIDv4 で新規生成、`request.state.request_id` にセット、レスポンスヘッダにも返却
- **Global Exception Handler**:
  - 全例外を catch
  - RFC 7807 Problem Details 形式でレスポンスボディ生成
  - 構造化ログ出力 + Sentry に送信
- **カスタム例外クラス**: `GroupNotFound`, `MemberMismatch`, `RateLimitExceeded`, `OCRFailed`, `AIProviderError` 等を定義し、Handler で適切な HTTP ステータスへマッピング

#### 機微情報マスキング(必須)
ログ出力時に以下を必ずマスク:
- HTTPヘッダの `Authorization`, `X-API-Key`(IBM CA, GCP キー等)
- レシート画像のバイト列(画像はパスのみ記録)
- AIへのプロンプト本文(metadata のみ記録)
- `ai_messages.content` を直接ログに出さない

### 9.3 障害時の挙動

| カテゴリ | 対策 |
|---|---|
| AI API 失敗 | 1回リトライ → 失敗時はユーザーに「手動入力へ切替」を促す |
| OCR 失敗 | エラー画面 + 「再試行/手動入力」ボタン、`ocr_jobs.error_message` に保存 |
| DB 接続失敗 | SQLAlchemy リトライ機構 + 503 返却 |
| グループ未存在 | 404 + 「URL が無効です」画面 |
| メンバーID 不整合 | 401 → メンバー再選択モーダル表示 |
| 画像アップロード失敗 | フロント側でリトライ最大2回、それでも失敗ならユーザーに通知 |

### 9.4 環境変数

#### Frontend (Next.js)
- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_APP_URL`
- `SENTRY_DSN`

#### Backend (FastAPI)
- `DATABASE_URL`
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `IBM_CA_API_KEY`, `IBM_CA_BASE_URL`
- `GCP_VISION_CREDENTIALS_JSON`
- `SENTRY_DSN`

---

## 10. テスト戦略

| レイヤ | 内容 | ツール |
|---|---|---|
| Backend Unit | 清算最適化アルゴリズム、Pydantic バリデーション | pytest |
| Backend Integration | API → DB の E2E、テスト用 Postgres | pytest + httpx |
| Frontend Unit | コンポーネント、Zod スキーマ | Vitest + Testing Library |
| E2E | グループ作成 → URL共有 → メンバー参加 → 支払い → 清算 | Playwright |
| AI 機能 | プロンプトに対する期待動作のスナップショット | pytest + 録画レスポンス(VCR) |

### TDD 適用範囲
- **必須**: 清算最適化アルゴリズム(計算ロジック)、API 認可ロジック(セキュリティ)
- **任意**: AI 機能はスモークテストのみ(完全な TDD は過剰)

---

## 11. 開発フェーズ

| Phase | 内容 | 期間目安 |
|---|---|---|
| 0. セットアップ | プロジェクト初期化、CI/CD、Supabase 接続、デプロイ確認 | 3日 |
| 1. コア機能 | グループ作成・メンバー登録・手動支払い・一覧表示・清算(貪欲法) | 1週間 |
| 2. URL共有体験 | Web Share API、LINE共有、QR、メッセージテンプレ、動的OGP | 4日 |
| 3. AI機能 | チャット入力、AIメッセージ生成、清算解説 | 1週間 |
| 4. OCR | GCP Vision 統合、非同期ジョブ、確認画面 | 4日 |
| 5. 仕上げ | エラー処理、レート制限、Sentry 統合、E2E テスト | 4日 |

合計: **約4〜5週間**(個人開発、フルタイム想定)

---

## 12. ブランドアイデンティティ

詳細は `docs/design/splai-brand-identity.html` を一次資料とする。本章はその要約。

### 12.1 ネーミング
- **SPLAI** (`/splaɪ/`、スプライ)
- 由来: **SPL** + **AI** — AI が機能ではなくブランドの心臓部であることを5文字で宣言
- ロゴ表記: `SPL[AI].` — `AI` の二文字は常にシグナルレッドでハイライト
- ドメイン候補: `splai.app`

### 12.2 美学方向
**Japanese 90s Tech Magazine** — Wired Japan / Studio Voice / AXIS の系譜。
- 強いグリッドと水平罫線
- 太いゴシック+赤アクセント
- 情報密度と余白のコントラスト
- 紙の質感(粒子感)を背景に

### 12.3 配色

| トークン | HEX | 役割 |
|---|---|---|
| `--ink` | `#0A0A0A` | 本文、見出し、罫線(主役) |
| `--paper` | `#F4F1E8` | 背景(和紙的なクリーム) |
| `--red` | `#E8000C` | **AIが動いている瞬間にのみ使用**、強調、エラー |
| `--rule-grey` | `#CFD0CC` | 補助線、キャプション、無効状態 |

> **ルール**: `--red` は乱用しない。AI 機能(チャット入力、OCR処理中、AI解説生成、入力中インジケータ)が **動作している瞬間のみ** に発色させる。これにより UI 上で「AI が今働いている」が視覚的に伝わる。

### 12.4 タイポグラフィシステム

| 役割 | フォント | 用途 |
|---|---|---|
| Display / EN | **Archivo Black** | ロゴ、最大級の見出し |
| Display / JP | **Noto Sans JP 900** | 日本語見出し |
| Editorial | **Shippori Mincho 700** | 引用、リード文、感情を載せる箇所 |
| Body / Tech | **IBM Plex Mono** | URL、メタ情報、計算結果(信頼の担保) |

### 12.5 Voice & Tone

#### DO
- 体言止め・短文(「割り勘、終わってます。」)
- 会話の続きとして書く(「Bさんは唐揚げ多めだったから、+¥500ね」)
- AI の働きは事実として淡々と報告(「AI が3回の送金で済む組み合わせを見つけました」)

#### DON'T
- 大仰な煽り、絵文字濫用(「革新的な AI ✨ が…!」)
- モデル名を売りにしない(「Powered by GPT」のような表記は避ける)
- 抽象的な比較級の連打(「より速く、よりスマートに」)

### 12.6 デザイン原則
1. **余白で語る** — 情報密度はあるが、要所にしっかり呼吸を入れる
2. **赤は AI が動いている時だけ** — 視覚的な状態通信
3. **Mono は計算結果の信頼を担う** — 数字・URL・コードは必ずモノスペース

---

## 13. 後フェーズで検討する項目

- 通知機能(LINE Bot連携、メール、Push)
- 共有後のアクセス可視化(誰が未読か)
- リマインドメッセージ自動生成
- セキュリティ強化(任意PIN、デバイス紐付け、メンバー個別URL)
- 多通貨対応・旅行モード
- 履歴エクスポート(CSV、画像、PDF)
- AI Provider 抽象化(IBM CA フォールバック)
- 既存パターンからの予測(「いつものメンバー」)
- 厳密最適化(最小コストフロー)への切替

---

## 付録 A: 清算最適化(貪欲法)疑似コード

```python
def settle(net_balances: dict[member_id, int]) -> list[Transfer]:
    """
    net_balances: 各メンバーのネット収支(プラス=受け取る、マイナス=払う)
    返り値: 最少送金リスト
    """
    creditors = [(m, b) for m, b in net_balances.items() if b > 0]
    debtors = [(m, b) for m, b in net_balances.items() if b < 0]
    creditors.sort(key=lambda x: -x[1])  # 受取額が大きい順
    debtors.sort(key=lambda x: x[1])     # 支払額が大きい順

    transfers = []
    i, j = 0, 0
    while i < len(debtors) and j < len(creditors):
        debtor_id, debt = debtors[i]
        creditor_id, credit = creditors[j]
        amount = min(-debt, credit)
        transfers.append(Transfer(from_=debtor_id, to=creditor_id, amount=amount))
        debtors[i] = (debtor_id, debt + amount)
        creditors[j] = (creditor_id, credit - amount)
        if debtors[i][1] == 0:
            i += 1
        if creditors[j][1] == 0:
            j += 1
    return transfers
```

---

## 付録 B: 動的 OGP 画像仕様

- サイズ: 1200 x 630 px
- 内容: グループ名・イベント日・人数・サービスロゴ
- 実装: Next.js の `ImageResponse`(Edge Runtime)で動的生成
- URL: `/api/og?group_id=xxx`
- HTML の `<meta property="og:image">` で参照
