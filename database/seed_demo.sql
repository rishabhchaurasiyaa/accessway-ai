-- ============================================================================
-- ACCESSWAY AI — CANONICAL SYNTHETIC DEMONSTRATION DATASET
-- Source of Truth: ACCESSWAY_AI_M9_Project_Documentation.docx & ACCESSWAY_AI_database_schema.sql
-- Code Fuzion 2026 — Official Problem Statement M9
-- NOTICE: SIMULATED DEMO DATA — NOT FOR REAL-WORLD NAVIGATION
-- Used solely for demonstration and algorithmic testing of Problem Statement M9.
-- All building names, coordinates, and paths are synthetic placeholders.
-- ============================================================================

-- ============================================================================
-- PRODUCTION SAFETY GUARD: RESTRICTED TO ISOLATED TEST / DEV ENVIRONMENTS ONLY
-- ============================================================================
-- CRITICAL FAIL-CLOSED SAFETY REQUIREMENT:
-- This script contains destructive TRUNCATE statements and synthetic placeholder
-- campus entities (BLDG-A, BLDG-B, BLDG-C). It must NEVER be executed against a
-- production database or alongside authentic physical campus survey datasets.
--
-- FAIL-CLOSED POLICY:
-- Execution is permitted ONLY when `app.environment` is explicitly set to
-- 'development' or 'test'. All other values—including 'production', empty, NULL,
-- missing, or unknown values—trigger an immediate exception and abort execution
-- before any TRUNCATE, DELETE, or INSERT statement can execute.
--
-- To execute in an isolated development database:
--   SET app.environment = 'development';
-- ============================================================================
DO $$
DECLARE
    env_val TEXT;
BEGIN
    -- Retrieve app.environment safely (missing_ok = true returns NULL if setting is unset)
    env_val := lower(trim(coalesce(current_setting('app.environment', true), '')));

    IF env_val = '' THEN
        RAISE EXCEPTION 'CRITICAL SAFETY VIOLATION: seed_demo.sql execution blocked! Setting "app.environment" is missing, NULL, or empty. Execution is strictly permitted only in explicit development or test environments.';
    ELSIF env_val NOT IN ('development', 'test') THEN
        RAISE EXCEPTION 'CRITICAL SAFETY VIOLATION: seed_demo.sql execution blocked! Setting "app.environment" is "%" (execution rejected for production, staging, and unknown environments). Execution is strictly permitted only in explicit development or test environments.', env_val;
    END IF;
END $$;

-- Safely clean existing test fixtures (Development/Testing Environments Only)
TRUNCATE TABLE report_audit_log CASCADE;
TRUNCATE TABLE accessibility_reports CASCADE;
TRUNCATE TABLE route_sessions CASCADE;
TRUNCATE TABLE edges CASCADE;
TRUNCATE TABLE nodes CASCADE;
TRUNCATE TABLE profiles CASCADE;
TRUNCATE TABLE buildings CASCADE;

-- ----------------------------------------------------------------------------
-- 1. CAMPUS GRAPH STATE (Singleton)
-- ----------------------------------------------------------------------------
INSERT INTO campus_graph_state (id, graph_version, updated_at)
VALUES (1, 1, NOW())
ON CONFLICT (id) DO UPDATE SET graph_version = 1, updated_at = NOW();

-- ----------------------------------------------------------------------------
-- 2. INSERT PROFILES
-- ----------------------------------------------------------------------------
INSERT INTO profiles (user_id, display_name, role) VALUES
('00000000-0000-0000-0000-000000000001', 'Campus Facilities Admin', 'admin'),
('00000000-0000-0000-0000-000000000002', 'Demo Student User', 'user');

