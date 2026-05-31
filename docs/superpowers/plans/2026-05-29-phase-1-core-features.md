# Phase 1: Core Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ログイン無しでグループを作成し、メンバーを登録し、手動で支払いを記録し、清算結果(貪欲法による最少送金リスト)を表示できる、SPLAI MVP のコアフローを完成させる。

**Architecture:** Phase 0 で構築した FastAPI/Next.js 基盤の上に、4 つの SQLAlchemy モデル(groups/members/payments/payment_shares)、X-Member-Id を `Depends()` で検証する認可、清算用の純粋関数(設計書 付録 A の貪欲法)、6 本の REST エンドポイントを実装する。Frontend は OpenAPI から **kubb で TypeScript 型 + Zod スキーマ + axios クライアント関数を自動生成**し、`/`(landing)と `/g/[uuid]`(group dashboard)の 2 画面で全ユースケースをカバー。

**Tech Stack:** SQLAlchemy 2.x + Alembic、Pydantic 2 (CamelModel)、FastAPI Depends 認可、Next.js 16 App Router、**kubb**(`@kubb/cli` + `plugin-{oas,ts,zod,client}`)、zod v4、react-hook-form + Zod resolver、localStorage(group-scoped key)。

---

## 前提条件

- **Phase 0 が完了済み**(Task 22 DoD 全項目グリーン、main / develop が Branch Protection 有効)
- 作業は **`feature/phase-1-core-features` ブランチ**で行い、**develop へ PR**。Phase 0 の特例(直接 push)は終了
- ローカル `.env.local` に DATABASE_URL(Supabase Session Pooler URL)が設定済み

## 開始前の準備

```bash
cd /Users/koheiseki/dev/git/splai
git checkout develop
git pull --rebase origin develop
git checkout -b feature/phase-1-core-features
```

---

## File Structure

このフェーズで追加・変更されるファイル:

```
splai/
├── backend/
│   ├── alembic/versions/
│   │   └── <rev>_create_core_tables.py        ← Task 2 で新規
│   ├── app/
│   │   ├── models/                             ← Task 1 で新規ディレクトリ
│   │   │   ├── __init__.py
│   │   │   ├── group.py
│   │   │   ├── member.py
│   │   │   ├── payment.py
│   │   │   └── payment_share.py
│   │   ├── schemas/
│   │   │   ├── group.py                        ← Task 5 で新規
│   │   │   ├── member.py
│   │   │   ├── payment.py
│   │   │   └── settlement.py
│   │   ├── services/
│   │   │   └── settlement.py                   ← Task 3(純粋関数)
│   │   ├── auth/                               ← Task 4 で新規ディレクトリ
│   │   │   ├── __init__.py
│   │   │   └── deps.py                         ← X-Member-Id 検証
│   │   ├── exceptions/domain.py                ← Modify(InvalidPaymentShares 追加)
│   │   ├── routers/
│   │   │   ├── groups.py                       ← Task 6, 7
│   │   │   ├── members.py                      ← Task 8
│   │   │   ├── payments.py                     ← Task 9, 10, 11
│   │   │   └── settlement.py                   ← Task 12
│   │   └── main.py                             ← Modify(新規 router 登録)
│   ├── scripts/
│   │   └── dump_openapi.py                     ← Task 13
│   ├── openapi.json                            ← Task 13(生成・追跡対象)
│   └── tests/
│       ├── test_models.py                      ← Task 1
│       ├── test_settlement.py                  ← Task 3
│       ├── test_auth_deps.py                   ← Task 4
│       ├── test_schemas_camel.py               ← Task 5(spot check)
│       ├── test_groups_api.py                  ← Task 6, 7
│       ├── test_members_api.py                 ← Task 8
│       ├── test_payments_api.py                ← Task 9, 10, 11
│       └── test_settlement_api.py              ← Task 12
├── frontend/
│   ├── app/                                    ← Next.js routing 専用(page / layout のみ)
│   │   ├── page.tsx                            ← Modify(Landing、薄い shell。Task 16)
│   │   └── g/
│   │       └── [uuid]/
│   │           └── page.tsx                    ← Task 17(GroupDashboard を呼ぶだけ)
│   ├── features/                               ← ★ ドメイン単位の機能スライス
│   │   ├── groups/
│   │   │   ├── components/                     ← 複数 file 前提でディレクトリ
│   │   │   │   ├── create-group-form.tsx       ← Task 16
│   │   │   │   ├── group-dashboard.tsx         ← Task 17(/g/[uuid] の主要構造)
│   │   │   │   └── member-select.tsx           ← Task 17
│   │   │   ├── api.ts                          ← createGroup, getGroup, addMember
│   │   │   ├── types.ts                        ← group / member 型(必要時)
│   │   │   └── use-group.ts                    ← Task 17(flat 配置、1-2 hook なら hooks/ 不要)
│   │   ├── payments/
│   │   │   ├── components/
│   │   │   │   ├── payment-form.tsx            ← Task 18
│   │   │   │   └── payment-list.tsx            ← Task 19
│   │   │   ├── api.ts                          ← createPayment, deletePayment
│   │   │   └── types.ts
│   │   └── settlement/
│   │       ├── components/
│   │       │   └── settlement-view.tsx         ← Task 20
│   │       ├── api.ts                          ← getSettlement
│   │       └── types.ts
│   ├── components/                             ← 共有 UI(Phase 1 では空、Phase 2 で primitives)
│   ├── hooks/                                  ← ★ 共有 hooks(複数 feature 横断)
│   │   └── use-member-storage.ts               ← Task 15
│   ├── utils/                                  ← ★ 純粋関数 helper(format, calc 等)
│   │   └── format.ts                           ← (必要時、formatYen / formatDate)
│   ├── lib/                                    ← 副作用 / Web API 依存の infra primitives
│   │   ├── api/
│   │   │   ├── api-client.ts                   ← 既存(axios + X-Request-Id interceptor)
│   │   │   ├── kubb-client.ts                  ← Task 14(kubb 生成 client が呼ぶ HTTP 実行関数)
│   │   │   └── gen/                            ← Task 14(kubb 自動生成、追跡対象)
│   │   │       ├── types/                      ←   tag 別 TypeScript 型
│   │   │       ├── zod/                        ←   tag 別 Zod schema
│   │   │       └── clients/                    ←   tag 別 client 関数(createGroup 等)
│   │   ├── auth/
│   │   │   └── member-storage.ts               ← Task 15(localStorage 低レベル)
│   │   ├── env.ts                              ← 既存
│   │   └── request-id.ts                       ← 既存
│   ├── kubb.config.ts                          ← Task 14(codegen 設定)
│   ├── package.json                            ← Modify(kubb deps + codegen script)
│   ├── tsconfig.json                           ← Modify(allowImportingTsExtensions)
│   ├── eslint.config.mjs                       ← Modify(lib/api/gen/** を ignore)
│   └── tests/                                  ← ソース構造を mirror
│       ├── features/
│       │   └── payments/components/payment-form.test.tsx  ← Task 18(smoke)
│       ├── hooks/
│       │   └── use-member-storage.test.ts      ← Task 15
│       └── lib/
│           └── auth/member-storage.test.ts     ← Task 15(低レベル side)
└── docs/
    └── superpowers/plans/
        └── 2026-05-29-phase-1-core-features.md  ← 本ファイル
```

> **ディレクトリの役割分担**(規約 §6.5 と整合):
>
> | 階層            | 役割                                                                           | 例                                         |
> | --------------- | ------------------------------------------------------------------------------ | ------------------------------------------ |
> | `app/`          | Next.js routing(page / layout のみ。中身は features を呼ぶ薄い shell)          | `app/g/[uuid]/page.tsx`                    |
> | `features/<X>/` | **ドメイン単位の自己完結スライス**(components / hooks / api / types)           | `features/payments/`                       |
> | `components/`   | **機能横断の共有 UI primitives**(Phase 1 では空、Phase 2 で `Button` 等を導入) | (将来)                                     |
> | `hooks/`        | **複数 feature が使う共有 hooks**                                              | `use-member-storage.ts`                    |
> | `utils/`        | **純粋関数 helper**(同じ入力 → 同じ出力、外部依存なし)                         | `format.ts`(formatYen, formatDate)         |
> | `lib/`          | **副作用 / Web API 依存の infrastructure primitives**                          | axios インスタンス、localStorage、env 検証 |
>
> **共有 vs 機能特化の判定**:「このファイルが消えると影響する feature 数」が 1 個なら `features/<X>/`、2 個以上なら共有層(`hooks/` / `components/` / `utils/` / `lib/`)へ。
>
> **feature 内の sub-directory 化ルール(昇格)**:`features/<X>/` 内では「**単一ファイルは flat、複数になったら sub-dir に昇格**」を一貫して適用:
>
> | 種別              | 1-2 file                     | 3+ file                      |
> | ----------------- | ---------------------------- | ---------------------------- |
> | hooks(`use-*.ts`) | flat(feature 直下に置く)     | `features/<X>/hooks/` に昇格 |
> | api               | `api.ts`(flat)               | `features/<X>/api/` に昇格   |
> | types             | `types.ts`(flat)             | `features/<X>/types/` に昇格 |
> | utils(機能特化)   | `utils.ts`(flat)             | `features/<X>/utils/` に昇格 |
> | components        | 常に `components/`(複数前提) | (常にディレクトリ)           |
>
> Phase 1 の各 feature は hooks 1 個前後 → **`features/<X>/use-xxx.ts` の flat 配置**を採用。

---

## Tasks

### Task 1: SQLAlchemy モデル(groups / members / payments / payment_shares)

**Files:**

- Create: `backend/app/models/__init__.py`
- Create: `backend/app/models/group.py`
- Create: `backend/app/models/member.py`
- Create: `backend/app/models/payment.py`
- Create: `backend/app/models/payment_share.py`
- Create: `backend/tests/test_models.py`

- [ ] **Step 1: 失敗するテストを書く**

```python
# backend/tests/test_models.py
"""モデル定義の最低限の正常系テスト。
スキーマ詳細(FK、デフォルト値)は alembic migration 適用後の
integration テスト(test_groups_api 等)で確認する。"""
from datetime import date
from uuid import UUID, uuid4

from app.models.group import Group
from app.models.member import Member
from app.models.payment import Payment, PaymentSource
from app.models.payment_share import PaymentShare, ShareType


def test_group_instantiation():
    g = Group(name="渋谷飲み会", event_date=date(2026, 6, 1))
    assert g.name == "渋谷飲み会"
    assert g.event_date == date(2026, 6, 1)
    # currency / created_at / id は DB flush 時に SQLAlchemy / Postgres が default を
    # 適用する(Python 直後は None)。実値の検証は API integration test
    # (test_groups_api)で end-to-end に行う。


def test_member_requires_group_id():
    gid = uuid4()
    m = Member(group_id=gid, name="Alice")
    assert m.name == "Alice"
    assert m.group_id == gid


def test_payment_amount_is_int():
    pid = uuid4()
    mid = uuid4()
    p = Payment(
        group_id=pid,
        payer_id=mid,
        amount=12000,
        description="居酒屋A",
        source=PaymentSource.MANUAL,
    )
    assert isinstance(p.amount, int)
    assert p.source == PaymentSource.MANUAL


def test_payment_share_types():
    sid = uuid4()
    mid = uuid4()
    s = PaymentShare(
        payment_id=sid,
        member_id=mid,
        share_type=ShareType.EQUAL,
        share_value=1.0,
    )
    assert s.share_type == ShareType.EQUAL
```

- [ ] **Step 2: テスト実行 → 失敗を確認**

```bash
cd backend
uv run pytest tests/test_models.py -v
```

期待出力: `ModuleNotFoundError: No module named 'app.models'`

- [ ] **Step 3: `app/models/__init__.py` を作成**

```python
# backend/app/models/__init__.py
"""SQLAlchemy ORM モデル。`from app.models import Group, Member, ...` で使う。"""
from app.models.group import Group
from app.models.member import Member
from app.models.payment import Payment, PaymentSource
from app.models.payment_share import PaymentShare, ShareType

__all__ = [
    "Group",
    "Member",
    "Payment",
    "PaymentSource",
    "PaymentShare",
    "ShareType",
]
```

- [ ] **Step 4: `app/models/group.py` を実装**

```python
# backend/app/models/group.py
from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, String, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Group(Base):
    __tablename__ = "groups"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    event_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="JPY")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
```

- [ ] **Step 5: `app/models/member.py` を実装**

```python
# backend/app/models/member.py
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Member(Base):
    __tablename__ = "members"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    group_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("groups.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
```

- [ ] **Step 6: `app/models/payment.py` を実装**

```python
# backend/app/models/payment.py
from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class PaymentSource(str, enum.Enum):
    MANUAL = "manual"
    OCR = "ocr"
    CHAT = "chat"


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    group_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("groups.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    payer_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("members.id", ondelete="RESTRICT"),
        nullable=False,
    )
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    paid_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    source: Mapped[PaymentSource] = mapped_column(
        Enum(PaymentSource, name="payment_source"),
        nullable=False,
        default=PaymentSource.MANUAL,
    )
    ocr_image_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
```

- [ ] **Step 7: `app/models/payment_share.py` を実装**

```python
# backend/app/models/payment_share.py
from __future__ import annotations

import enum
import uuid
from decimal import Decimal

from sqlalchemy import Enum, ForeignKey, Numeric
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ShareType(str, enum.Enum):
    EQUAL = "equal"
    RATIO = "ratio"
    AMOUNT = "amount"


class PaymentShare(Base):
    __tablename__ = "payment_shares"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    payment_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("payments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    member_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("members.id", ondelete="RESTRICT"),
        nullable=False,
    )
    share_type: Mapped[ShareType] = mapped_column(
        Enum(ShareType, name="share_type"), nullable=False
    )
    share_value: Mapped[Decimal] = mapped_column(
        Numeric(precision=12, scale=4), nullable=False
    )
```

- [ ] **Step 8: テスト実行 → PASS確認**

```bash
uv run pytest tests/test_models.py -v
```

期待出力: 4 passed.

- [ ] **Step 9: コミット**

