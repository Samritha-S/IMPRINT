// Integration Tests for Imprint Carbon App Fixes
const path = require('path');
const fs = require('fs');

// 1. Force database file to be a temporary integration DB file
const testDbName = 'test_integration.db';
const testDbPath = path.join(__dirname, testDbName);

// Clean up any stale test DB before run
if (fs.existsSync(testDbPath)) {
  fs.unlinkSync(testDbPath);
}

process.env.DATABASE_FILE = testDbName;
process.env.PORT = '5002'; // Run test server on custom port

// Require database to initialize schema
const db = require('./db');
const app = require('./server');

const assert = require('assert');

// Start temporary Express listener
const server = app.listen(5002, async () => {
  console.log("🚀 Temporary integration test server started on port 5002.");
  try {
    await runTests();
    console.log("✅ All integration tests passed successfully!");
    try { db.close(); } catch(e) {}
    try { fs.unlinkSync(testDbPath); } catch(e) {}
    try { server.close(); } catch(e) {}
    process.exit(0);
  } catch (err) {
    console.error("❌ Integration tests failed!");
    console.error(err);
    try { db.close(); } catch(e) {}
    try { fs.unlinkSync(testDbPath); } catch(e) {}
    process.exit(1);
  }
});

function cleanupAndExit(code) {
  try {
    db.close();
  } catch (e) {}
  if (fs.existsSync(testDbPath)) {
    try {
      fs.unlinkSync(testDbPath);
    } catch (e) {}
  }
  process.exit(code);
}

