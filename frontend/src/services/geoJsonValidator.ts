import { CampusMapGeoJson, CampusMapFeature, GeoJsonGeometry } from '@/types/campus';

export interface GeoJsonValidationResult {
  isValid: boolean;
  isEmpty: boolean;
  error?: string;
  data?: CampusMapGeoJson;
  validFeatureCount: number;
}

/**
 * Validates a single coordinate pair [longitude, latitude].
 * Longitude must be within [-180, 180] and Latitude within [-90, 90].
 */
function isValidCoordinatePair(coord: unknown): coord is [number, number] {
  if (!Array.isArray(coord) || coord.length < 2) return false;
  const lng = coord[0];
  const lat = coord[1];
  return (
    typeof lng === 'number' &&
    Number.isFinite(lng) &&
    lng >= -180 &&
    lng <= 180 &&
    typeof lat === 'number' &&
    Number.isFinite(lat) &&
    lat >= -90 &&
    lat <= 90
  );
}

/**
 * Validates supported GeoJSON geometry types: Point, LineString, Polygon.
 */
function isValidGeometry(geo: unknown): geo is GeoJsonGeometry {
  if (!geo || typeof geo !== 'object') return false;
  const g = geo as { type?: unknown; coordinates?: unknown };

  if (g.type === 'Point') {
    return isValidCoordinatePair(g.coordinates);
  }

  if (g.type === 'LineString') {
    if (!Array.isArray(g.coordinates) || g.coordinates.length < 2) return false;
    return g.coordinates.every(isValidCoordinatePair);
  }

  if (g.type === 'Polygon') {
    if (!Array.isArray(g.coordinates) || g.coordinates.length < 1) return false;
    // Each linear ring must have at least 3 coordinate pairs
    return g.coordinates.every(
      (ring) => Array.isArray(ring) && ring.length >= 3 && ring.every(isValidCoordinatePair)
    );
  }

  return false;
}

/**
 * Validates an incoming GeoJSON FeatureCollection against strict geometry and structure rules.
 * Safely filters out malformed individual features while preserving valid ones.
 * Rejects non-FeatureCollection structures, non-array feature lists, or completely invalid collections.
 */
export function validateCampusMapGeoJson(raw: unknown): GeoJsonValidationResult {
  if (!raw || typeof raw !== 'object') {
    return {
      isValid: false,
      isEmpty: false,
      error: 'GeoJSON response must be a non-null object',
      validFeatureCount: 0
    };
  }

  const candidate = raw as {
    type?: unknown;
    graph_version?: unknown;
    features?: unknown;
  };

  if (candidate.type !== 'FeatureCollection') {
    return {
      isValid: false,
      isEmpty: false,
      error: 'Invalid GeoJSON: root type must be "FeatureCollection"',
      validFeatureCount: 0
    };
  }

  if (!Array.isArray(candidate.features)) {
    return {
      isValid: false,
      isEmpty: false,
      error: 'Invalid GeoJSON: features property must be an array',
      validFeatureCount: 0
    };
  }

  const rawFeatures = candidate.features;

  if (rawFeatures.length === 0) {
    return {
      isValid: true,
      isEmpty: true,
      data: {
        type: 'FeatureCollection',
        graph_version: typeof candidate.graph_version === 'number' ? candidate.graph_version : 1,
        features: []
      },
      validFeatureCount: 0
    };
  }

  const validFeatures: CampusMapFeature[] = [];

  for (const item of rawFeatures) {
    if (!item || typeof item !== 'object') continue;
    const feat = item as {
      type?: unknown;
      id?: unknown;
      geometry?: unknown;
      properties?: unknown;
    };

    if (feat.type !== 'Feature') continue;
    if (!isValidGeometry(feat.geometry)) continue;

    validFeatures.push({
      type: 'Feature',
      id: typeof feat.id === 'string' ? feat.id : undefined,
      geometry: feat.geometry,
      properties:
        feat.properties && typeof feat.properties === 'object'
          ? (feat.properties as Record<string, unknown>)
          : {}
    });
  }

  // If features array was non-empty but zero features were valid, reject as malformed
  if (validFeatures.length === 0 && rawFeatures.length > 0) {
    return {
      isValid: false,
      isEmpty: false,
      error: 'Invalid GeoJSON: all features contained invalid, malformed, or missing coordinates',
      validFeatureCount: 0
    };
  }

  return {
    isValid: true,
    isEmpty: false,
    data: {
      type: 'FeatureCollection',
      graph_version: typeof candidate.graph_version === 'number' ? candidate.graph_version : 1,
      features: validFeatures
    },
    validFeatureCount: validFeatures.length
  };
}

/**
 * Strict Step-Free Accessibility Rule:
 * A GeoJSON pathway may be labelled "Verified Step-Free" ONLY when:
 * 1. wheelchair_accessible === true
 * 2. stairs_count === 0 (NULL or missing stairs_count must be treated as unknown and NOT step-free)
 * 3. path_type !== 'stairs'
 * 4. verification_status === 'verified' (missing must NOT be treated as verified)
 * 5. operational_status === 'available' (missing must NOT be treated as available)
 */
export function isVerifiedStepFreePathway(properties: unknown): boolean {
  if (!properties || typeof properties !== 'object') return false;
  const props = properties as Record<string, unknown>;

  const isWheelchair = props.wheelchair_accessible === true;
  const hasZeroStairs = props.stairs_count === 0;
  const isNotStairsPath = props.path_type !== 'stairs';
  const isVerified = props.verification_status === 'verified';
  const isAvailable = props.operational_status === 'available';

  return isWheelchair && hasZeroStairs && isNotStairsPath && isVerified && isAvailable;
}

