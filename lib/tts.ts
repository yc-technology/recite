// Browser text-to-speech helpers. The default voice is often robotic or the
// wrong locale; we pick the most natural available English voice.

export function stripMarkdown(s: string): string {
  return s
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#*_`>~]/g, " ")
    .replace(/^\s*[-•]\s*/gm, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

// Split cleaned text into sentences for per-sentence playback.
export function splitSentences(text: string): string[] {
  const clean = stripMarkdown(text);
  if (!clean) return [];
  return (clean.match(/[^.!?]+[.!?]*/g) ?? [])
    .map((s) => s.trim())
    .filter(Boolean);
}

const PREFERRED = [
  "Google US English",
  "Samantha",
  "Aria",
  "Jenny",
  "Microsoft Aria",
  "Microsoft Jenny",
  "Daniel",
  "Karen",
  "Google UK English Female",
];

export function pickVoice(): SpeechSynthesisVoice | undefined {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const voices = window.speechSynthesis.getVoices();
  const en = voices.filter((v) => v.lang?.toLowerCase().startsWith("en"));
  for (const name of PREFERRED) {
    const m = en.find((v) => v.name === name) || en.find((v) => v.name.includes(name));
    if (m) return m;
  }
  return en.find((v) => v.lang.toLowerCase() === "en-us") || en[0] || voices[0];
}

export function makeUtterance(text: string): SpeechSynthesisUtterance {
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  u.rate = 1;
  u.pitch = 1;
  const v = pickVoice();
  if (v) u.voice = v;
  return u;
}

export function supportsTTS(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}
