"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { makeUtterance, stripMarkdown, supportsTTS } from "@/lib/tts";

type Ctx = {
  play: (text: string) => void;
  stop: () => void;
  playing: boolean;
  paused: boolean;
};

const TtsCtx = createContext<Ctx>({
  play: () => {},
  stop: () => {},
  playing: false,
  paused: false,
});

export function useTts() {
  return useContext(TtsCtx);
}

/** Global speech playback. Components call play(text); a floating control panel
 *  appears (animated) only while something is playing/paused. */
export function TtsProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false);
  const [paused, setPaused] = useState(false);
  const pathname = usePathname();

  const stop = useCallback(() => {
    if (supportsTTS()) window.speechSynthesis.cancel();
    setActive(false);
    setPaused(false);
  }, []);

  // Stop playback when navigating to another page.
  useEffect(() => {
    stop();
  }, [pathname, stop]);

  const play = useCallback((text: string) => {
    if (!supportsTTS()) return;
    const clean = stripMarkdown(text).replace(/^[\s—–-]+/, "");
    if (!clean) return;
    window.speechSynthesis.cancel();
    const u = makeUtterance(clean);
    u.onend = () => {
      setActive(false);
      setPaused(false);
    };
    u.onerror = () => {
      setActive(false);
      setPaused(false);
    };
    window.speechSynthesis.speak(u);
    setActive(true);
    setPaused(false);
  }, []);

  useEffect(
    () => () => {
      if (supportsTTS()) window.speechSynthesis.cancel();
    },
    [],
  );

  const pause = () => {
    if (supportsTTS()) {
      window.speechSynthesis.pause();
      setPaused(true);
    }
  };
  const resume = () => {
    if (supportsTTS()) {
      window.speechSynthesis.resume();
      setPaused(false);
    }
  };

  return (
    <TtsCtx.Provider value={{ play, stop, playing: active, paused }}>
      {children}
      <div
        className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ease-out ${
          active
            ? "translate-y-0 opacity-100 pointer-events-auto"
            : "translate-y-8 opacity-0 pointer-events-none"
        }`}
      >
        <div className="flex items-center gap-5 bg-surface border border-border-strong rounded-full px-6 py-3">
          <span className="label !text-accent">
            {paused ? "❚❚ PAUSED" : "♪ PLAYING"}
          </span>
          {paused ? (
            <button onClick={resume} className="label !text-success hover:opacity-80">
              ▶ RESUME
            </button>
          ) : (
            <button onClick={pause} className="label hover:text-primary">
              ⏸ PAUSE
            </button>
          )}
          <button onClick={stop} className="label hover:text-accent">
            ■ STOP
          </button>
        </div>
      </div>
    </TtsCtx.Provider>
  );
}