```bash
git add backend/app/models/ backend/tests/test_models.py
git commit -m "feat(backend): add SQLAlchemy models for groups, members, payments, payment_shares"
```

---

### Task 2: Alembic マイグレーション(コアテーブル作成)

**Files:**

- Create: `backend/alembic/versions/<rev>_create_core_tables.py`(autogenerate)

- [ ] **Step 1: alembic env.py が models をロードしているか確認**

```bash
grep -n "from app.models" backend/alembic/env.py
```

出ていなければ env.py に `from app import models  # noqa: F401` を追加し、`Base.metadata` が models を認識するようにする。

```python
# backend/alembic/env.py の上部に追加
from app import models  # noqa: F401  # SQLAlchemy が Base.metadata に登録するため
from app.db.base import Base
```

- [ ] **Step 2: マイグレーション生成(autogenerate)**

```bash
cd backend
uv run alembic revision --autogenerate -m "create core tables"
```

生成された `backend/alembic/versions/<rev>_create_core_tables.py` を開いて確認:

- `groups`, `members`, `payments`, `payment_shares` の `op.create_table(...)` が含まれること
- ENUM 型(`payment_source`, `share_type`)も生成されていること

- [ ] **Step 3: マイグレーションを目視レビューして手動修正**

`op.create_index` の名前を規約 §7.1 に合わせて整える(`ix_<table>_<columns>` 形式):

```python
# 例(autogenerate が ix_members_group_id を生成しなかった場合に追加)
op.create_index("ix_members_group_id", "members", ["group_id"])
op.create_index("ix_payments_group_id_deleted_at", "payments", ["group_id", "deleted_at"])
op.create_index("ix_payment_shares_payment_id", "payment_shares", ["payment_id"])
```

- [ ] **Step 4: ローカル DB(Supabase Session Pooler 経由)へ適用**

```bash
uv run alembic upgrade head
```

期待出力: `INFO  [alembic.runtime.migration] Running upgrade ... -> <rev>, create core tables`

- [ ] **Step 5: Supabase Dashboard → Table Editor で 4 テーブルが存在することを目視確認**

`groups`, `members`, `payments`, `payment_shares`、それぞれカラム数・型が正しいこと。`alembic_version` の rev が更新されていること。

- [ ] **Step 6: コミット**

```bash
git add backend/alembic/versions/ backend/alembic/env.py
git commit -m "feat(db): create core tables (groups, members, payments, payment_shares)"
```

---

### Task 3: 清算アルゴリズム(貪欲法、純粋関数)

**Files:**

- Create: `backend/app/utils/__init__.py`
- Create: `backend/app/utils/settlement.py`
- Create: `backend/tests/test_settlement.py`

> **配置先 = `app/utils/`**: 清算アルゴリズムは I/O を持たない純粋関数なので `services/` ではなく `utils/` に置く。判断基準は `docs/conventions.md` §5.10、層モデルは `docs/superpowers/specs/design.md` §3「Backend 内部レイヤ構造」を参照。

- [ ] **Step 1: 失敗するテストを書く**

```python
# backend/tests/test_settlement.py
from uuid import uuid4

from app.utils.settlement import Transfer, settle


def test_empty_returns_no_transfers():
    assert settle({}) == []


def test_balanced_zero_returns_no_transfers():
    a, b = uuid4(), uuid4()
    assert settle({a: 0, b: 0}) == []


def test_two_party_simple_case():
    a, b = uuid4(), uuid4()
    # b が a に 1000 払う
    transfers = settle({a: 1000, b: -1000})
    assert transfers == [Transfer(from_id=b, to_id=a, amount=1000)]


def test_three_party_minimization():
    """A=+3000, B=-1000, C=-2000 → 送金 2 回(B→A 1000, C→A 2000)"""
    a, b, c = uuid4(), uuid4(), uuid4()
    transfers = settle({a: 3000, b: -1000, c: -2000})

    # 送金回数の最小化(=N-1 以下に抑える)
    assert len(transfers) == 2

    # 全 transfer の合計が a への流入と一致
    in_to_a = sum(t.amount for t in transfers if t.to_id == a)
    assert in_to_a == 3000


def test_returns_immutable_result():
    """元の dict を破壊しないこと(関数の冪等性)"""
    a, b = uuid4(), uuid4()
    balances = {a: 1000, b: -1000}
    settle(balances)
    assert balances == {a: 1000, b: -1000}
```

- [ ] **Step 2: テスト実行 → 失敗を確認**

```bash
uv run pytest tests/test_settlement.py -v
```

期待出力: `ModuleNotFoundError: No module named 'app.utils'`

- [ ] **Step 3: `app/utils/__init__.py` を作成**

```python
# backend/app/utils/__init__.py
```

- [ ] **Step 4: `app/utils/settlement.py` を実装**

```python
# backend/app/utils/settlement.py
"""清算アルゴリズム(設計書 付録 A の貪欲法)。

純粋関数:net_balances(各メンバーのネット収支)→ 最少送金回数の Transfer リスト。
DB / I/O に依存しないので単体テストで完結する。"""
from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID


@dataclass(frozen=True)
class Transfer:
    """1 件の送金。amount は常に正の整数(JPY)。"""

    from_id: UUID
    to_id: UUID
    amount: int


def settle(net_balances: dict[UUID, int]) -> list[Transfer]:
    """ネット収支から送金リストを生成する。

    Args:
        net_balances: {member_id: net_amount}。プラス=受け取る、マイナス=払う。
            合計は 0 を前提とするが、丸め誤差 1 円程度なら許容(清算は近似値で十分)。

    Returns:
        Transfer のリスト。要素数は最少。アルゴリズム的最適性は保証しないが
        N-1 件以下に抑える。
    """
    creditors = sorted(
        [(m, b) for m, b in net_balances.items() if b > 0],
        key=lambda x: -x[1],  # 受取額が大きい順
    )
    debtors = sorted(
        [(m, b) for m, b in net_balances.items() if b < 0],
        key=lambda x: x[1],  # 支払額が大きい順(マイナス値の昇順)
    )

    transfers: list[Transfer] = []
    i, j = 0, 0
    # 元の dict を壊さないようにローカル変数でコピー
    debtors = list(debtors)
    creditors = list(creditors)

    while i < len(debtors) and j < len(creditors):
        debtor_id, debt = debtors[i]
        creditor_id, credit = creditors[j]
        amount = min(-debt, credit)
        if amount > 0:
            transfers.append(
                Transfer(from_id=debtor_id, to_id=creditor_id, amount=amount)
            )
        debtors[i] = (debtor_id, debt + amount)
        creditors[j] = (creditor_id, credit - amount)
        if debtors[i][1] == 0:
            i += 1
        if creditors[j][1] == 0:
            j += 1

    return transfers
```

- [ ] **Step 5: テスト実行 → PASS確認**

```bash
uv run pytest tests/test_settlement.py -v
```

期待出力: 5 passed.

- [ ] **Step 6: コミット**

```bash
git add backend/app/services/ backend/tests/test_settlement.py
git commit -m "feat(backend): add settlement greedy algorithm (pure function)"
```

---

### Task 4: X-Member-Id 認可(`Depends()` ベース)

**Files:**

- Create: `backend/app/auth/__init__.py`
- Create: `backend/app/auth/deps.py`
- Modify: `backend/app/exceptions/domain.py`(MemberMismatch は既存、念のため確認)
- Create: `backend/tests/test_auth_deps.py`

- [ ] **Step 1: 失敗するテストを書く**

```python
# backend/tests/test_auth_deps.py
import os
from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.auth.deps import require_member
from app.db.session import SessionLocal
from app.exceptions.handlers import register_exception_handlers
from app.models import Group, Member


# テストごとに独立したテーブル状態を作るため pytest-asyncio で実 DB を使う。
# 既存の conftest が DATABASE_URL=postgresql+asyncpg://test:test@localhost/test を
# default 値として注入しているが、ここでは Supabase Pooler 経由の実 DB が必要なので
# APP_ENV=dev で一時的にスイッチさせる(integration test の標準パターン)。


@pytest.fixture(autouse=True)
def _use_dev_env(monkeypatch):
    monkeypatch.setenv("APP_ENV", "dev")
    yield


def _build_app() -> FastAPI:
    from app.main import create_app

    return create_app()


@pytest.mark.asyncio
async def test_require_member_returns_member_when_belongs_to_group():
    """member が指定 group に属していれば Member を返す。"""
    async with SessionLocal() as db:
        group = Group(name="test")
        db.add(group)
        await db.flush()
        member = Member(group_id=group.id, name="Alice")
        db.add(member)
        await db.commit()
        await db.refresh(member)
        gid, mid = group.id, member.id

    # require_member は path から group_id、Header から x_member_id を受け取る
    # ここでは中身の SQL クエリ動作を直接確認する関数として使う
    async with SessionLocal() as db:
        result = await require_member(group_id=gid, x_member_id=mid, db=db)
        assert result.id == mid
        assert result.group_id == gid


@pytest.mark.asyncio
async def test_require_member_raises_when_member_in_different_group():
    """member が指定 group に属していなければ MemberMismatch を投げる。"""
    from app.exceptions.domain import MemberMismatch

    async with SessionLocal() as db:
        g1 = Group(name="group1")
        g2 = Group(name="group2")
        db.add_all([g1, g2])
        await db.flush()
        m_in_g1 = Member(group_id=g1.id, name="Alice")
        db.add(m_in_g1)
        await db.commit()
        await db.refresh(m_in_g1)
        g2_id, mid = g2.id, m_in_g1.id

    async with SessionLocal() as db:
        with pytest.raises(MemberMismatch):
            await require_member(group_id=g2_id, x_member_id=mid, db=db)
```

> **テストデータ管理の補足**: 上記は実 DB に書き込むので、Phase 1 中は **専用のテスト DB**(別 Supabase プロジェクト or ローカル Postgres)を用意するのが望ましい。Phase 1 のスコープではまず本番 dev DB で書き込み・テストするが、Phase 5 で testcontainers / Supabase branch DB へ切り替える(設計書 §10)。

- [ ] **Step 2: テスト実行 → 失敗を確認**

```bash
uv run pytest tests/test_auth_deps.py -v
```

期待出力: `ModuleNotFoundError: No module named 'app.auth'`

- [ ] **Step 3: `app/auth/__init__.py` と `app/auth/deps.py` を実装**

```python
# backend/app/auth/__init__.py
```

```python
# backend/app/auth/deps.py
"""認可関連の FastAPI Depends。

設計書 §2 / §7 共通仕様:
- POST /api/groups を除く全エンドポイントで X-Member-Id ヘッダ必須
- ヘッダの member_id が path の group_id に属する Member であることを検証
- 不一致は MemberMismatch (HTTP 401) を投げる
"""
from __future__ import annotations

from uuid import UUID

from fastapi import Depends, Header
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.exceptions.domain import MemberMismatch
from app.models import Member


async def require_member(
    group_id: UUID,
    x_member_id: UUID = Header(..., alias="X-Member-Id"),
    db: AsyncSession = Depends(get_session),
) -> Member:
    """X-Member-Id が path の group_id に属するメンバーであることを検証して返す。

    使用例:
        @router.get("/api/groups/{group_id}")
        async def get_group(
            group_id: UUID,
            member: Member = Depends(require_member),
        ):
            ...
    """
    member = await db.scalar(
        select(Member).where(
            Member.id == x_member_id,
            Member.group_id == group_id,
        )
    )
    if member is None:
        raise MemberMismatch(
            f"member {x_member_id} is not a member of group {group_id}"
        )
    return member
```

- [ ] **Step 4: テスト実行 → PASS確認**

```bash
uv run pytest tests/test_auth_deps.py -v
```

期待出力: 2 passed.

- [ ] **Step 5: コミット**

```bash
git add backend/app/auth/ backend/tests/test_auth_deps.py
git commit -m "feat(auth): add require_member Depends for X-Member-Id validation"
```

---

### Task 5: Pydantic スキーマ(Request / Response)

**Files:**

- Create: `backend/app/schemas/group.py`
- Create: `backend/app/schemas/member.py`
- Create: `backend/app/schemas/payment.py`
- Create: `backend/app/schemas/settlement.py`
- Create: `backend/tests/test_schemas_camel.py`

- [ ] **Step 1: 失敗する spot-check テストを書く**

```python
# backend/tests/test_schemas_camel.py
"""各 schema が CamelModel を継承して JSON は camelCase になることを spot-check。
詳細な型検証は API テスト(test_groups_api 等)で確認する。"""
from datetime import date
from uuid import uuid4

from app.schemas.group import CreateGroupRequest, GroupResponse
from app.schemas.payment import CreatePaymentRequest, ShareInput


def test_create_group_request_accepts_camel_case():
    data = {
        "name": "渋谷飲み会",
        "eventDate": "2026-06-01",
        "memberNames": ["Alice", "Bob"],
    }
    req = CreateGroupRequest.model_validate(data)
    assert req.name == "渋谷飲み会"
    assert req.event_date == date(2026, 6, 1)
    assert req.member_names == ["Alice", "Bob"]


def test_group_response_dumps_camel_case():
    g = GroupResponse(
        id=uuid4(),
        name="x",
        event_date=None,
        currency="JPY",
        creator_member_id=uuid4(),
    )
    dumped = g.model_dump(by_alias=True)
    assert "creatorMemberId" in dumped
    assert "eventDate" in dumped


def test_create_payment_request_share_input():
    pid = uuid4()
    req = CreatePaymentRequest.model_validate(
        {
            "payerId": str(pid),
            "amount": 12000,
            "description": "居酒屋A",
            "shares": [
                {"memberId": str(pid), "shareType": "equal", "shareValue": 1.0},
            ],
        }
    )
    assert req.payer_id == pid
    assert req.amount == 12000
    assert req.shares[0].share_type == "equal"
```

- [ ] **Step 2: テスト実行 → 失敗確認**

```bash
uv run pytest tests/test_schemas_camel.py -v
```

期待出力: ImportError(モジュール未作成)

- [ ] **Step 3: `app/schemas/group.py` 実装**