-- ----------------------------------------------------------------------------
-- 3. INSERT CANONICAL BUILDINGS (Provisional codes BLDG-A, BLDG-B, BLDG-C)
-- ----------------------------------------------------------------------------
INSERT INTO buildings (id, building_code, name, description, centroid_lat, centroid_lng, floors, is_active) VALUES
(
  'b1000000-0000-0000-0000-000000000001',
  'BLDG-A',
  'Campus Academic Complex A (Synthetic Placeholder)',
  'Main academic lecture halls and administrative offices. SIMULATED DEMO DATA — NOT FOR REAL-WORLD NAVIGATION.',
  31.2460000,
  75.7020000,
  '[
    {"floor_label": "Ground", "floor_number": 0, "name": "Ground Floor"},
    {"floor_label": "Floor 1", "floor_number": 1, "name": "First Floor"}
  ]'::jsonb,
  TRUE
),
(
  'b2000000-0000-0000-0000-000000000002',
  'BLDG-B',
  'Science & Technology Complex B (Synthetic Placeholder)',
  'Laboratories and computing centers. SIMULATED DEMO DATA — NOT FOR REAL-WORLD NAVIGATION.',
  31.2472000,
  75.7035000,
  '[
    {"floor_label": "Ground", "floor_number": 0, "name": "Ground Floor"},
    {"floor_label": "Floor 1", "floor_number": 1, "name": "First Floor"}
  ]'::jsonb,
  TRUE
),
(
  'b3000000-0000-0000-0000-000000000003',
  'BLDG-C',
  'Central Student Center C (Synthetic Placeholder)',
  'Student library and accessibility resource hub. SIMULATED DEMO DATA — NOT FOR REAL-WORLD NAVIGATION.',
  31.2455000,
  75.7048000,
  '[
    {"floor_label": "Ground", "floor_number": 0, "name": "Ground Floor"}
  ]'::jsonb,
  TRUE
);

-- ----------------------------------------------------------------------------
-- 4. INSERT CANONICAL NODES
-- Node types: entrance, junction, ramp, lift, landmark, destination
-- Operational statuses: available, reported_unverified, blocked, unknown
-- Verification statuses: verified, unverified
-- ----------------------------------------------------------------------------

-- Outdoor Campus Waypoints & Thresholds
INSERT INTO nodes (id, building_id, node_code, name, node_type, floor_label, latitude, longitude, operational_status, landmark_description, verification_status, verified_at, verified_by, is_active) VALUES
(
  'n0000000-0000-0000-0000-000000000001',
  NULL,
  'NODE-OUTDOOR-PLAZA',
  'Central Plaza Fountain',
  'landmark',
  NULL,
  31.2465000,
  75.7028000,
  'available',
  'Round stone fountain with continuous water sound cue and tactile guidance pavers',
  'verified',
  NOW(),
  '00000000-0000-0000-0000-000000000001',
  TRUE
),
(
  'n0000000-0000-0000-0000-000000000002',
  NULL,
  'NODE-OUTDOOR-NORTH-JCT',
  'North Walkway Junction',
  'junction',
  NULL,
  31.2469000,
  75.7031000,
  'available',
  'Wide paved junction with high-contrast tactile ground paving leading toward Building B',
  'verified',
  NOW(),
  '00000000-0000-0000-0000-000000000001',
  TRUE
),
(
  'n0000000-0000-0000-0000-000000000003',
  NULL,
  'NODE-OUTDOOR-SOUTH-JCT',
  'South Garden Crossing',
  'junction',
  NULL,
  31.2457000,
  75.7038000,
  'available',
  'Level garden walkway intersection connecting Plaza to Building C',
  'verified',
  NOW(),
  '00000000-0000-0000-0000-000000000001',
  TRUE
);

