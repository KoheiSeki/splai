import sentry_sdk
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import ai, groups, health, members, payments, settlement
from app.config import get_settings
from app.exceptions.handlers import register_exception_handlers
from app.logging_config import configure_logging
from app.middleware.logging import LoggingMiddleware
from app.middleware.request_id import RequestIdMiddleware


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings.log_level)

    app = FastAPI(title="SPLAI Backend", version="0.1.0")

    if settings.sentry_dsn and settings.env != "test":
        sentry_sdk.init(
            dsn=settings.sentry_dsn,
            environment=settings.env,
            traces_sample_rate=0.1,
            send_default_pii=False,
        )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-Id"],
    )
    app.add_middleware(LoggingMiddleware)
    app.add_middleware(RequestIdMiddleware)

    register_exception_handlers(app)

    app.include_router(health.router)
    app.include_router(groups.router)
    app.include_router(members.router)
    app.include_router(payments.router)
    app.include_router(settlement.router)
    app.include_router(ai.router)

    return app


app = create_app()
