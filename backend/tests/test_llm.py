"""Tests for the provider-neutral LLM client and router (app.llm)."""

import json

import httpx
import pytest

from app.core.config import Settings
from app.llm import client as llm_client
from app.llm.client import ChatDelta, LlmHTTPError, LlmProvider, ThinkFilter, ToolCallAccumulator
from app.llm.router import LlmRouter, build_providers

pytestmark = pytest.mark.anyio


@pytest.fixture
def anyio_backend():
    return "asyncio"


EVON = LlmProvider(name="evon", label="Gnani Evon v3.3", base_url="http://localhost:8000/v1", model="gnani-evon-v3.3")
GEMINI = LlmProvider(name="gemini", label="Google gemini-3.5-flash-lite", base_url="https://api.example/v1", model="gemini-3.5-flash-lite")


# ------------------------------------------------------------------ ThinkFilter


def test_think_filter_strips_whole_tag():
    f = ThinkFilter()
    assert f.feed("<think>reasoning here</think>Hello") == "Hello"
    assert f.flush() == ""


def test_think_filter_splits_tag_across_chunks():
    f = ThinkFilter()
    out = f.feed("<thi")
    out += f.feed("nk>x</th")
    out += f.feed("ink>Hello")
    assert out == "Hello"
    assert f.flush() == ""


def test_think_filter_flushes_trailing_partial_open_tag():
    f = ThinkFilter()
    out = f.feed("Done<")
    assert out == "Done"
    assert f.flush() == "<"


def test_think_filter_passes_through_plain_text():
    f = ThinkFilter()
    assert f.feed("just text") == "just text"
    assert f.flush() == ""


# ------------------------------------------------------------------ ToolCallAccumulator


def test_accumulator_merges_by_index():
    acc = ToolCallAccumulator()
    acc.add([{"index": 0, "id": "call_1", "function": {"name": "get_", "arguments": ""}}])
    acc.add([{"index": 0, "function": {"name": "stock", "arguments": '{"d":'}}])
    acc.add([{"index": 0, "function": {"arguments": '"kota"}'}}])
    result = acc.result()
    assert result == [{"id": "call_1", "type": "function", "function": {"name": "get_stock", "arguments": '{"d":"kota"}'}}]


def test_accumulator_falls_back_to_stable_index_when_missing():
    acc = ToolCallAccumulator()
    # First call, no index, but has an id -> starts a new call at index 0.
    acc.add([{"id": "call_1", "function": {"name": "tool_a", "arguments": "{}"}}])
    # Second call, no index, has an id -> starts a new call at index 1.
    acc.add([{"id": "call_2", "function": {"name": "tool_b", "arguments": "{}"}}])
    result = acc.result()
    assert len(result) == 2
    assert {c["function"]["name"] for c in result} == {"tool_a", "tool_b"}


def test_accumulator_preserves_extra_content():
    acc = ToolCallAccumulator()
    acc.add([{"index": 0, "id": "call_1", "function": {"name": "f", "arguments": "{}"}, "extra_content": {"sig": "abc"}}])
    result = acc.result()
    assert result[0]["extra_content"] == {"sig": "abc"}


# ------------------------------------------------------------------ _body


def test_body_respects_max_tokens_floor_and_extra_body():
    provider = LlmProvider(
        name="gemini", label="g", base_url="https://x/v1", model="m",
        extra_body={"reasoning_effort": "low"}, max_tokens_floor=1024,
    )
    body = llm_client._body(provider, [{"role": "user", "content": "hi"}], tools=None, tool_choice="auto", max_tokens=320, temperature=0.3, stream=True)
    assert body["max_tokens"] == 1024
    assert body["reasoning_effort"] == "low"
    assert "tools" not in body
    assert body["stream"] is True


def test_body_includes_tools_when_present():
    provider = LlmProvider(name="evon", label="e", base_url="https://x/v1", model="m")
    tools = [{"type": "function", "function": {"name": "f"}}]
    body = llm_client._body(provider, [], tools=tools, tool_choice="none", max_tokens=100, temperature=0.4, stream=False)
    assert body["tools"] == tools
    assert body["tool_choice"] == "none"


