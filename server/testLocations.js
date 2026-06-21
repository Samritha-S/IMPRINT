const assert = require('assert');
const db = require('./db');

console.log("Running Location database tests...");

// 1. Verify that states exist in seeded database
const usersCount = db.prepare('SELECT COUNT(*) as cnt FROM users').get().cnt;
console.log(`Verified database has ${usersCount} users.`);
assert.ok(usersCount >= 200, "Should have seeded 200+ users");

// 2. Check location distribution
const statesSeeded = db.prepare('SELECT DISTINCT state FROM users').all();
console.log(`Seeded users cover ${statesSeeded.length} distinct states.`);
assert.ok(statesSeeded.length >= 15, "Should cover at least 15+ states");

// 3. Check aggregates table structure
const aggs = db.prepare('SELECT * FROM ward_aggregates LIMIT 5').all();
assert.ok(aggs.length > 0, "ward_aggregates table should contain calculated entries");

// 4. Validate aggregation level contents
const wardAggCount = db.prepare("SELECT COUNT(*) as cnt FROM ward_aggregates WHERE location_level = 'ward'").get().cnt;
const cityAggCount = db.prepare("SELECT COUNT(*) as cnt FROM ward_aggregates WHERE location_level = 'city'").get().cnt;
const stateAggCount = db.prepare("SELECT COUNT(*) as cnt FROM ward_aggregates WHERE location_level = 'state'").get().cnt;

console.log(`Aggregates summary: ${wardAggCount} wards, ${cityAggCount} cities, ${stateAggCount} states.`);
assert.ok(wardAggCount > 0, "Should have ward averages calculated");
assert.ok(cityAggCount > 0, "Should have city averages calculated");
assert.ok(stateAggCount > 0, "Should have state averages calculated");

// 5. Test specific fallback logic mock values for leaderboard
// Mock user for testing fallback
const demoUser = db.prepare("SELECT * FROM users WHERE username = 'pip'").get();
assert.strictEqual(demoUser.state, 'Karnataka');
assert.strictEqual(demoUser.city, 'Bengaluru');
assert.strictEqual(demoUser.ward, 'Indiranagar');

console.log("✅ Location and aggregate tests passed!");
