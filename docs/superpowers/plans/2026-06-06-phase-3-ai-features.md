# Phase 3: AI Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AI(Claude Sonnet 4.6 via IBM Consulting Advantage API)を使い、(1) 自然言語チャットで支払いを構造化登録、(2) 清算結果の自然言語解説、(3) 共有メッセージのトーン変換、を提供する。SPLAI のブランド宣言「**SPL**+**AI**」を実機能で裏打ちし、`--red` カラールール(§12.3「AI が動いている瞬間のみ発色」)を実 UX に組み込む。

**Architecture:** Phase 1/2 で完成させた CRUD ベースの上に、**`app/services/ai_gateway.py`** を 1 枚かまして IBM Consulting Advantage(以下 ICA、**OpenAI 互換**API)への呼び出しを集約する。SSE(Server-Sent Events)で chat-payment のトークンストリーミングを実装し、frontend は `fetch` + `ReadableStream` で逐次描画 + Tool Calls イベント受信時に PaymentForm へ値を流し込む。OpenAI 互換 Function Calling(`register_payment`)で構造化を強制し、自由記述 → DB 登録までを 1 ステップにする。**backend が ICA OpenAI フォーマットを解釈し、frontend には SPLAI 独自の SSE event 名(`text_delta` / `tool_use` / `done` / `error`)に正規化して流す**ので、AI provider が将来切り替わっても frontend は影響を受けない。

**Tech Stack:** Backend 既存 + **`openai` Python SDK**(`AsyncOpenAI` を `base_url` で ICA に向ける、SSE / tool_calls 累積を SDK 任せに)、**FastAPI `EventSourceResponse`**(`sse-starlette`)、OpenAI 互換 **Function Calling schema**、Frontend は **fetch + ReadableStream + TextDecoder**(EventSource ではなく POST 可能な fetch を使う)、`--red` UI 統合。

---

## 前提条件

