import re
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient
from app.middleware.request_id import RequestIdMiddleware


def _build_app() -> FastAPI:
    app = FastAPI()
    app.add_middleware(RequestIdMiddleware)

    @app.get("/")
    def _root(request: Request):
        return {"request_id": request.state.request_id}

    return app


def test_generates_uuid_when_header_missing():
    client = TestClient(_build_app())
    res = client.get("/")
    body = res.json()
    assert re.fullmatch(r"[0-9a-f-]{36}", body["request_id"])
    assert res.headers["X-Request-Id"] == body["request_id"]


def test_uses_provided_header_when_valid():
    client = TestClient(_build_app())
    valid_uuid = "7f3a9c2e-8b1d-4f6e-bd92-1a2b3c4d5e6f"
    res = client.get("/", headers={"X-Request-Id": valid_uuid})
    assert res.json()["request_id"] == valid_uuid
    assert res.headers["X-Request-Id"] == valid_uuid


def test_rejects_invalid_header_and_regenerates():
    client = TestClient(_build_app())
    res = client.get("/", headers={"X-Request-Id": "not-a-uuid"})
    body = res.json()
    assert body["request_id"] != "not-a-uuid"
    assert re.fullmatch(r"[0-9a-f-]{36}", body["request_id"])
