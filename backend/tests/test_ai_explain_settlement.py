import pytest
from httpx import AsyncClient

from app.services import ai_gateway
from app.services.ai_gateway import CompletionResult, Usage


@pytest.fixture(autouse=True)
def mock_record_usage(monkeypatch):
    async def noop(*args, **kwargs):
        pass

    monkeypatch.setattr("app.api.ai.record_ai_usage", noop)


@pytest.fixture
def mock_completion(monkeypatch):
    async def fake(messages, **kwargs):
        return CompletionResult(
            text="A が 4000 円多く立て替えていたので、B と C から 2000 ずつ受け取れば終わりです。",
            model="claude-sonnet-4-6",
            usage=Usage(prompt_tokens=80, completion_tokens=30),
        )

    monkeypatch.setattr(ai_gateway, "chat_completion", fake)


async def test_explain_settlement(client: AsyncClient, mock_completion):
    res = await client.post(
        "/api/ai/explain-settlement",
        json={
            "members": [
                {"id": "00000000-0000-0000-0000-000000000001", "name": "A"},
                {"id": "00000000-0000-0000-0000-000000000002", "name": "B"},
                {"id": "00000000-0000-0000-0000-000000000003", "name": "C"},
            ],
            "transfers": [
                {
                    "fromId": "00000000-0000-0000-0000-000000000002",
                    "toId": "00000000-0000-0000-0000-000000000001",
                    "amount": 2000,
                },
                {
                    "fromId": "00000000-0000-0000-0000-000000000003",
                    "toId": "00000000-0000-0000-0000-000000000001",
                    "amount": 2000,
                },
            ],
            "netBalances": {
                "00000000-0000-0000-0000-000000000001": 4000,
                "00000000-0000-0000-0000-000000000002": -2000,
                "00000000-0000-0000-0000-000000000003": -2000,
            },
        },
    )
    assert res.status_code == 200
    assert "立て替え" in res.json()["explanation"]
