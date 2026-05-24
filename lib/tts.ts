// Browser text-to-speech helper. The default voice is often robotic or the
// wrong locale; we pick the most natural available English voice, and wait for
// voices to load (they arrive asynchronously on first use).

function stripMarkdown(s: string): string {
  return s
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#*_`>~]/g, " ")
    .replace(/^\s*[-•]\s*/gm, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

// Prefer known high-quality natural voices, then any en-US, then any English.
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

function pickVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  const en = voices.filter((v) => v.lang?.toLowerCase().startsWith("en"));
  for (const name of PREFERRED) {
    const m = en.find((v) => v.name === name) || en.find((v) => v.name.includes(name));
    if (m) return m;
  }
  return en.find((v) => v.lang.toLowerCase() === "en-us") || en[0] || voices[0];
}

export function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const synth = window.speechSynthesis;
  synth.cancel();

  const run = () => {
    const u = new SpeechSynthesisUtterance(stripMarkdown(text));
    u.lang = "en-US";
    u.rate = 1;
    u.pitch = 1;
    const v = pickVoice();
    if (v) u.voice = v;
    synth.speak(u);
  };

  if (synth.getVoices().length === 0) {
    synth.onvoiceschanged = () => {
      synth.onvoiceschanged = null;
      run();
    };
    synth.getVoices(); // nudge async load
  } else {
    run();
  }
}

export function stopSpeak() {
  if (typeof window !== "undefined" && "speechSynthesis" in window)
    window.speechSynthesis.cancel();
}
