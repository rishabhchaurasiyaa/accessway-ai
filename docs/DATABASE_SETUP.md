# ACCESSWAY AI — Database Setup & Administration Guide

**Project:** ACCESSWAY AI — Accessible Campus Navigator  
**Target Campus:** Lovely Professional University (LPU)  
**Database:** Supabase PostgreSQL 15+  
**Source of Truth:** `ACCESSWAY_AI_M9_Project_Documentation.docx` & `ACCESSWAY_AI_database_schema.sql`  
**Document:** Supabase PostgreSQL Provisioning, Migration Order, Canonical Entities, RLS Architecture, and Administration  
**Version:** 3.0.0 (Production Conversion & Real Supabase Provisioning)  

---

## 1. Supabase Project Initialization

To prepare a production database for ACCESSWAY AI:

1. Log into your account on [Supabase](https://supabase.com).
2. Click **New project**.
3. Choose your organization and name the project (e.g., `accessway-ai-lpu`).
4. Set a strong, cryptographically generated **Database Password**.
   > [!IMPORTANT]
   > Save this database password in your secure password manager immediately. Supabase does not store or show it again.
5. Select the closest geographical region to your campus (e.g., `South Asia (Mumbai) - ap-south-1` for Lovely Professional University, Punjab).
6. Select the latest PostgreSQL version (PostgreSQL 15+).
7. Wait 1–2 minutes for Supabase to provision the infrastructure.

### 1.1 Where to Retrieve Project Credentials
Once the project is active:

1. **Supabase Project URL & Keys:**
   - Go to **Project Settings** (gear icon) $\rightarrow$ **API**.
   - **Project URL:** Look for `Project URL` (e.g. `https://[project-ref].supabase.co`).
   - **Publishable / Anon Key:** Look for `anon public` key (used by frontend client).
   - **Service Role Secret:** Look for `service_role secret` (used ONLY by backend and admin utilities; never share or expose).
2. **Database Connection Strings:**
   - Go to **Project Settings** $\rightarrow$ **Database** $\rightarrow$ **Connection string**.
   - Select **URI**.
   - **Mode:**
     - **Session Pooler (Recommended for backend server):** Port `5432`, IPv4 compatible.
       `postgresql://postgres.[project-ref]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:5432/postgres`
     - **Direct Connection:** Port `5432` (requires IPv6 support).
       `postgresql://postgres:[YOUR-PASSWORD]@db.[project-ref].supabase.co:5432/postgres`
   - *Note:* ACCESSWAY AI's FastAPI server automatically normalizes `postgresql://` to `postgresql+asyncpg://` at runtime.

---

## 2. Environment Configuration

### 2.1 Backend (`backend/.env`)
Copy `backend/.env.example` to `backend/.env` on your server:

```bash
APP_ENV=production
APP_ENVIRONMENT=production
APP_NAME="ACCESSWAY AI — Accessible Campus Navigator API"
DEBUG=False
HOST=0.0.0.0
PORT=8000

# CORS Configuration (Allowed frontend domains, comma-separated)
CORS_ALLOWED_ORIGINS=https://your-frontend-domain.com,http://localhost:5173

# Database Connection (Session pooler or Direct URI)
DATABASE_URL=postgresql+asyncpg://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres

# Supabase Auth Credentials (CONFIDENTIAL: Strictly Backend Only)
SUPABASE_URL=https://[PROJECT-REF].supabase.co
SUPABASE_SERVICE_ROLE_KEY=[YOUR-SERVICE-ROLE-SECRET-KEY]

# Cryptographic Token Signing (Generate via: openssl rand -hex 32)
JWT_SECRET_KEY=[YOUR-GENERATED-64-CHARACTER-HEX-SECRET]
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=120

# Safety Mode
IS_SYNTHETIC_DATA_MODE=False
```

### 2.2 Frontend (`frontend/.env`)
```bash
VITE_API_URL=https://your-api-domain.com/api/v1
VITE_SUPABASE_URL=https://[PROJECT-REF].supabase.co
VITE_SUPABASE_ANON_KEY=[YOUR-PUBLIC-ANON-KEY]
```

> [!CAUTION]
> Never place `SUPABASE_SERVICE_ROLE_KEY` or `DATABASE_URL` in `frontend/.env`. The frontend must communicate solely through the backend API or public anonymous Supabase client.

---

## 3. The 8 Canonical Database Entities

The authoritative schema strictly contains exactly eight entities:

1. **`buildings`**: Campus facilities with code, official name, description, centroid coordinates, and floor configurations.
2. **`profiles`**: User identities with role-based permissions (`user`, `admin`).
3. **`nodes`**: Graph vertices representing entrances, junctions, ramps, elevators (lifts), landmarks, and destinations.
4. **`edges`**: Directed navigable pathways with distance, stairs count, slope, wheelchair accessibility, and landmark instructions.
5. **`accessibility_reports`**: Student-reported physical obstacles with lifecycle statuses (`pending_review`, `verified`, `rejected`).
6. **`route_sessions`**: Persisted navigation requests recording origin, destination, profile, graph version, and payload.
7. **`campus_graph_state`**: Singleton row (`id = 1`) maintaining the monotonic `graph_version` for client cache invalidation.
8. **`report_audit_log`**: Append-only audit trail logging administrative review actions and graph version increments.

*Obsolete tables (`floors`, `incidents`, `incident_audit_logs`) are strictly retired and must not be created.*

---

## 4. Canonical Migrations & Schema Deployment

### 4.1 Deployment on a Fresh Supabase Database
1. In the Supabase Dashboard, open the **SQL Editor**.
2. Click **New query**.
3. Copy the entire contents of [`database/schema.sql`](file:///d:/ACCESSWAY%20AI/database/schema.sql) into the editor.
4. Click **Run**.
   - This creates all 8 canonical tables, constraints, performance indexes, and RLS policies.
   - It initializes the `campus_graph_state` singleton (`id=1, graph_version=1`).
   - It leaves `buildings`, `nodes`, `edges`, and `accessibility_reports` clean and completely empty (0 records).

### 4.2 Upgrading an Existing Project (Sequential Migrations)
For existing deployments, run the migration scripts sequentially in the SQL Editor:
1. [`database/migrations/001_initial_schema.sql`](file:///d:/ACCESSWAY%20AI/database/migrations/001_initial_schema.sql)
2. [`database/migrations/002_indexes_and_rls.sql`](file:///d:/ACCESSWAY%20AI/database/migrations/002_indexes_and_rls.sql)
3. [`database/migrations/003_canonical_schema_alignment.sql`](file:///d:/ACCESSWAY%20AI/database/migrations/003_canonical_schema_alignment.sql)

### 4.3 Verifying Clean Empty-State
After applying migrations, execute the automated verification utility:
```bash
python backend/scripts/verify_database_empty_state.py
```
This utility audits:
- Live database connectivity.
- Presence of all 8 canonical tables.
- Total absence of obsolete tables (`floors`, `incidents`, `incident_audit_logs`).
- Presence of the `campus_graph_state` singleton (`id=1, graph_version=1`).
- Confirmation that `buildings`, `nodes`, `edges`, and `accessibility_reports` have 0 records.

---

## 5. Row Level Security (RLS) & Authorization Architecture

### 5.1 FastAPI Database Connection Role vs RLS
- **FastAPI Backend Role:**
  - FastAPI connects via `DATABASE_URL` using the connection pooler credentials (typically the `postgres` user in Supabase).
  - In PostgreSQL, superusers and table owners possess the `BYPASSRLS` privilege by default.
  - **FastAPI acts as the authoritative security perimeter:** Every privileged action (moderating reports, accessing the review queue, editing infrastructure) is guarded by FastAPI dependencies (`get_required_admin_user`) verifying cryptographic JWT signatures, token expiration, and database `role == 'admin'`.
- **Direct Client / PostgREST RLS (Defense-in-Depth):**
  - If clients or third-party tools query Supabase directly via the public API with the `anon` or user `authenticated` key:
    - `buildings`, `nodes`, `edges`: Read-only access for active infrastructure (`is_active = TRUE`).
    - `profiles`: Users can view only their own profile (`auth.uid() = user_id`).
    - `accessibility_reports`: Public can view verified reports (`status = 'verified'`) and submit pending reports (`FOR INSERT WITH CHECK (status = 'pending_review')`). Users cannot mark their own reports as verified.
    - `report_audit_log`: Read-only access restricted strictly to administrators and the backend `service_role`.

---

## 6. Real Administrator Provisioning Workflow

To provision an authorized campus facilities manager:

1. Have the administrator register in your Supabase Auth project (via email or SSO).
2. Obtain their unique **User UUID** from **Supabase Dashboard $\rightarrow$ Authentication $\rightarrow$ Users**.
3. Run the secure local provisioning script:
   ```bash
   python backend/scripts/provision_admin.py --user-id "<AUTHENTICATED-USER-UUID>" --display-name "Facilities Administrator"
   ```
4. The script:
   - Validates the canonical UUID format.
   - Authoritatively queries Supabase Auth to confirm that the user account actually exists.
   - Prompts for explicit operator confirmation before making any changes.
   - Idempotently assigns `role = 'admin'` in `profiles`.
   - Never logs credentials or secrets.
