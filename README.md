# ACCESSWAY AI — Accessible Campus Navigator

> **Every Path Should Be Accessible.**

**Hackathon:** Code Fuzion 2026 — Official Problem Statement M9 (Moderate)  
**Status:** Phase 6.5 Step 1 Complete (Production Conversion & Complete Demo Removal)  
**Target Campus:** Lovely Professional University (LPU)  
**Campus Readiness Notice:** ⚠️ **CAMPUS SURVEY PENDING AUTHORIZATION.** ACCESSWAY AI is targeted for Lovely Professional University (LPU). Official campus floor plans, building maps, and physical ground surveys are pending institutional authorization. Real-world navigation remains inactive until verified infrastructure data is provisioned. No synthetic campus information is presented as real.

---

## 1. Problem Statement & Objective

### 1.1 Problem Statement (M9)
Wheelchair users and visually impaired students cannot reliably identify which campus paths have ramps, lifts, or stairs. When a lift breaks down or unexpected obstacles arise, students with mobility impairments or visual impairments are left stranded without viable alternatives or sensory navigational guidance.

### 1.2 Objective & Target Campus
Build a production-grade indoor-outdoor campus navigation web application targeted for **Lovely Professional University (LPU)** featuring:
- **Fastest Route** vs. **Step-Free Route** (strictly wheelchair-safe; excludes stairs, steep slopes, active hazards, unverified paths, and unknown accessibility metrics).
- **Spoken Audio Guidance** via native Web Speech Synthesis API with strict user-controlled playback (no disruptive autoplay).
- **Landmark-Based Sensory Cues** for visually impaired students.
- **TalkBack & VoiceOver Compatibility** (WCAG 2.1 AA/AAA compliance, minimum 44×44px interactive tap targets).
- **Crowdsourced Hazard Reporting** with an authenticated Admin verification portal and real-time graph freshness tracking.
- **Dynamic Rerouting** that immediately recalculates paths around newly verified hazards.

---

## 2. Technology Stack

- **Frontend:** React 18, Vite 6, TypeScript 5, Tailwind CSS, Lucide React, Leaflet, React Leaflet, Axios
- **Indoor Floor Maps:** Scalable Vector Graphics (SVG) with multi-floor level switcher
- **Speech Engine:** Native Browser Web Speech Synthesis API
- **Backend:** Python 3.10+, FastAPI, Uvicorn, Pydantic v2, Pytest
- **Routing Algorithm:** Dijkstra Shortest Path with Multi-Criteria Accessibility Pruning
- **Database:** Supabase PostgreSQL 15+ with Row-Level Security (RLS)
- **Deployment:** Vercel (Frontend SPA) and Render (Containerized FastAPI API)

---

## 3. Repository Structure

