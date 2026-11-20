-- ============================================================================
-- ACCESSWAY AI — Migration 001: Initial Schema
-- Description: Creates core tables, foreign keys, and domain check constraints.
-- Source of Truth: docs/DATABASE_DESIGN.md
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. BUILDINGS TABLE
CREATE TABLE IF NOT EXISTS public.buildings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,
    description TEXT,
    center_lat DOUBLE PRECISION NOT NULL,
    center_lng DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. FLOORS TABLE
CREATE TABLE IF NOT EXISTS public.floors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    building_id UUID NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
    floor_number INT NOT NULL,
    floor_name VARCHAR(50) NOT NULL,
    svg_asset_path VARCHAR(255) NOT NULL,
    bounds_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (building_id, floor_number)
);

-- 3. NODES TABLE (Campus Waypoints & Landmarks)
CREATE TABLE IF NOT EXISTS public.nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    building_id UUID REFERENCES public.buildings(id) ON DELETE SET NULL,
    floor_id UUID REFERENCES public.floors(id) ON DELETE SET NULL,
    floor_number INT DEFAULT 0,
    name VARCHAR(150) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    node_type VARCHAR(30) NOT NULL CHECK (
        node_type IN ('entrance', 'room', 'lift', 'stairs', 'ramp', 'junction', 'landmark', 'restroom')
    ),
    is_landmark BOOLEAN NOT NULL DEFAULT FALSE,
    landmark_description TEXT,
    tactile_paving BOOLEAN NOT NULL DEFAULT FALSE,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    svg_x DOUBLE PRECISION,
    svg_y DOUBLE PRECISION,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. EDGES TABLE (Paths & Transitions)
CREATE TABLE IF NOT EXISTS public.edges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_node_id UUID NOT NULL REFERENCES public.nodes(id) ON DELETE CASCADE,
    target_node_id UUID NOT NULL REFERENCES public.nodes(id) ON DELETE CASCADE,
    distance_meters DOUBLE PRECISION NOT NULL CHECK (distance_meters > 0),
    edge_type VARCHAR(30) NOT NULL CHECK (
        edge_type IN ('corridor', 'outdoor_path', 'ramp', 'lift', 'stairs', 'door')
    ),
    slope_percentage DOUBLE PRECISION NOT NULL DEFAULT 0.0 CHECK (slope_percentage >= 0.0),
    width_meters DOUBLE PRECISION NOT NULL DEFAULT 1.2 CHECK (width_meters > 0.0),
    is_stairs BOOLEAN NOT NULL DEFAULT FALSE,
    is_lift BOOLEAN NOT NULL DEFAULT FALSE,
    is_ramp BOOLEAN NOT NULL DEFAULT FALSE,
    surface_type VARCHAR(30) NOT NULL CHECK (
        surface_type IN ('smooth_tile', 'paved_concrete', 'asphalt', 'cobblestone', 'gravel')
    ),
    verified_accessible BOOLEAN NOT NULL DEFAULT FALSE,
    blocked_by_incident_id UUID,
    direction_cue TEXT NOT NULL,
    landmark_cue TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. INCIDENTS TABLE (Accessibility Hazard Reports)
CREATE TABLE IF NOT EXISTS public.incidents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_id UUID REFERENCES public.nodes(id) ON DELETE SET NULL,
    edge_id UUID REFERENCES public.edges(id) ON DELETE SET NULL,
    building_id UUID REFERENCES public.buildings(id) ON DELETE SET NULL,
    floor_number INT,
    category VARCHAR(50) NOT NULL CHECK (
        category IN ('broken_lift', 'blocked_ramp', 'slippery_surface', 'construction_obstacle', 'door_inaccessible', 'other')
    ),
    title VARCHAR(150) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (
        status IN ('PENDING', 'VERIFIED', 'RESOLVED', 'REJECTED')
    ),
    reported_by VARCHAR(100) DEFAULT 'Anonymous Student',
    verified_by VARCHAR(100),
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Foreign key for blocked incident on edges
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_edges_blocked_incident'
    ) THEN
        ALTER TABLE public.edges
        ADD CONSTRAINT fk_edges_blocked_incident
        FOREIGN KEY (blocked_by_incident_id) REFERENCES public.incidents(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 6. INCIDENT AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.incident_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    incident_id UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
    previous_status VARCHAR(20) NOT NULL,
    new_status VARCHAR(20) NOT NULL,
    changed_by VARCHAR(100) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
