"""Hybrid retrieval: BM25 (lexical) + char n-gram TF-IDF (semantic-ish) fused by RRF.

Why not a neural embedding model? Because the deployment target is a laptop: a local
embedding model adds ~400 MB of weights and a GPU-shaped dependency, and for a 14-document
guideline corpus a character n-gram space model is *better* at exact Chinese medical terms
(`低密度脂蛋白`, `糖化血红蛋白`) than a small dense model. The `EmbeddingProvider` seam below
keeps the door open for swapping in a real embedding service.
"""

from __future__ import annotations

import math
import re
from collections import Counter
from dataclasses import dataclass
from typing import Protocol

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer

from app.rag.corpus import Chunk


@dataclass
class Hit:
    chunk: Chunk
    score: float
    lexical_rank: int | None = None
    semantic_rank: int | None = None


class EmbeddingProvider(Protocol):
    def encode(self, texts: list[str]) -> np.ndarray: ...


_LATIN = re.compile(r"[a-zA-Z][a-zA-Z0-9\-]+|\d+(?:\.\d+)?")


def tokenize(text: str) -> list[str]:
    """Latin/number words + CJK character bigrams (no dictionary needed, robust to typos)."""
    lower = text.lower()
    tokens = _LATIN.findall(lower)
    cjk = [char for char in lower if "\u4e00" <= char <= "\u9fff"]
    tokens.extend("".join(cjk[i : i + 2]) for i in range(len(cjk) - 1))
    tokens.extend(cjk)
    return tokens


class BM25:
    def __init__(self, documents: list[list[str]], k1: float = 1.5, b: float = 0.75) -> None:
        self.k1, self.b = k1, b
        self.documents = documents
        self.doc_len = np.array([len(doc) for doc in documents], dtype=float)
        self.avg_len = float(self.doc_len.mean()) if len(documents) else 0.0
        self.term_freqs = [Counter(doc) for doc in documents]
        df: Counter[str] = Counter()
        for doc in documents:
            df.update(set(doc))
        n = len(documents)
        self.idf = {term: math.log(1 + (n - freq + 0.5) / (freq + 0.5)) for term, freq in df.items()}

    def scores(self, query: list[str]) -> np.ndarray:
        result = np.zeros(len(self.documents))
        if not self.documents:
            return result
        for i, freqs in enumerate(self.term_freqs):
            denom_norm = self.k1 * (1 - self.b + self.b * self.doc_len[i] / (self.avg_len or 1.0))
            total = 0.0
            for term in query:
                tf = freqs.get(term)
                if not tf:
                    continue
                total += self.idf.get(term, 0.0) * tf * (self.k1 + 1) / (tf + denom_norm)
            result[i] = total
        return result


class HybridIndex:
    """In-memory index. Rebuild cost for 14 docs is a few milliseconds."""

    def __init__(self, chunks: list[Chunk], rrf_k: int = 60) -> None:
        self.chunks = chunks
        self.rrf_k = rrf_k
        self._bm25 = BM25([tokenize(chunk.text) for chunk in chunks])
        texts = [f"{chunk.title} {chunk.section} {chunk.text}" for chunk in chunks]
        if texts:
            self._vectorizer: TfidfVectorizer | None = TfidfVectorizer(
                analyzer="char_wb", ngram_range=(2, 3), min_df=1, sublinear_tf=True
            )
            self._matrix = self._vectorizer.fit_transform(texts)
        else:
            self._vectorizer = None
            self._matrix = None

    def search(self, query: str, k: int = 4, *, candidates: int = 20) -> list[Hit]:
        if not self.chunks:
            return []

        lexical = self._bm25.scores(tokenize(query))
        lexical_order = [int(i) for i in np.argsort(-lexical)[:candidates] if lexical[i] > 0]

        semantic_order: list[int] = []
        if self._vectorizer is not None and self._matrix is not None:
            query_vec = self._vectorizer.transform([query])
            similarity = (self._matrix @ query_vec.T).toarray().ravel()
            semantic_order = [int(i) for i in np.argsort(-similarity)[:candidates] if similarity[i] > 0.01]
        else:
            similarity = np.zeros(len(self.chunks))

        fused: dict[int, float] = {}
        for rank, idx in enumerate(lexical_order, start=1):
            fused[idx] = fused.get(idx, 0.0) + 1.0 / (self.rrf_k + rank)
        for rank, idx in enumerate(semantic_order, start=1):
            fused[idx] = fused.get(idx, 0.0) + 1.0 / (self.rrf_k + rank)

        if not fused:  # nothing matched: fall back to the most lexical-similar chunks
            for idx in lexical_order[:k] or range(min(k, len(self.chunks))):
                fused[idx] = 0.0

        ranked = sorted(fused.items(), key=lambda item: item[1], reverse=True)[:k]
        top = ranked[0][1] if ranked and ranked[0][1] > 0 else 1.0
        lexical_pos = {idx: rank for rank, idx in enumerate(lexical_order, start=1)}
        semantic_pos = {idx: rank for rank, idx in enumerate(semantic_order, start=1)}

        return [
            Hit(
                chunk=self.chunks[idx],
                score=round(min(1.0, value / top), 4) if value else round(float(similarity[idx]), 4),
                lexical_rank=lexical_pos.get(idx),
                semantic_rank=semantic_pos.get(idx),
            )
            for idx, value in ranked
        ]

    def stats(self) -> dict:
        return {"chunks": len(self.chunks), "documents": len({c.doc_id for c in self.chunks})}
