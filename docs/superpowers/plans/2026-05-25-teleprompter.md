# Teleprompter Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A full-viewport `/present/[id]` delivery mode that shows the whole talk's optimized text by paragraph; tapping a sentence makes it the single enlarged, highlighted "cursor" sentence, with a one-tap true-fullscreen toggle.

**Architecture:** A pure `toParagraphs` splitter feeds the existing `splitSentences` to build an indexed sentence model. A server route loads the record (like the presentation page) and renders a client `Teleprompter` component that owns the single-active-sentence state, center-scroll, fullscreen toggle, and exit. An entry button is added to the presentation hero. Read-only — no API, DB, or LLM.

**Tech Stack:** Next.js 16 (App Router, Node runtime, async route params), React client component, TypeScript, Tailwind v4, lucide-react, Supabase (read via existing store), Vitest, pnpm.

> **Spec:** `docs/superpowers/specs/2026-05-25-teleprompter-design.md`

---

## File Structure

- **Create** `lib/teleprompter.ts` — pure `toParagraphs(markdown): string[]`.
- **Create** `tests/teleprompter.test.ts` — unit tests for `toParagraphs`.
- **Create** `components/Teleprompter.tsx` — client component: indexed sentence rendering, single-active highlight, center-scroll, fullscreen toggle, Esc/close exit.
- **Create** `app/present/[id]/page.tsx` — server route loading the record and rendering `<Teleprompter>`.
- **Modify** `components/PlanView.tsx` — add a `Present` entry button to the hero.

No DB migration, no API route, no env change.

---

## Task 1: `toParagraphs` splitter

**Files:**
- Test: `tests/teleprompter.test.ts`
- Create: `lib/teleprompter.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/teleprompter.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { toParagraphs } from "@/lib/teleprompter";

describe("toParagraphs", () => {
  it("splits blank-line separated paragraphs", () => {
    expect(toParagraphs("First para.\n\nSecond para.")).toEqual([
      "First para.",
      "Second para.",
    ]);
  });

  it("treats each bullet line as its own unit", () => {
    expect(toParagraphs("Intro line.\n- one\n- two")).toEqual([
      "Intro line.",
      "- one",
      "- two",
    ]);
  });

  it("trims whitespace and drops empty lines", () => {
    expect(toParagraphs("\n\n  hello  \n\n")).toEqual(["hello"]);
  });

  it("returns [] for empty or whitespace-only input", () => {
    expect(toParagraphs("   \n  ")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- teleprompter`
Expected: FAIL — cannot resolve `@/lib/teleprompter` / `toParagraphs` is not a function.

- [ ] **Step 3: Write the implementation**

Create `lib/teleprompter.ts`:

```ts
// Split optimized markdown into paragraph/line units for the teleprompter.
// The model's optimized output puts each paragraph and each bullet on its own
// line, so splitting on runs of newlines yields one unit per paragraph/bullet.
// Each unit is then sentence-split by lib/tts.ts `splitSentences` at render time.
export function toParagraphs(md: string): string[] {
  return md
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- teleprompter`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/teleprompter.ts tests/teleprompter.test.ts
git commit -m "feat: toParagraphs splitter for teleprompter mode"
```

---

## Task 2: `Teleprompter` client component

**Files:**
- Create: `components/Teleprompter.tsx`

- [ ] **Step 1: Write the component**

Create `components/Teleprompter.tsx` with EXACTLY this content:

```tsx
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
          <X size={16} />
          CLOSE
        </Link>
        <span className="label truncate">{title}</span>
        <button
          onClick={toggleFullscreen}
          className="label hover:text-primary flex items-center gap-1.5"
        >
          {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
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
```

- [ ] **Step 2: Typecheck via build**

Run: `pnpm build`
Expected: build succeeds (component compiles even though not yet rendered anywhere).

If the build fails, verify imports exist: `Label` from `@/components/nothing`; `toParagraphs` from `@/lib/teleprompter` (Task 1); `splitSentences` from `@/lib/tts`; `X, Maximize, Minimize` from `lucide-react`. Fix only genuine compile errors; do not change behavior.

- [ ] **Step 3: Commit**

```bash
git add components/Teleprompter.tsx
git commit -m "feat: Teleprompter component — single-cursor sentence highlight + fullscreen"
```

## Context for Task 2
- `splitSentences` (`lib/tts.ts`) strips markdown (including leading `- ` bullets) and returns trimmed sentence strings — so passing it a bullet unit like `"- one"` yields `["one"]`.
- `min-h-dvh` + `py-[40vh]` gives enough head/tail room so even the first and last sentence can scroll to vertical center.
- Inactive sentences keep `border-l-2 border-transparent pl-4` so activating the red bar doesn't shift text horizontally.
- The `Section` prop type is `{ title; optimized }` — the route passes full `plan.sections` objects, which are a structural superset and assignable.

---

## Task 3: `/present/[id]` server route

**Files:**
- Create: `app/present/[id]/page.tsx`

- [ ] **Step 1: Write the route**

Create `app/present/[id]/page.tsx` with EXACTLY this content:

```tsx
import { notFound } from "next/navigation";
import { Teleprompter } from "@/components/Teleprompter";
import { supabaseStore } from "@/lib/store/supabase";
import { createClient } from "@/lib/supabase/server";

// Next.js 16: route params are async and must be awaited.
export default async function PresentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const record = user ? await supabaseStore.get(id, user.id) : null;
  if (!record) notFound();

  return (
    <Teleprompter
      id={record.id}
      title={record.title}
      sections={record.plan.sections}
    />
  );
}
```

- [ ] **Step 2: Typecheck via build**

Run: `pnpm build`
Expected: build succeeds; the route list includes `/present/[id]`.

This mirrors `app/presentation/[id]/page.tsx` exactly (same imports, same `get`/`notFound` guard) minus the `AppHeader`/`Breadcrumb`/`main` wrapper — the `Teleprompter` owns the full viewport. Fix only genuine compile errors.

- [ ] **Step 3: Commit**

```bash
git add app/present/[id]/page.tsx
git commit -m "feat: /present/[id] route renders the teleprompter"
```

---

## Task 4: `Present` entry button on the presentation hero

**Files:**
- Modify: `components/PlanView.tsx`

- [ ] **Step 1: Add the lucide icon import**

In `components/PlanView.tsx`, the current import is:

```tsx
import { ArrowRight } from "lucide-react";
```

Change it to:

```tsx
import { ArrowRight, Presentation } from "lucide-react";
```

- [ ] **Step 2: Add the Present button next to Enter focus**

In `components/PlanView.tsx`, find this block:

```tsx
          <Link href={`/practice/${record.id}`}>
            <Button variant="primary" className="px-8 py-4 gap-2">
              {dueCount > 0 ? "Enter focus" : "Practice anyway"}
              <ArrowRight size={15} />
            </Button>
          </Link>
