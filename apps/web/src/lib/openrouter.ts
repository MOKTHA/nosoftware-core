/**
 * OpenRouter API helpers — model pricing and usage tracking.
 *
 * Uses the OpenRouter REST API to:
 *   1. Fetch current model pricing ($/1M tokens)
 *   2. Track token usage from completions responses
 */

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

export interface ModelPricing {
  inputPricePer1M: number;
  outputPricePer1M: number;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

/** Cache pricing for 10 minutes to avoid hammering the API. */
const pricingCache = new Map<string, { pricing: ModelPricing; fetchedAt: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 min

/**
 * Fetch pricing for a model from OpenRouter.
 * Returns price per 1M tokens for input and output.
 */
export async function getModelPricing(model: string): Promise<ModelPricing> {
  const cached = pricingCache.get(model);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.pricing;
  }

  try {
    const res = await fetch(`${OPENROUTER_BASE}/models`, {
      headers: { 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
      // Fallback to conservative defaults
      return getDefaultPricing(model);
    }

    const data = (await res.json()) as {
      data: Array<{
        id: string;
        pricing: { prompt: string; completion: string };
      }>;
    };

    const modelData = data.data.find((m) => m.id === model);
    if (!modelData) {
      return getDefaultPricing(model);
    }

    // OpenRouter returns $/token, convert to $/1M tokens
    const pricing: ModelPricing = {
      inputPricePer1M: parseFloat(modelData.pricing.prompt) * 1_000_000,
      outputPricePer1M: parseFloat(modelData.pricing.completion) * 1_000_000,
    };

    pricingCache.set(model, { pricing, fetchedAt: Date.now() });
    return pricing;
  } catch {
    return getDefaultPricing(model);
  }
}

/**
 * Extract token usage from an OpenRouter completion response.
 */
export function extractTokenUsage(response: {
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}): TokenUsage {
  return {
    inputTokens: response.usage?.prompt_tokens ?? 0,
    outputTokens: response.usage?.completion_tokens ?? 0,
  };
}

/**
 * Conservative default pricing when API is unavailable.
 * Based on typical Claude Sonnet 4 pricing.
 */
function getDefaultPricing(model: string): ModelPricing {
  // Claude Sonnet 4 defaults
  if (model.includes('claude-sonnet')) {
    return { inputPricePer1M: 3.0, outputPricePer1M: 15.0 };
  }
  // Claude Haiku
  if (model.includes('claude-haiku')) {
    return { inputPricePer1M: 0.25, outputPricePer1M: 1.25 };
  }
  // Claude Opus
  if (model.includes('claude-opus')) {
    return { inputPricePer1M: 15.0, outputPricePer1M: 75.0 };
  }
  // GPT-4o
  if (model.includes('gpt-4o')) {
    return { inputPricePer1M: 2.5, outputPricePer1M: 10.0 };
  }
  // Default (assume Sonnet-level)
  return { inputPricePer1M: 3.0, outputPricePer1M: 15.0 };
}
