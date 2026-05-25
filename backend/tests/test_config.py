from app.config import Settings


def test_settings_loads_from_env(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://x@y/z")
    monkeypatch.setenv("ENV", "test")
    s = Settings()
    assert s.database_url == "postgresql+asyncpg://x@y/z"
    assert s.env == "test"


def test_settings_defaults(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://x@y/z")
    s = Settings()
    assert s.log_level == "INFO"
    assert s.env == "development"
