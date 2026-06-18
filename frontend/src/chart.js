/**
 * @fileoverview Canvas-based charting engine for footprint trends.
 */

import { BENCHMARKS } from './state.js';

const $ = (sel) => document.querySelector(sel);

/**
 * Draws the history trend line chart on the HTML5 canvas.
 * @param {Array.<Object>} data - Chronological history entries list.
 */
export function drawChart(data) {
  // Check if view-history is currently active/visible in DOM
  const historyView = $('#view-history');
  if (!historyView || window.getComputedStyle(historyView).display === 'none') {
    return;
  }

  const canvas = $('#history-chart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const parent = canvas.parentElement;
  if (!parent) return;

  const rect = parent.getBoundingClientRect();
  
  // Set dimensions based on pixel ratio for high DPI displays
  canvas.width = rect.width * dpr;
  canvas.height = (rect.height - 40) * dpr;
  canvas.style.width = rect.width + 'px';
  canvas.style.height = (rect.height - 40) + 'px';
  ctx.scale(dpr, dpr);

  const w = rect.width;
  const h = rect.height - 40;
  const pad = { top: 20, right: 25, bottom: 30, left: 40 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;

  ctx.clearRect(0, 0, w, h);

  if (!data || data.length < 1) return;

  const maxVal = Math.max(...data.map((d) => d.total), BENCHMARKS.global + 1);
  const xStep = data.length > 1 ? plotW / (data.length - 1) : plotW / 2;

  // Draw benchmark lines
  [BENCHMARKS.india, BENCHMARKS.global].forEach((bench, i) => {
    const y = pad.top + plotH - (bench / maxVal) * plotH;
    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = i === 0 ? 'rgba(251, 191, 36, 0.35)' : 'rgba(239, 68, 68, 0.35)';
    ctx.lineWidth = 1;
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + plotW, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = i === 0 ? '#fbbf24' : '#ef4444';
    ctx.font = '10px Inter';
    ctx.textAlign = 'left';
    ctx.fillText(i === 0 ? `🇮🇳 ${bench}` : `🌍 ${bench}`, pad.left + plotW + 4, y + 3);
  });

  // Plot coordinates
  const points = data.map((d, i) => ({
    x: pad.left + (data.length > 1 ? i * xStep : plotW / 2),
    y: pad.top + plotH - (d.total / maxVal) * plotH
  }));

  // Gradient area fill
  const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + plotH);
  grad.addColorStop(0, 'rgba(52, 211, 153, 0.25)');
  grad.addColorStop(1, 'rgba(52, 211, 153, 0)');

  ctx.beginPath();
  ctx.moveTo(points[0].x, pad.top + plotH);
  points.forEach((p) => ctx.lineTo(p.x, p.y));
  ctx.lineTo(points[points.length - 1].x, pad.top + plotH);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Draw trend line
  ctx.beginPath();
  points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.strokeStyle = '#34d399';
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // Draw data point circles
  points.forEach((p, i) => {
    const val = data[i].total;
    let color = '#34d399';
    if (val > BENCHMARKS.global) color = '#ef4444';
    else if (val > BENCHMARKS.india) color = '#fbbf24';

    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  // Render X-Axis labels
  ctx.fillStyle = 'rgba(148, 163, 184, 0.65)';
  ctx.font = '10px Inter';
  ctx.textAlign = 'center';
  const labelStep = Math.max(1, Math.floor(data.length / 7));
  data.forEach((d, i) => {
    if (i % labelStep === 0 || i === data.length - 1) {
      const date = new Date(d.date);
      const label = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      ctx.fillText(label, points[i].x, pad.top + plotH + 18);
    }
  });
}
