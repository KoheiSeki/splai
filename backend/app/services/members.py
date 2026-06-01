from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Member


async def add_member_to_group(db: AsyncSession, *, group_id: UUID, name: str) -> Member:
    """既存グループにメンバーを 1 名追加する。"""
    new_member = Member(group_id=group_id, name=name)
    db.add(new_member)

    await db.commit()
    await db.refresh(new_member)
    return new_member
