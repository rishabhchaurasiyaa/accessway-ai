import asyncio
import logging
from typing import AsyncGenerator, Tuple, Optional
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy import text
from app.core.config import settings

logger = logging.getLogger("accessway.database")

Base = declarative_base()

# Configure SQLAlchemy engine with connection pool
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    future=True,
    pool_pre_ping=True,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency injection helper for database sessions."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception as e:
            await session.rollback()
            logger.error(f"Database session rollback caused by: {e}")
            raise
        finally:
            await session.close()


async def check_database_status(timeout_seconds: float = 2.0) -> Tuple[str, Optional[str]]:
    """
    Accurately tests the live database connection.
    Returns:
        - ('not_configured', reason): If DATABASE_URL is unset or has default dummy placeholder.
        - ('connected', None): If an actual SQL query (SELECT 1) succeeds within the timeout.
        - ('disconnected', error_details): If connection was attempted but failed or timed out.
    """
    db_url = settings.DATABASE_URL.strip() if settings.DATABASE_URL else ""

    if not db_url or "placeholder" in db_url or "your_password_here" in db_url:
        return "not_configured", "DATABASE_URL contains placeholder credentials"

    try:
        async with asyncio.timeout(timeout_seconds):
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
        return "connected", None
    except TimeoutError:
        logger.warning(f"Database connection timed out after {timeout_seconds}s")
        return "disconnected", f"Connection timed out after {timeout_seconds}s"
    except Exception as exc:
        err_msg = str(exc)
        logger.warning(f"Database connection attempt failed: {err_msg}")
        return "disconnected", err_msg
