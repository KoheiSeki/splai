from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from pydantic import Field

from app.schemas.base import CamelModel
from app.schemas.payment import PaymentSummary


class CreateGroupRequest(CamelModel):
    """グループ作成リクエスト"""

    name: str = Field(min_length=1, max_length=100)
    event_date: date | None = None
    member_names: list[str] = Field(default_factory=list, max_length=20)


class MemberSummary(CamelModel):
    """メンバー情報"""

    id: UUID
    name: str
    created_at: datetime


class GroupResponse(CamelModel):
    """グループ情報"""

    id: UUID
    name: str
    event_date: date | None
    currency: str
    creator_member_id: UUID | None = None
    members: list[MemberSummary] = Field(default_factory=list)
    payments: list[PaymentSummary] = Field(default_factory=list)
