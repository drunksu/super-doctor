"""Guideline retrieval service (process-wide singleton)."""

from __future__ import annotations

import logging

from app.rag.corpus import Chunk, load_corpus
from app.rag.index import Hit, HybridIndex

log = logging.getLogger("mediflow.rag")

_index: HybridIndex | None = None


def get_index() -> HybridIndex:
    global _index
    if _index is None:
        chunks = load_corpus()
        _index = HybridIndex(chunks)
        log.info("guideline index ready: %s", _index.stats())
    return _index


def reload_index() -> HybridIndex:
    global _index
    _index = HybridIndex(load_corpus())
    return _index


def search(query: str, k: int = 4) -> list[Hit]:
    return get_index().search(query, k=k)


def format_hits(hits: list[Hit]) -> str:
    """Prompt-facing rendering.

    Chunks are numbered 1..n in the same order as the citation list, so the model cites
    ``[2]`` instead of an internal id like ``hypertension#3``. The user then sees the same
    number the model wrote, and the mapping back to a real document stays in the payload.
    """
    if not hits:
        return "（本地指南库没有检索到直接相关条目，请基于通用医学常识回答，并说明信息来源有限。）"
    lines = []
    for index, hit in enumerate(hits, start=1):
        chunk: Chunk = hit.chunk
        lines.append(
            f"[{index}] 《{chunk.title}》· {chunk.section}\n{chunk.text.strip()}\n"
            f"（来源：{chunk.source}）"
        )
    return "\n\n".join(lines)


def citations_from(hits: list[Hit]) -> list[dict]:
    return [
        {
            "id": hit.chunk.id,
            "title": hit.chunk.title,
            "source": hit.chunk.source,
            "section": hit.chunk.section,
            "snippet": hit.chunk.snippet,
            "score": hit.score,
        }
        for hit in hits
    ]


def stats() -> dict:
    return get_index().stats()
