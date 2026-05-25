# Per-section LLM Iterative Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user refine one section's `optimized` text via a one-line LLM instruction, previewing the result as a draft they can accept, regenerate, or discard.

**Architecture:** A new pure prompt-builder + thin LLM call (`lib/agent/refine.ts`) modelled on `lib/agent/chat.ts`. A new `Store.updateOptimized` method persists an accepted draft. A new `/api/refine` route exposes POST (generate candidate, no write) and PUT (accept, persist). A self-contained client component `SectionRefine` owns the per-section preview UI and replaces the inline Optimized block in `SectionBoard`.

**Tech Stack:** Next.js 16 (App Router, Node runtime), TypeScript, Supabase, `@openai/agents` (via the OpenAI-compatible DashScope gateway), Vitest, Tailwind v4, lucide-react, pnpm.

> **Spec:** `docs/superpowers/specs/2026-05-25-section-refine-design.md`. One deliberate improvement over the spec: instead of lifting `sections` into `SectionBoard` state, the per-section refine state is encapsulated in a new `SectionRefine` component (cleaner boundary, focused file).

---

## File Structure

- **Create** `lib/agent/refine.ts` — `buildRefinePrompt` (pure) + `refineOptimized` (LLM call).
- **Create** `tests/refine-prompt.test.ts` — unit test for `buildRefinePrompt`.
- **Create** `tests/store-update-optimized.test.ts` — unit test for `updateOptimized` via `memoryStore`.
- **Create** `app/api/refine/route.ts` — POST (generate) + PUT (accept).
- **Create** `components/SectionRefine.tsx` — self-contained per-section refine UI.
- **Modify** `lib/store/types.ts` — add `updateOptimized` to the `Store` interface.
- **Modify** `lib/store/memory.ts` — implement `updateOptimized`.
- **Modify** `lib/store/supabase.ts` — implement `updateOptimized`.
- **Modify** `components/SectionBoard.tsx` — replace the inline Optimized block with `<SectionRefine/>`.

No DB migration — the `segments.optimized` column already exists (migration `0003_optimized`).

---

## Task 1: Store `updateOptimized`

**Files:**
- Test: `tests/store-update-optimized.test.ts`
- Modify: `lib/store/types.ts`
- Modify: `lib/store/memory.ts`
- Modify: `lib/store/supabase.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/store-update-optimized.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { memoryStore } from "@/lib/store/memory";
import type { PresentationRecord } from "@/lib/store/types";

function seed(): Omit<PresentationRecord, "id"> {
  return {
    userId: "u1",
    title: "Talk",
    rawText: "a\n\nb",
    sourceType: "text",
    plan: {
      sections: [
        { title: "A", text: "a", optimized: "old A", summary: "", keyPoints: [], difficulty: "medium" },
        { title: "B", text: "b", optimized: "old B", summary: "", keyPoints: [], difficulty: "medium" },
      ],
    },
    practice: [],
  };
}

describe("updateOptimized", () => {
  it("replaces one section's optimized text and leaves others untouched", async () => {
    const rec = await memoryStore.create(seed());
    await memoryStore.updateOptimized(rec.id, "u1", 1, "new B");
    const got = await memoryStore.get(rec.id, "u1");
    expect(got?.plan.sections[1].optimized).toBe("new B");
    expect(got?.plan.sections[0].optimized).toBe("old A");
  });

  it("is a no-op for a non-owner", async () => {
    const rec = await memoryStore.create(seed());
    await memoryStore.updateOptimized(rec.id, "intruder", 0, "hacked");
    const got = await memoryStore.get(rec.id, "u1");
    expect(got?.plan.sections[0].optimized).toBe("old A");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- store-update-optimized`
Expected: FAIL — `memoryStore.updateOptimized is not a function`.

- [ ] **Step 3: Add the method to the `Store` interface**

In `lib/store/types.ts`, inside `export interface Store { ... }`, add after `updatePractice`:

```ts
  updateOptimized(id: string, userId: string, sectionIndex: number, optimized: string): Promise<void>;
```

- [ ] **Step 4: Implement in the memory store**

In `lib/store/memory.ts`, add a method to `memoryStore` (after `updatePractice`):

```ts
  async updateOptimized(id, userId, sectionIndex, optimized) {
    const r = db.get(id);
    if (r && r.userId === userId && r.plan.sections[sectionIndex]) {
      r.plan.sections[sectionIndex].optimized = optimized;
    }
  },
```

- [ ] **Step 5: Implement in the Supabase store**

In `lib/store/supabase.ts`, add a method to `supabaseStore` (after `updatePractice`):

