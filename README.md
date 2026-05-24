# SPLAI 実装計画 — フェーズ一覧

各フェーズは独立してデモ可能な単位として設計されています。
実装は別リポジトリ(後日作成)で行い、本ディレクトリの計画書を実装担当者が参照します。

---

## アジャイル運用方針

- **Just-In-Time 計画**: 着手中・次着手のフェーズのみ詳細化。先のフェーズは概要(本ファイル)に留める。
- **フェーズ完了 = 動作するソフトウェア**: 各フェーズ終了時に、デプロイ済みかつエンドツーエンドで動作するプロダクトが必ず存在する。
- **計画の進化**: 実装中の発見・変更は計画書 / 設計書に反映してから次工程へ進む(計画と実装の同期)。

---

## フェーズ一覧

| Phase | テーマ | 期間目安 | 状態 | 詳細計画 |
|---|---|---|---|---|
| **0** | Project Setup & Deployment Pipeline | 3日 | 📝 計画作成中 | [`2026-05-24-phase-0-setup.md`](./2026-05-24-phase-0-setup.md) |
| **1** | Core Features | 1週間 | 🔒 未着手 | (Phase 0 完了後に詳細化) |
| **2** | Share Experience | 4日 | 🔒 未着手 | (Phase 1 完了後に詳細化) |
| **3** | AI Features | 1週間 | 🔒 未着手 | (Phase 2 完了後に詳細化) |
| **4** | OCR Integration | 4日 | 🔒 未着手 | (Phase 3 完了後に詳細化) |
| **5** | Hardening & Launch | 4日 | 🔒 未着手 | (Phase 4 完了後に詳細化) |

合計: 約4〜5週間(個人開発、フルタイム想定)

---

## 各フェーズの完了条件(Definition of Done)

### Phase 0: Project Setup & Deployment Pipeline
**ゴール**: 「Hello World」レベルでも、Frontend と Backend がそれぞれ Vercel と Fly.io にデプロイされ、相互通信できる状態。

**Definition of Done:**
- [ ] 別リポジトリ `splai-app`(仮)が作成され、初期コミット完了
- [ ] Frontend(Next.js) が Vercel にデプロイされ、ブランドカラー/フォントが適用された Hello画面 が表示される
- [ ] Backend(FastAPI) が Fly.io にデプロイされ、`/health` エンドポイントが応答する
- [ ] Frontend から Backend に CORS 越しでリクエストが通る
- [ ] Supabase プロジェクトが作成され、Backend から PostgreSQL に接続できる
- [ ] Alembic で初期マイグレーション(空)が実行できる
- [ ] Sentry が Frontend / Backend 両方に組み込まれ、エラーが Sentry に届く
- [ ] GitHub Actions で PR 時に lint/test が走る
- [ ] structlog による JSON ログが Backend で出力される
- [ ] X-Request-Id ミドルウェアが動作している
- [ ] Global Exception Handler が RFC 7807 形式でエラーを返す

---

### Phase 1: Core Features
**ゴール**: ログイン無しでグループを作り、メンバーを追加し、支払いを手動入力し、清算結果(貪欲法)を見られる。

**Definition of Done:**
- [ ] グループ作成(`POST /api/groups`)
- [ ] メンバー登録(作成時 + 後追加)
- [ ] 手動支払い登録(`POST /api/groups/{id}/payments`)
- [ ] 支払い編集・論理削除
- [ ] 支払い一覧表示
- [ ] 清算結果計算(貪欲法)と表示
- [ ] X-Member-Id 認可ミドルウェア
- [ ] localStorage によるメンバー識別
- [ ] グループURL(`/g/{uuid}`)経由でのアクセス
- [ ] Zod / Pydantic スキーマと OpenAPI → Zod 自動生成パイプライン

---

### Phase 2: Share Experience
**ゴール**: グループ URL を最も気持ちよく共有できる体験を実装。

**Definition of Done:**
- [ ] 共有画面 UI (メッセージプレビュー、編集可能)
- [ ] Web Share API 統合(モバイルOSネイティブ共有メニュー)
- [ ] LINE専用共有ボタン(`https://line.me/R/share?text=...`)
- [ ] QRコード生成(クライアントサイド)
- [ ] ワンタップコピー(成功フィードバック付き)
- [ ] 動的OGP画像生成(Next.js ImageResponse)
- [ ] LINE トーク内リッチプレビュー確認

---

### Phase 3: AI Features
**ゴール**: AI チャット入力で支払いを登録し、清算結果に AI 解説文が付く。

**Definition of Done:**
- [ ] IBM Consulting Advantage API クライアントの実装
- [ ] AIチャット入力(`POST /api/ai/chat-payment`、SSE ストリーミング)
- [ ] Tool Use (`register_payment`) の実装
- [ ] 確認画面(Human-in-the-loop)
- [ ] `ai_conversations` / `ai_messages` 永続化
- [ ] AIによる共有メッセージのトーン変換
- [ ] 清算結果の AI 解説生成(in-memory LRUキャッシュ)
- [ ] `ai_usage_logs` 記録(レート制限基盤)

---

### Phase 4: OCR Integration
**ゴール**: レシート画像から支払いを自動登録できる。

**Definition of Done:**
- [ ] 画像アップロード UI(撮影 / ファイル選択)
- [ ] Supabase Storage 連携(TTL付き)
- [ ] GCP Vision API クライアント
- [ ] 非同期 OCR ジョブ(`ocr_jobs` テーブル + ポーリング)
- [ ] 確認画面(編集可能な状態で結果プレビュー)
- [ ] 失敗時のリトライ / 手動入力フォールバック
- [ ] 24時間後の画像自動削除(Supabase Scheduled Functions)

---

### Phase 5: Hardening & Launch
**ゴール**: 本番運用に耐える品質に仕上げ、初回ユーザーに使ってもらえる状態。

**Definition of Done:**
- [ ] レート制限(IP / グループ / OCR / 画像サイズ)
- [ ] エラーハンドリング各種(設計書 9.3 表)
- [ ] ErrorBoundary(Frontend)
- [ ] 機微情報マスキング検証(structlog)
- [ ] E2E テスト(Playwright、コアシナリオ)
- [ ] Vercel Analytics 設定
- [ ] 180日無アクセスグループの自動削除ジョブ
- [ ] 初回ユーザー(自分 + 友人2〜3名)に試してもらいフィードバック収集

---

## 計画書の書式

各フェーズ計画書は以下の構造で作成します:

```markdown
# Phase N: [テーマ] Implementation Plan

> For agentic workers: REQUIRED SUB-SKILL: superpowers:subagent-driven-development...

**Goal:** [1文]
**Architecture:** [2-3文]
**Tech Stack:** [このフェーズで使う技術]

---

## File Structure
[このフェーズで触るファイルの一覧と責務]

---

## Tasks

### Task 1: [Component Name]
**Files:** Create / Modify / Test の具体パス
- [ ] Step 1: 失敗するテストを書く(完全コード)
- [ ] Step 2: テストを実行して失敗を確認(コマンド + 期待出力)
- [ ] Step 3: 最小実装(完全コード)
- [ ] Step 4: テストを実行してPASS確認
- [ ] Step 5: コミット(具体メッセージ)
```

詳細は [superpowers:writing-plans](https://github.com/anthropics/superpowers) のガイドラインに従う。
