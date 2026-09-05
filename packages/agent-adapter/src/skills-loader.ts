/**
 * @heynxt/agent-adapter — OpenRouter Agent SDK Skills Loader
 *
 * Implements the OpenRouter Agent SDK skills pattern:
 * https://openrouter.ai/docs/agent-sdk/call-model/examples/skills-loader
 *
 * Uses `tool()` with `nextTurnParams` for dynamic context injection
 * of UI/UX design skills into LLM code generation calls.
 *
 * NOTE: This file imports from 'zod' (v4) — required by @openrouter/agent.
 * All other files in this package import from 'zod/v3' for backward compat.
 */

import { tool } from '@openrouter/agent';
import { readFileSync, existsSync, readdirSync } from 'fs';
import path from 'path';
import { z } from 'zod';

/**
 * SDKInput from the SDK is `string | Array<EasyInputMessage | ...many item types>`.
 * We construct EasyInputMessage-compatible objects and cast to this alias.
 * Using `any` avoids importing deep SDK types that may not be re-exported.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SDKInput = any;

/* ------------------------------------------------------------------ */
/*  Skills Directory                                                  */
/* ------------------------------------------------------------------ */

/**
 * Resolve skills directory by walking up from cwd to find the monorepo
 * root (the directory containing `.claude/skills/`). This handles:
 * - Running from monorepo root (pnpm dev)
 * - Running from apps/web/ (Next.js cwd)
 * - Running from packages/agent-adapter/ (tests)
 * Falls back to home directory skills, then to cwd-based path.
 */
function getSkillsDir(): string {
  // Walk up from cwd to find .claude/skills/
  let dir = process.cwd();
  const root = path.parse(dir).root;
  while (dir !== root) {
    const candidate = path.join(dir, '.claude', 'skills');
    if (existsSync(candidate)) return candidate;
    dir = path.dirname(dir);
  }

  // Home directory skills (fallback)
  const homeSkills = path.join(process.env['HOME'] || '~', '.claude', 'skills');
  if (existsSync(homeSkills)) return homeSkills;

  // Last resort: cwd-based path (may not exist)
  return path.resolve(process.cwd(), '.claude', 'skills');
}

/** Lazily resolved and cached skills directory */
let _skillsDir: string | null = null;

/**
 * Return the resolved skills directory (cached after first call).
 * Exported so other modules (e.g. llm.ts) share the same resolution.
 */
export function resolveSkillsDirectory(): string {
  if (!_skillsDir) _skillsDir = getSkillsDir();
  return _skillsDir;
}

// Internal alias used throughout this module
const SKILLS_DIR_GETTER = resolveSkillsDirectory;

/* ------------------------------------------------------------------ */
/*  Skill Discovery                                                   */
/* ------------------------------------------------------------------ */

/** List available skill names (directories containing SKILL.md) */
export function listAvailableSkills(): string[] {
  const skillsDir = SKILLS_DIR_GETTER();
  if (!existsSync(skillsDir)) return [];
  return readdirSync(skillsDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .filter((dirent) =>
      existsSync(path.join(skillsDir, dirent.name, 'SKILL.md')),
    )
    .map((dirent) => dirent.name);
}

/** Read a skill's SKILL.md content */
function readSkillContent(skillName: string): string | null {
  const skillPath = path.join(SKILLS_DIR_GETTER(), skillName, 'SKILL.md');
  if (!existsSync(skillPath)) return null;
  return readFileSync(skillPath, 'utf-8');
}

/** Read all reference files for a skill */
function readSkillReferences(skillName: string): string {
  const refsDir = path.join(SKILLS_DIR_GETTER(), skillName, 'references');
  if (!existsSync(refsDir)) return '';

  const refs = readdirSync(refsDir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const content = readFileSync(path.join(refsDir, f), 'utf-8');
      return `\n---\n## Reference: ${f}\n${content}`;
    });

  return refs.join('\n');
}

/* ------------------------------------------------------------------ */
/*  Helper: build an EasyInputMessage-compatible object                */
/* ------------------------------------------------------------------ */

/**
 * Build a message object compatible with the SDK's SDKInput type.
 * The SDK accepts EasyInputMessage with role as a ClosedEnum branded
 * string — structurally equivalent to 'user'|'system'|'developer'|'assistant'
 * at runtime, but TypeScript can't narrow string literals to ClosedEnum<T>.
 * We construct the plain object and assert.
 */
function makeMessage(
  role: 'user' | 'system' | 'developer' | 'assistant',
  content: string,
): { role: typeof role; content: string; type: 'message' } {
  return { role, content, type: 'message' };
}

/**
 * Append a skill message to the current input and return as SDKInput.
 * Preserves existing context (idempotency pattern from the OpenRouter docs).
 */
function appendSkillToInput(
  currentInput: SDKInput,
  skillName: string,
  includeReferences: boolean,
): SDKInput {
  const skillMarker = `[Skill: ${skillName}]`;

  // Idempotency — prevent duplicate loading
  if (JSON.stringify(currentInput).includes(skillMarker)) {
    return currentInput;
  }

  const skillContent = readSkillContent(skillName);
  if (!skillContent) return currentInput;

  const skillDir = path.join(SKILLS_DIR_GETTER(), skillName);

  let references = '';
  if (includeReferences) {
    references = readSkillReferences(skillName);
  }

  // Context preservation — append, don't replace
  const items = Array.isArray(currentInput) ? currentInput : [currentInput];

  const newMessage = makeMessage(
    'user',
    `${skillMarker}\nBase directory for this skill: ${skillDir}\n\n${skillContent}${references}`,
  );

  // Return as SDKInput (array variant)
  return [...items, newMessage] as unknown as SDKInput;
}

