# Phase 2: Share Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** グループ作成 → URL を仲間に共有 → ワンタップで参加 のフローを完成させる。Web Share API・LINE 共有・QR・動的 OGP 画像で「割り勘やろう」を 1 メッセージで起動できる UX を提供し、SPLAI のコア体験(Phase 1 で作った 1 グループ内の入力 → 清算)を **複数人の自然な利用**につなげる。

**Architecture:** Phase 1 の `/g/[uuid]` dashboard に **share feature(独立スライス)** を追加。Backend 変更なし、frontend のみで完結する機能フェーズ。Next.js 16 の `opengraph-image.tsx` convention で SSR の OGP 画像を生成し、ブランドガイド(`docs/design/splai-brand-identity.html`)§12 に沿って ink + paper 配色 + Archivo Black / Noto Sans JP のタイポグラフィを返す。**`--red` は使わない**(設計書 §12.3、AI 動作中以外で使用禁止のルール)。

**Tech Stack:** Next.js 16 App Router(`opengraph-image.tsx` / `generateMetadata` / `next/og` `ImageResponse`)、`qrcode` パッケージ、Web Share API + Clipboard API fallback、LINE Social Plugin URL(`social-plugins.line.me/lineit/share`)、**lefthook**(pre-commit hook で format/lint を CI 前に強制)。

---

## 前提条件

- **Phase 1 が完了済み**(Task 22 DoD 全 13 項目グリーン、main / develop が Branch Protection 有効、本番 deploy 済み)
- 作業は **`feature/phase-2-share-experience`** ブランチで行い、develop に PR
- Vercel 本番に `NEXT_PUBLIC_API_BASE_URL` と `NEXT_PUBLIC_APP_URL` が設定済(Task 1 で値の正当性を検証する)

## 開始前の準備

```bash
cd /Users/koheiseki/dev/git/splai
git checkout develop
git pull --rebase origin develop
git checkout -b feature/phase-2-share-experience
```

---

## File Structure

このフェーズで追加・変更されるファイル:

```
splai/
├── lefthook.yml                                          ← Task 2(新規、pre-commit hook 設定)
├── frontend/
│   ├── app/g/[uuid]/
│   │   ├── page.tsx                                      ← Modify(generateMetadata 追加、Task 10)
│   │   └── opengraph-image.tsx                           ← Task 9(動的 OGP 画像)
│   ├── features/
│   │   └── share/                                        ← 新規 feature(URL 共有)
│   │       ├── components/
│   │       │   ├── share-section.tsx                     ← Task 8(統合 UI)
│   │       │   ├── share-button.tsx                      ← Task 5(Web Share API + clipboard fallback)
│   │       │   ├── line-share-button.tsx                 ← Task 6
│   │       │   └── qr-code.tsx                           ← Task 7(qrcode lib + Server Component)
│   │       └── utils/
│   │           └── message.ts                            ← Task 4(メッセージテンプレ純粋関数)
│   ├── features/groups/components/group-dashboard.tsx    ← Modify(ShareSection 組込、Task 8)
│   ├── lib/env.ts                                        ← Task 3(NEXT_PUBLIC_APP_URL を required に昇格)
│   ├── package.json                                      ← Modify(qrcode 追加、Task 7)
│   └── tests/
│       └── features/share/
│           └── utils/message.test.ts                     ← Task 4
└── docs/
    └── superpowers/plans/
        └── 2026-06-02-phase-2-share-experience.md        ← 本ファイル
```

> **配置方針(規約 §6.5 と整合)**: 共有 UI は **複数 feature が使うわけではない**(Phase 2 の固有体験)ので、`features/share/` という独立スライスとして閉じ込める。`components/`(共有 UI primitives ディレクトリ)に出す候補ではない。

---

## Tasks

### Task 1: 本番 404 の原因調査(完了)

> Phase 1 release 後、`POST /api/groups` が 404 を返す事象が報告された。診断結果:
>
> ```
> $ curl -s https://splai-backend.fly.dev/openapi.json \
>     | python3 -c "import sys,json; print(list(json.load(sys.stdin).get('paths',{}).keys()))"
> ['/health']
> ```
>
> **Fly.io にデプロイされている image が Phase 0 のまま**で、Phase 1 で追加した `/api/groups` 等の endpoint が **本番に届いていない**ことが判明。
>
> 根本原因: Phase 0 plan で「Backend deploy: Phase 1+ で GitHub Actions に移行」と記載していたが、その移行タスクが Phase 1 plan に組み込まれずに抜けていた。

### Task 1.5: Fly.io に Phase 1 を緊急 deploy(本番復旧)

**Files:** なし(deploy のみ)

- [ ] **Step 1: ローカルから手動 deploy**

```bash
cd /Users/koheiseki/dev/git/splai/backend
flyctl deploy -a splai-backend
```

> Phase 2 で GitHub Actions による auto-deploy を入れる(Task 1.6)までは、main マージ後に手動でこのコマンドを叩く運用にする。

