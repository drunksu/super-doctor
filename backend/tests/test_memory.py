"""Semantic memory is only trustworthy if it is both visible and deletable.

Each test registers its own user: the test database file is shared across the session, so
reusing the demo account would let one test's memories leak into another's empty list.
"""

from __future__ import annotations

import json
import uuid

from app.agents.pipeline import _context_block
from app.db.models import User
from app.db.session import SessionFactory
from app.memory import long_term
from app.services import chat


async def _register(client) -> tuple[dict, str]:
    email = f"memory-{uuid.uuid4().hex[:10]}@superdoctor.ai"
    response = await client.post(
        "/api/auth/register",
        json={"email": email, "password": "memory1234", "display_name": "记忆测试"},
    )
    assert response.status_code == 201, response.text
    body = response.json()
    return {"Authorization": f"Bearer {body['access_token']}"}, body["user"]["id"]


async def _remember(user_id: str, content: str, kind: str = "fact") -> str:
    async with SessionFactory() as db:
        memory = await long_term.add_memory(db, user_id, kind, content)
        await db.commit()
        assert memory is not None
        return memory.id


async def _user(user_id: str) -> User:
    async with SessionFactory() as db:
        user = await db.get(User, user_id)
        assert user is not None
        return user


async def _session(client, headers: dict) -> str:
    response = await client.post("/api/sessions", json={}, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()["id"]


async def test_lists_memories_with_usage_time(client) -> None:
    headers, user_id = await _register(client)
    memory_id = await _remember(user_id, "去年做过胆囊手术")

    response = await client.get("/api/memory", headers=headers)
    assert response.status_code == 200
    memories = response.json()["memories"]
    assert [memory["id"] for memory in memories] == [memory_id]
    assert memories[0]["content"] == "去年做过胆囊手术"
    assert memories[0]["created_at"]
    assert memories[0]["last_used_at"] is None


async def test_empty_memory_is_an_empty_list(client) -> None:
    headers, _ = await _register(client)

    response = await client.get("/api/memory", headers=headers)
    assert response.status_code == 200
    assert response.json() == {"memories": []}


async def test_delete_removes_memory(client) -> None:
    headers, user_id = await _register(client)
    memory_id = await _remember(user_id, "每天早餐后测血压")

    deleted = await client.delete(f"/api/memory/{memory_id}", headers=headers)
    assert deleted.status_code == 204
    assert (await client.get("/api/memory", headers=headers)).json()["memories"] == []

    again = await client.delete(f"/api/memory/{memory_id}", headers=headers)
    assert again.status_code == 404
    assert again.json()["error"]["code"] == "not_found"


async def test_deleted_memory_is_absent_from_the_next_prompt(client) -> None:
    headers, user_id = await _register(client)
    memory_id = await _remember(user_id, "去年做过胆囊手术")
    session_id = await _session(client, headers)
    user = await _user(user_id)
    message = "我最近右上腹不舒服，去年做过胆囊手术"

    first = await chat.build_context(user, session_id, message)
    assert "去年做过胆囊手术" in first.memories
    assert "【长期记忆】" in _context_block(first)

    # The recall was a real use, and the list must say so.
    listed = (await client.get("/api/memory", headers=headers)).json()["memories"]
    assert listed[0]["last_used_at"] is not None

    assert (await client.delete(f"/api/memory/{memory_id}", headers=headers)).status_code == 204

    second = await chat.build_context(user, session_id, message)
    assert all("胆囊手术" not in memory for memory in second.memories)
    # The user's own words stay in the prompt; the injected memory block must not.
    assert "【长期记忆】" not in _context_block(second)


async def test_turn_announces_the_memories_it_injected(client) -> None:
    headers, user_id = await _register(client)
    await _remember(user_id, "去年做过胆囊手术")
    session_id = await _session(client, headers)

    events: list[tuple[str, dict]] = []
    async with client.stream(
        "POST",
        "/api/chat/stream",
        json={"session_id": session_id, "message": "我右上腹不舒服，去年做过胆囊手术"},
        headers=headers,
        timeout=60,
    ) as response:
        assert response.status_code == 200
        event_name = None
        async for line in response.aiter_lines():
            if line.startswith("event:"):
                event_name = line.split(":", 1)[1].strip()
            elif line.startswith("data:") and event_name:
                events.append((event_name, json.loads(line.split(":", 1)[1].strip())))

    announced = [payload for name, payload in events if name == "memory"]
    assert announced, "the turn must say which memories it carried"
    assert announced[0]["count"] >= 1
    assert "去年做过胆囊手术" in announced[0]["items"]
    assert events[-1][0] == "done"


async def test_deleting_someone_elses_memory_is_404(client) -> None:
    owner_headers, owner_id = await _register(client)
    other_headers, _ = await _register(client)
    memory_id = await _remember(owner_id, "对青霉素过敏")

    assert (await client.get("/api/memory", headers=other_headers)).json()["memories"] == []

    response = await client.delete(f"/api/memory/{memory_id}", headers=other_headers)
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"

    # Still owned by the original user: the 404 never deleted it.
    remaining = (await client.get("/api/memory", headers=owner_headers)).json()["memories"]
    assert [memory["id"] for memory in remaining] == [memory_id]
