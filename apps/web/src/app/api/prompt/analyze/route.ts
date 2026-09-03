/**
 * POST /api/prompt/analyze — Analyze a user prompt for app-building readiness.
 *
 * Takes the user's natural-language prompt (and optional prior answers),
 * calls an LLM to score completeness, and returns clarifying questions
 * if the score is below the threshold.
 *
 * Response shape:
 *   { score, message, questions?, readyToBuild, appName }
 */
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

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

const SYSTEM_PROMPT = `You are a product requirements analyst for an AI app builder platform.
Your job is to evaluate a user's app description and determine if it has enough detail to generate a working application.

Score the prompt from 0-100 based on:
- 20 pts: Clear app type/purpose
- 20 pts: Target users / roles defined
- 20 pts: Core features / entities described
- 20 pts: Key workflows or business rules
- 20 pts: Data relationships or integrations

If the score is below 60, generate 1-3 clarifying questions with 3-4 options each.
Questions should be specific and actionable — not generic.

Respond with ONLY this JSON (no markdown fences):
{
  "score": <number 0-100>,
  "appName": "<short app name derived from the description>",
  "message": "<one sentence about what's good and what's missing>",
  "questions": [
    {
      "id": "q1",
      "question": "<specific clarifying question>",
      "options": [
        { "label": "<short choice>", "description": "<one-line explanation>" },
        { "label": "<short choice>", "description": "<one-line explanation>" },
        { "label": "<short choice>", "description": "<one-line explanation>" }
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

    // Build user prompt with any previous answers
    let userPrompt = `User's app description:\n"${body.prompt}"`;
    if (body.answers?.length) {
      userPrompt += '\n\nPrevious clarifications:';
      for (const a of body.answers) {
        userPrompt += `\n- Q: ${a.question}\n  A: ${a.answer}`;
      }
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

    analysis.readyToBuild = analysis.score >= 60;

    return NextResponse.json(analysis);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
