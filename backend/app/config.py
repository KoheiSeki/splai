import os
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# 既定で `.env.local` を読み込む(Next.js / JS エコシステムと命名統一)。
# 必要なら APP_ENV で別ファイルに切り替え可能:
#   APP_ENV 未設定 → .env.local (ローカル開発)
#   APP_ENV=test   → .env.test  (CI / テスト。実体不要、conftest.py が
#                                   os.environ.setdefault で値を注入する)
#   APP_ENV=prod   → .env.prod  (本番シミュレーション。通常は Fly.io secrets で代替)
#
# 環境変数(os.environ)は env_file よりも優先されるので、Fly.io secrets や
# CI の env で渡された値はファイルの値を上書きする。
_APP_ENV = os.getenv("APP_ENV")
_ENV_FILE = f".env.{_APP_ENV}" if _APP_ENV else ".env.local"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=_ENV_FILE, case_sensitive=False, extra="ignore")

    env: Literal["development", "staging", "production", "test"] = "development"
    log_level: str = "INFO"
    database_url: str = Field(...)
    cors_origins: str = "http://localhost:3000"
    supabase_url: str | None = None
    supabase_service_role_key: str | None = None
    supabase_anon_key: str | None = None
    ica_base_url: str | None = None
    ica_api_key: str | None = None
    gcp_vision_credentials_json: str | None = None
    sentry_dsn: str | None = None


def get_settings() -> Settings:
    return Settings()
