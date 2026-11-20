# ACCESSWAY AI — UI/UX & Accessibility Brief

**Project:** ACCESSWAY AI — Accessible Campus Navigator  
**Tagline:** *Every Path Should Be Accessible.*  
**Document:** UI/UX Design System, Accessibility Standards, and Screen Wireframes  
**Version:** 1.0.0  

---

## 1. Design Philosophy & Accessibility Core Tenets

ACCESSWAY AI is built from the ground up under the principle of **Universal Design**. Accessibility is not an afterthought or an overlay; it is the core foundation of every design choice.

### 1.1 Core Tenets
1. **Perceivable:** Information must be presented through multiple sensory modalities—visual maps, readable text, high-contrast indicators, and synthesized spoken audio.
2. **Operable:** 100% of features must be operable with a standard keyboard, single switch, or touch gestures. Minimum touch target size is $48 \times 48\text{px}$.
3. **Understandable:** Instructions use plain, predictable terminology. Step instructions pair metric distances with concrete visual and tactile landmarks (e.g. *"tactile paving on floor"*, *"double glass doors"*).
4. **Robust & Honest:** Visual styling never masks physical reality. If a path is blocked or inaccessible, it is marked with unambiguous visual badges and announced via screen-reader live regions.

---

## 2. Design System & Palette

### 2.1 Color Palette (WCAG AAA / AA Conformance)
All text elements maintain a minimum contrast ratio of **7:1** against their background for standard text, and **4.5:1** for large text / graphical UI icons. Red/green alone is never used to convey status.

| Token | Hex Value | Semantic Purpose | Contrast Ratio vs Background |
| :--- | :--- | :--- | :--- |
| `color-bg-canvas` | `#0B1120` | Deep slate-dark background | Dark theme baseline |
| `color-bg-surface` | `#1E293B` | Card and modal surface | Contrast baseline for UI surfaces |
| `color-text-primary` | `#F8FAFC` | Main headings, step instructions | $15.8:1$ on canvas (Passes AAA) |
| `color-text-muted` | `#CBD5E1` | Secondary labels, distances | $10.2:1$ on canvas (Passes AAA) |
| `color-accent-blue` | `#2563EB` | Primary interactive buttons, route polyline | $4.8:1$ on canvas (AA interactive) |
| `color-accent-gold` | `#F59E0B` | Warning, caution, pending reports, landmarks | $7.6:1$ on dark canvas |
| `color-safe-emerald` | `#10B981` | Step-free accessible verified path | $6.2:1$ on dark canvas |
| `color-danger-rose` | `#EF4444` | Blocked path, stairs hazard, broken lift | $5.1:1$ on dark canvas |
| `color-focus-ring` | `#60A5FA` | 4px high-visibility keyboard focus outline | Explicitly isolated ring |

