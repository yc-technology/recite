import { Agent, run } from "@openai/agents";
import { StudyPlanSchema, type StudyPlan } from "./schema";

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
  const result = await run(analyzeAgent, rawText);
  return StudyPlanSchema.parse(result.finalOutput);
}
