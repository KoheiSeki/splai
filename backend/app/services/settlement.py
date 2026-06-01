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


async def compute_settlement_for_group(db: AsyncSession, *, group_id: UUID) -> SettlementResult:
    """group の未削除 payments + shares を読み、清算結果を計算する。"""
    payments = (
        await db.scalars(
            select(Payment).where(Payment.group_id == group_id, Payment.deleted_at.is_(None))
        )
    ).all()

    if not payments:
        return SettlementResult(transfers=[], net_balances={})

    payment_ids = [p.id for p in payments]
    shares_by_payment: dict[UUID, list[PaymentShare]] = defaultdict(list)
    rows = await db.scalars(select(PaymentShare).where(PaymentShare.payment_id.in_(payment_ids)))
    for s in rows.all():
        shares_by_payment[s.payment_id].append(s)

    net: dict[UUID, int] = defaultdict(int)
    for p in payments:
        net[p.payer_id] += p.amount
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
    # 送金最適化
    transfers = settle(nonzero)

    return SettlementResult(transfers=transfers, net_balances=dict(net))
