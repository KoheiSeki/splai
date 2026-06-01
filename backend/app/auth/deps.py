from __future__ import annotations

from uuid import UUID

from fastapi import Depends, Header
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.exceptions.domain import MemberMismatch
from app.models import Member

"""認可関連の FastAPI Depends。

設計書 §2 / §7 共通仕様:
- POST /api/groups を除く全エンドポイントで X-Member-Id ヘッダ必須
- ヘッダの member_id が path の group_id に属する Member であることを検証
- 不一致は MemberMismatch (HTTP 401) を投げる
"""


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
        select(Member).where(Member.id == x_member_id, Member.group_id == group_id)
    )
    if member is None:
        raise MemberMismatch(f"member {x_member_id} is not a member of group {group_id}")

    return member
