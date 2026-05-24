import { Agent, run } from "@openai/agents";
import {
  EnrichmentsSchema,
  StudyPlanSchema,
  type StudyPlan,
  type NormalizedSection,
} from "./schema";
import { configureSdk, modelOption } from "./runtime";

const INSTRUCTIONS = `You are an English presentation coach. You receive a JSON array of
presentation sections, each with an index, a title, and text. For EACH section, in the
SAME ORDER, produce:
- "summary": one sentence on what the section is about.
- "keyPoints": 3-5 concise points the speaker must convey.
- "difficulty": "easy" | "medium" | "hard" for reciting it from understanding.
- "optimized": a polished, presentation-ready rewrite of the section in natural, fluent,
  native English. Improve clarity, flow, word choice, and spoken delivery while preserving
  the speaker's meaning and intent. Keep it roughly the same length — it must be deliverable
  aloud as a real presentation. Do NOT add new facts.

Respond with ONLY a single JSON object of exactly this shape:
{ "enrichments": [ { "summary": string, "keyPoints": string[], "difficulty": "easy" | "medium" | "hard", "optimized": string } ] }
Return EXACTLY one enrichment per input section, in the same order.`;

export async function analyzeSections(
  sections: NormalizedSection[],
): Promise<StudyPlan> {
  configureSdk();
  const agent = new Agent({
    name: "Presentation Analyzer",
    instructions: INSTRUCTIONS,
    outputType: EnrichmentsSchema,
    ...modelOption(),
  });

  const input = JSON.stringify(
    sections.map((s, i) => ({ index: i, title: s.title, text: s.text })),
  );
  const result = await run(agent, input);
  const { enrichments } = EnrichmentsSchema.parse(result.finalOutput);

  // Merge by index — title/text come from the (clean) input, never the model,
  // so the reference text stays exact even if the model drifts.
  const merged = sections.map((s, i) => {
    const e = enrichments[i] ?? {
      summary: "",
      keyPoints: [],
      difficulty: "medium" as const,
      optimized: s.text,
    };
    return {
      title: s.title,
      text: s.text,
      optimized: e.optimized || s.text, // fall back to original if model omits
      summary: e.summary,
      keyPoints: e.keyPoints,
      difficulty: e.difficulty,
    };
  });
  return StudyPlanSchema.parse({ sections: merged });
}
