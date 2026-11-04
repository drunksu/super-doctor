---
title: Super-Doctor
emoji: 🩺
colorFrom: teal
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
license: mit
short_description: Triage-first medical consultation agents, no API key needed
---

# Super-Doctor — live demo

Triage-first medical consultation agents: a deterministic red-flag gate that runs **before any
model call**, a Router that only decides, isolated Workers that each own one section of the
answer, and a sentence-level guard on the way out.

- **Sign in with** `demo@superdoctor.ai` / `demo1234`.
- **No API key is configured here**, so the backend runs its offline demo pipeline
  (`MODEL_MODE=auto` with no key resolves to `mock`). The UI says so; nothing pretends a model
  answered.
- Try the red-flag path: `胸口疼，冒冷汗，喘不上气` — the first stream event is `safety` and the
  turn becomes an emergency response without calling a model.
- The API docs are proxied at `/docs` if you want to poke the backend directly.

This Space only contains the four files in this folder. The image clones
[github.com/drunksu/super-doctor](https://github.com/drunksu/super-doctor) at build time and builds
the frontend and backend from there, so the demo cannot drift away from `main`.

The first request after the Space has been idle pays a cold start (container boot + Next.js
startup). That is the free tier, stated plainly rather than hidden.

Source, design notes and the evaluation write-up: <https://github.com/drunksu/super-doctor>
