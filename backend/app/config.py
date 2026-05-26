from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")

    env: Literal["development", "staging", "production", "test"] = "development"
    log_level: str = "INFO"
    database_url: str = Field(...)
    cors_origins: str = "http://localhost:3000"
    supabase_url: str | None = None
    supabase_service_role_key: str | None = None
    ica_api_key: str | None = None
    ica_base_url: str | None = None
    gcp_vision_credentials_json: str | None = None
    sentry_dsn: str | None = None


def get_settings() -> Settings:
    return Settings()