# ------------------------------------------------------------------ build_providers


def _settings(**overrides) -> Settings:
    return Settings(_env_file=None, **overrides)


def test_build_providers_evon_first_when_configured():
    s = _settings(evon_base_url="http://localhost:8000/v1", gemini_api_key="k")
    providers = build_providers(s)
    assert [p.name for p in providers] == ["evon", "gemini"]
    assert providers[1].label == f"Google {s.gemini_model} (Evon fallback)"


def test_build_providers_gemini_only_without_evon():
    s = _settings(gemini_api_key="k")
    providers = build_providers(s)
    assert [p.name for p in providers] == ["gemini"]
    assert "(Evon fallback)" not in providers[0].label


def test_build_providers_respects_llm_primary_override():
    s = _settings(evon_base_url="http://localhost:8000/v1", gemini_api_key="k", llm_primary="gemini")
    providers = build_providers(s)
    assert [p.name for p in providers] == ["gemini", "evon"]


def test_build_providers_empty_when_nothing_configured():
    s = _settings()
    assert build_providers(s) == []


# ------------------------------------------------------------------ stream_chat / chat_completion over MockTransport


def _sse(lines: list[str]) -> bytes:
    return ("\n".join(f"data: {line}" if line != "[DONE]" else "data: [DONE]" for line in lines) + "\n\n").encode()


def _delta_chunk(content: str | None = None, tool_calls=None, finish_reason=None) -> str:
    choice: dict = {"delta": {}}
    if content is not None:
        choice["delta"]["content"] = content
    if tool_calls is not None:
        choice["delta"]["tool_calls"] = tool_calls
    if finish_reason is not None:
        choice["finish_reason"] = finish_reason
    return json.dumps({"choices": [choice]})


async def test_stream_chat_yields_deltas_and_filters_think():
    body = _sse([_delta_chunk(content="<think>plan</think>Hello "), _delta_chunk(content="world"), "[DONE]"])

    def handler(request):
        return httpx.Response(200, content=body, headers={"content-type": "text/event-stream"})

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    deltas = []
    async for d in llm_client.stream_chat(provider=EVON, messages=[{"role": "user", "content": "hi"}], client=client):
        deltas.append(d)
    await client.aclose()
    text = "".join(d.content or "" for d in deltas)
    assert text == "Hello world"


async def test_stream_chat_raises_llm_http_error_on_non_200():
    def handler(request):
        return httpx.Response(503, text="busy", headers={"retry-after": "2"})

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    with pytest.raises(LlmHTTPError) as exc_info:
        async for _ in llm_client.stream_chat(provider=EVON, messages=[], client=client):
            pass
    await client.aclose()
    assert exc_info.value.status_code == 503
    assert exc_info.value.retry_after == 2.0
    assert exc_info.value.provider == "evon"


async def test_chat_completion_strips_think_and_returns_tool_calls():
    payload = {
        "choices": [{"message": {"content": "<think>x</think>answer", "tool_calls": [{"id": "1"}]}, "finish_reason": "tool_calls"}]
    }

    def handler(request):
        return httpx.Response(200, json=payload)

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    result = await llm_client.chat_completion(provider=GEMINI, messages=[], tools=[], client=client)
    await client.aclose()
    assert result.content == "answer"
    assert result.tool_calls == [{"id": "1"}]
    assert result.finish_reason == "tool_calls"


def test_chat_completion_sync_strips_think():
    payload = {"choices": [{"message": {"content": "<think>x</think>hello"}, "finish_reason": "stop"}]}

    def handler(request):
        return httpx.Response(200, json=payload)

    import unittest.mock

    real_client = httpx.Client(transport=httpx.MockTransport(handler))
    with unittest.mock.patch("httpx.Client", return_value=real_client):
        result = llm_client.chat_completion_sync(provider=GEMINI, messages=[])
    assert result.content == "hello"


# ------------------------------------------------------------------ LlmRouter failover


