/**
 * @fileoverview Main coordinator initializing application components and binding event handlers.
 */

import { state, FACTORS, BENCHMARKS, TRANSPORT_LABELS, DIET_LABELS } from './state.js';
import { getBreakdown, getStandingText } from './calculations.js';
import {
  recalculate,
  renderTrips,
  initCards,
  updateWeeklyGoal,
  updateTrends,
  toggleSkeleton
} from './ui.js';
import { initChat } from './chat.js';
import { loadHistory, updateStreak, renderHistory, saveDay } from './history.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

/**
 * Initializes navbar routing click handlers and applies aria-current tags.
 */
function initNav() {
  $$('.nav-link').forEach((btn) => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      
      // Update links active states and accessibility tags
      $$('.nav-link').forEach((b) => {
        b.classList.remove('active');
        b.removeAttribute('aria-current');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-current', 'page');

      // Swap views visibility
      $$('.view').forEach((v) => {
        v.classList.remove('active-view');
        v.style.display = 'none';
      });

      const target = $(`#view-${view}`);
      if (target) {
        target.style.display = 'block';
        
        // Skip animation if prefers-reduced-motion is active
        const prefersMotion = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (prefersMotion) {
          target.style.animation = 'none';
          target.offsetHeight; // force reflow
          target.style.animation = '';
        }
        target.classList.add('active-view');
      }

      if (view === 'history') {
        renderHistory();
      }
    });
  });
}

/**
 * Parses user trip values, updates state.trips, and triggers renders.
 */
function addTrip() {
  const mode = $('#trip-mode').value;
  const kmInput = $('#trip-km');
  const km = parseFloat(kmInput.value);
  if (!km || km <= 0) return;

  const emission = km * FACTORS.transport[mode];
  state.trips.push({ mode, km, emission });
  kmInput.value = '';
  renderTrips();
  recalculate();
}

/**
 * Removes a trip at a specified index.
 * @param {number} index - Index of trip to remove.
 */
function removeTrip(index) {
  state.trips.splice(index, 1);
  renderTrips();
  recalculate();
}

/**
 * Binds transport additions and validation events.
 */
function initTransport() {
  const addBtn = $('#add-trip-btn');
  const kmInput = $('#trip-km');

  if (addBtn) addBtn.addEventListener('click', addTrip);
  if (kmInput) {
    kmInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addTrip();
    });
  }
}

/**
 * Binds diet choices button actions.
 */
function initDiet() {
  $$('.diet-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('.diet-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.diet = btn.dataset.diet;
      
      const summaryEl = $('#diet-summary');
      const emissionEl = $('#diet-emission');
      const card = $('#card-diet');

      if (summaryEl) summaryEl.textContent = DIET_LABELS[state.diet];
      if (emissionEl) emissionEl.textContent = `${FACTORS.diet[state.diet]} kg`;
      if (card) {
        card.classList.add('has-value');
        card.classList.add('expanded');
      }
      recalculate();
    });
  });
}

/**
 * Handles AC, device, and flight changes updates.
 */
function onEnergyChange() {
  const acInput = $('#ac-hours');
  const deviceInput = $('#device-hours');
  
  state.acHours = acInput ? parseFloat(acInput.value) || 0 : 0;
  state.deviceHours = deviceInput ? parseFloat(deviceInput.value) || 0 : 0;

  const total = state.acHours * FACTORS.energy.ac + state.deviceHours * FACTORS.energy.device;
  const parts = [];
  if (state.acHours > 0) parts.push(`AC ${state.acHours}h`);
  if (state.deviceHours > 0) parts.push(`Devices ${state.deviceHours}h`);

  const summaryEl = $('#energy-summary');
  const emissionEl = $('#energy-emission');
  const card = $('#card-energy');

  if (summaryEl) summaryEl.textContent = parts.length ? parts.join(', ') : 'No usage logged';
  if (emissionEl) emissionEl.textContent = `${total.toFixed(1)} kg`;
  if (card) card.classList.toggle('has-value', total > 0);
  recalculate();
}

/**
 * Handles flight calculations changes updates.
 */
function onFlightChange() {
  const flightInput = $('#flight-hours');
  state.flightHours = flightInput ? parseFloat(flightInput.value) || 0 : 0;

  const total = state.flightHours * FACTORS.flight;
  const summaryEl = $('#flight-summary');
  const emissionEl = $('#flight-emission');
  const card = $('#card-flight');

  if (summaryEl) summaryEl.textContent = state.flightHours > 0 ? `${state.flightHours}h flight time` : 'No flights';
  if (emissionEl) emissionEl.textContent = `${total.toFixed(1)} kg`;
  if (card) card.classList.toggle('has-value', state.flightHours > 0);
  recalculate();
}

/**
 * Binds stepper increase/decrease clicks.
 */
