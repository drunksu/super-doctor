"""Assemble the demo GIF from the streaming frames captured by tools/shot.mjs.

    python tools/make_gif.py

Frames live in .frames/ (1440x900 @2x). They are downscaled to 960x600 and written to
docs/images/demo.gif with a short hold on the final frame.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
FRAMES = ROOT / ".frames"
OUT = ROOT / "docs" / "images" / "demo.gif"
SIZE = (960, 600)
DURATION_MS = 900


def main() -> None:
    paths = sorted(FRAMES.glob("frame-*.png"))
    if not paths:
        raise SystemExit(f"no frames in {FRAMES} — run `node tools/shot.mjs` first")

    images = [Image.open(path).convert("RGB").resize(SIZE, Image.LANCZOS) for path in paths]
    images[0].save(
        OUT,
        save_all=True,
        append_images=images[1:],
        duration=DURATION_MS,
        loop=0,
        optimize=True,
    )
    size_mb = OUT.stat().st_size / (1024 * 1024)
    print(f"wrote {OUT} · {len(images)} frames · {size_mb:.1f} MB")


if __name__ == "__main__":
    main()