- **Phase 1 / Phase 2 が main にマージ済み**(release PR #5, #10)
- 本番(Vercel + Fly.io)で create → share の体験が動作確認済み
- 作業は `feature/phase-3-ai-features` ブランチで行い、develop に PR
- IBM Consulting Advantage アカウントを取得済み(Claude Sonnet 4.6 へのアクセス)
- 環境変数: `IBM_CA_API_KEY` / `IBM_CA_BASE_URL` を `.env.local` に持っている

## 開始前の準備

```bash
cd /Users/koheiseki/dev/git/splai
git checkout develop
git pull --ff-only origin develop
git checkout -b feature/phase-3-ai-features  # 既に作成済み
```

---

## File Structure

このフェーズで追加・変更されるファイル:

```
splai/
├── backend/
│   ├── alembic/versions/
│   │   └── <rev>_create_ai_usage_logs.py        ← Task 2(自動生成 + 手動修正)
│   ├── app/
│   │   ├── api/
│   │   │   ├── ai.py                            ← Task 4-6(新規、AI 系 endpoint 集約)
│   │   │   └── groups.py                        ← Modify(Task 1: require_member 削除)
│   │   ├── services/
│   │   │   └── ai_gateway.py                    ← Task 3(新規、IBM CA への通信集約)
│   │   ├── models/
│   │   │   └── ai_usage_log.py                  ← Task 2(新規)
│   │   ├── schemas/
│   │   │   └── ai.py                            ← Task 4-6(Request/Response/SSE Event)
│   │   ├── exceptions/domain.py                 ← Modify(AIGatewayError 追加)
│   │   └── main.py                              ← Modify(api/ai.py を include)
│   └── tests/
│       ├── test_groups_api.py                   ← Modify(Task 1: public read のテスト追加)
│       ├── test_ai_gateway.py                   ← Task 3(httpx mock)
│       ├── test_ai_chat_payment.py              ← Task 4(SSE event 順序)
│       ├── test_ai_rewrite.py                   ← Task 5
│       └── test_ai_explain_settlement.py        ← Task 6
├── frontend/
│   ├── features/
│   │   ├── ai/                                  ← Task 7-9 で新規 feature
│   │   │   ├── api.ts                           ← AI 系 API ラッパ + SSE consumer
│   │   │   ├── components/
│   │   │   │   ├── payment-chat.tsx             ← Task 7(自然言語入力 + Tool Use)
│   │   │   │   ├── settlement-explanation.tsx   ← Task 8
│   │   │   │   └── share-rewrite-button.tsx     ← Task 9
│   │   │   └── use-sse.ts                       ← SSE 共通 hook(必要時)
│   │   ├── groups/
│   │   │   ├── use-group.ts                     ← Modify(Task 1: memberId なしでも fetch)
│   │   │   └── components/group-dashboard.tsx   ← Modify(Task 1: data あり memberId 無しケース対応、Task 7: chat tab)
│   │   ├── payments/components/payment-form.tsx ← Modify(Task 7: AI からの初期値受け入れ)
│   │   ├── settlement/components/settlement-view.tsx ← Modify(Task 8: 解説ボタン)
│   │   └── share/components/share-section.tsx   ← Modify(Task 9: rewrite ボタン)
│   └── tests/features/ai/
│       └── api.test.ts                          ← SSE parser のユニットテスト
└── docs/
    ├── superpowers/specs/design.md              ← Modify(§2/§7 認可ルール更新、§8 AI 詳細追記)
    └── superpowers/plans/
        └── 2026-06-06-phase-3-ai-features.md    ← 本ファイル
```

> **`features/ai/` 配置方針(規約 §6.5)**: AI チャット入力 / 解説 / rewrite は **AI ドメインの 1 機能群**で、payments / settlement / share という既存 feature の境界を横断する。AI 呼び出し基盤(SSE consumer / api wrapper)を 1 箇所にまとめ、各 feature の component から call する形が自然なので独立 feature とする。

---

## Tasks

### Task 1: `GET /api/groups/{id}` を public 化(Phase 2 持ち越し、最優先)

> Phase 2 release 後、URL 共有経由で他ユーザーがグループに参加できない事象が発生(`localStorage` に memberId が無いユーザーは GET の `X-Member-Id` 認可を満たせず、MemberSelect すら表示されない → "グループが見つかりません")。
>
> SPLAI の設計上 **URL = 招待リンク**なので、**read は public、write 系のみ X-Member-Id 必須**に再定義する。設計書 §2 / §7 の認可ルールを「**書き込み操作のみ X-Member-Id 必須**」に更新する。

**Files:**

- Modify: `backend/app/api/groups.py`
- Modify: `backend/app/auth/deps.py`(docstring 更新のみ)
- Modify: `backend/tests/test_groups_api.py`
- Modify: `backend/openapi.json`(再生成)
- Modify: `frontend/lib/api/gen/*`(再生成)
- Modify: `frontend/features/groups/use-group.ts`
- Modify: `frontend/features/groups/components/group-dashboard.tsx`
- Modify: `docs/superpowers/specs/design.md`(§2 / §7)

- [ ] **Step 1: 失敗するテストを追加**

```python
# backend/tests/test_groups_api.py に追加
async def test_get_group_returns_200_without_x_member_id(client: AsyncClient):
    """X-Member-Id を渡さなくても GET できる(public read)。
    設計上 URL = 招待リンクなので、read は誰でも可能にする。"""
    create_res = await client.post(
        "/api/groups", json={"name": "public", "memberNames": ["Alice"]}
    )
    gid = create_res.json()["id"]

    res = await client.get(f"/api/groups/{gid}")  # ← header なし
    assert res.status_code == 200
    body = res.json()
    assert body["name"] == "public"
    assert len(body["members"]) == 1
```

- [ ] **Step 2: テスト実行 → 失敗確認**

```bash
cd backend
uv run pytest tests/test_groups_api.py::test_get_group_returns_200_without_x_member_id -v
```

期待出力: `422 Unprocessable Entity`(X-Member-Id ヘッダ欠如で FastAPI が validation error を返す)。

- [ ] **Step 3: `app/api/groups.py` から `require_member` を削除**

```python
# 変更前
@router.get("/{group_id}", response_model=GroupResponse)
async def get_group(
    group_id: UUID,
    member: Member = Depends(require_member),  # ← 削除
    db: AsyncSession = Depends(get_session),
) -> GroupResponse:
    ...

# 変更後
@router.get("/{group_id}", response_model=GroupResponse)
async def get_group(
    group_id: UUID,
    db: AsyncSession = Depends(get_session),
) -> GroupResponse:
    """グループ情報 + メンバー + 未削除の支払い一覧を取得(public)。

    URL = 招待リンクの設計。read は public、write 系(POST/PATCH/DELETE)
    のみ X-Member-Id による member 認可を行う。
    """
    group, members, payments, shares_by_payment = await groups_service.get_group_full(
        db, group_id=group_id
    )
    # 以下 DTO 変換は変更なし
    ...
```

`auth.deps.require_member` import が `app/api/groups.py` 全体で他に使われていなければ unused import になるので、import 文も削除。

- [ ] **Step 4: テスト実行 → PASS 確認(回帰なし)**

```bash
uv run pytest tests/test_groups_api.py -v
# 既存の test_get_group_returns_full_payload(X-Member-Id あり)は引き続き 200 が返る
# test_get_group_returns_422_when_member_id_header_missing は **削除 or 200 期待に書き換え**
# test_get_group_returns_401_when_member_not_in_group は **削除 or 200 期待に書き換え**
```

> **Step 4-1: 既存の auth テストを更新**

```python
# 削除する(public 化により認可エラーが起きなくなる)
# - test_get_group_returns_422_when_member_id_header_missing
# - test_get_group_returns_401_when_member_not_in_group

# 代わりに「X-Member-Id があってもなくても同じ結果が返る」を 1 件追加(任意)
async def test_get_group_returns_same_data_with_or_without_x_member_id(client: AsyncClient):
    create_res = await client.post(
        "/api/groups", json={"name": "compat", "memberNames": ["A"]}
    )
    gid = create_res.json()["id"]
    creator_mid = create_res.json()["creatorMemberId"]

    with_auth = await client.get(
        f"/api/groups/{gid}", headers={"X-Member-Id": creator_mid}
    )
    without_auth = await client.get(f"/api/groups/{gid}")

    assert with_auth.status_code == 200
    assert without_auth.status_code == 200
    assert with_auth.json() == without_auth.json()
```

- [ ] **Step 5: openapi.json を再生成**

```bash
cd backend
APP_ENV=test uv run python scripts/dump_openapi.py
```

`openapi.json` の `paths./api/groups/{group_id}.get.parameters` から `X-Member-Id` ヘッダ定義が消えていることを確認。

- [ ] **Step 6: Frontend kubb を再生成**

```bash
cd ../frontend
npm run codegen
```

`lib/api/gen/clients/groupsController/getGroupApiGroupsGroupIdGet.ts` の関数シグネチャから `headers: { 'X-Member-Id': string }` 引数が消えていることを確認:

```typescript
// 変更後の生成シグネチャ(期待)
export async function getGroupApiGroupsGroupIdGet(
  group_id: string,
  config: Partial<RequestConfig> & { client?: Client } = {},
) {
  ...
}
```

- [ ] **Step 7: `use-group.ts` から memberId 依存を外す**

```typescript
// frontend/features/groups/use-group.ts
"use client";
import { useCallback, useEffect, useState, useTransition } from "react";

import { getGroupApiGroupsGroupIdGet } from "@/lib/api/gen/clients/groupsController/getGroupApiGroupsGroupIdGet";
import type { GetGroupApiGroupsGroupIdGetQueryResponse } from "@/lib/api/gen/types/groupsController/GetGroupApiGroupsGroupIdGet";

export type GroupData = GetGroupApiGroupsGroupIdGetQueryResponse;

/**
 * グループ情報を取得する hook。
 *
 * Phase 3 で GET endpoint が public 化されたため、memberId が無くても
 * fetch できる。新規ユーザー(URL 共有経由で初訪問)が MemberSelect を
 * 表示するために必要。
 */
export function useGroup(groupId: string) {
  const [data, setData] = useState<GroupData | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [isPending, startTransition] = useTransition();

  const reload = useCallback(() => {
    startTransition(async () => {
      try {
        const res = await getGroupApiGroupsGroupIdGet(groupId);
        setData(res);
        setError(null);
      } catch (e) {
        setError(e);
      }
    });
  }, [groupId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, isPending, error, reload };
}
```

- [ ] **Step 8: `group-dashboard.tsx` を修正**

`memberId` の有無に関わらず data を取得できる前提で分岐を整理:

```tsx
// frontend/features/groups/components/group-dashboard.tsx の冒頭部分を更新
"use client";

import { useState } from "react";

import { useGroup } from "@/features/groups/use-group";
import { useMemberStorage } from "@/hooks/use-member-storage";

import { MemberSelect } from "./member-select";
// ... 他の import ...

type Props = { groupId: string };

export function GroupDashboard({ groupId }: Props) {
  const { memberId, setMemberId } = useMemberStorage(groupId);
  const { data, isPending, reload } = useGroup(groupId); // memberId を渡さない
  const [refreshKey, setRefreshKey] = useState(0);

  const onChange = () => {
    void reload();
    setRefreshKey((k) => k + 1);
  };

  // ロード中
  if (isPending && !data) return <p className="font-mono p-8">loading...</p>;
  // ガチで存在しないグループ(404 等)
  if (!data)
    return (
      <p className="font-mono p-8">
        グループが見つかりません。URL を確認してください。
      </p>
    );

  // データはある、memberId なし → MemberSelect で「あなたは誰?」
  if (!memberId) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <MemberSelect
          groupId={groupId}
          members={data.members}
          onSelect={setMemberId}
        />
      </main>
    );
  }

  // 通常ダッシュボード(変更なし)
  return (
    <main className="min-h-screen p-8 max-w-2xl mx-auto flex flex-col gap-6">
      ...
    </main>
  );
}
```

- [ ] **Step 9: ローカルで動作確認**

```bash
# backend
cd backend && APP_ENV=local uv run uvicorn app.main:app --reload --port 8000

# frontend(別ターミナル)
cd frontend && npm run dev

# 動作テスト:
# 1. http://localhost:3000 でグループ作成 → /g/<uuid> 遷移、ダッシュボード表示
# 2. 別ブラウザ(or シークレットウィンドウ)で同じ /g/<uuid> を開く
# 3. localStorage に memberId 無し → MemberSelect が表示される(✅ Phase 2 の不具合解消)
# 4. メンバーを選ぶ → ダッシュボードに切り替わる
```

- [ ] **Step 10: 設計書を更新**

```bash
# docs/superpowers/specs/design.md の §2(認可モデル)と §7(API 共通仕様)を編集:

# §2: 「URL アクセス → MemberSelect → POST /members で localStorage に保存」のフローで
#     **GET は public**、**POST/PATCH/DELETE は X-Member-Id 必須** と明記

# §7 共通仕様:
# 変更前: 「POST /api/groups を除く全エンドポイントで X-Member-Id ヘッダ要求」
# 変更後: 「POST/PATCH/DELETE 系で X-Member-Id ヘッダ要求(GET は public read)」
```

- [ ] **Step 11: コミット**

```bash
git add backend/app/api/groups.py backend/tests/test_groups_api.py \
  backend/openapi.json \
  frontend/lib/api/gen/ frontend/features/groups/use-group.ts \
  frontend/features/groups/components/group-dashboard.tsx \
  docs/superpowers/specs/design.md
git commit -m "fix(api): make GET /api/groups/{id} public to support invitation flow

URL = 招待リンクの設計だったが、Phase 2 release 後に他ユーザーが URL 経由で
参加しようとすると 'グループが見つかりません' で失敗していた。原因は GET が
require_member 必須で、localStorage に memberId が無い新規ユーザーが
グループ情報を取得できなかったこと。

read を public に開放し、write 系(POST/PATCH/DELETE)のみ X-Member-Id 必須に
変更。設計書 §2 / §7 の認可ルールも合わせて更新。"
```

---

### Task 2: `ai_usage_logs` テーブル追加

> 設計書 §5 で予告していた `ai_usage_logs` を追加。AI 呼び出しのトークン使用量 / model / endpoint を記録し、コスト監視 + デバッグに使う。Phase 3 全 AI endpoint(Task 4-6)から書き込まれる。

**Files:**

- Create: `backend/app/models/ai_usage_log.py`
- Modify: `backend/app/models/__init__.py`
- Create: `backend/alembic/versions/<rev>_create_ai_usage_logs.py`
- Modify: `backend/tests/test_models.py`(spot check)

- [ ] **Step 1: 失敗するテストを書く**

```python
# backend/tests/test_models.py に追加
from app.models.ai_usage_log import AiUsageLog


def test_ai_usage_log_instantiation():
    log = AiUsageLog(
        endpoint="chat-payment",
        model="claude-sonnet-4-6",
        prompt_tokens=120,
        completion_tokens=45,
    )
    assert log.endpoint == "chat-payment"
    assert log.prompt_tokens == 120
    assert log.completion_tokens == 45
```

- [ ] **Step 2: テスト失敗確認**

```bash
cd backend
uv run pytest tests/test_models.py::test_ai_usage_log_instantiation -v
# → ModuleNotFoundError
```

- [ ] **Step 3: `app/models/ai_usage_log.py` 実装**

```python
# backend/app/models/ai_usage_log.py
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AiUsageLog(Base):
    """AI 呼び出しのトークン使用量を記録する。

    料金監視 + 異常検知(レート制限漏れ等)に使う。group_id は
    任意(rewrite-share-message のように group context を伴わない呼び出しもある)。
    """

    __tablename__ = "ai_usage_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    group_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("groups.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    endpoint: Mapped[str] = mapped_column(String(50), nullable=False)
    # 例: "chat-payment", "rewrite-share-message", "explain-settlement"
    model: Mapped[str] = mapped_column(String(50), nullable=False)
    # 例: "claude-sonnet-4-6"(ICA が公開する model id)
    # OpenAI 互換 API の usage 命名(prompt_tokens / completion_tokens)に揃える。
    prompt_tokens: Mapped[int] = mapped_column(Integer, nullable=False)
    completion_tokens: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
```

- [ ] **Step 4: `app/models/__init__.py` を更新**

```python
# backend/app/models/__init__.py に追加
from app.models.ai_usage_log import AiUsageLog

__all__ = [
    "Group",
    "Member",
    "Payment",
    "PaymentSource",
    "PaymentShare",
    "ShareType",
    "AiUsageLog",  # ← 追加
]
```

- [ ] **Step 5: alembic migration 自動生成**

```bash
cd backend
uv run alembic revision --autogenerate -m "create ai_usage_logs"
```

生成された `<rev>_create_ai_usage_logs.py` を目視確認:

- `op.create_table("ai_usage_logs", ...)` が正しく出ているか
- `ix_ai_usage_logs_group_id` index が含まれているか

- [ ] **Step 6: ローカル DB に適用**

```bash
uv run alembic upgrade head
```

期待: `INFO  [alembic.runtime.migration] Running upgrade ... -> <rev>, create ai_usage_logs`

- [ ] **Step 7: テスト実行 → PASS**

```bash
uv run pytest tests/test_models.py -v
```

- [ ] **Step 8: コミット**

```bash
git add backend/app/models/ai_usage_log.py backend/app/models/__init__.py \
  backend/alembic/versions/ backend/tests/test_models.py
git commit -m "feat(db): add ai_usage_logs table for AI call observability"
```

---

### Task 3: AI gateway service(IBM CA / OpenAI 互換)

> AI 呼び出しを 1 ファイルに集約する **`app/services/ai_gateway.py`**。
> ICA は **OpenAI 互換 API**(`/v1/chat/completions` endpoint、`Authorization: Bearer` 認証、`tools: [{type: "function", function: {...}}]` 形式の Function Calling)を提供する。
> Python 公式の **`openai` SDK** を `base_url=settings.ica_base_url` で ICA に向け、
> (1) 通常 completion、(2) streaming、(3) Function Calling を扱える wrapper を作る。
> SDK 任せにすることで SSE parsing / tool_calls の chunk 累積 / retry / timeout の煩雑さを回避する。
> 失敗時は `AIGatewayError` を投げ、`app/exceptions/handlers.py` で 502 にマップ。

**Files:**

- Modify: `backend/app/exceptions/domain.py`(`AIGatewayError` 追加)
- Create: `backend/app/services/ai_gateway.py`
- Create: `backend/tests/test_ai_gateway.py`
- Modify: `backend/pyproject.toml` / `backend/uv.lock`(`openai` を依存に追加)

- [ ] **Step 1: ドメイン例外を追加**

```python
# backend/app/exceptions/domain.py の末尾に追加
class AIGatewayError(SplaiError):
    status_code = 502  # Bad Gateway: 上流 API が失敗
    type_slug = "ai-gateway-error"
    title = "AI Gateway Error"
```

- [ ] **Step 2: `openai` SDK を依存追加**

```bash
cd backend
uv add openai
```

> **`openai` SDK は OpenAI 互換 provider に汎用で使える**: `base_url` を渡すだけで ICA / Together AI / Groq / Azure OpenAI など、エンドポイント形式が同一のサービスに同じ SDK で接続できる。SSE parsing と tool_calls の chunk 累積を SDK 側でやってくれるので、httpx 手書きより堅牢。

- [ ] **Step 3: 失敗するテストを書く(`openai` SDK を mock)**

```python
# backend/tests/test_ai_gateway.py
"""ai_gateway.chat_completion の動作を openai SDK の mock で検証する。

OpenAI 互換 API の response 形式を模した object を返す。実 SDK の
ChatCompletion レスポンスと duck typing 互換にしてあるので、production と
同じ code path が走る。
"""

from types import SimpleNamespace

import pytest

from app.exceptions.domain import AIGatewayError
from app.services.ai_gateway import ChatMessage, chat_completion


@pytest.fixture(autouse=True)
def _ica_env(monkeypatch):
    monkeypatch.setenv("IBM_CA_API_KEY", "test-key")
    monkeypatch.setenv("IBM_CA_BASE_URL", "https://ica.example.com/v1")


def _make_response(text: str, prompt_tokens=10, completion_tokens=3):
    """OpenAI ChatCompletion response の最小 mock。

    `choices[0].message.{content, tool_calls}` と `usage.{prompt_tokens,
    completion_tokens}` だけが ai_gateway の参照対象。
    """
    return SimpleNamespace(
        model="claude-sonnet-4-6",
        choices=[
            SimpleNamespace(
                message=SimpleNamespace(content=text, tool_calls=None),
                finish_reason="stop",
            )
        ],
        usage=SimpleNamespace(
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
        ),
    )


async def test_chat_completion_returns_assistant_text(monkeypatch):
    async def fake_create(*, model, messages, tools=None, **kwargs):
        return _make_response("こんにちは")

    # AsyncOpenAI().chat.completions.create を差し替える
    from app.services import ai_gateway

    fake_client = SimpleNamespace(
        chat=SimpleNamespace(
            completions=SimpleNamespace(create=fake_create)
        )
    )
    monkeypatch.setattr(ai_gateway, "_get_client", lambda: fake_client)

    result = await chat_completion(messages=[ChatMessage(role="user", content="hi")])
    assert result.text == "こんにちは"
    assert result.model == "claude-sonnet-4-6"
    assert result.usage.prompt_tokens == 10
    assert result.usage.completion_tokens == 3


async def test_chat_completion_raises_on_upstream_error(monkeypatch):
    from openai import APIError

    async def fake_create(**kwargs):
        # APIError は body / response が必須なので最小値を渡す
        raise APIError(message="upstream 500", request=None, body=None)

    from app.services import ai_gateway

    fake_client = SimpleNamespace(
        chat=SimpleNamespace(
            completions=SimpleNamespace(create=fake_create)
        )
    )
    monkeypatch.setattr(ai_gateway, "_get_client", lambda: fake_client)

    with pytest.raises(AIGatewayError):
        await chat_completion(messages=[ChatMessage(role="user", content="hi")])
```

- [ ] **Step 4: テスト失敗確認**

```bash
uv run pytest tests/test_ai_gateway.py -v
# → ModuleNotFoundError(app.services.ai_gateway 未作成)
```

- [ ] **Step 5: `app/services/ai_gateway.py` を実装(OpenAI SDK 使用)**

```python
# backend/app/services/ai_gateway.py
"""IBM Consulting Advantage(OpenAI 互換 API)経由で Claude Sonnet 4.6 を呼ぶ
ゲートウェイ。

ICA は OpenAI Chat Completions 形式と互換なので、`openai` SDK の AsyncOpenAI を
`base_url` で ICA エンドポイントに向ける。SDK が SSE parsing / tool_calls
の chunk 累積 / 型を吸収するので、本ファイルは ICA レスポンスを SPLAI 内部の
DTO(CompletionResult / StreamEvent)に正規化する責務に絞る。

provider を切り替える場合(例: Anthropic ネイティブに戻す、Azure OpenAI を
使う)は本ファイルを差し替えるだけで、上位レイヤ(api/ai.py)は無影響。
"""
from __future__ import annotations

import json
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Any, Literal

from openai import APIError, AsyncOpenAI

from app.config import get_settings
from app.exceptions.domain import AIGatewayError

DEFAULT_MODEL = "claude-sonnet-4-6"  # ICA が公開する model id(実値は ICA dashboard で確認)
DEFAULT_MAX_TOKENS = 1024
DEFAULT_TIMEOUT_S = 60.0


@dataclass(frozen=True)
class ChatMessage:
    role: Literal["user", "assistant", "system"]
    content: str


@dataclass(frozen=True)
class ToolDefinition:
    """OpenAI Function Calling の入力スキーマ。

    ICA に送る形式は `{"type": "function", "function": {"name", "description",
    "parameters"}}`。`parameters` は JSON Schema。
    """

    name: str
    description: str
    parameters: dict[str, Any]  # JSON Schema(OpenAI では "parameters" と呼ぶ)


@dataclass(frozen=True)
class Usage:
    """OpenAI 互換 usage。Anthropic の input_tokens/output_tokens と概念は同じだが
    命名が違う(prompt/completion)。SPLAI 内部は OpenAI 命名で統一。"""

    prompt_tokens: int
    completion_tokens: int


@dataclass(frozen=True)
class ToolCall:
    """OpenAI Function Calling の結果。arguments は JSON 文字列で SDK から渡される
    ので、本データクラスでは parse 済みの dict として保持する。"""

    name: str
    arguments: dict[str, Any]


@dataclass
class CompletionResult:
    """非ストリーミング呼び出しの結果。"""

    text: str  # message.content(tool_calls のみのレスポンスでは "")
    model: str
    usage: Usage
    tool_calls: list[ToolCall] = field(default_factory=list)
    finish_reason: str = "stop"  # "stop" | "tool_calls" | "length" | ...


@dataclass(frozen=True)
class StreamEvent:
    """SSE で流す event の中身(SPLAI 内部規約)。
    type で payload の意味が決まる:

    - text_delta: payload = {"text": "..."}(token 単位の追記)
    - tool_use: payload = {"name": "register_payment", "input": {...}}
                (tool_calls 完成時に 1 回だけ発火)
    - done: payload = {}(stream 完了)
    - error: payload = {"message": "..."}
    """

    type: Literal["text_delta", "tool_use", "done", "error"]
    payload: dict[str, Any]


_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    """AsyncOpenAI を ICA 向けに 1 度だけ初期化してキャッシュ。

    test では monkeypatch.setattr(ai_gateway, "_get_client", ...) で差し替える。
    """
    global _client
    if _client is None:
        settings = get_settings()
        if not settings.ica_api_key:
            raise AIGatewayError("IBM_CA_API_KEY is not configured")
        if not settings.ica_base_url:
            raise AIGatewayError("IBM_CA_BASE_URL is not configured")
        _client = AsyncOpenAI(
            api_key=settings.ica_api_key,
            base_url=settings.ica_base_url,  # 例: "https://ica.example.com/v1"
            timeout=DEFAULT_TIMEOUT_S,
        )
    return _client


def _to_openai_tools(tools: list[ToolDefinition] | None) -> list[dict[str, Any]] | None:
    if not tools:
        return None
    return [
        {
            "type": "function",
            "function": {
                "name": t.name,
                "description": t.description,
                "parameters": t.parameters,
            },
        }
        for t in tools
    ]


def _to_openai_messages(messages: list[ChatMessage]) -> list[dict[str, Any]]:
    return [{"role": m.role, "content": m.content} for m in messages]


async def chat_completion(
    messages: list[ChatMessage],
    *,
    tools: list[ToolDefinition] | None = None,
    model: str = DEFAULT_MODEL,
    max_tokens: int = DEFAULT_MAX_TOKENS,
) -> CompletionResult:
    """非ストリーミングで一発呼び出し。Tool Calls があれば tool_calls に格納。"""
    client = _get_client()
    try:
        response = await client.chat.completions.create(
            model=model,
            messages=_to_openai_messages(messages),
            tools=_to_openai_tools(tools),
            max_tokens=max_tokens,
        )
    except APIError as e:
        raise AIGatewayError(f"upstream API error: {e}") from e
    except Exception as e:  # noqa: BLE001 — SDK が投げ得る他の例外も吸収
        raise AIGatewayError(f"upstream connection error: {e}") from e

    choice = response.choices[0]
    message = choice.message
    text = message.content or ""

    tool_calls: list[ToolCall] = []
    for tc in message.tool_calls or []:
        # tc.function.arguments は JSON 文字列。SDK は parse してくれない。
        try:
            args = json.loads(tc.function.arguments) if tc.function.arguments else {}
        except json.JSONDecodeError as e:
            raise AIGatewayError(
                f"tool call arguments are not valid JSON: {tc.function.arguments[:200]}"
            ) from e
        tool_calls.append(ToolCall(name=tc.function.name, arguments=args))

    usage = response.usage
    return CompletionResult(
        text=text,
        model=response.model,
        usage=Usage(
            prompt_tokens=usage.prompt_tokens if usage else 0,
            completion_tokens=usage.completion_tokens if usage else 0,
        ),
        tool_calls=tool_calls,
        finish_reason=choice.finish_reason or "stop",
    )


async def chat_completion_stream(
    messages: list[ChatMessage],
    *,
    tools: list[ToolDefinition] | None = None,
    model: str = DEFAULT_MODEL,
    max_tokens: int = DEFAULT_MAX_TOKENS,
) -> AsyncIterator[StreamEvent]:
    """SSE ストリーム形式で event を逐次 yield する。

    OpenAI 互換 API の stream 仕様:
    - 各 chunk は `choices[0].delta.{content?, tool_calls?}` を持つ
    - text 系は `delta.content` に token 単位で追記される
    - tool calls は `delta.tool_calls[*].function.{name?, arguments?}` を **chunk
      ごとに文字列累積** していき、`finish_reason == "tool_calls"` で完成
    - 最後の sentinel: `data: [DONE]`(SDK が SSE iteration 終了として吸収)

    本関数は OpenAI フォーマットを SPLAI 内部の StreamEvent に正規化:
    - text_delta: chunk が `delta.content` を持っていたら都度 emit
    - tool_use: tool_calls が完成(finish_reason == "tool_calls")した時に 1 回 emit
    - done: stream 完了
    - error: SDK 例外を error event として emit してから終了
    """
    client = _get_client()

    # tool_calls の累積バッファ。index 別に function.{name, arguments} を文字列で貯める。
    tool_buf: dict[int, dict[str, str]] = {}

    try:
        stream = await client.chat.completions.create(
            model=model,
            messages=_to_openai_messages(messages),
            tools=_to_openai_tools(tools),
            max_tokens=max_tokens,
            stream=True,
        )
    except APIError as e:
        yield StreamEvent(type="error", payload={"message": f"upstream API error: {e}"})
        return
    except Exception as e:  # noqa: BLE001
        yield StreamEvent(type="error", payload={"message": f"upstream connection error: {e}"})
        return

    try:
        async for chunk in stream:
            if not chunk.choices:
                continue
            choice = chunk.choices[0]
            delta = choice.delta

            # text 系: 1 chunk 1 token 程度
            if delta and delta.content:
                yield StreamEvent(type="text_delta", payload={"text": delta.content})

            # tool calls 系: chunk ごとに function.name / arguments を累積
            for tc in delta.tool_calls or []:
                idx = tc.index if tc.index is not None else 0
                buf = tool_buf.setdefault(idx, {"name": "", "arguments": ""})
                if tc.function and tc.function.name:
                    buf["name"] = tc.function.name
                if tc.function and tc.function.arguments:
                    buf["arguments"] += tc.function.arguments

            # 完成判定: finish_reason が "tool_calls" になったら蓄積を emit
            if choice.finish_reason == "tool_calls":
                for idx in sorted(tool_buf.keys()):
                    buf = tool_buf[idx]
                    try:
                        args = json.loads(buf["arguments"]) if buf["arguments"] else {}
                    except json.JSONDecodeError:
                        # 不正 JSON は error event にして終わる
                        yield StreamEvent(
                            type="error",
                            payload={
                                "message": f"tool arguments are not valid JSON: "
                                f"{buf['arguments'][:200]}"
                            },
                        )
                        return
                    yield StreamEvent(
                        type="tool_use",
                        payload={"name": buf["name"], "input": args},
                    )
                tool_buf.clear()
    except APIError as e:
        yield StreamEvent(type="error", payload={"message": f"upstream API error: {e}"})
        return

    yield StreamEvent(type="done", payload={})
```

- [ ] **Step 6: テスト実行 → PASS**

```bash
uv run pytest tests/test_ai_gateway.py -v
```

期待: 2 passed.

- [ ] **Step 7: コミット**

```bash
git add backend/app/services/ai_gateway.py backend/app/exceptions/domain.py \
  backend/tests/test_ai_gateway.py backend/pyproject.toml backend/uv.lock
git commit -m "feat(ai): add ai_gateway service over OpenAI-compatible ICA

ICA は OpenAI Chat Completions 互換 API を提供しているため、openai SDK の
AsyncOpenAI を base_url=ICA に向けて使う。SDK 側で SSE parsing と tool_calls
の chunk 累積を吸収できるので、httpx 手書きより堅牢。

API 表面(ChatMessage / ToolDefinition / CompletionResult / StreamEvent)は
provider 非依存に保ち、実装内部だけで OpenAI フォーマットを SPLAI 内部の
event 名(text_delta / tool_use / done / error)に正規化する。"
```

---

### Task 4: `POST /api/ai/chat-payment`(SSE + Tool Use)

> 自然言語(例: 「居酒屋 12000 円、A が払って B C と 3 等分」)を受け取り、Claude が `register_payment` ツールを使って構造化(`payerId`, `amount`, `description`, `shares`)し、SSE で逐次返す。Frontend(Task 7)は最終的に `tool_use` イベントの値を PaymentForm の初期値として埋め、ユーザーは内容を確認して保存する。**実際の DB 登録は frontend が `POST /api/groups/{gid}/payments` を別途叩く**(AI は構造化のみ、commit 責任は持たせない)。

**Files:**

- Create: `backend/app/schemas/ai.py`
- Create: `backend/app/api/ai.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/test_ai_chat_payment.py`

- [ ] **Step 1: schemas を実装**

```python
# backend/app/schemas/ai.py
from __future__ import annotations

from typing import Any, Literal
from uuid import UUID

from app.schemas.base import CamelModel


class ChatPaymentRequest(CamelModel):
    """自然言語で支払い登録の構造化を依頼するリクエスト。"""

    group_id: UUID
    text: str
    # group のメンバー一覧を text と一緒に system message として送ることで
    # AI に「誰が誰に払ったか」を解決させる
    members: list[dict[str, str]]  # [{"id": "...", "name": "Alice"}, ...]


class RewriteShareMessageRequest(CamelModel):
    text: str
    tone: Literal["casual", "polite", "playful"] = "casual"


class RewriteShareMessageResponse(CamelModel):
    rewritten: str


class ExplainSettlementRequest(CamelModel):
    members: list[dict[str, str]]  # [{"id": "...", "name": "..."}, ...]
    transfers: list[dict[str, Any]]  # settlement の Transfer
    net_balances: dict[str, int]


class ExplainSettlementResponse(CamelModel):
    explanation: str
```

- [ ] **Step 2: SSE 実装(router)**

```python
# backend/app/api/ai.py
from __future__ import annotations

import json

from fastapi import APIRouter
from sse_starlette.sse import EventSourceResponse

from app.schemas.ai import ChatPaymentRequest
from app.services import ai_gateway
from app.services.ai_gateway import ChatMessage, ToolDefinition

router = APIRouter(prefix="/api/ai", tags=["ai"])

# OpenAI Function Calling 形式の tool 定義(`parameters` は JSON Schema)。
# ai_gateway.ToolDefinition が内部で {"type": "function", "function": {...}} に
# 包んで OpenAI SDK に渡す。
REGISTER_PAYMENT_TOOL = ToolDefinition(
    name="register_payment",
    description=(
        "ユーザーの自然言語入力から割り勘の支払い情報を構造化する。"
        "amount は整数(円)、share_member_ids は等分される member_id のリスト。"
    ),
    parameters={
        "type": "object",
        "properties": {
            "amount": {"type": "integer", "minimum": 1, "description": "支払額(円)"},
            "description": {"type": "string", "description": "支払いの内容(店名や用途)"},
            "payer_member_id": {
                "type": "string",
                "format": "uuid",
                "description": "立て替えたメンバーの member_id",
            },
            "share_member_ids": {
                "type": "array",
                "items": {"type": "string", "format": "uuid"},
                "minItems": 1,
                "description": "等分対象のメンバー member_id のリスト",
            },
        },
        "required": ["amount", "description", "payer_member_id", "share_member_ids"],
    },
)


def _build_system_message(members: list[dict[str, str]]) -> str:
    member_lines = "\n".join(f"- {m['name']} (id: {m['id']})" for m in members)
    return (
        "あなたは割り勘登録アシスタントです。ユーザーの自然言語入力を読み取り、"
        "register_payment ツールを呼び出して支払い情報を構造化してください。\n\n"
        f"参加メンバー:\n{member_lines}\n\n"
        "ルール:\n"
        "- payer_member_id と share_member_ids は上記メンバー id のいずれかを使う。\n"
        "- 「みんなで」と言われたら share_member_ids に全員を含める(payer 含む)。\n"
        "- amount は税込 / 円 / 整数。"
    )


@router.post("/chat-payment")
async def chat_payment(body: ChatPaymentRequest) -> EventSourceResponse:
    """自然言語 → register_payment ツール呼び出しの SSE 配信。"""
    messages = [
        ChatMessage(role="system", content=_build_system_message(body.members)),
        ChatMessage(role="user", content=body.text),
    ]

    async def event_generator():
        try:
            async for ev in ai_gateway.chat_completion_stream(
                messages, tools=[REGISTER_PAYMENT_TOOL]
            ):
                yield {"event": ev.type, "data": json.dumps(ev.payload, ensure_ascii=False)}
        except Exception as e:  # noqa: BLE001
            yield {"event": "error", "data": json.dumps({"message": str(e)})}

    return EventSourceResponse(event_generator())
```

- [ ] **Step 3: 依存追加**

```bash
cd backend
uv add sse-starlette
```

- [ ] **Step 4: `app/main.py` に router 登録**

```python
# backend/app/main.py
from app.api import ai, groups, health, members, payments, settlement
...
app.include_router(ai.router)
```

- [ ] **Step 5: 簡易テスト(モック)**

```python
# backend/tests/test_ai_chat_payment.py
import pytest
import respx
from httpx import AsyncClient, Response

# 実 endpoint は SSE なので、ai_gateway.chat_completion_stream を monkeypatch する。

from app.services.ai_gateway import StreamEvent


@pytest.fixture
def mock_stream(monkeypatch):
    async def fake_stream(*args, **kwargs):
        yield StreamEvent(type="text_delta", payload={"text": "了解しました。"})
        yield StreamEvent(
            type="tool_use",
            payload={
                "name": "register_payment",
                "input": {
                    "amount": 12000,
                    "description": "居酒屋A",
                    "payer_member_id": "00000000-0000-0000-0000-000000000001",
                    "share_member_ids": [
                        "00000000-0000-0000-0000-000000000001",
                        "00000000-0000-0000-0000-000000000002",
                    ],
                },
            },
        )
        yield StreamEvent(type="done", payload={})

    from app.services import ai_gateway

    monkeypatch.setattr(ai_gateway, "chat_completion_stream", fake_stream)


async def test_chat_payment_streams_text_then_tool_use(
    client: AsyncClient, mock_stream
):
    res = await client.post(
        "/api/ai/chat-payment",
        json={
            "groupId": "00000000-0000-0000-0000-000000000099",
            "text": "居酒屋 12000 円を A が払って 2 人で割って",
            "members": [
                {"id": "00000000-0000-0000-0000-000000000001", "name": "A"},
                {"id": "00000000-0000-0000-0000-000000000002", "name": "B"},
            ],
        },
    )
    assert res.status_code == 200
    body = res.text
    assert "event: text_delta" in body
    assert "event: tool_use" in body
    assert "register_payment" in body
    assert "12000" in body
```

- [ ] **Step 6: テスト実行 → PASS**

```bash
uv run pytest tests/test_ai_chat_payment.py -v
```

- [ ] **Step 7: コミット**

```bash
git add backend/app/api/ai.py backend/app/schemas/ai.py backend/app/main.py \
  backend/pyproject.toml backend/uv.lock backend/tests/test_ai_chat_payment.py
git commit -m "feat(api): add POST /api/ai/chat-payment with SSE + register_payment Tool Use"
```

---

### Task 5: `POST /api/ai/rewrite-share-message`

> Phase 2 で組み立てた共有メッセージ(例:「渋谷飲み会 の割り勘、SPLAI で記録中。」)を、選んだトーン(`casual` / `polite` / `playful`)に書き換える非ストリーミング endpoint。

**Files:**

- Modify: `backend/app/api/ai.py`(endpoint 追加)
- Create: `backend/tests/test_ai_rewrite.py`

- [ ] **Step 1: 実装**

```python
# backend/app/api/ai.py に追加
from app.schemas.ai import RewriteShareMessageRequest, RewriteShareMessageResponse

REWRITE_SYSTEM_BASE = (
    "あなたは SPLAI(割り勘アプリ)の共有メッセージ編集アシスタントです。"
    "短く、リンクを開きたくなるような文に書き換えてください。"
    "結果のみを返し、説明や前置きは入れないこと。"
)

REWRITE_TONE_DIRECTIVE = {
    "casual": "カジュアルで友人同士のテンションで(例:「割り勘やろ〜!」)",
    "polite": "丁寧で礼儀正しく(例:「お会計のご共有です」)",
    "playful": "遊び心のある言い回しで(例:「集金タイム!」)",
}


@router.post("/rewrite-share-message", response_model=RewriteShareMessageResponse)
async def rewrite_share_message(
    body: RewriteShareMessageRequest,
) -> RewriteShareMessageResponse:
    system = f"{REWRITE_SYSTEM_BASE}\nトーン: {REWRITE_TONE_DIRECTIVE[body.tone]}"
    messages = [
        ChatMessage(role="system", content=system),
        ChatMessage(role="user", content=body.text),
    ]
    result = await ai_gateway.chat_completion(messages)
    return RewriteShareMessageResponse(rewritten=result.text.strip())
```

- [ ] **Step 2: テスト**

```python
# backend/tests/test_ai_rewrite.py
import pytest
from httpx import AsyncClient

from app.services import ai_gateway
from app.services.ai_gateway import CompletionResult, Usage


@pytest.fixture
def mock_completion(monkeypatch):
    async def fake(messages, **kwargs):
        return CompletionResult(
            text="集金タイム!",
            model="claude-sonnet-4-6",
            usage=Usage(prompt_tokens=20, completion_tokens=5),
        )

    monkeypatch.setattr(ai_gateway, "chat_completion", fake)


async def test_rewrite_returns_rewritten_text(client: AsyncClient, mock_completion):
    res = await client.post(
        "/api/ai/rewrite-share-message",
        json={"text": "渋谷飲み会 の割り勘、SPLAI で記録中。", "tone": "playful"},
    )
    assert res.status_code == 200
    assert res.json()["rewritten"] == "集金タイム!"
```

- [ ] **Step 3: テスト実行 → PASS**

```bash
uv run pytest tests/test_ai_rewrite.py -v
```

- [ ] **Step 4: コミット**

```bash
git add backend/app/api/ai.py backend/tests/test_ai_rewrite.py
git commit -m "feat(api): add POST /api/ai/rewrite-share-message"
```

---

### Task 6: `POST /api/ai/explain-settlement`

> 清算結果(transfers + net_balances)を自然言語で説明する。「A は 4000 円多く払ってるので B から 2000、C から 2000 受け取り」のような文。

**Files:**

- Modify: `backend/app/api/ai.py`
- Create: `backend/tests/test_ai_explain_settlement.py`

- [ ] **Step 1: 実装**

```python
# backend/app/api/ai.py に追加
from app.schemas.ai import ExplainSettlementRequest, ExplainSettlementResponse

EXPLAIN_SYSTEM = (
    "あなたは SPLAI の清算結果説明アシスタントです。"
    "メンバー一覧、ネット収支、送金リストを受け取り、"
    "全員にとって分かりやすい清算サマリを 3-4 文で書いてください。"
    "誰がいくら多く立て替えていたか、最終的に誰が誰にいくら払えばよいかを"
    "明示すること。"
)


@router.post("/explain-settlement", response_model=ExplainSettlementResponse)
async def explain_settlement(
    body: ExplainSettlementRequest,
) -> ExplainSettlementResponse:
    user_content = (
        f"メンバー: {body.members}\n"
        f"ネット収支(プラス=受取、マイナス=支払): {body.net_balances}\n"
        f"送金リスト: {body.transfers}"
    )
    messages = [
        ChatMessage(role="system", content=EXPLAIN_SYSTEM),
        ChatMessage(role="user", content=user_content),
    ]
    result = await ai_gateway.chat_completion(messages)
    return ExplainSettlementResponse(explanation=result.text.strip())
```

- [ ] **Step 2: テスト**

```python
# backend/tests/test_ai_explain_settlement.py
import pytest
from httpx import AsyncClient

from app.services import ai_gateway
from app.services.ai_gateway import CompletionResult, Usage


@pytest.fixture
def mock_completion(monkeypatch):
    async def fake(messages, **kwargs):
        return CompletionResult(
            text="A が 4000 円多く立て替えていたので、B と C から 2000 ずつ受け取れば終わりです。",
            model="claude-sonnet-4-6",
            usage=Usage(prompt_tokens=80, completion_tokens=30),
        )

    monkeypatch.setattr(ai_gateway, "chat_completion", fake)


async def test_explain_settlement(client: AsyncClient, mock_completion):
    res = await client.post(
        "/api/ai/explain-settlement",
        json={
            "members": [
                {"id": "a", "name": "A"},
                {"id": "b", "name": "B"},
                {"id": "c", "name": "C"},
            ],
            "transfers": [
                {"fromId": "b", "toId": "a", "amount": 2000},
                {"fromId": "c", "toId": "a", "amount": 2000},
            ],
            "netBalances": {"a": 4000, "b": -2000, "c": -2000},
        },
    )
    assert res.status_code == 200
    assert "立て替え" in res.json()["explanation"]
```

- [ ] **Step 3: テスト実行 → PASS**

- [ ] **Step 4: コミット**

```bash
git add backend/app/api/ai.py backend/tests/test_ai_explain_settlement.py
git commit -m "feat(api): add POST /api/ai/explain-settlement"
```

---

### Task 7: Frontend AI チャット入力 UI(SSE 受信 + Tool Use 反映)

> PaymentForm と並ぶ「もう 1 つの入力経路」として `PaymentChat` を追加。`/g/[uuid]` の dashboard で **タブ切り替え**(「フォーム入力」 / 「AI 入力」)で出し分ける。AI が `tool_use` イベントを返したら、その input を PaymentForm の初期値として埋めて、ユーザーが内容を確認した上で保存する(誤生成のガードのため自動保存はしない)。

**Files:**

- Create: `frontend/features/ai/api.ts`
- Create: `frontend/features/ai/components/payment-chat.tsx`
- Modify: `frontend/features/groups/components/group-dashboard.tsx`
- Modify: `frontend/features/payments/components/payment-form.tsx`(初期値受け入れ)

- [ ] **Step 1: SSE consumer + AI api wrapper**

```typescript
// frontend/features/ai/api.ts
"use client";

import { env } from "@/lib/env";

export type ChatPaymentInput = {
  groupId: string;
  text: string;
  members: { id: string; name: string }[];
};

export type ChatPaymentEvent =
  | { type: "text_delta"; text: string }
  | { type: "tool_use"; name: string; input: Record<string, unknown> }
  | { type: "done" }
  | { type: "error"; message: string };

/**
 * /api/ai/chat-payment への SSE POST。AsyncGenerator で event を逐次 yield する。
 * ブラウザ標準の EventSource は GET のみなので、fetch + ReadableStream を使う。
 */
export async function* streamChatPayment(
  input: ChatPaymentInput,
  signal?: AbortSignal,
): AsyncGenerator<ChatPaymentEvent> {
  const url = `${env.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, "")}/api/ai/chat-payment`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(input),
    signal,
  });
  if (!res.ok || !res.body) {
    throw new Error(`AI gateway HTTP ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) return;
    buffer += decoder.decode(value, { stream: true });
    // SSE は "\n\n" 区切り
    let idx;
    while ((idx = buffer.indexOf("\n\n")) >= 0) {
      const block = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 2);
      const event = parseSseBlock(block);
      if (event) yield event;
    }
  }
}

