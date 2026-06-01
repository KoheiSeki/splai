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
        db,
        group_id=group_id,
    )

    return SettlementResponse(
        transfers=[
            TransferDTO(from_id=t.from_id, to_id=t.to_id, amount=t.amount) for t in result.transfers
        ],
        net_balances={str(k): v for k, v in result.net_balances.items()},
    )