-- Building A Nodes (Ground Floor)
INSERT INTO nodes (id, building_id, node_code, name, node_type, floor_label, latitude, longitude, operational_status, landmark_description, verification_status, verified_at, verified_by, is_active) VALUES
(
  'na000000-0000-0000-0000-000000000001',
  'b1000000-0000-0000-0000-000000000001',
  'NODE-BLDGA-ENTRANCE-MAIN',
  'Building A Main West Entrance',
  'entrance',
  'Ground',
  31.2461000,
  75.7018000,
  'available',
  'Automatic double sliding glass doors with audible proximity chime and tactile warning tiles',
  'verified',
  NOW(),
  '00000000-0000-0000-0000-000000000001',
  TRUE
),
(
  'na000000-0000-0000-0000-000000000002',
  'b1000000-0000-0000-0000-000000000001',
  'NODE-BLDGA-FOYER',
  'Building A Ground Foyer & Information Desk',
  'landmark',
  'Ground',
  31.2460000,
  75.7020000,
  'available',
  'Low-height information desk with hearing loop sign on immediate right',
  'verified',
  NOW(),
  '00000000-0000-0000-0000-000000000001',
  TRUE
),
(
  'na000000-0000-0000-0000-000000000003',
  'b1000000-0000-0000-0000-000000000001',
  'NODE-BLDGA-LIFT-G',
  'Building A Elevator Bank (Ground)',
  'lift',
  'Ground',
  31.2459000,
  75.7022000,
  'available',
  'Wheelchair-accessible elevator with raised braille buttons and spoken floor arrival announcements',
  'verified',
  NOW(),
  '00000000-0000-0000-0000-000000000001',
  TRUE
),
(
  'na000000-0000-0000-0000-000000000004',
  'b1000000-0000-0000-0000-000000000001',
  'NODE-BLDGA-STAIRS-G',
  'Building A Central Staircase (Ground)',
  'junction',
  'Ground',
  31.2459000,
  75.7021000,
  'available',
  'Central staircase base with textured warning strips and continuous dual handrails',
  'verified',
  NOW(),
  '00000000-0000-0000-0000-000000000001',
  TRUE
),
(
  'na000000-0000-0000-0000-000000000005',
  'b1000000-0000-0000-0000-000000000001',
  'NODE-BLDGA-RAMP-EAST',
  'Building A East Access Ramp',
  'ramp',
  'Ground',
  31.2462000,
  75.7025000,
  'available',
  'Gentle 1:16 slope concrete ramp with double handrails opening toward Central Plaza',
  'verified',
  NOW(),
  '00000000-0000-0000-0000-000000000001',
  TRUE
);

-- Building A Nodes (Floor 1)
INSERT INTO nodes (id, building_id, node_code, name, node_type, floor_label, latitude, longitude, operational_status, landmark_description, verification_status, verified_at, verified_by, is_active) VALUES
(
  'na100000-0000-0000-0000-000000000001',
  'b1000000-0000-0000-0000-000000000001',
  'NODE-BLDGA-LIFT-F1',
  'Building A Elevator Bank (Floor 1)',
  'lift',
  'Floor 1',
  31.2459000,
  75.7022000,
  'available',
  'First floor elevator landing with tactile directional floor markers',
  'verified',
  NOW(),
  '00000000-0000-0000-0000-000000000001',
  TRUE
),
(
  'na100000-0000-0000-0000-000000000002',
  'b1000000-0000-0000-0000-000000000001',
  'NODE-BLDGA-STAIRS-F1',
  'Building A Central Staircase (Floor 1)',
  'junction',
  'Floor 1',
  31.2459000,
  75.7021000,
  'available',
  'Top of central staircase landing with yellow non-slip warning strip',
  'verified',
  NOW(),
  '00000000-0000-0000-0000-000000000001',
  TRUE
),
(
  'na100000-0000-0000-0000-000000000003',
  'b1000000-0000-0000-0000-000000000001',
  'NODE-BLDGA-ROOM-101',
  'Lecture Hall A-101',
  'destination',
  'Floor 1',
  31.2460000,
  75.7020000,
  'available',
  'Primary lecture theater with 90cm wide step-free entrance and designated wheelchair seating area',
  'verified',
  NOW(),
  '00000000-0000-0000-0000-000000000001',
  TRUE
);