```

Replace it with (wraps both buttons in a flex group, Present as the lower-weight outline button so Enter focus stays the single primary CTA):

```tsx
          <div className="flex items-center gap-3">
            <Link href={`/present/${record.id}`}>
              <Button variant="outline" className="px-6 py-4 gap-2">
                <Presentation size={15} />
                Present
              </Button>
            </Link>
            <Link href={`/practice/${record.id}`}>
              <Button variant="primary" className="px-8 py-4 gap-2">
                {dueCount > 0 ? "Enter focus" : "Practice anyway"}
                <ArrowRight size={15} />
              </Button>
            </Link>
          </div>
```

- [ ] **Step 3: Build to verify it compiles**

Run: `pnpm build`
Expected: build succeeds; no unused-import or type errors.

- [ ] **Step 4: Run the full unit suite**

Run: `pnpm test`
Expected: all tests pass (including the 4 new `toParagraphs` tests).

- [ ] **Step 5: Manual verification (dev server)**

Run: `pnpm dev`, open a presentation page on `localhost:3000`, then:
- Confirm a `Present` button sits next to `Enter focus` in the hero.
- Click it → lands on `/present/[id]`, black full-viewport, no app header, talk shown by paragraph with dim sentences.
- Click any sentence → it enlarges + brightens with a red left bar, the previous one reverts, and it scrolls to center.
- Click `⛶ FULLSCREEN` → browser enters true fullscreen; label flips to `EXIT FULLSCREEN`; press Esc → leaves fullscreen.
- With no fullscreen active, press Esc (or click `CLOSE`) → returns to `/presentation/[id]`.

- [ ] **Step 6: Commit**

```bash
git add components/PlanView.tsx
git commit -m "feat: add Present (teleprompter) entry button to presentation hero"
```

---

## Self-Review Notes

- **Spec coverage:** full-viewport route (Task 3), optimized text by paragraph + sentence (Tasks 1-2), single-cursor highlight + enlarge + red bar (Task 2), center-scroll (Task 2), section dividers (Task 2), true fullscreen toggle + Esc/close exit (Task 2), entry button (Task 4), no API/DB/LLM, pure splitter unit-tested (Task 1). All covered.
- **Type consistency:** `toParagraphs(md: string): string[]` matches between `lib/teleprompter.ts` (Task 1) and its use in `buildItems` (Task 2). `Teleprompter` props `{ id, title, sections }` match the call site in Task 3. `splitSentences` is imported from the existing `lib/tts.ts`.
- **Decisions honored:** no sentence active on load (`active` starts `null`); active = bright `text-display` + red left bar (not full red text); entry label `Present`.
- **Manual-only surfaces:** the route, client interactions, and fullscreen are verified by build + the Task 4 manual checklist, per project convention (pure logic unit-tested; UI/route smoke-tested).
```
