// Centralized Carbon Footprint Emission Coefficients

const FOOD_COEFFICIENTS = {
  beef: 27.0,       // kg CO2 / kg
  chicken: 6.9,     // kg CO2 / kg
  rice: 2.7,        // kg CO2 / kg
  vegetables: 0.8,  // kg CO2 / kg
  dairy: 3.0,       // kg CO2 / kg
  wheat: 1.4        // kg CO2 / kg
};

const ENERGY_COEFFICIENTS = {
  electricity: 0.82, // kg CO2 / kWh
  png: 2.0,          // kg CO2 / SCM (piped natural gas)
  lpg: 2.98,         // kg CO2 / kg (liquefied petroleum gas cylinder)
  petrol: 2.31,      // kg CO2 / litre
  diesel: 2.68       // kg CO2 / litre
};

// Baselines for daily estimations (when user doesn't upload bills/receipts daily)
const DIET_DAILY_BASELINES = {
  vegan: 2.5,
  vegetarian: 3.5,
  omnivore: 5.0,
  carnivore: 7.2
};

const COMMUTE_DAILY_BASELINES = {
  none: 0.0,
  walk_bicycle: 0.0,
  ev: 0.05,            // kg CO2 / km
  public_transport: 0.08, // kg CO2 / km
  two_wheeler: 0.10,    // kg CO2 / km
  car: 0.22             // kg CO2 / km
};

// Average energy usage baselines (fallback, kg CO2 / day)
const DAILY_ENERGY_BASELINE = 4.5; 

// Annual tree CO2 absorption capacity (kg CO2 / year)
const TREE_ABSORPTION_KG = 22.0;

/**
 * Calculates food emissions from weight
 * @param {string} category 
 * @param {number} weightKg 
 * @returns {number} kg CO2
 */
function calculateFoodEmissions(category, weightKg) {
  const coeff = FOOD_COEFFICIENTS[category.toLowerCase()] || 1.0;
  return Number((coeff * weightKg).toFixed(3));
}

/**
 * Calculates utility/fuel emissions from units/volume
 * @param {string} type 
 * @param {number} units 
 * @returns {number} kg CO2
 */
function calculateEnergyEmissions(type, units) {
  const coeff = ENERGY_COEFFICIENTS[type.toLowerCase()] || 0.0;
  return Number((coeff * units).toFixed(3));
}

/**
 * Estimates baseline daily footprint for users based on profile settings
 * @param {string} dietType 
 * @param {string} commuteMode 
 * @param {number} commuteKm 
 * @returns {object} { food_kg, transport_kg, energy_kg, total_kg }
 */
function getProfileDailyBaseline(dietType, commuteMode, commuteKm = 15) {
  const food_kg = DIET_DAILY_BASELINES[dietType.toLowerCase()] || DIET_DAILY_BASELINES.vegetarian;
  const transport_coeff = COMMUTE_DAILY_BASELINES[commuteMode.toLowerCase()] || COMMUTE_DAILY_BASELINES.car;
  const transport_kg = Number((transport_coeff * commuteKm).toFixed(3));
  const energy_kg = DAILY_ENERGY_BASELINE;
  
  return {
    food_kg,
    transport_kg,
    energy_kg,
    total_kg: Number((food_kg + transport_kg + energy_kg).toFixed(3))
  };
}

module.exports = {
  FOOD_COEFFICIENTS,
  ENERGY_COEFFICIENTS,
  DIET_DAILY_BASELINES,
  COMMUTE_DAILY_BASELINES,
  DAILY_ENERGY_BASELINE,
  TREE_ABSORPTION_KG,
  calculateFoodEmissions,
  calculateEnergyEmissions,
  getProfileDailyBaseline
};
