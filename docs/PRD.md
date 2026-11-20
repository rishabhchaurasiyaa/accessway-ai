# ACCESSWAY AI — Product Requirements Document (PRD)

**Project:** ACCESSWAY AI — Accessible Campus Navigator  
**Tagline:** *Every Path Should Be Accessible.*  
**Hackathon:** Code Fuzion 2026 — Official Problem Statement M9 (Moderate)  
**Status:** Approved Blueprint / Ready for Implementation  
**Version:** 1.0.0  

---

## 1. Executive Summary & Objective

Navigating higher education campuses poses severe physical and navigational friction for students with disabilities, particularly wheelchair users and visually impaired students. Existing navigation solutions (such as generic GPS tools or outdoor maps) fail to account for accessibility barriers:
- Inability to differentiate between step-free pathways, steep slopes, gravel, lifts, and stairs.
- Absence of indoor-to-outdoor transitions across connected academic blocks.
- Stale status information regarding broken lifts, ongoing construction, or blocked ramps.
- Lack of sensory-rich landmark cues for screen-reader and visually impaired users.

**ACCESSWAY AI** solves Problem Statement M9 by delivering a production-grade, responsive, indoor-outdoor campus navigation progressive web application across three representative campus buildings at Lovely Professional University (LPU)—modeled safely through placeholder buildings: **Campus Building A**, **Campus Building B**, and **Campus Building C**.

---

## 2. Problem Statement & Scope

### 2.1 The Problem
Wheelchair users and visually impaired students cannot reliably identify which campus paths have ramps, lifts, or stairs. When a lift breaks down or maintenance blocks a ramp, mobility-impaired users frequently get stranded or must take exhausting detours without warning. Furthermore, blind and low-vision students cannot rely on standard visual maps and require descriptive landmark cues, spoken turn-by-turn audio, and complete screen-reader compatibility (TalkBack and VoiceOver).

### 2.2 Scope & Boundaries
- **Covered Scope:**
  - 3 Buildings (Campus Building A, B, and C) spanning outdoor connecting walkways and indoor multi-floor levels (Ground, Level 1, Level 2).
  - Graph-based pathfinding supporting two distinct routing modes: **Fastest Route** and **Step-Free Route** (strictly wheelchair-accessible).
  - Accessibility safety guarantee: Step-free routes rigorously exclude stairs, active accessibility barriers/hazards, and unverified/unknown path segments.
  - Crowdsourced accessibility hazard reporting (broken lifts, blocked ramps, surface obstacles) with an authenticated Admin verification console.
  - Automatic dynamic rerouting: Once an administrator verifies a reported issue, the routing engine updates instantly to avoid the affected graph edge.
  - Spoken audio directions using the standard Web Speech Synthesis API and live landmark navigation.
  - Full assistive technology accessibility (WCAG 2.1 AA/AAA compliance, TalkBack, VoiceOver).
- **Explicit Out of Scope:**
  - Live satellite GPS tracking inside indoor facilities (indoor positioning is handled via origin selector, landmark anchors, and step checkpoints to avoid false precision).
  - Real unverified LPU telemetry: The initial release uses a strictly identified synthetic dataset with clear UI disclaimer flags until surveyed physical data is imported.

---

## 3. User Personas

| Persona | Profile & Needs | Primary Pain Point | Core Features Leveraged |
| :--- | :--- | :--- | :--- |
| **Aarav — The Wheelchair User** | 2nd-year B.Tech student using a manual/powered wheelchair. | Arrives at a building only to find the sole lift out of order or stairs with no ramp. | Step-Free Route, real-time lift status indicators, alternative route alerts, hazard reporting. |
| **Priya — Visually Impaired Student** | 1st-year MBA student with total blindness, relies on TalkBack on Android and cane navigation. | Visual map pins are useless; outdoor GPS drifts indoors; lack of physical landmark cues. | Spoken turn-by-turn navigation, landmark-based descriptions ("Turn left after the library entrance door"), high-contrast UI, full ARIA live regions. |
| **Vikram — Student with Temporary Injury** | Uses crutches following a sports fracture; seeks to minimize steps and elevation climbs. | Traditional routes take excessive stairs that cause strain and danger of slipping. | Step-Free & minimal-elevation route options, clear floor-by-floor step estimates. |
| **Sunita — Campus Facility Administrator** | Campus safety and facility officer responsible for infrastructure maintenance. | No central feed of student accessibility issues; slow reaction to lift failures. | Admin verification dashboard, instant issue resolution, automated route re-weighting. |