-- Building B Nodes (Ground & Floor 1)
INSERT INTO nodes (id, building_id, node_code, name, node_type, floor_label, latitude, longitude, operational_status, landmark_description, verification_status, verified_at, verified_by, is_active) VALUES
(
  'nb000000-0000-0000-0000-000000000001',
  'b2000000-0000-0000-0000-000000000002',
  'NODE-BLDGB-ENTRANCE-WEST',
  'Building B West Entrance',
  'entrance',
  'Ground',
  31.2470000,
  75.7032000,
  'available',
  'Step-free entrance with power-assist push plate',
  'verified',
  NOW(),
  '00000000-0000-0000-0000-000000000001',
  TRUE
),
(
  'nb000000-0000-0000-0000-000000000002',
  'b2000000-0000-0000-0000-000000000002',
  'NODE-BLDGB-LIFT-G',
  'Building B North Lift (Ground)',
  'lift',
  'Ground',
  31.2472000,
  75.7035000,
  'available',
  'Standard passenger lift with voice guidance',
  'verified',
  NOW(),
  '00000000-0000-0000-0000-000000000001',
  TRUE
),
(
  'nb100000-0000-0000-0000-000000000001',
  'b2000000-0000-0000-0000-000000000002',
  'NODE-BLDGB-LAB-201',
  'Robotics Lab B-201',
  'destination',
  'Floor 1',
  31.2473000,
  75.7036000,
  'available',
  'Robotics Laboratory with wide double doorway and tactile floor guide',
  'verified',
  NOW(),
  '00000000-0000-0000-0000-000000000001',
  TRUE
);

-- Building C Nodes
INSERT INTO nodes (id, building_id, node_code, name, node_type, floor_label, latitude, longitude, operational_status, landmark_description, verification_status, verified_at, verified_by, is_active) VALUES
(
  'nc000000-0000-0000-0000-000000000001',
  'b3000000-0000-0000-0000-000000000003',
  'NODE-BLDGC-ENTRANCE-NORTH',
  'Building C North Entrance',
  'entrance',
  'Ground',
  31.2457000,
  75.7045000,
  'available',
  'Step-free entrance with tactile indicator guidance path',
  'verified',
  NOW(),
  '00000000-0000-0000-0000-000000000001',
  TRUE
),
(
  'nc000000-0000-0000-0000-000000000002',
  'b3000000-0000-0000-0000-000000000003',
  'NODE-BLDGC-LIBRARY',
  'Central Accessible Library',
  'destination',
  'Ground',
  31.2455000,
  75.7048000,
  'available',
  'Student Library with adaptive technology reading stations and quiet acoustic environment',
  'verified',
  NOW(),
  '00000000-0000-0000-0000-000000000001',
  TRUE
);

-- ----------------------------------------------------------------------------
-- 5. INSERT CANONICAL EDGES
-- Must satisfy:
-- - distance_m > 0
-- - estimated_seconds > 0
-- - path_type <> 'stairs' OR stairs_count > 0
-- - from_node_id <> to_node_id
-- - wheelchair_accessible: true/false/null
-- Step-free criteria:
-- wheelchair_accessible IS TRUE AND stairs_count = 0 AND path_type != 'stairs'
-- AND operational_status = 'available' AND verification_status = 'verified'
-- ----------------------------------------------------------------------------

