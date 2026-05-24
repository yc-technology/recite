import { Agent, run } from "@openai/agents";
import {
  WriteReviewSchema,
  type WriteReview,
  type OptimizeStyle,
} from "./schema";
import { configureSdk, modelOption } from "./runtime";

const STYLE_GUIDE: Record<OptimizeStyle, string> = {
  simple: "simple, common, everyday words and short clear sentences",
  native: "natural, idiomatic, native-sounding English with common collocations",
  formal: "a polished, professional business register",
  concise: "tight, punchy phrasing with no filler",
};

export async function reviewWriting(
  text: string,
  opts: { style: OptimizeStyle; goal: string },
): Promise<WriteReview> {
  configureSdk();
  const instructions = `You are an English writing coach. The learner wrote a piece of text
(its purpose: "${opts.goal}"). Help them improve it:

- "corrected": a clear, natural rewrite using ${STYLE_GUIDE[opts.style]}, formatted as clean
  STANDARD MARKDOWN (short paragraphs, "- " bullets where useful, a few **bold** key terms,
  no headings). Preserve the learner's meaning and intent; do NOT add new facts.
- "issues": a list of concrete mistakes found in the LEARNER'S original text. For each:
  "excerpt" = the exact problematic phrase from their text; "type" = a short category such as
  grammar / word choice / collocation / tense / article / preposition / spelling; "explanation"
  = one short line on why; "fix" = the corrected phrasing. Skip if the text is already clean.
- "comment": 1-2 sentences of overall feedback (tone, clarity, what to watch).

Respond with ONLY a single JSON object of exactly this shape:
{ "corrected": string, "issues": [ { "excerpt": string, "type": string, "explanation": string, "fix": string } ], "comment": string }`;

  const agent = new Agent({
    name: "Writing Coach",
    instructions,
    outputType: WriteReviewSchema,
    ...modelOption(),
  });
  const result = await run(agent, text);
  return WriteReviewSchema.parse(result.finalOutput);
}
