# ACCESSWAY AI — Implementation Plan & Team Schedule

**Project:** ACCESSWAY AI — Accessible Campus Navigator  
**Hackathon:** Code Fuzion 2026 — Problem Statement M9  
**Document:** Phased Execution Strategy, 4-Member Team Matrix, and 24-Hour Implementation Timeline  
**Version:** 1.0.0  

---

## 1. 4-Member Team Roles & Responsibilities Matrix

| Team Member | Primary Role | Domain Responsibilities | Deliverables |
| :--- | :--- | :--- | :--- |
| **Member 1 (Lead)** | **Full-Stack Lead & Algorithm Engineer** | Graph engine, Dijkstra algorithm, Multi-criteria cost evaluation, Dynamic rerouting, Cache invalidation, FastAPI core. | `backend/app/services/routing.py`, `backend/app/services/graph.py`, Unit tests for Dijkstra. |
| **Member 2** | **Frontend Architect & Mapping Specialist** | React + Vite + TypeScript application setup, Leaflet outdoor map, SVG floor plan viewer, route visualizer, responsive UI components. | `frontend/src/components/map/`, `frontend/src/components/indoor/`, `frontend/src/components/route/`. |
| **Member 3** | **Accessibility Specialist & UI/UX Designer** | WCAG 2.1 AA/AAA compliance, TalkBack/VoiceOver testing, Web Speech Synthesis hook, Landmark descriptions, High-contrast design. | `frontend/src/hooks/useSpeechNavigation.ts`, ARIA attributes, Skip links, axe-core audit. |
| **Member 4** | **Database Architect & DevOps Engineer** | Supabase PostgreSQL schema, RLS policies, DDL migrations, synthetic demo dataset generator, Incident reporting APIs, Docker/Render/Vercel deployment. | `backend/app/db/`, `backend/app/routers/incidents.py`, Supabase SQL migrations, CI/CD workflows. |

---

## 2. 24-Hour Implementation Schedule (Hackathon Breakdown)

### Block 1: Hours 00:00 – 04:00 | System Blueprint & Foundation Setup
- [x] Create comprehensive architectural blueprints (`PRD.md`, `TRD.md`, `APP_FLOW.md`, `UI_UX_BRIEF.md`, `DATABASE_DESIGN.md`, `IMPLEMENTATION_PLAN.md`, `ARCHITECTURE.md`).
- [ ] Initialize Git repository structure (`/frontend`, `/backend`, `/docs`).
- [ ] Configure Tailwind CSS, TypeScript types, and environment variable templates (`.env.example`).
- [ ] Milestone 1 Review: Validate architecture consistency with Problem Statement M9.

### Block 2: Hours 04:00 – 08:00 | Backend Core & Dijkstra Routing Engine
- [ ] Implement FastAPI application skeleton with CORS and structured error handling.
- [ ] Build in-memory graph representation and Dijkstra shortest-path solver.
- [ ] Implement Step-Free vs. Fastest mode constraints (strict stairs, slope, and hazard pruning).
- [ ] Implement honest fallback handling (zero silent fallback to stairs).
- [ ] Write pytest test suite for routing algorithm corner cases (disconnected components, all lifts broken, slope violations).

### Block 3: Hours 08:00 – 12:00 | Database Schema, Seed Data & Incidents API
- [ ] Set up Supabase PostgreSQL tables: `buildings`, `floors`, `nodes`, `edges`, `incidents`, `audit_logs`.
- [ ] Deploy Row Level Security (RLS) policies and performance indexes.
- [ ] Seed database with synthetic demo dataset for Campus Buildings A, B, and C with unmistakable disclaimer flag.
- [ ] Build Incident reporting endpoints (`POST /incidents/report`, `GET /incidents`).
- [ ] Build Admin verification endpoints (`PATCH /admin/incidents/{id}/verify`, `resolve`, `reject`) with dynamic graph invalidation.

### Block 4: Hours 12:00 – 16:00 | Frontend Map Engine & Indoor SVG Floor Plans
- [ ] Build Leaflet outdoor map with custom campus pathways, building polygons, and accessibility pins.
- [ ] Develop interactive SVG indoor floor plan components for Building A, B, and C (Ground, Floor 1, Floor 2).
- [ ] Implement synchronized route polyline rendering across both outdoor and indoor maps.
- [ ] Build Route Planning drawer with autocomplete node selector and mode toggles.
- [ ] Add persistent "SIMULATED DEMO DATA" warning header.

### Block 5: Hours 16:00 – 20:00 | Audio Guidance, Landmarks & Crowdsourced Reporting
- [ ] Implement `useSpeechNavigation` using native Web Speech Synthesis API.
- [ ] Build turn-by-turn guidance card deck with landmark spatial cues.
- [ ] Build student Incident Reporting modal with instant submission feedback.
- [ ] Build authenticated Admin Verification console (`/admin`) with real-time issue review and graph block triggers.
- [ ] Verify dynamic rerouting: reporting a broken lift updates active routes within 1 second.

### Block 6: Hours 20:00 – 24:00 | A11y Audit, Integration Testing & Production Deployment
- [ ] Conduct accessibility audit with axe-core / Lighthouse; verify contrast ratios $\ge 7:1$.
- [ ] Test TalkBack on Android device and VoiceOver on iOS/macOS.
- [ ] Verify full keyboard navigation without mouse.
- [ ] Deploy backend to Render and frontend to Vercel.
- [ ] End-to-end integration walkthrough and final demo recording prep.

