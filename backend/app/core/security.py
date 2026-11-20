import logging
from typing import Optional
from datetime import datetime, timezone, timedelta
import jwt
from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.database.session import get_db
from app.repositories.profile_repository import ProfileRepository

logger = logging.getLogger("accessway.security")


def create_access_token(user_id: str, expires_delta_minutes: Optional[int] = None) -> str:
    """
    Generates a cryptographically signed JWT for the given user_id.
    Used for authenticated sessions and automated security tests.
    """
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=expires_delta_minutes if expires_delta_minutes is not None else settings.JWT_EXPIRE_MINUTES
    )
    to_encode = {
        "sub": user_id,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    encoded_jwt = jwt.encode(
        to_encode,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )
    return encoded_jwt


async def get_optional_authenticated_user(
    authorization: Optional[str] = Header(None, description="Optional Bearer JWT token"),
    db: AsyncSession = Depends(get_db),
) -> Optional[str]:
    """
    Securely derives authenticated user identity from a verified authentication mechanism:
    - If no Authorization header is present: returns None (anonymous route calculation).
    - If Authorization header is present:
        - Must follow the standard 'Bearer <token>' format.
        - Verifies signature, expiration, and claims using JWT_SECRET_KEY and JWT_ALGORITHM.
        - Validates that the subject user_id corresponds to a real profile in the database.
        - Returns validated user_id.
    - SECURITY INVARIANTS:
        - Never trusts arbitrary user_id from request body.
        - Never treats unverified headers (e.g. X-User-ID) as proof of identity.
        - Prevents user impersonation.
    """
    if not authorization or not authorization.strip():
        return None

    parts = authorization.strip().split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="INVALID_TOKEN_FORMAT: Authorization header must use Bearer scheme (e.g., 'Bearer <token>').",
        )

    token = parts[1]
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        user_id = payload.get("sub") or payload.get("user_id")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="INVALID_TOKEN_PAYLOAD: Token does not contain a valid user identity claim.",
            )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="TOKEN_EXPIRED: Authentication token has expired. Please sign in again.",
        )
    except jwt.PyJWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"INVALID_TOKEN: Cryptographic verification failed: {str(e)}",
        )

    # Validate that profile exists in database to prevent forged/dangling identities
    profile_repo = ProfileRepository(db)
    profile = await profile_repo.get_by_user_id(user_id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"PROFILE_NOT_FOUND: Authenticated subject '{user_id}' has no registered profile.",
        )

    return profile.user_id


async def get_required_admin_user(
    authorization: Optional[str] = Header(None, description="Bearer JWT token"),
    db: AsyncSession = Depends(get_db),
) -> str:
    """
    Validates that request comes from an authenticated user with 'admin' role.
    Raises 401 UNAUTHORIZED if token is missing, expired, or invalid.
    Raises 403 FORBIDDEN if user is authenticated but not an administrator.
    """
    user_id = await get_optional_authenticated_user(authorization, db)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="UNAUTHORIZED: Authentication credentials are required to perform admin actions.",
        )
    profile_repo = ProfileRepository(db)
    profile = await profile_repo.get_by_user_id(user_id)
    if not profile or profile.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="FORBIDDEN: Administrative privileges required to review or verify reports.",
        )
    return profile.user_id

