export type NodeType =
  | 'entrance'
  | 'junction'
  | 'ramp'
  | 'lift'
  | 'landmark'
  | 'destination';

export type OperationalStatus = 'available' | 'reported_unverified' | 'blocked' | 'unknown';
export type VerificationStatus = 'verified' | 'unverified';

export interface FloorInfo {
  floor_label: string;
  floor_number: number;
  name: string;
}

export interface CampusBuilding {
  id: string;
  building_code: string;
  name: string;
  description?: string | null;
  centroid_lat?: number | null;
  centroid_lng?: number | null;
  floors: FloorInfo[];
  is_active: boolean;
}

export interface CampusNode {
  id: string;
  building_id?: string | null;
  node_code: string;
  name: string;
  node_type: NodeType;
  floor_label?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  operational_status: OperationalStatus;
  landmark_description?: string | null;
  verification_status: VerificationStatus;
  is_active: boolean;
}

export type PathType =
  | 'corridor'
  | 'walkway'
  | 'ramp'
  | 'lift'
  | 'stairs'
  | 'crossing'
  | 'other';

export interface CampusEdge {
  id: string;
  from_node_id: string;
  to_node_id: string;
  distance_m: number;
  estimated_seconds: number;
  path_type: PathType;
  stairs_count: number;
  slope_percent?: number | null;
  clear_width_cm?: number | null;
  wheelchair_accessible: boolean;
  tactile_guidance: boolean;
  verification_status: VerificationStatus;
  operational_status: OperationalStatus;
  landmark_instruction?: string | null;
}

export interface GeoJsonPointGeometry {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

export interface GeoJsonLineStringGeometry {
  type: 'LineString';
  coordinates: [number, number][]; // [[longitude, latitude], ...]
}

export interface GeoJsonPolygonGeometry {
  type: 'Polygon';
  coordinates: [number, number][][]; // [[[longitude, latitude], ...]]
}

export type GeoJsonGeometry =
  | GeoJsonPointGeometry
  | GeoJsonLineStringGeometry
  | GeoJsonPolygonGeometry;

export interface GeoJsonFeatureProperties {
  node_code?: string;
  name?: string;
  node_type?: NodeType | string;
  floor_label?: string | null;
  operational_status?: OperationalStatus | string;
  verification_status?: VerificationStatus | string;
  landmark_description?: string | null;
  from_node_id?: string;
  to_node_id?: string;
  distance_m?: number;
  estimated_seconds?: number;
  path_type?: PathType | string;
  wheelchair_accessible?: boolean;
  stairs_count?: number | null;
  building_code?: string;
  description?: string;
  [key: string]: unknown;
}

export interface CampusMapFeature {
  type: 'Feature';
  id?: string;
  geometry: GeoJsonGeometry;
  properties: GeoJsonFeatureProperties;
}

export interface CampusMapGeoJson {
  type: 'FeatureCollection';
  graph_version: number;
  features: CampusMapFeature[];
}

