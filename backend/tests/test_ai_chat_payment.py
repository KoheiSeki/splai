import pytest
from httpx import AsyncClient

# 実 endpoint は SSE なので、ai_gateway.chat_completion_stream を monkeypatch する。
from app.services.ai_gateway import StreamEvent


@pytest.fixture
def mock_stream(monkeypatch):
    async def fake_stream(*args, **kwargs):
        yield StreamEvent(type="text_delta", payload={"text": "了解しました。"})
        yield StreamEvent(
            type="tool_use",
            payload={
                "name": "register_payment",
                "input": {
                    "amount": 12000,
                    "description": "居酒屋A",
                    "payer_member_id": "00000000-0000-0000-0000-000000000001",
                    "share_member_ids": [
                        "00000000-0000-0000-0000-000000000001",
                        "00000000-0000-0000-0000-000000000002",
                    ],
                },
            },
        )
        yield StreamEvent(type="done", payload={})

    from app.services import ai_gateway

    monkeypatch.setattr(ai_gateway, "chat_completion_stream", fake_stream)


async def test_chat_payment_streams_text_then_tool_use(client: AsyncClient, mock_stream):
    res = await client.post(
        "/api/ai/chat-payment",
        json={
            "groupId": "00000000-0000-0000-0000-000000000099",
            "text": "居酒屋 12000 円を A が払って 2 人で割って",
            "members": [
                {"id": "00000000-0000-0000-0000-000000000001", "name": "A"},
                {"id": "00000000-0000-0000-0000-000000000002", "name": "B"},
            ],
        },
    )
    assert res.status_code == 200
    body = res.text
    assert "event: text_delta" in body
    assert "event: tool_use" in body
    assert "register_payment" in body
    assert "12000" in body
