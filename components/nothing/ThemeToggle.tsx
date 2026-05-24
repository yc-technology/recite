"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Mode = "light" | "dark";

function currentMode(): Mode {
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "light" || attr === "dark") return attr;
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

/** Mechanical light/dark switch. Persists choice; defaults to system. */
export function ThemeToggle() {
  const [mode, setMode] = useState<Mode>("dark");

  useEffect(() => setMode(currentMode()), []);

  function toggle() {
    const next: Mode = mode === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {}
    setMode(next);
  }

  return (
    <button
      onClick={toggle}
      aria-label="Toggle color theme"
      className="label hover:text-primary flex items-center gap-1.5"
    >
      {mode === "dark" ? <Moon size={13} /> : <Sun size={13} />}
      {mode === "dark" ? "DARK" : "LIGHT"}
    </button>
  );
}
