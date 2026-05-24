import {
  Agent,
  run,
  setDefaultOpenAIClient,
  setOpenAIAPI,
  setTracingDisabled,
} from "@openai/agents";
import { StudyPlanSchema, type StudyPlan } from "./schema";
import { openaiClient } from "./client";

// Route the Agents SDK through our configured client so OPENAI_API_KEY and
// OPENAI_BASE_URL are honored. When a custom base URL is set (proxy / OpenAI-
// compatible gateway), fall back to the broadly-supported Chat Completions API,
// since most gateways don't implement the Responses API the SDK defaults to.
// Tracing is disabled: it phones home to OpenAI's tracing endpoint, which is
// noise (and unreachable) when running against a third-party gateway.
let configured = false;
function configureSdk() {
  if (configured) return;
  setDefaultOpenAIClient(openaiClient());
  setTracingDisabled(true);
  if (process.env.OPENAI_BASE_URL) setOpenAIAPI("chat_completions");
  configured = true;
}

// The exact JSON shape is spelled out because non-OpenAI gateways only enforce
// `json_object` (free-form JSON), not a JSON schema — so the model must be told
// the precise keys to produce schema-valid output.
const INSTRUCTIONS = `You are an English presentation coach. Given the full text of a
presentation, split it into logical recitation segments (3-12), each with a short title,
the verbatim content, a difficulty rating, and memory hints (hard words, linking,
transitions). Then produce a day-by-day schedule that introduces segments gradually
("learn") and revisits earlier ones ("review"). Keep content faithful to the source.

Respond with ONLY a single JSON object (no markdown, no prose) of exactly this shape:
{
  "segments": [
    { "title": string, "content": string, "difficulty": "easy" | "medium" | "hard", "hints": string[] }
  ],
  "dailySchedule": [
    { "dayIndex": number, "segmentIndexes": number[], "taskType": "learn" | "review" }
  ]
}
"dayIndex" is 0-based. "segmentIndexes" are 0-based indexes into the "segments" array.`;

// Built lazily so OPENAI_MODEL is read at request time. The SDK default model is
// an OpenAI name (e.g. gpt-4o) — set OPENAI_MODEL when pointing at a gateway whose
// model catalog differs (DashScope, etc.).
function buildAgent() {
  return new Agent({
    name: "Presentation Analyzer",
    instructions: INSTRUCTIONS,
    outputType: StudyPlanSchema,
    ...(process.env.OPENAI_MODEL ? { model: process.env.OPENAI_MODEL } : {}),
  });
}

export async function analyzePresentation(rawText: string): Promise<StudyPlan> {
  configureSdk();
  const result = await run(buildAgent(), rawText);
  return StudyPlanSchema.parse(result.finalOutput);
}
