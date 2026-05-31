from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
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

    # グループに所属していないメンバーがいたらエラー
    member_ids = {s.member_id for s in shares} | {payer_id}
    rows = await db.scalars(
        select(Member.id).where(Member.group_id == group_id, Member.id.in_(member_ids))
    )
    valid_ids = set(rows.all())
    invalid = member_ids - valid_ids
    if invalid:
        raise InvalidPaymentShares(
            f"members {sorted(map(str, invalid))} are not in group {group_id}"
        )

    # 支払い作成
    payment = Payment(
        group_id=group_id,
        payer_id=payer_id,
        amount=amount,
        description=description,
        paid_at=paid_at or datetime.now(tz=UTC),
        source=PaymentSource.MANUAL,
    )
    db.add(payment)
    await db.flush()

    # 共有情報作成
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
