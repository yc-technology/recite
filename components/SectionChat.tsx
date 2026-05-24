"use client";

import { useEffect, useState } from "react";
import { useNotify } from "@/components/Notify";

type Msg = { role: "user" | "assistant"; content: string };
type Ctx = {
  title: string;
  optimized: string;
  text: string;
  keyPoints: string[];
};

const CHIPS = ["Quiz me on this", "Say it in simpler words", "Pronunciation tips?"];

export function SectionChat({
  presentationId,
  sectionIndex,
  section,
}: {
  presentationId: string;
  sectionIndex: number;
  section: Ctx;
}) {
  const notify = useNotify();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  // Load this section's saved conversation when the section changes.
  useEffect(() => {
    let active = true;
    setMessages([]);
    fetch(
      `/api/chat?presentationId=${presentationId}&sectionIndex=${sectionIndex}`,
    )
      .then((r) => (r.ok ? r.json() : { messages: [] }))
      .then((d) => {
        if (active) setMessages(d.messages ?? []);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [presentationId, sectionIndex]);

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
        // Send only the recent turns so long conversations never hit the
        // server's size cap (the full thread stays in view and persisted).
        body: JSON.stringify({
          presentationId,
          sectionIndex,
          section,
          messages: next.slice(-16),
        }),
      });
      if (!res.ok) throw new Error(`chat failed (${res.status})`);
      const { reply } = await res.json();
      setMessages((m) => [...m, { role: "assistant", content: reply || "…" }]);
    } catch (e) {
      notify(`[ERROR: ${e instanceof Error ? e.message : "chat failed"}]`);
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
                  className={`inline-block text-[15px] leading-relaxed rounded-[6px] px-3 py-2 ${
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
              className="flex-1 bg-surface border border-border rounded-[4px] px-3 py-2 text-primary text-[15px] focus:border-primary outline-none"
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
