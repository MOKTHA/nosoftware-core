/**
 * POST /api/prompt/analyze — Analyze a user prompt for app-building readiness.
 *
 * Takes the user's natural-language prompt (and optional prior answers),
 * calls an LLM to score completeness, and returns clarifying questions
 * if the score is below the threshold.
 *
 * Hard cap: at most 6 total questions across all rounds. After 6 answered
 * questions the API forces readyToBuild regardless of score.
 *
 * Response shape:
 *   { score, message, questions?, readyToBuild, appName }
 */
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

/** Hard cap — after this many answered questions, skip straight to build. */
const MAX_TOTAL_QUESTIONS = 6;

interface AnalyzeRequest {
  prompt: string;
  answers?: Array<{ question: string; answer: string }>;
}

interface QuestionOption {
  label: string;
  description: string;
}

interface ClarifyingQuestion {
  id: string;
  question: string;
  options: QuestionOption[];
}

interface AnalyzeResponse {
  score: number;
  message: string;
  questions: ClarifyingQuestion[];
  readyToBuild: boolean;
  appName: string;
}

const SYSTEM_PROMPT = `You are a product requirements analyst for an AI app builder platform that generates industrial applications (MES, ERP, SCADA, CMMS, QMS, WMS, etc.).

Your job: evaluate the user's app description and determine if it has enough detail to generate a working application.

## Scoring (0–100)
- 20 pts: Clear app type / purpose
- 20 pts: Target users / roles defined
- 20 pts: Core features / entities described
- 20 pts: Key workflows or business rules
- 20 pts: Data model or integrations

IMPORTANT SCORING RULES:
- If the user has answered clarifying questions, give FULL CREDIT for the areas those answers cover. Do NOT keep asking about things the user already answered.
- A score of 60+ means "enough to build". You do NOT need every detail — the builder will make sensible defaults for anything unspecified.
- Be generous: if the user described the app type and a few features, that's already 40-60 points.

## Questions (only if score < 60)
Generate exactly 2-3 focused, CLOSED-ENDED questions with 3-4 concrete options each.

Rules for questions:
1. Each question MUST be answerable by picking one option — never open-ended ("describe", "explain", "what else").
2. Options must be specific, concrete choices — not vague categories.
3. Never repeat a topic the user already answered.
4. Focus on the BIGGEST gaps only — don't nitpick.
5. Each question should cover a different scoring dimension.

## Response format
Respond with ONLY this JSON (no markdown fences, no extra text):
{
  "score": <number 0-100>,
  "appName": "<short 2-3 word app name>",
  "message": "<one sentence: what you understood + what's missing, if anything>",
  "questions": [
    {
      "id": "q1",
      "question": "<closed-ended question>",
      "options": [
        { "label": "<2-4 word choice>", "description": "<one line>" },
        { "label": "<2-4 word choice>", "description": "<one line>" },
        { "label": "<2-4 word choice>", "description": "<one line>" }
      ]
    }
  ]
}

If score >= 60, return an empty questions array.`;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as AnalyzeRequest;
    if (!body.prompt?.trim()) {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
    }

    const apiKey = process.env['OPENROUTER_API_KEY'];
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OPENROUTER_API_KEY not configured' },
        { status: 500 },
      );
    }

    const answeredCount = body.answers?.length ?? 0;

    // If the user already answered MAX_TOTAL_QUESTIONS, skip LLM — force build.
    if (answeredCount >= MAX_TOTAL_QUESTIONS) {
      return NextResponse.json({
        score: 75,
        appName: extractAppName(body.prompt),
        message: 'You\'ve provided enough detail — ready to build!',
        questions: [],
        readyToBuild: true,
      } satisfies AnalyzeResponse);
    }

    // How many more questions we're allowed to ask
    const remainingBudget = MAX_TOTAL_QUESTIONS - answeredCount;

    // Build user prompt with previous answers
    let userPrompt = `User's app description:\n"${body.prompt}"`;
    if (body.answers?.length) {
      userPrompt += '\n\nUser has already answered these clarifications (DO NOT re-ask):';
      for (const a of body.answers) {
        userPrompt += `\n- Q: ${a.question}\n  A: ${a.answer}`;
      }
      userPrompt += `\n\nThe user has answered ${answeredCount} questions so far. You may ask at most ${Math.min(remainingBudget, 3)} more. If you have enough context, score >= 60 and return no questions.`;
    }

    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://nosoftware.ai',
        'X-Title': 'NoSoftware.ai',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 2048,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      return NextResponse.json(
        { error: `LLM error: ${errBody}` },
        { status: 502 },
      );
    }

    const json = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    const raw = json.choices[0]?.message?.content ?? '';

    // Strip markdown fences if present
    const cleaned = raw.replace(/^```[a-z]*\n?/gm, '').replace(/```$/gm, '').trim();

    let analysis: AnalyzeResponse;
    try {
      analysis = JSON.parse(cleaned) as AnalyzeResponse;
    } catch {
      return NextResponse.json(
        { error: 'Failed to parse LLM response', raw: cleaned.slice(0, 500) },
        { status: 502 },
      );
    }

    // Enforce question budget — trim excess questions
    if (analysis.questions.length > remainingBudget) {
      analysis.questions = analysis.questions.slice(0, remainingBudget);
    }

    // If no questions left in budget, force ready
    if (remainingBudget <= 0) {
      analysis.readyToBuild = true;
      analysis.questions = [];
    } else {
      analysis.readyToBuild = analysis.score >= 60;
    }

    return NextResponse.json(analysis);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

/** Extract a short app name from the prompt when skipping the LLM. */
function extractAppName(prompt: string): string {
  const words = prompt.trim().split(/\s+/).slice(0, 4);
  return words.join(' ').replace(/[.!?,;:]+$/, '') || 'My App';
}
