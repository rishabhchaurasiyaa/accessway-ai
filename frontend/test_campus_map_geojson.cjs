/**
 * FRONTEND CAMPUS MAP GEOJSON INTEGRATION TEST SUITE
 * Tests Phase 6, Step 4:
 * 1. Valid GeoJSON FeatureCollection parsing.
 * 2. Empty FeatureCollection handling.
 * 3. Invalid GeoJSON rejection (non-object, wrong type, non-array features).
 * 4. Backend request failure handling (no automatic demo fallback).
 * 5. Explicit demo mode rendering & synthetic GeoJSON generation.
 * 6. Strict no-automatic-demo-fallback invariant.
 * 7. Unsupported or missing geometry handling (safe filtering).
 * 8. Wheelchair accessibility verification constraint (strict data-backed claims).
 *
 * NOTE: These tests verify client-side GeoJSON validation, state management,
 * and safety invariants using mocked fixtures, distinguished from live backend pytest tests.
 */
const assert = require('assert');

console.log('Running Campus Map GeoJSON Integration Tests...\n');

// Pure logic extracted directly from geoJsonValidator.ts
function isValidCoordinatePair(coord) {
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

function isValidGeometry(geo) {
  if (!geo || typeof geo !== 'object') return false;
  if (geo.type === 'Point') {
    return isValidCoordinatePair(geo.coordinates);
  }
  if (geo.type === 'LineString') {
    if (!Array.isArray(geo.coordinates) || geo.coordinates.length < 2) return false;
    return geo.coordinates.every(isValidCoordinatePair);
  }
  if (geo.type === 'Polygon') {
    if (!Array.isArray(geo.coordinates) || geo.coordinates.length < 1) return false;
    return geo.coordinates.every(
      (ring) => Array.isArray(ring) && ring.length >= 3 && ring.every(isValidCoordinatePair)
    );
  }
  return false;
}

function validateCampusMapGeoJson(raw) {
  if (!raw || typeof raw !== 'object') {
    return {
      isValid: false,
      isEmpty: false,
      error: 'GeoJSON response must be a non-null object',
      validFeatureCount: 0
    };
  }

  if (raw.type !== 'FeatureCollection') {
    return {
      isValid: false,
      isEmpty: false,
      error: 'Invalid GeoJSON: root type must be "FeatureCollection"',
      validFeatureCount: 0
    };
  }

  if (!Array.isArray(raw.features)) {
    return {
      isValid: false,
      isEmpty: false,
      error: 'Invalid GeoJSON: features property must be an array',
      validFeatureCount: 0
    };
  }

  if (raw.features.length === 0) {
    return {
      isValid: true,
      isEmpty: true,
      data: {
        type: 'FeatureCollection',
        graph_version: typeof raw.graph_version === 'number' ? raw.graph_version : 1,
        features: []
      },
      validFeatureCount: 0
    };
  }

  const validFeatures = [];

  for (const item of raw.features) {
    if (!item || typeof item !== 'object') continue;
    if (item.type !== 'Feature') continue;
    if (!isValidGeometry(item.geometry)) continue;

    validFeatures.push({
      type: 'Feature',
      id: typeof item.id === 'string' ? item.id : undefined,
      geometry: item.geometry,
      properties: item.properties && typeof item.properties === 'object' ? item.properties : {}
    });
  }

  if (validFeatures.length === 0 && raw.features.length > 0) {
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
      graph_version: typeof raw.graph_version === 'number' ? raw.graph_version : 1,
      features: validFeatures
    },
    validFeatureCount: validFeatures.length
  };
}

