#!/usr/bin/env python3
"""
ACCESSWAY AI — Production Database Empty-State & Schema Verification Utility

Verifies that a connected PostgreSQL (or test) database:
1. Successfully establishes connection.
2. Contains all eight canonical schema entities.
3. Contains no obsolete tables (e.g. floors, incidents, incident_audit_logs).
4. Contains the initialized singleton row in campus_graph_state (id=1, graph_version >= 1).
5. Contains ZERO synthetic buildings, nodes, edges, or reports (clean empty state for LPU).

Usage:
    python backend/scripts/verify_database_empty_state.py
"""

import asyncio
import os
import sys
import logging
from typing import Dict, Any, Tuple

# Ensure project root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.core.config import settings

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger("accessway.verify_db")

CANONICAL_TABLES = [
    "buildings",
    "profiles",
    "nodes",
    "edges",
    "accessibility_reports",
    "route_sessions",
    "campus_graph_state",
    "report_audit_log",
]

OBSOLETE_TABLES = [
    "floors",
    "incidents",
    "incident_audit_logs",
]


async def verify_database_state(engine_override=None) -> Tuple[bool, Dict[str, Any]]:
    """
    Connects to the database and audits schema presence and entity counts.
    Returns (success: bool, audit_results: dict).
    """
    results: Dict[str, Any] = {
        "connected": False,
        "database_url_sanitized": None,
        "canonical_tables_present": {},
        "obsolete_tables_present": [],
        "row_counts": {},
        "errors": [],
    }

    if engine_override:
        engine = engine_override
    else:
        db_url = settings.DATABASE_URL
        if not db_url:
            results["errors"].append("DATABASE_URL is not configured.")
            return False, results

        # Normalize async dialect
        if db_url.startswith("postgresql://"):
            db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
        elif db_url.startswith("sqlite://") and not db_url.startswith("sqlite+aiosqlite://"):
            db_url = db_url.replace("sqlite://", "sqlite+aiosqlite://", 1)

        # Sanitize for display
        if "@" in db_url:
            prefix, rest = db_url.split("@", 1)
            results["database_url_sanitized"] = f"{prefix.split(':')[0]}://***:***@{rest}"
        else:
            results["database_url_sanitized"] = db_url

        try:
            engine = create_async_engine(db_url, echo=False)
        except Exception as exc:
            results["errors"].append(f"Failed to create database engine: {exc}")
            return False, results

    # 1. Test live query
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
            results["connected"] = True

            # Detect dialect
            dialect_name = engine.dialect.name

            # Query existing tables
            if dialect_name == "postgresql":
                table_query = text(
                    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
                )
            else:
                table_query = text(
                    "SELECT name FROM sqlite_master WHERE type='table'"
                )

            res = await conn.execute(table_query)
            existing_tables = {row[0] for row in res.fetchall()}

            # 2. Check canonical tables
            for table in CANONICAL_TABLES:
                is_present = table in existing_tables
                results["canonical_tables_present"][table] = is_present
                if not is_present:
                    results["errors"].append(f"Missing canonical table: '{table}'")

            # 3. Check obsolete tables
            for table in OBSOLETE_TABLES:
                if table in existing_tables:
                    results["obsolete_tables_present"].append(table)
                    results["errors"].append(f"Obsolete table detected: '{table}' (must not exist)")

            # 4. Check row counts for canonical tables
            for table in CANONICAL_TABLES:
                if table in existing_tables:
                    count_res = await conn.execute(text(f"SELECT COUNT(*) FROM {table}"))
                    count = count_res.scalar()
                    results["row_counts"][table] = count

            # 5. Verify campus_graph_state singleton
            if "campus_graph_state" in existing_tables:
                state_count = results["row_counts"].get("campus_graph_state", 0)
                if state_count != 1:
                    results["errors"].append(
                        f"campus_graph_state must have exactly 1 singleton row, found {state_count} rows."
                    )
                else:
                    v_res = await conn.execute(text("SELECT graph_version FROM campus_graph_state WHERE id = 1"))
                    version = v_res.scalar()
                    results["graph_version"] = version
                    if version is None or version < 1:
                        results["errors"].append(f"Invalid graph_version in campus_graph_state: {version}")

            # 6. Verify empty campus infrastructure invariant (LPU unpopulated state)
            for table in ["buildings", "nodes", "edges", "accessibility_reports"]:
                if table in existing_tables:
                    count = results["row_counts"].get(table, 0)
                    if count != 0:
                        results["errors"].append(
                            f"Table '{table}' contains {count} records. Expected 0 records before authentic campus data ingestion."
                        )

    except Exception as exc:
        results["errors"].append(f"Database query error: {exc}")
        if not engine_override:
            await engine.dispose()
        return False, results

    if not engine_override:
        await engine.dispose()

    success = len(results["errors"]) == 0
    return success, results


def main():
    logger.info("Executing ACCESSWAY AI Production Database Empty-State Audit...")
    success, results = asyncio.run(verify_database_state())

    print("\n" + "=" * 60)
    print("DATABASE EMPTY-STATE & SCHEMA AUDIT REPORT")
    print("=" * 60)
    print(f"Connection Status:       {'CONNECTED' if results['connected'] else 'FAILED'}")
    print(f"Target Database:         {results['database_url_sanitized']}")

    print("\nCanonical Entities Present (8 required):")
    for table, present in results["canonical_tables_present"].items():
        status = "OK" if present else "MISSING"
        count = results["row_counts"].get(table, "N/A")
        print(f"  - {table:<24}: {status:<8} (Rows: {count})")

    if results["obsolete_tables_present"]:
        print("\nWARNING: Obsolete Tables Found:")
        for table in results["obsolete_tables_present"]:
            print(f"  - {table} (VIOLATION)")
    else:
        print("\nObsolete Tables Check:   PASS (Zero obsolete tables found)")

    if "graph_version" in results:
        print(f"Campus Graph Version:    v{results['graph_version']} (Singleton Active)")

    if results["errors"]:
        print("\nAUDIT FAILURES / INVARIANTS VIOLATED:")
        for err in results["errors"]:
            print(f"  [X] {err}")
        print("\nAUDIT RESULT: REJECTED")
        sys.exit(1)
    else:
        print("\nAUDIT RESULT: VERIFIED CLEAN (All 8 entities canonical, empty campus graph ready for LPU ingestion)")
        sys.exit(0)


if __name__ == "__main__":
    main()
