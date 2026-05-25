import re
from uuid import uuid4

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp


_UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")


class RequestIdMiddleware(BaseHTTPMiddleware):
    """X-Request-Id ヘッダを正規化し、request.state.request_id にセットする。

    - ヘッダが UUIDv4 形式でない場合は新規生成して上書き。
    - レスポンスにも同じ X-Request-Id を返す。
    """

    def __init__(self, app: ASGIApp, header_name: str = "X-Request-Id") -> None:
        super().__init__(app)
        self.header_name = header_name

    async def dispatch(self, request: Request, call_next):
        incoming = request.headers.get(self.header_name, "")
        request_id = incoming if _UUID_RE.fullmatch(incoming.lower()) else str(uuid4())
        request.state.request_id = request_id

        response = await call_next(request)
        response.headers[self.header_name] = request_id
        return response
