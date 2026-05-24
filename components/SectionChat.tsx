"use client";

import { useEffect, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };
type Ctx = {
  title: string;
  optimized: string;
  text: string;
  keyPoints: string[];
};

const CHIPS = ["Quiz me on this", "Say it in simpler words", "Pronunciation tips?"];

export function SectionChat({ section }: { section: Ctx }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  // Reset the conversation when the practiced section changes.
  useEffect(() => {
    setMessages([]);
  }, [section.title]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const next: Msg[] = [...messages, { role: "user", content: q }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ section, messages: next }),
      });
      const { reply } = await res.json();
      setMessages((m) => [
        ...m,
        { role: "assistant", content: reply || "…" },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "[error: try again]" },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-t border-border pt-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="label hover:text-primary"
      >
        {open ? "▾ COACH" : "▸ ASK THE COACH"}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <div className="space-y-3 max-h-72 overflow-auto">
            {messages.length === 0 && (
              <div className="flex flex-wrap gap-2">
                {CHIPS.map((c) => (
                  <button
                    key={c}
                    onClick={() => send(c)}
                    className="label border border-border rounded-[4px] px-2 py-1 hover:border-primary"
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "text-right" : ""}>
                <span
                  className={`inline-block text-[14px] leading-relaxed rounded-[6px] px-3 py-2 ${
                    m.role === "user"
                      ? "bg-surface-raised text-primary"
                      : "text-secondary"
                  }`}
                >
                  {m.content}
                </span>
              </div>
            ))}
            {busy && <p className="label">[ THINKING… ]</p>}
          </div>

          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send(input)}
              placeholder="Ask about this section…"
              className="flex-1 bg-surface border border-border rounded-[4px] px-3 py-2 text-primary text-[14px] focus:border-primary outline-none"
            />
            <button
              onClick={() => send(input)}
              disabled={busy || !input.trim()}
              className="label border border-border-strong rounded-[4px] px-3 hover:border-primary disabled:opacity-40"
            >
              SEND
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