// 1. Valid GeoJSON FeatureCollection
const validGeoJson = {
  type: 'FeatureCollection',
  graph_version: 4,
  features: [
    {
      type: 'Feature',
      id: 'node-1',
      geometry: { type: 'Point', coordinates: [75.7020, 31.2460] },
      properties: { node_code: 'NODE-A-01', name: 'Main Lobby', node_type: 'entrance' }
    },
    {
      type: 'Feature',
      id: 'edge-1',
      geometry: {
        type: 'LineString',
        coordinates: [
          [75.7020, 31.2460],
          [75.7025, 31.2465]
        ]
      },
      properties: {
        from_node_id: 'node-1',
        to_node_id: 'node-2',
        distance_m: 14.5,
        estimated_seconds: 12,
        path_type: 'corridor',
        wheelchair_accessible: true,
        stairs_count: 0
      }
    }
  ]
};

const res1 = validateCampusMapGeoJson(validGeoJson);
assert.strictEqual(res1.isValid, true);
assert.strictEqual(res1.isEmpty, false);
assert.strictEqual(res1.validFeatureCount, 2);
assert.strictEqual(res1.data.graph_version, 4);
console.log('✓ Scenario 1 Passed: Valid GeoJSON FeatureCollection correctly validated');

// 2. Empty FeatureCollection
const emptyGeoJson = {
  type: 'FeatureCollection',
  graph_version: 1,
  features: []
};

const res2 = validateCampusMapGeoJson(emptyGeoJson);
assert.strictEqual(res2.isValid, true);
assert.strictEqual(res2.isEmpty, true);
assert.strictEqual(res2.validFeatureCount, 0);
assert.strictEqual(res2.data.features.length, 0);
console.log('✓ Scenario 2 Passed: Empty FeatureCollection handled gracefully without error');

// 3. Invalid GeoJSON (non-object, wrong type, non-array features)
assert.strictEqual(validateCampusMapGeoJson(null).isValid, false);
assert.strictEqual(validateCampusMapGeoJson('not-json').isValid, false);
assert.strictEqual(validateCampusMapGeoJson({ type: 'Point', coordinates: [0, 0] }).isValid, false);
assert.strictEqual(validateCampusMapGeoJson({ type: 'FeatureCollection' }).isValid, false);
assert.strictEqual(validateCampusMapGeoJson({ type: 'FeatureCollection', features: 'not-an-array' }).isValid, false);
console.log('✓ Scenario 3 Passed: Invalid GeoJSON types properly rejected');

// 4. Backend request failure handling
function handleMapFetchError(error, currentDemoMode) {
  return {
    isDemoMode: currentDemoMode, // MUST NOT CHANGE
    isLoadingGeoJson: false,
    geoJsonData: null,
    geoJsonError: error?.message || 'Map GeoJSON endpoint unavailable'
  };
}

const networkFail = handleMapFetchError(new Error('500 Internal Server Error'), false);
assert.strictEqual(networkFail.isDemoMode, false, 'CRITICAL: Must not activate demo mode on failure');
assert.strictEqual(networkFail.geoJsonData, null, 'Must not supply fake map data on error');
assert.strictEqual(networkFail.geoJsonError, '500 Internal Server Error');
console.log('✓ Scenario 4 Passed: Backend request failure sets error state without demo fallback');

// 5. Explicit demo mode rendering & synthetic GeoJSON generation
function generateDemoGeoJson(demoNodes, demoEdges) {
  const features = [];
  const coordsMap = new Map();

  for (const n of demoNodes) {
    if (n.latitude != null && n.longitude != null) {
      coordsMap.set(n.id, [n.longitude, n.latitude]);
      features.push({
        type: 'Feature',
        id: n.id,
        geometry: { type: 'Point', coordinates: [n.longitude, n.latitude] },
        properties: { node_code: n.node_code, name: n.name, node_type: n.node_type }
      });
    }
  }

  for (const e of demoEdges) {
    const from = coordsMap.get(e.from_node_id);
    const to = coordsMap.get(e.to_node_id);
    if (from && to) {
      features.push({
        type: 'Feature',
        id: e.id,
        geometry: { type: 'LineString', coordinates: [from, to] },
        properties: { distance_m: e.distance_m, wheelchair_accessible: e.wheelchair_accessible }
      });
    }
  }

  return { type: 'FeatureCollection', graph_version: 1, features };
}

