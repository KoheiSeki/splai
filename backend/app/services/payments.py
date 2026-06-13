from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions.domain import (
    GroupNotFound,
    InvalidPaymentShares,
    OcrJobAlreadyLinked,
    OcrJobMismatch,
    OcrJobNotReady,
)
from app.models import Member, Payment, PaymentShare, PaymentSource, ShareType
from app.models.ocr_job import OcrJob, OcrJobStatus


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
    ocr_job_id: UUID | None = None,
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

    amount_shares = [s for s in shares if s.share_type == "amount"]
    if amount_shares and len(amount_shares) == len(shares):
        share_total = sum(int(s.share_value) for s in amount_shares)
        if share_total != amount:
            raise InvalidPaymentShares(
                f"share amounts sum {share_total} does not match payment amount {amount}"
            )

    valid_ids = set(rows.all())
    invalid = member_ids - valid_ids
    if invalid:
        raise InvalidPaymentShares(
            f"members {sorted(map(str, invalid))} are not in group {group_id}"
        )

    ocr_job: OcrJob | None = None
    if ocr_job_id is not None:
        ocr_job = await db.get(OcrJob, ocr_job_id)
        if ocr_job is None:
            raise OcrJobNotReady(f"ocr_job {ocr_job_id} not found")
        if ocr_job.group_id != group_id:
            raise OcrJobMismatch(
                f"ocr_job {ocr_job_id} belongs to group {ocr_job.group_id}, not {group_id}"
            )
        if ocr_job.status != OcrJobStatus.SUCCEEDED:
            raise OcrJobNotReady(f"ocr_job {ocr_job_id} is {ocr_job.status}, not succeeded")
        if ocr_job.payment_id is not None:
            raise OcrJobAlreadyLinked(
                f"ocr_job {ocr_job_id} already linked to payment {ocr_job.payment_id}"
            )

    # 支払い作成(ocr_job がある場合は source=ocr、image_path をコピー)
    payment = Payment(
        group_id=group_id,
        payer_id=payer_id,
        amount=amount,
        description=description,
        paid_at=paid_at or datetime.now(tz=UTC),
        source=PaymentSource.OCR if ocr_job else PaymentSource.MANUAL,
        ocr_image_path=ocr_job.image_path if ocr_job else None,
    )
    db.add(payment)
    await db.flush()  # payment.id を populate

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

    # 双方向 link:同一トランザクション内で ocr_job.payment_id = payment.id
    if ocr_job is not None:
        ocr_job.payment_id = payment.id

    await db.commit()
    await db.refresh(payment)
    return payment, share_models


async def get_payment_in_group(
    db: AsyncSession,
    *,
    payment_id: UUID,
    group_id: UUID,
) -> Payment:
    """payment_id が group_id に属することを検証して返す。

    member の認可は router 側で `Depends(require_member)` が済ませているので、
    ここでは payment の所属チェックだけ行う。group に存在しない / 別 group の
    payment_id を投げられた場合は GroupNotFound を raise する。
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
    db: AsyncSession, *, payment: Payment, update: PaymentUpdateDTO
) -> tuple[Payment, list[PaymentShare]]:
    """既存 payment を編集する。shares が指定された場合は全置換。

    書き込み(payment 属性 + shares 削除/追加)と読み取り(既存 shares の取得)を
    すべて 1 トランザクション内で実施し、最後に 1 度だけ commit する。
    """

    if update.payer_id is not None:
        payment.payer_id = update.payer_id
    if update.amount is not None:
        payment.amount = update.amount
    if update.description is not None:
        payment.description = update.description
    if update.paid_at is not None:
        payment.paid_at = update.paid_at

    if update.shares is not None:
        # 既存 shares を全消しして入れ直す
        await db.execute(
            PaymentShare.__table__.delete().where(PaymentShare.payment_id == payment.id)
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
        await db.flush()  # commit せずに DB に反映、default=uuid.uuid4 等を確定
        shares = new_shares
    else:
        # shares 指定なし: 既存を同じトランザクション内で取得
        rows = await db.scalars(select(PaymentShare).where(PaymentShare.payment_id == payment.id))
        shares = list(rows.all())

    await db.commit()  # 1 トランザクションをここで完了
    return payment, shares


async def soft_delete_payment(db: AsyncSession, *, payment: Payment) -> None:
    """payment.deleted_at に現在時刻を入れて論理削除する。"""

    payment.deleted_at = datetime.now(tz=UTC)
    await db.commit()
