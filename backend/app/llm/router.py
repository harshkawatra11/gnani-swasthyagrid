"""Ordered LLM providers: Evon first when an endpoint is configured, Gemini as fallback.

Fails over only before the first streamed delta (never mid-answer) and parks a failed
provider for `cooldown_s` so a cold or dead Evon endpoint costs one attempt, not one per
turn.
"""

import asyncio
import logging
import time
from collections.abc import AsyncIterator, Callable

from app.core.config import Settings
from app.llm import client
from app.llm.client import ChatDelta, ChatResult, LlmProvider

logger = logging.getLogger("swasthyagrid.llm")

MODEL_LABELS = {"gnani-evon-v3.3": "Gnani Evon v3.3"}


def build_providers(settings: Settings) -> list[LlmProvider]:
    evon = gemini = None
    if settings.evon_base_url:
        evon = LlmProvider(
            name="evon",
            label="Gnani Evon v3.3",
            base_url=settings.evon_base_url,
            model=settings.evon_model,
            api_key=settings.evon_api_key,
            connect_timeout=4.0,
            extra_body={"top_p": 0.95, "chat_template_kwargs": {"enable_thinking": False}},
        )
    if settings.gemini_api_key:
        model = settings.gemini_chat_model or settings.gemini_model
        extra = {"reasoning_effort": settings.gemini_reasoning_effort} if settings.gemini_reasoning_effort else {}
        floor = 0 if settings.gemini_reasoning_effort == "none" else 1024
        gemini = LlmProvider(
            name="gemini",
            label=f"Google {model}" + (" (Evon fallback)" if evon else ""),
            base_url=settings.gemini_openai_base_url,
            model=model,
            api_key=settings.gemini_api_key,
            extra_body=extra,
            max_tokens_floor=floor,
        )
    order = [evon, gemini] if settings.llm_primary == "evon" else [gemini, evon]
    return [p for p in order if p is not None]


class LlmRouter:
    def __init__(
        self,
        providers: list[LlmProvider],
        *,
        cooldown_s: float = 60.0,
        clock: Callable[[], float] = time.monotonic,
    ):
        self.providers = providers
        self.cooldown_s = cooldown_s
        self._clock = clock
        self._down_until: dict[str, float] = {}
        self.last_provider: LlmProvider | None = None

    @property
    def configured(self) -> bool:
        return bool(self.providers)

    @property
    def primary_label(self) -> str | None:
        return self.providers[0].label if self.providers else None

    @property
    def last_label(self) -> str | None:
        return self.last_provider.label if self.last_provider else None

    def _candidates(self) -> list[LlmProvider]:
        now = self._clock()
        live = [p for p in self.providers if self._down_until.get(p.name, 0.0) <= now]
        return live or list(self.providers)

    def _failed(self, p: LlmProvider, exc: BaseException) -> None:
        self._down_until[p.name] = self._clock() + self.cooldown_s
        logger.warning("LLM provider %s failed (%s); trying the next one", p.name, exc)

    async def stream_chat(self, **kw) -> AsyncIterator[ChatDelta]:
        last: BaseException | None = None
        for p in self._candidates():
            started = False
            try:
                async for delta in client.stream_chat(provider=p, **kw):
                    if not started:
                        started = True
                        self.last_provider = p
                    yield delta
                self.last_provider = p
                return
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                if started:
                    raise
                last = exc
                self._failed(p, exc)
        raise last or RuntimeError("no LLM provider configured")

    async def chat_completion(self, **kw) -> ChatResult:
        last: BaseException | None = None
        for p in self._candidates():
            try:
                res = await client.chat_completion(provider=p, **kw)
                self.last_provider = p
                return res
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                last = exc
                self._failed(p, exc)
        raise last or RuntimeError("no LLM provider configured")

    def complete_sync(self, **kw) -> tuple[ChatResult, LlmProvider]:
        last: BaseException | None = None
        for p in self._candidates():
            try:
                return client.chat_completion_sync(provider=p, **kw), p
            except Exception as exc:
                last = exc
                self._failed(p, exc)
        raise last or RuntimeError("no LLM provider configured")


def build_router(settings: Settings) -> LlmRouter:
    return LlmRouter(build_providers(settings))
