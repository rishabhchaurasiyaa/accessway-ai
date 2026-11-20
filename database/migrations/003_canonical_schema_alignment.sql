-- ============================================================================
-- ACCESSWAY AI — Migration 003: Canonical Database Schema Alignment
-- Primary Source of Truth: ACCESSWAY_AI_M9_Project_Documentation.docx & ACCESSWAY_AI_database_schema.sql
-- Description: Migrates prior exploratory tables to the 8 canonical entities.
-- Preserves existing data where compatible, adds new canonical tables, and ensures zero data loss.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. PROFILES TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  user_id UUID PRIMARY KEY,
  display_name VARCHAR(120),
  role VARCHAR(16) NOT NULL DEFAULT 'user'
    CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 2. BUILDINGS TABLE (Canonical alignment)
-- ----------------------------------------------------------------------------
-- Add new columns if migrating from previous schema
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'buildings' AND table_schema = 'public') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'buildings' AND column_name = 'building_code') THEN
      ALTER TABLE public.buildings ADD COLUMN building_code VARCHAR(24);
      -- Migrate code to building_code if it existed
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'buildings' AND column_name = 'code') THEN
        UPDATE public.buildings SET building_code = code WHERE building_code IS NULL;
      END IF;
      ALTER TABLE public.buildings ALTER COLUMN building_code SET NOT NULL;
      ALTER TABLE public.buildings ADD CONSTRAINT uq_buildings_building_code UNIQUE (building_code);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'buildings' AND column_name = 'centroid_lat') THEN
      ALTER TABLE public.buildings ADD COLUMN centroid_lat NUMERIC(10,7);
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'buildings' AND column_name = 'center_lat') THEN
        UPDATE public.buildings SET centroid_lat = center_lat::NUMERIC(10,7) WHERE centroid_lat IS NULL;
      END IF;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'buildings' AND column_name = 'centroid_lng') THEN
      ALTER TABLE public.buildings ADD COLUMN centroid_lng NUMERIC(10,7);
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'buildings' AND column_name = 'center_lng') THEN
        UPDATE public.buildings SET centroid_lng = center_lng::NUMERIC(10,7) WHERE centroid_lng IS NULL;
      END IF;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'buildings' AND column_name = 'floors') THEN
      ALTER TABLE public.buildings ADD COLUMN floors JSONB NOT NULL DEFAULT '[]'::jsonb;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'buildings' AND column_name = 'is_active') THEN
      ALTER TABLE public.buildings ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;
    END IF;
  ELSE
    CREATE TABLE public.buildings (
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
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 3. NODES TABLE (Canonical alignment)
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'nodes' AND table_schema = 'public') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'nodes' AND column_name = 'node_code') THEN
      ALTER TABLE public.nodes ADD COLUMN node_code VARCHAR(48);
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'nodes' AND column_name = 'code') THEN
        UPDATE public.nodes SET node_code = code WHERE node_code IS NULL;
      END IF;
      ALTER TABLE public.nodes ALTER COLUMN node_code SET NOT NULL;
      ALTER TABLE public.nodes ADD CONSTRAINT uq_nodes_node_code UNIQUE (node_code);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'nodes' AND column_name = 'floor_label') THEN
      ALTER TABLE public.nodes ADD COLUMN floor_label VARCHAR(32);
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'nodes' AND column_name = 'floor_number') THEN
        UPDATE public.nodes SET floor_label = 'Floor ' || floor_number WHERE floor_label IS NULL;
      END IF;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'nodes' AND column_name = 'latitude') THEN
      ALTER TABLE public.nodes ADD COLUMN latitude NUMERIC(10,7);
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'nodes' AND column_name = 'lat') THEN
        UPDATE public.nodes SET latitude = lat::NUMERIC(10,7) WHERE latitude IS NULL;
      END IF;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'nodes' AND column_name = 'longitude') THEN
      ALTER TABLE public.nodes ADD COLUMN longitude NUMERIC(10,7);
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'nodes' AND column_name = 'lng') THEN
        UPDATE public.nodes SET longitude = lng::NUMERIC(10,7) WHERE longitude IS NULL;
      END IF;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'nodes' AND column_name = 'operational_status') THEN
      ALTER TABLE public.nodes ADD COLUMN operational_status VARCHAR(24) NOT NULL DEFAULT 'available'
        CHECK (operational_status IN ('available','reported_unverified','blocked','unknown'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'nodes' AND column_name = 'verification_status') THEN
      ALTER TABLE public.nodes ADD COLUMN verification_status VARCHAR(20) NOT NULL DEFAULT 'verified'
        CHECK (verification_status IN ('verified','unverified'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'nodes' AND column_name = 'verified_at') THEN
      ALTER TABLE public.nodes ADD COLUMN verified_at TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'nodes' AND column_name = 'verified_by') THEN
      ALTER TABLE public.nodes ADD COLUMN verified_by UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'nodes' AND column_name = 'is_active') THEN
      ALTER TABLE public.nodes ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;
    END IF;
  ELSE
    CREATE TABLE public.nodes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      building_id UUID REFERENCES public.buildings(id) ON DELETE SET NULL,
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
      verified_by UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
      CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
    );
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 4. EDGES TABLE (Canonical alignment)
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'edges' AND table_schema = 'public') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edges' AND column_name = 'from_node_id') THEN
      ALTER TABLE public.edges ADD COLUMN from_node_id UUID REFERENCES public.nodes(id) ON DELETE CASCADE;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edges' AND column_name = 'source_node_id') THEN
        UPDATE public.edges SET from_node_id = source_node_id WHERE from_node_id IS NULL;
      END IF;
      ALTER TABLE public.edges ALTER COLUMN from_node_id SET NOT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edges' AND column_name = 'to_node_id') THEN
      ALTER TABLE public.edges ADD COLUMN to_node_id UUID REFERENCES public.nodes(id) ON DELETE CASCADE;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edges' AND column_name = 'target_node_id') THEN
        UPDATE public.edges SET to_node_id = target_node_id WHERE to_node_id IS NULL;
      END IF;
      ALTER TABLE public.edges ALTER COLUMN to_node_id SET NOT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edges' AND column_name = 'distance_m') THEN
      ALTER TABLE public.edges ADD COLUMN distance_m NUMERIC(8,2);
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edges' AND column_name = 'distance_meters') THEN
        UPDATE public.edges SET distance_m = distance_meters::NUMERIC(8,2) WHERE distance_m IS NULL;
      END IF;
      ALTER TABLE public.edges ALTER COLUMN distance_m SET NOT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edges' AND column_name = 'estimated_seconds') THEN
      ALTER TABLE public.edges ADD COLUMN estimated_seconds INTEGER;
      -- default traversal speed approx 1.2 m/s -> round(distance / 1.2)
      UPDATE public.edges SET estimated_seconds = GREATEST(1, ROUND(distance_m / 1.2)::INTEGER) WHERE estimated_seconds IS NULL;
      ALTER TABLE public.edges ALTER COLUMN estimated_seconds SET NOT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edges' AND column_name = 'path_type') THEN
      ALTER TABLE public.edges ADD COLUMN path_type VARCHAR(24) DEFAULT 'walkway';
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edges' AND column_name = 'edge_type') THEN
        UPDATE public.edges SET path_type = CASE
          WHEN edge_type IN ('corridor','walkway','ramp','lift','stairs') THEN edge_type
          ELSE 'other'
        END WHERE path_type IS NULL;
      END IF;
      ALTER TABLE public.edges ALTER COLUMN path_type SET NOT NULL;
      ALTER TABLE public.edges ADD CONSTRAINT chk_edges_path_type CHECK (path_type IN
        ('corridor','walkway','ramp','lift','stairs','crossing','other'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edges' AND column_name = 'stairs_count') THEN
      ALTER TABLE public.edges ADD COLUMN stairs_count INTEGER NOT NULL DEFAULT 0 CHECK (stairs_count >= 0);
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edges' AND column_name = 'is_stairs') THEN
        UPDATE public.edges SET stairs_count = CASE WHEN is_stairs THEN 18 ELSE 0 END;
      END IF;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edges' AND column_name = 'slope_percent') THEN
      ALTER TABLE public.edges ADD COLUMN slope_percent NUMERIC(5,2);
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edges' AND column_name = 'slope_percentage') THEN
        UPDATE public.edges SET slope_percent = slope_percentage::NUMERIC(5,2) WHERE slope_percent IS NULL;
      END IF;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edges' AND column_name = 'clear_width_cm') THEN
      ALTER TABLE public.edges ADD COLUMN clear_width_cm NUMERIC(6,2);
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edges' AND column_name = 'width_meters') THEN
        UPDATE public.edges SET clear_width_cm = (width_meters * 100)::NUMERIC(6,2) WHERE clear_width_cm IS NULL;
      END IF;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edges' AND column_name = 'wheelchair_accessible') THEN
      ALTER TABLE public.edges ADD COLUMN wheelchair_accessible BOOLEAN;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edges' AND column_name = 'verified_accessible') THEN
        UPDATE public.edges SET wheelchair_accessible = verified_accessible WHERE wheelchair_accessible IS NULL;
      END IF;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edges' AND column_name = 'tactile_guidance') THEN
      ALTER TABLE public.edges ADD COLUMN tactile_guidance BOOLEAN;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edges' AND column_name = 'operational_status') THEN
      ALTER TABLE public.edges ADD COLUMN operational_status VARCHAR(24) NOT NULL DEFAULT 'available'
        CHECK (operational_status IN ('available','reported_unverified','blocked','unknown'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edges' AND column_name = 'landmark_instruction') THEN
      ALTER TABLE public.edges ADD COLUMN landmark_instruction TEXT;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edges' AND column_name = 'direction_cue') THEN
        UPDATE public.edges SET landmark_instruction = direction_cue WHERE landmark_instruction IS NULL;
      END IF;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edges' AND column_name = 'verified_at') THEN
      ALTER TABLE public.edges ADD COLUMN verified_at TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edges' AND column_name = 'verified_by') THEN
      ALTER TABLE public.edges ADD COLUMN verified_by UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL;
    END IF;
  ELSE
    CREATE TABLE public.edges (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      from_node_id UUID NOT NULL REFERENCES public.nodes(id) ON DELETE CASCADE,
      to_node_id UUID NOT NULL REFERENCES public.nodes(id) ON DELETE CASCADE,
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
      verified_by UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (from_node_id, to_node_id),
      CHECK (from_node_id <> to_node_id),
      CHECK (path_type <> 'stairs' OR stairs_count > 0)
    );
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 5. ACCESSIBILITY_REPORTS TABLE (Replacing incidents)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.accessibility_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type VARCHAR(12) NOT NULL CHECK (target_type IN ('node','edge')),
  target_id UUID NOT NULL,
  issue_type VARCHAR(32) NOT NULL CHECK (issue_type IN
    ('broken_lift','blocked_ramp','path_obstruction','incorrect_data','other')),
  description TEXT NOT NULL CHECK (char_length(description) BETWEEN 3 AND 2000),
  photo_url TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review','verified','rejected')),
  reporter_user_id UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  reviewed_by UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  resolution_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migrate old incidents to accessibility_reports if incidents exists
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'incidents' AND table_schema = 'public') THEN
    INSERT INTO public.accessibility_reports (id, target_type, target_id, issue_type, description, status, resolution_note, created_at, updated_at)
    SELECT
      id,
      CASE WHEN node_id IS NOT NULL THEN 'node' ELSE 'edge' END,
      COALESCE(node_id, edge_id, id),
      CASE
        WHEN category IN ('broken_lift','blocked_ramp') THEN category
        ELSE 'path_obstruction'
      END,
      description,
      CASE
        WHEN status = 'PENDING' THEN 'pending_review'
        WHEN status = 'VERIFIED' THEN 'verified'
        WHEN status = 'REJECTED' THEN 'rejected'
        ELSE 'pending_review'
      END,
      title,
      created_at,
      updated_at
    FROM public.incidents
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 6. ROUTE_SESSIONS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.route_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  origin_node_id UUID NOT NULL REFERENCES public.nodes(id),
  destination_node_id UUID NOT NULL REFERENCES public.nodes(id),
  route_mode VARCHAR(16) NOT NULL CHECK (route_mode IN ('fastest','step_free')),
  graph_version BIGINT NOT NULL,
  distance_m NUMERIC(9,2),
  estimated_seconds INTEGER,
  route_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 7. CAMPUS_GRAPH_STATE TABLE (Singleton cache invalidation)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.campus_graph_state (
  id SMALLINT PRIMARY KEY CHECK (id = 1),
  graph_version BIGINT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO public.campus_graph_state (id, graph_version)
VALUES (1, 1) ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 8. REPORT_AUDIT_LOG TABLE (Replacing incident_audit_logs)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.report_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.accessibility_reports(id) ON DELETE CASCADE,
  reviewer_user_id UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  action VARCHAR(24) NOT NULL CHECK (action IN ('submitted','verified','rejected','reopened')),
  previous_asset_status VARCHAR(24),
  new_asset_status VARCHAR(24),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- INDEXES & ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_nodes_building ON public.nodes(building_id);
CREATE INDEX IF NOT EXISTS idx_nodes_status ON public.nodes(operational_status, is_active);
CREATE INDEX IF NOT EXISTS idx_edges_from ON public.edges(from_node_id);
CREATE INDEX IF NOT EXISTS idx_edges_to ON public.edges(to_node_id);
CREATE INDEX IF NOT EXISTS idx_edges_route_filter ON public.edges
  (verification_status, operational_status, wheelchair_accessible, estimated_seconds);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.accessibility_reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_target ON public.accessibility_reports(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_route_sessions_created ON public.route_sessions(created_at DESC);

-- Enable RLS across all 8 tables
ALTER TABLE public.buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accessibility_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campus_graph_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_audit_log ENABLE ROW LEVEL SECURITY;
