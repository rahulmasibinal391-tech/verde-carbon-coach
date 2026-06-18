/**
 * @fileoverview DOM interaction, animation and dashboard UI updating methods.
 */

import { state, FACTORS, BENCHMARKS, TRANSPORT_LABELS, DIET_LABELS } from './state.js';
import { getBreakdown, getStandingText } from './calculations.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

/**
 * Checks if the user prefers reduced motion.
 * @returns {boolean} True if reduced motion is requested.
 */
function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Animates the gauge meter according to carbon totals.
 * @param {number} total - Calculated daily emission total (kg CO2e).
 */
export function animateGauge(total) {
  const max = 20;
  const pct = Math.min(total / max, 1);
  const arcLength = 251.33;
  const dashLen = pct * arcLength;

  const arc = $('#gauge-arc');
  const dot = $('#gauge-dot');
  const numEl = $('#gauge-number');

  if (!arc || !dot || !numEl) return;

  // Move gauge arc
  arc.style.strokeDasharray = `${dashLen} ${arcLength}`;

  // Move the dot pointer
  const angle = Math.PI + pct * Math.PI;
  const cx = 100 + 80 * Math.cos(angle);
  const cy = 100 + 80 * Math.sin(angle);
  dot.setAttribute('cx', cx.toString());
  dot.setAttribute('cy', cy.toString());

  // Set dot color
  let color = '#34d399';
  if (total > BENCHMARKS.global) color = '#ef4444';
  else if (total > BENCHMARKS.india) color = '#fbbf24';
  dot.setAttribute('fill', color);

  // Animate numbers
  if (prefersReducedMotion()) {
    numEl.textContent = total.toFixed(1);
    numEl.style.color = color;
  } else {
    animateNumber(numEl, total, color);
  }
}

/**
 * Smoothly interpolates numeric element change.
 * @param {HTMLElement} el - Element showing the number.
 * @param {number} target - Destination float.
 * @param {string} finalColor - Color to transition to.
 */
function animateNumber(el, target, finalColor) {
  const start = parseFloat(el.textContent) || 0;
  const diff = target - start;
  const duration = 400; // faster animation for a snappy UI
  const startTime = performance.now();

  function tick(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    const val = start + diff * eased;
    el.textContent = val.toFixed(1);
    el.style.color = finalColor;
    if (progress < 1) {
      requestAnimationFrame(tick);
    }
  }
  requestAnimationFrame(tick);
}

/**
 * Updates benchmarks bar fills and colors.
 * @param {number} total - Current daily footprint.
 */
export function updateBenchmarks(total) {
  const globalPct = Math.min((total / BENCHMARKS.global) * 100, 100);
  const indiaPct = Math.min((total / BENCHMARKS.india) * 100, 100);

  const globalFill = $('#bench-global-fill');
  const indiaFill = $('#bench-india-fill');

  if (globalFill) {
    globalFill.style.width = `${globalPct}%`;
    globalFill.style.background = total > BENCHMARKS.global
      ? 'linear-gradient(90deg, #fbbf24, #ef4444)'
      : 'linear-gradient(90deg, #34d399, #059669)';
  }
  if (indiaFill) {
    indiaFill.style.width = `${indiaPct}%`;
    indiaFill.style.background = total > BENCHMARKS.india
      ? 'linear-gradient(90deg, #fbbf24, #d97706)'
      : 'linear-gradient(90deg, #34d399, #059669)';
  }
}

/**
 * Renders the weekly goal progress bar on the dashboard.
 */
export function updateWeeklyGoal() {
  const goalCountEl = $('#goal-count');
  const goalProgressFill = $('#goal-progress-fill');
  const goalResultText = $('#goal-result-text');
  if (!goalCountEl || !goalProgressFill || !goalResultText) return;

  const targetDays = 5;
  
  // Calculate success days in the current calendar week (Monday to Sunday)
  const today = new Date();
  const currentDayOfWeek = today.getDay(); // 0 is Sunday, 1 is Monday, etc.
  const distanceToMonday = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1;
  
  const monday = new Date(today);
  monday.setDate(today.getDate() - distanceToMonday);
  monday.setHours(0, 0, 0, 0);

  const startOfWeekStr = monday.toISOString().slice(0, 10);
  
  const weeklyEntries = state.history.filter(e => e.date >= startOfWeekStr);
  const successDays = weeklyEntries.filter(e => e.total <= BENCHMARKS.india).length;

  goalCountEl.textContent = `${successDays}/${targetDays} days`;
  const pct = Math.min((successDays / targetDays) * 100, 100);
  goalProgressFill.style.width = `${pct}%`;

  if (successDays >= targetDays) {
    goalResultText.innerHTML = '🎯 Goal Met! You are tracking beautifully under the national average.';
    goalProgressFill.style.background = 'var(--emerald-400)';
  } else {
    const remaining = targetDays - successDays;
    goalResultText.innerHTML = `Keep it up! Need <strong>${remaining}</strong> more day${remaining > 1 ? 's' : ''} this week under ${BENCHMARKS.india} kg.`;
    goalProgressFill.style.background = 'linear-gradient(90deg, var(--warning), var(--emerald-400))';
  }
}