```text
ACCESSWAY-AI/
├── frontend/                     # React + Vite + TypeScript Client
│   ├── public/                   # Static assets & icons
│   ├── src/
│   │   ├── assets/               # Local icons & media
│   │   ├── components/           # Accessible React components
│   │   │   ├── common/           # Shared buttons, loaders, cards
│   │   │   ├── navigation/       # Route selector & step cards
│   │   │   ├── accessibility/    # Disclaimer banners & controls
│   │   │   ├── map/              # Leaflet outdoor map components
│   │   │   └── reports/          # Crowdsourced hazard modal & tables
│   │   ├── layouts/              # Root layout & skip links
│   │   ├── pages/                # View routes (Home, Admin)
│   │   ├── hooks/                # Custom hooks (speech, map sync)
│   │   ├── contexts/             # Global state (route, a11y)
│   │   ├── services/             # Axios API client
│   │   ├── types/                # Strict TypeScript interfaces
│   │   ├── utils/                # Coordinate & format helpers
│   │   ├── styles/               # Tailwind CSS & global styles
│   │   ├── App.tsx               # Application root shell
│   │   └── main.tsx              # DOM entrypoint
│   ├── package.json              # NPM dependencies & scripts
│   ├── tsconfig.json             # TypeScript compiler settings
│   ├── vite.config.ts            # Vite bundler configuration
│   └── .env.example              # Public frontend environment template
│
├── backend/                      # Python FastAPI Application
│   ├── app/
│   │   ├── api/v1/               # Versioned API routes & endpoints
│   │   │   └── endpoints/        # Health, navigation, incidents, admin
│   │   ├── core/                 # Pydantic Settings, CORS, logging
│   │   ├── database/             # SQLAlchemy async engine & session
│   │   ├── models/               # ORM database models
│   │   ├── schemas/              # Pydantic request/response schemas
│   │   ├── repositories/         # Database query repositories
│   │   ├── services/             # Incident & audit services
│   │   ├── routing/              # Graph engine & Dijkstra solver
│   │   ├── middleware/           # Centralized exception handler
│   │   └── main.py               # Application factory & lifespan
│   ├── tests/                    # Pytest test suite
│   ├── requirements.txt          # Python dependencies
│   ├── .env.example              # Backend environment template
│   └── .gitignore
│
├── database/                      # PostgreSQL Migrations & Datasets
│   ├── migrations/               # Versioned SQL migration scripts
│   │   ├── 001_initial_schema.sql
│   │   └── 002_indexes_and_rls.sql
│   ├── import_templates/         # JSON schemas for surveyed real-world campus data
│   │   ├── campus_nodes_template.json
│   │   ├── campus_edges_template.json
│   │   └── README.md
│   ├── schema.sql                # Complete master DDL schema with RLS
│   └── seed_demo.sql             # Synthetic demonstration dataset (Buildings A, B, C)
│
├── docs/                         # System Blueprint & Specifications
│   ├── PRD.md                    # Product Requirements Document
│   ├── TRD.md                    # Technical Requirements Document
│   ├── APP_FLOW.md               # User & incident state machines
│   ├── UI_UX_BRIEF.md            # WCAG standards & wireframes
│   ├── DATABASE_DESIGN.md        # Relational schema & RLS rules
│   ├── DATABASE_SETUP.md         # Supabase setup, migrations & administration guide
│   ├── IMPLEMENTATION_PLAN.md    # 24-hr schedule & 4-member roles
│   └── ARCHITECTURE.md           # System topology & graph formulation
│
├── scripts/                      # Developer utility scripts
├── .gitignore                    # Git ignore configuration
└── README.md                     # Project documentation
```

---

## 4. Local Development Setup

### 4.1 Prerequisites
- **Node.js:** v18.0.0 or higher (v20+ recommended)
- **Python:** v3.10 or higher
- **PostgreSQL / Supabase account:** (or local PostgreSQL 15+)

### 4.2 Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   # Windows (PowerShell)
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1

   # Linux / macOS
   python3 -m venv .venv
   source .venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Configure environment variables:
   ```bash
   cp .env.example .env
   ```
5. Start the backend development server:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```
6. Verify the backend health endpoint:
   ```bash
   curl http://localhost:8000/api/v1/health
   ```
   Interactive Swagger API docs available at: `http://localhost:8000/docs`

### 4.3 Frontend Setup
1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment variables:
   ```bash
   cp .env.example .env
   ```
4. Start the frontend development server:
   ```bash
   npm run dev
   ```
5. Open your browser at `http://localhost:5173`