/* ------------------------------------------------------------------ */
/*  Skill Loader Tool (OpenRouter Agent SDK pattern)                  */
/* ------------------------------------------------------------------ */

/**
 * Single skill loader — uses nextTurnParams to inject skill context
 * into the LLM conversation for subsequent turns.
 *
 * Key patterns from the OpenRouter docs:
 * 1. Idempotency — checks if skill is already loaded via marker
 * 2. Context preservation — appends to existing input, never replaces
 * 3. Clear markers — uses [Skill: name] for detection
 */
export const skillLoaderTool: ReturnType<typeof tool> = tool({
  name: 'Skill',
  description: `Load a specialized UI/UX skill to enhance code generation capabilities.
Available skills: ${listAvailableSkills().join(', ') || 'none configured'}
Each skill provides domain-specific design patterns, component patterns, and best practices.`,

  inputSchema: z.object({
    type: z
      .string()
      .describe(
        "The skill type to load (e.g., 'senior-frontend', 'ui-design-system')",
      ),
    includeReferences: z
      .boolean()
      .default(false)
      .describe('Also load reference docs for deeper context'),
  }),

  // nextTurnParams — the core pattern: modify context for next turn
  nextTurnParams: {
    input: (params: Record<string, unknown>, context) => {
      const skillType = params['type'] as string;
      const includeRefs = (params['includeReferences'] as boolean) ?? false;
      return appendSkillToInput(context.input, skillType, includeRefs);
    },
  },

  execute: async (params: Record<string, unknown>) => {
    const skillType = params['type'] as string;
    const skillPath = path.join(SKILLS_DIR_GETTER(), skillType, 'SKILL.md');
    if (!existsSync(skillPath)) {
      const available = listAvailableSkills();
      return `Skill "${skillType}" not found. Available skills: ${available.join(', ') || 'none'}`;
    }

    return `Launching skill ${skillType}`;
  },
});

/* ------------------------------------------------------------------ */
/*  Multi-Skill Loader Tool                                           */
/* ------------------------------------------------------------------ */

/**
 * Load multiple skills in a single call — used by the generation
 * pipeline to load all relevant UI/UX skills at once.
 */
export const multiSkillLoaderTool: ReturnType<typeof tool> = tool({
  name: 'load_skills',
  description: 'Load multiple UI/UX skills at once for code generation',

  inputSchema: z.object({
    skills: z
      .array(z.string())
      .describe('Array of skill names to load'),
    includeReferences: z
      .boolean()
      .default(false)
      .describe('Also load reference docs for deeper context'),
  }),

  // nextTurnParams — load all skills into context
  nextTurnParams: {
    input: (params: Record<string, unknown>, context) => {
      const skills = params['skills'] as string[];
      const includeRefs = (params['includeReferences'] as boolean) ?? false;

      let input = context.input;
      for (const skillName of skills) {
        input = appendSkillToInput(input, skillName, includeRefs);
      }
      return input;
    },
  },

  execute: async (params: Record<string, unknown>) => {
    const skills = params['skills'] as string[];
    const includeRefs = (params['includeReferences'] as boolean) ?? false;
    const loaded: string[] = [];
    const failed: Array<{ name: string; reason: string }> = [];

    for (const skill of skills) {
      const skillPath = path.join(SKILLS_DIR_GETTER(), skill, 'SKILL.md');
      if (existsSync(skillPath)) {
        loaded.push(skill);
      } else {
        failed.push({ name: skill, reason: 'Skill not found' });
      }
    }

    return { loaded, failed };
  },
});

/* ------------------------------------------------------------------ */
/*  Skill Discovery Tool                                              */
/* ------------------------------------------------------------------ */

/**
 * List and describe available skills — the LLM can call this to
 * discover what's available before loading.
 */
export const skillDiscoveryTool: ReturnType<typeof tool> = tool({
  name: 'list_skills',
  description: 'List all available UI/UX skills with their descriptions',

  inputSchema: z.object({
    category: z
      .string()
      .optional()
      .describe('Filter by category (e.g., "frontend", "design")'),
  }),

  execute: async (params: Record<string, unknown>) => {
    const category = params['category'] as string | undefined;
    const availableSkills = listAvailableSkills();
    const skills: Array<{
      name: string;
      description: string;
      hasReferences: boolean;
    }> = [];

    for (const skillName of availableSkills) {
      const content = readSkillContent(skillName);
      if (!content) continue;

      // Extract description from YAML frontmatter or first paragraph
      const descMatch = content.match(
        /description:\s*["']?(.+?)["']?\s*\n/,
      );
      const description = descMatch?.[1]
        ? descMatch[1].slice(0, 120)
        : content
            .split('\n')
            .find((l) => l.trim() && !l.startsWith('#') && !l.startsWith('---'))
            ?.slice(0, 120) ?? 'No description';

      // Check for references directory
      const refsDir = path.join(SKILLS_DIR_GETTER(), skillName, 'references');
      const hasReferences = existsSync(refsDir);

      // Category filter
      if (category) {
        const lower = category.toLowerCase();
        if (
          !skillName.includes(lower) &&
          !description.toLowerCase().includes(lower)
        ) {
          continue;
        }
      }

      skills.push({ name: skillName, description, hasReferences });
    }

    return { skills, totalCount: skills.length };
  },
});
