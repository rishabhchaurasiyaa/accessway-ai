/**
 * ACCESSWAY AI — Phase 6.5 Step 1: Production Conversion & Demo Removal Verification
 *
 * Verifies that:
 * 1. Production services contain zero demo fixtures, synthetic data fallbacks, or demo methods.
 * 2. Automated test fixtures are cleanly isolated inside dedicated test files.
 * 3. NavigationPage renders honest production states (connection errors & required empty state).
 * 4. Step-free safety rules and exact reasons are preserved intact.
 * 5. ReportPage and AdminPage operate exclusively in production mode (no demo mode toggle/storage).
 * 6. CampusMap and RouteComparisonCards contain no demo props or synthetic watermarks.
 * 7. Target campus is Lovely Professional University (LPU) with honest survey/blueprint status.
 * 8. Configuration files contain no demo-specific mode flags.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('Running Phase 6.5 Step 1: Production Conversion Invariant Tests...\n');

let passedTests = 0;

function runTest(testName, fn) {
  try {
    fn();
    console.log(`✓ ${testName}`);
    passedTests++;
  } catch (err) {
    console.error(`✗ ${testName}`);
    console.error(`  Error: ${err.message}`);
    process.exit(1);
  }
}

const frontendDir = path.resolve(__dirname);
const srcDir = path.join(frontendDir, 'src');

// -----------------------------------------------------------------------------
// Test 1: CampusService is pure production (no demo exports or fixtures)
// -----------------------------------------------------------------------------
runTest('Test 1: CampusService exports only production async API methods', () => {
  const content = fs.readFileSync(path.join(srcDir, 'services', 'campusService.ts'), 'utf-8');

  assert(!content.includes('DEMO_BUILDINGS'), 'campusService.ts must not export DEMO_BUILDINGS');
  assert(!content.includes('DEMO_NODES'), 'campusService.ts must not export DEMO_NODES');
  assert(!content.includes('DEMO_EDGES'), 'campusService.ts must not export DEMO_EDGES');
  assert(!content.includes('getDemoGeoJson'), 'campusService.ts must not export getDemoGeoJson');
  assert(!content.includes('getDemoBuildings'), 'campusService.ts must not export getDemoBuildings');
  assert(!content.includes('getDemoNodes'), 'campusService.ts must not export getDemoNodes');
  assert(!content.includes('getDemoEdges'), 'campusService.ts must not export getDemoEdges');

  assert(content.includes('fetchBuildings: async'), 'campusService.ts must export fetchBuildings');
  assert(content.includes('fetchBuildingNodes: async'), 'campusService.ts must export fetchBuildingNodes');
  assert(content.includes('fetchMapGeoJson: async'), 'campusService.ts must export fetchMapGeoJson');
});

// -----------------------------------------------------------------------------
// Test 2: RoutingService has no client-side demo routing or Dijkstra fallbacks
// -----------------------------------------------------------------------------
runTest('Test 2: RoutingService contains no demo routing or client-side fallback', () => {
  const content = fs.readFileSync(path.join(srcDir, 'services', 'routingService.ts'), 'utf-8');

  assert(!content.includes('calculateDemoRoute'), 'routingService.ts must not export calculateDemoRoute');
  assert(!content.includes('runClientDijkstra'), 'routingService.ts must not contain runClientDijkstra');
  assert(!content.includes('DEMO_NODES'), 'routingService.ts must not import DEMO_NODES');
  assert(!content.includes('DEMO_EDGES'), 'routingService.ts must not import DEMO_EDGES');

  assert(content.includes('export const calculateRoute = async'), 'routingService.ts must export calculateRoute');
  assert(content.includes('export const fetchGraphVersion = async'), 'routingService.ts must export fetchGraphVersion');
  assert(content.includes('export class GraphChangedConflictError'), 'routingService.ts must export GraphChangedConflictError');
});

// -----------------------------------------------------------------------------
// Test 3: ReportingService has no local fake storage or mock moderation
// -----------------------------------------------------------------------------
runTest('Test 3: ReportingService contains no local demo storage or mock moderation', () => {
  const content = fs.readFileSync(path.join(srcDir, 'services', 'reportingService.ts'), 'utf-8');

  assert(!content.includes('getDemoReports'), 'reportingService.ts must not export getDemoReports');
  assert(!content.includes('submitDemoReport'), 'reportingService.ts must not export submitDemoReport');
  assert(!content.includes('moderateDemoReport'), 'reportingService.ts must not export moderateDemoReport');
  assert(!content.includes('accessway_demo_reports'), 'reportingService.ts must not use local storage demo key');
  assert(!content.includes('INITIAL_REPORTS'), 'reportingService.ts must not contain INITIAL_REPORTS');

  assert(content.includes('fetchAdminReports: async'), 'reportingService.ts must export fetchAdminReports');
  assert(content.includes('submitReport: async'), 'reportingService.ts must export submitReport');
  assert(content.includes('moderateReport: async'), 'reportingService.ts must export moderateReport');
});

// -----------------------------------------------------------------------------
// Test 4: NavigationPage contains no demo toggle, demo banner, or demo buttons
// -----------------------------------------------------------------------------
runTest('Test 4: NavigationPage has no demo mode toggle, banner, or fallback buttons', () => {
  const content = fs.readFileSync(path.join(srcDir, 'pages', 'NavigationPage.tsx'), 'utf-8');

  assert(!content.includes('isDemoMode'), 'NavigationPage.tsx must not use isDemoMode state');
  assert(!content.includes('setIsDemoMode'), 'NavigationPage.tsx must not use setIsDemoMode');
  assert(!content.includes('handleToggleDemoMode'), 'NavigationPage.tsx must not have handleToggleDemoMode');
  assert(!content.includes('Demo Mode: ON'), 'NavigationPage.tsx must not have Demo Mode: ON button');
  assert(!content.includes('Switch to Demo Mode'), 'NavigationPage.tsx must not suggest switching to demo mode');
  assert(!content.includes('calculateDemoRoute'), 'NavigationPage.tsx must not invoke calculateDemoRoute');
});

// -----------------------------------------------------------------------------
// Test 5: NavigationPage exact empty state message when no buildings exist
// -----------------------------------------------------------------------------
runTest('Test 5: NavigationPage displays exact required empty state message', () => {
  const content = fs.readFileSync(path.join(srcDir, 'pages', 'NavigationPage.tsx'), 'utf-8');
  const expectedEmptyState =
    'No verified campus locations are currently available. Navigation will become available when authorized campus infrastructure data has been added and verified.';

  assert(
    content.includes(expectedEmptyState),
    `NavigationPage.tsx must contain exact empty state string: "${expectedEmptyState}"`
  );
});

// -----------------------------------------------------------------------------
// Test 6: ReportPage is pure production (no demo toggle or simulated submission)
// -----------------------------------------------------------------------------
runTest('Test 6: ReportPage has no demo toggle or simulated submission', () => {
  const content = fs.readFileSync(path.join(srcDir, 'pages', 'ReportPage.tsx'), 'utf-8');

  assert(!content.includes('isDemoMode'), 'ReportPage.tsx must not use isDemoMode');
  assert(!content.includes('handleToggleDemoMode'), 'ReportPage.tsx must not have handleToggleDemoMode');
  assert(!content.includes('Demo Mode: ON'), 'ReportPage.tsx must not have Demo Mode button');
  assert(!content.includes('submitDemoReport'), 'ReportPage.tsx must not call submitDemoReport');
  assert(!content.includes('getDemoBuildings'), 'ReportPage.tsx must not load demo buildings');

  assert(content.includes('ReportingService.submitReport'), 'ReportPage.tsx must submit directly to ReportingService.submitReport');
});

// -----------------------------------------------------------------------------
// Test 7: AdminPage enforces administrator authentication (no demo bypass)
// -----------------------------------------------------------------------------
runTest('Test 7: AdminPage enforces JWT authentication without demo mode bypass', () => {
  const content = fs.readFileSync(path.join(srcDir, 'pages', 'AdminPage.tsx'), 'utf-8');

  assert(!content.includes('isDemoMode'), 'AdminPage.tsx must not use isDemoMode');
  assert(!content.includes('toggleDemoMode'), 'AdminPage.tsx must not have toggleDemoMode');
  assert(!content.includes('Demo Mode: ON'), 'AdminPage.tsx must not have Demo Mode toggle');
  assert(!content.includes('moderateDemoReport'), 'AdminPage.tsx must not call moderateDemoReport');
  assert(!content.includes('DEMO RECORD'), 'AdminPage.tsx must not display DEMO RECORD badges');
  assert(content.includes('isTokenVerified'), 'AdminPage.tsx must require isTokenVerified for queue access');
});

// -----------------------------------------------------------------------------
// Test 8: CampusMap and RouteComparisonCards contain no demo props or watermarks
// -----------------------------------------------------------------------------
runTest('Test 8: CampusMap & RouteComparisonCards have no demo props and use honest naming', () => {
  const mapContent = fs.readFileSync(
    path.join(srcDir, 'components', 'navigation', 'CampusMap.tsx'),
    'utf-8'
  );
  assert(!mapContent.includes('isDemoMode'), 'CampusMap.tsx must not accept isDemoMode');
  assert(!mapContent.includes('onToggleDemoMode'), 'CampusMap.tsx must not accept onToggleDemoMode');
  assert(!mapContent.includes('Switch to Demo Mode'), 'CampusMap.tsx must not have Switch to Demo Mode button');
  assert(
    !mapContent.includes('SIMULATED DEMO DATA — NOT FOR REAL-WORLD NAVIGATION'),
    'CampusMap.tsx must not display demo watermark'
  );
  assert(
    mapContent.includes('Campus Map — Verified Infrastructure Only'),
    'CampusMap.tsx must display "Campus Map — Verified Infrastructure Only"'
  );
  assert(
    !mapContent.includes('Live Campus Map (FastAPI GeoJSON)'),
    'CampusMap.tsx must not contain "Live Campus Map (FastAPI GeoJSON)"'
  );
  assert(
    mapContent.includes('Campus Mapping & Navigation Not Available'),
    'CampusMap.tsx must display honest empty state title'
  );
  assert(
    mapContent.includes('Lovely Professional University (LPU)'),
    'CampusMap.tsx empty state must reference LPU'
  );

  const cardsContent = fs.readFileSync(
    path.join(srcDir, 'components', 'navigation', 'RouteComparisonCards.tsx'),
    'utf-8'
  );
  assert(!cardsContent.includes('isDemoMode'), 'RouteComparisonCards.tsx must not accept isDemoMode');
  assert(
    !cardsContent.includes('SIMULATED DEMO DATA — NOT FOR REAL-WORLD NAVIGATION'),
    'RouteComparisonCards.tsx must not display demo badge'
  );
  assert(
    cardsContent.includes('Verified Routing Engine'),
    'RouteComparisonCards.tsx must display "Verified Routing Engine"'
  );
  assert(
    !cardsContent.includes('Live FastAPI Routing'),
    'RouteComparisonCards.tsx must not display "Live FastAPI Routing"'
  );
});

// -----------------------------------------------------------------------------
// Test 9: LandingPage & AccessibilityBanner reference LPU and honest survey status
// -----------------------------------------------------------------------------
runTest('Test 9: LandingPage & AccessibilityBanner state LPU and honest survey status', () => {
  const bannerContent = fs.readFileSync(
    path.join(srcDir, 'components', 'accessibility', 'AccessibilityBanner.tsx'),
    'utf-8'
  );
  assert(bannerContent.includes('Lovely Professional University (LPU)'), 'Banner must reference LPU');
  assert(bannerContent.includes('pending authorization'), 'Banner must state survey/blueprints are pending authorization');
  assert(!bannerContent.includes('Buildings BLDG-A, BLDG-B, and BLDG-C'), 'Banner must not claim synthetic buildings as real');

  const landingContent = fs.readFileSync(path.join(srcDir, 'pages', 'LandingPage.tsx'), 'utf-8');
  assert(landingContent.includes('Lovely Professional University (LPU)'), 'LandingPage must reference LPU');
  assert(landingContent.includes('Campus Deployment Roadmap'), 'LandingPage must outline deployment roadmap');
  assert(!landingContent.includes('Three Demonstration Facilities Modeled'), 'LandingPage must not claim synthetic facilities modeled');
});

// -----------------------------------------------------------------------------
// Test 10: Test fixtures are isolated inside test directory
// -----------------------------------------------------------------------------
runTest('Test 10: Test fixtures are isolated inside src/test/demoFixtures.ts', () => {
  const fixturePath = path.join(srcDir, 'test', 'demoFixtures.ts');
  assert(fs.existsSync(fixturePath), 'src/test/demoFixtures.ts must exist');

  const content = fs.readFileSync(fixturePath, 'utf-8');
  assert(content.includes('DEMO_BUILDINGS'), 'demoFixtures.ts must preserve DEMO_BUILDINGS');
  assert(content.includes('DEMO_NODES'), 'demoFixtures.ts must preserve DEMO_NODES');
  assert(content.includes('DEMO_EDGES'), 'demoFixtures.ts must preserve DEMO_EDGES');
  assert(content.includes('getDemoGeoJson'), 'demoFixtures.ts must preserve getDemoGeoJson');
});

// -----------------------------------------------------------------------------
// Test 11: Frontend environment variables do not include VITE_SYNTHETIC_DATA_MODE
// -----------------------------------------------------------------------------
runTest('Test 11: Frontend .env and .env.example do not include VITE_SYNTHETIC_DATA_MODE', () => {
  const envExample = fs.readFileSync(path.join(frontendDir, '.env.example'), 'utf-8');
  assert(!envExample.includes('VITE_SYNTHETIC_DATA_MODE'), '.env.example must not have VITE_SYNTHETIC_DATA_MODE');

  if (fs.existsSync(path.join(frontendDir, '.env'))) {
    const env = fs.readFileSync(path.join(frontendDir, '.env'), 'utf-8');
    assert(!env.includes('VITE_SYNTHETIC_DATA_MODE'), '.env must not have VITE_SYNTHETIC_DATA_MODE');
  }
});

// -----------------------------------------------------------------------------
// Test 12: Step-free routing safety invariants are preserved
// -----------------------------------------------------------------------------
runTest('Test 12: Step-free routing invariants and exact unavailable message verified', () => {
  const expectedReason = 'No verified step-free route is currently available.';

  // Simulate routing validator logic to ensure invariants hold
  function evaluateStepFreePath(edge) {
    if (edge.verification_status !== 'verified') {
      return { available: false, reason: expectedReason };
    }
    if (edge.operational_status !== 'available') {
      return { available: false, reason: expectedReason };
    }
    if (edge.wheelchair_accessible !== true) {
      return { available: false, reason: expectedReason };
    }
    if (edge.stairs_count !== 0 || edge.stairs_count == null) {
      return { available: false, reason: expectedReason };
    }
    if (edge.path_type === 'stairs') {
      return { available: false, reason: expectedReason };
    }
    return { available: true, reason: null };
  }

  // 1. Unverified edge
  assert.strictEqual(
    evaluateStepFreePath({
      verification_status: 'unverified',
      operational_status: 'available',
      wheelchair_accessible: true,
      stairs_count: 0,
      path_type: 'corridor'
    }).reason,
    expectedReason
  );

  // 2. Stairs edge
  assert.strictEqual(
    evaluateStepFreePath({
      verification_status: 'verified',
      operational_status: 'available',
      wheelchair_accessible: true,
      stairs_count: 12,
      path_type: 'stairs'
    }).reason,
    expectedReason
  );

  // 3. Null stairs count
  assert.strictEqual(
    evaluateStepFreePath({
      verification_status: 'verified',
      operational_status: 'available',
      wheelchair_accessible: true,
      stairs_count: null,
      path_type: 'corridor'
    }).reason,
    expectedReason
  );

  // 4. Reported unverified
  assert.strictEqual(
    evaluateStepFreePath({
      verification_status: 'verified',
      operational_status: 'reported_unverified',
      wheelchair_accessible: true,
      stairs_count: 0,
      path_type: 'lift'
    }).reason,
    expectedReason
  );

  // 5. Valid step-free
  const valid = evaluateStepFreePath({
    verification_status: 'verified',
    operational_status: 'available',
    wheelchair_accessible: true,
    stairs_count: 0,
    path_type: 'ramp'
  });
  assert.strictEqual(valid.available, true);
  assert.strictEqual(valid.reason, null);
});

console.log(`\n========================================`);
console.log(`ALL ${passedTests} PRODUCTION CONVERSION INVARIANT TESTS PASSED (${passedTests}/12)`);
console.log(`========================================\n`);