-- Outdoor Edges: Plaza <-> North Jct <-> South Jct
INSERT INTO edges (id, from_node_id, to_node_id, distance_m, estimated_seconds, path_type, stairs_count, slope_percent, clear_width_cm, wheelchair_accessible, tactile_guidance, verification_status, operational_status, landmark_instruction, verified_at, verified_by) VALUES
-- Plaza <-> North Walkway Junction
('e0000001-0000-0000-0000-000000000001', 'n0000000-0000-0000-0000-000000000001', 'n0000000-0000-0000-0000-000000000002', 45.0, 36, 'walkway', 0, 1.2, 240.0, TRUE, TRUE, 'verified', 'available', 'Walk northeast along the wide paved walkway toward North Junction. The sound of the fountain will recede behind you.', NOW(), '00000000-0000-0000-0000-000000000001'),
('e0000001-0000-0000-0000-000000000002', 'n0000000-0000-0000-0000-000000000002', 'n0000000-0000-0000-0000-000000000001', 45.0, 36, 'walkway', 0, 1.2, 240.0, TRUE, TRUE, 'verified', 'available', 'Walk southwest toward the fountain plaza. Follow the tactile pavers along the center of the walkway.', NOW(), '00000000-0000-0000-0000-000000000001'),

-- Plaza <-> South Garden Crossing
('e0000002-0000-0000-0000-000000000001', 'n0000000-0000-0000-0000-000000000001', 'n0000000-0000-0000-0000-000000000003', 55.0, 44, 'walkway', 0, 1.5, 200.0, TRUE, TRUE, 'verified', 'available', 'Head southeast past the floral garden beds along the smooth paved pathway toward Building C.', NOW(), '00000000-0000-0000-0000-000000000001'),
('e0000002-0000-0000-0000-000000000002', 'n0000000-0000-0000-0000-000000000003', 'n0000000-0000-0000-0000-000000000001', 55.0, 44, 'walkway', 0, 1.5, 200.0, TRUE, TRUE, 'verified', 'available', 'Head northwest toward the central plaza fountain, keeping the garden lawn on your left.', NOW(), '00000000-0000-0000-0000-000000000001'),

-- Plaza <-> Building A East Access Ramp
('e0000003-0000-0000-0000-000000000001', 'n0000000-0000-0000-0000-000000000001', 'na000000-0000-0000-0000-000000000005', 30.0, 24, 'walkway', 0, 1.0, 220.0, TRUE, TRUE, 'verified', 'available', 'Head west from the fountain toward Building A. Approach the East Ramp on your right.', NOW(), '00000000-0000-0000-0000-000000000001'),
('e0000003-0000-0000-0000-000000000002', 'na000000-0000-0000-0000-000000000005', 'n0000000-0000-0000-0000-000000000001', 30.0, 24, 'walkway', 0, 1.0, 220.0, TRUE, TRUE, 'verified', 'available', 'Descend the access ramp eastwards toward the Central Plaza fountain.', NOW(), '00000000-0000-0000-0000-000000000001'),

-- North Jct <-> Building B West Entrance
('e0000004-0000-0000-0000-000000000001', 'n0000000-0000-0000-0000-000000000002', 'nb000000-0000-0000-0000-000000000001', 25.0, 20, 'walkway', 0, 0.8, 200.0, TRUE, TRUE, 'verified', 'available', 'Walk 25 meters north directly to the power-assisted West Entrance doors of Building B.', NOW(), '00000000-0000-0000-0000-000000000001'),
('e0000004-0000-0000-0000-000000000002', 'nb000000-0000-0000-0000-000000000001', 'n0000000-0000-0000-0000-000000000002', 25.0, 20, 'walkway', 0, 0.8, 200.0, TRUE, TRUE, 'verified', 'available', 'Exit Building B and walk south to the North Walkway Junction.', NOW(), '00000000-0000-0000-0000-000000000001'),

-- South Jct <-> Building C North Entrance
('e0000005-0000-0000-0000-000000000001', 'n0000000-0000-0000-0000-000000000003', 'nc000000-0000-0000-0000-000000000001', 35.0, 28, 'walkway', 0, 1.0, 180.0, TRUE, TRUE, 'verified', 'available', 'Follow the tactile paving straight toward the North Entrance of Building C (Library).', NOW(), '00000000-0000-0000-0000-000000000001'),
('e0000005-0000-0000-0000-000000000002', 'nc000000-0000-0000-0000-000000000001', 'n0000000-0000-0000-0000-000000000003', 35.0, 28, 'walkway', 0, 1.0, 180.0, TRUE, TRUE, 'verified', 'available', 'Exit Building C North Entrance and proceed towards the South Garden crossing.', NOW(), '00000000-0000-0000-0000-000000000001');