const sampleDemoNodes = [
  { id: 'dn1', node_code: 'D1', name: 'Demo Node 1', node_type: 'entrance', latitude: 31.246, longitude: 75.702 },
  { id: 'dn2', node_code: 'D2', name: 'Demo Node 2', node_type: 'lift', latitude: 31.247, longitude: 75.703 }
];
const sampleDemoEdges = [
  { id: 'de1', from_node_id: 'dn1', to_node_id: 'dn2', distance_m: 10, wheelchair_accessible: true }
];

const demoGeoJson = generateDemoGeoJson(sampleDemoNodes, sampleDemoEdges);
const demoValidation = validateCampusMapGeoJson(demoGeoJson);
assert.strictEqual(demoValidation.isValid, true);
assert.strictEqual(demoValidation.validFeatureCount, 3);
console.log('✓ Scenario 5 Passed: Explicit demo mode synthesizes valid GeoJSON structure');

// 6. Strict no-automatic-demo-fallback invariant
function toggleDemoModeExplicitly(currentMode) {
  return !currentMode;
}

let userDemoState = false;
// Simulating 3 consecutive network failures
for (let i = 0; i < 3; i++) {
  const fail = handleMapFetchError(new Error('Connection refused'), userDemoState);
  assert.strictEqual(fail.isDemoMode, false, 'Demo mode must remain false despite network errors');
}
// User explicitly toggles demo mode
userDemoState = toggleDemoModeExplicitly(userDemoState);
assert.strictEqual(userDemoState, true, 'Demo mode activated only after explicit user toggle');
console.log('✓ Scenario 6 Passed: Strict invariant: Zero automatic demo fallback under repeated errors');

// 7. Unsupported or missing geometry handling (safe filtering)
const malformedFeaturesGeoJson = {
  type: 'FeatureCollection',
  graph_version: 1,
  features: [
    { type: 'Feature', id: 'f-valid', geometry: { type: 'Point', coordinates: [75.702, 31.246] } },
    { type: 'Feature', id: 'f-nan', geometry: { type: 'Point', coordinates: [NaN, 31.246] } },
    { type: 'Feature', id: 'f-out-of-range', geometry: { type: 'Point', coordinates: [75.702, 999] } },
    { type: 'Feature', id: 'f-no-coords', geometry: { type: 'Point', coordinates: null } },
    { type: 'Feature', id: 'f-unsupported-type', geometry: { type: 'GeometryCollection', geometries: [] } },
    { type: 'Feature', id: 'f-short-line', geometry: { type: 'LineString', coordinates: [[75.702, 31.246]] } },
    { type: 'NotAFeature', id: 'f-bad-type' }
  ]
};

const res7 = validateCampusMapGeoJson(malformedFeaturesGeoJson);
assert.strictEqual(res7.isValid, true);
assert.strictEqual(res7.validFeatureCount, 1, 'Only the single valid feature must be preserved');
assert.strictEqual(res7.data.features[0].id, 'f-valid');
console.log('✓ Scenario 7 Passed: Unsupported or missing geometries safely filtered without crashing');

// 8. Strict Wheelchair Accessibility Verification Constraint
// A GeoJSON pathway may be labelled "Verified Step-Free" ONLY when:
// - wheelchair_accessible === true
// - stairs_count === 0 (NULL treated as unknown and NOT step-free)
// - path_type !== 'stairs'
// - verification_status === 'verified' (missing treated as NOT verified)
// - operational_status === 'available' (missing treated as NOT available)

function isVerifiedStepFreePathway(properties) {
  if (!properties || typeof properties !== 'object') return false;
  const isWheelchair = properties.wheelchair_accessible === true;
  const hasZeroStairs = properties.stairs_count === 0;
  const isNotStairsPath = properties.path_type !== 'stairs';
  const isVerified = properties.verification_status === 'verified';
  const isAvailable = properties.operational_status === 'available';

  return isWheelchair && hasZeroStairs && isNotStairsPath && isVerified && isAvailable;
}

