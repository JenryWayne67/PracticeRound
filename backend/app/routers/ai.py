from typing import Literal

import anthropic
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ..deps import CurrentUser
from ..services import llm

router = APIRouter(prefix="/ai", tags=["ai"])


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    system: str | None = None


@router.post("/chat")
async def chat(data: ChatRequest, user: CurrentUser):
    """Streams the reply as plain text chunks (see streamText in frontend/src/lib/api.ts)."""
    stream = llm.stream_chat([m.model_dump() for m in data.messages], data.system)
    # Pull the first chunk before responding so auth/config errors become a real HTTP error.
    try:
        first = await anext(stream, "")
    except anthropic.AuthenticationError:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "ANTHROPIC_API_KEY is missing or invalid")
    except anthropic.RateLimitError:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "AI rate limit hit, try again shortly")
    except anthropic.APIStatusError as e:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"AI error: {e.message}")
    except (anthropic.APIConnectionError, TypeError):
        # TypeError: the SDK found no credentials at all.
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "AI is not configured or unreachable")

    async def body():
        yield first
        try:
            async for chunk in stream:
                yield chunk
        except anthropic.APIError:
            yield "\n\n[The AI stream was interrupted.]"

    return StreamingResponse(body(), media_type="text/plain; charset=utf-8")