-- Building A Indoor Edges: Ground Floor
INSERT INTO edges (id, from_node_id, to_node_id, distance_m, estimated_seconds, path_type, stairs_count, slope_percent, clear_width_cm, wheelchair_accessible, tactile_guidance, verification_status, operational_status, landmark_instruction, verified_at, verified_by) VALUES
-- Main Entrance <-> Foyer
('ea000001-0000-0000-0000-000000000001', 'na000000-0000-0000-0000-000000000001', 'na000000-0000-0000-0000-000000000002', 15.0, 12, 'corridor', 0, 0.0, 200.0, TRUE, TRUE, 'verified', 'available', 'Pass through automatic glass doors into the main foyer. Information desk is 15 meters straight ahead.', NOW(), '00000000-0000-0000-0000-000000000001'),
('ea000001-0000-0000-0000-000000000002', 'na000000-0000-0000-0000-000000000002', 'na000000-0000-0000-0000-000000000001', 15.0, 12, 'corridor', 0, 0.0, 200.0, TRUE, TRUE, 'verified', 'available', 'Walk straight towards the glass West Entrance doors.', NOW(), '00000000-0000-0000-0000-000000000001'),

-- Foyer <-> East Ramp
('ea000002-0000-0000-0000-000000000001', 'na000000-0000-0000-0000-000000000002', 'na000000-0000-0000-0000-000000000005', 20.0, 16, 'ramp', 0, 4.5, 180.0, TRUE, TRUE, 'verified', 'available', 'From the information desk, follow tactile pavers east down the ramp toward the courtyard exit.', NOW(), '00000000-0000-0000-0000-000000000001'),
('ea000002-0000-0000-0000-000000000002', 'na000000-0000-0000-0000-000000000005', 'na000000-0000-0000-0000-000000000002', 20.0, 16, 'ramp', 0, 4.5, 180.0, TRUE, TRUE, 'verified', 'available', 'Ascend the gentle east ramp into the main ground foyer.', NOW(), '00000000-0000-0000-0000-000000000001'),

-- Foyer <-> Lift Ground (Step-Free Option)
('ea000003-0000-0000-0000-000000000001', 'na000000-0000-0000-0000-000000000002', 'na000000-0000-0000-0000-000000000003', 12.0, 10, 'corridor', 0, 0.0, 180.0, TRUE, TRUE, 'verified', 'available', 'Turn left from the information desk and proceed 12 meters to the elevator lobby on your right.', NOW(), '00000000-0000-0000-0000-000000000001'),
('ea000003-0000-0000-0000-000000000002', 'na000000-0000-0000-0000-000000000003', 'na000000-0000-0000-0000-000000000002', 12.0, 10, 'corridor', 0, 0.0, 180.0, TRUE, TRUE, 'verified', 'available', 'Exit elevator lobby and proceed 12 meters to the main foyer.', NOW(), '00000000-0000-0000-0000-000000000001'),

-- Foyer <-> Stairs Ground (Non-step-free option)
('ea000004-0000-0000-0000-000000000001', 'na000000-0000-0000-0000-000000000002', 'na000000-0000-0000-0000-000000000004', 10.0, 8, 'corridor', 0, 0.0, 180.0, TRUE, FALSE, 'verified', 'available', 'Turn slightly right from the information desk toward the central staircase.', NOW(), '00000000-0000-0000-0000-000000000001'),
('ea000004-0000-0000-0000-000000000002', 'na000000-0000-0000-0000-000000000004', 'na000000-0000-0000-0000-000000000002', 10.0, 8, 'corridor', 0, 0.0, 180.0, TRUE, FALSE, 'verified', 'available', 'Walk from the bottom of the stairs to the main foyer.', NOW(), '00000000-0000-0000-0000-000000000001');

