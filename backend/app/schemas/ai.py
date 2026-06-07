from __future__ import annotations

from typing import Literal
from uuid import UUID

from app.schemas.base import CamelModel


class ChatPaymentRequest(CamelModel):
    """
    自然言語で支払い登録の構造化を依頼するリクエスト。
    (aiとのチャットでの支払い登録リクエスト)
    """

    group_id: UUID
    text: str
    # group のメンバー一覧を text と一緒に system message として送ることで
    # AI に「誰が誰に払ったか」を解決させる
    members: list[dict[str, str]]  # [{"id": "...", "name": "Alice"}, ...]


class RewriteShareMessageRequest(CamelModel):
    """グループ共有メッセージのAIによる編集リクエスト"""

    text: str
    tone: Literal["casual", "polite", "playful"] = "casual"


class RewriteShareMessageResponse(CamelModel):
    """グループ共有メッセージのAIによる編集レスポンス"""

    rewritten: str


class ExplainSettlementRequest(CamelModel):
    """清算結果のAIによる説明リクエスト"""

    members: list[dict[str, str]]  # [{"id": "...", "name": "..."}, ...]
    transfers: list[dict[str, int]]  # settlement の Transfer
    net_balances: dict[str, int]


class ExplainSettlementResponse(CamelModel):
    """清算結果のAIによる説明レスポンス"""

    explanation: str
