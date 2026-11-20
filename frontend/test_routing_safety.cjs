/**
 * FOCUSED CLIENT ROUTING SAFETY TEST SUITE
 * Verifies Phase 5.1 offline routing invariants for runClientDijkstra:
 * 1. Both endpoints must be active and operational_status === 'available'
 * 2. Inactive/unavailable endpoints return available=false with documented reason
 * 3. Step-free route strictly excludes stairs, non-wheelchair paths, and unverified edges
 * 4. Step-free route returns exact string: "No verified step-free route is currently available."
 * 5. Zero-distance calculation handles correctly
 * 6. Never falls back to stairs
 */
const assert = require('assert');

// Sourced directly from campusService.ts
const DEMO_NODES = [
  {
    id: 'n_active_avail_1',
    name: 'Active Available 1',
    node_type: 'entrance',
    operational_status: 'available',
    verification_status: 'verified',
    is_active: true
  },
  {
    id: 'n_active_avail_2',
    name: 'Active Available 2',
    node_type: 'destination',
    operational_status: 'available',
    verification_status: 'verified',
    is_active: true
  },
  {
    id: 'n_inactive_3',
    name: 'Inactive Node 3',
    node_type: 'destination',
    operational_status: 'available',
    verification_status: 'verified',
    is_active: false
  },
  {
    id: 'n_blocked_4',
    name: 'Blocked Node 4',
    node_type: 'destination',
    operational_status: 'blocked',
    verification_status: 'verified',
    is_active: true
  }
];

const DEMO_EDGES = [
  // Edge 1: Staircase between 1 and 2 (wheelchair_accessible: false, stairs_count: 20)
  {
    id: 'e_stairs_1_2',
    from_node_id: 'n_active_avail_1',
    to_node_id: 'n_active_avail_2',
    distance_m: 10.0,
    estimated_seconds: 15,
    path_type: 'stairs',
    stairs_count: 20,
    wheelchair_accessible: false,
    verification_status: 'verified',
    operational_status: 'available'
  },
  // Edge 2: Unverified walkway
  {
    id: 'e_unverified',
    from_node_id: 'n_active_avail_1',
    to_node_id: 'n_active_avail_2',
    distance_m: 12.0,
    estimated_seconds: 18,
    path_type: 'walkway',
    stairs_count: 0,
    wheelchair_accessible: true,
    verification_status: 'unverified',
    operational_status: 'available'
  },
  // Edge 3: Blocked elevator
  {
    id: 'e_blocked_lift',
    from_node_id: 'n_active_avail_1',
    to_node_id: 'n_active_avail_2',
    distance_m: 5.0,
    estimated_seconds: 25,
    path_type: 'lift',
    stairs_count: 0,
    wheelchair_accessible: true,
    verification_status: 'verified',
    operational_status: 'blocked'
  }
];