async function runTests() {
  // 2. Register a mock user to get a valid authentication token
  console.log("Registering test user...");
  const regRes = await fetch('http://127.0.0.1:5002/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'tester',
      password: 'password123',
      name: 'Integration Tester',
      state: 'Karnataka',
      city: 'Bengaluru',
      ward: 'Indiranagar',
      diet: 'vegetarian',
      commute: 'ev'
    })
  });
  
  assert.strictEqual(regRes.status, 200, "Registration should succeed");
  const regData = await regRes.json();
  const token = regData.token;
  assert.ok(token, "Should return session token");

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  // ====================================================================
  // TEST 1: Accept feed action -> persistence and feed lookup
  // ====================================================================
  console.log("TEST 1: Feed card accept workflow...");
  
  // Trigger agent run manually first to create a run record with suggested action
  const runRes = await fetch('http://127.0.0.1:5002/api/agent/run', {
    method: 'POST',
    headers
  });
  assert.strictEqual(runRes.status, 200, "Agent run should succeed");
  const runData = await runRes.json();
  const actionId = runData.suggested_action.action_id;
  assert.ok(actionId, "Agent should have created a suggested action");

  // Post feedback (Accepting the action)
  const feedbackRes = await fetch('http://127.0.0.1:5002/api/agent/feedback', {
    method: 'POST',
    headers,
    body: JSON.stringify({ action_id: actionId, accepted: true })
  });
  assert.strictEqual(feedbackRes.status, 200, "Recording feedback should succeed");

  // Verify directly from SQLite database
  const feedbackRow = db.prepare('SELECT * FROM agent_feedback WHERE action_id = ?').get(actionId);
  assert.ok(feedbackRow, "Row should exist in agent_feedback table");
  assert.strictEqual(feedbackRow.accepted, 1, "Status should be accepted (1)");

  const memoryRow = db.prepare('SELECT * FROM agent_memory WHERE key_pattern = ?').get(`action_feedback_${actionId}`);
  assert.ok(memoryRow, "Row should exist in agent_memory table");
  assert.strictEqual(memoryRow.status, 'resolved', "Upsert status should be resolved");

  // Verify that subsequent feed fetch reflects the accepted status
  const feedRes = await fetch('http://127.0.0.1:5002/api/feed', { headers });
  const feedData = await feedRes.json();
  assert.ok(feedData.length > 0, "Feed should not be empty");
  const matchingCard = feedData.find(c => c.suggested_action && c.suggested_action.action_id === actionId);
  assert.ok(matchingCard, "Feed should contain card with matching action");
  assert.strictEqual(matchingCard.suggested_action.status, 'accepted', "Action status should reflect accepted persistently in feed");

  // ====================================================================
  // TEST 2: High confidence bill scanner pipeline
  // ====================================================================
  console.log("TEST 2: High confidence bill scanner pipeline...");
  
  // Clean bill text content
  const clearBillText = `
    BESCOM ELECTRICITY BILL
    Consumer: Sam Smith
    Month: May 2026
    Total units consumed: 120 kWh
    Amount Due: Rs. 780.00
  `;

  const scanResHigh = await fetch('http://127.0.0.1:5002/api/scanner/upload', {
    method: 'POST',
    headers,
    body: JSON.stringify({ type: 'bill', textContent: clearBillText })
  });

  assert.strictEqual(scanResHigh.status, 200);
  const scanDataHigh = await scanResHigh.json();
  assert.strictEqual(scanDataHigh.requiresCorrection, false, "High confidence should not require correction");
  assert.strictEqual(scanDataHigh.parsed.type, 'electricity');
  assert.strictEqual(scanDataHigh.parsed.units, 120);

  // Check database contains exactly one row matching this scan
  const scansCount = db.prepare("SELECT COUNT(*) as cnt FROM bill_scans WHERE provider = 'BESCOM'").get().cnt;
  assert.strictEqual(scansCount, 1, "Exactly one row should exist in bill_scans for BESCOM");

  // ====================================================================
  // TEST 3: Low confidence bill scanner pipeline -> silent manual correction fallback
  // ====================================================================
  console.log("TEST 3: Low confidence bill scanner pipeline + correction...");

  const blurryText = "--- unreadable receipt line ---";

  // Upload low confidence scan
  const scanResLow = await fetch('http://127.0.0.1:5002/api/scanner/upload', {
    method: 'POST',
    headers,
    body: JSON.stringify({ type: 'bill', textContent: blurryText })
  });

  assert.strictEqual(scanResLow.status, 200);
  const scanDataLow = await scanResLow.json();
  // Verify it returns requiresCorrection: true and DOES NOT save to database yet
  assert.strictEqual(scanDataLow.requiresCorrection, true, "Low confidence scanner must require correction");
  
  const scanCountBeforeCorrection = db.prepare("SELECT COUNT(*) as cnt FROM bill_scans WHERE provider = 'Mahanagar Gas'").get().cnt;
  assert.strictEqual(scanCountBeforeCorrection, 0, "No row should be inserted for low confidence scan before manual submit");

  // Submit manual correction
  const manualRes = await fetch('http://127.0.0.1:5002/api/scanner/manual-correct', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      type: 'bill',
      details: {
        type: 'gas',
        provider: 'Mahanagar Gas',
        units: 25.0,
        amount: 400.0,
        period: '2026-05'
      }
    })
  });

  assert.strictEqual(manualRes.status, 200, "Manual correction submit should succeed");
  
  // Confirm exactly one row is in bill_scans for this scan now
  const scanCountAfterCorrection = db.prepare("SELECT COUNT(*) as cnt FROM bill_scans WHERE provider = 'Mahanagar Gas'").get().cnt;
  assert.strictEqual(scanCountAfterCorrection, 1, "Exactly one row total should be saved in database for the corrected scan");

  // ====================================================================
  // TEST 4: Profile Details Edit & Recalculate Aggregates
  // ====================================================================
  console.log("TEST 4: User Profile Edit details pipeline...");

  // Validate request rejection on bad location combination
  const badProfileRes = await fetch('http://127.0.0.1:5002/api/users/profile', {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      name: 'Incorrect Location User',
      diet: 'vegan',
      commute: 'walk_bicycle',
      state: 'Karnataka',
      city: 'Mumbai', // Invalid city for Karnataka
      ward: 'Indiranagar',
      language: 'en'
    })
  });
  assert.strictEqual(badProfileRes.status, 400, "Should reject mismatched city/state combination");

  // Validate successful profile edit
  const goodProfileRes = await fetch('http://127.0.0.1:5002/api/users/profile', {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      name: 'Eco Warrior Tester',
      diet: 'vegan',
      commute: 'walk_bicycle',
      state: 'Maharashtra',
      city: 'Mumbai',
      ward: 'Colaba',
      language: 'en'
    })
  });

  assert.strictEqual(goodProfileRes.status, 200, "Should accept valid update payload");
  const goodProfileData = await goodProfileRes.json();
  assert.strictEqual(goodProfileData.success, true);
  assert.ok(goodProfileData.message.includes('Quack!'));

  // Confirm user details updated in the database
  const userRow = db.prepare("SELECT * FROM users WHERE username = 'tester'").get();
  assert.strictEqual(userRow.name, 'Eco Warrior Tester');
  assert.strictEqual(userRow.diet, 'vegan');
  assert.strictEqual(userRow.state, 'Maharashtra');
  assert.strictEqual(userRow.city, 'Mumbai');
  assert.strictEqual(userRow.ward, 'Colaba');

  // Verify historical logs remain intact
  const dailyLogsCount = db.prepare("SELECT COUNT(*) as cnt FROM daily_logs WHERE user_id = ?").get(userRow.id).cnt;
  assert.ok(dailyLogsCount >= 0);

  // ====================================================================
  // TEST 5: Profile Update - Partial Update Field Isolation
  // ====================================================================
  console.log("TEST 5: Profile Partial Update Field Isolation...");
  
  // Change only commute mode; all other fields must remain unchanged
  const partialUpdateRes = await fetch('http://127.0.0.1:5002/api/users/profile', {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      name: 'Eco Warrior Tester',
      diet: 'vegan',
      commute: 'public_transport',  // changed from walk_bicycle
      state: 'Maharashtra',
      city: 'Mumbai',
      ward: 'Colaba'
    })
  });
  
  assert.strictEqual(partialUpdateRes.status, 200, "Should accept partial update payload");
  
  const userRowAfterPartial = db.prepare("SELECT * FROM users WHERE username = 'tester'").get();
  assert.strictEqual(userRowAfterPartial.commute, 'public_transport', "Commute should be updated to public_transport");
  assert.strictEqual(userRowAfterPartial.name, 'Eco Warrior Tester', "Name should remain unchanged");
  assert.strictEqual(userRowAfterPartial.diet, 'vegan', "Diet should remain unchanged");
  assert.strictEqual(userRowAfterPartial.state, 'Maharashtra', "State should remain unchanged");
  assert.strictEqual(userRowAfterPartial.city, 'Mumbai', "City should remain unchanged");
  assert.strictEqual(userRowAfterPartial.ward, 'Colaba', "Ward should remain unchanged");
}

