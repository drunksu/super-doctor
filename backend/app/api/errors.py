"""Typed API errors — every failure has a stable code the frontend can switch on."""

from __future__ import annotations

from fastapi import Request
from fastapi.responses import JSONResponse


class ApiError(Exception):
    def __init__(self, code: str, message: str, status: int = 400) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status


def invalid_credentials() -> ApiError:
    return ApiError("invalid_credentials", "邮箱或密码不正确", 401)


def unauthorized() -> ApiError:
    return ApiError("unauthorized", "登录状态已失效，请重新登录", 401)


def not_found(what: str = "资源") -> ApiError:
    return ApiError("not_found", f"{what}不存在", 404)


async def api_error_handler(_request: Request, exc: ApiError) -> JSONResponse:
    return JSONResponse(status_code=exc.status, content={"error": {"code": exc.code, "message": exc.message}})