- [ ] **Step 2: deploy 後の endpoint 一覧を検証**

```bash
curl -s https://splai-backend.fly.dev/openapi.json \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(*sorted(d['paths'].keys()), sep='\n')"
```

期待出力:

```
/api/groups
/api/groups/{group_id}
/api/groups/{group_id}/members
/api/groups/{group_id}/payments
/api/groups/{group_id}/payments/{payment_id}
/api/groups/{group_id}/settlement
/health
```

- [ ] **Step 3: 本番ブラウザでグループ作成が成功することを確認**

`https://splai-frontend.vercel.app` で create-group form を送信 → 201 → `/g/<uuid>` 遷移 → エラーなし。

### Task 1.6: GitHub Actions で Fly.io への auto-deploy を導入

> main へのマージで Fly.io にも自動デプロイされる workflow を追加。Phase 0 plan で「Phase 1+ で導入」と先送りしていた設計を Phase 2 で清算する。

**Files:**

- Create: `.github/workflows/deploy-backend.yml`
- Modify: GitHub Secrets に `FLY_API_TOKEN` を登録

- [ ] **Step 1: Fly.io API token を発行**

```bash
flyctl tokens create deploy --expiry 8760h -a splai-backend
# 出力されたトークン(FlyV1 ...)をコピー
```

- [ ] **Step 2: GitHub Secrets に登録**

```bash
gh secret set FLY_API_TOKEN
# プロンプトに上記トークンを貼り付け
```

または GitHub Web UI: `Settings` → `Secrets and variables` → `Actions` → `New repository secret` → Name: `FLY_API_TOKEN`、Value: 上記トークン。

- [ ] **Step 3: deploy workflow 作成**

```yaml
# .github/workflows/deploy-backend.yml
name: Deploy Backend

on:
  push:
    branches: [main]
    paths:
      - "backend/**"
      - ".github/workflows/deploy-backend.yml"
      - "fly.toml"
  workflow_dispatch: # 手動実行も可能に

jobs:
  deploy:
    runs-on: ubuntu-latest
    concurrency: deploy-backend # 同時 deploy を 1 つに制限
    steps:
      - uses: actions/checkout@v4
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - name: Deploy to Fly.io
        run: flyctl deploy --remote-only -a splai-backend
        working-directory: backend
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

> **`--remote-only`**: Docker build を Fly.io 側で実行(GitHub runner 上で build しない、転送が軽い)。
> **`concurrency: deploy-backend`**: 短時間に複数 push が来た時に古い deploy が後から上書きされないよう排他制御。

- [ ] **Step 4: workflow を develop に push して動作確認**

```bash
git add .github/workflows/deploy-backend.yml
git commit -m "ci(backend): add Fly.io auto-deploy workflow on main push"
git push origin feature/phase-2-share-experience
```

PR に含めて develop マージ → main マージで初回 auto deploy が走ることを確認。

- [ ] **Step 5: deploy 後の verification(再掲)**

```bash
curl -s https://splai-backend.fly.dev/openapi.json \
  | python3 -c "import sys,json; print(len(json.load(sys.stdin)['paths']))"
# → 7(Phase 1 endpoints + /health)
```

---

### Task 1.7: axios timeout を Fly.io cold start に合わせて引き上げ

> Fly.io 無料枠は idle で VM auto-stop。cold start 時は uvicorn / Sentry / asyncpg pool 立ち上げで 5-10s 必要だが、現状の axios timeout は 15000ms。
> 観測: 本番初回ユーザーが NETWORK error(タイムアウト)を踏み、再試行で成功するパターン。
> 対処: timeout を 30000ms に拡張して cold start を吸収する。Phase 5 で skeleton UI + 自動 retry を入れるまでの暫定処置。

**Files:**

- Modify: `frontend/lib/api/api-client.ts`

- [ ] **Step 1: timeout 値を更新**

```typescript
// frontend/lib/api/api-client.ts
export const apiClient = axios.create({
  baseURL: env.NEXT_PUBLIC_API_BASE_URL,
  // Fly.io 無料枠の auto-stop からの cold start(5-10s)を吸収する。
  // Phase 5 で skeleton UI + 自動 retry を入れたら 15s 等に戻す候補。
  timeout: 30000,
});
```

- [ ] **Step 2: typecheck + test**

```bash
cd frontend
npm run typecheck
npm test
```

- [ ] **Step 3: コミット**

```bash
git add frontend/lib/api/api-client.ts
git commit -m "fix(frontend): extend axios timeout to absorb Fly.io cold start"
```

---

### Task 2: lefthook 導入(pre-commit hook)

> Phase 1 で「format check が CI で落ちる → push し直し → 再レビュー」のサイクルが発生した。pre-commit で自動 format/lint することで CI 失敗を未然に防ぐ。lefthook を採用する理由は、husky と違って **言語非依存**(Python と TS が混在する SPLAI に最適)+ **設定 1 ファイル**で済むため。

**Files:**

- Create: `lefthook.yml`(repo root、新規)
- Modify: `docs/conventions.md`(任意、§11 等に lefthook の記述を追加)

- [ ] **Step 1: lefthook を install**

```bash
# macOS の場合(homebrew)
brew install lefthook