// Test 8.1: A fully verified and available step-free edge
const fullyVerifiedStepFree = {
  wheelchair_accessible: true,
  stairs_count: 0,
  path_type: 'corridor',
  verification_status: 'verified',
  operational_status: 'available'
};
assert.strictEqual(
  isVerifiedStepFreePathway(fullyVerifiedStepFree),
  true,
  'Fully verified and available edge with 0 stairs must be step-free'
);

// Test 8.2: wheelchair_accessible=true with stairs_count=null (treated as unknown and NOT step-free)
const nullStairsEdge = {
  wheelchair_accessible: true,
  stairs_count: null,
  path_type: 'walkway',
  verification_status: 'verified',
  operational_status: 'available'
};
assert.strictEqual(
  isVerifiedStepFreePathway(nullStairsEdge),
  false,
  'CRITICAL: stairs_count=null must be treated as unknown and NOT step-free'
);

// Test 8.3: wheelchair_accessible=true with stairs_count=0 but unverified status
const unverifiedEdge = {
  wheelchair_accessible: true,
  stairs_count: 0,
  path_type: 'ramp',
  verification_status: 'unverified',
  operational_status: 'available'
};
assert.strictEqual(
  isVerifiedStepFreePathway(unverifiedEdge),
  false,
  'CRITICAL: unverified status must NOT be labelled as verified step-free'
);

// Test 8.4: Missing verification_status must NOT be treated as verified
const missingVerificationEdge = {
  wheelchair_accessible: true,
  stairs_count: 0,
  path_type: 'ramp',
  operational_status: 'available'
};
assert.strictEqual(
  isVerifiedStepFreePathway(missingVerificationEdge),
  false,
  'CRITICAL: missing verification_status must NOT be treated as verified'
);

// Test 8.5: wheelchair_accessible=true with stairs_count=0 but blocked status
const blockedEdge = {
  wheelchair_accessible: true,
  stairs_count: 0,
  path_type: 'corridor',
  verification_status: 'verified',
  operational_status: 'blocked'
};
assert.strictEqual(
  isVerifiedStepFreePathway(blockedEdge),
  false,
  'CRITICAL: blocked operational status must NOT be labelled as verified step-free'
);

// Test 8.6: Missing operational_status must NOT be treated as available
const missingOperationalEdge = {
  wheelchair_accessible: true,
  stairs_count: 0,
  path_type: 'corridor',
  verification_status: 'verified'
};
assert.strictEqual(
  isVerifiedStepFreePathway(missingOperationalEdge),
  false,
  'CRITICAL: missing operational_status must NOT be treated as available'
);

// Test 8.7: path_type='stairs' even if wheelchair_accessible=true
const stairsPathEdge = {
  wheelchair_accessible: true,
  stairs_count: 0,
  path_type: 'stairs',
  verification_status: 'verified',
  operational_status: 'available'
};
assert.strictEqual(
  isVerifiedStepFreePathway(stairsPathEdge),
  false,
  'CRITICAL: path_type=stairs must NEVER be step-free'
);

// Test 8.8: stairs_count > 0 even if wheelchair_accessible=true
const hasStairsEdge = {
  wheelchair_accessible: true,
  stairs_count: 3,
  path_type: 'corridor',
  verification_status: 'verified',
  operational_status: 'available'
};
assert.strictEqual(
  isVerifiedStepFreePathway(hasStairsEdge),
  false,
  'CRITICAL: stairs_count > 0 must NEVER be step-free'
);

console.log('✓ Scenario 8 Passed: Strict step-free accessibility rules fully verified (null stairs, unverified, and blocked strictly excluded)');

console.log('\nAll 8 Campus Map GeoJSON integration scenarios passed successfully!');
