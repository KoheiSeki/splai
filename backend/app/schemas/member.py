from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import Field

from app.schemas.base import CamelModel


class CreateMemberRequest(CamelModel):
    """メンバー作成リクエスト"""

    name: str = Field(min_length=1, max_length=50)


class MemberResponse(CamelModel):
    """メンバー情報"""

    id: UUID
    group_id: UUID
    name: str
    created_at: datetime