# Linux の場合
curl -sSL https://raw.githubusercontent.com/evilmartians/lefthook/master/install.sh | sh

# バイナリ確認
lefthook version
```

- [ ] **Step 2: `lefthook.yml` を作成**

```yaml
# lefthook.yml
# pre-commit で自動 format/lint。`stage_fixed: true` で fix 結果を staged に戻す
# (formatter が変えたファイルを commit に含める)。
pre-commit:
  parallel: true
  commands:
    backend-format:
      root: "backend/"
      glob: "*.py"
      run: uv run ruff format {staged_files}
      stage_fixed: true
    backend-lint:
      root: "backend/"
      glob: "*.py"
      run: uv run ruff check --fix {staged_files}
      stage_fixed: true
    frontend-format:
      root: "frontend/"
      glob: "*.{ts,tsx,js,jsx,json,css,md}"
      run: npx prettier --write {staged_files}
      stage_fixed: true
    frontend-lint:
      root: "frontend/"
      glob: "*.{ts,tsx}"
      run: npx eslint --fix {staged_files}
      stage_fixed: true
```

- [ ] **Step 3: hook を有効化**

```bash
cd /Users/koheiseki/dev/git/splai
lefthook install
```

これで `.git/hooks/pre-commit` が自動生成され、commit 時に lefthook.yml の commands が走る。

- [ ] **Step 4: 動作確認**

```bash
# 意図的にフォーマットを崩したファイルを作って commit
echo 'def foo( ):pass' > /tmp/test_lefthook.py
cp /tmp/test_lefthook.py backend/tests/test_lefthook_demo.py
git add backend/tests/test_lefthook_demo.py
git commit -m "demo: trigger lefthook"
```

期待: commit 前に `ruff format` が走り、`def foo():` のようにフォーマットされる + `stage_fixed` で commit に含まれる。
動作確認後、デモファイルは削除して再 commit:

```bash
git reset HEAD~1
rm backend/tests/test_lefthook_demo.py
```

- [ ] **Step 5: README に追記**

```bash
# README.md の "Local development" セクションに追記
```

````markdown
### Pre-commit hook(lefthook)

ruff / prettier / eslint を commit 時に自動実行。CI 失敗を未然に防ぐ。

```bash
brew install lefthook    # 初回のみ(linux は curl 版)
lefthook install         # repo clone 直後に 1 回実行
```
````

````

- [ ] **Step 6: コミット**

```bash
git add lefthook.yml README.md
git commit -m "chore: add lefthook pre-commit hook for ruff/prettier/eslint"
````

---

### Task 3: `NEXT_PUBLIC_APP_URL` を required に昇格

> Phase 1 で「未使用の予約変数」として optional に降格していた `NEXT_PUBLIC_APP_URL` を、Phase 2 の Task 4(share message)で初めて使う。これに合わせて zod schema を required に戻す。Vercel の本番 env 設定漏れを early に検知できるようになる。

**Files:**

- Modify: `frontend/lib/env.ts`
- Modify: `frontend/.env.local`(末尾 `/` を削除)
- Modify: Vercel Production env(Dashboard or CLI)

- [ ] **Step 1: lib/env.ts を required に戻す**

```typescript
// frontend/lib/env.ts
import { z } from "zod";

const EnvSchema = z.object({
  // backend(Fly.io)の URL。axios baseURL に使う。
  NEXT_PUBLIC_API_BASE_URL: z.string().url(),
  // 自分自身(Vercel)の URL。Phase 2 から OGP / 共有メッセージ生成で必須。
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
```

- [ ] **Step 2: `frontend/.env.local` の末尾スラッシュを削除**

```bash
# Before:
# NEXT_PUBLIC_APP_URL=http://localhost:3000/
# After:
# NEXT_PUBLIC_APP_URL=http://localhost:3000

# 既存の値を確認
grep NEXT_PUBLIC_APP_URL frontend/.env.local
# 末尾 / があれば手で削除
```

- [ ] **Step 3: Vercel Production の `NEXT_PUBLIC_APP_URL` から末尾 `/` を削除**

Dashboard で値を `https://splai-frontend.vercel.app/` → `https://splai-frontend.vercel.app` に変更。Preview / Development scope も同じく確認。

> **理由**: 末尾 `/` ありだと URL 連結時に `//` が混入する(例: `${env.NEXT_PUBLIC_APP_URL}/g/${uuid}` → `https://splai-frontend.vercel.app//g/abc`)。Task 4 のメッセージテンプレで連結するのでここで正規化しておく。

