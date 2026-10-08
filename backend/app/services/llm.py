"""Thin wrapper around the Claude API. Change the model/system prompt in config.py or .env."""

from collections.abc import AsyncIterator

from anthropic import AsyncAnthropic

from ..config import settings

_client: AsyncAnthropic | None = None


def get_client() -> AsyncAnthropic:
    global _client
    if _client is None:
        _client = AsyncAnthropic(api_key=settings.anthropic_api_key)
    return _client


async def stream_chat(messages: list[dict], system: str | None = None) -> AsyncIterator[str]:
    """Yield text chunks for a conversation: [{"role": "user"|"assistant", "content": "..."}]."""
    async with get_client().messages.stream(
        model=settings.ai_model,
        max_tokens=16000,
        system=system or settings.ai_system_prompt,
        messages=messages,
    ) as stream:
        async for text in stream.text_stream:
            yield text
        final = await stream.get_final_message()
        if final.stop_reason == "refusal":
            yield "\n\n[The model declined this request.]"


async def complete(prompt: str, system: str | None = None) -> str:
    """One-shot helper for backend features (summarize, classify, extract...)."""
    return "".join([chunk async for chunk in stream_chat([{"role": "user", "content": prompt}], system)])
