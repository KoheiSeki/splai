import json

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.logging_config import configure_logging
from app.middleware.logging import LoggingMiddleware
from app.middleware.request_id import RequestIdMiddleware


def _build_app() -> FastAPI:
    configure_logging("INFO")
    app = FastAPI()
    app.add_middleware(LoggingMiddleware)
    app.add_middleware(RequestIdMiddleware)

    @app.get("/ping")
    def _ping():
        return {"pong": True}

    return app


def test_logs_request_and_response(capsys):
    client = TestClient(_build_app())
    res = client.get("/ping")
    assert res.status_code == 200

    lines = [l for l in capsys.readouterr().out.splitlines() if l.strip().startswith("{")]
    parsed = [json.loads(l) for l in lines]
    events = [p["event"] for p in parsed]
    assert "request.start" in events
    assert "request.end" in events

    end = next(p for p in parsed if p["event"] == "request.end")
    assert end["status_code"] == 200
    assert end["method"] == "GET"
    assert end["path"] == "/ping"
    assert "request_id" in end
    assert "duration_ms" in end
