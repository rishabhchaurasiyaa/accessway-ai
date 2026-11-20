/**
 * FRONTEND CONNECTIVITY STATUS DETERMINATION TEST SUITE
 * Tests the 5 mandatory scenarios from Phase 6, Step 2:
 * 1. API responds and database is connected.
 * 2. API responds but database is disconnected.
 * 3. API responds but database is not configured.
 * 4. API is unreachable -> API Offline, DB Status Unavailable (NOT DB Disconnected).
 * 5. Health response contains an unknown or missing database status.
 */
const assert = require('assert');

// Pure logic extracted directly from ConnectivityStatus.tsx
function evaluateConnectivity(healthResponse, isNetworkError = false, errorMessage = '') {
  let apiState = 'checking';
  let dbState = 'checking';
  let databaseError = null;

  if (isNetworkError) {
    apiState = 'offline';
    // When API is unreachable or times out, database state cannot be verified.
    // Must show 'unavailable' (DB Status Unavailable), NOT 'disconnected'.
    dbState = 'unavailable';
    databaseError = errorMessage || 'Backend service unreachable';
    return { apiState, dbState, databaseError };
  }

  // 1. API Status Determination: Successful response from /health means API is Online
  apiState = 'online';

  // 2. Database Status Determination:
  // Allowed to be 'connected' ONLY when database_status === 'connected'
  const rawDbStatus = healthResponse?.database_status;
  if (rawDbStatus === 'connected') {
    dbState = 'connected';
    databaseError = null;
  } else if (rawDbStatus === 'disconnected') {
    dbState = 'disconnected';
    databaseError = healthResponse?.database_error || 'Database connection unreachable';
  } else if (rawDbStatus === 'not_configured') {
    dbState = 'not_configured';
    databaseError = healthResponse?.database_error || 'DATABASE_URL contains placeholder credentials';
  } else {
    // Unknown or missing database status must never be reported as connected
    dbState = 'unknown';
    databaseError = 'Unknown database status returned by server';
  }

  return { apiState, dbState, databaseError };
}

console.log('Running Connectivity Status Determination Tests...\n');

// Scenario 1: API responds and database is connected
const s1 = evaluateConnectivity({
  status: 'healthy',
  version: '1.0.0',
  database_status: 'connected',
  database_error: null
});
assert.strictEqual(s1.apiState, 'online', 'Scenario 1: API must be online');
assert.strictEqual(s1.dbState, 'connected', 'Scenario 1: DB must be connected');
assert.strictEqual(s1.databaseError, null);
console.log('✓ Scenario 1 Passed: API Online & DB Connected');

// Scenario 2: API responds but database is disconnected
const s2 = evaluateConnectivity({
  status: 'degraded',
  version: '1.0.0',
  database_status: 'disconnected',
  database_error: 'Connection refused on port 5432'
});
assert.strictEqual(s2.apiState, 'online', 'Scenario 2: API must be online');
assert.strictEqual(s2.dbState, 'disconnected', 'Scenario 2: DB must be disconnected');
assert.notStrictEqual(s2.dbState, 'connected', 'Scenario 2: DB must NEVER be connected');
assert.strictEqual(s2.databaseError, 'Connection refused on port 5432');
console.log('✓ Scenario 2 Passed: API Online & DB Disconnected (Explicitly verified by health endpoint)');

// Scenario 3: API responds but database is not configured
const s3 = evaluateConnectivity({
  status: 'degraded',
  version: '1.0.0',
  database_status: 'not_configured',
  database_error: 'DATABASE_URL contains placeholder credentials'
});
assert.strictEqual(s3.apiState, 'online', 'Scenario 3: API must be online');
assert.strictEqual(s3.dbState, 'not_configured', 'Scenario 3: DB must be not_configured');
assert.notStrictEqual(s3.dbState, 'connected', 'Scenario 3: DB must NEVER be connected');
console.log('✓ Scenario 3 Passed: API Online & DB Not Configured');

// Scenario 4: API is unreachable (network timeout / server down)
const s4 = evaluateConnectivity(null, true, 'Network error: Unable to reach backend server');
assert.strictEqual(s4.apiState, 'offline', 'Scenario 4: API must be offline');
assert.strictEqual(s4.dbState, 'unavailable', 'Scenario 4: DB must be unavailable');
assert.notStrictEqual(s4.dbState, 'disconnected', 'Scenario 4: DB must NOT be disconnected without health response verification');
assert.notStrictEqual(s4.dbState, 'connected', 'Scenario 4: DB must NEVER be connected');
console.log('✓ Scenario 4 Passed: API Offline & DB Status Unavailable (Corrected: not claimed disconnected)');

// Scenario 5: Health response contains unknown or missing database status
const s5Empty = evaluateConnectivity({ status: 'healthy', version: '1.0.0' });
assert.strictEqual(s5Empty.apiState, 'online');
assert.strictEqual(s5Empty.dbState, 'unknown', 'Scenario 5: Missing DB status must be unknown');
assert.notStrictEqual(s5Empty.dbState, 'connected', 'Scenario 5: Missing DB status must NEVER be connected');

const s5Unknown = evaluateConnectivity({ status: 'healthy', version: '1.0.0', database_status: 'unexpected_value' });
assert.strictEqual(s5Unknown.apiState, 'online');
assert.strictEqual(s5Unknown.dbState, 'unknown', 'Scenario 5: Unexpected DB status must be unknown');
assert.notStrictEqual(s5Unknown.dbState, 'connected', 'Scenario 5: Unexpected DB status must NEVER be connected');
console.log('✓ Scenario 5 Passed: Unknown/Missing DB status safely mapped to unknown (Never connected)');

console.log('\nAll 5 connectivity determination scenarios passed successfully!');
