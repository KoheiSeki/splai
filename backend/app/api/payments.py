from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import require_member
from app.db.session import get_session
from app.models import Member
from app.schemas.payment import (
    CreatePaymentRequest,
    PaymentSummary,
    ShareSummary,
    UpdatePaymentRequest,
)
from app.services import payments as payments_service
from app.services.payments import PaymentUpdateDTO, ShareInputDTO

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
    """支払いを作成するAPI"""

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
        ocr_job_id=body.ocr_job_id,
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
        ocr_image_path=payment.ocr_image_path,
    )


@router.patch("/{payment_id}", response_model=PaymentSummary)
async def update_payment(
    group_id: UUID,
    payment_id: UUID,
    body: UpdatePaymentRequest,
    _requester: Member = Depends(require_member),
    db: AsyncSession = Depends(get_session),
) -> PaymentSummary:
    """支払いを編集するAPI"""

    payment = await payments_service.get_payment_in_group(
        db, payment_id=payment_id, group_id=group_id
    )
    update = PaymentUpdateDTO(
        payer_id=body.payer_id,
        amount=body.amount,
        description=body.description,
        paid_at=body.paid_at,
        # shares 未指定 = 既存 shares を維持(service 側の `update.shares is None` 分岐)
        shares=(
            [
                ShareInputDTO(
                    member_id=s.member_id,
                    share_type=s.share_type,
                    share_value=s.share_value,
                )
                for s in body.shares
            ]
            if body.shares is not None
            else None
        ),
    )

    payment, share_models = await payments_service.update_payment_with_shares(
        db,
        payment=payment,
        update=update,
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


@router.delete("/{payment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_payment(
    group_id: UUID,
    payment_id: UUID,
    _requester: Member = Depends(require_member),
    db: AsyncSession = Depends(get_session),
) -> Response:

    payment = await payments_service.get_payment_in_group(
        db, payment_id=payment_id, group_id=group_id
    )
    await payments_service.soft_delete_payment(db, payment=payment)

    return Response(status_code=status.HTTP_204_NO_CONTENT)