function initEnergy() {
  $$('.stepper-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const target = $(`#${targetId}`);
      if (!target) return;

      const dir = parseInt(btn.dataset.dir);
      let val = parseFloat(target.value) + dir * 0.5;
      val = Math.max(0, Math.min(24, val));
      target.value = val.toString();

      if (targetId === 'flight-hours') {
        onFlightChange();
      } else {
        onEnergyChange();
      }
    });
  });

  const acInput = $('#ac-hours');
  const devInput = $('#device-hours');
  const fliInput = $('#flight-hours');

  if (acInput) acInput.addEventListener('change', onEnergyChange);
  if (devInput) devInput.addEventListener('change', onEnergyChange);
  if (fliInput) fliInput.addEventListener('change', onFlightChange);
}

/**
 * Handles purchase additions updates.
 */
function onShoppingChange() {
  const smallItem = $('#shop-small');
  const electronicsItem = $('#shop-electronics');
  const applianceItem = $('#shop-appliance');

  state.shopping.small = smallItem ? smallItem.checked : false;
  state.shopping.electronics = electronicsItem ? electronicsItem.checked : false;
  state.shopping.appliance = applianceItem ? applianceItem.checked : false;

  let total = 0;
  const items = [];
  if (state.shopping.small) {
    total += FACTORS.shopping.small;
    items.push('Small item');
  }
  if (state.shopping.electronics) {
    total += FACTORS.shopping.electronics;
    items.push('Electronics');
  }
  if (state.shopping.appliance) {
    total += FACTORS.shopping.appliance;
    items.push('Appliance');
  }

  const summaryEl = $('#shopping-summary');
  const emissionEl = $('#shopping-emission');
  const card = $('#card-shopping');

  if (summaryEl) summaryEl.textContent = items.length ? items.join(', ') : 'No purchases';
  if (emissionEl) emissionEl.textContent = `${total.toFixed(1)} kg`;
  if (card) card.classList.toggle('has-value', total > 0);
  recalculate();
}

/**
 * Binds shopping inputs changes.
 */
function initShopping() {
  ['shop-small', 'shop-electronics', 'shop-appliance'].forEach((id) => {
    const el = $(`#${id}`);
    if (el) el.addEventListener('change', onShoppingChange);
  });
}

/**
 * Binds food waste buttons events.
 */
function initWaste() {
  $$('.waste-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('.waste-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.waste = btn.dataset.waste;

      const labels = { none: 'None', little: 'A little', lot: 'A lot' };
      const val = FACTORS.waste[state.waste];
      
      const summaryEl = $('#waste-summary');
      const emissionEl = $('#waste-emission');

      if (summaryEl) summaryEl.textContent = labels[state.waste] || 'None';
      if (emissionEl) emissionEl.textContent = `+${val.toFixed(1)} kg`;
      recalculate();
    });
  });
}

/**
 * Safe local rule-based fallback generation for client in case of complete server disconnect.
 * @param {Object} b - Breakdown emissions dataset.
 * @param {number} total - Calculated footprint summation.
 * @returns {string} Fully structured HTML content snippet.
 */
function renderLocalRuleBasedInsights(b, total) {
  const categories = {
    Transport: b.transport,
    Diet: b.diet,
    Energy: b.energy,
    Shopping: b.shopping,
    'Food Waste': b.waste,
    Flights: b.flight
  };

  let biggest = '';
  let biggestVal = 0;
  for (const [cat, val] of Object.entries(categories)) {
    if (val > biggestVal) {
      biggestVal = val;
      biggest = cat;
    }
  }

  const standingText = getStandingText(total);
  const maxCat = Math.max(...Object.values(categories), 1);
  
  const breakdownHTML = Object.entries(categories)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([cat, val]) => {
      const cls = cat.toLowerCase().replace(' ', '');
      const catCls = {
        transport: 'transport',
        diet: 'diet',
        energy: 'energy',
        shopping: 'shopping',
        foodwaste: 'waste',
        flights: 'flight'
      }[cls] || 'transport';
      const pct = (val / maxCat) * 100;
      return `
      <div class="breakdown-row">
        <span class="breakdown-label">${cat}</span>
        <div class="breakdown-track"><div class="breakdown-fill ${catCls}" style="width:${pct}%"></div></div>
        <span class="breakdown-val">${val.toFixed(1)} kg</span>
      </div>`;
    })
    .join('');

  return `
    <p>Your daily total is <span class="insight-stat">${total.toFixed(1)} kg CO2e</span>. ${standingText}</p>
    <div class="breakdown-bars">${breakdownHTML}</div>
    <p>Your biggest contributor today is <strong>${biggest}</strong> at ${biggestVal.toFixed(1)} kg.</p>
    <div class="insight-tip">Try to reduce ${biggest.toLowerCase()} usage tomorrow to make a positive impact!</div>
    <p class="insight-encourage">Every small choice counts. Tracking is the first step! 🌍</p>
  `;
}

/**
 * Calls backend API to fetch Gemini-powered insights based on history and breakdown.
 */
