import structlog
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from .domain import SplaiError

_log = structlog.get_logger("exceptions")
PROBLEM_BASE = "https://splai.app/problems"


def _problem(
    status: int, type_slug: str, title: str, detail: str, instance: str | None = None
) -> dict:
    return {
        "type": f"{PROBLEM_BASE}/{type_slug}",
        "title": title,
        "status": status,
        "detail": detail,
        "instance": instance,
    }


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(SplaiError)
    async def handle_splai_error(request: Request, exc: SplaiError) -> JSONResponse:
        """SplaiError"""

        request_id = getattr(request.state, "request_id", None)
        _log.warning(
            "domain_error",
            request_id=request_id,
            error_type=exc.type_slug,
            detail=str(exc),
            path=request.url.path,
        )
        return JSONResponse(
            status_code=exc.status_code,
            content=_problem(exc.status_code, exc.type_slug, exc.title, str(exc), str(request.url)),
            media_type="application/problem+json",
        )

    @app.exception_handler(Exception)
    async def handle_unexpected(request: Request, exc: Exception) -> JSONResponse:
        """想定外のエラー"""

        request_id = getattr(request.state, "request_id", None)
        _log.exception("unexpected_error", request_id=request_id, path=request.url.path)
        return JSONResponse(
            status_code=500,
            content=_problem(
                500,
                "internal-error",
                "Internal Server Error",
                "An unexpected error occurred",
                str(request.url),
            ),
            media_type="application/problem+json",
        )
