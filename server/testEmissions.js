const assert = require('assert');
const emissionsEngine = require('./emissionsEngine');

console.log("Running Emissions Engine tests...");

// Test Food emissions
assert.strictEqual(emissionsEngine.calculateFoodEmissions('beef', 2.0), 54.0);
assert.strictEqual(emissionsEngine.calculateFoodEmissions('chicken', 1.0), 6.9);
assert.strictEqual(emissionsEngine.calculateFoodEmissions('rice', 3.0), 8.1);
assert.strictEqual(emissionsEngine.calculateFoodEmissions('vegetables', 10.0), 8.0);
assert.strictEqual(emissionsEngine.calculateFoodEmissions('dairy', 1.5), 4.5);
assert.strictEqual(emissionsEngine.calculateFoodEmissions('wheat', 2.0), 2.8);
assert.strictEqual(emissionsEngine.calculateFoodEmissions('UnknownCategory', 2.0), 2.0); // Default fallback factor of 1.0

// Test Energy emissions
assert.strictEqual(emissionsEngine.calculateEnergyEmissions('electricity', 100), 82.0);
assert.strictEqual(emissionsEngine.calculateEnergyEmissions('png', 10), 20.0);
assert.strictEqual(emissionsEngine.calculateEnergyEmissions('lpg', 14.2), 42.316);
assert.strictEqual(emissionsEngine.calculateEnergyEmissions('petrol', 10), 23.1);
assert.strictEqual(emissionsEngine.calculateEnergyEmissions('diesel', 10), 26.8);

// Test Profile Baseline estimations
const vegetarianBaseline = emissionsEngine.getProfileDailyBaseline('vegetarian', 'ev', 10);
assert.ok(vegetarianBaseline.food_kg === 3.5);
assert.ok(vegetarianBaseline.transport_kg === 0.5); // 0.05 * 10
assert.ok(vegetarianBaseline.energy_kg === 4.5);
assert.ok(vegetarianBaseline.total_kg === 8.5);

const veganBaseline = emissionsEngine.getProfileDailyBaseline('vegan', 'car', 20);
assert.ok(veganBaseline.food_kg === 2.5);
assert.ok(veganBaseline.transport_kg === 4.4); // 0.22 * 20
assert.ok(veganBaseline.energy_kg === 4.5);
assert.ok(veganBaseline.total_kg === 11.4);

console.log("✅ Emissions Engine tests passed!");