async function generateInsights() {
  const b = getBreakdown(state);
  const total = b.transport + b.diet + b.energy + b.shopping + b.waste + b.flight;
  const panel = $('#insights-panel');
  const content = $('#insights-content');

  if (!panel || !content) return;

  if (total === 0) {
    panel.classList.remove('hidden');
    content.innerHTML = `
      <div class="verde-avatar"><span>🌿</span> Verde</div>
      <p>Hmm, looks like you haven't logged anything yet! Tell me about your day — how did you get around, what did you eat, and did you run the AC or any appliances?</p>
    `;
    return;
  }

  // Display skeletons UI immediately
  toggleSkeleton(true);

  try {
    const response = await fetch('/api/insights', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        breakdown: b,
        history: state.history.slice(-14)
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    let badgeHTML = '';
    if (data.source === 'gemini') {
      badgeHTML = '<span class="ai-badge">AI-powered</span>';
    }

    content.innerHTML = `
      <div class="verde-avatar"><span>🌿</span> Verde ${badgeHTML}</div>
      ${data.insights}
    `;
    panel.classList.remove('hidden');

    // Save to persistence
    saveDay(total, b);
    renderHistory();
  } catch (error) {
    console.error('Insights Dispatch Error:', error);
    
    // Client-side hard rule-based generation fallback
    const fallbackHTML = renderLocalRuleBasedInsights(b, total);
    content.innerHTML = `
      <div class="verde-avatar"><span>🌿</span> Verde <span class="ai-badge" style="background:var(--text-muted)">Offline</span></div>
      ${fallbackHTML}
    `;
    panel.classList.remove('hidden');

    saveDay(total, b);
    renderHistory();
  }
}

/**
 * Wires up insights button.
 */
function initInsights() {
  const btn = $('#get-insights-btn');
  if (btn) btn.addEventListener('click', generateInsights);
}

/**
 * Resets entire logging state.
 */
function resetDay() {
  state.trips = [];
  state.diet = null;
  state.acHours = 0;
  state.deviceHours = 0;
  state.flightHours = 0;
  state.shopping = { small: false, electronics: false, appliance: false };
  state.waste = 'none';

  // Forms reset
  renderTrips();
  $$('.diet-btn').forEach((b) => b.classList.remove('active'));
  
  const dietSummary = $('#diet-summary');
  const dietEmission = $('#diet-emission');
  const cardDiet = $('#card-diet');

  if (dietSummary) dietSummary.textContent = 'Not selected';
  if (dietEmission) dietEmission.textContent = '0 kg';
  if (cardDiet) cardDiet.classList.remove('has-value');

  const acHours = $('#ac-hours');
  const devHours = $('#device-hours');
  const fliHours = $('#flight-hours');
  const shopSmall = $('#shop-small');
  const shopElec = $('#shop-electronics');
  const shopAppl = $('#shop-appliance');

  if (acHours) acHours.value = '0';
  if (devHours) devHours.value = '0';
  onEnergyChange();

  if (fliHours) fliHours.value = '0';
  onFlightChange();

  if (shopSmall) shopSmall.checked = false;
  if (shopElec) shopElec.checked = false;
  if (shopAppl) shopAppl.checked = false;
  onShoppingChange();

  $$('.waste-btn').forEach((b) => b.classList.remove('active'));
  const wasteBtnNone = $('.waste-btn[data-waste="none"]');
  if (wasteBtnNone) wasteBtnNone.classList.add('active');
  
  const wasteSummary = $('#waste-summary');
  const wasteEmission = $('#waste-emission');

  if (wasteSummary) wasteSummary.textContent = 'None';
  if (wasteEmission) wasteEmission.textContent = '+0.0 kg';

  // Insights panel collapse
  const insightsPanel = $('#insights-panel');
  if (insightsPanel) insightsPanel.classList.add('hidden');

  // Collapse grid cards
  $$('.activity-card').forEach((c) => c.classList.remove('expanded', 'has-value'));

  recalculate();
}

/**
 * Initializes splash screen dismissal timers and triggers.
 */
function initSplash() {
  const splash = $('#splash');
  const app = $('#app');
  
  const dismissSplash = () => {
    if (splash && !splash.classList.contains('fade-out')) {
      splash.classList.add('fade-out');
      if (app) app.classList.remove('hidden');
      
      const prefersMotion = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const removeDelay = prefersMotion ? 600 : 0;
      setTimeout(() => {
        if (splash.parentNode) {
          splash.remove();
        }
      }, removeDelay);
    }
  };

  // Auto skip after 2.2s
  const timeoutId = setTimeout(dismissSplash, 2200);

  // Fallback: Click splash to skip immediately
  if (splash) {
    splash.addEventListener('click', () => {
      clearTimeout(timeoutId);
      dismissSplash();
    });
  }
}

// Dom Loader bootstrap
document.addEventListener('DOMContentLoaded', () => {
  loadHistory();
  initSplash();
  initNav();
  initCards();
  initTransport();
  initDiet();
  initEnergy();
  initShopping();
  initWaste();
  initInsights();
  initChat();
  updateStreak();
  updateWeeklyGoal();
  updateTrends();
  recalculate();
});

// Expose removal, deletion and reset to global window namespace
window.removeTrip = removeTrip;
window.resetDay = resetDay;