- [ ] **Step 4: 既存テストの sample env も再確認(問題なければ無修正)**

```bash
grep -rn "NEXT_PUBLIC_APP_URL" frontend/tests/ frontend/vitest.config.ts
```

`tests/lib/env.test.ts` と `vitest.config.ts` で `NEXT_PUBLIC_APP_URL: 'http://localhost:3000'`(末尾 `/` なし)になっていれば OK。

- [ ] **Step 5: typecheck + test + dev build 動作確認**

```bash
cd frontend
npm run typecheck       # エラーなし
npm test                # 全 pass
npm run dev             # localhost:3000 で起動して env 検証エラーが出ないこと
```

- [ ] **Step 6: コミット**

```bash
git add frontend/lib/env.ts frontend/.env.local
git commit -m "feat(frontend): promote NEXT_PUBLIC_APP_URL to required for share feature"
```

---

### Task 4: Share message テンプレ(純粋関数)

> 共有時のメッセージ(title / text / url)を組み立てる純粋関数。**`features/share/utils/`** に置き、TDD で開発する。Task 5(Web Share API)、Task 6(LINE share)、Task 9(OGP)から共通利用される。

**Files:**

- Create: `frontend/features/share/utils/message.ts`
- Create: `frontend/tests/features/share/utils/message.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

```typescript
// frontend/tests/features/share/utils/message.test.ts
import { describe, expect, it } from "vitest";

import {
  buildShareMessage,
  buildShareUrl,
} from "@/features/share/utils/message";

describe("buildShareUrl", () => {
  it("joins app URL and group id without double slash", () => {
    expect(buildShareUrl("https://splai.app", "abc-123")).toBe(
      "https://splai.app/g/abc-123",
    );
  });

  it("strips trailing slash from app URL defensively", () => {
    expect(buildShareUrl("https://splai.app/", "abc-123")).toBe(
      "https://splai.app/g/abc-123",
    );
  });
});

describe("buildShareMessage", () => {
  it("produces title / text / url for Web Share API", () => {
    const msg = buildShareMessage({
      groupName: "渋谷飲み会",
      appUrl: "https://splai.app",
      groupId: "abc-123",
    });
    expect(msg.title).toBe("渋谷飲み会 — SPLAI");
    expect(msg.text).toContain("渋谷飲み会");
    expect(msg.text).toContain("SPLAI");
    expect(msg.url).toBe("https://splai.app/g/abc-123");
  });

  it("keeps message under 280 chars (X / SMS friendly)", () => {
    const msg = buildShareMessage({
      groupName: "A".repeat(100), // 名前が長くても全体が 280 字以内に収まる
      appUrl: "https://splai.app",
      groupId: "abc-123",
    });
    expect(`${msg.text}\n${msg.url}`.length).toBeLessThanOrEqual(280);
  });
});
```

- [ ] **Step 2: テスト実行 → 失敗確認**

```bash
cd frontend
npm test -- tests/features/share/utils/message.test.ts
```

期待: ImportError(モジュール未作成)。

- [ ] **Step 3: `features/share/utils/message.ts` を実装**

```typescript
// frontend/features/share/utils/message.ts
/**
 * 共有用メッセージ組み立ての純粋関数。
 * Web Share API / LINE share / clipboard fallback / OGP すべてから利用される。
 */

export type ShareMessage = {
  title: string;
  text: string;
  url: string;
};

/**
 * appUrl 末尾の `/` を除去してから `/g/{groupId}` を連結する。
 */
export function buildShareUrl(appUrl: string, groupId: string): string {
  const base = appUrl.replace(/\/$/, "");
  return `${base}/g/${groupId}`;
}

const MAX_TEXT_LEN = 200; // 280 - URL(最長 80 字) - 改行(2 字) - 余裕

export function buildShareMessage(opts: {
  groupName: string;
  appUrl: string;
  groupId: string;
}): ShareMessage {
  const url = buildShareUrl(opts.appUrl, opts.groupId);
  const title = `${opts.groupName} — SPLAI`;
  // 280 字制限に収めるためグループ名を切り詰める
  const trimmedName =
    opts.groupName.length > 100
      ? `${opts.groupName.slice(0, 99)}…`
      : opts.groupName;
  const text = `${trimmedName} の割り勘、SPLAI で記録中。一緒に登録しよう。`;
  // 最終ガード(text のみで MAX_TEXT_LEN 内に収まらない場合は切る)
  const finalText =
    text.length > MAX_TEXT_LEN ? text.slice(0, MAX_TEXT_LEN - 1) + "…" : text;
  return { title, text: finalText, url };
}
```

- [ ] **Step 4: テスト実行 → PASS確認**

```bash
npm test -- tests/features/share/utils/message.test.ts
```

期待: 4 passed.

- [ ] **Step 5: コミット**

```bash
git add frontend/features/share/utils/message.ts \
  frontend/tests/features/share/utils/message.test.ts
