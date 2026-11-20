-- ============================================================================
-- ACCESSWAY AI — CANONICAL DATABASE SCHEMA
-- Source of Truth: ACCESSWAY_AI_M9_Project_Documentation.docx & ACCESSWAY_AI_database_schema.sql
-- Code Fuzion 2026 — Official Problem Statement M9
-- Compatible with Supabase PostgreSQL 15+
-- NOTICE: SIMULATED DEMO DATA — NOT FOR REAL-WORLD NAVIGATION
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. BUILDINGS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS buildings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_code VARCHAR(24) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  description TEXT,
  centroid_lat NUMERIC(10,7),
  centroid_lng NUMERIC(10,7),
  floors JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (centroid_lat IS NULL OR centroid_lat BETWEEN -90 AND 90),
  CHECK (centroid_lng IS NULL OR centroid_lng BETWEEN -180 AND 180)
);

-- ----------------------------------------------------------------------------
-- 2. PROFILES TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  user_id UUID PRIMARY KEY,
  display_name VARCHAR(120),
  role VARCHAR(16) NOT NULL DEFAULT 'user'
    CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 3. NODES TABLE (Waypoints, Thresholds, Vertical Transit & Landmarks)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID REFERENCES buildings(id) ON DELETE SET NULL,
  node_code VARCHAR(48) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  node_type VARCHAR(24) NOT NULL CHECK (node_type IN
    ('entrance','junction','ramp','lift','landmark','destination')),
  floor_label VARCHAR(32),
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  operational_status VARCHAR(24) NOT NULL DEFAULT 'unknown'
    CHECK (operational_status IN ('available','reported_unverified','blocked','unknown')),
  landmark_description TEXT,
  verification_status VARCHAR(20) NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('verified','unverified')),
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
);

-- ----------------------------------------------------------------------------
-- 4. EDGES TABLE (Navigable Paths & Obstacle Rules)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  to_node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  distance_m NUMERIC(8,2) NOT NULL CHECK (distance_m > 0),
  estimated_seconds INTEGER NOT NULL CHECK (estimated_seconds > 0),
  path_type VARCHAR(24) NOT NULL CHECK (path_type IN
    ('corridor','walkway','ramp','lift','stairs','crossing','other')),
  stairs_count INTEGER NOT NULL DEFAULT 0 CHECK (stairs_count >= 0),
  slope_percent NUMERIC(5,2),
  clear_width_cm NUMERIC(6,2),
  wheelchair_accessible BOOLEAN,
  tactile_guidance BOOLEAN,
  verification_status VARCHAR(20) NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('verified','unverified')),
  operational_status VARCHAR(24) NOT NULL DEFAULT 'unknown'
    CHECK (operational_status IN ('available','reported_unverified','blocked','unknown')),
  landmark_instruction TEXT,
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (from_node_id, to_node_id),
  CHECK (from_node_id <> to_node_id),
  CHECK (path_type <> 'stairs' OR stairs_count > 0)
);

