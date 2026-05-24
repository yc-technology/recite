import { openaiClient } from "./client";

export type ChatMessage = { role: "user" | "assistant"; content: string };
export type ChatContext = {
  title: string;
  optimized: string;
  text: string;
  keyPoints: string[];
};

// A lightweight coaching chat scoped to one section. Uses chat completions
// directly (works through the OpenAI-compatible gateway).
export async function coachReply(
  section: ChatContext,
  messages: ChatMessage[],
): Promise<string> {
  const client = openaiClient();
  const system = `You are a friendly English presentation coach. The learner is practicing THIS section of their talk:

Title: ${section.title}
Key points: ${section.keyPoints.join("; ")}
Polished version: ${section.optimized}
Their original: ${section.text}

Help them with this section: answer questions about meaning, give pronunciation tips,
suggest simpler or more natural phrasings, or quiz them. Keep replies short (2-4 sentences),
use simple, common English words, and stay focused on this section.`;

  const resp = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages: [{ role: "system", content: system }, ...messages],
  });
  return resp.choices[0]?.message?.content ?? "";
}