git commit -m "feat(share): add share message template utility (pure function)"
```

---

### Task 5: Web Share API + Clipboard fallback ボタン

> モバイルの Web Share API(`navigator.share`)を呼び、未対応環境では Clipboard API(`navigator.clipboard.writeText`)で URL コピーする。ユーザーの操作後 2 秒だけ「コピーしました」表示。

**Files:**

- Create: `frontend/features/share/components/share-button.tsx`

- [ ] **Step 1: コンポーネント実装**

```tsx
// frontend/features/share/components/share-button.tsx
"use client";

import { useState } from "react";

import type { ShareMessage } from "@/features/share/utils/message";

type Props = {
  message: ShareMessage;
};

export function ShareButton({ message }: Props) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setError(null);
    // Web Share API が使える(かつ HTTPS / トリガが user gesture 内)なら優先
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share(message);
        return;
      } catch (e) {
        // ユーザーが share シートを閉じた場合は AbortError → 何もしない
        if (e instanceof Error && e.name === "AbortError") return;
        // それ以外のエラーは clipboard fallback に進む
      }
    }
    // fallback: clipboard
    try {
      await navigator.clipboard.writeText(message.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={onClick}
        className="bg-ink text-paper font-display p-2"
      >
        SHARE
      </button>
      {copied && (
        <p role="status" className="font-mono text-xs">
          URL をコピーしました
        </p>
      )}
      {error && (
        <p role="alert" className="font-mono text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: typecheck**

```bash
cd frontend
npm run typecheck
```

期待: エラーなし。

- [ ] **Step 3: コミット**

```bash
git add frontend/features/share/components/share-button.tsx
git commit -m "feat(share): add ShareButton with Web Share API and clipboard fallback"
```

---

### Task 6: LINE 共有ボタン

> LINE の Social Plugin URL(`https://social-plugins.line.me/lineit/share?url=...&text=...`)を組み立ててリンクで開く。LINE アプリがあればアプリで、なければブラウザで共有画面が開く。

**Files:**

- Create: `frontend/features/share/components/line-share-button.tsx`

- [ ] **Step 1: コンポーネント実装**

```tsx
// frontend/features/share/components/line-share-button.tsx
"use client";

type Props = {
  url: string;
  text: string;
};

/**
 * LINE Social Plugin で URL を共有する。
 * 仕様: https://developers.line.biz/ja/docs/social-plugins/using-share-button/
 */
export function LineShareButton({ url, text }: Props) {
  const params = new URLSearchParams({ url, text });
  const lineUrl = `https://social-plugins.line.me/lineit/share?${params.toString()}`;

  return (
    <a
      href={lineUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="bg-ink text-paper font-display p-2 inline-block text-center"
    >
      LINE で共有
    </a>
  );
}
```

- [ ] **Step 2: typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: コミット**

```bash
git add frontend/features/share/components/line-share-button.tsx
git commit -m "feat(share): add LINE share button"
```

---

### Task 7: QR コード描画

> `qrcode` パッケージで data URL を生成して `<img>` で表示する。Server Component(async)として実装し、build-time / SSR で QR を作る。

**Files:**

- Modify: `frontend/package.json`(`qrcode` + `@types/qrcode` を追加)
- Create: `frontend/features/share/components/qr-code.tsx`

- [ ] **Step 1: ライブラリ install**

```bash
cd frontend
npm install qrcode
npm install -D @types/qrcode
```

- [ ] **Step 2: `qr-code.tsx` 実装(Server Component)**

```tsx
// frontend/features/share/components/qr-code.tsx
// Server Component(no "use client")。SSR 時に data URL を生成する。
import QRCode from "qrcode";

type Props = {
  value: string;
  size?: number; // px
};

export async function QrCode({ value, size = 192 }: Props) {
  const dataUrl = await QRCode.toDataURL(value, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: size,
    color: { dark: "#0A0A0A", light: "#F4F1E8" }, // ink on paper
  });

  return (
    // alt に value を入れて scanner が無くても URL を確認できるように
    <img
      src={dataUrl}
      alt={`QR code for ${value}`}
      width={size}
      height={size}
      className="block border-2 border-ink"
    />
  );
}
```

- [ ] **Step 3: typecheck**

```bash
npm run typecheck
```

- [ ] **Step 4: コミット**

```bash
git add frontend/package.json frontend/package-lock.json \
  frontend/features/share/components/qr-code.tsx
git commit -m "feat(share): add server-rendered QR code component"
```

---

### Task 8: ShareSection を `/g/[uuid]` dashboard に統合

> Task 4-7 を組み合わせた **Section 級コンポーネント**。`group-dashboard.tsx` から呼び出して画面に表示する。

**Files:**

- Create: `frontend/features/share/components/share-section.tsx`
- Modify: `frontend/features/groups/components/group-dashboard.tsx`

- [ ] **Step 1: ShareSection 実装**

```tsx
// frontend/features/share/components/share-section.tsx
import { ShareButton } from "@/features/share/components/share-button";
import { LineShareButton } from "@/features/share/components/line-share-button";
import { QrCode } from "@/features/share/components/qr-code";
import { buildShareMessage } from "@/features/share/utils/message";
import { env } from "@/lib/env";

type Props = {
  groupId: string;
  groupName: string;
};

/**
 * グループ URL を共有する Section。
 * - Web Share API ボタン(モバイル / PWA で native dialog)
 * - LINE 共有ボタン
 * - QR コード(対面共有用)
 *
 * `env.NEXT_PUBLIC_APP_URL` は Phase 2 で required に昇格済(lib/env.ts)。
 */
export function ShareSection({ groupId, groupName }: Props) {
  // env.NEXT_PUBLIC_APP_URL は zod で url 検証済 + required(Phase 2 から)
  const message = buildShareMessage({
    groupName,
    appUrl: env.NEXT_PUBLIC_APP_URL!, // required なので non-null 確定
    groupId,
  });

  return (
    <section className="border-2 border-ink p-4 flex flex-col gap-4">
      <h3 className="font-jp-display text-sm tracking-widest">SHARE</h3>

      <p className="font-mono text-xs break-all">{message.url}</p>

      <div className="flex flex-wrap gap-2">
        <ShareButton message={message} />
        <LineShareButton url={message.url} text={message.text} />
      </div>

      <details className="font-mono text-xs">
        <summary className="cursor-pointer">QR コード</summary>
        <div className="mt-2">
          <QrCode value={message.url} />
        </div>
      </details>
    </section>
  );
}
```

> **`env.NEXT_PUBLIC_APP_URL!` の型注釈**: Task 3 で required に昇格すると zod の `Env` 型では non-optional になるので、本来は `!` 不要。`lib/env.ts` の Schema が `z.string().url()`(optional なし)に戻っていれば `env.NEXT_PUBLIC_APP_URL` の型は `string` になる。

- [ ] **Step 2: GroupDashboard に組込**

```tsx
// frontend/features/groups/components/group-dashboard.tsx の useGroup 取得後 dashboard 描画部に追加
import { ShareSection } from "@/features/share/components/share-section";

// ... data 取得後の jsx 内に:
<ShareSection groupId={data.id} groupName={data.name} />;
```

具体的な挿入位置は実装時に group-dashboard の構造を見て、PaymentForm と PaymentList の間など、**「自然に共有したくなる位置」** に置く(目安: 上部、グループ名のすぐ下)。

- [ ] **Step 3: 動作確認**

```bash
npm run dev
# /g/<uuid> を開いて、SHARE セクションが表示されること
# - SHARE ボタン押下 → モバイルなら native dialog、PC なら URL クリップボードコピー
# - LINE で共有ボタン → 別タブで line.me が開く
# - QR コードが image として表示
```

- [ ] **Step 4: typecheck + lint**

```bash
npm run typecheck
npm run lint
```

- [ ] **Step 5: コミット**

```bash
git add frontend/features/share/components/share-section.tsx \
  frontend/features/groups/components/group-dashboard.tsx
git commit -m "feat(share): integrate ShareSection into group dashboard"
```

---

### Task 9: 動的 OGP 画像生成

> Next.js 16 の `opengraph-image.tsx` convention で `/g/[uuid]/opengraph-image` を実装。SNS / メッセンジャに URL を貼った時のサムネイルを動的に生成する。`next/og` の `ImageResponse` を使い、ブランドガイド §12 に沿って ink + paper の質素な配色 + Archivo Black の `SPL[AI].` ロゴを表示。
>
> **設計書 付録 B との差**: 付録 B では `/api/og?group_id=xxx` の query 形式 URL を想定していたが、Next.js 15 以降は **route 配下の `opengraph-image.tsx` ファイル convention** が標準化されており、page metadata の `og:image` に **自動 bind** される(`generateMetadata` で個別指定不要)。Phase 2 では Next.js 流儀に揃える方針へ更新する。設計書 付録 B の更新は Phase 2 完了時に併せて行う(Task 11 Step 4 で対応)。

**Files:**

- Create: `frontend/app/g/[uuid]/opengraph-image.tsx`

- [ ] **Step 1: opengraph-image.tsx 実装**

```tsx
// frontend/app/g/[uuid]/opengraph-image.tsx
import { ImageResponse } from "next/og";

import { getGroupApiGroupsGroupIdGet } from "@/lib/api/gen/clients/groupsController/getGroupApiGroupsGroupIdGet";

// Edge runtime は ImageResponse のために必須
export const runtime = "edge";

// SNS 標準サイズ(1.91:1 比、Twitter / Facebook 共通)
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// このルートは認可なしの公開 endpoint(SNS クローラからアクセスされるため)。
// backend は X-Member-Id 必須の `GET /api/groups/{id}` しかないので、
// Phase 2 では「グループ名が取れなかった場合は generic な画像を返す」方針にする。
// (Phase 5 で公開 metadata endpoint を作る選択肢もあり)

async function fetchGroupName(groupId: string): Promise<string | null> {
  // SNS クローラ向けには backend 呼ばずに groupId だけで OG 画像を作る方針。
  // 必要であれば Phase 後半で「メタ情報のみ返す公開 endpoint」を追加する。
  return null;
}

export default async function OpengraphImage({
  params,
}: {
  params: Promise<{ uuid: string }>;
}) {
  const { uuid } = await params;
  const groupName = await fetchGroupName(uuid);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 80,
        background: "#F4F1E8", // paper
        color: "#0A0A0A", // ink
      }}
    >
      {/* 上部: ロゴ */}
      <div
        style={{
          display: "flex",
          fontFamily: "system-ui",
          fontWeight: 900,
          fontSize: 96,
        }}
      >
        SPL[AI].
      </div>

      {/* 中央: グループ名 or generic タグライン */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {groupName ? (
          <div
            style={{ fontSize: 64, fontFamily: "system-ui", fontWeight: 700 }}
          >
            {groupName}
          </div>
        ) : (
          <div
            style={{ fontSize: 56, fontFamily: "system-ui", fontWeight: 700 }}
          >
            割り勘、終わってます。
          </div>
        )}
      </div>

      {/* 下部: 罫線 + URL ヒント */}
      <div
        style={{
          borderTop: "4px solid #0A0A0A",
          paddingTop: 24,
          fontSize: 28,
          fontFamily: "monospace",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>splai.app</span>
        <span>/g/{uuid.slice(0, 8)}…</span>
      </div>
    </div>,
    { ...size },
  );
}
```

> **`--red`(`#E8000C`)を OGP 画像に使わない理由**: 設計書 §12.3 のルール「`--red` は AI が動作している瞬間のみ」。OGP は静的な共有画像なので AI 動作外。ink + paper の組み合わせのみで作る。

> **system-ui font について**: Edge runtime の ImageResponse はデフォルトで限定的なフォントしか持たないため、ブランド指定の Archivo Black は別途 fetch して読ませる必要がある(Phase 後半 polish)。Phase 2 MVP は system-ui で代替。

- [ ] **Step 2: ローカルで OGP 画像を確認**

```bash
npm run dev
# 別タブで以下を開く(画像が表示される)
open http://localhost:3000/g/abc-123-def-456/opengraph-image
```

期待: paper 色背景 + 黒文字の SPL[AI]. ロゴ + グループ id の prefix 表示。

- [ ] **Step 3: コミット**

```bash
git add frontend/app/g/[uuid]/opengraph-image.tsx
git commit -m "feat(og): add dynamic Open Graph image for /g/[uuid]"
```

---

### Task 10: OGP meta tags(`generateMetadata`)

> `app/g/[uuid]/page.tsx` で `generateMetadata` を実装し、`og:image`、`twitter:card` 等の meta tag を生成する。Next.js は `opengraph-image.tsx` を自動的に `og:image` に紐付けるので、ここでは title / description / Twitter card 形式を指定する。

**Files:**

- Modify: `frontend/app/g/[uuid]/page.tsx`

- [ ] **Step 1: 現状の page.tsx を確認**

```bash
cat frontend/app/g/[uuid]/page.tsx
```

- [ ] **Step 2: `generateMetadata` を追加**

```tsx
// frontend/app/g/[uuid]/page.tsx の最上部に追加(既存の export default の手前)
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ uuid: string }>;
}): Promise<Metadata> {
  const { uuid } = await params;
  // 注: backend に X-Member-Id を渡せないので、ここではグループ名を取れない。
  //     Task 9 と同じく generic な title / description を返す。
  //     将来的に「メタ情報のみ返す公開 endpoint」を作れば差し替え可能。
  return {
    title: "SPLAI — 割り勘、終わってます",
    description: "友達と割り勘を記録・清算するアプリ。",
    openGraph: {
      type: "website",
      title: "SPLAI",
      description: "割り勘、終わってます。",
      // og:image は opengraph-image.tsx が自動的に設定
    },
    twitter: {
      card: "summary_large_image",
      title: "SPLAI",
      description: "割り勘、終わってます。",
    },
    alternates: {
      canonical: `/g/${uuid}`,
    },
  };
}
```

- [ ] **Step 3: 動作確認**

```bash
npm run dev
# View source で以下が含まれることを確認:
# <meta property="og:image" content="/g/<uuid>/opengraph-image">
# <meta name="twitter:card" content="summary_large_image">
# <meta property="og:title" content="SPLAI">
```

または curl:

```bash
curl -s http://localhost:3000/g/abc-123/ | grep -E "og:|twitter:"
```

- [ ] **Step 4: 本番 deploy 後、SNS preview で動作確認(Twitter Card Validator / Facebook Debugger)**

```
- https://cards-dev.twitter.com/validator(現在は X 内)で URL を貼って画像を取得
- https://developers.facebook.com/tools/debug/ で og 取得を確認
```

> Phase 2 release 前に この手動確認を **DoD として実施する**。

- [ ] **Step 5: コミット**

```bash
git add frontend/app/g/[uuid]/page.tsx
git commit -m "feat(og): add Open Graph and Twitter card metadata for /g/[uuid]"
```

---

### Task 11: Phase 2 完了確認(DoD チェック)

このタスクは検証のみ、新規ファイルなし。

- [ ] **Step 1: README.md の Phase 状態を更新**

```bash
# README.md の Phase 表で:
# Phase 2 行を 🔒 未着手 → ✅ 完了 に変更
```

- [ ] **Step 2: DoD チェック**

- [ ] 本番 `POST /api/groups` が 200/201 を返す(Task 1)
- [ ] lefthook が installed、commit 時に format/lint が走る(Task 2)
- [ ] `NEXT_PUBLIC_APP_URL` が required + Vercel 本番 / preview / dev に設定済(Task 3)
- [ ] Share message が groupName / appUrl / groupId から正しく組み立てられる(Task 4、unit test)
- [ ] `/g/[uuid]` で SHARE ボタン押下 → モバイル: Web Share dialog / PC: clipboard コピー(Task 5)
- [ ] `/g/[uuid]` で LINE で共有ボタン → line.me が開き URL/text が prefill(Task 6)
- [ ] `/g/[uuid]` の details > QR で QR コード画像が表示される(Task 7)
- [ ] `/g/[uuid]` の dashboard に ShareSection が組み込まれている(Task 8)
- [ ] `/g/[uuid]/opengraph-image` で paper + ink の OGP 画像が返る(Task 9)
- [ ] `/g/[uuid]` の HTML head に og: / twitter: meta tag が含まれる(Task 10)
- [ ] X (Twitter) Card Validator で URL を貼ると OGP 画像が表示される(Task 10、本番)
- [ ] Backend / Frontend CI が緑のまま維持
- [ ] 本番 Vercel + Fly.io で:create → share → 別端末で開く → 同 group に参加 の手動 E2E が成功

- [ ] **Step 3: 設計書 付録 B を Next.js convention に合わせて更新**

```bash
# docs/superpowers/specs/design.md の付録 B を編集
# Before: URL: `/api/og?group_id=xxx`
# After:  Next.js 16 の opengraph-image.tsx convention に従い
#         `/g/[group_id]/opengraph-image`(route 配下のファイル convention で自動生成)
```

実装時の差(Phase 2 で実際に採用した形)を spec に反映し、Phase 3 以降の作業者が混乱しないようにする。

- [ ] **Step 4: Phase 3 の詳細計画作成を開始**

`superpowers:writing-plans` skill で `2026-MM-DD-phase-3-ai-features.md` を作成する。
Phase 3 主題は「AI 機能(チャット入力 / メッセージ生成 / 清算解説)」(設計書 §11 / §8)。

---

## このフェーズで作成する成果物まとめ

### 共有機能(frontend)

- ✅ Web Share API + Clipboard fallback ボタン
- ✅ LINE 共有ボタン(Social Plugin URL)
- ✅ QR コード(server-rendered、ink/paper 配色)
- ✅ 共有メッセージ純粋関数(280 字制限、TDD)
- ✅ ShareSection を /g/[uuid] dashboard に統合

### OGP / メタデータ

- ✅ 動的 OGP 画像(`opengraph-image.tsx`、Edge runtime、ImageResponse)
- ✅ `generateMetadata` で og: / twitter: meta tag 生成

### インフラ・運用

- ✅ Phase 1 release で表面化した本番 404 の調査と修復
- ✅ lefthook 導入で pre-commit に format/lint を強制
- ✅ `NEXT_PUBLIC_APP_URL` を required に昇格(Phase 2 で初使用)

### Phase 2 で **意図的にスコープ外** にする項目

- メタ情報のみ返す公開 backend endpoint(`GET /api/groups/{id}/public-meta` など)
  → Phase 5 hardening 時に検討。Phase 2 では OGP 画像はグループ名なしで generic 表示
- ブランドフォント(Archivo Black、Noto Sans JP)を OGP 画像に lazy fetch して埋め込む
  → Phase 2 後半 polish。MVP は system-ui 代替
- 共有後の参加トラッキング(誰が URL から流入したか)
  → analytics は Phase 5 で Sentry / Vercel Analytics 統合時に
- カスタム共有メッセージ編集 UI
  → Phase 3 で AI が rewrite するパターンに統合(設計書 §8 `rewrite-share-message`)

これで Phase 2 完了時点で、SPLAI は **「グループ作成 → URL 共有 → 別端末で開いて参加 → 全員が支払い登録 → 清算」** の完全な体験を本番で提供できる。Phase 3(AI 機能)で割り勘登録の入力負担を減らすステップに進める。
