import { Agent, run } from "@openai/agents";
import { NormalizedSchema, type Normalized } from "./schema";
import { configureSdk, modelOption } from "./runtime";

const INSTRUCTIONS = `You clean up raw, messy presentation text. It is often extracted from
PPTX or PDF, so expect broken fragments, missing punctuation, page numbers, headers, and
words split by stray spaces. Reconstruct it into clean, well-formed prose and split it into
coherent sections that follow the talk's flow.

Rules:
- Do NOT add, remove, or invent meaning. Only restructure and fix formatting/punctuation.
- Keep the speaker's original wording wherever possible.
- Drop obvious noise (page numbers, repeated slide headers/footers).

Respond with ONLY a single JSON object of exactly this shape:
{ "sections": [ { "title": string, "text": string } ] }
"title" is a short section title you infer. "text" is the cleaned prose for that section.`;

export async function normalizePresentation(rawText: string): Promise<Normalized> {
  configureSdk();
  const agent = new Agent({
    name: "Presentation Normalizer",
    instructions: INSTRUCTIONS,
    outputType: NormalizedSchema,
    ...modelOption(),
  });
  const result = await run(agent, rawText);
  return NormalizedSchema.parse(result.finalOutput);
}
