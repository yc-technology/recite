"use client";

import { Markdown } from "@/components/Markdown";
import { useTts } from "@/components/TtsProvider";

/** Renders optimized text as formatted markdown; double-click a paragraph or
 *  bullet to play just that block. Controls live in the floating TTS panel. */
export function SpeakableMarkdown({ children }: { children: string }) {
  const tts = useTts();
  return (
    <div
      onDoubleClick={(e) => {
        const el = (e.target as HTMLElement).closest(
          "p, li, h1, h2, h3, blockquote",
        );
        const t = el?.textContent?.trim();
        if (t) tts.play(t);
      }}
      className="[&_p]:cursor-pointer [&_li]:cursor-pointer"
    >
      <Markdown>{children}</Markdown>
    </div>
  );
}
