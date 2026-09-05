/**
 * Credit calculation logic.
 *
 * Formula:
 *   costUSD = (inputTokens / 1_000_000 × inputPricePer1M)
 *           + (outputTokens / 1_000_000 × outputPricePer1M)
 *
 *   creditsToDeduct = costUSD × creditsPerUSD × platformFeeMultiplier
 *
 * Defaults:
 *   - creditsPerUSD = 100 (1 USD = 100 credits)
 *   - platformFeeMultiplier = 1.33 (33% markup)
 */

export interface CostInput {
  inputTokens: number;
  outputTokens: number;
  inputPricePer1M: number;   // USD per 1M input tokens
  outputPricePer1M: number;  // USD per 1M output tokens
}

export interface CostResult {
  /** Raw cost in USD before markup */
  rawCostUSD: number;
  /** Cost in USD after platform fee */
  costUSD: number;
  /** Credits to deduct from user balance */
  creditsToDeduct: number;
}

/**
 * Calculate the credit cost for a build.
 *
 * @param input - Token counts and model pricing
 * @param creditsPerUSD - How many credits = 1 USD (from admin_config)
 * @param platformFeeMultiplier - Markup multiplier (from admin_config)
 */
export function calculateBuildCost(
  input: CostInput,
  creditsPerUSD = 100,
  platformFeeMultiplier = 1.33,
): CostResult {
  const rawCostUSD =
    (input.inputTokens / 1_000_000) * input.inputPricePer1M +
    (input.outputTokens / 1_000_000) * input.outputPricePer1M;

  const costUSD = rawCostUSD * platformFeeMultiplier;
  const creditsToDeduct = costUSD * creditsPerUSD;

  return {
    rawCostUSD: round6(rawCostUSD),
    costUSD: round6(costUSD),
    creditsToDeduct: round2(creditsToDeduct),
  };
}

/**
 * Check if a user has enough credits for a build.
 */
export function hasEnoughCredits(
  userCredits: number,
  minCreditsForBuild: number,
): boolean {
  return userCredits >= minCreditsForBuild;
}

function round6(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