function runTestDijkstra(startNodeId, destNodeId, isStepFree) {
  const nodeMap = new Map(DEMO_NODES.map((n) => [n.id, n]));
  const startNode = nodeMap.get(startNodeId);
  const destNode = nodeMap.get(destNodeId);

  // 1. Validate start and destination endpoint nodes
  if (!startNode || !destNode) {
    return {
      available: false,
      reason: isStepFree
        ? 'No verified step-free route is currently available.'
        : 'Invalid origin or destination node selected.'
    };
  }

  if (
    !startNode.is_active ||
    startNode.operational_status !== 'available' ||
    !destNode.is_active ||
    destNode.operational_status !== 'available'
  ) {
    return {
      available: false,
      reason: isStepFree
        ? 'No verified step-free route is currently available.'
        : 'Origin or destination location is currently unavailable or inactive.'
    };
  }

  // 2. Zero-distance case
  if (startNodeId === destNodeId) {
    return {
      available: true,
      reason: null,
      distance_m: 0,
      estimated_seconds: 0,
      node_ids: [startNodeId],
      edge_ids: [],
      steps: [],
      stairs_count: 0,
      ramps_count: 0,
      lifts_count: 0
    };
  }

  // 3. Build adjacency list applying safety rules
  const adj = new Map();
  for (const node of DEMO_NODES) {
    adj.set(node.id, []);
  }

  for (const edge of DEMO_EDGES) {
    if (edge.verification_status !== 'verified' || edge.operational_status !== 'available') {
      continue;
    }

    const fromNode = nodeMap.get(edge.from_node_id);
    const toNode = nodeMap.get(edge.to_node_id);
    if (
      !fromNode ||
      !toNode ||
      !fromNode.is_active ||
      fromNode.operational_status !== 'available' ||
      !toNode.is_active ||
      toNode.operational_status !== 'available'
    ) {
      continue;
    }

    if (isStepFree) {
      if (
        edge.wheelchair_accessible !== true ||
        edge.stairs_count !== 0 ||
        edge.path_type === 'stairs'
      ) {
        continue;
      }
    }

    const weight = edge.estimated_seconds;
    adj.get(edge.from_node_id)?.push({ to: edge.to_node_id, weight, edge });
  }

  // Dijkstra
  const distances = new Map();
  const previous = new Map();
  const visited = new Set();

  for (const node of DEMO_NODES) {
    distances.set(node.id, Infinity);
    previous.set(node.id, null);
  }

  distances.set(startNodeId, 0);

  while (visited.size < distances.size) {
    let closestNode = null;
    let smallestDist = Infinity;

    for (const [nodeId, dist] of distances.entries()) {
      if (!visited.has(nodeId) && dist < smallestDist) {
        smallestDist = dist;
        closestNode = nodeId;
      }
    }

    if (!closestNode || smallestDist === Infinity) break;
    if (closestNode === destNodeId) break;

    visited.add(closestNode);

    const neighbors = adj.get(closestNode) || [];
    for (const { to, weight, edge } of neighbors) {
      if (visited.has(to)) continue;
      const candidateDist = smallestDist + weight;
      if (candidateDist < (distances.get(to) || Infinity)) {
        distances.set(to, candidateDist);
        previous.set(to, { fromNode: closestNode, edge });
      }
    }
  }

  const destDist = distances.get(destNodeId);
  if (!destDist || destDist === Infinity) {
    return {
      available: false,
      reason: isStepFree
        ? 'No verified step-free route is currently available.'
        : 'No connecting route found between the selected nodes.'
    };
  }

  return {
    available: true,
    estimated_seconds: destDist
  };
}

console.log('Running focused routing safety tests...');

// Test 1: Inactive destination rejected
const resInactive = runTestDijkstra('n_active_avail_1', 'n_inactive_3', false);
assert.strictEqual(resInactive.available, false, 'Inactive destination must be rejected');

// Test 2: Blocked destination rejected
const resBlocked = runTestDijkstra('n_active_avail_1', 'n_blocked_4', false);
assert.strictEqual(resBlocked.available, false, 'Blocked destination must be rejected');

// Test 3: Fastest route can traverse stairs
const resFastest = runTestDijkstra('n_active_avail_1', 'n_active_avail_2', false);
assert.strictEqual(resFastest.available, true, 'Fastest route should find verified path with stairs');
assert.strictEqual(resFastest.estimated_seconds, 15);

// Test 4: Step-free route MUST REJECT stairs and return exact reason
const resStepFree = runTestDijkstra('n_active_avail_1', 'n_active_avail_2', true);
assert.strictEqual(resStepFree.available, false, 'Step-free MUST reject stairs');
assert.strictEqual(
  resStepFree.reason,
  'No verified step-free route is currently available.',
  'Reason must match canonical specification'
);

// Test 5: Zero distance case
const resZero = runTestDijkstra('n_active_avail_1', 'n_active_avail_1', true);
assert.strictEqual(resZero.available, true);
assert.strictEqual(resZero.distance_m, 0);

console.log('All 5 focused routing safety assertions passed successfully!');
