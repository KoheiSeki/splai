from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import Field

from app.schemas.base import CamelModel


class ShareInput(CamelModel):
    """支払い共有入力"""

    member_id: UUID
    share_type: Literal["equal", "ratio", "amount"]
    share_value: float = Field(gt=0)


class ShareSummary(CamelModel):
    """支払い共有情報"""

    member_id: UUID
    share_type: Literal["equal", "ratio", "amount"]
    share_value: float


class CreatePaymentRequest(CamelModel):
    """支払い作成リクエスト"""

    payer_id: UUID
    amount: int = Field(gt=0)
    description: str = Field(default="", max_length=500)
    paid_at: datetime | None = None
    shares: list[ShareInput] = Field(min_length=1)


class UpdatePaymentRequest(CamelModel):
    """支払い更新リクエスト"""

    payer_id: UUID | None = None
    amount: int | None = Field(default=None, gt=0)
    description: str | None = Field(default=None, max_length=500)
    paid_at: datetime | None = None
    shares: list[ShareInput] | None = None


class PaymentSummary(CamelModel):
    """支払い情報"""

    id: UUID
    payer_id: UUID
    amount: int
    description: str
    paid_at: datetime
    source: Literal["manual", "ocr", "chat"]
    shares: list[ShareSummary] = Field(default_factory=list)
