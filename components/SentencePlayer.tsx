"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { makeUtterance, splitSentences, supportsTTS } from "@/lib/tts";

/** Reads the optimized text aloud: master play-all/pause/resume/stop, plus a
 *  per-sentence play/pause. The currently-spoken sentence is highlighted. */
export function SentencePlayer({ text }: { text: string }) {
  const sentences = useMemo(() => splitSentences(text), [text]);
  const [current, setCurrent] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const queue = useRef<number[]>([]);

  const reset = () => {
    if (supportsTTS()) window.speechSynthesis.cancel();
    queue.current = [];
    setCurrent(null);
    setPaused(false);
  };

  // Stop on unmount and whenever the section's text changes.
  useEffect(() => reset(), [text]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => reset(), []); // eslint-disable-line react-hooks/exhaustive-deps

  function play(i: number, rest: number[]) {
    if (!supportsTTS()) return;
    window.speechSynthesis.cancel();
    queue.current = rest;
    setPaused(false);
    setCurrent(i);
    const u = makeUtterance(sentences[i]);
    u.onend = () => {
      const q = queue.current;
      if (q.length) {
        const next = q.shift()!;
        play(next, q);
      } else {
        setCurrent(null);
      }
    };
    u.onerror = () => {
      setCurrent(null);
      setPaused(false);
    };
    window.speechSynthesis.speak(u);
  }

  function toggleSentence(i: number) {
    if (current === i) {
      if (paused) {
        window.speechSynthesis.resume();
        setPaused(false);
      } else {
        window.speechSynthesis.pause();
        setPaused(true);
      }
    } else {
      play(i, []);
    }
  }

  function playAll() {
    if (!sentences.length) return;
    play(
      0,
      sentences.map((_, i) => i).slice(1),
    );
  }

  if (!sentences.length) return null;

  const active = current !== null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        {!active ? (
          <button onClick={playAll} className="label hover:text-primary">
            ▶ PLAY ALL
          </button>
        ) : paused ? (
          <button
            onClick={() => {
              window.speechSynthesis.resume();
              setPaused(false);
            }}
            className="label !text-success hover:opacity-80"
          >
            ▶ RESUME
          </button>
        ) : (
          <button
            onClick={() => {
              window.speechSynthesis.pause();
              setPaused(true);
            }}
            className="label hover:text-primary"
          >
            ⏸ PAUSE
          </button>
        )}
        {active && (
          <button onClick={reset} className="label hover:text-accent">
            ■ STOP
          </button>
        )}
      </div>

      <div className="space-y-1.5">
        {sentences.map((s, i) => {
          const isCur = current === i;
          return (
            <div
              key={i}
              className={`flex gap-3 items-start text-[17px] leading-[1.6] ${
                isCur ? "text-display" : "text-primary"
              }`}
            >
              <button
                onClick={() => toggleSentence(i)}
                aria-label={isCur && !paused ? "Pause sentence" : "Play sentence"}
                className={`shrink-0 mt-1 text-[13px] ${
                  isCur ? "text-accent" : "text-disabled hover:text-primary"
                }`}
              >
                {isCur && !paused ? "⏸" : "▶"}
              </button>
              <span>{s}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