-- ----------------------------------------------------------------------------
-- 5. ACCESSIBILITY REPORTS TABLE (Crowdsourced Accessibility Hazard Reports)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS accessibility_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type VARCHAR(12) NOT NULL CHECK (target_type IN ('node','edge')),
  target_id UUID NOT NULL,
  issue_type VARCHAR(32) NOT NULL CHECK (issue_type IN
    ('broken_lift','blocked_ramp','path_obstruction','incorrect_data','other')),
  description TEXT NOT NULL CHECK (char_length(description) BETWEEN 3 AND 2000),
  photo_url TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review','verified','rejected')),
  reporter_user_id UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  reviewed_by UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  resolution_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 6. ROUTE SESSIONS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS route_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  origin_node_id UUID NOT NULL REFERENCES nodes(id),
  destination_node_id UUID NOT NULL REFERENCES nodes(id),
  route_mode VARCHAR(16) NOT NULL CHECK (route_mode IN ('fastest','step_free')),
  graph_version BIGINT NOT NULL,
  distance_m NUMERIC(9,2),
  estimated_seconds INTEGER,
  route_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 7. CAMPUS GRAPH STATE TABLE (Graph Version Singleton)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS campus_graph_state (
  id SMALLINT PRIMARY KEY CHECK (id = 1),
  graph_version BIGINT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO campus_graph_state (id, graph_version)
VALUES (1, 1) ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 8. REPORT AUDIT LOG TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS report_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES accessibility_reports(id) ON DELETE CASCADE,
  reviewer_user_id UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  action VARCHAR(24) NOT NULL CHECK (action IN ('submitted','verified','rejected','reopened')),
  previous_asset_status VARCHAR(24),
  new_asset_status VARCHAR(24),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- PERFORMANCE INDEXES
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_nodes_building ON nodes(building_id);
CREATE INDEX IF NOT EXISTS idx_nodes_status ON nodes(operational_status, is_active);
CREATE INDEX IF NOT EXISTS idx_edges_from ON edges(from_node_id);
CREATE INDEX IF NOT EXISTS idx_edges_to ON edges(to_node_id);
CREATE INDEX IF NOT EXISTS idx_edges_route_filter ON edges
  (verification_status, operational_status, wheelchair_accessible, estimated_seconds);
CREATE INDEX IF NOT EXISTS idx_reports_status ON accessibility_reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_target ON accessibility_reports(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_route_sessions_created ON route_sessions(created_at DESC);

-- ----------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS)
-- Safe default: app data is accessed through the FastAPI server with service-role key.
-- Direct client access is governed by restrictive policies below.
-- ----------------------------------------------------------------------------
ALTER TABLE buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE accessibility_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE campus_graph_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_audit_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    -- Public read access for navigation infrastructure
    DROP POLICY IF EXISTS "Public can view active buildings" ON buildings;
    CREATE POLICY "Public can view active buildings" ON buildings
      FOR SELECT USING (is_active = TRUE);

    DROP POLICY IF EXISTS "Public can view active nodes" ON nodes;
    CREATE POLICY "Public can view active nodes" ON nodes
      FOR SELECT USING (is_active = TRUE);

    DROP POLICY IF EXISTS "Public can view edges" ON edges;
    CREATE POLICY "Public can view edges" ON edges
      FOR SELECT USING (TRUE);

    DROP POLICY IF EXISTS "Public can view graph state" ON campus_graph_state;
    CREATE POLICY "Public can view graph state" ON campus_graph_state
      FOR SELECT USING (TRUE);

    -- Profiles: Users can view their own profile, admins can view all
    DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
    CREATE POLICY "Users can view own profile" ON profiles
      FOR SELECT USING (auth.uid() = user_id OR auth.jwt() ->> 'role' = 'admin');

    -- Accessibility Reports: Public can view verified reports
    DROP POLICY IF EXISTS "Public can view verified reports" ON accessibility_reports;
    CREATE POLICY "Public can view verified reports" ON accessibility_reports
      FOR SELECT USING (status = 'verified');

    -- Accessibility Reports: Users/public can submit reports
    DROP POLICY IF EXISTS "Public can submit accessibility reports" ON accessibility_reports;
    CREATE POLICY "Public can submit accessibility reports" ON accessibility_reports
      FOR INSERT WITH CHECK (status = 'pending_review');

    -- Route Sessions: Users can create and view sessions
    DROP POLICY IF EXISTS "Public can insert route sessions" ON route_sessions;
    CREATE POLICY "Public can insert route sessions" ON route_sessions
      FOR INSERT WITH CHECK (TRUE);

    DROP POLICY IF EXISTS "Users can view own route sessions" ON route_sessions;
    CREATE POLICY "Users can view own route sessions" ON route_sessions
      FOR SELECT USING (user_id IS NULL OR auth.uid() = user_id);

    -- Audit Logs: Admin / Service role read-only
    DROP POLICY IF EXISTS "Admin view audit logs" ON report_audit_log;
    CREATE POLICY "Admin view audit logs" ON report_audit_log
      FOR SELECT USING (auth.jwt() ->> 'role' = 'admin' OR auth.role() = 'service_role');
END $$;
