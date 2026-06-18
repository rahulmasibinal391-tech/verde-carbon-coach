/**
 * @fileoverview Pure calculation and parsing utilities for Verde Carbon Coach.
 * Zero DOM references.
 */

import { FACTORS, BENCHMARKS } from './state.js';

/**
 * Calculates the breakdown of emissions for each category in kg CO2e.
 * @param {Object} currentState - The active state containing carbon log details.
 * @param {Object} [factors=FACTORS] - The emission factor reference map.
 * @returns {Object} Emissions per category: transport, diet, energy, shopping, waste, flight.
 */
export function getBreakdown(currentState, factors = FACTORS) {
  const transport = (currentState.trips || []).reduce((sum, t) => sum + (t.emission || 0), 0);
  const diet = currentState.diet ? (factors.diet[currentState.diet] || 0) : 0;
  const energy =
    (currentState.acHours || 0) * factors.energy.ac +
    (currentState.deviceHours || 0) * factors.energy.device;

  let shopping = 0;
  if (currentState.shopping) {
    if (currentState.shopping.small) shopping += factors.shopping.small;
    if (currentState.shopping.electronics) shopping += factors.shopping.electronics;
    if (currentState.shopping.appliance) shopping += factors.shopping.appliance;
  }

  const waste = factors.waste[currentState.waste || 'none'] || 0;
  const flight = (currentState.flightHours || 0) * factors.flight;

  return { transport, diet, energy, shopping, waste, flight };
}

/**
 * Calculates current daily logging streak.
 * @param {Array.<Object>} history - Log history entries list.
 * @param {Date} [today=new Date()] - Verification anchor date.
 * @returns {number} Current streak in consecutive days.
 */
export function calculateStreak(history, today = new Date()) {
  let streak = 0;
  if (!history || history.length === 0) return 0;

  const sorted = [...history].sort((a, b) => b.date.localeCompare(a.date));
  
  // Set time of anchor date to midnight for date-only comparison
  const anchor = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  for (let i = 0; i < sorted.length; i++) {
    const expected = new Date(anchor);
    expected.setDate(expected.getDate() - i);
    const expectedStr = expected.toISOString().slice(0, 10);
    
    if (sorted[i].date === expectedStr) {
      streak++;
    } else if (i === 0) {
      // If today is not logged, check if yesterday was logged to continue streak
      const yesterday = new Date(anchor);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().slice(0, 10);
      if (sorted[0].date === yesterdayStr) {
        // Streak is preserved from yesterday
        continue;
      } else {
        break;
      }
    } else if (i === 1 && sorted[0].date === anchor.toISOString().slice(0, 10)) {
      // If we skipped checking today's match earlier but it matches yesterday, continue
      break;
    } else {
      break;
    }
  }
  return streak;
}

/**
 * Parses a natural language user string to extract carbon activities.
 * @param {string} text - User message log.
 * @param {Object} [factors=FACTORS] - The emission factors reference map.
 * @returns {Object} Parsed activities values and labels.
 */
