"""Long-term semantic memory: what the product remembered, and what it must forget.

The whole point of this route is that memory is not a hidden side effect. A user can read
every sentence the system will inject into a future prompt, see when it was last used, and
delete it. Deletion returns 404 for someone else's row instead of 403, so an id probe cannot
confirm that a memory exists.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user
from app.api.errors import not_found
from app.db.models import User
from app.db.session import get_db
from app.memory import long_term
from app.schemas import MemoryOut

router = APIRouter(tags=["memory"])


@router.get("/memory")
async def list_memory(
    user: User = Depends(current_user), db: AsyncSession = Depends(get_db)
) -> dict:
    rows = await long_term.list_memories(db, user.id)
    memories = [
        MemoryOut(
            id=row.id,
            kind=row.kind,
            content=row.content,
            created_at=row.created_at,
            last_used_at=row.last_used_at,
        ).model_dump(mode="json")
        for row in rows
    ]
    return {"memories": memories}


@router.delete("/memory/{memory_id}", status_code=204)
async def delete_memory(
    memory_id: str, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)
) -> Response:
    if not await long_term.forget(db, user.id, memory_id):
        raise not_found("记忆")
    return Response(status_code=204)
