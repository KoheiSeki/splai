import os

# pytest の collection 中に test_health.py 等が `from app.main import app` を実行する。
# その時点で `app = create_app()` → `Settings()` 評価が走るため、fixture が呼ばれる
# 前に必要な env を os.environ に入れておく必要がある。conftest.py の top-level
# は collection の最初に評価されるので、ここに書けば全ての test 収集前に有効になる。
#
# APP_ENV=test にして config.py が読みにいく env ファイルを `.env.test`(基本的に
# 不存在)に切り替える。これで実環境用の `.env.dev` の値がテストに混入しない。
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")

import pytest  # noqa: E402  ← 上記 setdefault を先に走らせるため意図的に下に置く


@pytest.fixture(autouse=True)
def _isolate_env(monkeypatch):
    """Each test gets a clean env, with test-friendly defaults."""
    for key in [
        "SUPABASE_URL",
        "SUPABASE_SERVICE_ROLE_KEY",
        "IBM_CA_API_KEY",
        "IBM_CA_BASE_URL",
        "GCP_VISION_CREDENTIALS_JSON",
        "SENTRY_DSN",
        "ENV",
        "LOG_LEVEL",
        "CORS_ORIGINS",
    ]:
        monkeypatch.delenv(key, raising=False)
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")
