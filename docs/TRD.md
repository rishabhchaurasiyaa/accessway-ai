# ACCESSWAY AI — Technical Requirements Document (TRD)

**Project:** ACCESSWAY AI — Accessible Campus Navigator  
**Document:** Technical Requirements & Engineering Specifications  
**Version:** 1.0.0  

---

## 1. System Technology Stack

| Layer | Technology | Version / Specification | Rationale & Responsibility |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | React + Vite | React 18 / Vite 5+ / TypeScript 5+ | Fast compilation, strict type safety, modular component lifecycle. |
| **Styling & Icons** | Tailwind CSS + Lucide React | Tailwind 3.4+ / Lucide React | High-contrast utility classes, fluid accessible layouts, accessible SVG icons. |
| **Mapping Engine** | Leaflet + React Leaflet | Leaflet 1.9+ / React Leaflet 4+ | Lightweight outdoor campus mapping without expensive external proprietary SDKs. |
| **Indoor Floor Maps** | Custom Responsive SVG | SVG 1.1 / React Component wrappers | Precise architectural floor plans, high DPI, interactive node coordinate overlay. |
| **Speech Engine** | Web Speech Synthesis API | Native Browser W3C Standard | Zero network latency text-to-speech for turn-by-turn spoken guidance. |
| **Backend Framework** | Python FastAPI + Uvicorn | Python 3.10+ / FastAPI 0.110+ | Asynchronous high-throughput REST API, automatic OpenAPI/Swagger docs, Pydantic v2 validation. |
| **Database & Auth** | Supabase (PostgreSQL 15+) | PostGIS extensions / pgvector compatible | Relational spatial integrity, Row-Level Security (RLS), instant JSON serialization. |
| **Algorithm** | Dijkstra with Multi-Criteria Cost | Custom Python Network Engine | Deterministic shortest-path with constraint-based dynamic edge pruning. |
| **Hosting & CI/CD** | Vercel (Frontend), Render (API) | Cloud Native CI/CD Pipelines | Zero-config edge hosting for SPA, isolated containerized backend deployment. |

---

## 2. Graph Data Structure & Routing Algorithm

### 2.1 Graph Formulation
The campus environment is modeled as a directed, weighted multigraph \( G = (V, E) \):
- **Vertices \( V \):** Physical points in the campus.
  ```typescript
  interface Node {
    id: string;               // e.g. "NODE_BLDGA_G_ENTRANCE_WEST"
    buildingId?: string;      // "BLDG_A", "BLDG_B", "BLDG_C", or null (outdoor)
    floor: number;            // 0 (Ground), 1 (Floor 1), 2 (Floor 2), null (outdoor)
    name: string;             // Human readable name (e.g., "Building A West Entrance")
    type: 'entrance' | 'room' | 'lift' | 'stairs' | 'ramp' | 'junction' | 'landmark' | 'restroom';
    isLandmark: boolean;      // Marks anchor for visually impaired cues
    landmarkDesc?: string;    // e.g., "Near the double glass doors and security desk"
    tactilePaving: boolean;   // Verified tactile paving exists
    coordinates: {
      lat?: number;           // Outdoor latitude (WGS84)
      lng?: number;           // Outdoor longitude (WGS84)
      x?: number;             // Indoor SVG coordinate X
      y?: number;             // Indoor SVG coordinate Y
    };
  }
  ```
- **Edges \( E \):** Walkable pathways connecting nodes.
  ```typescript
  interface Edge {
    id: string;
    source: string;           // Node ID
    target: string;           // Node ID
    distanceMeters: number;   // Physical length
    edgeType: 'corridor' | 'outdoor_path' | 'ramp' | 'lift' | 'stairs' | 'door';
    slopePercentage: number;  // Incline (e.g., 4.5% for ADA ramp; >8.33% fails accessibility)
    widthMeters: number;      // Must be >= 0.9m for wheelchair clearance
    isStairs: boolean;
    isLift: boolean;
    isRamp: boolean;
    surfaceType: 'smooth_tile' | 'paved_concrete' | 'asphalt' | 'cobblestone' | 'gravel';
    verifiedAccessible: boolean; // Must be true for step-free inclusion
    blockedByIncidentId?: string | null; // Set when an admin verifies an incident
    directionCue: string;     // e.g., "Head north toward the elevators"
    landmarkCue?: string;     // e.g., "Pass the water cooler on your right"
  }
  ```

### 2.2 Algorithm Specifications
1. **Fastest Route Mode:**
   - Standard Dijkstra algorithm minimizing total physical distance/time across all walkable edges.
   - Allows `edge.isStairs = True` and operational lifts.
   - Cost function: \( C(e) = e.distanceMeters \times \text{surfaceMultiplier} \).
2. **Step-Free Route Mode (Accessibility Enforced):**
   - Cost function prunes edges upfront before queue evaluation:
     - IF `e.isStairs == True` $\rightarrow$ Exclude edge completely.
     - IF `e.blockedByIncidentId != null` $\rightarrow$ Exclude edge completely.
     - IF `e.verifiedAccessible == False` $\rightarrow$ Exclude edge completely (Safety Rule: Never treat unknown as accessible).
     - IF `e.slopePercentage > 8.33` $\rightarrow$ Exclude edge completely (Steep incline hazard).
     - IF `e.widthMeters < 0.9` $\rightarrow$ Exclude edge completely (Standard wheelchair width violation).
   - If no path exists from Source to Target after filtering, the algorithm returns an explicit `RouteNotFoundException` containing the blockage diagnostic. **Under no circumstances does it fallback to stairs.**

