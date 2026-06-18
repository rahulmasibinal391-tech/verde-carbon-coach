/**
 * @fileoverview Manages local storage log persistence, logs history list rendering, and accessibility fallbacks.
 */

import { state, STORAGE_KEY, BENCHMARKS } from './state.js';
import { calculateStreak } from './calculations.js';
import { drawChart } from './chart.js';
import { updateWeeklyGoal, updateTrends } from './ui.js';

const $ = (sel) => document.querySelector(sel);

/**
 * Loads history records from LocalStorage.
 */
export function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      state.history = JSON.parse(raw);
    }
  } catch (e) {
    state.history = [];
  }
}

/**
 * Appends or updates today's log entry.
 * @param {number} total - Daily emissions total (kg CO2e).
 * @param {Object} breakdown - Detailed emissions breakdown object.
 */
export function saveDay(total, breakdown) {
  const today = new Date().toISOString().slice(0, 10);
  const existing = state.history.findIndex((e) => e.date === today);
  const entry = { date: today, total: Math.round(total * 10) / 10, breakdown };

  if (existing >= 0) {
    state.history[existing] = entry;
  } else {
    state.history.push(entry);
  }

  // Keep last 30 entries
  if (state.history.length > 30) {
    state.history = state.history.slice(-30);
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.history));
  updateStreak();
  updateWeeklyGoal();
  updateTrends();
}

/**
 * Computes and renders streak updates in the navigation header.
 */
export function updateStreak() {
  const streak = calculateStreak(state.history);
  const el = $('#streak-count');
  if (el) el.textContent = streak.toString();
}

/**
 * Deletes a log entry by date.
 * @param {string} date - Date string in format YYYY-MM-DD.
 */
export function deleteHistoryEntry(date) {
  state.history = state.history.filter((e) => e.date !== date);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.history));
  updateStreak();
  updateWeeklyGoal();
  updateTrends();
  renderHistory();
}

/**
 * Renders history tab view list, triggers canvas redraw, and updates accessibility tables.
 */
export function renderHistory() {
  const list = $('#history-list');
  const emptyEl = $('#history-empty');
  const canvas = $('#history-chart');
  const srTableBody = $('#history-sr-table-body');

  if (!list || !emptyEl || !canvas) return;

  if (state.history.length === 0) {
    emptyEl.style.display = 'flex';
    canvas.style.display = 'none';
    list.innerHTML = '';
    if (srTableBody) srTableBody.innerHTML = '<tr><td colspan="2">No logs recorded yet.</td></tr>';
    return;
  }

  emptyEl.style.display = 'none';
  canvas.style.display = 'block';

  const sorted = [...state.history].sort((a, b) => b.date.localeCompare(a.date));

  // Render standard list
  list.innerHTML = sorted
    .map((entry) => {
      const [y, m, d] = entry.date.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      const dateStr = date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        weekday: 'short'
      });

      let colorClass = 'green';
      let badgeClass = 'under';
      let badgeText = 'Under target';

      if (entry.total > BENCHMARKS.global) {
        colorClass = 'red';
        badgeClass = 'danger';
        badgeText = 'Over target';
      } else if (entry.total > BENCHMARKS.india) {
        colorClass = 'yellow';
        badgeClass = 'over';
        badgeText = 'Above avg';
      }

      return `
      <div class="history-entry">
        <span class="history-date">${dateStr}</span>
        <span class="history-total ${colorClass}">${entry.total.toFixed(1)} kg</span>
        <span class="history-badge ${badgeClass}">${badgeText}</span>
        <button class="history-delete" onclick="deleteHistoryEntry('${entry.date}')" aria-label="Delete entry for ${dateStr}" title="Delete this entry">×</button>
      </div>`;
    })
    .join('');

  // Render screen reader-accessible table
  if (srTableBody) {
    srTableBody.innerHTML = sorted
      .map((entry) => {
        const [y, m, d] = entry.date.split('-').map(Number);
        const date = new Date(y, m - 1, d);
        const dateStr = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        return `
        <tr>
          <td>${dateStr}</td>
          <td>${entry.total.toFixed(1)} kg CO2e</td>
        </tr>`;
      })
      .join('');
  }

  // Draw chart (pass values in chronological order)
  drawChart([...sorted].reverse());
}

// Bind to window to allow deletion via inline onclick attributes
window.deleteHistoryEntry = deleteHistoryEntry;
