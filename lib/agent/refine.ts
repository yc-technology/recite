import { openaiClient } from "./client";

// Pure prompt builder (unit-tested). Steers the model to rewrite ONE section's
// already-optimized markdown per the user's instruction, without inventing facts
// and without breaking the app's markdown conventions.
export function buildRefinePrompt(
  title: string,
  currentOptimized: string,
  instruction: string,
): string {
  return `You are an English presentation coach. Below is the current presentation-ready version of ONE section of a talk, written in markdown.

Section title: ${title}
Current version:
${currentOptimized}

Apply this instruction from the speaker to improve it: "${instruction}"

Rules:
- Preserve the speaker's meaning and intent. Do NOT add new facts.
- Keep clean standard markdown: short paragraphs separated by blank lines, "- " bullet lists for enumerations, **bold** for only a few key terms. Do NOT use headings (#).
- Output ONLY the revised markdown for this section — no preamble, no explanation.`;
}

// Returns the revised markdown. Direct chat-completions call (works through the
// OpenAI-compatible gateway); plain text output, so no json_object constraints.
export async function refineOptimized(
  title: string,
  currentOptimized: string,
  instruction: string,
): Promise<string> {
  const client = openaiClient();
  const resp = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages: [
      { role: "system", content: buildRefinePrompt(title, currentOptimized, instruction) },
    ],
  });
  return resp.choices[0]?.message?.content?.trim() ?? "";
}
