"""Application settings, loaded from `backend/.env` (see `.env.example`)."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BACKEND_DIR / "data"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # identity ---------------------------------------------------------------
    app_name: str = "Super-Doctor"
    version: str = "0.1.0"
    env: Literal["dev", "test", "prod"] = "dev"
    api_prefix: str = "/api"

    # model ------------------------------------------------------------------
    model_mode: Literal["auto", "live", "mock"] = "auto"
    deepseek_api_key: str | None = None
    deepseek_base_url: str = "https://api.deepseek.com"
    model_supervisor: str = "deepseek-flash"
    model_worker: str = "deepseek-v4-pro"
    request_timeout_s: float = 90.0

    # storage ----------------------------------------------------------------
    data_dir: Path = DATA_DIR
    database_url: str | None = None

    # auth -------------------------------------------------------------------
    jwt_secret: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    jwt_ttl_minutes: int = 60 * 24 * 7

    # demo account -----------------------------------------------------------
    demo_email: str = "demo@superdoctor.ai"
    demo_password: str = "demo1234"
    demo_display_name: str = "体验用户"

    # limits -----------------------------------------------------------------
    max_upload_mb: int = 10
    max_context_messages: int = 12
    intake_ttl_days: int = 30
    summary_every_messages: int = 6

    # http -------------------------------------------------------------------
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ]

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @property
    def resolved_database_url(self) -> str:
        if self.database_url:
            return self.database_url
        self.data_dir.mkdir(parents=True, exist_ok=True)
        return f"sqlite+aiosqlite:///{(self.data_dir / 'super-doctor.db').as_posix()}"

    @property
    def live_model_enabled(self) -> bool:
        if self.model_mode == "mock":
            return False
        return bool(self.deepseek_api_key)

    @property
    def model_mode_resolved(self) -> Literal["live", "mock"]:
        return "live" if self.live_model_enabled else "mock"


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    return settings


settings = get_settings()
