export type NavigationMode = 'fastest' | 'step_free';

export interface RouteProfilesInput {
  fastest?: boolean;
  step_free?: boolean;
  visual_guidance?: boolean;
  require_verified_paths?: boolean;
}

export interface RouteCalculateRequest {
  start_node_id: string;
  destination_node_id: string;
  profiles?: RouteProfilesInput;
}

export interface RouteStep {
  step: number;
  instruction: string;
  landmark?: string | null;
  speech_text: string;
}

export interface RouteResult {
  available: boolean;
  reason?: string | null;
  distance_m?: number | null;
  estimated_seconds?: number | null;
  node_ids?: string[] | null;
  edge_ids?: string[] | null;
  steps?: RouteStep[] | null;
  stairs_count?: number;
  ramps_count?: number;
  lifts_count?: number;
}

export interface RouteCalculateResponse {
  graph_version: number;
  routes: {
    fastest?: RouteResult;
    step_free?: RouteResult;
    [key: string]: RouteResult | undefined;
  };
}

export interface GraphVersionResponse {
  graph_version: number;
  updated_at: string;
}

