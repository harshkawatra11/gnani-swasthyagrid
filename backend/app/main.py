import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1 import chat, health, public_chat, routes
from app.core.config import get_settings
from app.core.exceptions import FacilityNotFoundError, SwasthyaGridError
from app.core.logging import setup_logging

logger = logging.getLogger("swasthyagrid")

def create_app() -> FastAPI:
    setup_logging()
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name,
        description="AI District Health Operations Center — predictive, prescriptive, explainable, human-governed.",
        version="0.1.0",
    )

    origins = settings.cors_origins + [
        "https://swasthyagrid.vercel.app",
        "https://swasthyagrid-git-main-harshkawatra11s-projects.vercel.app"
    ]

    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def add_security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        return response

    @app.exception_handler(FacilityNotFoundError)
    async def facility_not_found_handler(request: Request, exc: FacilityNotFoundError):
        logger.warning(f"Facility not found: {exc.facility_id}")
        return JSONResponse(status_code=404, content={"detail": str(exc)})

    @app.exception_handler(SwasthyaGridError)
    async def swasthyagrid_error_handler(request: Request, exc: SwasthyaGridError):
        logger.error(f"Domain error: {exc!s}")
        return JSONResponse(status_code=400, content={"detail": str(exc)})

    app.include_router(health.router)
    app.include_router(routes.router)
    app.include_router(chat.router)
    app.include_router(public_chat.router)

    return app

app = create_app()
