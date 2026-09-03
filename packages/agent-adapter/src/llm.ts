/**
 * @heynxt/agent-adapter — OpenRouter LLM Helper
 *
 * Thin wrapper around the OpenRouter chat completions API.
 * Used by generation stages that need LLM output (schema,
 * backend routes, frontend pages).
 *
 * Requires `OPENROUTER_API_KEY` in `process.env`.
 */

/** ------------------------------------------------------------------ */
/*  Types                                                             */
/** ------------------------------------------------------------------ */

export interface OpenRouterCallOptions {
  model: string;
  systemPrompt: string;
  userPrompt: string;
}

/** ------------------------------------------------------------------ */
/*  Constants                                                         */
/** ------------------------------------------------------------------ */

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

/** ------------------------------------------------------------------ */
/*  Main function                                                     */
/** ------------------------------------------------------------------ */

/**
 * Call the OpenRouter chat completions API and return the assistant
 * message content as a string.
 *
 * @throws {Error} When `OPENROUTER_API_KEY` is not set.
 * @throws {Error} When the API returns a non-2xx status.
 */
export async function callOpenRouter(
  opts: OpenRouterCallOptions,
): Promise<string> {
  const apiKey = process.env['OPENROUTER_API_KEY'];
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set');

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://nosoftware.ai',
      'X-Title': 'NoSoftware.ai',
    },
    body: JSON.stringify({
      model: opts.model,
      messages: [
        { role: 'system', content: opts.systemPrompt },
        { role: 'user', content: opts.userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${body}`);
  }

  const json = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  return json.choices[0]?.message?.content ?? '';
}
