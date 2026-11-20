import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1.router import api_v1_router
from app.middleware.error_handler import register_exception_handlers

# Configure logging
logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("accessway.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing ACCESSWAY AI Backend Service...")
    logger.info(f"Environment: {settings.APP_ENV} | Synthetic Demo Mode: {settings.IS_SYNTHETIC_DATA_MODE}")
    if settings.IS_SYNTHETIC_DATA_MODE:
        logger.warning("NOTICE: SIMULATED DEMO DATA — NOT FOR REAL-WORLD NAVIGATION")
    yield
    logger.info("Shutting down ACCESSWAY AI Backend Service...")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Accessible Campus Navigator Backend API — Code Fuzion 2026 Problem Statement M9",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Synthetic Demo Data Header Middleware
@app.middleware("http")
async def add_accessibility_headers(request: Request, call_next):
    response = await call_next(request)
    if settings.IS_SYNTHETIC_DATA_MODE:
        response.headers["X-AccessWay-Data-Mode"] = "SIMULATED_DEMO_DATA"
    return response


# Register Centralized Error Handlers
register_exception_handlers(app)

# Mount API Routers
app.include_router(api_v1_router, prefix=settings.API_V1_PREFIX)


@app.get("/", tags=["Root"])
async def root_redirect():
    return {
        "project": "ACCESSWAY AI — Accessible Campus Navigator",
        "tagline": "Every Path Should Be Accessible.",
        "hackathon": "Code Fuzion 2026 — Problem Statement M9",
        "status": "online",
        "health_check": f"{settings.API_V1_PREFIX}/health",
        "documentation": "/docs",
        "disclaimer": "SIMULATED DEMO DATA — NOT FOR REAL-WORLD NAVIGATION",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)
