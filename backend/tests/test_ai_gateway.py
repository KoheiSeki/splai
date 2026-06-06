"""ai_gateway.chat_completion の動作を openai SDK の mock で検証する。

OpenAI 互換 API の response 形式を模した object を返す。実 SDK の
ChatCompletion レスポンスと duck typing 互換にしてあるので、production と
同じ code path が走る。
"""

from types import SimpleNamespace

import pytest

from app.exceptions.domain import AIGatewayError
from app.services.ai_gateway import ChatMessage, chat_completion


@pytest.fixture(autouse=True)
def _ica_env(monkeypatch):
    monkeypatch.setenv("ICA_API_KEY", "test-key")
    monkeypatch.setenv("ICA_BASE_URL", "https://ica.example.com/v1")


def _make_response(text: str, prompt_tokens=10, completion_tokens=3):
    """OpenAI ChatCompletion response の最小 mock。

    `choices[0].message.{content, tool_calls}` と `usage.{prompt_tokens,
    completion_tokens}` だけが ai_gateway の参照対象。
    """
    return SimpleNamespace(
        model="claude-sonnet-4-6",
        choices=[
            SimpleNamespace(
                message=SimpleNamespace(content=text, tool_calls=None),
                finish_reason="stop",
            )
        ],
        usage=SimpleNamespace(
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
        ),
    )


async def test_chat_completion_returns_assistant_text(monkeypatch):
    async def fake_create(*, model, messages, tools=None, **kwargs):
        return _make_response("こんにちは")

    # AsyncOpenAI().chat.completions.create を差し替える
    from app.services import ai_gateway

    fake_client = SimpleNamespace(
        chat=SimpleNamespace(completions=SimpleNamespace(create=fake_create))
    )
    monkeypatch.setattr(ai_gateway, "_get_client", lambda: fake_client)

    result = await chat_completion(messages=[ChatMessage(role="user", content="hi")])
    assert result.text == "こんにちは"
    assert result.model == "claude-sonnet-4-6"
    assert result.usage.prompt_tokens == 10
    assert result.usage.completion_tokens == 3


async def test_chat_completion_raises_on_upstream_error(monkeypatch):
    from openai import APIError

    async def fake_create(**kwargs):
        # APIError は body / response が必須なので最小値を渡す
        raise APIError(message="upstream 500", request=None, body=None)

    from app.services import ai_gateway

    fake_client = SimpleNamespace(
        chat=SimpleNamespace(completions=SimpleNamespace(create=fake_create))
    )
    monkeypatch.setattr(ai_gateway, "_get_client", lambda: fake_client)

    with pytest.raises(AIGatewayError):
        await chat_completion(messages=[ChatMessage(role="user", content="hi")])
