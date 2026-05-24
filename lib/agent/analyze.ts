import { Agent, run, setDefaultOpenAIClient, setOpenAIAPI } from "@openai/agents";
import { StudyPlanSchema, type StudyPlan } from "./schema";
import { openaiClient } from "./client";

// Route the Agents SDK through our configured client so OPENAI_API_KEY and
// OPENAI_BASE_URL are honored. When a custom base URL is set (proxy / OpenAI-
// compatible gateway), fall back to the broadly-supported Chat Completions API,
// since most gateways don't implement the Responses API the SDK defaults to.
let configured = false;
function configureSdk() {
  if (configured) return;
  setDefaultOpenAIClient(openaiClient());
  if (process.env.OPENAI_BASE_URL) setOpenAIAPI("chat_completions");
  configured = true;
}

const INSTRUCTIONS = `You are an English presentation coach. Given the full text of a
presentation, split it into logical recitation segments (3-12), each with a short title,
the verbatim content, a difficulty rating, and memory hints (hard words, linking,
transitions). Then produce a day-by-day schedule that introduces segments gradually
("learn") and revisits earlier ones ("review"). Keep content faithful to the source.`;

export const analyzeAgent = new Agent({
  name: "Presentation Analyzer",
  instructions: INSTRUCTIONS,
  outputType: StudyPlanSchema,
});

export async function analyzePresentation(rawText: string): Promise<StudyPlan> {
  configureSdk();
  const result = await run(analyzeAgent, rawText);
  return StudyPlanSchema.parse(result.finalOutput);
}
