"""グループドメインのビジネスロジック(DB 操作とビジネスルール)。

router からは HTTP・DTO 変換を取り除き、ここに DB 読み書き・トランザクション境界・
複数エンティティの atomic 作成等を集約する。Pydantic schema には依存しない
(プリミティブ引数 → ORM model 戻り値)。
"""

from __future__ import annotations

from datetime import date
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions.domain import GroupNotFound
from app.models import Group, Member, Payment, PaymentShare


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


async def get_group_full(
    db: AsyncSession, *, group_id: UUID
) -> tuple[Group, list[Member], list[Payment], dict[UUID, list[PaymentShare]]]:
    """グループ + メンバー + 未削除支払い + 各支払いの shares を取得する。

    Phase 1 では Payment ↔ PaymentShare の relationship を ORM 上で
    定義していないため、shares は別クエリで取得する(YAGNI。Phase 5 で
    パフォーマンス改善時に relationship + selectinload を導入する)。
    """

    # グループ情報取得
    group = await db.scalar(select(Group).where(Group.id == group_id))
    if group is None or group.deleted_at is not None:
        raise GroupNotFound(f"group {group_id} not found")

    # グループメンバー情報取得
    members = (
        await db.scalars(
            select(Member).where(Member.group_id == group_id).order_by(Member.created_at)
        )
    ).all()

    # 支払い履歴取得
    payments = (
        await db.scalars(
            select(Payment)
            .where(Payment.group_id == group_id, Payment.deleted_at.is_(None))
            .order_by(Payment.paid_at.desc())
        )
    ).all()

    # 支払いごとの共有情報取得
    payment_ids = [p.id for p in payments]
    shares_by_payment: dict[UUID, list[PaymentShare]] = {pid: [] for pid in payment_ids}
    if payment_ids:
        shares_rows = await db.scalars(
            select(PaymentShare).where(PaymentShare.payment_id.in_(payment_ids))
        )
        for s in shares_rows.all():
            shares_by_payment[s.payment_id].append(s)

    return group, list(members), list(payments), shares_by_payment
