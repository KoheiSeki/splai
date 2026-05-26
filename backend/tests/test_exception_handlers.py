from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.exceptions.domain import GroupNotFound, RateLimitExceeded
from app.exceptions.handlers import register_exception_handlers


def _build_app() -> FastAPI:
    app = FastAPI()
    register_exception_handlers(app)

    @app.get("/notfound")
    def _nf():
        raise GroupNotFound("group abc not found")

    @app.get("/rate")
    def _rate():
        raise RateLimitExceeded("too many requests")

    @app.get("/boom")
    def _boom():
        raise RuntimeError("unexpected")

    return app


def test_group_not_found_returns_404_problem_details():
    res = TestClient(_build_app(), raise_server_exceptions=False).get("/notfound")
    assert res.status_code == 404
    body = res.json()
    assert body["type"].endswith("/group-not-found")
    assert body["title"] == "Group Not Found"
    assert body["status"] == 404
    assert body["detail"] == "group abc not found"


def test_rate_limit_returns_429():
    res = TestClient(_build_app(), raise_server_exceptions=False).get("/rate")
    assert res.status_code == 429


def test_unexpected_error_returns_500():
    res = TestClient(_build_app(), raise_server_exceptions=False).get("/boom")
    assert res.status_code == 500
    body = res.json()
    assert body["status"] == 500
    assert body["title"] == "Internal Server Error"
