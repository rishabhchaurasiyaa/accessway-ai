#!/usr/bin/env python3
"""
ACCESSWAY AI — Production Administrator Provisioning Utility

This hardened utility provisions legitimate administrator accounts for verified campus
personnel. It strictly requires authoritative verification of account ownership in
Supabase Auth before granting administrator privileges in the database.

Security Invariants:
1. Validates canonical UUID format.
2. Authoritatively verifies that the user exists in Supabase Auth (via Auth Admin REST API
   or PostgreSQL auth.users). Fails closed if user is nonexistent or credentials unavailable.
3. Locks role assignment strictly to 'admin' (no arbitrary role arguments).
4. Requires explicit operator confirmation (--confirm flag or interactive 'CONFIRM' prompt).
5. Never prints or leaks service-role keys, tokens, or JWT secrets.
6. Handles idempotent duplicate provisioning safely without privileges re-escalation.

Usage:
    # Interactive mode (prompts for confirmation):
    python backend/scripts/provision_admin.py --user-id 12345678-1234-5678-1234-567812345678

    # Non-interactive / automation mode:
    python backend/scripts/provision_admin.py --user-id 12345678-1234-5678-1234-567812345678 --confirm --display-name "Campus Admin"
"""

import argparse
import asyncio
import os
import sys
import uuid
import logging
from typing import Optional, Tuple, Callable, Awaitable

# Ensure project root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import httpx
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, text

from app.core.config import settings
from app.models.profile import Profile

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger("accessway.provision_admin")


def validate_canonical_uuid(user_id_str: str) -> Optional[str]:
    """
    Validates UUID string format and returns canonical lowercase string.
    Returns None if format is invalid.
    """
    try:
        val = uuid.UUID(user_id_str.strip())
        return str(val)
    except (ValueError, AttributeError):
        return None