```ts
  async updateOptimized(id, userId, sectionIndex, optimized) {
    const supabase = await createClient();
    void userId; // RLS scopes the update to the owner
    const { error } = await supabase
      .from("segments")
      .update({ optimized })
      .eq("presentation_id", id)
      .eq("order_index", sectionIndex);
    if (error) throw error;
  },
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm test -- store-update-optimized`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add lib/store/types.ts lib/store/memory.ts lib/store/supabase.ts tests/store-update-optimized.test.ts
git commit -m "feat: Store.updateOptimized — persist a single section's optimized text"
```

---

## Task 2: `refineOptimized` LLM function

**Files:**
- Test: `tests/refine-prompt.test.ts`
- Create: `lib/agent/refine.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/refine-prompt.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildRefinePrompt } from "@/lib/agent/refine";

describe("buildRefinePrompt", () => {
  it("includes the title, current text, the instruction, and the no-headings rule", () => {
    const p = buildRefinePrompt("Market", "Our market is huge.", "make it more conversational");
    expect(p).toContain("Market");
    expect(p).toContain("Our market is huge.");
    expect(p).toContain("make it more conversational");
    expect(p).toMatch(/do not use headings/i);
    expect(p).toMatch(/do not add new facts/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- refine-prompt`
Expected: FAIL — cannot resolve `@/lib/agent/refine` / `buildRefinePrompt` is not a function.

- [ ] **Step 3: Write the implementation**

Create `lib/agent/refine.ts`:

```ts
import { openaiClient } from "./client";

// Pure prompt builder (unit-tested). Steers the model to rewrite ONE section's
// already-optimized markdown per the user's instruction, without inventing facts
// and without breaking the app's markdown conventions.
export function buildRefinePrompt(
  title: string,
  currentOptimized: string,
  instruction: string,
): string {
  return `You are an English presentation coach. Below is the current presentation-ready version of ONE section of a talk, written in markdown.

Section title: ${title}
Current version:
${currentOptimized}

Apply this instruction from the speaker to improve it: "${instruction}"

Rules:
- Preserve the speaker's meaning and intent. Do NOT add new facts.
- Keep clean standard markdown: short paragraphs separated by blank lines, "- " bullet lists for enumerations, **bold** for only a few key terms. Do NOT use headings (#).
- Output ONLY the revised markdown for this section — no preamble, no explanation.`;
}

// Returns the revised markdown. Direct chat-completions call (works through the
// OpenAI-compatible gateway); plain text output, so no json_object constraints.
export async function refineOptimized(
  title: string,
  currentOptimized: string,
  instruction: string,
): Promise<string> {
  const client = openaiClient();
  const resp = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages: [
      { role: "system", content: buildRefinePrompt(title, currentOptimized, instruction) },
    ],
  });
  return resp.choices[0]?.message?.content?.trim() ?? "";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- refine-prompt`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add lib/agent/refine.ts tests/refine-prompt.test.ts
git commit -m "feat: refineOptimized — LLM rewrite of one section's optimized text"
```

---

## Task 3: `/api/refine` route (generate + accept)

**Files:**
- Create: `app/api/refine/route.ts`

- [ ] **Step 1: Write the route**

Create `app/api/refine/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { refineOptimized } from "@/lib/agent/refine";
import { rateLimit } from "@/lib/ratelimit";
import { isLlmAllowed } from "@/lib/allowlist";
import { supabaseStore } from "@/lib/store/supabase";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

async function authed() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

const GenBody = z.object({
  presentationId: z.string().min(1),
  sectionIndex: z.number().int().nonnegative(),
  instruction: z.string().min(1).max(500),
});

// POST = generate a candidate (no DB write).
export async function POST(req: NextRequest) {
  const user = await authed();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isLlmAllowed(user.email)) {
    return NextResponse.json({ error: "not allowed" }, { status: 403 });
  }
  if (!(await rateLimit(user.id, "refine", 30, 600))) {
    return NextResponse.json({ error: "rate limited — try again later" }, { status: 429 });
  }

  const parsed = GenBody.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }
  const { presentationId, sectionIndex, instruction } = parsed.data;

  const rec = await supabaseStore.get(presentationId, user.id);
  const section = rec?.plan.sections[sectionIndex];
  if (!rec || !section) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  try {
    const optimized = await refineOptimized(section.title, section.optimized, instruction);
    if (!optimized) throw new Error("empty result");
    return NextResponse.json({ optimized });
  } catch (e) {
    console.error("refine failed:", e);
    return NextResponse.json({ error: "refine failed" }, { status: 502 });
  }
}

const AcceptBody = z.object({
  presentationId: z.string().min(1),
  sectionIndex: z.number().int().nonnegative(),
  optimized: z.string().min(1),
});

// PUT = accept/persist the chosen candidate (no LLM call).
export async function PUT(req: NextRequest) {
  const user = await authed();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = AcceptBody.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }
  const { presentationId, sectionIndex, optimized } = parsed.data;

  const rec = await supabaseStore.get(presentationId, user.id);
  if (!rec || !rec.plan.sections[sectionIndex]) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  try {
    await supabaseStore.updateOptimized(presentationId, user.id, sectionIndex, optimized);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("accept refine failed:", e);
    return NextResponse.json({ error: "save failed" }, { status: 502 });
  }
}
```

- [ ] **Step 2: Typecheck via build**

Run: `pnpm build`
Expected: build succeeds; route list includes `ƒ /api/refine`.

- [ ] **Step 3: Commit**

```bash
git add app/api/refine/route.ts
git commit -m "feat: /api/refine route — POST generates a candidate, PUT accepts it"
```

---

## Task 4: `SectionRefine` component

**Files:**
- Create: `components/SectionRefine.tsx`

- [ ] **Step 1: Write the component**

Create `components/SectionRefine.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Sparkles, Check, RotateCcw, X } from "lucide-react";
import { Button, Label } from "@/components/nothing";
import { SpeakableMarkdown } from "@/components/SpeakableMarkdown";
import { useNotify } from "@/components/Notify";

// Self-contained per-section refine UI: renders the current optimized text and,
// on demand, an LLM-generated draft the user can accept / regenerate / discard.
export function SectionRefine({
  presentationId,
  sectionIndex,
  title,
  optimized: initialOptimized,
}: {
  presentationId: string;
  sectionIndex: number;
  title: string;
  optimized: string;
}) {
  const notify = useNotify();
  const [optimized, setOptimized] = useState(initialOptimized);
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [lastInstruction, setLastInstruction] = useState("");
  const [candidate, setCandidate] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [accepting, setAccepting] = useState(false);

  async function generate(text: string) {
    const q = text.trim();
    if (!q || generating) return;
    setGenerating(true);
    setLastInstruction(q);
    try {
      const res = await fetch("/api/refine", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ presentationId, sectionIndex, instruction: q }),
      });
      if (!res.ok) throw new Error(`refine failed (${res.status})`);
      const { optimized: draft } = await res.json();
      setCandidate(draft);
    } catch (e) {
      notify(`[ERROR: ${e instanceof Error ? e.message : "refine failed"}]`);
    } finally {
      setGenerating(false);
    }
  }

  async function accept() {
    if (candidate == null || accepting) return;
    setAccepting(true);
    try {
      const res = await fetch("/api/refine", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ presentationId, sectionIndex, optimized: candidate }),
      });
      if (!res.ok) throw new Error(`save failed (${res.status})`);
      setOptimized(candidate);
      setCandidate(null);
      setInstruction("");
      setOpen(false);
    } catch (e) {
      notify(`[ERROR: ${e instanceof Error ? e.message : "save failed"}]`);
    } finally {
      setAccepting(false);
    }
  }

  return (
    <div className="space-y-2">
      <Label className="!text-success">Optimized · double-click a paragraph to hear it</Label>
      <div className={candidate != null ? "opacity-40" : ""}>
        <SpeakableMarkdown>{optimized}</SpeakableMarkdown>
      </div>

      {(generating || candidate != null) && (
        <div className="border border-dashed border-accent rounded-[6px] p-3 space-y-3">
          <Label className="!text-accent flex items-center gap-1.5">
            <Sparkles size={13} />
            {generating ? "Draft · generating…" : `Draft · "${lastInstruction}"`}
          </Label>
          {generating ? (
            <div className="space-y-2">
              <div className="h-3 bg-surface-raised rounded-[2px] w-5/6" />
              <div className="h-3 bg-surface-raised rounded-[2px] w-2/3" />
              <div className="h-3 bg-surface-raised rounded-[2px] w-3/4" />
            </div>
          ) : (
            candidate != null && (
              <>
                <SpeakableMarkdown>{candidate}</SpeakableMarkdown>
                <div className="flex flex-wrap gap-2">
                  <Button variant="primary" onClick={accept} disabled={accepting} className="!px-4 !py-2 gap-1.5">
                    <Check size={13} />
                    {accepting ? "SAVING…" : "ACCEPT"}
                  </Button>
                  <Button variant="ghost" onClick={() => generate(lastInstruction)} className="!px-4 !py-2 gap-1.5">
                    <RotateCcw size={13} />
                    REGENERATE
                  </Button>
                  <Button variant="ghost" onClick={() => setCandidate(null)} className="!px-4 !py-2 gap-1.5">
                    <X size={13} />
                    DISCARD
                  </Button>
                </div>
              </>
            )
          )}
        </div>
      )}

      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="label hover:text-primary flex items-center gap-1.5"
        >
          <Sparkles size={13} />
          REFINE
        </button>
      ) : (
        <div className="flex gap-2">
          <input
            autoFocus
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && generate(instruction)}
            placeholder="how should I improve this? e.g. make it more conversational"
            className="flex-1 bg-surface border border-border rounded-[4px] px-3 py-2 text-primary text-body focus:border-primary outline-none"
          />
          <Button variant="primary" onClick={() => generate(instruction)} disabled={generating} className="gap-1.5">
            <Sparkles size={13} />
            {generating ? "OPTIMIZING…" : "OPTIMIZE"}
          </Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck via build**

Run: `pnpm build`
Expected: build succeeds (component compiles even though not yet rendered anywhere).

- [ ] **Step 3: Commit**

```bash
git add components/SectionRefine.tsx
git commit -m "feat: SectionRefine component — draft preview with accept/regenerate/discard"
```

---

## Task 5: Wire `SectionRefine` into `SectionBoard`

**Files:**
- Modify: `components/SectionBoard.tsx`

- [ ] **Step 1: Import the component**

In `components/SectionBoard.tsx`, add after the existing `SpeakableMarkdown` import (line 7):

```tsx
import { SectionRefine } from "@/components/SectionRefine";
```

The `SpeakableMarkdown` import is now only used transitively; leave it imported only if still referenced — after Step 2 it is no longer used directly here, so remove the `SpeakableMarkdown` import line if your linter flags it.

- [ ] **Step 2: Replace the inline Optimized block**

In `components/SectionBoard.tsx`, replace this block (currently lines 133-136):

```tsx
                <div className="space-y-2">
                  <Label className="!text-success">Optimized · double-click a paragraph to hear it</Label>
                  <SpeakableMarkdown>{sec.optimized}</SpeakableMarkdown>
                </div>
```

with:

```tsx
                <SectionRefine
                  presentationId={id}
                  sectionIndex={sec.index}
                  title={sec.title}
                  optimized={sec.optimized}
                />
```

- [ ] **Step 3: Build to verify it compiles**

Run: `pnpm build`
Expected: build succeeds; no unused-import errors.

- [ ] **Step 4: Run the full unit suite**

Run: `pnpm test`
Expected: all tests pass (including the two new specs from Tasks 1-2).

- [ ] **Step 5: Manual verification (dev server)**

Run: `pnpm dev`, open a presentation page on `localhost:3000`, then:
- Confirm each section shows a `✦ REFINE` link under its Optimized text.
- Click REFINE → input appears → type "make it more conversational" → press Enter (or OPTIMIZE).
- Confirm the current text dims and a red dashed Draft block renders the new markdown.
- Click REGENERATE → a different draft appears for the same instruction.
- Click ACCEPT → draft replaces the Optimized text; reload the page and confirm it persisted.
- Click REFINE → DISCARD on a fresh draft → original stays unchanged, no persistence.

- [ ] **Step 6: Commit**

```bash
git add components/SectionBoard.tsx
git commit -m "feat: wire per-section refine UI into SectionBoard"
```

---

## Self-Review Notes

- **Spec coverage:** prompt+LLM (Task 2), persistence method (Task 1), generate/accept routes (Task 3), preview UI with accept/regenerate/discard + dimmed compare + `✦ REFINE` toggle (Tasks 4-5), rate-limit bucket `refine` 30/600 (Task 3), ownership checks server-side (Task 3), errors via `Notify` (Task 4), no migration (confirmed). All covered.
- **Type consistency:** `updateOptimized(id, userId, sectionIndex, optimized)` is identical across the interface (Task 1 Step 3), memory (Step 4), supabase (Step 5), and the PUT handler (Task 3). `refineOptimized(title, currentOptimized, instruction)` matches between `refine.ts` (Task 2) and the POST handler (Task 3). `SectionRefine` props (`presentationId, sectionIndex, title, optimized`) match the call site in Task 5.
- **Manual-only surfaces:** the LLM network call and the auth/RLS route are verified by build + the Task 5 manual checklist, per project convention (pure logic is unit-tested; LLM/DB I/O is smoke-tested).
```