---

## 4. User Journeys

### 4.1 Wheelchair User Journey (Aarav)
1. **Launch:** Aarav opens ACCESSWAY AI on his smartphone browser.
2. **Notification Notice:** Sees clear notice: *"SIMULATED DEMO DATA — NOT FOR REAL-WORLD NAVIGATION"*.
3. **Route Planning:** Selects Starting Point (*Campus Building A — West Entrance*) and Destination (*Campus Building B — Room 204*).
4. **Mode Selection:** Toggles **Step-Free Mode**. The UI validates that only ramps, level walkways, and operational lifts are considered.
5. **Dynamic Hazard Alert:** Aarav notes that Lift L1 in Building B is flagged as "Verified Out of Service". The engine automatically routes him via the East Ramp of Building B to Level 2.
6. **Navigation:** Reviews step-by-step instructions with distances, surface types, and door clearances. Clicks "Start Journey".
7. **Arrival:** Arrives safely at Room 204 without encountering unexpected stairs.

### 4.2 Visually Impaired Student Journey (Priya)
1. **Launch & Screen Reader Handshake:** Opens application with TalkBack enabled. Screen reader announces page title, navigation landmarks, and main search form.
2. **Accessible Input:** Priya uses single-swipe navigation to reach the Start Landmark dropdown, choosing "Campus Building A Central Atrium".
3. **Selects Destination:** Chooses "Campus Building C Cafeteria". Selects "Audio Directions" switch.
4. **Turn-by-Turn Guidance:** As Priya triggers "Next Step", speech synthesis speaks aloud: *"Walk straight 25 meters past the Student Helpdesk on your right. You will feel tactile paving leading to the automatic sliding doors."*
5. **Landmark Confirmation:** At each waypoint, audio and visual banners confirm physical tactile landmarks.

### 4.3 Incident Reporting & Admin Verification Journey
1. **Detection:** A student notices that the lift in Campus Building C has an electrical breakdown.
2. **Report Filing:** Student clicks "Report Issue" in the nav bar. Selects Location (*Building C, Ground Floor Lift*), Issue Type (*Broken Lift*), notes severity, and submits. Status is marked `PENDING`.
3. **Admin Review:** Admin Sunita logs into the Admin Portal (`/admin`), inspects the queue, verifies maintenance log, and clicks "Verify Issue".
4. **Immediate Graph Re-weighting:** Status flips to `VERIFIED`. An SSE/WebSocket/event triggers the routing cache invalidation. Any user requesting a step-free path through Building C Lift is immediately rerouted to the connecting bridge ramp.

---

## 5. Functional Requirements

### 5.1 Route Planning & Pathfinding (FR-100)
- **FR-101:** Support origin and destination selection across both indoor rooms/amenities and outdoor campus gates/plazas.
- **FR-102 (Fastest Route):** Computes minimal distance/time path using Dijkstra algorithm, allowing stairs, escalators, and outdoor paths.
- **FR-103 (Step-Free Route):** Computes shortest accessible path strictly filtering out stairs, narrow turnstiles, unpaved terrain, steep slopes (>8%), unverified paths, and nodes/edges marked with active verified hazards.
- **FR-104 (Honest Fallback):** If no valid step-free route exists (e.g., sole lift broken and only stairs exist), the system MUST NOT silently route via stairs. It must display an honest, prominent message: *"No step-free route currently available between these points due to verified obstacle [X]."*
- **FR-105 (Multi-floor Transitions):** Route transitions across floors must indicate the exact lift/ramp node used, floor entry, and exit instructions.