```python
# backend/app/schemas/group.py
from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from pydantic import Field

from app.schemas.base import CamelModel
from app.schemas.payment import PaymentSummary


class CreateGroupRequest(CamelModel):
    name: str = Field(min_length=1, max_length=100)
    event_date: date | None = None
    member_names: list[str] = Field(default_factory=list, max_length=20)


class MemberSummary(CamelModel):
    id: UUID
    name: str
    created_at: datetime


class GroupResponse(CamelModel):
    id: UUID
    name: str
    event_date: date | None
    currency: str
    creator_member_id: UUID | None = None
    members: list[MemberSummary] = Field(default_factory=list)
    payments: list[PaymentSummary] = Field(default_factory=list)
```

> **Note**: `payment.py` は `group.py` を参照しないため循環 import は発生せず、`PaymentSummary` は通常通り上部 import で OK。
> もし将来 `payment.py` 側から `GroupResponse` を参照する必要が出た場合は、片方を末尾 import + `model_rebuild()` で遅延解決する pattern が必要になる。

- [ ] **Step 4: `app/schemas/member.py` 実装**

```python
# backend/app/schemas/member.py
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import Field

from app.schemas.base import CamelModel


class CreateMemberRequest(CamelModel):
    name: str = Field(min_length=1, max_length=50)


class MemberResponse(CamelModel):
    id: UUID
    group_id: UUID
    name: str
    created_at: datetime
```

- [ ] **Step 5: `app/schemas/payment.py` 実装**

```python
# backend/app/schemas/payment.py
from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import Field

from app.schemas.base import CamelModel


class ShareInput(CamelModel):
    member_id: UUID
    share_type: Literal["equal", "ratio", "amount"]
    share_value: float = Field(gt=0)


class ShareSummary(CamelModel):
    member_id: UUID
    share_type: Literal["equal", "ratio", "amount"]
    share_value: float


class CreatePaymentRequest(CamelModel):
    payer_id: UUID
    amount: int = Field(gt=0)
    description: str = Field(default="", max_length=500)
    paid_at: datetime | None = None
    shares: list[ShareInput] = Field(min_length=1)


class UpdatePaymentRequest(CamelModel):
    payer_id: UUID | None = None
    amount: int | None = Field(default=None, gt=0)
    description: str | None = Field(default=None, max_length=500)
    paid_at: datetime | None = None
    shares: list[ShareInput] | None = None


class PaymentSummary(CamelModel):
    id: UUID
    payer_id: UUID
    amount: int
    description: str
    paid_at: datetime
    source: Literal["manual", "ocr", "chat"]
    shares: list[ShareSummary] = Field(default_factory=list)
```

- [ ] **Step 6: `app/schemas/settlement.py` 実装**

```python
# backend/app/schemas/settlement.py
from __future__ import annotations

from uuid import UUID

from app.schemas.base import CamelModel


class TransferDTO(CamelModel):
    from_id: UUID
    to_id: UUID
    amount: int


class SettlementResponse(CamelModel):
    transfers: list[TransferDTO]
    net_balances: dict[str, int]  # str key for JSON compat (UUID stringified)
```

- [ ] **Step 7: テスト実行 → PASS確認**

```bash
uv run pytest tests/test_schemas_camel.py -v
```

期待出力: 3 passed.

- [ ] **Step 8: コミット**

```bash
git add backend/app/schemas/ backend/tests/test_schemas_camel.py
git commit -m "feat(backend): add Pydantic schemas for groups/members/payments/settlement"
```

---

### Task 6: API: `POST /api/groups`(グループ作成)

**Files:**

- Create: `backend/app/api/__init__.py`
- Create: `backend/app/api/groups.py`(router)
- Create: `backend/app/services/groups.py`(service: DB + ビジネスルール)
- Create: `backend/tests/test_groups_api.py`(integration test)
- Modify: `backend/app/main.py`(router 登録)

> **レイヤ分離**: Task 6〜12 はすべて以下のパターンで実装する。
>
> - **router** (`app/api/`): HTTP I/O・認可・DTO 変換のみ。`db.add()` などを書かない。
> - **service** (`app/services/`): DB 読み書き、トランザクション境界、ビジネスルール。ORM model を返す(Pydantic schema には依存しない)。
> - **utils** (`app/utils/`): 純粋関数のみ。
>
> 詳細は `docs/conventions.md` §5.10、`docs/superpowers/specs/design.md` §3 参照。

- [ ] **Step 0: `tests/conftest.py` に共通 `client` fixture を追加**(初回 API テスト時のみ)

API integration test は以下の fixture を共通利用する。`fastapi.testclient.TestClient` ではなく `httpx.AsyncClient` + `ASGITransport` を使う理由は、`asyncpg` と TestClient の event loop 競合(`Future attached to a different loop`)を回避するため。

```python
# backend/tests/conftest.py に追加(top-level の env setup の後)
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.config import get_settings
from app.db.session import get_session
from app.main import app


@pytest.fixture
async def client():
    """API integration test 用の AsyncClient(各テスト fresh engine + NullPool)。

    - TestClient を使った場合の event loop 競合を回避
    - NullPool により test 間で connection を共有しない
    - `.env.local` の DATABASE_URL に接続する(conftest top-level で設定済み)
    - test ごとにユニークな group 名を使えば dev DB のデータ汚染は問題にならない
    """
    settings = get_settings()
    engine = create_async_engine(settings.database_url, poolclass=NullPool)
    SessionLocal = async_sessionmaker(engine, expire_on_commit=False)

    async def _override_get_session():
        async with SessionLocal() as session:
            yield session

    app.dependency_overrides[get_session] = _override_get_session
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            yield ac
    finally:
        app.dependency_overrides.clear()
        await engine.dispose()
```

加えて、`conftest.py` の top-level で `.env.local` の `DATABASE_URL` を test 用 `os.environ` にセットする必要がある(engine が module import 時に作られるため)。Phase 0 で書いた conftest を以下のように更新:

```python
# conftest.py 冒頭(import os の直後)
import os
from pathlib import Path
from dotenv import dotenv_values

os.environ.setdefault("APP_ENV", "test")
_env_file = Path(__file__).parent.parent / ".env.local"
_real_db_url = dotenv_values(_env_file).get("DATABASE_URL")
os.environ.setdefault(
    "DATABASE_URL",
    _real_db_url or "postgresql+asyncpg://test:test@localhost/test",
)
```

- [ ] **Step 1: 失敗するテストを書く**

```python
# backend/tests/test_groups_api.py
from httpx import AsyncClient


async def test_create_group_returns_201_with_creator_member_id(client: AsyncClient):
    res = await client.post(
        "/api/groups",
        json={"name": "渋谷飲み会", "memberNames": ["Alice", "Bob"]},
    )
    assert res.status_code == 201
    body = res.json()
    assert body["name"] == "渋谷飲み会"
    assert body["id"]
    assert body["creatorMemberId"]
    # creator_member_id は memberNames の先頭("Alice")の id
    assert len(body["members"]) == 2
    assert body["members"][0]["name"] == "Alice"


async def test_create_group_with_no_members_creates_empty_group(client: AsyncClient):
    res = await client.post(
        "/api/groups", json={"name": "未確定", "memberNames": []}
    )
    assert res.status_code == 201
    body = res.json()
    assert body["members"] == []
    assert body["creatorMemberId"] is None


async def test_create_group_validates_name_required(client: AsyncClient):
    res = await client.post("/api/groups", json={"memberNames": []})
    assert res.status_code == 422
```

> **`pytest-asyncio` の `asyncio_mode = "auto"`** 設定により、`async def test_*` は自動的に async test として扱われる(`@pytest.mark.asyncio` 不要)。`pyproject.toml` で設定済み。

- [ ] **Step 2: テスト実行 → 失敗確認**

```bash
uv run pytest tests/test_groups_api.py -v
```

期待出力: 404 になる(エンドポイント未実装)。

- [ ] **Step 3: `app/services/groups.py` を実装(DB + ビジネスルール)**

```python
# backend/app/services/groups.py
"""グループドメインのビジネスロジック(DB 操作とビジネスルール)。

router からは HTTP・DTO 変換を取り除き、ここに DB 読み書き・トランザクション境界・
複数エンティティの atomic 作成等を集約する。Pydantic schema には依存しない
(プリミティブ引数 → ORM model 戻り値)。
"""
from __future__ import annotations

from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Group, Member


async def create_group_with_initial_members(
    db: AsyncSession,
    *,
    name: str,
    event_date: date | None,
    member_names: list[str],
) -> tuple[Group, list[Member]]:
    """グループ + 初期メンバーを 1 トランザクションで作成する。

    member_names の順序は意味を持つ。先頭が「作成者」(creator)として扱われる。
    """
    group = Group(name=name, event_date=event_date)
    db.add(group)
    await db.flush()  # group.id を確定させる

    members = [Member(group_id=group.id, name=n) for n in member_names]
    db.add_all(members)
    await db.commit()
    await db.refresh(group)
    for m in members:
        await db.refresh(m)

    return group, members
```

- [ ] **Step 4: `app/api/__init__.py` を作成**

```python
# backend/app/api/__init__.py
```

- [ ] **Step 5: `app/api/groups.py` を実装(router: HTTP I/O のみ)**

```python
# backend/app/api/groups.py
from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.schemas.group import CreateGroupRequest, GroupResponse, MemberSummary
from app.services import groups as groups_service

router = APIRouter(prefix="/api/groups", tags=["groups"])


@router.post("", status_code=status.HTTP_201_CREATED, response_model=GroupResponse)
async def create_group(
    body: CreateGroupRequest,
    db: AsyncSession = Depends(get_session),
) -> GroupResponse:
    """グループを新規作成し、初期メンバーも一緒に登録する。

    認可なし: グループ作成時はまだ member が存在しないため X-Member-Id を要求しない
    (設計書 §7 共通仕様の例外)。
    """
    group, members = await groups_service.create_group_with_initial_members(
        db,
        name=body.name,
        event_date=body.event_date,
        member_names=body.member_names,
    )

    return GroupResponse(
        id=group.id,
        name=group.name,
        event_date=group.event_date,
        currency=group.currency,
        creator_member_id=members[0].id if members else None,
        members=[
            MemberSummary(id=m.id, name=m.name, created_at=m.created_at)
            for m in members
        ],
        payments=[],
    )
```

- [ ] **Step 6: `app/main.py` に router を登録**

```python
# 既存の include_router 群を更新:
from app.api import groups, health

# create_app 内:
app.include_router(health.router)
app.include_router(groups.router)
```

> **ディレクトリは `app/api/` に統一**: Phase 0 で作った `app/routers/health.py` は Task 6 着手時に `app/api/health.py` に移し、`app/routers/` ディレクトリは削除する(8 行の小さなファイルなので機能影響なし)。Phase 1 以降で追加する endpoint は全て `app/api/` 配下に置く。

- [ ] **Step 7: テスト実行 → PASS確認**

```bash
uv run pytest tests/test_groups_api.py -v
```

期待出力: 3 passed.

- [ ] **Step 8: コミット**

```bash
git add backend/app/api/ backend/app/services/groups.py backend/app/main.py backend/tests/test_groups_api.py
git commit -m "feat(api): add POST /api/groups (create group with initial members)"
```

---

### Task 7: API: `GET /api/groups/{group_id}`(グループ詳細取得)

**Files:**

- Modify: `backend/app/services/groups.py`(`get_group_full` を追加)
- Modify: `backend/app/api/groups.py`(GET endpoint 追加)
- Modify: `backend/tests/test_groups_api.py`

> **Task 7-12 の API 整合テスト共通**: Task 6 で `tests/conftest.py` に追加した `client` fixture(AsyncClient + NullPool)を全テストで使う。下記サンプルが `TestClient(app).post(...)` などの旧形式で書かれている場合は、Task 6 の AsyncClient パターンに置き換えて実装する:
>
> - `def test_xxx():` → `async def test_xxx(client: AsyncClient):`
> - `TestClient(app).post(...)` → `await client.post(...)`
> - `_use_dev_env` のような APP_ENV monkeypatch fixture は不要(conftest top-level が `.env.local` の URL を設定済み)。

- [ ] **Step 1: 失敗するテストを書く**(test_groups_api.py に追記)

```python
# tests/test_groups_api.py に追加
def test_get_group_returns_full_payload():
    client = TestClient(app)
    create_res = client.post(
        "/api/groups", json={"name": "g1", "memberNames": ["Alice", "Bob"]}
    )
    gid = create_res.json()["id"]
    creator_mid = create_res.json()["creatorMemberId"]

    res = client.get(f"/api/groups/{gid}", headers={"X-Member-Id": creator_mid})
    assert res.status_code == 200
    body = res.json()
    assert body["id"] == gid
    assert len(body["members"]) == 2
    assert body["payments"] == []


def test_get_group_returns_401_when_member_id_missing():
    client = TestClient(app)
    res = client.get(f"/api/groups/{UUID(int=0)}")
    assert res.status_code == 422  # Header 不足は FastAPI が 422 を返す


def test_get_group_returns_401_when_member_not_in_group():
    client = TestClient(app, raise_server_exceptions=False)
    create_res = client.post("/api/groups", json={"name": "g1", "memberNames": ["A"]})
    gid = create_res.json()["id"]

    # 別の存在しない member_id で叩く
    bogus = "00000000-0000-0000-0000-000000000000"
    res = client.get(f"/api/groups/{gid}", headers={"X-Member-Id": bogus})
    assert res.status_code == 401
```

- [ ] **Step 2: テスト実行 → 失敗確認**

```bash
uv run pytest tests/test_groups_api.py::test_get_group_returns_full_payload -v
```

期待出力: 405 か 404(エンドポイント未実装)。

- [ ] **Step 3: `services/groups.py` に取得ロジックを追加**

