import os
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# APP_ENV で読み込む env ファイルを切り替える。
#   dev  → .env.dev   (ローカル開発、既定)
#   prod → .env.prod  (本番、または本番シミュレーション)
#   test → .env.test  (CI / テスト。実体ファイルが無くても OK、conftest.py が
#                       os.environ.setdefault でデフォルト値を入れている)
# 環境変数(os.environ)は env_file よりも優先されるので、Fly.io secrets や
# CI の env で渡された値はファイルの値を上書きする。
_APP_ENV = os.getenv("APP_ENV", "dev")
_ENV_FILE = f".env.{_APP_ENV}"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=_ENV_FILE, case_sensitive=False, extra="ignore")

    env: Literal["development", "staging", "production", "test"] = "development"
    log_level: str = "INFO"
    database_url: str = Field(...)
    cors_origins: str = "http://localhost:3000"
    supabase_url: str | None = None
    supabase_service_role_key: str | None = None
    supabase_anon_key: str | None = None
    sentry_dsn: str | None = None


def get_settings() -> Settings:
    return Settings()
