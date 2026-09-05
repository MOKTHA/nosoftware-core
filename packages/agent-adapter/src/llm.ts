/**
 * @heynxt/agent-adapter — OpenRouter LLM Helper
 *
 * Two modes:
 *
 * 1. `callOpenRouter()` — Thin wrapper around the OpenRouter chat completions API.
 *    Used by generation stages that need simple LLM text output.
 *
 * 2. `callModelWithSkills()` — Uses the @openrouter/agent SDK with the
 *    skills-loader pattern (tool + nextTurnParams) for dynamic context
 *    injection. See: https://openrouter.ai/docs/agent-sdk/call-model/examples/skills-loader
 *
 * Requires `OPENROUTER_API_KEY` in `process.env`.
 */

import { OpenRouter, callModel, stepCountIs } from '@openrouter/agent';
import {
  skillLoaderTool,
  multiSkillLoaderTool,
  skillDiscoveryTool,
  listAvailableSkills,
  resolveSkillsDirectory,
} from './skills-loader.js';

/** ------------------------------------------------------------------ */
/*  Types                                                             */
/** ------------------------------------------------------------------ */

export interface OpenRouterCallOptions {
  model: string;
  systemPrompt: string;
  userPrompt: string;
}

/** Token usage returned from each OpenRouter API call. */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
}

/** Result from callOpenRouter — content + actual token usage from the API. */
export interface OpenRouterResult {
  content: string;
  usage: TokenUsage;
}

export interface SkillModelCallOptions {
  /** Model to use (e.g. 'anthropic/claude-sonnet-4') */
  model: string;
  /** User prompt / task description */
  input: string;
  /** Skills to preload before the LLM runs (e.g. ['senior-frontend', 'ui-design-system']) */
  skills?: string[];
  /** Also load reference docs for preloaded skills */
  includeReferences?: boolean;
  /** System prompt to prepend */
  systemPrompt?: string;
  /** Max agent turns (default 5) */
  maxSteps?: number;
}

/** ------------------------------------------------------------------ */
/*  Constants                                                         */
/** ------------------------------------------------------------------ */

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

/** ------------------------------------------------------------------ */
/*  Mode 1: Raw API (backward compatible)                             */
/** ------------------------------------------------------------------ */

/**
 * Global accumulator for token usage across all pipeline stages.
 * Reset at the start of each pipeline run via `resetTokenAccumulator()`.
 */
const _tokenAccumulator: TokenUsage = { promptTokens: 0, completionTokens: 0 };

/** Reset the token accumulator (call at start of each pipeline run). */
export function resetTokenAccumulator(): void {
  _tokenAccumulator.promptTokens = 0;
  _tokenAccumulator.completionTokens = 0;
}

/** Get accumulated token usage from all callOpenRouter calls since last reset. */
export function getAccumulatedTokenUsage(): TokenUsage {
  return { ..._tokenAccumulator };
}

/**
 * Call the OpenRouter chat completions API and return the assistant
 * message content as a string.
 *
 * Token usage from each call is automatically accumulated in the
 * global token accumulator. Use `getAccumulatedTokenUsage()` after
 * the pipeline completes to get the total, and `resetTokenAccumulator()`
 * at the start of each pipeline run.
 *
 * @throws {Error} When `OPENROUTER_API_KEY` is not set.
 * @throws {Error} When the API returns a non-2xx status.
 */
export async function callOpenRouter(
  opts: OpenRouterCallOptions,
): Promise<string> {
  const result = await callOpenRouterWithUsage(opts);
  return result.content;
}

/**
 * Call the OpenRouter chat completions API and return both the content
 * and the token usage reported by the API.
 *
 * This is the underlying call that `callOpenRouter()` delegates to.
 * Use this when you need direct access to the usage data for a
 * specific call (e.g. logging). For pipeline-level totals, use
 * `getAccumulatedTokenUsage()` instead.
 */
export async function callOpenRouterWithUsage(
  opts: OpenRouterCallOptions,
): Promise<OpenRouterResult> {
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
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  const usage: TokenUsage = {
    promptTokens: json.usage?.prompt_tokens ?? 0,
    completionTokens: json.usage?.completion_tokens ?? 0,
  };

  // Accumulate into global tracker
  _tokenAccumulator.promptTokens += usage.promptTokens;
  _tokenAccumulator.completionTokens += usage.completionTokens;

  return {
    content: json.choices[0]?.message?.content ?? '',
    usage,
  };
}

