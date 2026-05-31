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

group_router = APIRouter(prefix="/api/groups/{group_id}/payments", tags=["payments"])
payment_router = APIRouter(prefix="/api/payments", tags=["payments"])


@group_router.post("", status_code=status.HTTP_201_CREATED, response_model=PaymentSummary)
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
