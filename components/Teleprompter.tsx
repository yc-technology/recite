"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X, Maximize, Minimize } from "lucide-react";
import { Label } from "@/components/nothing";
import { toParagraphs } from "@/lib/teleprompter";
import { splitSentences } from "@/lib/tts";

type Section = { title: string; optimized: string };

type Item =
  | { kind: "section"; title: string; key: string }
  | { kind: "paragraph"; sentences: { idx: number; text: string }[]; key: string };

// Flat, indexed render model: section dividers + paragraphs of sentences, every
// sentence carrying a unique running index for the single-cursor highlight.
function buildItems(sections: Section[]): Item[] {
  const items: Item[] = [];
  let idx = 0;
  sections.forEach((sec, si) => {
    items.push({ kind: "section", title: sec.title, key: `s${si}` });
    toParagraphs(sec.optimized).forEach((p, pi) => {
      const sentences = splitSentences(p).map((text) => ({ idx: idx++, text }));
      if (sentences.length) {
        items.push({ kind: "paragraph", sentences, key: `s${si}p${pi}` });
      }
    });
  });
  return items;
}

export function Teleprompter({
  id,
  title,
  sections,
}: {
  id: string;
  title: string;
  sections: Section[];
}) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const items = useMemo(() => buildItems(sections), [sections]);

  // Smooth-center the active sentence whenever it changes.
  useEffect(() => {
    if (active == null) return;
    rootRef.current
      ?.querySelector(`[data-idx="${active}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [active]);

  // Track browser fullscreen state for the toggle label.
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Escape exits the mode — but only when NOT in browser fullscreen (there the
  // browser consumes the first Escape to leave fullscreen).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.fullscreenElement) {
        router.push(`/presentation/${id}`);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [id, router]);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      rootRef.current?.requestFullscreen().catch(() => {});
    }
  }

  return (
    <div ref={rootRef} className="min-h-dvh bg-bg text-primary overflow-y-auto">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-6 md:px-10 py-4 bg-bg border-b border-border">
        <Link
          href={`/presentation/${id}`}
          aria-label="Close teleprompter"
          className="label hover:text-primary flex items-center gap-1.5"
        >
          <X size={16} aria-hidden />
          CLOSE
        </Link>
        <span className="label truncate">{title}</span>
        <button
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          className="label hover:text-primary flex items-center gap-1.5"
        >
          {isFullscreen ? <Minimize size={16} aria-hidden /> : <Maximize size={16} aria-hidden />}
          {isFullscreen ? "EXIT FULLSCREEN" : "FULLSCREEN"}
        </button>
      </div>

      <div className="mx-auto w-full max-w-3xl px-6 md:px-10 py-[40vh]">
        {items.map((item) =>
          item.kind === "section" ? (
            <Label key={item.key} className="block mt-16 first:mt-0 mb-6">
              {item.title}
            </Label>
          ) : (
            <div key={item.key} className="mb-8 space-y-2">
              {item.sentences.map((s) => (
                <button
                  key={s.idx}
                  data-idx={s.idx}
                  aria-pressed={active === s.idx}
                  onClick={() => setActive(s.idx)}
                  className={
                    "block w-full text-left transition-all duration-200 pl-4 border-l-2 " +
                    (active === s.idx
                      ? "border-accent text-display font-medium text-[clamp(1.5rem,3.5vw,2.2rem)]"
                      : "border-transparent text-secondary hover:text-primary text-[clamp(1.05rem,2vw,1.3rem)]")
                  }
                >
                  {s.text}
                </button>
              ))}
            </div>
          ),
        )}
      </div>
    </div>
  );
}