-- Vertical Transit: Ground <-> Floor 1
-- 1. Elevator Vertical Edge (Step-free: stairs_count=0, wheelchair_accessible=true)
INSERT INTO edges (id, from_node_id, to_node_id, distance_m, estimated_seconds, path_type, stairs_count, slope_percent, clear_width_cm, wheelchair_accessible, tactile_guidance, verification_status, operational_status, landmark_instruction, verified_at, verified_by) VALUES
('ea000010-0000-0000-0000-000000000001', 'na000000-0000-0000-0000-000000000003', 'na100000-0000-0000-0000-000000000001', 4.0, 20, 'lift', 0, 0.0, 120.0, TRUE, TRUE, 'verified', 'available', 'Enter elevator, press button 1 with raised braille marker. Exit on Floor 1.', NOW(), '00000000-0000-0000-0000-000000000001'),
('ea000010-0000-0000-0000-000000000002', 'na100000-0000-0000-0000-000000000001', 'na000000-0000-0000-0000-000000000003', 4.0, 20, 'lift', 0, 0.0, 120.0, TRUE, TRUE, 'verified', 'available', 'Enter elevator on Floor 1, press button G. Exit on Ground Floor.', NOW(), '00000000-0000-0000-0000-000000000001'),

-- 2. Stairs Vertical Edge (Fastest route option, NOT step-free: stairs_count=18, wheelchair_accessible=false)
('ea000011-0000-0000-0000-000000000001', 'na000000-0000-0000-0000-000000000004', 'na100000-0000-0000-0000-000000000002', 6.0, 12, 'stairs', 18, 35.0, 150.0, FALSE, FALSE, 'verified', 'available', 'Ascend 18 steps with handrail on right. Reach Floor 1 staircase landing.', NOW(), '00000000-0000-0000-0000-000000000001'),
('ea000011-0000-0000-0000-000000000002', 'na100000-0000-0000-0000-000000000002', 'na000000-0000-0000-0000-000000000004', 6.0, 10, 'stairs', 18, 35.0, 150.0, FALSE, FALSE, 'verified', 'available', 'Descend 18 steps with handrail on left to Ground Floor.', NOW(), '00000000-0000-0000-0000-000000000001');

-- Building A Floor 1 Edges: Lift / Stairs <-> Room 101
INSERT INTO edges (id, from_node_id, to_node_id, distance_m, estimated_seconds, path_type, stairs_count, slope_percent, clear_width_cm, wheelchair_accessible, tactile_guidance, verification_status, operational_status, landmark_instruction, verified_at, verified_by) VALUES
-- Lift F1 <-> Room 101
('ea000020-0000-0000-0000-000000000001', 'na100000-0000-0000-0000-000000000001', 'na100000-0000-0000-0000-000000000003', 14.0, 11, 'corridor', 0, 0.0, 180.0, TRUE, TRUE, 'verified', 'available', 'Exit elevator, turn right and proceed 14 meters down the corridor. Lecture Hall A-101 is on your left.', NOW(), '00000000-0000-0000-0000-000000000001'),
('ea000020-0000-0000-0000-000000000002', 'na100000-0000-0000-0000-000000000003', 'na100000-0000-0000-0000-000000000001', 14.0, 11, 'corridor', 0, 0.0, 180.0, TRUE, TRUE, 'verified', 'available', 'Exit Lecture Hall A-101, turn right and walk 14 meters to the elevator lobby.', NOW(), '00000000-0000-0000-0000-000000000001'),

