/**
 * @fileoverview Application state and configuration constants.
 */

/**
 * Emission factors for different activities in kg CO2e.
 * @const {Object}
 */
export const FACTORS = {
  transport: { car: 0.21, motorbike: 0.11, bus: 0.04, auto: 0.15, cycle: 0 },
  diet: { vegan: 1.5, vegetarian: 2.5, mixed: 4.5, 'meat-heavy': 7.5 },
  energy: { ac: 0.82, device: 0.05 },
  shopping: { small: 3.5, electronics: 15, appliance: 40 },
  waste: { none: 0, little: 0.3, lot: 0.8 },
  flight: 90 // kg per hour
};

/**
 * Baseline comparison benchmarks in kg CO2e/day per person.
 * @const {Object}
 */
export const BENCHMARKS = {
  global: 6.3, // Global 1.5°C target
  india: 5.2   // India national average
};

/**
 * User-friendly labels for transportation modes.
 * @const {Object.<string, string>}
 */
export const TRANSPORT_LABELS = {
  car: '🚗 Car',
  motorbike: '🏍️ Motorbike',
  bus: '🚌 Bus/Metro',
  auto: '🛺 Auto',
  cycle: '🚲 Cycle/Walk'
};

/**
 * User-friendly labels for diet options.
 * @const {Object.<string, string>}
 */
export const DIET_LABELS = {
  vegan: '🌱 Vegan',
  vegetarian: '🥗 Vegetarian',
  mixed: '🍳 Mixed',
  'meat-heavy': '🥩 Meat-heavy'
};

/**
 * LocalStorage key name.
 * @const {string}
 */
export const STORAGE_KEY = 'verde_history';

/**
 * Reactive global application state.
 * @type {Object}
 */
export const state = {
  trips: [],
  diet: null,
  acHours: 0,
  deviceHours: 0,
  flightHours: 0,
  shopping: { small: false, electronics: false, appliance: false },
  waste: 'none',
  history: []
};
