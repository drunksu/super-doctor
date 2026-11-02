"""HTTP surface: auth, sessions, streaming protocol, reports, analytics."""

from __future__ import annotations

import json

import pytest


async def test_health(client) -> None:
    response = await client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["model_mode"] in {"live", "mock"}


async def test_login_and_me(client, auth) -> None:
    response = await client.get("/api/me", headers=auth)
    assert response.status_code == 200
    assert response.json()["email"] == "demo@superdoctor.ai"


async def test_unauthorized(client) -> None:
    response = await client.get("/api/sessions")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthorized"


async def test_bad_login(client) -> None:
    response = await client.post("/api/auth/login", json={"email": "demo@superdoctor.ai", "password": "wrong"})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "invalid_credentials"


async def test_session_lifecycle(client, auth) -> None:
    created = await client.post("/api/sessions", json={}, headers=auth)
    assert created.status_code == 201
    session_id = created.json()["id"]

    listing = await client.get("/api/sessions", headers=auth)
    assert any(item["id"] == session_id for item in listing.json()["sessions"])

    detail = await client.get(f"/api/sessions/{session_id}/messages", headers=auth)
    assert detail.status_code == 200
    assert detail.json()["messages"] == []

    deleted = await client.delete(f"/api/sessions/{session_id}", headers=auth)
    assert deleted.status_code == 204


async def test_streaming_turn_emits_contract_events(client, auth) -> None:
    session = (await client.post("/api/sessions", json={}, headers=auth)).json()

    events: list[tuple[str, dict]] = []
    async with client.stream(
        "POST",
        "/api/chat/stream",
        json={"session_id": session["id"], "message": "最近总是头晕，早上起来尤其明显"},
        headers=auth,
        timeout=60,
    ) as response:
        assert response.status_code == 200
        event_name = None
        async for line in response.aiter_lines():
            if line.startswith("event:"):
                event_name = line.split(":", 1)[1].strip()
            elif line.startswith("data:") and event_name:
                payload = json.loads(line.split(":", 1)[1].strip())
                events.append((event_name, payload))

    names = [name for name, _ in events]
    assert "run_started" in names
    assert "agent" in names
    assert "token" in names
    assert names[-1] == "done"

    done = events[-1][1]
    assert done["message_id"]
    assert done["latency_ms"] >= 0
    assert "safety" in done and done["safety"]["level"] in {"routine", "attention", "urgent"}

    text = "".join(payload["text"] for name, payload in events if name == "token")
    assert len(text) > 20


async def test_emergency_turn_short_circuits(client, auth) -> None:
    session = (await client.post("/api/sessions", json={}, headers=auth)).json()
    events: list[tuple[str, dict]] = []
    async with client.stream(
        "POST",
        "/api/chat/stream",
        json={"session_id": session["id"], "message": "我爸胸口压着疼，满头大汗，已经十几分钟了"},
        headers=auth,
        timeout=60,
    ) as response:
        event_name = None
        async for line in response.aiter_lines():
            if line.startswith("event:"):
                event_name = line.split(":", 1)[1].strip()
            elif line.startswith("data:") and event_name:
                events.append((event_name, json.loads(line.split(":", 1)[1].strip())))

    safety = [payload for name, payload in events if name == "safety"]
    assert safety and safety[0]["level"] == "urgent"
    text = "".join(payload["text"] for name, payload in events if name == "token")
    assert "120" in text


async def test_report_paste_and_insight(client, auth) -> None:
    created = await client.post(
        "/api/reports/text",
        json={"text": "总胆固醇 6.1 mmol/L <5.2\n低密度脂蛋白 4.2 mmol/L <3.4\n血红蛋白 118 g/L 115-150"},
        headers=auth,
    )
    assert created.status_code == 202
    report_id = created.json()["report_id"]

    insight = None
    for _ in range(20):
        response = await client.get(f"/api/reports/{report_id}", headers=auth)
        insight = response.json()
        if insight["status"] != "parsing":
            break
        import asyncio

        await asyncio.sleep(0.5)

    assert insight is not None
    assert insight["status"] == "ready"
    names = {marker["name"] for marker in insight["markers"]}
    assert "低密度脂蛋白胆固醇" in names
    ldl = next(marker for marker in insight["markers"] if marker["name"] == "低密度脂蛋白胆固醇")
    assert ldl["status"] == "high"


async def test_insights_endpoint(client, auth) -> None:
    response = await client.get("/api/insights/summary", headers=auth)
    assert response.status_code == 200
    body = response.json()
    for key in ("runs", "sessions", "messages", "routes", "safety", "daily"):
        assert key in body
    assert len(body["daily"]) == 7