function parseSseBlock(block: string): ChatPaymentEvent | null {
  let eventName = "";
  const dataLines: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) eventName = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  if (!eventName) return null;
  let payload: Record<string, unknown> = {};
  if (dataLines.length > 0) {
    try {
      payload = JSON.parse(dataLines.join("\n"));
    } catch {
      payload = {};
    }
  }
  switch (eventName) {
    case "text_delta":
      return { type: "text_delta", text: String(payload.text ?? "") };
    case "tool_use":
      return {
        type: "tool_use",
        name: String(payload.name ?? ""),
        input: (payload.input as Record<string, unknown>) ?? {},
      };
    case "done":
      return { type: "done" };
    case "error":
      return { type: "error", message: String(payload.message ?? "unknown") };
    default:
      return null;
  }
}
```

- [ ] **Step 2: PaymentChat コンポーネント**

```tsx
// frontend/features/ai/components/payment-chat.tsx
"use client";

import { startTransition, useActionState, useState } from "react";

import { streamChatPayment } from "@/features/ai/api";

type Member = { id: string; name: string };

type Props = {
  groupId: string;
  members: Member[];
  onDraft: (draft: {
    payerId: string;
    amount: number;
    description: string;
    shareMemberIds: string[];
  }) => void;
};

type State = { transcript: string; error: string | null };

