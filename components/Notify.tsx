"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

type Kind = "error" | "info";
type Note = { id: number; msg: string; kind: Kind };

const NotifyCtx = createContext<(msg: string, kind?: Kind) => void>(() => {});

export function useNotify() {
  return useContext(NotifyCtx);
}

// Inline status notifier (not a bouncy toast): bordered monospace lines pinned
// to the bottom, auto-dismiss, click to clear. Used for API errors everywhere.
export function NotifyProvider({ children }: { children: ReactNode }) {
  const [notes, setNotes] = useState<Note[]>([]);

  const notify = useCallback((msg: string, kind: Kind = "error") => {
    const id = Date.now() + Math.random();
    setNotes((n) => [...n, { id, msg, kind }]);
    setTimeout(
      () => setNotes((n) => n.filter((x) => x.id !== id)),
      4500,
    );
  }, []);

  return (
    <NotifyCtx.Provider value={notify}>
      {children}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 w-full max-w-md px-4 pointer-events-none">
        {notes.map((n) => (
          <button
            key={n.id}
            onClick={() => setNotes((x) => x.filter((y) => y.id !== n.id))}
            className={`pointer-events-auto w-full text-left bg-surface border rounded-[4px] px-4 py-3 font-mono text-caption hover:opacity-80 ${
              n.kind === "error"
                ? "border-accent text-accent"
                : "border-border-strong text-primary"
            }`}
          >
            {n.msg}
          </button>
        ))}
      </div>
    </NotifyCtx.Provider>
  );
}