-- Stairs F1 <-> Room 101
('ea000021-0000-0000-0000-000000000001', 'na100000-0000-0000-0000-000000000002', 'na100000-0000-0000-0000-000000000003', 10.0, 8, 'corridor', 0, 0.0, 180.0, TRUE, FALSE, 'verified', 'available', 'From stairs landing, walk 10 meters straight ahead to Lecture Hall A-101.', NOW(), '00000000-0000-0000-0000-000000000001'),
('ea000021-0000-0000-0000-000000000002', 'na100000-0000-0000-0000-000000000003', 'na100000-0000-0000-0000-000000000002', 10.0, 8, 'corridor', 0, 0.0, 180.0, TRUE, FALSE, 'verified', 'available', 'From Lecture Hall A-101, walk 10 meters to the central staircase landing.', NOW(), '00000000-0000-0000-0000-000000000001');

-- Building B Indoor Edges
INSERT INTO edges (id, from_node_id, to_node_id, distance_m, estimated_seconds, path_type, stairs_count, slope_percent, clear_width_cm, wheelchair_accessible, tactile_guidance, verification_status, operational_status, landmark_instruction, verified_at, verified_by) VALUES
('eb000001-0000-0000-0000-000000000001', 'nb000000-0000-0000-0000-000000000001', 'nb000000-0000-0000-0000-000000000002', 18.0, 14, 'corridor', 0, 0.0, 180.0, TRUE, TRUE, 'verified', 'available', 'Proceed straight through the entrance foyer 18 meters to the North Lift.', NOW(), '00000000-0000-0000-0000-000000000001'),
('eb000001-0000-0000-0000-000000000002', 'nb000000-0000-0000-0000-000000000002', 'nb000000-0000-0000-0000-000000000001', 18.0, 14, 'corridor', 0, 0.0, 180.0, TRUE, TRUE, 'verified', 'available', 'Walk from the North Lift 18 meters to the West Entrance doors.', NOW(), '00000000-0000-0000-0000-000000000001');

-- Building C Indoor Edges
INSERT INTO edges (id, from_node_id, to_node_id, distance_m, estimated_seconds, path_type, stairs_count, slope_percent, clear_width_cm, wheelchair_accessible, tactile_guidance, verification_status, operational_status, landmark_instruction, verified_at, verified_by) VALUES
('ec000001-0000-0000-0000-000000000001', 'nc000000-0000-0000-0000-000000000001', 'nc000000-0000-0000-0000-000000000002', 12.0, 10, 'corridor', 0, 0.0, 200.0, TRUE, TRUE, 'verified', 'available', 'Pass through North Entrance, follow tactile guidance tile path 12 meters into Accessible Library.', NOW(), '00000000-0000-0000-0000-000000000001'),
('ec000001-0000-0000-0000-000000000002', 'nc000000-0000-0000-0000-000000000002', 'nc000000-0000-0000-0000-000000000001', 12.0, 10, 'corridor', 0, 0.0, 200.0, TRUE, TRUE, 'verified', 'available', 'Exit library and follow path 12 meters to North Entrance.', NOW(), '00000000-0000-0000-0000-000000000001');

-- ----------------------------------------------------------------------------
-- 6. INSERT SEED ACCESSIBILITY REPORT & AUDIT LOG
-- Demonstration report: temporary obstruction on building B path
-- ----------------------------------------------------------------------------
INSERT INTO accessibility_reports (
  id,
  target_type,
  target_id,
  issue_type,
  description,
  photo_url,
  status,
  reporter_user_id,
  reviewed_by,
  reviewed_at,
  resolution_note
) VALUES (
  'r0000000-0000-0000-0000-000000000001',
  'edge',
  'eb000001-0000-0000-0000-000000000001',
  'path_obstruction',
  'Temporary maintenance ladder partially obstructing corridor clearance width.',
  NULL,
  'pending_review',
  '00000000-0000-0000-0000-000000000002',
  NULL,
  NULL,
  NULL
);

INSERT INTO report_audit_log (
  id,
  report_id,
  reviewer_user_id,
  action,
  previous_asset_status,
  new_asset_status,
  note
) VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'r0000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  'submitted',
  'available',
  'reported_unverified',
  'Student submitted crowdsourced accessibility report on corridor path.'
);
