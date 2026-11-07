"""OpenAI-compatible chat completions for every LLM call in SwasthyaGrid.

One client for vLLM/SGLang serving Gnani Evon v3.3 (or an HF Inference Endpoint) and for
Gemini's OpenAI-compatible endpoint. Provider differences live in `LlmProvider`.

Ported from `app.voice.sarvam_chat` (now removed), generalized to any OpenAI-compatible
backend and extended with a `<think>` filter (Evon and some Gemini configurations can
emit reasoning traces inline) and a provider-tagged HTTP error for the router's failover.
"""

import json
import re
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Any

import httpx


@dataclass(frozen=True)
class LlmProvider:
    name: str  # "evon" | "gemini"
    label: str  # shown in the UI, e.g. "Gnani Evon v3.3"
    base_url: str  # ".../v1" or ".../v1beta/openai"
    model: str
    api_key: str | None = None
    extra_body: dict[str, Any] = field(default_factory=dict)
    connect_timeout: float = 5.0
    max_tokens_floor: int = 0  # Gemini counts thinking tokens against max_tokens

    @property
    def url(self) -> str:
        return self.base_url.rstrip("/") + "/chat/completions"

    def headers(self) -> dict[str, str]:
        h = {"content-type": "application/json"}
        if self.api_key:
            h["authorization"] = f"Bearer {self.api_key}"
        return h


class LlmHTTPError(RuntimeError):
    """A non-200 answer, carrying what the retry policy needs."""

    def __init__(self, status_code: int, body: str, retry_after: float | None = None, provider: str = ""):
        super().__init__(f"{provider or 'LLM'} chat completion failed ({status_code}): {body[:300]}")
        self.status_code = status_code
        self.retry_after = retry_after
        self.provider = provider


@dataclass
class ChatResult:
    content: str | None
    tool_calls: list[dict[str, Any]] | None
    finish_reason: str


@dataclass
class ChatDelta:
    """One parsed streaming chunk. `tool_calls` holds the raw OpenAI deltas
    (`index`, optional `id`, `function.name`, `function.arguments` fragment)."""

    content: str | None = None
    tool_calls: list[dict[str, Any]] | None = None
    finish_reason: str | None = None


_THINK = re.compile(r"<think>.*?</think>", re.DOTALL)


def strip_think(text: str | None) -> str:
    return _THINK.sub("", text or "").strip()


class ThinkFilter:
    """Drops <think>...</think> from streamed text even when a tag is split across chunks."""

    OPEN, CLOSE = "<think>", "</think>"

    def __init__(self) -> None:
        self._buf = ""
        self._inside = False

    def feed(self, text: str) -> str:
        self._buf += text
        out: list[str] = []
        while self._buf:
            if self._inside:
                end = self._buf.find(self.CLOSE)
                if end < 0:
                    self._buf = self._buf[-(len(self.CLOSE) - 1) :] if len(self.CLOSE) > 1 else ""
                    break
                self._buf = self._buf[end + len(self.CLOSE) :]
                self._inside = False
            else:
                start = self._buf.find(self.OPEN)
                if start < 0:
                    keep = 0
                    for k in range(min(len(self.OPEN) - 1, len(self._buf)), 0, -1):
                        if self.OPEN.startswith(self._buf[-k:]):
                            keep = k
                            break
                    cut = len(self._buf) - keep
                    out.append(self._buf[:cut])
                    self._buf = self._buf[cut:]
                    break
                out.append(self._buf[:start])
                self._buf = self._buf[start + len(self.OPEN) :]
                self._inside = True
        return "".join(out)

    def flush(self) -> str:
        rest = "" if self._inside else self._buf
        self._buf = ""
        return rest


@dataclass
class ToolCallAccumulator:
    """Concatenates streamed tool call fragments by `index`. Falls back to a stable
    index when a provider's delta omits it (observed on some Gemini OpenAI-layer
    responses), and preserves Gemini 3 "thought signature" blobs in `extra_content`
    so a follow-up call can carry them back."""

    _calls: dict[int, dict[str, Any]] = field(default_factory=dict)

    def add(self, deltas: list[dict[str, Any]] | None) -> None:
        for d in deltas or []:
            fn = d.get("function") or {}
            idx = d.get("index")
            if idx is None:
                idx = len(self._calls) if (d.get("id") or fn.get("name")) else max(self._calls, default=0)
            call = self._calls.setdefault(
                idx, {"id": "", "type": "function", "function": {"name": "", "arguments": ""}}
            )
            if d.get("id"):
                call["id"] = d["id"]
            if fn.get("name"):
                call["function"]["name"] += fn["name"]
            if fn.get("arguments"):
                call["function"]["arguments"] += fn["arguments"]
            if d.get("extra_content"):
                call["extra_content"] = d["extra_content"]

    def result(self) -> list[dict[str, Any]]:
        return [self._calls[i] for i in sorted(self._calls)]


DONE = "[DONE]"


def _retry_after(res: httpx.Response) -> float | None:
    try:
        return float(res.headers.get("retry-after", ""))
    except ValueError:
        return None


