const assert = require('assert');
const db = require('./db');
const agentService = require('./agentService');

console.log("Running Agent reasoning scenario tests...");

// Clean up leftover from previous run if any
db.prepare("DELETE FROM agent_runs WHERE user_id IN (SELECT id FROM users WHERE username = 'agent.test.user')").run();
db.prepare("DELETE FROM users WHERE username = 'agent.test.user'").run();

// Create a temp test user
const testUserId = db.prepare(`
  INSERT INTO users (username, password, name, state, city, ward, diet, commute)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  'agent.test.user',
  'pwd',
  'Agent Tester',
  'Karnataka',
  'Bengaluru',
  'Indiranagar',
  'omnivore',
  'car'
).lastInsertRowid;

/**
 * Utility to clear daily logs for the test user
 */
function clearLogs() {
  db.prepare('DELETE FROM daily_logs WHERE user_id = ?').run(testUserId);
}

/**
 * Utility to seed exact daily log history for testing scenarios
 */
function seedMockLogs(dataList) {
  const insert = db.prepare(`
    INSERT INTO daily_logs (user_id, log_date, food_kg, transport_kg, energy_kg, total_kg, details)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  dataList.forEach(item => {
    insert.run(
      testUserId,
      item.date,
      item.food,
      item.transport,
      item.energy,
      item.food + item.transport + item.energy,
      JSON.stringify({ note: "test scenario" })
    );
  });
}

// ==========================================
// SCENARIO 1: High Emitter (Mood -> concerned)
// ==========================================
clearLogs();
const highLogs = [];
for (let i = 0; i < 7; i++) {
  const d = new Date();
  d.setDate(d.getDate() - i);
  highLogs.push({
    date: d.toISOString().slice(0,10),
    food: 6.0,
    transport: 8.0,
    energy: 5.0
  });
}
seedMockLogs(highLogs);

let runResult = agentService.runDeterministicLoop(testUserId);
console.log("High Emitter Output:", JSON.stringify(runResult, null, 2));
assert.strictEqual(runResult.mood, 'concerned');
assert.ok(runResult.message.includes('footprint') || runResult.message.includes('emissions') || runResult.message.includes('concerned'));
assert.ok(runResult.suggested_action);
assert.ok(typeof runResult.suggested_action.action_id === 'string');

// ==========================================
// SCENARIO 2: Low Emitter (Mood -> happy)
// ==========================================
clearLogs();
const lowLogs = [];
for (let i = 0; i < 7; i++) {
  const d = new Date();
  d.setDate(d.getDate() - i);
  lowLogs.push({
    date: d.toISOString().slice(0,10),
    food: 1.0,
    transport: 0.5,
    energy: 1.0
  });
}
seedMockLogs(lowLogs);

runResult = agentService.runDeterministicLoop(testUserId);
console.log("Low Emitter Output:", JSON.stringify(runResult, null, 2));
assert.strictEqual(runResult.mood, 'happy');
assert.ok(runResult.message.includes('Brilliant!') || runResult.message.includes('conserving'));

// ==========================================
// SCENARIO 3: Sudden Spike (Mood -> concerned)
// ==========================================
clearLogs();
const spikeLogs = [];
// Prior week (days 7-13): 3 kg/day
for (let i = 7; i < 14; i++) {
  const d = new Date();
  d.setDate(d.getDate() - i);
  spikeLogs.push({ date: d.toISOString().slice(0,10), food: 1.0, transport: 1.0, energy: 1.0 });
}
// Current week (days 0-6): 8 kg/day
for (let i = 0; i < 7; i++) {
  const d = new Date();
  d.setDate(d.getDate() - i);
  spikeLogs.push({ date: d.toISOString().slice(0,10), food: 3.0, transport: 3.0, energy: 2.0 });
}
seedMockLogs(spikeLogs);

runResult = agentService.runDeterministicLoop(testUserId);
console.log("Sudden Spike Output:", JSON.stringify(runResult, null, 2));
assert.strictEqual(runResult.mood, 'concerned');
assert.ok(runResult.message.includes('sudden spike') || runResult.message.includes('spiked'));

// ==========================================
// SCENARIO 4: No/Sparse Data (Mood -> neutral fallback)
// ==========================================
clearLogs();
runResult = agentService.runDeterministicLoop(testUserId);
console.log("No Data Output:", JSON.stringify(runResult, null, 2));
assert.strictEqual(runResult.mood, 'neutral');
assert.ok(runResult.message.includes('Pip here!') || runResult.message.includes('stable') || runResult.message.includes('onboarding'));

// Clean up test user
db.prepare('DELETE FROM agent_runs WHERE user_id = ?').run(testUserId);
db.prepare('DELETE FROM users WHERE id = ?').run(testUserId);

console.log("✅ Agent scenario reasoning tests passed!");
