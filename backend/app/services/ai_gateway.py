"""ICA(OpenAI 互換 API)経由で Claude Sonnet 4.6 を呼ぶ
ゲートウェイ。

ICA は OpenAI Chat Completions 形式と互換なので、`openai` SDK の AsyncOpenAI を
`base_url` で ICA エンドポイントに向ける。SDK が SSE parsing / tool_calls
の chunk 累積 / 型を吸収するので、本ファイルは ICA レスポンスを SPLAI 内部の
DTO(CompletionResult / StreamEvent)に正規化する責務に絞る。

provider を切り替える場合(例: Anthropic ネイティブに戻す、Azure OpenAI を
使う)は本ファイルを差し替えるだけで、上位レイヤ(api/ai.py)は無影響。
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Any, Literal

from openai import APIError, AsyncOpenAI

from app.config import get_settings
from app.exceptions.domain import AIGatewayError

DEFAULT_MODEL = "claude-sonnet-4-6"
DEFAULT_MAX_TOKENS = 1024
DEFAULT_TIMEOUT_S = 60.0


@dataclass(frozen=True)
class ChatMessage:
    """AIとのメッセージ"""

    role: Literal["user", "assistant", "system"]
    content: str


@dataclass(frozen=True)
class ToolDefinition:
    """OpenAI Function Calling の入力スキーマ。

    ICA に送る形式は `{"type": "function", "function": {"name", "description",
    "parameters"}}`。`parameters` は JSON Schema。
    """

    name: str
    description: str
    parameters: dict[str, Any]  # JSON Schema(OpenAI では "parameters" と呼ぶ)


@dataclass(frozen=True)
class Usage:
    """OpenAI 互換 usage。Anthropic の input_tokens/output_tokens と概念は同じだが
    命名が違う(prompt/completion)。SPLAI 内部は OpenAI 命名で統一。"""

    prompt_tokens: int
    completion_tokens: int


@dataclass(frozen=True)
class ToolCall:
    """OpenAI Function Calling の結果。arguments は JSON 文字列で SDK から渡される
    ので、本データクラスでは parse 済みの dict として保持する。"""

    name: str
    arguments: dict[str, Any]


@dataclass(frozen=True)
class CompletionResult:
    """非ストリーミング呼び出しの結果。"""

    text: str
    model: str
    usage: Usage
    tool_calls: list[ToolCall] = field(default_factory=list)
    finish_reason: str = "stop"  # "stop" | "tool_calls" | "length" | ...


@dataclass(frozen=True)
class StreamEvent:
    """SSE で流す event の中身(SPLAI 内部規約)。
    type で payload の意味が決まる:

    - text_delta: payload = {"text": "..."}(token 単位の追記)
    - tool_use: payload = {"name": "register_payment", "input": {...}}
                (tool_calls 完成時に 1 回だけ発火)
    - done: payload = {}(stream 完了)
    - error: payload = {"message": "..."}
    """

    type: Literal["text_delta", "tool_use", "done", "error"]
    payload: dict[str, Any]


_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    """AsyncOpenAI を ICA 向けに 1 度だけ初期化してキャッシュ。

    test では monkeypatch.setattr(ai_gateway, "_get_client", ...) で差し替える。
    """
    global _client
    if _client is None:
        settings = get_settings()
        if not settings.ica_api_key:
            raise AIGatewayError("ICA_API_KEY is not configured")
        if not settings.ica_base_url:
            raise AIGatewayError("ICA_BASE_URL is not configured")
        # Cacheに保持
        _client = AsyncOpenAI(
            api_key=settings.ica_api_key, base_url=settings.ica_base_url, timeout=DEFAULT_TIMEOUT_S
        )
    return _client


def _to_openai_tools(tools: list[ToolDefinition] | None) -> list[dict[str, Any]] | None:
    if not tools:
        return None
    return [
        {
            "type": "function",
            "function": {"name": t.name, "description": t.description, "parameters": t.parameters},
        }
        for t in tools
    ]


def _to_openai_messages(messages: list[ChatMessage]) -> list[dict[str, Any]]:
    return [{"role": m.role, "content": m.content} for m in messages]


async def chat_completion(
    messages: list[ChatMessage],
    *,
    tools: list[ToolDefinition] | None = None,
    model: str = DEFAULT_MODEL,
    max_tokens: int = DEFAULT_MAX_TOKENS,
) -> CompletionResult:
    """非ストリーミングで一発呼び出し。Tool Calls があれば tool_calls に格納。"""

    client = _get_client()

    try:
        response = await client.chat.completions.create(
            model=model,
            messages=_to_openai_messages(messages),
            tools=_to_openai_tools(tools),
            max_tokens=max_tokens,
        )
    except APIError as e:
        raise AIGatewayError(f"upstream API error: {e}") from e
    except Exception as e:
        raise AIGatewayError(f"upstream connection error: {e}") from e

    choice = response.choices[0]
    message = choice.message
    text = message.content or ""

    tool_calls: list[ToolCall] = []
    for tc in message.tool_calls or []:
        try:
            args = json.loads(tc.function.arguments) if tc.function.arguments else {}
        except json.JSONDecodeError as e:
            raise AIGatewayError(
                f"tool call arguments are not valid JSON: {tc.function.arguments[:200]}"
            ) from e

        tool_calls.append(ToolCall(name=tc.function.name, arguments=args))

    usage = response.usage
    return CompletionResult(
        text=text,
        model=response.model,
        usage=Usage(
            prompt_tokens=usage.prompt_tokens if usage else 0,
            completion_tokens=usage.completion_tokens if usage else 0,
        ),
        tool_calls=tool_calls,
        finish_reason=choice.finish_reason or "stop",
    )


async def chat_completion_stream(
    messages: list[ChatMessage],
    *,
    tools: list[ToolDefinition] | None = None,
    model: str = DEFAULT_MODEL,
    max_tokens: int = DEFAULT_MAX_TOKENS,
) -> AsyncIterator[StreamEvent]:
    """SSE ストリーム形式で event を逐次 yield する。

    OpenAI 互換 API の stream 仕様:
    - 各 chunk は `choices[0].delta.{content?, tool_calls?}` を持つ
    - text 系は `delta.content` に token 単位で追記される
    - tool calls は `delta.tool_calls[*].function.{name?, arguments?}` を **chunk
      ごとに文字列累積** していき、`finish_reason == "tool_calls"` で完成
    - 最後の sentinel: `data: [DONE]`(SDK が SSE iteration 終了として吸収)

    本関数は OpenAI フォーマットを SPLAI 内部の StreamEvent に正規化:
    - text_delta: chunk が `delta.content` を持っていたら都度 emit
    - tool_use: tool_calls が完成(finish_reason == "tool_calls")した時に 1 回 emit
    - done: stream 完了
    - error: SDK 例外を error event として emit してから終了
    """

    client = _get_client()

    # tool_calls の累積バッファ。index 別に function.{name, arguments} を文字列で貯める。
    tool_buf: dict[int, dict[str, str]] = {}

    try:
        stream = await client.chat.completions.create(
            model=model,
            messages=_to_openai_messages(messages),
            tools=_to_openai_tools(tools),
            max_tokens=max_tokens,
            stream=True,
        )
    except APIError as e:
        yield StreamEvent(type="error", payload={"message": f"upstream API error: {e}"})
        return
    except Exception as e:
        yield StreamEvent(type="error", payload={"message": f"upstream connection error: {e}"})
        return

    try:
        async for chunk in stream:
            if not chunk.choices:
                continue
            choice = chunk.choices[0]
            delta = choice.delta

            if delta and delta.content:
                yield StreamEvent(type="text_delta", payload={"text": delta.content})

            # tool calls 系: chunk ごとに function.name / arguments を累積
            for tc in delta.tool_calls or []:
                idx = tc.index if tc.index is not None else 0
                buf = tool_buf.setdefault(idx, {"name": "", "arguments": ""})
                if tc.function and tc.function.name:
                    buf["name"] = tc.function.name
                if tc.function and tc.function.arguments:
                    buf["arguments"] += tc.function.arguments

            # 完成判定: finish_reason が "tool_calls" になったら蓄積を emit
            if choice.finish_reason == "tool_calls":
                for idx in sorted(tool_buf.keys()):
                    buf = tool_buf[idx]
                    try:
                        args = json.loads(buf["arguments"]) if buf["arguments"] else {}
                    except json.JSONDecodeError:
                        # 不正 JSON は error event にして終わる
                        yield StreamEvent(
                            type="error",
                            payload={
                                "message": f"tool arguments are not valid JSON: "
                                f"{buf['arguments'][:200]}"
                            },
                        )
                        return
                    yield StreamEvent(type="tool_use", payload={"name": buf["name"], "input": args})

                tool_buf.clear()
    except APIError as e:
        yield StreamEvent(type="error", payload={"message": f"upstream API error: {e}"})
        return

    yield StreamEvent(type="done", payload={})
