# Campus Survey Data Import Specifications

**Project:** ACCESSWAY AI — Accessible Campus Navigator  
**Source of Truth:** `ACCESSWAY_AI_M9_Project_Documentation.docx` & `ACCESSWAY_AI_database_schema.sql`  
**Notice:** ⚠️ **SIMULATED DEMO DATA — NOT FOR REAL-WORLD NAVIGATION**  
This directory provides standard data contracts to replace synthetic demonstration data (`seed_demo.sql`) with physically surveyed university campus blueprints and geospatial coordinates.

---

## 1. Import Order & Relational Hierarchy

To preserve relational integrity, import data in the following sequential order:

```text
1. Profiles (profiles table)
   ↓
2. Buildings (buildings table, contains floors JSONB)
   ↓
3. Nodes (nodes table, references buildings.id, profiles.user_id)
   ↓
4. Edges (edges table, references from_node_id, to_node_id)
   ↓
5. Campus Graph State (campus_graph_state singleton id=1)
   ↓
6. Accessibility Reports & Audit Logs (accessibility_reports, report_audit_log)
```

---

## 2. Nodes Data Contract (`campus_nodes_template.json`)

### Canonical Field Specifications

| Field Name | Type | Mandatory? | Description & Allowed Values |
| :--- | :--- | :--- | :--- |
| `node_code` | `string` | **Required** | Unique identifier (e.g. `NODE-BLDGA-ENTRANCE-MAIN`). |
| `name` | `string` | **Required** | Human-readable name for spoken navigation and screen readers. |
| `node_type` | `string` | **Required** | Must be one of: `'entrance'`, `'junction'`, `'ramp'`, `'lift'`, `'landmark'`, `'destination'`. |
| `building_code` | `string` | Optional | Foreign key to building (`building_code` in `buildings` table); `null` for outdoor nodes. |
| `floor_label` | `string` | Optional | Floor identifier string (e.g. `'Ground'`, `'Floor 1'`). |
| `latitude` | `number` | Optional | WGS84 Latitude between -90 and 90. |
| `longitude` | `number` | Optional | WGS84 Longitude between -180 and 180. |
| `operational_status`| `string` | **Required** | Must be one of: `'available'`, `'reported_unverified'`, `'blocked'`, `'unknown'`. |
| `landmark_description` | `string` | Optional | Sensory audio/tactile description for visually impaired navigation. |
| `verification_status`| `string` | **Required** | Must be `'verified'` or `'unverified'`. |
| `is_active` | `boolean` | **Required** | `true` if node is open/active for routing. |

---

## 3. Edges Data Contract (`campus_edges_template.json`)

### Canonical Field Specifications

| Field Name | Type | Mandatory? | Description & Allowed Values |
| :--- | :--- | :--- | :--- |
| `from_node_code` | `string` | **Required** | Valid `node_code` of origin node. |
| `to_node_code` | `string` | **Required** | Valid `node_code` of destination node. |
| `distance_m` | `number` | **Required** | Physical distance in meters ($> 0$). |
| `estimated_seconds`| `integer` | **Required** | Estimated traversal time ($> 0$). |
| `path_type` | `string` | **Required** | One of: `'corridor'`, `'walkway'`, `'ramp'`, `'lift'`, `'stairs'`, `'crossing'`, `'other'`. |
| `stairs_count` | `integer` | **Required** | Must be $\ge 0$. If `path_type` is `'stairs'`, `stairs_count` must be $> 0$. |
| `slope_percent` | `number` | Optional | Incline percentage. Slopes $> 8.33\%$ (1:12 ADA max) are excluded from step-free routes. |
| `clear_width_cm` | `number` | Optional | Clear path width. Widths $< 90$cm are excluded from step-free routes. |
| `wheelchair_accessible` | `boolean/null`| Optional | `true` if verified accessible. `NULL` is treated as unverified and is strictly excluded from step-free navigation. |
| `tactile_guidance` | `boolean` | Optional | `true` if tactile ground indicators or guide rails exist. |
| `verification_status`| `string` | **Required** | `'verified'` or `'unverified'`. Unverified paths are excluded from step-free routes. |
| `operational_status`| `string` | **Required** | `'available'`, `'reported_unverified'`, `'blocked'`, `'unknown'`. Only `'available'` is step-free eligible. |
| `landmark_instruction` | `string` | Optional | Sensory landmark instruction for turn-by-turn guidance. |

---

## 4. Accessibility Safety Rules

During import and database ingestion, all records must adhere to:

1. **Step-Free Route Exclusion**:
   An edge is only included in a step-free route if:
   $$\text{wheelchair\_accessible} = \text{true} \;\land\; \text{stairs\_count} = 0 \;\land\; \text{path\_type} \ne \text{'stairs'} \;\land\; \text{operational\_status} = \text{'available'} \;\land\; \text{verification\_status} = \text{'verified'}$$
2. **Safe Null Handling**:
   `wheelchair_accessible = NULL` is strictly treated as inaccessible.
3. **Graph Invalidation**:
   Any modification to edge/node accessibility attributes must bump `campus_graph_state.graph_version` so clients invalidate route caches immediately.
