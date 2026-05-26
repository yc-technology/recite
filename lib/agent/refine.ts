import OpenAI from "openai";
import { openaiClient } from "./client";

// Pure prompt builder (unit-tested). Steers the model to rewrite ONE section's
// already-optimized markdown per the user's instruction and/or an attached
// reference image, without inventing facts or breaking markdown conventions.
export function buildRefinePrompt(
  title: string,
  currentOptimized: string,
  instruction: string,
  hasImage = false,
): string {
  const trimmed = instruction.trim();
  const directive = trimmed
    ? `Apply this instruction from the speaker to improve it: "${trimmed}"`
    : "Improve this section using the attached image as reference.";
  const imageRule = hasImage
    ? "\n- An image is attached as visual reference. Use it to inform the rewrite (align wording or incorporate relevant details it shows), but still preserve the speaker's meaning and invent no unrelated facts."
    : "";
  return `You are an English presentation coach. Below is the current presentation-ready version of ONE section of a talk, written in markdown.

Section title: ${title}
Current version:
${currentOptimized}

${directive}

Rules:
- Preserve the speaker's meaning and intent. Do NOT add new facts.
- Keep clean standard markdown: short paragraphs separated by blank lines, "- " bullet lists for enumerations, **bold** for only a few key terms. Do NOT use headings (#).${imageRule}
- Output ONLY the revised markdown for this section — no preamble, no explanation.`;
}

// Returns the revised markdown. Direct chat-completions call (works through the
// OpenAI-compatible gateway). When an image data URL is given, it is attached to
// a multimodal user message; otherwise the call is text-only (unchanged).
export async function refineOptimized(
  title: string,
  currentOptimized: string,
  instruction: string,
  imageDataUrl?: string,
): Promise<string> {
  const client = openaiClient();
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: buildRefinePrompt(title, currentOptimized, instruction, !!imageDataUrl) },
  ];
  if (imageDataUrl) {
    messages.push({
      role: "user",
      content: [
        { type: "text", text: instruction.trim() || "Use the attached image as reference." },
        { type: "image_url", image_url: { url: imageDataUrl } },
      ],
    });
  }
  const resp = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages,
  });
  return resp.choices[0]?.message?.content?.trim() ?? "";
}