```python
# backend/app/services/groups.py に追加
from uuid import UUID

from sqlalchemy import select

from app.exceptions.domain import GroupNotFound
from app.models import Group, Member, Payment, PaymentShare


async def get_group_full(
    db: AsyncSession,
    *,
    group_id: UUID,
) -> tuple[Group, list[Member], list[Payment], dict[UUID, list[PaymentShare]]]:
    """グループ + メンバー + 未削除支払い + 各支払いの shares を取得する。

    Phase 1 では Payment ↔ PaymentShare の relationship を ORM 上で
    定義していないため、shares は別クエリで取得する(YAGNI。Phase 5 で
    パフォーマンス改善時に relationship + selectinload を導入する)。
    """
    group = await db.scalar(select(Group).where(Group.id == group_id))
    if group is None or group.deleted_at is not None:
        raise GroupNotFound(f"group {group_id} not found")

    members = (
        await db.scalars(
            select(Member).where(Member.group_id == group_id).order_by(Member.created_at)
        )
    ).all()

    payments = (
        await db.scalars(
            select(Payment)
            .where(Payment.group_id == group_id, Payment.deleted_at.is_(None))
            .order_by(Payment.paid_at.desc())
        )
    ).all()

    payment_ids = [p.id for p in payments]
    shares_by_payment: dict[UUID, list[PaymentShare]] = {pid: [] for pid in payment_ids}
    if payment_ids:
        shares_rows = await db.scalars(
            select(PaymentShare).where(PaymentShare.payment_id.in_(payment_ids))
        )
        for s in shares_rows.all():
            shares_by_payment[s.payment_id].append(s)

    return group, list(members), list(payments), shares_by_payment
```

- [ ] **Step 4: `api/groups.py` に GET 実装(router: DTO 変換のみ)**

```python
# backend/app/api/groups.py に追加
from uuid import UUID

from app.auth.deps import require_member
from app.models import Member
from app.schemas.payment import PaymentSummary, ShareSummary


@router.get("/{group_id}", response_model=GroupResponse)
async def get_group(
    group_id: UUID,
    member: Member = Depends(require_member),
    db: AsyncSession = Depends(get_session),
) -> GroupResponse:
    """グループ情報 + メンバー + 未削除の支払い一覧を取得。"""
    group, members, payments, shares_by_payment = await groups_service.get_group_full(
        db, group_id=group_id
    )

    return GroupResponse(
        id=group.id,
        name=group.name,
        event_date=group.event_date,
        currency=group.currency,
        creator_member_id=None,
        members=[MemberSummary(id=m.id, name=m.name, created_at=m.created_at) for m in members],
        payments=[
            PaymentSummary(
                id=p.id,
                payer_id=p.payer_id,
                amount=p.amount,
                description=p.description,
                paid_at=p.paid_at,
                source=p.source.value,
                shares=[
                    ShareSummary(
                        member_id=s.member_id,
                        share_type=s.share_type.value,
                        share_value=float(s.share_value),
                    )
                    for s in shares_by_payment.get(p.id, [])
                ],
            )
            for p in payments
        ],
    )
```

- [ ] **Step 5: テスト実行 → PASS確認**

```bash
uv run pytest tests/test_groups_api.py -v
```

期待出力: 6 passed(Task 6 の 3 + 今回の 3)。

- [ ] **Step 6: コミット**

```bash
git add backend/app/api/groups.py backend/app/services/groups.py backend/tests/test_groups_api.py
git commit -m "feat(api): add GET /api/groups/{id} with X-Member-Id authorization"
```

---

### Task 8: API: `POST /api/groups/{group_id}/members`(メンバー追加)

**Files:**

- Create: `backend/app/services/members.py`
- Create: `backend/app/api/members.py`
- Create: `backend/tests/test_members_api.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: 失敗するテストを書く**

```python
# backend/tests/test_members_api.py
import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(autouse=True)
def _use_dev_env(monkeypatch):
    monkeypatch.setenv("APP_ENV", "dev")
    yield


def test_add_member_returns_201():
    client = TestClient(app)
    create_res = client.post(
        "/api/groups", json={"name": "g1", "memberNames": ["Alice"]}
    )
    gid = create_res.json()["id"]
    creator_mid = create_res.json()["creatorMemberId"]

    res = client.post(
        f"/api/groups/{gid}/members",
        json={"name": "Bob"},
        headers={"X-Member-Id": creator_mid},
    )
    assert res.status_code == 201
    body = res.json()
    assert body["name"] == "Bob"
    assert body["groupId"] == gid


def test_add_member_requires_x_member_id():
    client = TestClient(app)
    create_res = client.post("/api/groups", json={"name": "g1", "memberNames": ["A"]})
    gid = create_res.json()["id"]
    res = client.post(f"/api/groups/{gid}/members", json={"name": "Bob"})
    assert res.status_code == 422  # Header 不足
```

- [ ] **Step 2: テスト実行 → 失敗確認**

```bash
uv run pytest tests/test_members_api.py -v
```

- [ ] **Step 3: `services/members.py` 実装(DB)**

```python
# backend/app/services/members.py
from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Member


async def add_member_to_group(
    db: AsyncSession,
    *,
    group_id: UUID,
    name: str,
) -> Member:
    """既存グループにメンバーを 1 名追加する。"""
    new_member = Member(group_id=group_id, name=name)
    db.add(new_member)
    await db.commit()
    await db.refresh(new_member)
    return new_member
```

- [ ] **Step 4: `api/members.py` 実装(router)**

```python
# backend/app/api/members.py
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import require_member
from app.db.session import get_session
from app.models import Member
from app.schemas.member import CreateMemberRequest, MemberResponse
from app.services import members as members_service

router = APIRouter(prefix="/api/groups/{group_id}/members", tags=["members"])


@router.post("", status_code=status.HTTP_201_CREATED, response_model=MemberResponse)
async def add_member(
    group_id: UUID,
    body: CreateMemberRequest,
    _requester: Member = Depends(require_member),
    db: AsyncSession = Depends(get_session),
) -> MemberResponse:
    new_member = await members_service.add_member_to_group(
        db, group_id=group_id, name=body.name
    )
    return MemberResponse(
        id=new_member.id,
        group_id=new_member.group_id,
        name=new_member.name,
        created_at=new_member.created_at,
    )
```

- [ ] **Step 5: `app/main.py` に router 登録**

```python
from app.api import groups, members  # 追加
...
app.include_router(members.router)
```

- [ ] **Step 6: テスト実行 → PASS確認**

```bash
uv run pytest tests/test_members_api.py -v
```

- [ ] **Step 7: コミット**

```bash
git add backend/app/api/members.py backend/app/services/members.py backend/app/main.py backend/tests/test_members_api.py
git commit -m "feat(api): add POST /api/groups/{id}/members"
```

---

### Task 9: API: `POST /api/groups/{group_id}/payments`(支払い登録)

**Files:**

- Create: `backend/app/services/payments.py`
- Create: `backend/app/api/payments.py`
- Create: `backend/tests/test_payments_api.py`
- Modify: `backend/app/main.py`
- Modify: `backend/app/exceptions/domain.py`(InvalidPaymentShares 追加)

- [ ] **Step 1: ドメイン例外を追加**

```python
# backend/app/exceptions/domain.py の末尾に追加
class InvalidPaymentShares(SplaiError):
    status_code = 400
    type_slug = "invalid-payment-shares"
    title = "Invalid Payment Shares"
```

- [ ] **Step 2: 失敗するテストを書く**

```python
# backend/tests/test_payments_api.py
import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(autouse=True)
def _use_dev_env(monkeypatch):
    monkeypatch.setenv("APP_ENV", "dev")
    yield


def _create_group_with_members(client: TestClient, member_names: list[str]):
    res = client.post("/api/groups", json={"name": "g", "memberNames": member_names})
    body = res.json()
    return body["id"], body["creatorMemberId"], body["members"]


def test_create_payment_with_equal_shares():
    client = TestClient(app)
    gid, creator_mid, members = _create_group_with_members(client, ["A", "B", "C"])

    res = client.post(
        f"/api/groups/{gid}/payments",
        headers={"X-Member-Id": creator_mid},
        json={
            "payerId": creator_mid,
            "amount": 12000,
            "description": "居酒屋A",
            "shares": [
                {"memberId": m["id"], "shareType": "equal", "shareValue": 1.0}
                for m in members
            ],
        },
    )
    assert res.status_code == 201
    body = res.json()
    assert body["amount"] == 12000
    assert len(body["shares"]) == 3


def test_create_payment_rejects_share_for_non_member():
    client = TestClient(app)
    gid, creator_mid, _ = _create_group_with_members(client, ["A"])

    bogus = "00000000-0000-0000-0000-000000000000"
    res = client.post(
        f"/api/groups/{gid}/payments",
        headers={"X-Member-Id": creator_mid},
        json={
            "payerId": creator_mid,
            "amount": 1000,
            "description": "x",
            "shares": [{"memberId": bogus, "shareType": "equal", "shareValue": 1.0}],
        },
    )
    assert res.status_code == 400
    assert res.json()["type"].endswith("/invalid-payment-shares")
```

- [ ] **Step 3: テスト実行 → 失敗確認**

```bash
uv run pytest tests/test_payments_api.py -v
```

- [ ] **Step 4: `services/payments.py` 実装(DB + ビジネスルール)**

```python
# backend/app/services/payments.py
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions.domain import InvalidPaymentShares
from app.models import Member, Payment, PaymentShare, PaymentSource, ShareType


@dataclass(frozen=True)
class ShareInputDTO:
    """service 層の入力 DTO(Pydantic 非依存)。

    api 層は CreatePaymentRequest.shares を ShareInputDTO のリストに
    変換してから service を呼ぶ。
    """

    member_id: UUID
    share_type: str  # "equal" | "ratio" | "amount"
    share_value: float


async def create_payment_with_shares(
    db: AsyncSession,
    *,
    group_id: UUID,
    payer_id: UUID,
    amount: int,
    description: str,
    paid_at: datetime | None,
    shares: list[ShareInputDTO],
) -> tuple[Payment, list[PaymentShare]]:
    """支払い + shares を 1 トランザクションで作成する。

    payer_id と全 shares の member_id が group_id に属していることを検証し、
    属していなければ InvalidPaymentShares を raise する。
    """
    member_ids = {s.member_id for s in shares} | {payer_id}
    rows = await db.scalars(
        select(Member.id).where(
            Member.group_id == group_id, Member.id.in_(member_ids)
        )
    )
    valid_ids = set(rows.all())
    invalid = member_ids - valid_ids
    if invalid:
        raise InvalidPaymentShares(
            f"members {sorted(map(str, invalid))} are not in group {group_id}"
        )

    payment = Payment(
        group_id=group_id,
        payer_id=payer_id,
        amount=amount,
        description=description,
        paid_at=paid_at or datetime.now(tz=timezone.utc),
        source=PaymentSource.MANUAL,
    )
    db.add(payment)
    await db.flush()

    share_models = [
        PaymentShare(
            payment_id=payment.id,
            member_id=s.member_id,
            share_type=ShareType(s.share_type),
            share_value=s.share_value,
        )
        for s in shares
    ]
    db.add_all(share_models)
    await db.commit()
    await db.refresh(payment)
    return payment, share_models
```

- [ ] **Step 5: `api/payments.py` 実装(router)**

```python
# backend/app/api/payments.py
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import require_member
from app.db.session import get_session
from app.models import Member
from app.schemas.payment import (
    CreatePaymentRequest,
    PaymentSummary,
    ShareSummary,
)
from app.services import payments as payments_service
from app.services.payments import ShareInputDTO

# すべての payment 系 endpoint を /api/groups/{group_id}/payments 配下に統合
# (PATCH/DELETE も group_id を path に持たせ、Depends(require_member) を再利用)
router = APIRouter(prefix="/api/groups/{group_id}/payments", tags=["payments"])


@router.post("", status_code=status.HTTP_201_CREATED, response_model=PaymentSummary)
async def create_payment(
    group_id: UUID,
    body: CreatePaymentRequest,
    _requester: Member = Depends(require_member),
    db: AsyncSession = Depends(get_session),
) -> PaymentSummary:
    payment, share_models = await payments_service.create_payment_with_shares(
        db,
        group_id=group_id,
        payer_id=body.payer_id,
        amount=body.amount,
        description=body.description,
        paid_at=body.paid_at,
        shares=[
            ShareInputDTO(
                member_id=s.member_id,
                share_type=s.share_type,
                share_value=s.share_value,
            )
            for s in body.shares
        ],
    )

    return PaymentSummary(
        id=payment.id,
        payer_id=payment.payer_id,
        amount=payment.amount,
        description=payment.description,
        paid_at=payment.paid_at,
        source=payment.source.value,
        shares=[
            ShareSummary(
                member_id=s.member_id,
                share_type=s.share_type.value,
                share_value=float(s.share_value),
            )
            for s in share_models
        ],
    )
```

- [ ] **Step 6: `app/main.py` に登録**

```python
from app.api import groups, members, payments
...
app.include_router(payments.router)
```

- [ ] **Step 6: テスト実行 → PASS確認**

```bash
uv run pytest tests/test_payments_api.py -v
```

- [ ] **Step 7: コミット**

```bash
git add backend/app/api/payments.py backend/app/services/payments.py \
  backend/app/main.py backend/app/exceptions/domain.py \
  backend/tests/test_payments_api.py