### 5.2 Landmark-Based Navigation & Audio Guidance (FR-200)
- **FR-201:** Every edge in the routing graph must support descriptive spatial cues (e.g., *"Past the cafeteria on your left"*, *"Facing the ATM kiosk"*).
- **FR-202:** Turn-by-turn navigation must provide clear text steps and spoken audio synthesized through the Web Speech API (`speechSynthesis`).
- **FR-203:** Audio guidance controls: Play, Pause, Repeat Step, and Next Step with custom volume and speech rate settings.

### 5.3 Interactive Map & Floor Plan Visualization (FR-300)
- **FR-301 (Outdoor Map):** Leaflet map rendering outdoor campus grounds, building footprints, pedestrian pathways, ramps, and building entrances.
- **FR-302 (Indoor SVG Floor Plans):** Clean, scalable SVG floor maps for Campus Building A, B, and C with floor-switcher (Ground, Floor 1, Floor 2).
- **FR-303 (Synchronized Route Polyline):** Visual highlight of the active route across outdoor Leaflet and indoor SVGs.
- **FR-304 (Live Hazard Markers):** Verified reported issues render as warning markers directly on the map.

### 5.4 Issue Reporting & Crowdsourcing (FR-400)
- **FR-401:** Public reporting modal allowing students to submit issues with category (*Broken Lift*, *Blocked Ramp*, *Slippery Surface*, *Construction Obstacle*, *Door Inaccessible*), specific building/floor/node location, description, and optional photo URL.
- **FR-402:** Submission receives an immediate confirmation with an issue reference ID and `PENDING` state.

### 5.5 Admin Verification & Management (FR-500)
- **FR-501:** Secure admin login dashboard.
- **FR-502:** Filterable list of reported issues (`PENDING`, `VERIFIED`, `RESOLVED`, `REJECTED`).
- **FR-503:** Admin actions: "Verify Issue" (instantly blocks the graph edge), "Resolve Issue" (restores normal graph weights), "Reject Issue" (marks false alarm).
- **FR-504:** Live audit log of all status transitions with timestamp and admin identifier.

### 5.6 Data Integrity & Synthetic Campus Data Management (FR-600)
- **FR-601:** Prominent persistent disclaimer banner across all navigation screens: *"SIMULATED DEMO DATA — NOT FOR REAL-WORLD NAVIGATION"*.
- **FR-602:** Buildings must strictly use placeholder names: *Campus Building A*, *Campus Building B*, *Campus Building C*.
- **FR-603:** Data Export/Import facility: Pre-structured JSON/GeoJSON schema templates allowing university authorities to replace synthetic nodes/edges with surveyed survey coordinates in the future.

---

## 6. Non-Functional Requirements (NFR)

- **NFR-1 (Accessibility):** WCAG 2.1 Level AA conformance, target Level AAA for contrast ratios (minimum 7:1 for text, 3:1 for graphical UI components). 100% keyboard navigable with visible focus rings. Screen reader testing with TalkBack (Android) and VoiceOver (iOS/macOS).
- **NFR-2 (Performance):** Route calculation response time < 150ms for campus graph (< 1000 nodes). Initial page load < 2.0s over 3G/4G network.
- **NFR-3 (Reliability & Safety):** Zero tolerance for routing wheelchair users into stairs. Routing fallback must be fail-safe.
- **NFR-4 (Security):** Supabase Row Level Security (RLS) enabled on all tables. Service role key strictly confined to backend FastAPI environment. Public users can insert reports; only authenticated admins can mutate status.
- **NFR-5 (Responsiveness):** Fluid adaptability across mobile phones (360px+), tablets (768px+), and desktop workstations (1200px+).

---

## 7. Success Criteria & KPIs

1. **Problem Statement M9 Alignment:** 100% of required features (Fastest vs Step-Free, TalkBack/VoiceOver, Landmarks, Speech, Issue Reporting, Admin Verification, Dynamic Reroute) fully testable and operational.
2. **Accessibility Audit:** Zero critical accessibility violations detected by automated audits (axe-core / Lighthouse Accessibility score ≥ 95).
3. **Dynamic Avoidance Time:** Re-routing computation reflects verified broken lifts in < 1 second.
4. **Code Quality:** Type-safe frontend and backend, comprehensive unit tests for routing and safety rules, zero fake mockups.
