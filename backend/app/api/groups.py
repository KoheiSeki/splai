from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.schemas.group import CreateGroupRequest, GroupResponse, MemberSummary
from app.services import groups as groups_service

router = APIRouter(prefix="/api/groups", tags=["groups"])


@router.post("", status_code=status.HTTP_201_CREATED, response_model=GroupResponse)
async def create_group(
    body: CreateGroupRequest, db: AsyncSession = Depends(get_session)
) -> GroupResponse:
    """グループを新規作成し、初期メンバーも一緒に登録する。

    認可なし: グループ作成時はまだ member が存在しないため X-Member-Id を要求しない
    (設計書 §7 共通仕様の例外)。
    """

    group, members = await groups_service.create_group_with_initial_members(
        db, name=body.name, event_date=body.event_date, member_names=body.member_names
    )

    return GroupResponse(
        id=group.id,
        name=group.name,
        event_date=group.event_date,
        currency=group.currency,
        creator_member_id=members[0].id if members else None,
        members=[MemberSummary(id=m.id, name=m.name, created_at=m.created_at) for m in members],
        payments=[],
    )
