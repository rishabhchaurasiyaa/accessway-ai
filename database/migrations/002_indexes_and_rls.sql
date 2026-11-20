-- ============================================================================
-- ACCESSWAY AI — Migration 002: Indexes, RLS Policies, and Audit Automation
-- Description: Sets up lookup indexes, Row Level Security policies, and audit triggers.
-- Source of Truth: docs/DATABASE_DESIGN.md
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. PERFORMANCE INDEXES
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_edges_source_target ON public.edges(source_node_id, target_node_id);
CREATE INDEX IF NOT EXISTS idx_edges_accessible_status ON public.edges(verified_accessible, is_stairs, blocked_by_incident_id);
CREATE INDEX IF NOT EXISTS idx_nodes_building_floor ON public.nodes(building_id, floor_number);
CREATE INDEX IF NOT EXISTS idx_nodes_is_landmark ON public.nodes(is_landmark) WHERE is_landmark IS TRUE;
CREATE INDEX IF NOT EXISTS idx_incidents_status ON public.incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_node_edge ON public.incidents(node_id, edge_id);
CREATE INDEX IF NOT EXISTS idx_audit_incident ON public.incident_audit_logs(incident_id);

-- ----------------------------------------------------------------------------
-- 2. ENABLE ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------
ALTER TABLE public.buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.floors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_audit_logs ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 3. RLS POLICIES FOR PUBLIC AND ADMIN ROLES
-- ----------------------------------------------------------------------------
DO $$ BEGIN
    -- Buildings, floors, nodes, edges: Public read-only
    DROP POLICY IF EXISTS "Public can view buildings" ON public.buildings;
    CREATE POLICY "Public can view buildings" ON public.buildings FOR SELECT USING (true);
    
    DROP POLICY IF EXISTS "Public can view floors" ON public.floors;
    CREATE POLICY "Public can view floors" ON public.floors FOR SELECT USING (true);
    
    DROP POLICY IF EXISTS "Public can view nodes" ON public.nodes;
    CREATE POLICY "Public can view nodes" ON public.nodes FOR SELECT USING (true);
    
    DROP POLICY IF EXISTS "Public can view edges" ON public.edges;
    CREATE POLICY "Public can view edges" ON public.edges FOR SELECT USING (true);

    -- Incidents: Public can only view VERIFIED and RESOLVED issues
    DROP POLICY IF EXISTS "Public can view verified incidents" ON public.incidents;
    CREATE POLICY "Public can view verified incidents" ON public.incidents
    FOR SELECT USING (status IN ('VERIFIED', 'RESOLVED'));

    -- Incidents: Public can submit new reports, but status MUST be 'PENDING'
    DROP POLICY IF EXISTS "Public can submit pending incidents" ON public.incidents;
    CREATE POLICY "Public can submit pending incidents" ON public.incidents
    FOR INSERT WITH CHECK (status = 'PENDING');

    -- Admin / Service Role: Full access on incidents and edges
    DROP POLICY IF EXISTS "Admin full access on incidents" ON public.incidents;
    CREATE POLICY "Admin full access on incidents" ON public.incidents
    FOR ALL USING (auth.role() = 'service_role' OR auth.jwt() ->> 'role' = 'admin');

    DROP POLICY IF EXISTS "Admin full access on edges" ON public.edges;
    CREATE POLICY "Admin full access on edges" ON public.edges
    FOR ALL USING (auth.role() = 'service_role' OR auth.jwt() ->> 'role' = 'admin');

    -- Audit logs: Read-only for authenticated admins / service role
    DROP POLICY IF EXISTS "Admin read audit logs" ON public.incident_audit_logs;
    CREATE POLICY "Admin read audit logs" ON public.incident_audit_logs
    FOR SELECT USING (auth.role() = 'service_role' OR auth.jwt() ->> 'role' = 'admin');
END $$;
