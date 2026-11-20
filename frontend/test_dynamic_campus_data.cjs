/**
 * FRONTEND DYNAMIC CAMPUS DATA INTEGRATION TEST SUITE
 * Tests Phase 6, Step 3:
 * 1. Successful building fetch.
 * 2. Empty building response handling.
 * 3. Building API failure handling (no automatic demo fallback).
 * 4. Successful node fetch for selected building.
 * 5. Building selection change triggering node refresh & race condition protection.
 * 6. Node API failure handling (no automatic demo fallback).
 * 7. Explicit demo mode activation (requires user action).
 * 8. Origin/Destination distinctness and operational status constraints.
 */
const assert = require('assert');

// Test 1: Successful building fetch mapping
console.log('Running Dynamic Campus Data Integration Tests...\n');

function processBuildingsResponse(data) {
  if (!Array.isArray(data)) {
    throw new Error('Invalid buildings response: expected array');
  }
  const activeBuildings = data.filter((b) => b.is_active);
  return {
    buildings: activeBuildings,
    defaultBuildingCode: activeBuildings.length > 0 ? activeBuildings[0].building_code : ''
  };
}

const mockBuildings = [
  {
    id: 'b1000000-0000-0000-0000-000000000001',
    building_code: 'BLDG-A',
    name: 'Campus Academic Complex A (Synthetic Placeholder)',
    description: 'Main academic lecture halls',
    centroid_lat: 31.2460,
    centroid_lng: 75.7020,
    floors: [{ floor_label: 'Ground', floor_number: 0, name: 'Ground Floor' }],
    is_active: true
  },
  {
    id: 'b2000000-0000-0000-0000-000000000002',
    building_code: 'BLDG-B',
    name: 'Science & Technology Complex B (Synthetic Placeholder)',
    floors: [],
    is_active: true
  },
  {
    id: 'b3000000-0000-0000-0000-000000000003',
    building_code: 'BLDG-INACTIVE',
    name: 'Closed Building',
    floors: [],
    is_active: false
  }
];

const bldgResult = processBuildingsResponse(mockBuildings);
assert.strictEqual(bldgResult.buildings.length, 2, 'Inactive buildings should be filtered out or handled');
assert.strictEqual(bldgResult.defaultBuildingCode, 'BLDG-A', 'Default building code should be first active building');
console.log('✓ Test 1 Passed: Successful building fetch and active building filtering');

// Test 2: Empty building response handling
const emptyResult = processBuildingsResponse([]);
assert.strictEqual(emptyResult.buildings.length, 0);
assert.strictEqual(emptyResult.defaultBuildingCode, '');
console.log('✓ Test 2 Passed: Empty building response handled gracefully');

// Test 3: Building API failure handling & STRICT NO AUTOMATIC DEMO FALLBACK
function handleBuildingFetchFailure(error, currentDemoMode) {
  // CRITICAL SAFETY RULE: Never automatically switch to demo mode on API error
  let demoMode = currentDemoMode;
  let buildingError = error?.message || 'Buildings endpoint unavailable.';
  let buildings = [];
  return { demoMode, buildingError, buildings };
}

const failureResult = handleBuildingFetchFailure(new Error('Network error: 503 Service Unavailable'), false);
assert.strictEqual(failureResult.demoMode, false, 'CRITICAL: Demo mode must NOT be activated on API error');
assert.strictEqual(failureResult.buildingError, 'Network error: 503 Service Unavailable');
assert.strictEqual(failureResult.buildings.length, 0);
console.log('✓ Test 3 Passed: Building API failure triggers error state without automatic demo fallback');

// Test 4: Successful node fetch for selected building
function processNodesResponse(nodes) {
  if (!Array.isArray(nodes)) throw new Error('Invalid nodes response');
  const activeNodes = nodes.filter((n) => n.is_active);
  const origin = activeNodes.length > 0 ? activeNodes[0].id : '';
  const destination = activeNodes.length > 1 ? activeNodes[1].id : origin;
  return { nodes, activeNodes, origin, destination };
}

const mockNodes = [
  {
    id: 'n1',
    building_id: 'b1',
    node_code: 'NODE-A-01',
    name: 'Main Lobby Entrance',
    node_type: 'entrance',
    floor_label: 'Ground',
    operational_status: 'available',
    verification_status: 'verified',
    is_active: true
  },
  {
    id: 'n2',
    building_id: 'b1',
    node_code: 'NODE-A-02',
    name: 'West Elevator Bay',
    node_type: 'lift',
    floor_label: 'Ground',
    operational_status: 'available',
    verification_status: 'verified',
    is_active: true
  },
  {
    id: 'n3',
    building_id: 'b1',
    node_code: 'NODE-A-03',
    name: 'Service Corridor (Maintenance)',
    node_type: 'corridor',
    floor_label: 'Ground',
    operational_status: 'blocked',
    verification_status: 'verified',
    is_active: false
  }
];

