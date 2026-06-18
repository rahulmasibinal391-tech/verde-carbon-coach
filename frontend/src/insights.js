/**
 * @fileoverview Insight generation module — tries Gemini AI first, falls back to rule-based.
 * Extracted from main.js for modularity.
 */

import { state, BENCHMARKS } from './state.js';
import { getBreakdown, getStandingText } from './calculations.js';
import { toggleSkeleton, updateWeeklyGoal } from './ui.js';
import { saveDay, renderHistory } from './history.js';
import { getGeminiInsight } from './gemini.js';
import { trackEvent } from './analytics.js';

const $ = (sel) => document.querySelector(sel);

/**
 * Returns weekly goal data for AI prompt context.
 * @returns {{ targetDays: number, daysUnder: number }}
 */
function getWeeklyGoalData() {
  const targetDays = 5;
  const today = new Date();
  const currentDayOfWeek = today.getDay();
  const distanceToMonday = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1;

  const monday = new Date(today);
  monday.setDate(today.getDate() - distanceToMonday);
  monday.setHours(0, 0, 0, 0);

  const startOfWeekStr = monday.toISOString().slice(0, 10);
  const weeklyEntries = state.history.filter(e => e.date >= startOfWeekStr);
  const daysUnder = weeklyEntries.filter(e => e.total <= BENCHMARKS.india).length;

  return { targetDays, daysUnder };
}

/**
 * Generates a local rule-based insight when Gemini is unavailable.
 * @param {Object} b - Breakdown emissions dataset.
 * @param {number} total - Calculated footprint total in kg CO2e.
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
    .sort(([, a], [, valB]) => valB - a)
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
 * Main insight generation entry point. Tries Gemini AI, falls back to rule-based.
 * Shows skeleton loader during async fetch.
 */
export async function generateInsights() {
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

  // Show skeleton loader immediately
  toggleSkeleton(true);

  // Try Gemini AI first
  let source = 'rule-based';
  let insightHTML = null;

  try {
    const weeklyGoal = getWeeklyGoalData();
    const geminiResult = await getGeminiInsight(b, state.history.slice(-14), weeklyGoal);

    if (geminiResult) {
      insightHTML = geminiResult;
      source = 'gemini';
    }
  } catch (err) {
    console.error('Gemini insight dispatch error:', err);
  }

  // Fall back to rule-based if Gemini returned null
  if (!insightHTML) {
    insightHTML = renderLocalRuleBasedInsights(b, total);
  }

  // Render the result with appropriate badge
  const badgeHTML = source === 'gemini'
    ? '<span class="ai-badge">✨ AI-powered</span>'
    : '<span class="ai-badge" style="background:var(--text-muted)">📋 Quick analysis</span>';

  content.innerHTML = `
    <div class="verde-avatar"><span>🌿</span> Verde ${badgeHTML}</div>
    ${insightHTML}
  `;
  panel.classList.remove('hidden');

  // Track the event
  trackEvent('get_insights', { source, total: total.toFixed(1) });

  // Save to persistence
  saveDay(total, b);
  renderHistory();
}