/**
 * Calculates and updates 7-day rolling emission trends widget.
 */
export function updateTrends() {
  const trendTextEl = $('#trend-comparison-text');
  if (!trendTextEl) return;

  if (state.history.length < 2) {
    trendTextEl.textContent = 'VS. PREVIOUS 7 DAYS: Need at least 2 days of logs to start showing trend analysis.';
    return;
  }

  // Calculate past 7 days average vs preceding 7 days average
  const sorted = [...state.history].sort((a, b) => b.date.localeCompare(a.date));
  
  const last7Days = sorted.slice(0, 7);
  const prior7Days = sorted.slice(7, 14);

  const avgLast7 = last7Days.reduce((sum, e) => sum + e.total, 0) / last7Days.length;

  if (prior7Days.length === 0) {
    trendTextEl.innerHTML = `VS. PREVIOUS: Daily average is <strong>${avgLast7.toFixed(1)} kg</strong>. Keep logging to view weekly trends!`;
    return;
  }

  const avgPrior7 = prior7Days.reduce((sum, e) => sum + e.total, 0) / prior7Days.length;
  const changePct = ((avgLast7 - avgPrior7) / avgPrior7) * 100;

  if (changePct < 0) {
    trendTextEl.innerHTML = `VS. PREVIOUS 7 DAYS: 📉 <strong>${Math.abs(changePct).toFixed(0)}% decrease</strong> (Average: ${avgLast7.toFixed(1)} kg vs ${avgPrior7.toFixed(1)} kg)`;
    trendTextEl.style.color = 'var(--emerald-400)';
  } else if (changePct > 0) {
    trendTextEl.innerHTML = `VS. PREVIOUS 7 DAYS: 📈 <strong>${changePct.toFixed(0)}% increase</strong> (Average: ${avgLast7.toFixed(1)} kg vs ${avgPrior7.toFixed(1)} kg)`;
    trendTextEl.style.color = 'var(--warning)';
  } else {
    trendTextEl.innerHTML = `VS. PREVIOUS 7 DAYS: ➡️ <strong>Unchanged</strong> (Average: ${avgLast7.toFixed(1)} kg)`;
    trendTextEl.style.color = 'var(--text-secondary)';
  }
}

/**
 * Triggers recalculation process and visually updates elements.
 */
export function recalculate() {
  const b = getBreakdown(state);
  const total = b.transport + b.diet + b.energy + b.shopping + b.waste + b.flight;
  animateGauge(total);
  updateBenchmarks(total);
}

/**
 * Redraws logging cards content depending on selection state.
 */
export function renderTrips() {
  const list = $('#trips-list');
  if (!list) return;

  list.innerHTML = state.trips
    .map(
      (t, i) => `
    <div class="trip-tag">
      <span class="trip-tag-info">${TRANSPORT_LABELS[t.mode]} · ${t.km} km</span>
      <span class="trip-tag-emission">${t.emission.toFixed(2)} kg</span>
      <button class="trip-tag-remove" onclick="removeTrip(${i})" aria-label="Remove trip">×</button>
    </div>
  `
    )
    .join('');

  const total = state.trips.reduce((s, t) => s + t.emission, 0);
  const count = state.trips.length;
  
  const summaryEl = $('#transport-summary');
  const emissionEl = $('#transport-emission');
  const card = $('#card-transport');

  if (summaryEl) summaryEl.textContent = count ? `${count} trip${count > 1 ? 's' : ''}` : 'No trips logged';
  if (emissionEl) emissionEl.textContent = `${total.toFixed(1)} kg`;
  if (card) card.classList.toggle('has-value', count > 0);
}

/**
 * Initializes card collapses click listeners.
 */
export function initCards() {
  $$('.card-toggle').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const card = $(`#card-${btn.dataset.card}`);
      if (card) card.classList.toggle('expanded');
    });
  });

  $$('.card-header').forEach((header) => {
    header.addEventListener('click', (e) => {
      if (e.target.closest('button, input, select')) return;
      const card = header.closest('.activity-card');
      if (card) card.classList.toggle('expanded');
    });
  });
}

/**
 * Shows/hides loading skeletons for insights.
 * @param {boolean} show - True to display loading.
 */
export function toggleSkeleton(show) {
  const panel = $('#insights-panel');
  const content = $('#insights-content');
  if (!panel || !content) return;

  if (show) {
    panel.classList.remove('hidden');
    content.innerHTML = `
      <div class="verde-avatar"><span>🌿</span> Verde</div>
      <div class="skeleton-loader">
        <div class="skeleton-line" style="width: 80%"></div>
        <div class="skeleton-line" style="width: 95%"></div>
        <div class="skeleton-line" style="width: 60%"></div>
      </div>
    `;
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}