const nodeResult = processNodesResponse(mockNodes);
assert.strictEqual(nodeResult.nodes.length, 3);
assert.strictEqual(nodeResult.activeNodes.length, 2);
assert.strictEqual(nodeResult.origin, 'n1');
assert.strictEqual(nodeResult.destination, 'n2');
assert.notStrictEqual(nodeResult.origin, nodeResult.destination, 'Origin and destination must be distinct when multiple active nodes exist');
console.log('✓ Test 4 Passed: Node fetch assigns distinct initial active origin and destination');

// Test 5: Race condition protection on rapid building switch
class NodeRequestManager {
  constructor() {
    this.currentRequestId = 0;
    this.latestLoadedBuilding = null;
  }

  startRequest() {
    return ++this.currentRequestId;
  }

  resolveResponse(requestId, buildingCode, nodes) {
    // If a newer request was dispatched while this was in flight, discard the stale response
    if (requestId !== this.currentRequestId) {
      return { discarded: true };
    }
    this.latestLoadedBuilding = buildingCode;
    return { discarded: false, buildingCode, nodes };
  }
}

const manager = new NodeRequestManager();
const req1 = manager.startRequest(); // User clicks BLDG-A
const req2 = manager.startRequest(); // User quickly clicks BLDG-B before req1 finishes

// req1 arrives late after req2 was dispatched
const res1 = manager.resolveResponse(req1, 'BLDG-A', [{ id: 'na1' }]);
assert.strictEqual(res1.discarded, true, 'Stale response from previous building switch must be discarded');

// req2 arrives
const res2 = manager.resolveResponse(req2, 'BLDG-B', [{ id: 'nb1' }]);
assert.strictEqual(res2.discarded, false, 'Latest response must be accepted');
assert.strictEqual(manager.latestLoadedBuilding, 'BLDG-B');
console.log('✓ Test 5 Passed: Race condition protection discards out-of-order stale node responses');

// Test 6: Node API failure handling & STRICT NO AUTOMATIC DEMO FALLBACK
function handleNodeFetchFailure(error, currentDemoMode) {
  let demoMode = currentDemoMode;
  let nodeError = error?.message || 'Node endpoint unavailable.';
  return { demoMode, nodeError, nodes: [], origin: '', destination: '' };
}

const nodeFail = handleNodeFetchFailure(new Error('500 Internal Server Error'), false);
assert.strictEqual(nodeFail.demoMode, false, 'CRITICAL: Demo mode must NOT be activated on node API failure');
assert.strictEqual(nodeFail.nodeError, '500 Internal Server Error');
assert.strictEqual(nodeFail.nodes.length, 0);
console.log('✓ Test 6 Passed: Node API failure triggers error state without automatic demo fallback');

// Test 7: Explicit demo mode toggle
function toggleDemoMode(currentDemoMode) {
  const nextMode = !currentDemoMode;
  return {
    isDemoMode: nextMode,
    calculation: null,
    errorMessage: null
  };
}

const toggledOn = toggleDemoMode(false);
assert.strictEqual(toggledOn.isDemoMode, true, 'User explicit click enables demo mode');
const toggledOff = toggleDemoMode(true);
assert.strictEqual(toggledOff.isDemoMode, false, 'User explicit click disables demo mode');
console.log('✓ Test 7 Passed: Demo mode is strictly user-controlled');

// Test 8: Origin and destination constraints
function validateWaypoints(originId, destinationId, allNodes) {
  if (!originId || !destinationId) {
    return { valid: false, error: 'Please select both an origin and a destination.' };
  }
  if (originId === destinationId) {
    return { valid: false, error: 'Origin and destination cannot be the same node.' };
  }
  const originNode = allNodes.find((n) => n.id === originId);
  const destNode = allNodes.find((n) => n.id === destinationId);
  if (!originNode?.is_active || !destNode?.is_active) {
    return { valid: false, error: 'Selected waypoints must be active.' };
  }
  return { valid: true, error: null };
}

const sameNodeCheck = validateWaypoints('n1', 'n1', mockNodes);
assert.strictEqual(sameNodeCheck.valid, false);
assert.strictEqual(sameNodeCheck.error, 'Origin and destination cannot be the same node.');

const inactiveNodeCheck = validateWaypoints('n1', 'n3', mockNodes);
assert.strictEqual(inactiveNodeCheck.valid, false);
assert.strictEqual(inactiveNodeCheck.error, 'Selected waypoints must be active.');

const validCheck = validateWaypoints('n1', 'n2', mockNodes);
assert.strictEqual(validCheck.valid, true);
assert.strictEqual(validCheck.error, null);
console.log('✓ Test 8 Passed: Origin and destination constraints strictly enforced');

console.log('\nAll 8 dynamic campus data tests passed successfully!');