class _FakeDeltaStream:
    """Monkeypatchable stand-in for llm_client.stream_chat keyed by provider name."""

    def __init__(self, responses: dict[str, list]):
        self.responses = responses
        self.calls: list[str] = []

    async def __call__(self, *, provider, **kw):
        self.calls.append(provider.name)
        resp = self.responses[provider.name]
        for item in resp:
            if isinstance(item, Exception):
                raise item
            yield item


async def test_router_stream_chat_fails_over_before_first_delta(monkeypatch):
    fake = _FakeDeltaStream({"evon": [LlmHTTPError(503, "down", provider="evon")], "gemini": [ChatDelta(content="hi")]})
    monkeypatch.setattr(llm_client, "stream_chat", fake)
    router = LlmRouter([EVON, GEMINI])
    deltas = [d async for d in router.stream_chat(messages=[])]
    assert [d.content for d in deltas] == ["hi"]
    assert router.last_label == GEMINI.label
    assert fake.calls == ["evon", "gemini"]


async def test_router_does_not_failover_after_first_delta_yielded(monkeypatch):
    async def flaky(*, provider, **kw):
        yield ChatDelta(content="partial")
        raise LlmHTTPError(500, "dropped", provider=provider.name)

    monkeypatch.setattr(llm_client, "stream_chat", flaky)
    router = LlmRouter([EVON, GEMINI])
    collected = []
    with pytest.raises(LlmHTTPError):
        async for d in router.stream_chat(messages=[]):
            collected.append(d)
    assert [c.content for c in collected] == ["partial"]


async def test_router_parks_failed_provider_for_cooldown(monkeypatch):
    clock = [0.0]
    fake = _FakeDeltaStream({
        "evon": [LlmHTTPError(503, "down", provider="evon")],
        "gemini": [ChatDelta(content="hi")],
    })
    monkeypatch.setattr(llm_client, "stream_chat", fake)
    router = LlmRouter([EVON, GEMINI], cooldown_s=60.0, clock=lambda: clock[0])
    _ = [d async for d in router.stream_chat(messages=[])]
    assert fake.calls == ["evon", "gemini"]

    # Second call within the cooldown window should skip evon entirely.
    fake.calls.clear()
    fake.responses["gemini"] = [ChatDelta(content="hi2")]
    clock[0] = 10.0
    _ = [d async for d in router.stream_chat(messages=[])]
    assert fake.calls == ["gemini"]

    # After the cooldown elapses, evon is retried.
    fake.calls.clear()
    fake.responses["evon"] = [ChatDelta(content="back")]
    clock[0] = 61.0
    deltas = [d async for d in router.stream_chat(messages=[])]
    assert fake.calls == ["evon"]
    assert deltas[0].content == "back"


async def test_router_chat_completion_failover(monkeypatch):
    from app.llm.client import ChatResult

    async def fake_completion(*, provider, **kw):
        if provider.name == "evon":
            raise LlmHTTPError(500, "down", provider="evon")
        return ChatResult(content="ok", tool_calls=None, finish_reason="stop")

    monkeypatch.setattr(llm_client, "chat_completion", fake_completion)
    router = LlmRouter([EVON, GEMINI])
    result = await router.chat_completion(messages=[])
    assert result.content == "ok"
    assert router.last_label == GEMINI.label


def test_router_complete_sync_failover(monkeypatch):
    from app.llm.client import ChatResult

    def fake_sync(*, provider, **kw):
        if provider.name == "evon":
            raise LlmHTTPError(500, "down", provider="evon")
        return ChatResult(content="sync-ok", tool_calls=None, finish_reason="stop")

    monkeypatch.setattr(llm_client, "chat_completion_sync", fake_sync)
    router = LlmRouter([EVON, GEMINI])
    result, provider = router.complete_sync(messages=[])
    assert result.content == "sync-ok"
    assert provider.name == "gemini"


def test_router_configured_and_primary_label():
    router = LlmRouter([EVON, GEMINI])
    assert router.configured is True
    assert router.primary_label == "Gnani Evon v3.3"
    empty = LlmRouter([])
    assert empty.configured is False
    assert empty.primary_label is None
