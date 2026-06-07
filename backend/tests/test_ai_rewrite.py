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
            text="集金タイム!",
            model="claude-sonnet-4-6",
            usage=Usage(prompt_tokens=20, completion_tokens=5),
        )

    monkeypatch.setattr(ai_gateway, "chat_completion", fake)


async def test_rewrite_returns_rewritten_text(client: AsyncClient, mock_completion):
    res = await client.post(
        "/api/ai/rewrite-share-message",
        json={"text": "渋谷飲み会 の割り勘、SPLAI で記録中。", "tone": "playful"},
    )
    assert res.status_code == 200
    assert res.json()["rewritten"] == "集金タイム!"