---

## 3. Verification & QA Milestone Checkpoints

```text
+----------------------+----------------------------------------------------------+-----------------------+
| Milestone            | Verification Criteria                                    | Responsible Member    |
+----------------------+----------------------------------------------------------+-----------------------+
| M1: Architecture     | Complete docs, zero contradictions, M9 full alignment     | Member 1 (Lead)       |
| M2: Routing Safety   | Pytest: 100% test pass; no stairs in step-free paths     | Member 1              |
| M3: Data Integrity   | Supabase RLS verified; synthetic disclaimer displayed    | Member 4              |
| M4: Map & Floor Sync | Smooth outdoor-to-indoor floor plan transition           | Member 2              |
| M5: Live Rerouting   | Admin verify lift break -> client route changes instantly| Member 1 & Member 4   |
| M6: Speech & A11y    | TalkBack & VoiceOver read all steps; 0 a11y violations   | Member 3              |
| M7: Production Ready | Live Vercel & Render URLs operational                    | All Members           |
+----------------------+----------------------------------------------------------+-----------------------+
```

---

## 5. Phase Execution Status & Phase 6 Integration Roadmap

### Current Status (Phases 1–5.1 Complete)
- **Phase 1 & 2:** System Architecture & Blueprint Alignment.
- **Phase 3, 3.1 & 3.2:** Canonical 8-Entity Supabase PostgreSQL Schema Alignment strictly aligned with `ACCESSWAY_AI_database_schema.sql` (`buildings`, `profiles`, `nodes`, `edges`, `accessibility_reports`, `route_sessions`, `campus_graph_state`, `report_audit_log`). Strict database safety verification, rejection safety, and idempotent report handling.
- **Phase 4, 4.1 & 4.2:** Core Dijkstra Routing Engine with dual profiles (`fastest` and `step_free`), canonical `route_sessions` persistence, and identity security patch preventing user impersonation.
- **Phase 5 & 5.1:** React + Vite + Tailwind CSS frontend with 7 screens, WCAG 2.1 AA/AAA compliance, minimum 44×44px touch targets, Leaflet mapping, turn-by-turn landmark navigation with optional speech, and verified safety audit.

---

### Phase 6: Frontend & Backend Integration Plan (Corrected)

#### Mandatory Requirements & Scope
1. **Authoritative Canonical 8-Entity Schema:**
   - Strictly preserves: `buildings`, `profiles`, `nodes`, `edges`, `accessibility_reports`, `route_sessions`, `campus_graph_state`, and `report_audit_log`.
   - Prohibits replacement entities (`users`, `reports`, `audit_logs`, `floors`).
2. **Environment Configuration:**
   - Canonical API base variable: `VITE_API_BASE_URL` (default `http://127.0.0.1:8000`).
   - Unified Axios client in `frontend/src/services/api.ts` with structured error handling.
   - Update `frontend/.env.example` without exposing backend secrets or service-role keys.
3. **Dynamic Campus Data:**
   - Integrate `GET /api/v1/buildings` and `GET /api/v1/buildings/{id}/nodes`.
   - Never silently substitute mock data when an API request fails; surface errors directly to the user.
   - Client-side Dijkstra runs **ONLY** when the user explicitly enables simulated demo mode.
4. **Map Integration:**
   - Integrate `GET /api/v1/map/geojson` with Leaflet in `CampusMap.tsx`.
   - Maintain visible synthetic demo data watermark.
5. **Routing Integration:**
   - Integrate `POST /api/v1/routes/calculate` supporting fastest and step-free profiles simultaneously.
   - Preserve all backend safety invariants (strict stairs/slope/obstacle exclusion; no silent fallback to stairs).
   - Handle HTTP 409 conflict with prompt: `"Route information changed. Recalculate before continuing."`
   - Never silently switch to client-side routing on API failure.
6. **Graph Version & Freshness:**
   - Integrate `GET /api/v1/graph/version` to detect graph changes and require recalculation before proceeding.
7. **Health Diagnostics & Separate Connectivity Indicators:**
   - Integrate `GET /api/v1/health`.
   - Display API connectivity and database connectivity as two separate indicators.
   - Never claim database readiness without a successful database check (`database_status === 'connected'`).
8. **Reports & Moderation:**
   - Integrate `POST /api/v1/reports`, `GET /api/v1/admin/reports`, and `PATCH /api/v1/admin/reports/{id}`.
   - Preserve existing standard JWT authentication and server-side admin authorization without custom or insecure token storage.
   - Display server rejection errors honestly without local fake success.
9. **Granular Integration Testing:**
   - Create `backend/tests/test_integration_phase6.py` testing every required endpoint and HTTP method individually (`GET /health`, `GET /buildings`, `GET /buildings/{id}/nodes`, `GET /map/geojson`, `POST /routes/calculate`, `GET /graph/version`, `POST /reports`, `GET /admin/reports`, `PATCH /admin/reports/{id}`).
   - Distinctly separate in-memory SQLite test suites from live PostgreSQL/Supabase tests.


