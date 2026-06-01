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
    new_member = await members_service.add_member_to_group(db, group_id=group_id, name=body.name)

    return MemberResponse(
        id=new_member.id,
        group_id=new_member.group_id,
        name=new_member.name,
        created_at=new_member.created_at,
    )