export function parseActivities(text, factors = FACTORS) {
  const lower = text.toLowerCase();
  let transport = 0;
  let diet = 0;
  let energy = 0;
  let flight = 0;
  let dietLabel = '';
  let transportLabel = '';
  let hasData = false;

  // 1. Transport
  const kmMatch = lower.match(/(\d+\.?\d*)\s*km/);
  const km = kmMatch ? parseFloat(kmMatch[1]) : 0;

  if (lower.includes('car') || lower.includes('drove') || lower.includes('drive')) {
    const valKm = km || 15;
    transport = valKm * factors.transport.car;
    transportLabel = `Car (${valKm} km)`;
    hasData = true;
  } else if (
    lower.includes('bike') ||
    lower.includes('motorbike') ||
    lower.includes('two wheeler') ||
    lower.includes('scooty') ||
    lower.includes('scooter')
  ) {
    const valKm = km || 10;
    transport = valKm * factors.transport.motorbike;
    transportLabel = `Motorbike (${valKm} km)`;
    hasData = true;
  } else if (
    lower.includes('bus') ||
    lower.includes('metro') ||
    lower.includes('train') ||
    lower.includes('public')
  ) {
    const valKm = km || 15;
    transport = valKm * factors.transport.bus;
    transportLabel = `Bus/Metro (${valKm} km)`;
    hasData = true;
  } else if (lower.includes('auto') || lower.includes('rickshaw')) {
    const valKm = km || 8;
    transport = valKm * factors.transport.auto;
    transportLabel = `Auto (${valKm} km)`;
    hasData = true;
  } else if (lower.includes('walk') || lower.includes('cycle') || lower.includes('bicycle')) {
    transport = 0;
    transportLabel = 'Walked/Cycled';
    hasData = true;
  }

  // 2. Diet
  if (lower.includes('vegan')) {
    diet = factors.diet.vegan;
    dietLabel = 'Vegan';
    hasData = true;
  } else if (
    lower.includes('vegetarian') ||
    lower.includes('veg ') ||
    lower.includes('dal') ||
    lower.includes('paneer') ||
    lower.includes('sabzi')
  ) {
    diet = factors.diet.vegetarian;
    dietLabel = 'Vegetarian';
    hasData = true;
  } else if (
    lower.includes('meat') ||
    lower.includes('chicken') ||
    lower.includes('mutton') ||
    lower.includes('beef') ||
    lower.includes('fish') ||
    lower.includes('non-veg') ||
    lower.includes('nonveg') ||
    lower.includes('biryani')
  ) {
    if (lower.includes('heavy') || lower.includes('lot of meat') || lower.includes('bbq') || lower.includes('steak')) {
      diet = factors.diet['meat-heavy'];
      dietLabel = 'Meat-heavy';
    } else {
      diet = factors.diet.mixed;
      dietLabel = 'Mixed (with non-veg)';
    }
    hasData = true;
  } else if (
    lower.includes('mixed') ||
    lower.includes('normal') ||
    lower.includes('regular') ||
    lower.includes('egg')
  ) {
    diet = factors.diet.mixed;
    dietLabel = 'Mixed';
    hasData = true;
  }

  // 3. AC / Energy
  const acMatch = lower.match(/ac.*?(\d+\.?\d*)\s*h|(\d+\.?\d*)\s*h.*?ac/i);
  const acHours = acMatch ? parseFloat(acMatch[1] || acMatch[2]) : 0;

  if (
    lower.includes('ac') ||
    lower.includes('air condition') ||
    lower.includes('cooler') ||
    lower.includes('heater')
  ) {
    const hrs = acHours || 4;
    energy = hrs * factors.energy.ac;
    hasData = true;
  }

  // 4. Flight
  const flightMatch = lower.match(/(\d+\.?\d*)\s*h.*?fl|fl.*?(\d+\.?\d*)\s*h/i);
  if (lower.includes('flew') || lower.includes('flight') || lower.includes('plane')) {
    const hrs = flightMatch ? parseFloat(flightMatch[1] || flightMatch[2]) : 2;
    flight = hrs * factors.flight;
    hasData = true;
  }

  return { transport, diet, energy, flight, dietLabel, transportLabel, hasData };
}

/**
 * Returns descriptive feedback based on user total daily emissions vs benchmark targets.
 * @param {number} total - Daily emissions total (kg CO2e).
 * @param {Object} [benchmarks=BENCHMARKS] - Benchmark reference values.
 * @returns {string} Text comparison feedback.
 */
export function getStandingText(total, benchmarks = BENCHMARKS) {
  if (total <= benchmarks.india) {
    return `That's below both the India average (${benchmarks.india} kg) and the 1.5°C target (${benchmarks.global} kg) — you're doing great today! 🌟`;
  } else if (total <= benchmarks.global) {
    return `You're above the India average (${benchmarks.india} kg) but still under the 1.5°C target (${benchmarks.global} kg) — a solid day with room for a small win.`;
  } else if (total <= 10) {
    return `That's above the 1.5°C target (${benchmarks.global} kg) and the India average (${benchmarks.india} kg), but let's see where we can trim a little.`;
  } else {
    return `That's above both benchmarks, but no worries — big numbers often come from one-off things. Let's spot the easy fix.`;
  }
}
