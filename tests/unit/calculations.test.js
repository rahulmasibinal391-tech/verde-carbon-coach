/**
 * @fileoverview Unit tests for calculations.js core carbon emissions and parser logic.
 */

import { describe, it, expect } from 'vitest';
import {
  getBreakdown,
  calculateStreak,
  parseActivities,
  getStandingText,
  computeEmission
} from '../../frontend/src/calculations.js';

describe('Carbon Emission Calculations', () => {
  it('should calculate emission breakdown correctly for mixed activities', () => {
    const mockState = {
      trips: [
        { mode: 'car', km: 10, emission: 2.1 }, // 10 * 0.21 = 2.1
        { mode: 'bus', km: 20, emission: 0.8 }  // 20 * 0.04 = 0.8
      ],
      diet: 'vegetarian', // 2.5
      acHours: 2,         // 2 * 0.82 = 1.64
      deviceHours: 4,     // 4 * 0.05 = 0.20
      shopping: {
        small: true,       // 3.5
        electronics: true, // 15
        appliance: false
      },
      waste: 'little',     // 0.3
      flightHours: 1.5     // 1.5 * 90 = 135
    };

    const breakdown = getBreakdown(mockState);
    expect(breakdown.transport).toBeCloseTo(2.9);
    expect(breakdown.diet).toBe(2.5);
    expect(breakdown.energy).toBeCloseTo(1.84);
    expect(breakdown.shopping).toBe(18.5);
    expect(breakdown.waste).toBe(0.3);
    expect(breakdown.flight).toBe(135);
  });

  it('should calculate zero emissions for empty state', () => {
    const mockState = {
      trips: [],
      diet: null,
      acHours: 0,
      deviceHours: 0,
      shopping: { small: false, electronics: false, appliance: false },
      waste: 'none',
      flightHours: 0
    };
    const breakdown = getBreakdown(mockState);
    expect(breakdown.transport).toBe(0);
    expect(breakdown.diet).toBe(0);
    expect(breakdown.energy).toBe(0);
    expect(breakdown.shopping).toBe(0);
    expect(breakdown.waste).toBe(0);
    expect(breakdown.flight).toBe(0);
  });
});

describe('Streak Calculations', () => {
  it('should return 0 streak for empty history log', () => {
    const streak = calculateStreak([], new Date('2026-06-18'));
    expect(streak).toBe(0);
  });

  it('should calculate streak when today is logged', () => {
    const history = [
      { date: '2026-06-18', total: 5.0 },
      { date: '2026-06-17', total: 6.0 },
      { date: '2026-06-16', total: 5.5 }
    ];
    const streak = calculateStreak(history, new Date('2026-06-18'));
    expect(streak).toBe(3);
  });

  it('should calculate streak when today is not logged but yesterday is', () => {
    const history = [
      { date: '2026-06-17', total: 6.0 },
      { date: '2026-06-16', total: 5.5 }
    ];
    const streak = calculateStreak(history, new Date('2026-06-18'));
    expect(streak).toBe(2);
  });

  it('should break streak when there is a date gap', () => {
    const history = [
      { date: '2026-06-18', total: 5.0 },
      { date: '2026-06-15', total: 6.0 } // gap here
    ];
    const streak = calculateStreak(history, new Date('2026-06-18'));
    expect(streak).toBe(1);
  });
});

describe('Natural Language Activities Parser', () => {
  it('should extract transport and diet correctly', () => {
    const parsed = parseActivities('I drove my car for 20 km and ate a vegetarian lunch.');
    expect(parsed.hasData).toBe(true);
    expect(parsed.transportLabel).toContain('Car');
    expect(parsed.dietLabel).toBe('Vegetarian');
    expect(parsed.transport).toBeCloseTo(4.2); // 20 * 0.21
    expect(parsed.diet).toBe(2.5);
  });

  it('should extract energy ac hours and flight hours', () => {
    const parsed = parseActivities('Had my AC on for 8h after a 3h flight.');
    expect(parsed.hasData).toBe(true);
    expect(parsed.energy).toBeCloseTo(8 * 0.82);
    expect(parsed.flight).toBe(3 * 90);
  });

  it('should return hasData false for irrelevant text', () => {
    const parsed = parseActivities('Hello Verde! Just telling you that I am checking out the app.');
    expect(parsed.hasData).toBe(false);
  });
});

describe('Emissions Standing Feedback Text', () => {
  it('should return appropriate standings under benchmarks', () => {
    const standingUnderBoth = getStandingText(4.0);
    expect(standingUnderBoth).toContain('below both the India average');

    const standingUnderTargetOnly = getStandingText(5.8);
    expect(standingUnderTargetOnly).toContain('above the India average');
    expect(standingUnderTargetOnly).toContain('under the 1.5°C target');

    const standingOverBoth = getStandingText(8.5);
    expect(standingOverBoth).toContain('above the 1.5°C target');
  });
});

describe('Individual Transport Emission Calculation', () => {
  it('should calculate emission correctly for various transport modes', () => {
    expect(computeEmission('car', 10)).toBeCloseTo(2.1);
    expect(computeEmission('cycle', 5)).toBe(0);
    expect(computeEmission('bus', 15)).toBeCloseTo(0.6);
    expect(computeEmission('auto', 8)).toBeCloseTo(1.2);
    expect(computeEmission('motorbike', 10)).toBeCloseTo(1.1);
    expect(computeEmission('unknown_mode', 10)).toBe(0);
  });
});