def parse_sse_line(line: str) -> ChatDelta | str | None:
    """Parse one SSE line: a ChatDelta, None for lines to skip (blank, comment,
    usage-only chunk), or the string "[DONE]" at the end of the stream."""
    line = line.strip()
    if not line.startswith("data:"):
        return None
    payload = line[5:].strip()
    if payload == DONE:
        return DONE
    try:
        data = json.loads(payload)
    except ValueError:
        return None
    choices = data.get("choices") or []
    if not choices:  # the trailing usage chunk has no choices
        return None
    choice = choices[0]
    delta = choice.get("delta") or {}
    content = delta.get("content") or None
    tool_calls = delta.get("tool_calls") or None
    finish = choice.get("finish_reason")
    if content is None and tool_calls is None and finish is None:
        return None
    return ChatDelta(content=content, tool_calls=tool_calls, finish_reason=finish)


def _body(
    provider: LlmProvider,
    messages: list[dict[str, Any]],
    *,
    tools: list[dict[str, Any]] | None,
    tool_choice: str,
    max_tokens: int,
    temperature: float,
    stream: bool,
) -> dict[str, Any]:
    body: dict[str, Any] = {
        "model": provider.model,
        "messages": messages,
        "max_tokens": max(max_tokens, provider.max_tokens_floor),
        "temperature": temperature,
        "stream": stream,
        **provider.extra_body,
    }
    if tools:
        body["tools"] = tools
        body["tool_choice"] = tool_choice
    return body


async def chat_completion(
    *,
    provider: LlmProvider,
    messages: list[dict[str, Any]],
    tools: list[dict[str, Any]],
    tool_choice: str = "auto",
    max_tokens: int = 220,
    temperature: float = 0.4,
    timeout: float = 20.0,
    client: httpx.AsyncClient | None = None,
) -> ChatResult:
    """Non-streaming call. A non-200 answer raises `LlmHTTPError` carrying
    `status_code`, `retry_after` and `provider` for the retry/failover policy."""
    body = _body(provider, messages, tools=tools, tool_choice=tool_choice, max_tokens=max_tokens, temperature=temperature, stream=False)
    own = client is None
    http = client or httpx.AsyncClient(timeout=httpx.Timeout(timeout, connect=provider.connect_timeout))
    try:
        res = await http.post(provider.url, headers=provider.headers(), json=body)
    finally:
        if own:
            await http.aclose()
    if res.status_code != 200:
        raise LlmHTTPError(res.status_code, res.text, _retry_after(res), provider=provider.name)

    data = res.json()
    choice = data["choices"][0]
    message = choice["message"]
    return ChatResult(
        content=strip_think(message.get("content")),
        tool_calls=message.get("tool_calls"),
        finish_reason=choice.get("finish_reason", ""),
    )


def chat_completion_sync(
    *,
    provider: LlmProvider,
    messages: list[dict[str, Any]],
    max_tokens: int = 400,
    temperature: float = 0.3,
    timeout: float = 20.0,
) -> ChatResult:
    """Synchronous non-streaming call, for the briefing service (runs outside asyncio)."""
    body = _body(provider, messages, tools=None, tool_choice="auto", max_tokens=max_tokens, temperature=temperature, stream=False)
    with httpx.Client(timeout=httpx.Timeout(timeout, connect=provider.connect_timeout)) as http:
        res = http.post(provider.url, headers=provider.headers(), json=body)
    if res.status_code != 200:
        raise LlmHTTPError(res.status_code, res.text, _retry_after(res), provider=provider.name)
    data = res.json()
    choice = data["choices"][0]
    message = choice["message"]
    return ChatResult(
        content=strip_think(message.get("content")),
        tool_calls=message.get("tool_calls"),
        finish_reason=choice.get("finish_reason", ""),
    )


async def stream_chat(
    *,
    provider: LlmProvider,
    messages: list[dict[str, Any]],
    tools: list[dict[str, Any]] | None = None,
    tool_choice: str = "auto",
    max_tokens: int = 320,
    temperature: float = 0.3,
    timeout: float = 15.0,
    client: httpx.AsyncClient | None = None,
) -> AsyncIterator[ChatDelta]:
    """Stream a chat completion, yielding `ChatDelta`s until `[DONE]`.

    Pass `client` (for example one built on `httpx.MockTransport`) in tests.
    """
    body = _body(provider, messages, tools=tools, tool_choice=tool_choice, max_tokens=max_tokens, temperature=temperature, stream=True)
    headers = provider.headers()
    think = ThinkFilter()
    own = client is None
    http = client or httpx.AsyncClient(timeout=httpx.Timeout(timeout, connect=provider.connect_timeout))
    try:
        async with http.stream("POST", provider.url, headers=headers, json=body) as res:
            if res.status_code != 200:
                text = (await res.aread()).decode("utf-8", "replace")
                raise LlmHTTPError(res.status_code, text, _retry_after(res), provider=provider.name)
            async for line in res.aiter_lines():
                parsed = parse_sse_line(line)
                if parsed == DONE:
                    break
                if isinstance(parsed, ChatDelta):
                    if parsed.content:
                        filtered = think.feed(parsed.content)
                        parsed.content = filtered or None
                    if parsed.content is None and parsed.tool_calls is None and parsed.finish_reason is None:
                        continue
                    yield parsed
        tail = think.flush()
        if tail:
            yield ChatDelta(content=tail)
    finally:
        if own:
            await http.aclose()
