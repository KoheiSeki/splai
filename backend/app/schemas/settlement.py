from __future__ import annotations

from uuid import UUID

from app.schemas.base import CamelModel


class TransferDTO(CamelModel):
    """送金情報"""

    from_id: UUID
    to_id: UUID
    amount: int


class SettlementResponse(CamelModel):
    """清算結果"""

    transfers: list[TransferDTO]
    net_balances: dict[str, int]  # str key for JSON compat (UUID stringified)
