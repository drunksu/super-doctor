"""Model factory.

Two model tiers, matching the cost/latency split that makes a router/worker architecture
worth it: a fast model decides *where* a turn goes, a strong model *writes* the turn.
"""

from __future__ import annotations

import logging
from functools import lru_cache

from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.deepseek import DeepSeekProvider

from app.config import settings

log = logging.getLogger("super-doctor.models")


@lru_cache(maxsize=4)
def _provider() -> DeepSeekProvider:
    return DeepSeekProvider(api_key=settings.deepseek_api_key or "")


@lru_cache(maxsize=4)
def get_model(tier: str = "worker") -> OpenAIChatModel | None:
    if not settings.live_model_enabled:
        return None
    name = settings.model_supervisor if tier == "supervisor" else settings.model_worker
    model = OpenAIChatModel(name, provider=_provider())
    log.info("model ready: tier=%s name=%s", tier, name)
    return model


def model_label(tier: str) -> str:
    if not settings.live_model_enabled:
        return "mock"
    return settings.model_supervisor if tier == "supervisor" else settings.model_worker
