import os
from pathlib import Path

from dotenv import dotenv_values

# pytest の collection 中に test_*.py が `from app.main import app` を実行する。
# その時点で `app = create_app()` → `app.db.session` の engine 構築まで走る。
# つまり engine URL は import 時の DATABASE_URL で固まる。
# conftest.py の top-level は collection の最初に評価されるので、ここで env を
# セットすれば全テストで有効になる。
#
# APP_ENV=test にして config.py が読みにいく env ファイルを `.env.test`(基本的に
# 不存在)に切り替える。これで実環境用の `.env.local` の値が settings に混入しない。
os.environ.setdefault("APP_ENV", "test")

# DATABASE_URL の解決順序(setdefault なので最初に値が入った時点で確定):
#   1. CI / shell から渡された環境変数(GitHub Actions の services postgres 等)
#   2. `.env.local` の DATABASE_URL(ローカル開発、Supabase Pooler を流用)
#   3. dummy URL(どちらも無い場合のフォールバック、接続時に失敗する)
_env_file = Path(__file__).parent.parent / ".env.local"
_real_db_url = dotenv_values(_env_file).get("DATABASE_URL")
os.environ.setdefault(
    "DATABASE_URL",
    _real_db_url or "postgresql+asyncpg://test:test@localhost/test",
)

import pytest  # noqa: E402  ← 上記 setdefault を先に走らせるため意図的に下に置く
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine  # noqa: E402
from sqlalchemy.pool import NullPool  # noqa: E402

from app.config import get_settings  # noqa: E402
from app.db.session import get_session  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(autouse=True)
def _isolate_env(monkeypatch):
    """Each test gets a clean env, with test-friendly defaults.

    DATABASE_URL は module top-level で `.env.local` から設定済みなので、
    ここでは触らない(各テストで上書きしたい場合は明示的に monkeypatch する)。
    """
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


@pytest.fixture
async def client():
    """API integration test 用の非同期 HTTP client。

    `httpx.AsyncClient` + `ASGITransport` で FastAPI app に直接アクセスする。
    各テストごとに `NullPool` の fresh engine を作り、`get_session` を上書きすることで:

    - `TestClient` を使った場合の "Future attached to a different loop" 問題を回避
    - test 間の DB connection 共有を排除(NullPool により毎回新規接続)
    - `app.db.session.engine` の global pool に test 用 connection が残らない

    実 DB(`.env.local` の DATABASE_URL = Supabase Pooler)に接続する。
    `.env.local` が無い環境では `app.db.session` の engine 構築時にエラーになる。

    テストごとにユニークな group/member 名を使えば、dev DB に複数のテストデータが
    残ってもテスト同士は衝突しない。永続データは Phase 1 完了時に手動でクリーンアップ。
    """
    settings = get_settings()
    engine = create_async_engine(settings.database_url, poolclass=NullPool)
    SessionLocal = async_sessionmaker(engine, expire_on_commit=False)

    async def _override_get_session():
        async with SessionLocal() as session:
            yield session

    app.dependency_overrides[get_session] = _override_get_session
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            yield ac
    finally:
        app.dependency_overrides.clear()
        await engine.dispose()
