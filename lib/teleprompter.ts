// Split optimized markdown into paragraph/line units for the teleprompter.
// The model's optimized output puts each paragraph and each bullet on its own
// line, so splitting on runs of newlines yields one unit per paragraph/bullet.
// Each unit is then sentence-split by lib/tts.ts `splitSentences` at render time.
export function toParagraphs(md: string): string[] {
  return md
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
}
