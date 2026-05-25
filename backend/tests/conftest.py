import os
import pytest


@pytest.fixture(autouse=True)
def _isolate_env(monkeypatch):
    """Each test gets a clean env by default."""
    for key in [
        "DATABASE_URL",
        "SUPABASE_URL",
        "SUPABASE_SERVICE_ROLE_KEY",
        "ICA_API_KEY",
        "ICA_BASE_URL",
        "GCP_VISION_CREDENTIALS_JSON",
        "SENTRY_DSN",
        "ENV",
        "LOG_LEVEL",
    ]:
        monkeypatch.delenv(key, raising=False)