export function PaymentChat({ groupId, members, onDraft }: Props) {
  const [text, setText] = useState("");

  const [state, submit, isPending] = useActionState<State, string>(
    async (_prev, userText) => {
      let transcript = "";
      try {
        for await (const event of streamChatPayment({
          groupId,
          text: userText,
          members: members.map((m) => ({ id: m.id, name: m.name })),
        })) {
          if (event.type === "text_delta") {
            transcript += event.text;
          } else if (
            event.type === "tool_use" &&
            event.name === "register_payment"
          ) {
            const input = event.input as Record<string, unknown>;
            onDraft({
              payerId: String(input.payer_member_id),
              amount: Number(input.amount),
              description: String(input.description),
              shareMemberIds: (input.share_member_ids as string[]) ?? [],
            });
          } else if (event.type === "error") {
            return { transcript, error: event.message };
          }
        }
        return { transcript, error: null };
      } catch (e) {
        return {
          transcript,
          error: e instanceof Error ? e.message : String(e),
        };
      }
    },
    { transcript: "", error: null },
  );

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    startTransition(() => {
      submit(text.trim());
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-3 border-2 border-ink p-4"
    >
      {/* AI 動作中は --red を発色させる(設計書 §12.3 のルール) */}
      <h3
        className={`font-jp-display text-sm tracking-widest ${
          isPending ? "text-red" : ""
        }`}
      >
        AI INPUT {isPending && "— working..."}
      </h3>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="例: 居酒屋 12000 円、A が払って 3 人で割って"
        className="border-2 border-ink p-2 bg-paper font-mono min-h-24"
        disabled={isPending}
      />

      <button
        type="submit"
        disabled={isPending || !text.trim()}
        className={`font-display p-2 disabled:opacity-50 ${
          isPending ? "bg-red text-paper" : "bg-ink text-paper"
        }`}
      >
        {isPending ? "AI が考え中..." : "AI に登録してもらう"}
      </button>

      {state.transcript && (
        <p className="font-mono text-xs text-rule-grey whitespace-pre-wrap">
          {state.transcript}
        </p>
      )}

      {state.error && (
        <p role="alert" className="text-red font-mono text-xs">
          {state.error}
        </p>
      )}
    </form>
  );
}
```

- [ ] **Step 3: PaymentForm を AI 初期値受け入れ可能に**

```tsx
// frontend/features/payments/components/payment-form.tsx の Props に追加
type Props = {
  groupId: string;
  memberId: string;
  members: Member[];
  onCreated: () => void;
  draft?: {
    // ← 追加
    payerId: string;
    amount: number;
    description: string;
    shareMemberIds: string[]; // ← 等分対象
  };
};
```

そして state 初期値で draft を反映:

```tsx
const [payerId, setPayerId] = useState(draft?.payerId ?? memberId);
const [amount, setAmount] = useState(draft ? String(draft.amount) : "");
const [description, setDescription] = useState(draft?.description ?? "");
// shareMemberIds は Phase 3 では「全員 / draft の人だけ」の2択でOK
```

> 既存の PaymentForm は「全員等分固定」だったので、`draft.shareMemberIds` を尊重するなら state に `selectedShareIds: Set<string>` を持たせる必要がある。Phase 3 では小さく始めるなら **draft はあくまで提案、ユーザーが最終確認**として、`shareMemberIds` は表示のみに留めるのも可。

- [ ] **Step 4: GroupDashboard に統合(タブ切り替え)**

```tsx
// frontend/features/groups/components/group-dashboard.tsx の Section の冒頭に追加
import { PaymentChat } from "@/features/ai/components/payment-chat";

// ... main 内 ...
const [draft, setDraft] = useState<{
  payerId: string;
  amount: number;
  description: string;
  shareMemberIds: string[];
} | null>(null);

const [tab, setTab] = useState<"form" | "chat">("form");

// 表示部:
<div className="flex gap-2">
  <button
    onClick={() => setTab("form")}
    className={`font-mono text-xs px-2 py-1 ${tab === "form" ? "bg-ink text-paper" : "border border-ink"}`}
  >
    FORM
  </button>
  <button
    onClick={() => setTab("chat")}
    className={`font-mono text-xs px-2 py-1 ${tab === "chat" ? "bg-ink text-paper" : "border border-ink"}`}
  >
    AI CHAT
  </button>
</div>;

{
  tab === "chat" ? (
    <PaymentChat
      groupId={groupId}
      members={data.members}
      onDraft={(d) => {
        setDraft(d);
        setTab("form"); // 入力後はフォームに切り替えて確認させる
      }}
    />
  ) : (
    <PaymentForm
      groupId={groupId}
      memberId={memberId}
      members={data.members}
      onCreated={onChange}
      draft={draft ?? undefined}
    />
  );
}
```

- [ ] **Step 5: 動作確認**

```bash
# ローカル backend(IBM_CA_API_KEY 必要)+ frontend
# /g/<uuid> → "AI CHAT" タブ → 「居酒屋 12000 円、A が払って B C と 3 等分」と入力 → 送信
# 期待:
# - AI 動作中ボタンが --red 発色 + "AI が考え中..." 表示
# - text_delta が transcript に流れる
# - tool_use を受信したら FORM タブに自動切替、PaymentForm に値が入っている
# - ユーザーが ADD 押すと既存の payment 作成 flow が動く
```

- [ ] **Step 6: コミット**

```bash
git add frontend/features/ai/ \
  frontend/features/groups/components/group-dashboard.tsx \
  frontend/features/payments/components/payment-form.tsx
git commit -m "feat(ai): add AI chat-payment input UI with SSE streaming and Tool Use draft"
```

---

### Task 8: Frontend 清算解説 UI

> SettlementView に「解説する」ボタンを追加。クリックで `/api/ai/explain-settlement` を呼び、結果を表示。AI 動作中は `--red` インジケータ。

**Files:**

- Modify: `frontend/features/ai/api.ts`(`explainSettlement` 追加)
- Modify: `frontend/features/settlement/components/settlement-view.tsx`

- [ ] **Step 1: api wrapper 追加**

```typescript
// frontend/features/ai/api.ts に追加
import { env } from "@/lib/env";

export async function explainSettlement(input: {
  members: { id: string; name: string }[];
  transfers: { fromId: string; toId: string; amount: number }[];
  netBalances: Record<string, number>;
}): Promise<{ explanation: string }> {
  const url = `${env.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, "")}/api/ai/explain-settlement`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
```

- [ ] **Step 2: SettlementView に解説ボタン**

```tsx
// frontend/features/settlement/components/settlement-view.tsx の return 内末尾に追加
import { explainSettlement } from "@/features/ai/api";
import { startTransition, useActionState } from "react";

// ... 既存の hook 群の下に ...
const [explainState, runExplain, isExplaining] = useActionState<
  { text: string | null; error: string | null },
  void
>(
  async () => {
    if (!data) return { text: null, error: null };
    try {
      const res = await explainSettlement({
        members: members.map((m) => ({ id: m.id, name: m.name })),
        transfers: data.transfers,
        netBalances: data.netBalances,
      });
      return { text: res.explanation, error: null };
    } catch (e) {
      return { text: null, error: e instanceof Error ? e.message : String(e) };
    }
  },
  { text: null, error: null },
);

// JSX 末尾に:
<div className="border-t border-rule-grey pt-3 flex flex-col gap-2">
  <button
    type="button"
    onClick={() => startTransition(() => runExplain())}
    disabled={isExplaining}
    className={`font-mono text-xs underline self-start ${
      isExplaining ? "text-red" : ""
    }`}
  >
    {isExplaining ? "AI 解説中..." : "AI に解説してもらう"}
  </button>
  {explainState.text && (
    <p className="font-jp-editorial text-sm whitespace-pre-wrap">
      {explainState.text}
    </p>
  )}
  {explainState.error && (
    <p role="alert" className="text-red font-mono text-xs">
      {explainState.error}
    </p>
  )}
</div>;
```

- [ ] **Step 3: 動作確認 + コミット**

```bash
git add frontend/features/ai/api.ts \
  frontend/features/settlement/components/settlement-view.tsx
git commit -m "feat(ai): add AI settlement explanation in SettlementView"
```

---

### Task 9: Frontend 共有メッセージ rewrite

> ShareSection に「メッセージ調整」ボタンを追加。`/api/ai/rewrite-share-message` を呼び、ShareButton / LineShareButton に渡す `message.text` を rewrite 結果に置き換える。トーンは `casual / polite / playful` の 3 択。

**Files:**

- Modify: `frontend/features/ai/api.ts`(`rewriteShareMessage` 追加)
- Modify: `frontend/features/share/components/share-section.tsx`

- [ ] **Step 1: api wrapper**

```typescript
// frontend/features/ai/api.ts に追加
export type Tone = "casual" | "polite" | "playful";

export async function rewriteShareMessage(input: {
  text: string;
  tone: Tone;
}): Promise<{ rewritten: string }> {
  const url = `${env.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, "")}/api/ai/rewrite-share-message`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
```

- [ ] **Step 2: ShareSection に rewrite ボタン**

```tsx
// frontend/features/share/components/share-section.tsx を更新
"use client";

import { startTransition, useActionState, useState } from "react";

import { rewriteShareMessage, type Tone } from "@/features/ai/api";
import { ShareButton } from "@/features/share/components/share-button";
import { LineShareButton } from "@/features/share/components/line-share-button";
import { QrCode } from "@/features/share/components/qr-code";
import { buildShareMessage } from "@/features/share/utils/message";
import { env } from "@/lib/env";

type Props = { groupId: string; groupName: string };

export function ShareSection({ groupId, groupName }: Props) {
  const baseMessage = buildShareMessage({
    groupName,
    appUrl: env.NEXT_PUBLIC_APP_URL!,
    groupId,
  });

  const [textOverride, setTextOverride] = useState<string | null>(null);
  const message = textOverride
    ? { ...baseMessage, text: textOverride }
    : baseMessage;

  const [_, runRewrite, isRewriting] = useActionState<
    { error: string | null },
    Tone
  >(
    async (_prev, tone) => {
      try {
        const res = await rewriteShareMessage({ text: message.text, tone });
        setTextOverride(res.rewritten);
        return { error: null };
      } catch (e) {
        return { error: e instanceof Error ? e.message : String(e) };
      }
    },
    { error: null },
  );

  return (
    <section className="border-2 border-ink p-4 flex flex-col gap-4">
      <h3
        className={`font-jp-display text-sm tracking-widest ${isRewriting ? "text-red" : ""}`}
      >
        SHARE {isRewriting && "— rewriting..."}
      </h3>

      <p className="font-mono text-xs break-all">{message.url}</p>
      <p className="font-jp-editorial text-sm">{message.text}</p>

      <div className="flex flex-wrap gap-2">
        <ShareButton message={message} />
        <LineShareButton url={message.url} text={message.text} />
      </div>

      {/* AI tone ボタン群 */}
      <div className="flex flex-wrap gap-2 border-t border-rule-grey pt-2">
        <span className="font-mono text-xs self-center">tone:</span>
        {(["casual", "polite", "playful"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => startTransition(() => runRewrite(t))}
            disabled={isRewriting}
            className={`font-mono text-xs px-2 py-1 border border-ink ${
              isRewriting ? "text-red" : ""
            }`}
          >
            {t}
          </button>
        ))}
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

- [ ] **Step 3: 動作確認 + コミット**

```bash
git add frontend/features/ai/api.ts \
  frontend/features/share/components/share-section.tsx
git commit -m "feat(ai): add AI tone rewrite for share message"
```

---

### Task 10: `--red` UX 統合の総点検

> 設計書 §12.3 ルール: 「`--red`(`#E8000C`)は AI が動作している瞬間にのみ発色」。Phase 3 で複数の AI 呼び出し UI が増えたので、各箇所で **AI 実行中は red、それ以外は ink** が一貫していることを確認する。

**Files(主にレビュー、修正は対象箇所のみ):**

- Review: `frontend/features/ai/components/payment-chat.tsx`(Task 7)
- Review: `frontend/features/settlement/components/settlement-view.tsx`(Task 8)
- Review: `frontend/features/share/components/share-section.tsx`(Task 9)
- 確認: 既存の **非 AI** UI(create-group / payment-form / member-select 等)で `--red` を使っていない

- [ ] **Step 1: 全コンポーネントを grep で点検**

```bash
cd frontend
echo "=== --red / text-red / bg-red の使用箇所 ==="
grep -rn "text-red\|bg-red\|--red" features/ app/ --include="*.tsx" --include="*.ts"

echo "=== AI feature 配下では使っていて OK ==="
echo "=== それ以外で出てきたら違反 ==="
```

期待:

- `features/ai/`、`features/share/share-section.tsx`(rewrite ボタン)、`features/settlement/settlement-view.tsx`(解説ボタン)で使用 → OK
- それ以外(create-group、payment-form 等)で使用 → 違反、修正

- [ ] **Step 2: 違反があれば ink に置き換え**

例:

```tsx
// Before
<button className="bg-red text-paper">SAVE</button>

// After(AI 動作と無関係なボタンは ink)
<button className="bg-ink text-paper">SAVE</button>
```

- [ ] **Step 3: コミット**

```bash
git add -p frontend/features/
git commit -m "chore(brand): enforce --red usage rule (AI activity only)"
```

---

### Task 11: Phase 3 完了確認(DoD チェック)

このタスクは検証のみ、新規ファイルなし。

- [ ] **Step 1: README.md の Phase 状態を更新**

Phase 3 行を 🔒 未着手 → ✅ 完了 に変更。

- [ ] **Step 2: DoD チェック**

- [ ] `GET /api/groups/{id}` が public(X-Member-Id 不要、Phase 2 持ち越し解消)
- [ ] 別ブラウザで URL を開くと MemberSelect が表示される
- [ ] `ai_usage_logs` テーブルが本番 DB に存在
- [ ] `app/services/ai_gateway.py` が IBM CA API 経由で `chat_completion` / `chat_completion_stream` を実行できる
- [ ] `POST /api/ai/chat-payment` が SSE で text_delta + tool_use + done を返す
- [ ] `POST /api/ai/rewrite-share-message` が指定トーンで書き換えた text を返す
- [ ] `POST /api/ai/explain-settlement` が清算結果を自然言語で説明
- [ ] `/g/[uuid]` の AI CHAT タブで自然言語入力 → PaymentForm に draft が入る
- [ ] SettlementView の「AI に解説してもらう」で解説が表示される
- [ ] ShareSection の tone ボタンで共有メッセージが書き換わる
- [ ] AI 動作中だけ `--red` が発色(他箇所では使われていない)
- [ ] Backend / Frontend CI が緑のまま維持
- [ ] 本番環境(Fly.io secrets に `IBM_CA_API_KEY` / `IBM_CA_BASE_URL` を設定済)で全 AI endpoint が動作

- [ ] **Step 3: 設計書 §8 の AI 機能を本実装に合わせて加筆**

```bash
# docs/superpowers/specs/design.md §8 を編集:
# - 8.1 chat-payment: register_payment ツールの実 schema を貼る
# - 8.2 rewrite-share-message: tone 3 種を明記
# - 8.3 explain-settlement: input/output を明記
# - エラー処理: AIGatewayError → 502
# - ai_usage_logs への記録仕様
```

- [ ] **Step 4: Phase 4 の詳細計画作成を開始**

`superpowers:writing-plans` skill で `2026-MM-DD-phase-4-ocr.md` を作成する。
Phase 4 主題は「OCR 機能(GCP Vision 統合 / 非同期ジョブ / 確認画面)」(設計書 §11 / §8)。

---

## このフェーズで作成する成果物まとめ

### Backend

- ✅ `GET /api/groups/{id}` を public 化(invitation flow が機能する)
- ✅ `ai_usage_logs` テーブル(料金監視 + デバッグ用)
- ✅ `ai_gateway` service(IBM CA API への通信集約、Anthropic 互換 API)
- ✅ `POST /api/ai/chat-payment`(SSE + register_payment Tool Use)
- ✅ `POST /api/ai/rewrite-share-message`(tone 変換)
- ✅ `POST /api/ai/explain-settlement`(清算結果の自然言語説明)

### Frontend

- ✅ `features/ai/` 独立 feature(api wrapper + SSE consumer)
- ✅ `PaymentChat`(自然言語入力 → AI Tool Use → PaymentForm draft)
- ✅ Settlement view 解説機能
- ✅ Share section tone rewrite
- ✅ `--red` UX を AI 動作中のみに限定(設計書 §12.3 ルール遵守)

### インフラ・運用

- ✅ Fly.io secrets に `IBM_CA_API_KEY` / `IBM_CA_BASE_URL` を登録(本番で AI 呼び出し可能)
- ✅ ai_usage_logs migration が auto-deploy で本番に適用される

### Phase 3 で **意図的にスコープ外** にする項目

- **AI 呼び出しのレート制限**(Phase 5 hardening、IP / member ベース)
- **PaymentChat の shareMemberIds 部分選択 UI**(Phase 3 では「全員 / draft 案そのまま」にとどめる)
- **AI 解説結果のキャッシュ / 永続化**(毎回呼ぶ。コスト気になったら Phase 5 で)
- **OCR 起動からの自動 AI 構造化**(Phase 4 で OCR を作ってから接続)
- **共有メッセージ rewrite 結果の永続化**(セッション内で一時的に上書きするのみ)

これで Phase 3 完了時点で、SPLAI は **「AI が中核機能」というブランドメッセージを実機能で裏打ち**できる。Phase 4(OCR)で「写真 → AI 構造化」も加わり、Phase 1-3 の入力経路が手動 / チャット / 写真の 3 系統になる。