### 2.2 Typography
- **Primary Typeface:** `Inter`, system `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `sans-serif`.
- **Type Scale:**
  - `Display / H1`: 28px (1.75rem), SemiBold 600, leading 1.2
  - `H2 (Section Header)`: 22px (1.375rem), SemiBold 600, leading 1.3
  - `H3 / Step Titles`: 18px (1.125rem), Medium 500, leading 1.4
  - `Body / Instructions`: 16px (1.0rem), Regular 400, leading 1.5
  - `Captions & Badges`: 14px (0.875rem), Medium 500, leading 1.4
- **Accessible Typography Rules:**
  - Never set body text below 14px.
  - Support browser text scaling up to 200% without horizontal scroll overflow or clipping.

---

## 3. Screen Wireframes & Layout Hierarchy

### 3.1 Global Header & Simulated Data Notice
```text
+----------------------------------------------------------------------------------------------------+
| [LOGO] ACCESSWAY AI   "Every Path Should Be Accessible"        [!] SIMULATED DEMO DATA (Disclaimer) |
| [Theme/Contrast] [Audio Speed: 1.0x] [Report Issue Button] [Admin Portal Link]                      |
+----------------------------------------------------------------------------------------------------+
```
- **Simulated Data Notice:** High-contrast amber badge with icon: `"SIMULATED DEMO DATA — NOT FOR REAL-WORLD NAVIGATION"`. Clicking the badge opens a modal explaining that the demonstration data uses placeholder Buildings A, B, and C, and offers the data import template.

### 3.2 Dual-Pane Application Layout (Desktop)
```text
+------------------------------------------+---------------------------------------------------------+
| ROUTE PLANNER & STEP GUIDANCE (Sidebar)  | CAMPUS MAP & INDOOR FLOOR VIEWER (Main Viewport)        |
|------------------------------------------|---------------------------------------------------------|
| [Start Location: Bldg A West Entrance v] | [Outdoor Map] / [Bldg A] / [Bldg B] / [Bldg C]          |
| [Destination: Bldg B Room 204         v] | Floor: [ Ground (0) ]  [ Floor 1 ]  [ Floor 2 ]         |
|                                          |                                                         |
| Mode: (*) Step-Free    ( ) Fastest       | +-----------------------------------------------------+ |
|       [Wheelchair Safe]   [Has Stairs]   | |                                                     | |
|                                          | |      [ Leaflet Map / SVG Indoor Floor Plan ]        | |
| [ FIND ACCESSIBLE ROUTE ] (Primary CTA)  | |                                                     | |
|------------------------------------------| |   *---(Polyline Route)---*---[!] Lift Broken---*    | |
| ROUTE SUMMARY:                           | |                                                     | |
| 140m • 3 mins • 0 Stairs • 1 Ramp • Lift | +-----------------------------------------------------+ |
| [ > Start Spoken Guidance ] [ Repeat ]   |                                                         |
|                                          | MAP LEGEND:                                             |
| STEP 1: Head east 30m past cafeteria...  | (---) Step-Free Path   (...) Fastest/Stairs             |
| STEP 2: Take elevator to Floor 2...      | [!] Verified Hazard    [R] Accessible Ramp              |
+------------------------------------------+---------------------------------------------------------+
```

### 3.3 Mobile-First Drawer Layout
On screens $< 768\text{px}$:
- The Map occupies full viewport height with floating controls.
- The Route Planner and Turn-by-Turn cards sit in an accessible bottom sheet modal that can expand to 85% height or collapse to show the map and active step instruction.

---

## 4. Accessibility Testing Matrix & Assistive Tech Specifications

### 4.1 TalkBack (Android) Specification
- **Navigation Flow:** Linear swipe right reads each container in logical reading order.
- **Announcement Rules:**
  - Route calculation triggers `aria-live="polite"` announcing: *"Accessible route found. Total distance 140 meters. 4 steps. Step-free."*
  - Active step button triggers: *"Step 1 of 4. Proceed straight 30 meters. Landmark: Cafeteria entrance on your left."*
  - Emergency reroute triggers `aria-live="assertive"`: *"Warning: Lift in Building B verified broken. Route has been recalculated via East Ramp."*

### 4.2 VoiceOver (iOS / macOS) Specification
- **Rotor Navigation:** Landmarks defined via `<header>`, `<main>`, `<nav>`, `<aside>`, `<section aria-labelledby="...">`.
- **Form Controls:** Every `<select>` and `<input>` contains explicit `<label htmlFor="...">` and `aria-describedby` helper texts.

### 4.3 Keyboard & Focus Management
- Keyboard Tab navigation order:
  1. Skip to Content link (`href="#main-content"`)
  2. Simulated Data info trigger
  3. Origin selection
  4. Destination selection
  5. Route mode switch (Arrow keys to toggle Step-Free vs Fastest)
  6. "Find Route" button (`Enter` or `Space`)
  7. Turn-by-Turn list or Audio Guidance player (`Space` to Play/Pause, `Arrow Right` for Next Step)
- Focus rings: 4px solid `#60A5FA` with 2px offset.

---

## 5. UI Components Specification

1. **`AccessibilityBanner`:** Persistent dismiss-resistant disclaimer header.
2. **`RouteForm`:** Searchable autocomplete select boxes with clear button and accessible validation errors.
3. **`RouteModeToggle`:** Segmented radio group styling with `aria-checked` states and clear visual icons (wheelchair vs running person).
4. **`IndoorFloorSwitcher`:** Accessible tablist (`role="tablist"`) with `aria-selected` for Ground, Floor 1, Floor 2.
5. **`StepCard`:** Direction icon, metric distance badge, clear text instruction, and tactile landmark highlight box.
6. **`AudioControlBar`:** Sticky footer or sidebar control with Play/Pause button, Next Step, Repeat, and Speech Rate selector (0.75x, 1x, 1.25x, 1.5x).
7. **`IncidentReportModal`:** Accessible dialog (`role="dialog"`, `aria-modal="true"`) trapping focus during submission.
8. **`AdminIncidentTable`:** Accessible table (`role="table"`) with sortable headers and action button groups.
