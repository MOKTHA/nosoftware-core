/**
 * Unit tests for credit-calculator.ts
 *
 * Credit formula:
 *   rawCostUSD = (inputTokens / 1M × inputPricePer1M) + (outputTokens / 1M × outputPricePer1M)
 *   costUSD = rawCostUSD × platformFeeMultiplier
 *   creditsToDeduct = costUSD × creditsPerUSD
 */
import { describe, it, expect } from 'vitest';
import { calculateBuildCost, hasEnoughCredits } from '../credit-calculator';

describe('calculateBuildCost', () => {
  it('calculates cost with default multipliers', () => {
    const result = calculateBuildCost({
      inputTokens: 10_000,
      outputTokens: 5_000,
      inputPricePer1M: 3.0,   // Claude Sonnet input
      outputPricePer1M: 15.0, // Claude Sonnet output
    });

    // rawCostUSD = (10000/1M × 3.0) + (5000/1M × 15.0) = 0.03 + 0.075 = 0.105
    expect(result.rawCostUSD).toBeCloseTo(0.105, 6);

    // costUSD = 0.105 × 1.33 = 0.13965
    expect(result.costUSD).toBeCloseTo(0.13965, 5);

    // creditsToDeduct = 0.13965 × 100 = 13.965 → rounded to 13.97
    expect(result.creditsToDeduct).toBeCloseTo(13.97, 2);
  });

  it('calculates cost with custom creditsPerUSD', () => {
    const result = calculateBuildCost(
      {
        inputTokens: 1_000_000,
        outputTokens: 500_000,
        inputPricePer1M: 3.0,
        outputPricePer1M: 15.0,
      },
      200, // 1 USD = 200 credits
    );

    // rawCostUSD = (1M/1M × 3.0) + (500K/1M × 15.0) = 3.0 + 7.5 = 10.5
    expect(result.rawCostUSD).toBeCloseTo(10.5, 6);

    // costUSD = 10.5 × 1.33 = 13.965
    expect(result.costUSD).toBeCloseTo(13.965, 5);

    // creditsToDeduct = 13.965 × 200 = 2793
    expect(result.creditsToDeduct).toBeCloseTo(2793, 0);
  });

  it('calculates cost with custom fee multiplier', () => {
    const result = calculateBuildCost(
      {
        inputTokens: 100_000,
        outputTokens: 50_000,
        inputPricePer1M: 3.0,
        outputPricePer1M: 15.0,
      },
      100,
      1.5, // 50% markup
    );

    // rawCostUSD = (100K/1M × 3.0) + (50K/1M × 15.0) = 0.3 + 0.75 = 1.05
    expect(result.rawCostUSD).toBeCloseTo(1.05, 6);

    // costUSD = 1.05 × 1.5 = 1.575
    expect(result.costUSD).toBeCloseTo(1.575, 5);

    // creditsToDeduct = 1.575 × 100 = 157.5
    expect(result.creditsToDeduct).toBeCloseTo(157.5, 2);
  });

  it('returns zero cost for zero tokens', () => {
    const result = calculateBuildCost({
      inputTokens: 0,
      outputTokens: 0,
      inputPricePer1M: 3.0,
      outputPricePer1M: 15.0,
    });

    expect(result.rawCostUSD).toBe(0);
    expect(result.costUSD).toBe(0);
    expect(result.creditsToDeduct).toBe(0);
  });

  it('handles Haiku pricing (cheaper model)', () => {
    const result = calculateBuildCost({
      inputTokens: 50_000,
      outputTokens: 10_000,
      inputPricePer1M: 0.25,
      outputPricePer1M: 1.25,
    });

    // rawCostUSD = (50K/1M × 0.25) + (10K/1M × 1.25) = 0.0125 + 0.0125 = 0.025
    expect(result.rawCostUSD).toBeCloseTo(0.025, 6);

    // costUSD = 0.025 × 1.33 = 0.03325
    expect(result.costUSD).toBeCloseTo(0.03325, 5);

    // creditsToDeduct = 0.03325 × 100 = 3.325 → 3.33
    expect(result.creditsToDeduct).toBeCloseTo(3.33, 2);
  });

  it('handles Opus pricing (expensive model)', () => {
    const result = calculateBuildCost({
      inputTokens: 100_000,
      outputTokens: 50_000,
      inputPricePer1M: 15.0,
      outputPricePer1M: 75.0,
    });

    // rawCostUSD = (100K/1M × 15) + (50K/1M × 75) = 1.5 + 3.75 = 5.25
    expect(result.rawCostUSD).toBeCloseTo(5.25, 6);

    // costUSD = 5.25 × 1.33 = 6.9825
    expect(result.costUSD).toBeCloseTo(6.9825, 4);

    // creditsToDeduct = 6.9825 × 100 = 698.25
    expect(result.creditsToDeduct).toBeCloseTo(698.25, 2);
  });
});

describe('hasEnoughCredits', () => {
  it('returns true when balance exceeds minimum', () => {
    expect(hasEnoughCredits(100, 10)).toBe(true);
  });

  it('returns true when balance equals minimum', () => {
    expect(hasEnoughCredits(10, 10)).toBe(true);
  });

  it('returns false when balance is below minimum', () => {
    expect(hasEnoughCredits(5, 10)).toBe(false);
  });

  it('returns true when minimum is zero', () => {
    expect(hasEnoughCredits(0, 0)).toBe(true);
  });

  it('returns false with zero balance and positive minimum', () => {
    expect(hasEnoughCredits(0, 1)).toBe(false);
  });
});
