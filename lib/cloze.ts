export interface ClozeItem { answer: string; masked: string; }

export function maskSentences(text: string): ClozeItem[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const sentences = trimmed.match(/[^.!?]+[.!?]*/g) ?? [];
  return sentences
    .map((s) => s.trim())
    .filter(Boolean)
    .map((answer) => ({ answer, masked: "____" }));
}
