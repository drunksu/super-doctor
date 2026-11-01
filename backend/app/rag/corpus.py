"""Corpus loading and section-level chunking.

The corpus is plain Markdown with YAML front-matter, one file per topic. Every `##`
heading starts a new retrieval unit, because a retrieval unit should be small enough to
quote in a chat answer and large enough to stand on its own — exactly one section.
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass, field
from pathlib import Path

CORPUS_DIR = Path(__file__).resolve().parent / "corpus"

_FRONT_MATTER = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL)


@dataclass(frozen=True)
class Chunk:
    id: str
    doc_id: str
    title: str
    source: str
    year: int | None
    section: str
    text: str
    tags: tuple[str, ...] = field(default=())

    @property
    def snippet(self) -> str:
        body = re.sub(r"\s+", " ", self.text).strip()
        return body[:220] + ("…" if len(body) > 220 else "")

    def as_dict(self) -> dict:
        return {
            "id": self.id,
            "title": self.title,
            "source": self.source,
            "section": self.section,
            "snippet": self.snippet,
            "score": 0.0,
        }


def _parse_front_matter(raw: str) -> tuple[dict[str, object], str]:
    match = _FRONT_MATTER.match(raw)
    if not match:
        return {}, raw
    meta: dict[str, object] = {}
    for line in match.group(1).splitlines():
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        key, value = key.strip(), value.strip()
        if value.startswith("[") and value.endswith("]"):
            meta[key] = [item.strip().strip("'\"") for item in value[1:-1].split(",") if item.strip()]
        else:
            meta[key] = value.strip("'\"")
    return meta, raw[match.end() :]


def _split_sections(body: str) -> list[tuple[str, str]]:
    """Return [(section_title, text)] with the preamble as 概述."""
    sections: list[tuple[str, str]] = []
    current_title = "概述"
    buffer: list[str] = []
    for line in body.splitlines():
        if line.startswith("## "):
            if any(part.strip() for part in buffer):
                sections.append((current_title, "\n".join(buffer).strip()))
            current_title = line[3:].strip()
            buffer = []
        else:
            buffer.append(line)
    if any(part.strip() for part in buffer):
        sections.append((current_title, "\n".join(buffer).strip()))
    return [(title, text) for title, text in sections if len(text) >= 40]


def load_corpus(directory: Path | None = None) -> list[Chunk]:
    directory = directory or CORPUS_DIR
    if not directory.exists():
        return []

    chunks: list[Chunk] = []
    for path in sorted(directory.glob("*.md")):
        raw = path.read_text(encoding="utf-8")
        meta, body = _parse_front_matter(raw)
        doc_id = str(meta.get("id") or path.stem)
        title = str(meta.get("title") or path.stem)
        source = str(meta.get("source") or "本地知识库")
        year_raw = meta.get("year")
        year = int(year_raw) if isinstance(year_raw, str) and year_raw.isdigit() else None
        tags = tuple(meta.get("tags") or ())  # type: ignore[arg-type]

        for index, (section, text) in enumerate(_split_sections(body), start=1):
            chunks.append(
                Chunk(
                    id=f"{doc_id}#{index}",
                    doc_id=doc_id,
                    title=title,
                    source=source,
                    year=year,
                    section=section,
                    text=text,
                    tags=tags,
                )
            )
    return chunks


def corpus_fingerprint(chunks: list[Chunk]) -> str:
    digest = hashlib.sha1()
    for chunk in chunks:
        digest.update(chunk.id.encode())
        digest.update(chunk.text.encode())
    return digest.hexdigest()[:12]
