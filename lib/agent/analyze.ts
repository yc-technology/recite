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
SAME ORDER, produce comprehension aids that help the speaker recite it from understanding
(not by rote): a one-sentence summary of what the section is about, 3-5 concise key points
the speaker must convey, and a difficulty rating.

Respond with ONLY a single JSON object of exactly this shape:
{ "enrichments": [ { "summary": string, "keyPoints": string[], "difficulty": "easy" | "medium" | "hard" } ] }
Return EXACTLY one enrichment per input section, in the same order. Do not echo the text.`;

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
    };
    return {
      title: s.title,
      text: s.text,
      summary: e.summary,
      keyPoints: e.keyPoints,
      difficulty: e.difficulty,
    };
  });
  return StudyPlanSchema.parse({ sections: merged });
}
