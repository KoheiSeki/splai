"""グループドメインのビジネスロジック(DB 操作とビジネスルール)。

router からは HTTP・DTO 変換を取り除き、ここに DB 読み書き・トランザクション境界・
複数エンティティの atomic 作成等を集約する。Pydantic schema には依存しない
(プリミティブ引数 → ORM model 戻り値)。
"""

from __future__ import annotations

from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Group, Member


async def create_group_with_initial_members(
    db: AsyncSession, *, name: str, event_date: date | None, member_names: list[str]
) -> tuple[Group, list[Member]]:
    """グループ + 初期メンバーを 1 トランザクションで作成する。

    member_names の順序は意味を持つ。先頭が「作成者」(creator)として扱われる。
    """
    group = Group(name=name, event_date=event_date)
    db.add(group)
    await db.flush()

    members = [Member(group_id=group.id, name=n) for n in member_names]
    db.add_all(members)

    await db.commit()
    await db.refresh(group)
    for m in members:
        await db.refresh(m)

    return group, members
