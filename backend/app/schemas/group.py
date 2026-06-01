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
    """グループ情報。

    `members` / `payments` は backend が常に値を返すので default を持たせない
    (= OpenAPI 上 required になる → frontend の TS 型でも non-optional)。
    Request 側の default_factory と混同しないこと。
    """

    id: UUID
    name: str
    event_date: date | None
    currency: str
    creator_member_id: UUID | None = None
    members: list[MemberSummary]
    payments: list[PaymentSummary]