/** ------------------------------------------------------------------ */
/*  Mode 2: Agent SDK with Skills (nextTurnParams pattern)            */
/** ------------------------------------------------------------------ */

let _openrouter: OpenRouter | null = null;

/** Lazy-init singleton OpenRouter instance */
function getOpenRouterClient(): OpenRouter {
  if (!_openrouter) {
    const apiKey = process.env['OPENROUTER_API_KEY'];
    if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set');
    _openrouter = new OpenRouter({ apiKey });
  }
  return _openrouter;
}

/**
 * Build an EasyInputMessage-compatible object that satisfies InputsUnion.
 * The SDK uses ClosedEnum branded types for role — structurally equivalent
 * to plain strings at runtime but TypeScript won't narrow automatically.
 */
function makeMsg(
  role: 'user' | 'system' | 'developer' | 'assistant',
  content: string,
): { role: typeof role; content: string; type: 'message' } {
  return { role, content, type: 'message' };
}

/**
 * Call the OpenRouter Agent SDK with skills loaded via nextTurnParams.
 *
 * This follows the official skills-loader pattern:
 * - Skills are loaded dynamically via the `tool()` + `nextTurnParams` mechanism
 * - The LLM can discover and load additional skills via the skill discovery tool
 * - Preloaded skills are injected before the first turn
 * - Context is preserved and appended (never replaced)
 * - Duplicate skill loading is prevented via markers
 *
 * @param opts - Model, input prompt, skills to preload, options
 * @returns The final text output from the model
 */
export async function callModelWithSkills(
  opts: SkillModelCallOptions,
): Promise<string> {
  const client = getOpenRouterClient();

  // Build input messages
  const messages: Array<{ role: string; content: string; type: 'message' }> = [];

  // Add system prompt if provided
  if (opts.systemPrompt) {
    messages.push(makeMsg('developer', opts.systemPrompt));
  }

  // Preload requested skills by injecting their content as user messages
  // (follows the nextTurnParams context-injection pattern)
  if (opts.skills && opts.skills.length > 0) {
    const { readFileSync, existsSync } = await import('fs');
    const pathMod = await import('path');

    // Use shared resolver (walks up from cwd to find .claude/skills/)
    const skillsDir = resolveSkillsDirectory();
    console.log(`[agent-adapter] Skills directory resolved to: ${skillsDir}`);
    console.log(`[agent-adapter] Preloading ${opts.skills.length} skill(s): ${opts.skills.join(', ')}`);

    for (const skillName of opts.skills) {
      const skillMarker = `[Skill: ${skillName}]`;
      const skillPath = pathMod.join(skillsDir, skillName, 'SKILL.md');

      if (existsSync(skillPath)) {
        console.log(`[agent-adapter] ✓ Loaded skill: ${skillName}`);
        let content = readFileSync(skillPath, 'utf-8');

        // Optionally load references
        if (opts.includeReferences) {
          const refsDir = pathMod.join(skillsDir, skillName, 'references');
          if (existsSync(refsDir)) {
            const { readdirSync } = await import('fs');
            const refs = readdirSync(refsDir)
              .filter((f: string) => f.endsWith('.md'))
              .map((f: string) => {
                const refContent = readFileSync(
                  pathMod.join(refsDir, f),
                  'utf-8',
                );
                return `\n---\n## Reference: ${f}\n${refContent}`;
              });
            content += refs.join('\n');
          }
        }

        messages.push(
          makeMsg(
            'user',
            `${skillMarker}\nBase directory: ${pathMod.join(skillsDir, skillName)}\n\n${content}`,
          ),
        );
      } else {
        console.warn(`[agent-adapter] ✗ Skill not found: ${skillName} (looked at ${skillPath})`);
      }
    }
  }

  // Add the actual user prompt
  messages.push(makeMsg('user', opts.input));

  // Cast the messages array to the SDK's InputsUnion — ClosedEnum branded
  // role types are structurally identical to string literals at runtime
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const input = messages as any;

  // Call model with skill tools available for dynamic loading
  const result = client.callModel({
    model: opts.model,
    input,
    tools: [skillLoaderTool, multiSkillLoaderTool, skillDiscoveryTool],
    stopWhen: stepCountIs(opts.maxSteps ?? 5),
  });

  const text = await result.getText();
  return text;
}

/**
 * Get the list of available skills (for logging/debugging).
 */
export { listAvailableSkills };
