from __future__ import annotations

import json

from fastapi import APIRouter
from sse_starlette.sse import EventSourceResponse

from app.schemas.ai import (
    ChatPaymentRequest,
    RewriteShareMessageRequest,
    RewriteShareMessageResponse,
)
from app.services import ai_gateway
from app.services.ai_gateway import ChatMessage, ToolDefinition

router = APIRouter(prefix="/api/ai", tags=["ai"])

# OpenAI Function Calling 形式の tool 定義(`parameters` は JSON Schema)。
# ai_gateway.ToolDefinition が内部で {"type": "function", "function": {...}} に
# 包んで OpenAI SDK に渡す。
REGISTER_PAYMENT_TOOL = ToolDefinition(
    name="register_payment",
    description=(
        "ユーザーの自然言語入力から割り勘の支払い情報を構造化する。"
        "amount は整数(円)、share_member_ids は等分される member_id のリスト。"
    ),
    parameters={
        "type": "object",
        "properties": {
            "amount": {"type": "integer", "minimum": 1, "description": "支払額(円)"},
            "description": {"type": "string", "description": "支払いの内容(店名や用途)"},
            "payer_member_id": {
                "type": "string",
                "format": "uuid",
                "description": "立て替えたメンバーの member_id",
            },
            "share_member_ids": {
                "type": "array",
                "items": {"type": "string", "format": "uuid"},
                "minItems": 1,
                "description": "支払いを分担するメンバー member_id のリスト",
            },
        },
        "required": ["amount", "description", "payer_member_id", "share_member_ids"],
    },
)

"""共有メッセージ編集のプロンプト"""
REWRITE_SYSTEM_BASE = (
    "あなたは SPLAI(割り勘アプリ)の共有メッセージ編集アシスタントです。"
    "短く、リンクを開きたくなるような文に書き換えてください。"
    "結果のみを返し、説明や前置きは入れないこと。"
)

"""共有メッセージのトーン"""
REWRITE_TONE_DIRECTIVE = {
    "casual": "カジュアルで友人同士のテンションで(例:「割り勘やろ〜!」)",
    "polite": "丁寧で礼儀正しく(例:「お会計のご共有です」)",
    "playful": "遊び心のある言い回しで(例:「集金タイム!」)",
}


def _build_system_message(members: list[dict[str, str]]) -> str:
    """支払い登録のプロンプトを作成する関数"""

    member_lines = "\n".join(f"- {m['name']} (id: {m['id']})" for m in members)
    return (
        "あなたは割り勘登録アシスタントです。ユーザーの自然言語入力を読み取り、"
        "register_payment ツールを呼び出して支払い情報を構造化してください。\n\n"
        f"参加メンバー:\n{member_lines}\n\n"
        "ルール:\n"
        "- payer_member_id と share_member_ids は上記メンバー id のいずれかを使う。\n"
        "- 「みんなで」と言われたら share_member_ids に全員を含める(payer 含む)。\n"
        "- amount は税込 / 円 / 整数。"
    )


@router.post("/chat-payment")
async def chat_payment(body: ChatPaymentRequest) -> EventSourceResponse:
    """自然言語 → register_payment ツール呼び出しの SSE 配信。"""

    messages = [
        ChatMessage(role="system", content=_build_system_message(body.members)),
        ChatMessage(role="user", content=body.text),
    ]

    async def event_generator():
        try:
            async for ev in ai_gateway.chat_completion_stream(
                messages, tools=[REGISTER_PAYMENT_TOOL]
            ):
                yield {"event": ev.type, "data": json.dumps(ev.payload, ensure_ascii=False)}
        except Exception as e:
            yield {"event": "error", "data": json.dumps({"message": str(e)})}

    return EventSourceResponse(event_generator())


@router.post("/rewrite-share-message", response_model=RewriteShareMessageResponse)
async def rewrite_share_message(body: RewriteShareMessageRequest) -> EventSourceResponse:
    """共有メッセージをAIで編集する関数（非ストリーム）"""

    system = f"{REWRITE_SYSTEM_BASE}\nトーン: {REWRITE_TONE_DIRECTIVE[body.tone]}"
    messages = [
        ChatMessage(role="system", content=system),
        ChatMessage(role="user", content=body.text),
    ]
    result = await ai_gateway.chat_completion(messages)

    return RewriteShareMessageResponse(rewritten=result.text.strip())