### 4.4 Database Setup (Supabase PostgreSQL)
1. Follow the step-by-step setup in [`docs/DATABASE_SETUP.md`](file:///d:/ACCESSWAY%20AI/docs/DATABASE_SETUP.md).
2. Execute master schema [`database/schema.sql`](file:///d:/ACCESSWAY%20AI/database/schema.sql) in your Supabase SQL Editor.
3. For isolated development/testing only: execute [`database/seed_demo.sql`](file:///d:/ACCESSWAY%20AI/database/seed_demo.sql). (Guarded against production execution).
4. For production environments: provision verified administrator accounts via `python backend/scripts/provision_admin.py --user-id "<UUID>"`.
5. Update `DATABASE_URL` in `backend/.env` with your Supabase connection string.
6. Verify live database connection via `curl http://localhost:8000/api/v1/health` (inspect `"database_status": "connected"`).

---

## 5. Canonical Database Schema (8 Authoritative Entities)

The system aligns strictly with [`ACCESSWAY_AI_database_schema.sql`](file:///d:/ACCESSWAY%20AI/ACCESSWAY_AI_database_schema.sql) containing exactly eight canonical entities:
1. `buildings`: Campus facilities with code, name, and floor configuration.
2. `profiles`: User identities with role-based access (`admin`, `student`, `faculty`).
3. `nodes`: Graph vertices representing entrances, elevators, ramps, and room waypoints.
4. `edges`: Directed navigable pathways with distance, stairs count, slope, and wheelchair accessibility.
5. `accessibility_reports`: Crowdsourced incident reports with status (`pending_review`, `verified`, `rejected`).
6. `route_sessions`: Audited navigation calculations with distance, estimated time, and route steps.
7. `campus_graph_state`: Global monotonic `graph_version` for distributed cache invalidation.
8. `report_audit_log`: Transactional record of all status changes made by facility administrators.

---

## 6. Documented REST API Endpoints

All routes are dispatched with the `/api/v1` prefix:

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/health` | Service health, synthetic demo flag, and independent database connectivity. |
| `GET` | `/api/v1/buildings` | Active campus building list (`BLDG-A`, `BLDG-B`, `BLDG-C`). |
| `GET` | `/api/v1/buildings/{id}/nodes` | Navigable nodes for the selected campus building. |
| `GET` | `/api/v1/map/geojson` | GeoJSON `FeatureCollection` of verified nodes and edges with `graph_version`. |
| `POST` | `/api/v1/routes/calculate` | Simultaneous dual-profile calculation (`fastest` vs. `step_free`). |
| `GET` | `/api/v1/graph/version` | Current campus graph version and update timestamp for freshness checks. |
| `POST` | `/api/v1/reports` | Crowdsourced barrier reporting; broken lifts set target to `reported_unverified`. |
| `GET` | `/api/v1/admin/reports` | Protected admin review queue (requires Bearer JWT with `role='admin'`). |
| `PATCH` | `/api/v1/admin/reports/{id}` | Protected admin moderation (`verify` or `reject` with resolution notes). |

---

## 7. Testing & Verification

### 7.1 Backend Pytest Suite
```bash
# Run all 68 backend tests (100% pass)
.\backend\.venv\Scripts\python.exe -m pytest backend/tests/ -v
```

### 7.2 Frontend Test Suite (9 Focused Suites)
```bash
cd frontend

# TypeScript check & production build
npm run lint
npm run build

# Integration, safety & production invariant test suites
npm run test:safety         # Routing safety & wheelchair constraints (5/5)
npm run test:connectivity   # Health & independent DB status determination (5/5)
npm run test:dynamic        # Dynamic building & node data fetching (8/8)
npm run test:geojson        # Map GeoJSON layer & step-free styling (8/8)
npm run test:route          # Dual route calculation & HTTP 409 handling (12/12)
npm run test:freshness      # Graph version freshness tracking & speech lock (12/12)
npm run test:reporting      # Accessibility reporting & broken lift exclusion (12/12)
npm run test:admin          # Admin JWT authorization & moderation queue (13/13)
npm run test:production     # Phase 6.5 demo removal & production invariants (12/12)
```

---

## 8. Campus Data, Safety Policy & Real-World Readiness

1. **Target Campus:** Lovely Professional University (LPU).
2. **Honest Readiness Status:** ACCESSWAY AI is converted to a production-oriented codebase with all demo modes, demo buttons, and client-side fallbacks completely removed. Official campus floor plans, building maps, and physical ground surveys are pending institutional authorization. Real-world navigation will activate when verified campus infrastructure data has been added and verified.
3. **Informative Empty States:** When connected to an empty production database, the application displays the honest notice:
   `"No verified campus locations are currently available. Navigation will become available when authorized campus infrastructure data has been added and verified."`
4. **Never Fabricate Infrastructure:** We strictly do not invent buildings, coordinates, entrances, floors, lifts, ramps, corridors, pathways, or landmarks.
5. **Fail-Safe Accessibility:** Step-free routes **never silently fall back to stairs or fastest routes**. If an impassable obstacle or unverified path exists, the engine returns the exact explanation: `"No verified step-free route is currently available."`.
6. **Photo Upload Limitation:** Photo attachments are validated client-side ($\le 5\text{MB}$, JPG/PNG/WebP). Cloud photo storage is not currently provisioned; `photo_url` is passed as `null` without false claims.
7. **No Automatic Demo Fallback:** Live API failures surface clear error alerts to the user; the application never silently falls back to synthetic local data on network failure.
8. **Isolated Test Fixtures:** Automated test fixtures are strictly isolated in `src/test/demoFixtures.ts` and `database/seed_demo.sql` for regression verification and benchmark testing, completely decoupled from production runtime services.
