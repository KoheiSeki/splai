from fastapi.testclient import TestClient

from app.main import app


def test_health_returns_ok():
    client = TestClient(app)
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_health_includes_request_id_header():
    client = TestClient(app)
    res = client.get("/health")
    assert "X-Request-Id" in res.headers
