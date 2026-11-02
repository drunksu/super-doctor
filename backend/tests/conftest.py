"""Test bootstrap: point the app at a throwaway database and mock models before import."""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

_TMP = Path(tempfile.mkdtemp(prefix="super-doctor-test-"))
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{(_TMP / 'test.db').as_posix()}"
os.environ["JWT_SECRET"] = "test-secret-not-for-production-0123456789"
os.environ["MODEL_MODE"] = "mock"
os.environ["ENV"] = "test"

import pytest  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402

from app.config import settings  # noqa: E402
from app.db.session import init_db  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
async def _database():
    await init_db()
    yield


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as http:
        yield http


@pytest.fixture
async def token(client) -> str:
    response = await client.post(
        "/api/auth/login", json={"email": settings.demo_email, "password": settings.demo_password}
    )
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


@pytest.fixture
def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}