---

## 3. Dynamic Rerouting & Cache Invalidation

When an incident (e.g. "Lift in Building B broken") transitions from `PENDING` to `VERIFIED`:
1. Database triggers an update on `edges` setting `blocked_by_incident_id = incident.id` for all edges connected to the node or edge.
2. FastAPI backend maintains an in-memory graph cache loaded at startup.
3. Upon receiving an incident verification request or webhook, the backend executes `campus_graph.invalidate_edge(edge_id, incident_id)`.
4. Subsequent route calculations immediately avoid the disabled path.
5. Clients polling or receiving route updates receive a warning flag: `rerouted_due_to_hazard: true`.

---

## 4. Spoken Audio Navigation & Landmark Engine

### 4.1 Speech Synthesis Engine
- Implemented through a robust React hook (`useSpeechNavigation`).
- Utilizes window.speechSynthesis with fallback handling for browsers with speech synthesis disabled or restricted.
- Audio queueing logic:
  - Generates clear, non-abbreviated English sentences.
  - Priority overrides: Urgent hazard warnings cancel current speech and announce immediately.
  - Controls: `speakCurrentStep()`, `nextStep()`, `pause()`, `resume()`, `toggleMute()`.

### 4.2 Landmark Synthesis Logic
For each route segment, the step instruction is generated using a 3-part spatial template:
$$\text{Direction} + \text{Distance} + \text{Landmark Orientation} + \text{Accessibility Details}$$
*Example:*  
*"Turn slightly right and proceed 15 meters along the tactile paving. Pass the Student Services Helpdesk on your left. Ahead is the wide automatic sliding door to Campus Building B."*

---

## 5. Screen-Reader & A11y Architecture (WCAG 2.1 AA/AAA)

1. **TalkBack (Android) & VoiceOver (iOS/macOS) Optimization:**
   - ARIA Live Regions (`aria-live="polite"` for step updates, `aria-live="assertive"` for emergency obstacle alerts).
   - All interactive controls have meaningful `aria-label`, `role`, and `aria-expanded` attributes.
   - SVG map elements have hidden presentation roles (`aria-hidden="true"`) while semantic lists and tables present textual step details to screen readers.
2. **Keyboard Navigation:**
   - Tab sequence logically ordered from header $\rightarrow$ banner $\rightarrow$ search inputs $\rightarrow$ route results $\rightarrow$ turn-by-turn controls.
   - Prominent skip link: "Skip to Route Results" and "Skip to Audio Guidance".
   - Visible high-contrast focus rings (`focus-visible:ring-4 focus-visible:ring-blue-600 focus-visible:outline-none`).
3. **Color Contrast:**
   - Dark Slate backgrounds (`#0F172A`) paired with High-Visibility White (`#FFFFFF`) and Amber/Green status accents meeting contrast ratios $\ge 7:1$.

---

## 6. API Architecture (FastAPI)

### 6.1 Endpoints Specification

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/health` | Healthcheck and graph status | None |
| `GET` | `/api/v1/campus/buildings` | List of buildings (A, B, C) and floors | None |
| `GET` | `/api/v1/campus/nodes` | List of nodes / landmarks / rooms | None |
| `POST` | `/api/v1/navigation/route` | Compute route (fastest vs step-free) | None |
| `GET` | `/api/v1/incidents` | List active verified incidents & hazards | None |
| `POST` | `/api/v1/incidents/report` | Submit crowdsourced accessibility issue | None (Rate limited) |
| `POST` | `/api/v1/admin/login` | Administrator authentication (JWT) | None |
| `GET` | `/api/v1/admin/incidents` | Fetch all incidents (Pending, Verified, etc.) | Admin JWT |
| `PATCH` | `/api/v1/admin/incidents/{id}/verify` | Verify issue & block affected graph edges | Admin JWT |
| `PATCH` | `/api/v1/admin/incidents/{id}/resolve`| Mark issue resolved & unblock graph edges | Admin JWT |
| `PATCH` | `/api/v1/admin/incidents/{id}/reject` | Reject invalid report | Admin JWT |
| `POST` | `/api/v1/admin/data/import` | Import surveyed campus nodes/edges template | Admin JWT |

---

## 7. Security Architecture

1. **Environment Separation:**
   - `frontend/.env`: Contains `VITE_API_URL` and `VITE_SUPABASE_ANON_KEY`. Never contains service role key.
   - `backend/.env`: Contains `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `JWT_SECRET`, and `ADMIN_CREDENTIALS_HASH`.
2. **Database Row Level Security (RLS):**
   - Table `incidents`: `SELECT` allowed for verified incidents. `INSERT` allowed for all users. `UPDATE`/`DELETE` restricted to authenticated admin role.
   - Tables `nodes`, `edges`, `buildings`: Read-only for public anon key; mutate requires service role.
3. **Input Sanitization & Rate Limiting:**
   - Issue description sanitized against XSS.
   - Incident submission limited to 5 submissions per IP/hour via backend middleware to prevent spam.

---

## 8. Synthetic Demo Data Enforcement

- Backend and frontend share a global configuration variable: `IS_SYNTHETIC_DATA_MODE = True`.
- In synthetic mode:
  - Every API response attaches header `X-AccessWay-Data-Mode: SIMULATED_DEMO_DATA`.
  - Frontend renders persistent header badge: `SIMULATED DEMO DATA — NOT FOR REAL-WORLD NAVIGATION`.
  - Data schema includes standard import/export endpoints compliant with standard GeoJSON FeatureCollections for straightforward migration to surveyed campus data.