async def verify_supabase_auth_user(
    user_id: str,
    db_session: Optional[AsyncSession] = None,
) -> Tuple[bool, Optional[str], Optional[str]]:
    """
    Verifies that the supplied user_id corresponds to a legitimate authenticated user
    in Supabase Auth. Fails closed if verification cannot be completed authoritatively.

    Returns:
        (is_verified: bool, user_email: Optional[str], error_message: Optional[str])
    """
    # 1. Attempt verification via Supabase GoTrue Auth Admin REST API
    supabase_url = settings.SUPABASE_URL.strip().rstrip("/") if settings.SUPABASE_URL else ""
    service_key = settings.SUPABASE_SERVICE_ROLE_KEY.strip() if settings.SUPABASE_SERVICE_ROLE_KEY else ""

    is_real_supabase_config = (
        supabase_url
        and not supabase_url.startswith("https://placeholder")
        and service_key
        and not service_key.startswith("placeholder")
    )

    if is_real_supabase_config:
        endpoint = f"{supabase_url}/auth/v1/admin/users/{user_id}"
        headers = {
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
        }
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(endpoint, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    email = data.get("email") or data.get("phone") or "Verified Supabase User"
                    return True, email, None
                elif resp.status_code == 404:
                    return False, None, f"USER_NOT_FOUND: User ID '{user_id}' does not exist in Supabase Auth."
                elif resp.status_code in (401, 403):
                    return False, None, "UNAUTHORIZED_SUPABASE_SERVICE_ROLE: Supabase rejected credentials."
                else:
                    return False, None, f"SUPABASE_API_ERROR: HTTP status {resp.status_code}."
        except Exception as exc:
            return False, None, f"SUPABASE_CONNECTION_ERROR: Failed to contact Supabase Auth API: {exc}"

    # 2. Attempt verification via PostgreSQL internal auth.users table (direct DB connection)
    if db_session:
        try:
            res = await db_session.execute(
                text("SELECT email FROM auth.users WHERE id = :uid"),
                {"uid": user_id},
            )
            row = res.first()
            if row:
                return True, row[0] or "Verified Auth User", None
            else:
                return False, None, f"USER_NOT_FOUND: User ID '{user_id}' not found in auth.users."
        except Exception:
            # auth.users table does not exist or database is SQLite / mock
            pass

    # 3. Fail closed if neither authoritative mechanism is available
    return (
        False,
        None,
        "CANNOT_VERIFY_SUPABASE_USER: Real Supabase Auth credentials (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) "
        "or PostgreSQL auth.users table are required to authoritatively verify user existence. "
        "Refusing to promote unverified account.",
    )


async def provision_admin(
    user_id_str: str,
    display_name: Optional[str] = None,
    confirmed: bool = False,
    auth_verifier: Optional[Callable[[str, Optional[AsyncSession]], Awaitable[Tuple[bool, Optional[str], Optional[str]]]]] = None,
    engine_override = None,
) -> Tuple[bool, str]:
    """
    Promotes a verified Supabase Auth user to the administrator role.
    Strictly fail-closed: fails if UUID invalid, user nonexistent, or unconfirmed.
    """
    # 1. Format validation
    canonical_user_id = validate_canonical_uuid(user_id_str)
    if not canonical_user_id:
        msg = f"ERROR: '{user_id_str}' is not a valid UUID format."
        logger.error(msg)
        return False, msg

    # 2. Database connection setup
    if engine_override:
        engine = engine_override
        async_session = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    else:
        db_url = settings.DATABASE_URL
        if not db_url:
            msg = "ERROR: DATABASE_URL configuration is missing."
            logger.error(msg)
            return False, msg

        if db_url.startswith("postgresql://"):
            db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
        elif db_url.startswith("sqlite://") and not db_url.startswith("sqlite+aiosqlite://"):
            db_url = db_url.replace("sqlite://", "sqlite+aiosqlite://", 1)

        engine = create_async_engine(db_url, echo=False)
        async_session = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

    verifier = auth_verifier or verify_supabase_auth_user

    async with async_session() as session:
        # 3. Authoritative Supabase Auth verification
        is_verified, user_email, verify_err = await verifier(canonical_user_id, session)
        if not is_verified:
            msg = f"SECURITY REFUSAL: Cannot verify user ownership in Supabase Auth. Detail: {verify_err}"
            logger.error(msg)
            if not engine_override:
                await engine.dispose()
            return False, msg

        # 4. Explicit operator confirmation check
        if not confirmed:
            msg = "ABORTED: Explicit confirmation required to assign administrator role. Pass --confirm to proceed."
            logger.warning(msg)
            if not engine_override:
                await engine.dispose()
            return False, msg

        # 5. Safe profile upsert with strictly locked role='admin'
        result = await session.execute(
            select(Profile).where(Profile.user_id == canonical_user_id)
        )
        existing_profile = result.scalars().first()

        if existing_profile:
            if existing_profile.role == "admin":
                if display_name and existing_profile.display_name != display_name:
                    existing_profile.display_name = display_name
                    await session.commit()
                    msg = f"IDEMPOTENT: Profile '{canonical_user_id}' is already an administrator. Updated display name to '{display_name}'."
                else:
                    msg = f"IDEMPOTENT: Profile '{canonical_user_id}' is already provisioned with administrator role. No escalation performed."
                logger.info(msg)
                if not engine_override:
                    await engine.dispose()
                return True, msg

            existing_profile.role = "admin"
            if display_name:
                existing_profile.display_name = display_name
            await session.commit()
            msg = f"SUCCESS: Promoted existing user '{canonical_user_id}' ({user_email}) to role 'admin'."
            logger.info(msg)
        else:
            new_profile = Profile(
                user_id=canonical_user_id,
                display_name=display_name or user_email or "Verified Administrator",
                role="admin",  # Strictly locked to admin
            )
            session.add(new_profile)
            await session.commit()
            msg = f"SUCCESS: Provisioned new administrator profile '{canonical_user_id}' ({user_email})."
            logger.info(msg)

    if not engine_override:
        await engine.dispose()
    return True, msg


def main():
    parser = argparse.ArgumentParser(
        description="Securely provision an administrator account for ACCESSWAY AI."
    )
    parser.add_argument(
        "--user-id",
        required=True,
        help="The authenticated Supabase Auth User UUID to promote.",
    )
    parser.add_argument(
        "--display-name",
        default=None,
        help="Optional human-readable display name for the administrator.",
    )
    parser.add_argument(
        "--confirm",
        action="store_true",
        default=False,
        help="Explicitly confirm assignment of administrator privileges.",
    )

    args = parser.parse_args()

    confirmed = args.confirm
    if not confirmed:
        if sys.stdin.isatty():
            print(f"ATTENTION: You are requesting to grant full ADMINISTRATOR role to User UUID: {args.user_id}")
            answer = input("Type 'CONFIRM' to proceed: ")
            confirmed = (answer.strip() == "CONFIRM")
        else:
            print("ERROR: Non-interactive execution requires explicit --confirm flag.", file=sys.stderr)
            sys.exit(1)

    success, message = asyncio.run(provision_admin(args.user_id, args.display_name, confirmed=confirmed))
    if not success:
        print(f"PROVISIONING FAILED: {message}", file=sys.stderr)
        sys.exit(1)
    else:
        print(f"PROVISIONING SUCCESS: {message}")


if __name__ == "__main__":
    main()