git commit -m "feat(api): add POST /api/groups/{id}/payments with shares validation"
```

---

### Task 10: API: `PATCH /api/groups/{group_id}/payments/{payment_id}`(支払い編集)

**Files:**

- Modify: `backend/app/services/payments.py`(update + helper を追加)
- Modify: `backend/app/api/payments.py`
- Modify: `backend/tests/test_payments_api.py`

> **設計判断**: PATCH/DELETE も group 配下にネストする(`/api/groups/{group_id}/payments/{payment_id}`)。これにより `Depends(require_member)` をそのまま再利用でき、独自の `X-Group-Id` ヘッダを増やさずに済む。詳細は `design.md` §7。

- [ ] **Step 1: 失敗するテストを追加**

```python
# tests/test_payments_api.py に追加
async def test_patch_payment_updates_amount_and_description(client: AsyncClient):
    gid, creator_mid, members = await _create_group_with_members(client, ["A", "B"])
    create_res = await client.post(
        f"/api/groups/{gid}/payments",
        headers={"X-Member-Id": creator_mid},
        json={
            "payerId": creator_mid,
            "amount": 1000,
            "description": "old",
            "shares": [
                {"memberId": m["id"], "shareType": "equal", "shareValue": 1.0}
                for m in members
            ],
        },
    )
    pid = create_res.json()["id"]

    res = await client.patch(
        f"/api/groups/{gid}/payments/{pid}",
        headers={"X-Member-Id": creator_mid},
        json={"amount": 5000, "description": "new"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["amount"] == 5000
    assert body["description"] == "new"
```

- [ ] **Step 2: テスト失敗確認**

- [ ] **Step 3: `services/payments.py` に共通ヘルパと update を追加**

```python
# backend/app/services/payments.py に追加
from datetime import datetime
from uuid import UUID

from app.exceptions.domain import GroupNotFound


async def get_payment_in_group(
    db: AsyncSession,
    *,
    payment_id: UUID,
    group_id: UUID,
) -> Payment:
    """payment_id が group_id に属することを検証して返す。

    member の認可は router 側で `Depends(require_member)` が済ませているので、
    ここでは payment の所属チェックだけ行う。
    """
    payment = await db.scalar(select(Payment).where(Payment.id == payment_id))
    if payment is None or payment.group_id != group_id:
        raise GroupNotFound(f"payment {payment_id} not found in group {group_id}")
    return payment


@dataclass(frozen=True)
class PaymentUpdateDTO:
    """update 用入力 DTO。各フィールド None = 変更なし。"""

    payer_id: UUID | None = None
    amount: int | None = None
    description: str | None = None
    paid_at: datetime | None = None
    shares: list[ShareInputDTO] | None = None


async def update_payment_with_shares(
    db: AsyncSession,
    *,
    payment: Payment,
    update: PaymentUpdateDTO,
) -> tuple[Payment, list[PaymentShare]]:
    """既存 payment を編集する。shares が指定された場合は全置換。"""
    if update.payer_id is not None:
        payment.payer_id = update.payer_id
    if update.amount is not None:
        payment.amount = update.amount
    if update.description is not None:
        payment.description = update.description
    if update.paid_at is not None:
        payment.paid_at = update.paid_at

    if update.shares is not None:
        await db.execute(
            PaymentShare.__table__.delete().where(
                PaymentShare.payment_id == payment.id
            )
        )
        new_shares = [
            PaymentShare(
                payment_id=payment.id,
                member_id=s.member_id,
                share_type=ShareType(s.share_type),
                share_value=s.share_value,
            )
            for s in update.shares
        ]
        db.add_all(new_shares)

    await db.commit()
    await db.refresh(payment)

    shares_rows = await db.scalars(
        select(PaymentShare).where(PaymentShare.payment_id == payment.id)
    )
    return payment, list(shares_rows.all())
```

- [ ] **Step 4: `api/payments.py` に PATCH 実装**

```python
# backend/app/api/payments.py に追加
from app.schemas.payment import UpdatePaymentRequest
from app.services.payments import PaymentUpdateDTO


@router.patch("/{payment_id}", response_model=PaymentSummary)
async def update_payment(
    group_id: UUID,
    payment_id: UUID,
    body: UpdatePaymentRequest,
    _requester: Member = Depends(require_member),
    db: AsyncSession = Depends(get_session),
) -> PaymentSummary:
    """支払いを編集する。group 配下の payment であることを検証してから更新。"""
    payment = await payments_service.get_payment_in_group(
        db, payment_id=payment_id, group_id=group_id,
    )

    update = PaymentUpdateDTO(
        payer_id=body.payer_id,
        amount=body.amount,
        description=body.description,
        paid_at=body.paid_at,
        shares=[
            ShareInputDTO(
                member_id=s.member_id,
                share_type=s.share_type,
                share_value=s.share_value,
            )
            for s in body.shares
        ] if body.shares is not None else None,
    )

    payment, share_models = await payments_service.update_payment_with_shares(
        db, payment=payment, update=update,
    )

    return PaymentSummary(
        id=payment.id,
        payer_id=payment.payer_id,
        amount=payment.amount,
        description=payment.description,
        paid_at=payment.paid_at,
        source=payment.source.value,
        shares=[
            ShareSummary(
                member_id=s.member_id,
                share_type=s.share_type.value,
                share_value=float(s.share_value),
            )
            for s in share_models
        ],
    )
```

> **認可の流れ**: `Depends(require_member)` が path の `group_id` + `X-Member-Id` ヘッダから「member が group に属するか」を検証。その後 `get_payment_in_group` で「payment が group に属するか」を検証する。両方クリアして初めて更新できる。

- [ ] **Step 5: テスト実行 → PASS確認**

- [ ] **Step 6: コミット**

```bash
git add backend/app/api/payments.py backend/app/services/payments.py backend/tests/test_payments_api.py
git commit -m "feat(api): add PATCH /api/groups/{group_id}/payments/{id} for editing payments"
```

---

### Task 11: API: `DELETE /api/groups/{group_id}/payments/{payment_id}`(論理削除)

**Files:**

- Modify: `backend/app/services/payments.py`(`soft_delete_payment` を追加)
- Modify: `backend/app/api/payments.py`
- Modify: `backend/tests/test_payments_api.py`

- [ ] **Step 1: 失敗するテストを追加**

```python
async def test_delete_payment_soft_deletes(client: AsyncClient):
    gid, creator_mid, members = await _create_group_with_members(client, ["A"])
    create_res = await client.post(
        f"/api/groups/{gid}/payments",
        headers={"X-Member-Id": creator_mid},
        json={
            "payerId": creator_mid,
            "amount": 100,
            "description": "x",
            "shares": [
                {"memberId": members[0]["id"], "shareType": "equal", "shareValue": 1.0}
            ],
        },
    )
    pid = create_res.json()["id"]

    res = await client.delete(
        f"/api/groups/{gid}/payments/{pid}",
        headers={"X-Member-Id": creator_mid},
    )
    assert res.status_code == 204

    # 一覧から消える
    list_res = await client.get(f"/api/groups/{gid}", headers={"X-Member-Id": creator_mid})
    assert list_res.json()["payments"] == []
```

- [ ] **Step 2: 失敗確認**

- [ ] **Step 3: `services/payments.py` に soft delete を追加**

```python
# backend/app/services/payments.py に追加
from datetime import datetime, timezone


async def soft_delete_payment(db: AsyncSession, *, payment: Payment) -> None:
    """payment.deleted_at に現在時刻を入れて論理削除する。"""
    payment.deleted_at = datetime.now(tz=timezone.utc)
    await db.commit()
```

- [ ] **Step 4: `api/payments.py` に DELETE 実装**

```python
# backend/app/api/payments.py に追加
from fastapi import Response


@router.delete("/{payment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_payment(
    group_id: UUID,
    payment_id: UUID,
    _requester: Member = Depends(require_member),
    db: AsyncSession = Depends(get_session),
) -> Response:
    payment = await payments_service.get_payment_in_group(
        db, payment_id=payment_id, group_id=group_id,
    )
    await payments_service.soft_delete_payment(db, payment=payment)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
```

- [ ] **Step 5: PASS確認**

- [ ] **Step 6: コミット**

```bash
git commit -am "feat(api): add DELETE /api/groups/{group_id}/payments/{id} (soft delete)"
```

---

### Task 12: API: `GET /api/groups/{group_id}/settlement`(清算結果)

**Files:**

- Modify: `backend/app/utils/settlement.py`(`compute_share_amounts` を追加)
- Create: `backend/app/services/settlement.py`(DB load + ネット収支計算)
- Create: `backend/app/api/settlement.py`(router)
- Create: `backend/tests/test_settlement_api.py`
- Modify: `backend/app/main.py`

> **3 層分離**: 純粋計算 = `utils/settlement.py`、DB アクセス = `services/settlement.py`、HTTP I/O = `api/settlement.py`。同名の 3 ファイルが層別の責務を担う。

- [ ] **Step 1: 失敗するテストを書く**

```python
# backend/tests/test_settlement_api.py
import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(autouse=True)
def _use_dev_env(monkeypatch):
    monkeypatch.setenv("APP_ENV", "dev")
    yield


def test_settlement_for_three_party_equal_split():
    client = TestClient(app)
    create_res = client.post(
        "/api/groups", json={"name": "g", "memberNames": ["A", "B", "C"]}
    )
    body = create_res.json()
    gid = body["id"]
    creator_mid = body["creatorMemberId"]
    members = body["members"]

    # A が 12000 円立替、3 等分
    client.post(
        f"/api/groups/{gid}/payments",
        headers={"X-Member-Id": creator_mid},
        json={
            "payerId": members[0]["id"],
            "amount": 12000,
            "description": "x",
            "shares": [
                {"memberId": m["id"], "shareType": "equal", "shareValue": 1.0}
                for m in members
            ],
        },
    )

    res = client.get(
        f"/api/groups/{gid}/settlement", headers={"X-Member-Id": creator_mid}
    )
    assert res.status_code == 200
    body = res.json()
    assert len(body["transfers"]) == 2
    # A は受け取り 8000(自分の 4000 を引いた残り)
    a_id = members[0]["id"]
    received = sum(t["amount"] for t in body["transfers"] if t["toId"] == a_id)
    assert received == 8000
```

- [ ] **Step 2: 失敗確認**

- [ ] **Step 3: `utils/settlement.py` に `compute_share_amounts` を追加(純粋関数)**

```python
# backend/app/utils/settlement.py に追加
from typing import Protocol


class _ShareLike(Protocol):
    """payment_share の最小限のインタフェース(utils が ORM に依存しないため)。"""

    member_id: UUID
    # share_type は str("equal" | "amount" | "ratio")で受け取る
    share_type: str
    share_value: float


def compute_share_amounts(
    payment_amount: int,
    shares: list[_ShareLike],
) -> dict[UUID, int]:
    """1 件の payment 内での各 member の負担額を計算する純粋関数。

    - equal: payment_amount を均等割(端数は最初の share に寄せる)
    - amount: share_value を直接負担額として使う
    - ratio: share_value を比率として配分(MVP は未対応、equal にフォールバック)
    """
    if not shares:
        return {}

    if all(s.share_type == "amount" for s in shares):
        return {s.member_id: int(s.share_value) for s in shares}

    if all(s.share_type == "equal" for s in shares):
        n = len(shares)
        base = payment_amount // n
        remainder = payment_amount - base * n
        result = {s.member_id: base for s in shares}
        result[shares[0].member_id] += remainder  # 端数を先頭に寄せて決定的に
        return result

    # ratio やミックスは MVP では equal にフォールバック
    n = len(shares)
    base = payment_amount // n
    return {s.member_id: base for s in shares}
```

> **utils が ORM に依存しないこと**: `_ShareLike` Protocol 経由で `share_type` を `str` として受ける。SQLAlchemy の `ShareType` enum は service 層で `s.share_type.value` に変換してから渡す。これで utils は SQLAlchemy 非依存(framework-agnostic)を保てる。

- [ ] **Step 4: `services/settlement.py` 実装(DB load + ネット収支)**

```python
# backend/app/services/settlement.py
"""清算 service: DB から payments + shares を読み、純粋関数 utils を呼んで結果を返す。"""
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Payment, PaymentShare
from app.utils.settlement import Transfer, compute_share_amounts, settle


@dataclass(frozen=True)
class _ShareForCalc:
    """utils.settlement.compute_share_amounts に渡す DTO(ORM 非依存化)。"""

    member_id: UUID
    share_type: str
    share_value: float


@dataclass(frozen=True)
class SettlementResult:
    """service の戻り値。router が DTO 変換する。"""

    transfers: list[Transfer]
    net_balances: dict[UUID, int]


async def compute_settlement_for_group(
    db: AsyncSession,
    *,
    group_id: UUID,
) -> SettlementResult:
    """group の未削除 payments + shares を読み、清算結果を計算する。"""
    payments = (
        await db.scalars(
            select(Payment).where(
                Payment.group_id == group_id, Payment.deleted_at.is_(None)
            )
        )
    ).all()

    if not payments:
        return SettlementResult(transfers=[], net_balances={})

    payment_ids = [p.id for p in payments]
    shares_by_payment: dict[UUID, list[PaymentShare]] = defaultdict(list)
    rows = await db.scalars(
        select(PaymentShare).where(PaymentShare.payment_id.in_(payment_ids))
    )
    for s in rows.all():
        shares_by_payment[s.payment_id].append(s)

    # net_balance: + は受取(立替分 - 負担分)、- は支払
    net: dict[UUID, int] = defaultdict(int)
    for p in payments:
        net[p.payer_id] += p.amount  # payer が一旦全額立替
        share_dtos = [
            _ShareForCalc(
                member_id=s.member_id,
                share_type=s.share_type.value,
                share_value=float(s.share_value),
            )
            for s in shares_by_payment[p.id]
        ]
        for member_id, owed in compute_share_amounts(p.amount, share_dtos).items():
            net[member_id] -= owed

    # 0 だけのメンバーは除外して送金最小化
    nonzero = {k: v for k, v in net.items() if v != 0}
    transfers = settle(nonzero)

    return SettlementResult(transfers=transfers, net_balances=dict(net))
```

- [ ] **Step 5: `api/settlement.py` 実装(router: DTO 変換のみ)**

```python
# backend/app/api/settlement.py
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import require_member
from app.db.session import get_session
from app.models import Member
from app.schemas.settlement import SettlementResponse, TransferDTO
from app.services import settlement as settlement_service

router = APIRouter(prefix="/api/groups/{group_id}/settlement", tags=["settlement"])


@router.get("", response_model=SettlementResponse)
async def get_settlement(
    group_id: UUID,
    _member: Member = Depends(require_member),
    db: AsyncSession = Depends(get_session),
) -> SettlementResponse:
    result = await settlement_service.compute_settlement_for_group(
        db, group_id=group_id
    )
    return SettlementResponse(
        transfers=[
            TransferDTO(from_id=t.from_id, to_id=t.to_id, amount=t.amount)
            for t in result.transfers
        ],
        net_balances={str(k): v for k, v in result.net_balances.items()},
    )
```

- [ ] **Step 6: `app/main.py` に登録**

```python
from app.api import groups, members, payments, settlement
...
app.include_router(settlement.router)
```

- [ ] **Step 7: PASS確認 + コミット**

```bash
uv run pytest tests/test_settlement_api.py -v
git add backend/app/api/settlement.py backend/app/services/settlement.py \
  backend/app/utils/settlement.py backend/app/main.py \
  backend/tests/test_settlement_api.py
git commit -m "feat(api): add GET /api/groups/{id}/settlement"
```

---

### Task 13: OpenAPI dump スクリプト

**Files:**

- Create: `backend/scripts/dump_openapi.py`
- Create: `backend/openapi.json`(自動生成、コミット対象)
- Modify: `backend/pyproject.toml`(scripts 設定は任意)

- [ ] **Step 1: dump スクリプト作成**

```python
# backend/scripts/dump_openapi.py
"""FastAPI app の OpenAPI スキーマを openapi.json にダンプする。

Frontend の codegen(kubb、Task 14)が読み込む元ファイル。
モジュール load 時に Settings() が必要なので、test 用 env を default に。"""
import json
import os
import sys
from pathlib import Path

os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test"
)

# プロジェクトルート(backend/)を sys.path に追加
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.main import app  # noqa: E402


def main() -> None:
    out = ROOT / "openapi.json"
    out.write_text(
        json.dumps(app.openapi(), indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {out}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: 実行して openapi.json を生成**

```bash
cd backend
uv run python scripts/dump_openapi.py
ls -la openapi.json
head -10 openapi.json
```

期待出力: `openapi.json` が生成され、`{"openapi": "3.x.x", "info": ..., "paths": ...}` で始まる。

- [ ] **Step 3: pyproject.toml に script alias を追加(任意)**

```toml
# backend/pyproject.toml の末尾に追加
[project.scripts]
dump-openapi = "scripts.dump_openapi:main"
```

> 任意。これで `uv run dump-openapi` でも実行可能になる。

- [ ] **Step 4: コミット**

```bash
git add backend/scripts/ backend/openapi.json backend/pyproject.toml
git commit -m "feat(backend): add openapi.json dump script for frontend codegen"
```

---

### Task 14: Frontend — kubb による型 + Zod schema + client 自動生成

> **codegen ツール選定**: `openapi-zod-client` は zod v3 出力に固定されており、zod v4 と非互換。本 plan では **kubb**(plugin ベースの OpenAPI codegen)を採用し、TypeScript 型(`plugin-ts`)・Zod schema(`plugin-zod`)・axios client 関数(`plugin-client`)を 1 度の `npm run codegen` で生成する。生成 client は SPLAI 既存の `apiClient`(X-Request-Id interceptor 付き)に橋渡しすることで、認可ヘッダ等の振る舞いを失わずに型安全な呼び出しが可能。

**Files:**

- Modify: `frontend/package.json`(zod v4 + kubb 群を deps に、`codegen` script を `kubb generate` に)
- Modify: `frontend/tsconfig.json`(`allowImportingTsExtensions: true` を追加)
- Modify: `frontend/eslint.config.mjs`(`lib/api/gen/**` を ignore)
- Create: `frontend/kubb.config.ts`
- Create: `frontend/lib/api/kubb-client.ts`(kubb 生成 client が呼ぶ HTTP 実行関数)
- Create: `frontend/lib/api/gen/`(自動生成、追跡対象)
- Modify: `frontend/lib/api/api-client.ts`(import パスを `@/lib/env` / `@/lib/request-id` に)

- [ ] **Step 1: 旧 codegen ツールを削除**

```bash
cd frontend
npm uninstall zod openapi-zod-client
rm -f lib/api/schemas.gen.ts
```

> `zod` を一旦消してから入れ直すのは、`openapi-zod-client` が依存する zod v3 が peer dep として残っていた場合の念のための clean install。

- [ ] **Step 2: zod v4 と kubb を install**

```bash
npm install zod
npm install -D '@kubb/cli@^4' '@kubb/core@^4' \
  '@kubb/plugin-oas@^4' '@kubb/plugin-ts@^4' \
  '@kubb/plugin-zod@^4' '@kubb/plugin-client@^4'
```

> `@kubb/cli` v5 は beta(2026-05 時点)なので v4 で揃える。v5 が安定したら一括で `^5` に上げる。

- [ ] **Step 3: `kubb.config.ts` を作成**

```typescript
// frontend/kubb.config.ts
import { defineConfig } from "@kubb/core";
import { pluginClient } from "@kubb/plugin-client";
import { pluginOas } from "@kubb/plugin-oas";
import { pluginTs } from "@kubb/plugin-ts";
import { pluginZod } from "@kubb/plugin-zod";

export default defineConfig({
  root: ".",
  input: { path: "../backend/openapi.json" },
  output: {
    path: "./lib/api/gen",
    clean: true,
  },
  plugins: [
    pluginOas(),
    pluginTs({
      output: { path: "types" },
      group: { type: "tag" },
    }),
    pluginZod({
      output: { path: "zod" },
      group: { type: "tag" },
      typed: true,
    }),
    pluginClient({
      output: { path: "clients" },
      group: { type: "tag" },
      // X-Request-Id interceptor 付きの自前 axios wrapper を使う。
      // tsconfig の `@/*` alias 経由で解決する。
      importPath: "@/lib/api/kubb-client",
    }),
  ],
});
```

- [ ] **Step 4: `lib/api/kubb-client.ts` を作成**

kubb 生成 client は default export された関数を `import fetch from '@/lib/api/kubb-client'` で読み込み、各 endpoint の HTTP 実行に使う。さらに `Client` `RequestConfig` `ResponseErrorConfig` を named export として要求する。

```typescript
// frontend/lib/api/kubb-client.ts
import type { AxiosError, AxiosRequestConfig } from "axios";

import { apiClient } from "./api-client";

export type RequestConfig<TData = unknown> = AxiosRequestConfig<TData> & {
  url: string;
  method:
    | "GET"
    | "POST"
    | "PUT"
    | "PATCH"
    | "DELETE"
    | "HEAD"
    | "OPTIONS"
    | "get"
    | "post"
    | "put"
    | "patch"
    | "delete"
    | "head"
    | "options";
};

export type ResponseConfig<TData = unknown> = {
  data: TData;
  status: number;
  statusText: string;
  headers?: AxiosRequestConfig["headers"];
};

export type ResponseErrorConfig<TError = unknown> = AxiosError<TError>;

// 全ての type param に default を持たせ、`Client` の bare 使用に備える
export type Client<TData = unknown, TError = unknown, TVariables = unknown> = (
  config: RequestConfig<TVariables>,
) => Promise<ResponseConfig<TData>> & { error?: ResponseErrorConfig<TError> };

// kubb 生成コードは `client<TData, TError, TVariables>(...)` の 3 引数で呼ぶため、
// 全パラメータを受けられるシグネチャにする。TError は kubb 側の型整合のために
// 受け取るだけで本体では未使用。
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const client = async <TData, TError = unknown, TVariables = unknown>(
  config: RequestConfig<TVariables>,
): Promise<ResponseConfig<TData>> => {
  const response = await apiClient.request<TData, ResponseConfig<TData>>({
    ...config,
    headers: { ...config.headers },
  });
  return response;
};

export default client;
```

- [ ] **Step 5: 既存 `api-client.ts` の import パスを修正**

Phase 0 で作った `lib/api/api-client.ts` の冒頭が相対 import になっている場合、`@/*` alias に統一して階層変更に強くする:

```typescript
// frontend/lib/api/api-client.ts(冒頭)
import axios, { AxiosError } from "axios";
import { env } from "@/lib/env";
import { generateRequestId } from "@/lib/request-id";
```

- [ ] **Step 6: `package.json` の codegen script を更新**

```json
{
  "scripts": {
    "codegen": "kubb generate"
  }
}
```

- [ ] **Step 7: `tsconfig.json` に `allowImportingTsExtensions` を追加**

kubb 生成コードは ESM 慣例で `import './foo.ts'` のように拡張子付きの import を出力する。Next.js は `noEmit: true` のため安全に許可できる:

```json
{
  "compilerOptions": {
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "forceConsistentCasingInFileNames": true,
    "allowImportingTsExtensions": true
  }
}
```

- [ ] **Step 8: `eslint.config.mjs` に `lib/api/gen/**` を ignore 追加\*\*

自動生成コードは `any` や未使用変数で lint warn を出すが、再生成で上書きされるので lint 対象外にする。型安全性は `tsc --noEmit` で別途担保:

```javascript
globalIgnores([
  '.next/**',
  'out/**',
  'build/**',
  'next-env.d.ts',
  // kubb による自動生成コード(再生成で上書きされるため lint 対象外)
  'lib/api/gen/**',
]),
```

- [ ] **Step 9: codegen 実行**

```bash
cd frontend
npm run codegen
```

期待出力: `lib/api/gen/` 配下に types / zod / clients が生成され、`Plugins: 4 successful, 4 total` と `Generated: <N> files`(endpoint 数によって変動)が表示される。

- [ ] **Step 10: 動作確認**

```bash
npm run typecheck    # エラーなしを確認
npm run lint         # エラーなしを確認(layout.tsx の既存 warning は無関係)
npm run test         # 既存テストが pass し続けることを確認
```

- [ ] **Step 11: コミット**

```bash
git add frontend/package.json frontend/package-lock.json \
  frontend/kubb.config.ts frontend/tsconfig.json frontend/eslint.config.mjs \
  frontend/lib/api/api-client.ts frontend/lib/api/kubb-client.ts frontend/lib/api/gen/
git commit -m "feat(frontend): generate types/zod/client from backend OpenAPI via kubb"
```

#### 生成された構造の使い方(参考)

```typescript
// 例: グループ作成
import createGroupApi from "@/lib/api/gen/clients/groupsController/createGroupApiGroupsPost";
import type { CreateGroupApiGroupsPostMutationRequest } from "@/lib/api/gen/types/groupsController/CreateGroupApiGroupsPost";

const body: CreateGroupApiGroupsPostMutationRequest = {
  name: "渋谷飲み会",
  memberNames: ["Alice", "Bob"],
};
const { data } = await createGroupApi(body); // data: GroupResponse 型
```

zod schema は `lib/api/gen/zod/<tag>/...` に同名で置かれるので、`react-hook-form` の resolver や fetch 後の追加検証で利用できる。

---

### Task 15: Frontend — メンバー識別ストレージ

> **配置方針**: localStorage を直接触る低レベル関数は `lib/auth/`(infra primitive)、React hook は `hooks/`(共有 hook、複数 feature が使う)。同じ責務を 2 層に分割する理由は、低レベル関数が SSR / テスト環境で React に依存せず単体テストできるため。

**Files:**

- Create: `frontend/lib/auth/member-storage.ts`(localStorage 低レベル)
- Create: `frontend/hooks/use-member-storage.ts`(React hook、共有層)
- Create: `frontend/tests/lib/auth/member-storage.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

```typescript
// frontend/tests/lib/auth/member-storage.test.ts
import { beforeEach, describe, expect, it } from "vitest";
import {
  getMemberId,
  setMemberId,
  clearMemberId,
} from "@/lib/auth/member-storage";

describe("member-storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null when no member id stored for group", () => {
    expect(getMemberId("group-1")).toBeNull();
  });

  it("stores and retrieves member id per group", () => {
    setMemberId("group-1", "member-a");
    setMemberId("group-2", "member-b");
    expect(getMemberId("group-1")).toBe("member-a");
    expect(getMemberId("group-2")).toBe("member-b");
  });

  it("clears member id for specific group", () => {
    setMemberId("group-1", "member-a");
    clearMemberId("group-1");
    expect(getMemberId("group-1")).toBeNull();
  });
});
```

- [ ] **Step 2: 失敗確認**

```bash
npx vitest run tests/lib/auth/member-storage.test.ts
```

- [ ] **Step 3: 実装**

```typescript
// frontend/lib/auth/member-storage.ts
/**
 * グループ単位のメンバー ID を localStorage で保持(設計書 §2)。
 * キー: g_<group_id>
 */
const KEY_PREFIX = "g_";

export function getMemberId(groupId: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(`${KEY_PREFIX}${groupId}`);
}

export function setMemberId(groupId: string, memberId: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(`${KEY_PREFIX}${groupId}`, memberId);
}

export function clearMemberId(groupId: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(`${KEY_PREFIX}${groupId}`);
}
```

```typescript
// frontend/hooks/use-member-storage.ts
"use client";
import { useCallback, useEffect, useState } from "react";
import {
  clearMemberId,
  getMemberId,
  setMemberId,
} from "@/lib/auth/member-storage";

export function useMemberStorage(groupId: string) {
  const [memberId, _setMemberId] = useState<string | null>(null);

  // SSR / hydration safe な初期化
  useEffect(() => {
    _setMemberId(getMemberId(groupId));
  }, [groupId]);

  const set = useCallback(
    (id: string) => {
      setMemberId(groupId, id);
      _setMemberId(id);
    },
    [groupId],
  );

  const clear = useCallback(() => {
    clearMemberId(groupId);
    _setMemberId(null);
  }, [groupId]);

  return { memberId, setMemberId: set, clearMemberId: clear };
}
```

- [ ] **Step 4: PASS確認**

```bash
npx vitest run tests/lib/auth/member-storage.test.ts
```

- [ ] **Step 5: コミット**

```bash
git add frontend/lib/auth/ frontend/hooks/use-member-storage.ts \
  frontend/tests/lib/auth/
git commit -m "feat(frontend): add localStorage-backed member identification"
```

---

### Task 16: Frontend — Landing page(グループ作成フォーム)

**Files:**

- Modify: `frontend/app/page.tsx`(Hello画面 → Landing shell に置き換え、薄い)
- Create: `frontend/features/groups/components/create-group-form.tsx`
- Create: `frontend/features/groups/api.ts`(API ラッパ — feature 内に閉じる)
- Create: `frontend/features/groups/types.ts`(Group / Member 型 — 必要時)

- [ ] **Step 1: API ラッパを feature 内に実装**

> **kubb 生成 client を使う**: 型・スキーマ・client 関数はすべて `lib/api/gen/` に自動生成済み(Task 14)。feature 側はそれらを薄くラップし、UI が呼びやすい関数名と入力型に整える。型定義の重複は禁止 — kubb 生成型を re-export する。

```typescript
// frontend/features/groups/api.ts
"use client";
import createGroupApi from "@/lib/api/gen/clients/groupsController/createGroupApiGroupsPost";
import type {
  CreateGroupApiGroupsPostMutationRequest,
  CreateGroupApiGroupsPostMutationResponse,
} from "@/lib/api/gen/types/groupsController/CreateGroupApiGroupsPost";

// kubb の長い型名を feature 内で短くエイリアスして UI から使いやすく
export type CreateGroupInput = CreateGroupApiGroupsPostMutationRequest;
export type CreateGroupResponse = CreateGroupApiGroupsPostMutationResponse;

export async function createGroup(
  input: CreateGroupInput,
): Promise<CreateGroupResponse> {
  const { data } = await createGroupApi(input);
  return data;
}
```

> **同じパターンを Task 17-20 でも適用**: `members/api.ts`, `payments/api.ts`, `settlement/api.ts` も同じく `lib/api/gen/clients/<tag>Controller/...` の関数 import + `lib/api/gen/types/<tag>Controller/...` の型エイリアスで構成する。生成ファイル名は OpenAPI の operationId 由来で長いが、feature 側で短く別名にすれば UI が触る箇所はクリーン。

- [ ] **Step 2: フォームコンポーネント実装**

```tsx
// frontend/features/groups/components/create-group-form.tsx
"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { createGroup } from "@/features/groups/api";
import { setMemberId } from "@/lib/auth/member-storage";

export function CreateGroupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [members, setMembers] = useState(["", ""]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const memberNames = members
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      const res = await createGroup({ name: name.trim(), memberNames });
      if (res.creatorMemberId) {
        setMemberId(res.id, res.creatorMemberId);
      }
      router.push(`/g/${res.id}`);
    } catch (e) {
      setError(String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 max-w-md w-full">
      <label className="flex flex-col gap-1">
        <span className="font-jp-display text-xs tracking-widest">
          GROUP NAME
        </span>
        <input
          className="border-2 border-ink p-2 bg-paper font-mono"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={100}
        />
      </label>

      <fieldset className="flex flex-col gap-1">
        <legend className="font-jp-display text-xs tracking-widest">
          MEMBERS
        </legend>
        {members.map((m, i) => (
          <input
            key={i}
            className="border-2 border-ink p-2 bg-paper font-mono"
            value={m}
            onChange={(e) =>
              setMembers((prev) =>
                prev.map((v, idx) => (idx === i ? e.target.value : v)),
              )
            }
            placeholder={`Member ${i + 1}`}
            maxLength={50}
          />
        ))}
        <button
          type="button"
          className="font-mono text-xs underline self-start"
          onClick={() => setMembers((p) => [...p, ""])}
        >
          + add member
        </button>
      </fieldset>

      <button
        type="submit"
        disabled={submitting || !name.trim()}
        className="bg-ink text-paper font-display p-3 disabled:opacity-50"
      >
        {submitting ? "..." : "CREATE"}
      </button>

      {error && <p className="text-red font-mono text-xs">{error}</p>}
    </form>
  );
}
```

- [ ] **Step 3: `app/page.tsx` を Landing 化(features を呼ぶ薄い shell)**

```tsx
// frontend/app/page.tsx
import { CreateGroupForm } from "@/features/groups/components/create-group-form";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 gap-8">
      <h1 className="font-display text-7xl tracking-tighter">
        SPL<span className="text-red">AI</span>.
      </h1>
      <p className="font-editorial text-lg max-w-md text-center">
        URL を共有し、レシートを撮り、文字を流し込む。それ以外、何もしない。
      </p>
      <CreateGroupForm />
    </main>
  );
}
```

- [ ] **Step 4: ローカル動作確認**

```bash
npm run dev
# ブラウザで http://localhost:3000 を開き、フォームに入力 → Submit
# → /g/<uuid> に遷移し、localStorage に g_<uuid>=<creator_member_id> が保存
```

- [ ] **Step 5: コミット**

```bash
git add frontend/app/page.tsx frontend/features/groups/
git commit -m "feat(frontend): replace landing page with create group form"
```

---

### Task 17: Frontend — `/g/[uuid]` page(メンバー選択 / ダッシュボード)

> **配置方針**:`app/g/[uuid]/page.tsx` は **薄い shell**(routing 入口のみ)。実体である `GroupDashboard`(Section 級コンポーネント)は `features/groups/components/` に置く。これで group ロジックの import パスが Landing(Task 16)と Group ページで一貫し、また Phase 2 で /g/[uuid]/share 等が増えても dashboard の場所が動かない。

**Files:**

- Create: `frontend/app/g/[uuid]/page.tsx`(薄い shell)
- Create: `frontend/features/groups/components/group-dashboard.tsx`(主構造、Section 級)
- Create: `frontend/features/groups/components/member-select.tsx`
- Create: `frontend/features/groups/use-group.ts`(feature flat 配置)

- [ ] **Step 1: グループ取得 hook を feature 直下に flat 実装**

```typescript
// frontend/features/groups/use-group.ts
"use client";
import { useEffect, useState } from "react";

import { apiClient } from "@/lib/api/api-client";

export type GroupData = {
  id: string;
  name: string;
  eventDate: string | null;
  currency: string;
  members: { id: string; name: string; createdAt: string }[];
  payments: {
    id: string;
    payerId: string;
    amount: number;
    description: string;
    paidAt: string;
    source: string;
    shares: { memberId: string; shareType: string; shareValue: number }[];
  }[];
};

export function useGroup(groupId: string, memberId: string | null) {
  const [data, setData] = useState<GroupData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const reload = async () => {
    if (!memberId) return;
    setLoading(true);
    try {
      const res = await apiClient.get<GroupData>(`/api/groups/${groupId}`, {
        headers: { "X-Member-Id": memberId },
      });
      setData(res.data);
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, memberId]);

  return { data, loading, error, reload };
}
```

- [ ] **Step 2: member-select コンポーネント実装**

```tsx
// frontend/features/groups/components/member-select.tsx
"use client";
import { useState } from "react";

import { apiClient } from "@/lib/api/api-client";

type Props = {
  groupId: string;
  members: { id: string; name: string }[];
  onSelect: (memberId: string) => void;
};

export function MemberSelect({ groupId, members, onSelect }: Props) {
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  async function addMember() {
    if (!newName.trim()) return;
    setAdding(true);
    try {
      // 「あなたは誰?」の段階ではまだ X-Member-Id が無い → 暫定で 1 人目の id を借りる戦略
      // MVP では members[0] を一時的な actor として使う(設計書 §6.3 のハイブリッド)
      const actor = members[0]?.id;
      if (!actor) {
        // メンバーが 1 人もいない初期状態(memberNames=[] で作成したケース)
        // POST /members は X-Member-Id 必須なので、Phase 5 で「初回限定の wildcard」を検討
        alert(
          "No initial member exists. Use the create form to add at least one.",
        );
        return;
      }
      const res = await apiClient.post<{ id: string; name: string }>(
        `/api/groups/${groupId}/members`,
        { name: newName.trim() },
        { headers: { "X-Member-Id": actor } },
      );
      onSelect(res.data.id);
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 max-w-sm w-full">
      <h2 className="font-jp-display text-xl">あなたは誰?</h2>

      {members.length > 0 && (
        <ul className="flex flex-col gap-2">
          {members.map((m) => (
            <li key={m.id}>
              <button
                onClick={() => onSelect(m.id)}
                className="border-2 border-ink p-2 w-full text-left font-mono"
              >
                {m.name}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-rule-grey pt-3 flex flex-col gap-2">
        <p className="font-mono text-xs">いない場合は新規追加:</p>
        <input
          className="border-2 border-ink p-2 bg-paper font-mono"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          maxLength={50}
        />
        <button
          onClick={addMember}
          disabled={adding || !newName.trim()}
          className="bg-ink text-paper font-display p-2 disabled:opacity-50"
        >
          ADD ME
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: GroupDashboard 実装(主構造、Section 級)**

```tsx
// frontend/features/groups/components/group-dashboard.tsx
"use client";

import { useGroup } from "@/features/groups/use-group";
import { useMemberStorage } from "@/hooks/use-member-storage";

import { MemberSelect } from "./member-select";
// 後の Task で追加されるコンポーネント:
// import { PaymentForm } from '@/features/payments/components/payment-form';
// import { PaymentList } from '@/features/payments/components/payment-list';
// import { SettlementView } from '@/features/settlement/components/settlement-view';

type Props = { groupId: string };

export function GroupDashboard({ groupId }: Props) {
  const { memberId, setMemberId } = useMemberStorage(groupId);
  const { data, loading, reload } = useGroup(groupId, memberId);

  // メンバー未選択
  if (!memberId) {
    if (loading) return <p className="font-mono p-8">loading...</p>;
    if (!data) {
      // データが無い = まだ取得していない。public 取得 endpoint がないので
      // Phase 1 では「最低 1 人のメンバーがいる」前提に倒す
      return (
        <p className="font-mono p-8">
          グループが見つかりません。URL を確認してください。
        </p>
      );
    }
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

  // ダッシュボード
  if (loading || !data) return <p className="font-mono p-8">loading...</p>;

  return (
    <main className="min-h-screen p-8 max-w-2xl mx-auto flex flex-col gap-6">
      <header className="flex items-baseline justify-between border-b-2 border-ink pb-2">
        <h1 className="font-jp-display text-2xl">{data.name}</h1>
        <p className="font-mono text-xs">{data.members.length}名</p>
      </header>

      {/* Phase 1 後続 Task で埋めていく */}
      <section>
        <p className="font-mono text-sm">payments: {data.payments.length}</p>
        <p className="font-mono text-sm">memberId: {memberId}</p>
        <button onClick={reload} className="font-mono text-xs underline">
          reload
        </button>
      </section>
    </main>
  );
}
```

- [ ] **Step 4: page.tsx は薄い routing shell として実装**

```tsx
// frontend/app/g/[uuid]/page.tsx
import { use } from "react";

import { GroupDashboard } from "@/features/groups/components/group-dashboard";

export default function GroupPage({
  params,
}: {
  params: Promise<{ uuid: string }>;
}) {
  const { uuid } = use(params);
  return <GroupDashboard groupId={uuid} />;
}
```

> **Phase 1 の `useGroup` 制約**:`GET /api/groups/{id}` は `X-Member-Id` 必須なので、メンバー未選択時は呼べない。member 選択画面で表示するメンバー一覧は本来別経路(public 取得)で取るべき。MVP では「URL を共有された先で member_names が知られている」前提で、初回アクセス時は `data` が空でも MemberSelect を表示し、新規追加できるようにする。Phase 5 で public な GET を追加するか、認可方針を見直す。

- [ ] **Step 5: 動作確認(Task 16 で作成したグループに遷移できること)**

- [ ] **Step 6: コミット**

```bash
git add frontend/app/g/ frontend/features/groups/
git commit -m "feat(frontend): add /g/[uuid] page with member selection"
```

---

### Task 18: Frontend — Payment Form(支払い入力)

**Files:**

- Create: `frontend/features/payments/api.ts`
- Create: `frontend/features/payments/components/payment-form.tsx`
- Create: `frontend/features/payments/types.ts`(必要時)
- Modify: `frontend/features/groups/components/group-dashboard.tsx`(form を組み込み)

- [ ] **Step 1: API ラッパ(payments feature 内)**

```typescript
// frontend/features/payments/api.ts
"use client";
import { apiClient } from "@/lib/api/api-client";

export type CreatePaymentInput = {
  payerId: string;
  amount: number;
  description: string;
  paidAt?: string;
  shares: {
    memberId: string;
    shareType: "equal" | "amount";
    shareValue: number;
  }[];
};

export async function createPayment(
  groupId: string,
  memberId: string,
  input: CreatePaymentInput,
) {
  const res = await apiClient.post(`/api/groups/${groupId}/payments`, input, {
    headers: { "X-Member-Id": memberId },
  });
  return res.data;
}

export async function deletePayment(
  paymentId: string,
  groupId: string,
  memberId: string,
) {
  await apiClient.delete(`/api/groups/${groupId}/payments/${paymentId}`, {
    headers: { "X-Member-Id": memberId },
  });
}
```

- [ ] **Step 2: PaymentForm 実装**

```tsx
// frontend/features/payments/components/payment-form.tsx
"use client";
import { useState } from "react";

import { createPayment } from "@/features/payments/api";

type Member = { id: string; name: string };

type Props = {
  groupId: string;
  memberId: string;
  members: Member[];
  onCreated: () => void;
};

export function PaymentForm({ groupId, memberId, members, onCreated }: Props) {
  const [payerId, setPayerId] = useState(memberId);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(amount);
    if (!Number.isInteger(amt) || amt <= 0) return;
    setSubmitting(true);
    try {
      await createPayment(groupId, memberId, {
        payerId,
        amount: amt,
        description,
        shares: members.map((m) => ({
          memberId: m.id,
          shareType: "equal",
          shareValue: 1.0,
        })),
      });
      setAmount("");
      setDescription("");
      onCreated();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-3 border-2 border-ink p-4"
    >
      <h3 className="font-jp-display text-sm tracking-widest">PAYMENT</h3>

      <label className="flex flex-col gap-1">
        <span className="font-mono text-xs">PAYER</span>
        <select
          value={payerId}
          onChange={(e) => setPayerId(e.target.value)}
          className="border-2 border-ink p-1 bg-paper font-mono"
        >
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-mono text-xs">AMOUNT (JPY)</span>
        <input
          type="number"
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="border-2 border-ink p-1 bg-paper font-mono"
          required
          min={1}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-mono text-xs">DESCRIPTION</span>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="border-2 border-ink p-1 bg-paper font-mono"
          maxLength={500}
        />
      </label>

      <p className="font-mono text-xs text-rule-grey">
        Phase 1 は均等割固定。比率/金額指定は Phase 1 終盤で追加。
      </p>

      <button
        type="submit"
        disabled={submitting}
        className="bg-ink text-paper font-display p-2 disabled:opacity-50"
      >
        {submitting ? "..." : "ADD"}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: GroupDashboard に組み込み**

`features/groups/components/group-dashboard.tsx` のダッシュボード部分(loading 後の `<main>` 内)に追加:

```tsx
import { PaymentForm } from "@/features/payments/components/payment-form";
...
<section className="flex flex-col gap-4">
  <PaymentForm
    groupId={groupId}
    memberId={memberId}
    members={data.members}
    onCreated={reload}
  />
</section>
```

- [ ] **Step 4: 動作確認 + コミット**

```bash
git add frontend/features/
git commit -m "feat(frontend): add payment input form (equal split MVP)"
```

---

### Task 19: Frontend — Payment List(支払い一覧 + 削除)

**Files:**

- Create: `frontend/features/payments/components/payment-list.tsx`
- Modify: `frontend/features/groups/components/group-dashboard.tsx`

- [ ] **Step 1: PaymentList 実装**

```tsx
// frontend/features/payments/components/payment-list.tsx
"use client";
import { useState } from "react";

import { deletePayment } from "@/features/payments/api";

type Payment = {
  id: string;
  payerId: string;
  amount: number;
  description: string;
  paidAt: string;
};

type Member = { id: string; name: string };

type Props = {
  groupId: string;
  memberId: string;
  members: Member[];
  payments: Payment[];
  onChange: () => void;
};

export function PaymentList({
  groupId,
  memberId,
  members,
  payments,
  onChange,
}: Props) {
  const memberName = (id: string) =>
    members.find((m) => m.id === id)?.name ?? "?";
  const [deleting, setDeleting] = useState<string | null>(null);

  async function onDelete(paymentId: string) {
    if (!confirm("この支払いを削除しますか?")) return;
    setDeleting(paymentId);
    try {
      await deletePayment(paymentId, groupId, memberId);
      onChange();
    } finally {
      setDeleting(null);
    }
  }

  if (payments.length === 0) {
    return <p className="font-mono text-xs text-rule-grey">No payments yet.</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-rule-grey">
      {payments.map((p) => (
        <li
          key={p.id}
          className="py-2 flex items-baseline justify-between gap-2"
        >
          <div className="flex flex-col">
            <span className="font-jp-display text-sm">
              {p.description || "(no description)"}
            </span>
            <span className="font-mono text-xs text-rule-grey">
              {memberName(p.payerId)} ·{" "}
              {new Date(p.paidAt).toLocaleDateString("ja-JP")}
            </span>
          </div>
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-base">
              ¥{p.amount.toLocaleString()}
            </span>
            <button
              onClick={() => onDelete(p.id)}
              disabled={deleting === p.id}
              className="font-mono text-xs underline text-rule-grey"
            >
              {deleting === p.id ? "..." : "delete"}
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 2: GroupDashboard に組み込み + コミット**

`features/groups/components/group-dashboard.tsx` の `<main>` 内に追加:

```tsx
import { PaymentList } from "@/features/payments/components/payment-list";
...
<PaymentList
  groupId={groupId}
  memberId={memberId}
  members={data.members}
  payments={data.payments}
  onChange={reload}
/>;
```

```bash
git add frontend/features/
git commit -m "feat(frontend): add payment list with soft delete"
```

---

### Task 20: Frontend — Settlement View(清算結果)

**Files:**

- Create: `frontend/features/settlement/api.ts`
- Create: `frontend/features/settlement/components/settlement-view.tsx`
- Create: `frontend/features/settlement/types.ts`(必要時)
- Modify: `frontend/features/groups/components/group-dashboard.tsx`(統合最終形)

- [ ] **Step 1: API ラッパ(settlement feature 内)**

```typescript
// frontend/features/settlement/api.ts
"use client";
import { apiClient } from "@/lib/api/api-client";

export type Settlement = {
  transfers: { fromId: string; toId: string; amount: number }[];
  netBalances: Record<string, number>;
};

export async function getSettlement(
  groupId: string,
  memberId: string,
): Promise<Settlement> {
  const res = await apiClient.get<Settlement>(
    `/api/groups/${groupId}/settlement`,
    { headers: { "X-Member-Id": memberId } },
  );
  return res.data;
}
```

- [ ] **Step 2: コンポーネント**

```tsx
// frontend/features/settlement/components/settlement-view.tsx
"use client";
import { useEffect, useState } from "react";

import { getSettlement, type Settlement } from "@/features/settlement/api";

type Member = { id: string; name: string };

type Props = {
  groupId: string;
  memberId: string;
  members: Member[];
  refreshKey: number;
};

export function SettlementView({
  groupId,
  memberId,
  members,
  refreshKey,
}: Props) {
  const [data, setData] = useState<Settlement | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getSettlement(groupId, memberId)
      .then(setData)
      .finally(() => setLoading(false));
  }, [groupId, memberId, refreshKey]);

  const name = (id: string) => members.find((m) => m.id === id)?.name ?? "?";

  if (loading) return <p className="font-mono text-xs">loading...</p>;
  if (!data) return null;

  return (
    <section className="border-2 border-ink p-4 flex flex-col gap-3">
      <h3 className="font-jp-display text-sm tracking-widest">SETTLEMENT</h3>

      {data.transfers.length === 0 ? (
        <p className="font-mono text-xs">清算済み(送金不要)</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {data.transfers.map((t, i) => (
            <li key={i} className="font-mono text-sm">
              {name(t.fromId)} → {name(t.toId)} : ¥{t.amount.toLocaleString()}
            </li>
          ))}
        </ul>
      )}

      <details className="font-mono text-xs">
        <summary className="cursor-pointer">net balances</summary>
        <ul>
          {Object.entries(data.netBalances).map(([mid, bal]) => (
            <li key={mid}>
              {name(mid)}: {bal > 0 ? "+" : ""}
              {bal.toLocaleString()}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
```

- [ ] **Step 3: GroupDashboard を最終形に更新**

`features/groups/components/group-dashboard.tsx` を以下に更新(全 feature を組み込んだ最終形):

```tsx
// frontend/features/groups/components/group-dashboard.tsx
"use client";
import { useState } from "react";

import { useGroup } from "@/features/groups/use-group";
import { PaymentForm } from "@/features/payments/components/payment-form";
import { PaymentList } from "@/features/payments/components/payment-list";
import { SettlementView } from "@/features/settlement/components/settlement-view";
import { useMemberStorage } from "@/hooks/use-member-storage";

import { MemberSelect } from "./member-select";

type Props = { groupId: string };

export function GroupDashboard({ groupId }: Props) {
  const { memberId, setMemberId } = useMemberStorage(groupId);
  const { data, loading, reload } = useGroup(groupId, memberId);
  const [refreshKey, setRefreshKey] = useState(0);

  const onChange = () => {
    void reload();
    setRefreshKey((k) => k + 1);
  };

  if (!memberId) {
    if (loading) return <p className="font-mono p-8">loading...</p>;
    if (!data) {
      return (
        <p className="font-mono p-8">
          グループが見つかりません。URL を確認してください。
        </p>
      );
    }
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

  if (loading || !data) return <p className="font-mono p-8">loading...</p>;

  return (
    <main className="min-h-screen p-8 max-w-2xl mx-auto flex flex-col gap-6">
      <header className="flex items-baseline justify-between border-b-2 border-ink pb-2">
        <h1 className="font-jp-display text-2xl">{data.name}</h1>
        <p className="font-mono text-xs">{data.members.length}名</p>
      </header>

      <PaymentForm
        groupId={groupId}
        memberId={memberId}
        members={data.members}
        onCreated={onChange}
      />

      <PaymentList
        groupId={groupId}
        memberId={memberId}
        members={data.members}
        payments={data.payments}
        onChange={onChange}
      />

      <SettlementView
        groupId={groupId}
        memberId={memberId}
        members={data.members}
        refreshKey={refreshKey}
      />
    </main>
  );
}
```

> `app/g/[uuid]/page.tsx` は Task 17 で作成した薄い shell のまま変更不要(`<GroupDashboard groupId={uuid} />` を呼ぶだけ)。Task 18-20 のフィーチャ追加は、すべて `GroupDashboard` 内の import / 配置で完結する。

- [ ] **Step 4: 動作確認(コア体験を E2E で確認)**

ローカルで以下のシナリオを手動実行:

1. `npm run dev`(frontend)+ `uv run uvicorn app.main:app --reload`(backend)
2. http://localhost:3000 → グループ作成「テスト飲み会」、メンバー A, B, C
3. → `/g/<uuid>` 自動遷移、creator(A) の id が localStorage に保存されている
4. PaymentForm で A が 12000 円立替、3 等分 → 一覧に表示
5. SettlementView に「B → A: ¥4000」「C → A: ¥4000」が表示される
6. payment 削除で SettlementView も空になる

- [ ] **Step 5: コミット**

```bash
git add frontend/features/
git commit -m "feat(frontend): add settlement view (transfer list + net balances)"
```

---

### Task 21: 本番デプロイ + E2E スモーク

**Files:**(変更なし、デプロイのみ)

- [ ] **Step 1: 全 backend テスト + lint pass を確認**

```bash
cd backend
uv run pytest -v
uv run ruff check .
uv run ruff format --check .
```

- [ ] **Step 2: Frontend 全テスト + ビルド pass を確認**

```bash
cd frontend
npm run lint && npm run format:check && npm run typecheck && npm test && npm run build
```

- [ ] **Step 3: 本番 DB に migration 適用(Fly.io 経由)**

```bash
cd backend
flyctl ssh console -a splai-backend -C "uv run alembic upgrade head"
```

期待出力: `Running upgrade ... -> <rev>, create core tables`

> Fly.io コンテナ内で `.venv` が存在し、DATABASE_URL は secrets 経由で注入されている前提。`flyctl ssh console` セッション内で `cd /app && uv run alembic upgrade head` でも可。

- [ ] **Step 4: feature ブランチを develop に PR**

```bash
git push origin feature/phase-1-core-features
gh pr create --base develop \
  --title "feat: Phase 1 core features (groups / members / payments / settlement)" \
  --body "$(cat <<'EOF'
## Summary
Phase 1 の DoD を全項目クリア。MVP のコアフロー(URL ベースのグループ → メンバー識別 → 手動支払い → 清算)が本番で動作。

## Changes
- Backend: SQLAlchemy モデル 4 種、Alembic マイグレーション、6 本の REST エンドポイント、X-Member-Id 認可、貪欲法清算
- Frontend: Landing(作成フォーム) + /g/[uuid] dashboard(member 選択 / 支払い入力 / 一覧 / 清算)
- OpenAPI → Zod 自動生成パイプライン

## Test plan
- [ ] Backend pytest 全件 pass
- [ ] Frontend vitest 全件 pass + build 成功
- [ ] Vercel preview で create → /g/[uuid] → payment → settlement の E2E 動作
- [ ] CI: Frontend / Backend 両方緑

## Related
- 計画書: docs/superpowers/plans/2026-05-29-phase-1-core-features.md
- 設計書 §6, §7
EOF
)"
```

- [ ] **Step 5: Vercel Preview で E2E 確認**

PR の Preview URL で Task 20 Step 4 と同じシナリオを実行。本番 Backend(Fly.io)に到達する経路で問題ないこと。

- [ ] **Step 6: develop に squash merge**

```bash
gh pr merge <pr-number> --squash --delete-branch
```

- [ ] **Step 7: develop → main の release PR**

```bash
git checkout develop
git pull --rebase origin develop
gh pr create --base main --head develop \
  --title "Release: Phase 1 — Core Features" \
  --body "Phase 1 完了。MVP のコアフロー(グループ作成・メンバー登録・手動支払い・清算)が本番で動作。"
```

CI 緑を待って merge commit でマージ。

---

### Task 22: Phase 1 完了確認(DoD チェック)

このタスクは検証のみ、新規ファイルなし。

- [ ] **Step 1: README.md(計画リポ)の Phase 1 状態を ✅ に更新**

```bash
cd /Users/koheiseki/dev/git/splai
# README.md の Phase 1 行を 🔒 未着手 → ✅ 完了 に変更
git add README.md
git commit -m "docs: mark Phase 1 as complete"
git push origin develop
```

- [ ] **Step 2: DoD チェック**

- [ ] グループ作成(`POST /api/groups`)— Task 6
- [ ] メンバー登録(作成時 + 後追加)— Task 6, 8
- [ ] 手動支払い登録(`POST /api/groups/{id}/payments`)— Task 9
- [ ] 支払い編集(`PATCH /api/groups/{group_id}/payments/{id}`)— Task 10
- [ ] 支払い論理削除(`DELETE /api/groups/{group_id}/payments/{id}`)— Task 11
- [ ] 支払い一覧表示(GET /api/groups/{id} の payments フィールド経由)— Task 7, 19
- [ ] 清算結果計算(貪欲法)と表示 — Task 3, 12, 20
- [ ] X-Member-Id 認可ミドルウェア — Task 4
- [ ] localStorage によるメンバー識別 — Task 15
- [ ] グループURL(`/g/{uuid}`)経由でのアクセス — Task 17
- [ ] Zod / Pydantic スキーマと OpenAPI → Zod 自動生成パイプライン — Task 5, 13, 14
- [ ] Backend / Frontend CI が緑のまま維持
- [ ] 本番 Vercel + Fly.io で E2E が成功

- [ ] **Step 3: Phase 2 の詳細計画作成を開始**

`superpowers:writing-plans` skill で `2026-MM-DD-phase-2-share-experience.md` を作成する。

---

## このフェーズで作成する成果物まとめ

### Backend

- ✅ 4 テーブル(groups / members / payments / payment_shares)+ Alembic マイグレーション
- ✅ 6 本の REST エンドポイント(POST /api/groups, GET /api/groups/{id}, POST /members, POST/PATCH/DELETE /payments, GET /settlement)
- ✅ X-Member-Id `Depends()` 認可
- ✅ 貪欲法清算アルゴリズム(純粋関数、TDD)
- ✅ Pydantic CamelModel スキーマ(Request / Response)

### Frontend

- ✅ Landing(グループ作成フォーム)
- ✅ /g/[uuid] dashboard(メンバー選択 / 支払い入力 / 一覧 / 清算)
- ✅ localStorage ベースのメンバー識別
- ✅ axios + X-Member-Id ヘッダ送信ラッパ
- ✅ OpenAPI → Zod 自動生成

### インフラ

- ✅ Fly.io への migration 適用フロー
- ✅ Vercel preview / production の自動連動

これで MVP の **コア体験**(グループ → 入力 → 清算)が本番で動作。Phase 2(URL 共有体験)に進む準備が整います。
