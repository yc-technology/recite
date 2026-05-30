# Add a Section to an Existing Plan — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user paste raw text into an existing presentation, run it through the existing LLM pipeline to produce one enriched section, preview it, and insert it at a chosen position (with a fresh SRS card).

**Architecture:** Reuse `normalize` + `analyze` (no prompt changes) behind a `generateSection` orchestrator that collapses normalize's output to a single section. A two-step API mirrors `refine` (POST = preview candidate, PUT = persist). Insertion reindexes trailing `segments.order_index` and `practice_records.segment_index` atomically via a Postgres function. Pure helpers (`collapseToOneSection`, `insertSectionIntoPlan`) are unit-tested.

**Tech Stack:** Next.js 16 (App Router, Node runtime routes) · TypeScript · `@openai/agents` SDK (DashScope gateway) · Supabase (Postgres + RLS) · Vitest · pnpm · lucide-react · Nothing design system.

**Spec:** `docs/superpowers/specs/2026-05-29-add-section-design.md`

**Conventions to honor (from CLAUDE.md):**
- Run tests with `pnpm test` (Vitest). Path alias `@/` → repo root.
- Migrations: no `psql`. Apply with a throwaway Node + `pg` script over `POSTGRES_URL_NON_POOLING` (strip `?...`, `ssl: { rejectUnauthorized: false }`).
- Icons: lucide-react only. No emoji/ASCII glyphs.
- The model never alters the user's text; enrichments merge by index (`mergeEnrichments`).

---

## File Structure

- **Create** `lib/agent/addSection.ts` — `collapseToOneSection` (pure) + `generateSection` (LLM orchestrator).
- **Create** `lib/sections.ts` — `insertSectionIntoPlan` (pure).
- **Create** `supabase/migrations/0006_add_section.sql` — `insert_section_at` Postgres function.
- **Create** `app/api/section/route.ts` — POST (preview) + PUT (insert).
- **Create** `components/SectionAdd.tsx` — client UI (paste → position → style → preview → confirm).
- **Create** `tests/collapse-section.test.ts`, `tests/insert-section.test.ts`, `tests/store-add-section.test.ts`.
- **Modify** `lib/store/types.ts` — add `addSection` to `Store` interface.
- **Modify** `lib/store/supabase.ts` — implement `addSection` via RPC.
- **Modify** `lib/store/memory.ts` — implement `addSection` (also the unit-test target).
- **Modify** `components/SectionBoard.tsx` — render `<SectionAdd>` entry.
- **Modify** `CLAUDE.md` — migrations list + key-files note.

---

## Task 1: `collapseToOneSection` (pure)

**Files:**
- Create: `lib/agent/addSection.ts`
- Test: `tests/collapse-section.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/collapse-section.test.ts
import { describe, it, expect } from "vitest";
import { collapseToOneSection } from "@/lib/agent/addSection";

describe("collapseToOneSection", () => {
  it("joins multiple sections' text with a blank line and keeps the first title", () => {
    const one = collapseToOneSection({
      sections: [
        { title: "Intro", text: "Hello there." },
        { title: "Body", text: "More content." },
      ],
    });
    expect(one.title).toBe("Intro");
    expect(one.text).toBe("Hello there.\n\nMore content.");
  });

  it("passes a single section through unchanged", () => {
    const one = collapseToOneSection({ sections: [{ title: "Solo", text: "Just one." }] });
    expect(one).toEqual({ title: "Solo", text: "Just one." });
  });

  it("falls back to 'Untitled' and empty text when there are no sections", () => {
    const one = collapseToOneSection({ sections: [] });
    expect(one).toEqual({ title: "Untitled", text: "" });
  });

  it("trims surrounding whitespace and skips empty fragments", () => {
    const one = collapseToOneSection({
      sections: [
        { title: "  Title  ", text: "  first  " },
        { title: "B", text: "   " },
        { title: "C", text: "second" },
      ],
    });
    expect(one.title).toBe("Title");
    expect(one.text).toBe("first\n\nsecond");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test collapse-section`
Expected: FAIL — `collapseToOneSection` is not exported / module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/agent/addSection.ts
import { Agent, run } from "@openai/agents";
import {
  EnrichmentsSchema,
  type Normalized,
  type NormalizedSection,
  type Section,
  type OptimizeStyle,
} from "./schema";
import { normalizePresentation } from "./normalize";
import { analyzeSections } from "./analyze";

// Force normalize's (possibly multi-section) output into ONE section:
// keep the first non-empty title, join all non-empty texts with a blank line.
export function collapseToOneSection(normalized: Normalized): NormalizedSection {
  const sections = normalized.sections ?? [];
  const title = sections.map((s) => s.title.trim()).find((t) => t.length > 0) ?? "Untitled";
  const text = sections
    .map((s) => s.text.trim())
    .filter((t) => t.length > 0)
    .join("\n\n");
  return { title, text };
}
```

(`analyzeSections`, `Agent`, `run`, `EnrichmentsSchema`, `Section`, `OptimizeStyle` are imported now and used in Task 2 — leave them imported.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test collapse-section`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/agent/addSection.ts tests/collapse-section.test.ts
git commit -m "feat: collapseToOneSection — fold normalize output into one section

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: `generateSection` orchestrator (LLM)

**Files:**
- Modify: `lib/agent/addSection.ts`

> Not unit-tested (it makes real LLM calls); verified by the smoke script in Task 8. It reuses the already-tested `normalize` / `analyze` / `mergeEnrichments`.

- [ ] **Step 1: Append the orchestrator**

```ts
// lib/agent/addSection.ts  (append below collapseToOneSection)

// Raw pasted text → one fully-enriched Section, via the existing pipeline:
// normalize (clean + title) → collapse to one → analyze (summary/keyPoints/
// difficulty/optimized). No prompt changes; the model never invents the text.
export async function generateSection(
  rawText: string,
  style: OptimizeStyle = "simple",
): Promise<Section> {
  const normalized = await normalizePresentation(rawText);
  const one = collapseToOneSection(normalized);
  const plan = await analyzeSections([one], style);
  // analyzeSections returns a StudyPlan with exactly one merged section.
  return plan.sections[0];
}
```

- [ ] **Step 2: Remove now-unused imports**

`Agent`, `run`, and `EnrichmentsSchema` are NOT used by the final file — delete them from the import block so the build stays clean. The import block should end as:

```ts
import {
  type Normalized,
  type NormalizedSection,
  type Section,
  type OptimizeStyle,
} from "./schema";
import { normalizePresentation } from "./normalize";
import { analyzeSections } from "./analyze";
```

- [ ] **Step 3: Typecheck**

Run: `pnpm build`
Expected: build succeeds (no unused-import / type errors). If `pnpm build` is slow, `npx tsc --noEmit` is an acceptable substitute.

- [ ] **Step 4: Commit**

```bash
git add lib/agent/addSection.ts
git commit -m "feat: generateSection — raw text to one enriched section

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: `insertSectionIntoPlan` (pure)

**Files:**
- Create: `lib/sections.ts`
- Test: `tests/insert-section.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/insert-section.test.ts
import { describe, it, expect } from "vitest";
import { insertSectionIntoPlan } from "@/lib/sections";
import type { Section, StudyPlan } from "@/lib/agent/schema";

const mk = (t: string): Section => ({
  title: t, text: t, optimized: t, summary: "", keyPoints: [], difficulty: "medium",
});
const plan = (): StudyPlan => ({ sections: [mk("A"), mk("B"), mk("C")] });

describe("insertSectionIntoPlan", () => {
  it("inserts in the middle", () => {
    const out = insertSectionIntoPlan(plan(), 1, mk("NEW"));
    expect(out.sections.map((s) => s.title)).toEqual(["A", "NEW", "B", "C"]);
  });

  it("inserts at the start", () => {
    const out = insertSectionIntoPlan(plan(), 0, mk("NEW"));
    expect(out.sections.map((s) => s.title)).toEqual(["NEW", "A", "B", "C"]);
  });

  it("appends at the end when position == length", () => {
    const out = insertSectionIntoPlan(plan(), 3, mk("NEW"));
    expect(out.sections.map((s) => s.title)).toEqual(["A", "B", "C", "NEW"]);
  });

  it("clamps an out-of-range position to the end", () => {
    const out = insertSectionIntoPlan(plan(), 99, mk("NEW"));
    expect(out.sections.map((s) => s.title)).toEqual(["A", "B", "C", "NEW"]);
  });

  it("clamps a negative position to the start and does not mutate the input", () => {
    const original = plan();
    const out = insertSectionIntoPlan(original, -5, mk("NEW"));
    expect(out.sections.map((s) => s.title)).toEqual(["NEW", "A", "B", "C"]);
    expect(original.sections).toHaveLength(3); // input untouched
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test insert-section`
Expected: FAIL — module `@/lib/sections` not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/sections.ts
import type { Section, StudyPlan } from "@/lib/agent/schema";

// Pure insert: clamp position into [0, length], splice the section in, return a
// new plan (input is not mutated). Single source of truth for insert semantics.
export function insertSectionIntoPlan(
  plan: StudyPlan,
  position: number,
  section: Section,
): StudyPlan {
  const n = plan.sections.length;
  const pos = Math.max(0, Math.min(Math.trunc(position), n));
  const sections = [...plan.sections.slice(0, pos), section, ...plan.sections.slice(pos)];
  return { sections };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test insert-section`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/sections.ts tests/insert-section.test.ts
git commit -m "feat: insertSectionIntoPlan pure helper

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Store `addSection` — interface + memory impl (unit-tested)

**Files:**
- Modify: `lib/store/types.ts`
- Modify: `lib/store/memory.ts`
- Test: `tests/store-add-section.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/store-add-section.test.ts
import { describe, it, expect } from "vitest";
import { memoryStore } from "@/lib/store/memory";
import type { PresentationRecord } from "@/lib/store/types";
import { initialCard } from "@/lib/srs/sm2";

const mkSection = (t: string) => ({
  title: t, text: t, optimized: t, summary: "", keyPoints: [], difficulty: "medium" as const,
});

function seed(): Omit<PresentationRecord, "id"> {
  const now = new Date();
  return {
    userId: "u1",
    title: "Talk",
    rawText: "a\n\nb",
    sourceType: "text",
    plan: { sections: [mkSection("A"), mkSection("B")] },
    practice: [
      { ...initialCard(now), segmentIndex: 0, masteryLevel: 3 },
      { ...initialCard(now), segmentIndex: 1, masteryLevel: 2 },
    ],
  };
}

describe("addSection", () => {
  it("inserts a section in the middle and reindexes trailing sections + practice", async () => {
    const rec = await memoryStore.create(seed());
    await memoryStore.addSection(rec.id, "u1", 1, mkSection("NEW"));
    const got = await memoryStore.get(rec.id, "u1");

    expect(got?.plan.sections.map((s) => s.title)).toEqual(["A", "NEW", "B"]);
    // practice now has 3 cards; segmentIndexes are 0,1,2 with the new one at 1
    expect(got?.practice.map((p) => p.segmentIndex).sort((x, y) => x - y)).toEqual([0, 1, 2]);
    // the old "B" card (mastery 2) shifted from index 1 to index 2
    const shifted = got?.practice.find((p) => p.segmentIndex === 2);
    expect(shifted?.masteryLevel).toBe(2);
    // the new card sits at index 1 with default SM-2 state (mastery 1, reps 0)
    const fresh = got?.practice.find((p) => p.segmentIndex === 1);
    expect(fresh?.masteryLevel).toBe(1);
    expect(fresh?.repetitions).toBe(0);
  });

  it("appends at the end when position == length", async () => {
    const rec = await memoryStore.create(seed());
    await memoryStore.addSection(rec.id, "u1", 2, mkSection("NEW"));
    const got = await memoryStore.get(rec.id, "u1");
    expect(got?.plan.sections.map((s) => s.title)).toEqual(["A", "B", "NEW"]);
    expect(got?.practice.find((p) => p.segmentIndex === 2)?.masteryLevel).toBe(1);
  });

  it("is a no-op for a non-owner", async () => {
    const rec = await memoryStore.create(seed());
    await memoryStore.addSection(rec.id, "intruder", 0, mkSection("HACK"));
    const got = await memoryStore.get(rec.id, "u1");
    expect(got?.plan.sections).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Add the method to the `Store` interface**

In `lib/store/types.ts`, add to the `Store` interface (after `updateOptimized`):

```ts
  addSection(id: string, userId: string, position: number, section: Section): Promise<void>;
```

(`Section` is already imported at the top of `types.ts`.)

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm test store-add-section`
Expected: FAIL — `memoryStore.addSection is not a function` (interface requires it; memory impl missing).

- [ ] **Step 4: Implement in the memory store**

In `lib/store/memory.ts`, add imports at the top:

```ts
import { insertSectionIntoPlan } from "@/lib/sections";
import { initialCard } from "@/lib/srs/sm2";
import type { Section } from "@/lib/agent/schema";
```

Add the method inside `memoryStore` (after `updateOptimized`):

```ts
  async addSection(id, userId, position, section: Section) {
    const r = db.get(id);
    if (!r || r.userId !== userId) return;
    const n = r.plan.sections.length;
    const pos = Math.max(0, Math.min(Math.trunc(position), n));
    r.plan = insertSectionIntoPlan(r.plan, pos, section);
    // shift trailing practice cards, then add a fresh card at `pos`
    for (const p of r.practice) if (p.segmentIndex >= pos) p.segmentIndex += 1;
    r.practice.push({ ...initialCard(new Date()), segmentIndex: pos, masteryLevel: 1 });
  },
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm test store-add-section`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/store/types.ts lib/store/memory.ts tests/store-add-section.test.ts
git commit -m "feat: Store.addSection + memory impl with practice reindex

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: DB migration — `insert_section_at` function

**Files:**
- Create: `supabase/migrations/0006_add_section.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 0006_add_section: atomically insert a section at a position, shifting the
-- trailing segments + practice cards. SECURITY INVOKER (default) → RLS applies.
create or replace function insert_section_at(
  p_presentation_id uuid,
  p_position int,
  p_title text,
  p_content text,
  p_optimized text,
  p_summary text,
  p_key_points jsonb,
  p_difficulty text,
  p_user_id uuid
) returns void
language plpgsql
as $$
begin
  update segments set order_index = order_index + 1
    where presentation_id = p_presentation_id and order_index >= p_position;
  update practice_records set segment_index = segment_index + 1
    where presentation_id = p_presentation_id and segment_index >= p_position;
  insert into segments(presentation_id, order_index, title, content, optimized,
                       summary, key_points, difficulty)
    values (p_presentation_id, p_position, p_title, p_content, p_optimized,
            p_summary, p_key_points, p_difficulty);
  -- SM-2 columns (ease, interval_days, repetitions, due_at, mastery_level) use
  -- their table defaults: 2.5 / 0 / 0 / now() / 1.
  insert into practice_records(presentation_id, user_id, segment_index)
    values (p_presentation_id, p_user_id, p_position);
end;
$$;
```

- [ ] **Step 2: Apply it to Supabase (throwaway Node script)**

Create a temp script `scripts/_apply-0006.mjs` (delete it after):

```js
import { readFileSync } from "node:fs";
import pg from "pg";

const url = process.env.POSTGRES_URL_NON_POOLING.split("?")[0];
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
await client.query(readFileSync("supabase/migrations/0006_add_section.sql", "utf8"));
console.log("applied 0006_add_section");
await client.end();
```

Run (loads `.env.local`):

```bash
node --env-file=.env.local scripts/_apply-0006.mjs
```

Expected: prints `applied 0006_add_section`. Then remove the temp script:

```bash
rm scripts/_apply-0006.mjs
```

> If `pg` is not installed, `pnpm add -D pg` first. If `--env-file` is unsupported by the local Node, export `POSTGRES_URL_NON_POOLING` inline before the command instead.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0006_add_section.sql
git commit -m "feat: 0006_add_section — insert_section_at Postgres function

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Store `addSection` — Supabase impl (via RPC)

**Files:**
- Modify: `lib/store/supabase.ts`

> The memory store is the unit-test surface; the Supabase impl is verified by the smoke script (Task 8). Keep the two impls behaviorally identical.

- [ ] **Step 1: Implement the method**

In `lib/store/supabase.ts`, add `import type { Section } from "@/lib/agent/schema";` to the top imports, then add inside `supabaseStore` (after `updateOptimized`):

```ts
  async addSection(id, userId, position, section: Section) {
    const supabase = await createClient();
    const { error } = await supabase.rpc("insert_section_at", {
      p_presentation_id: id,
      p_position: position,
      p_title: section.title,
      p_content: section.text,
      p_optimized: section.optimized,
      p_summary: section.summary,
      p_key_points: section.keyPoints,
      p_difficulty: section.difficulty,
      p_user_id: userId,
    });
    if (error) throw error;
  },
```

- [ ] **Step 2: Typecheck**

Run: `pnpm build`
Expected: build succeeds (both Store impls now satisfy the interface).

- [ ] **Step 3: Commit**

```bash
git add lib/store/supabase.ts
git commit -m "feat: supabaseStore.addSection via insert_section_at RPC

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: API route — `POST` (preview) + `PUT` (insert)

**Files:**
- Create: `app/api/section/route.ts`

> Modelled on `app/api/refine/route.ts`. No unit test (route handler with auth + LLM); exercised by Task 8.

- [ ] **Step 1: Write the route**

```ts
// app/api/section/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateSection } from "@/lib/agent/addSection";
import { OptimizeStyleSchema, SectionSchema } from "@/lib/agent/schema";
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
  rawText: z.string().trim().min(1).max(20000),
  style: OptimizeStyleSchema.optional(),
});

// POST = generate a candidate section (no DB write).
export async function POST(req: NextRequest) {
  const user = await authed();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isLlmAllowed(user.email)) {
    return NextResponse.json({ error: "not allowed" }, { status: 403 });
  }
  if (!(await rateLimit(user.id, "section", 30, 600))) {
    return NextResponse.json({ error: "rate limited — try again later" }, { status: 429 });
  }

  const parsed = GenBody.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }
  const { presentationId, rawText, style } = parsed.data;

  // Ownership: you may only add to your own presentation.
  const rec = await supabaseStore.get(presentationId, user.id);
  if (!rec) return NextResponse.json({ error: "not found" }, { status: 404 });

  try {
    const section = await generateSection(rawText, style ?? "simple");
    return NextResponse.json({ section });
  } catch (e) {
    console.error("generate section failed:", e);
    return NextResponse.json({ error: "generate failed" }, { status: 502 });
  }
}

const InsertBody = z.object({
  presentationId: z.string().min(1),
  position: z.number().int().nonnegative(),
  section: SectionSchema,
});

// PUT = insert the chosen candidate at a position (no LLM call).
export async function PUT(req: NextRequest) {
  const user = await authed();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = InsertBody.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }
  const { presentationId, position, section } = parsed.data;

  const rec = await supabaseStore.get(presentationId, user.id);
  if (!rec) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Clamp to [0, length]; the store/RPC persists the shift. position is already
  // a non-negative int (zod), so a single Math.min is enough.
  const clamped = Math.min(position, rec.plan.sections.length);

  try {
    await supabaseStore.addSection(presentationId, user.id, clamped, section);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("insert section failed:", e);
    return NextResponse.json({ error: "save failed" }, { status: 502 });
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm build`
Expected: build succeeds; `/api/section` appears in the route list.

- [ ] **Step 3: Commit**

```bash
git add app/api/section/route.ts
git commit -m "feat: /api/section — POST preview + PUT insert

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Smoke test the full pipeline (manual, no commit)

**Files:**
- Temp: `scripts/_smoke-section.mjs` (delete after)

> Verifies `generateSection` (DashScope) + `insert_section_at` (Supabase reindex) end to end. Requires `.env.local`. This is a project-convention manual check; nothing is committed.

- [ ] **Step 1: Drive POST then PUT against the running dev server**

Start the dev server in one shell: `pnpm dev`. Then, signed in as the test account in the browser, copy the `sb-...-auth-token` cookie, OR simpler: exercise the units directly with a `tsx` script:

```bash
npx tsx --env-file=.env.local -e '
import { generateSection } from "./lib/agent/addSection";
const s = await generateSection("Our team shipped three features this quarter. Revenue grew. Next we focus on retention.", "simple");
console.log(JSON.stringify(s, null, 2));
if (!s.title || !s.optimized || !s.summary) throw new Error("missing fields");
console.log("OK: generateSection produced a complete section");
'
```

Expected: a JSON `Section` with non-empty `title`, `text`, `optimized`, `summary`, `keyPoints`, `difficulty`.

- [ ] **Step 2: Verify the RPC reindexes (against a throwaway row)**

Create `scripts/_smoke-section.mjs`:

```js
import pg from "pg";
const url = process.env.POSTGRES_URL_NON_POOLING.split("?")[0];
const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();
// Pick one of your own presentations to test against (set PRES_ID + USER_ID).
const presId = process.env.PRES_ID, userId = process.env.USER_ID;
const before = await c.query(
  "select order_index, title from segments where presentation_id=$1 order by order_index", [presId]);
console.log("before:", before.rows);
await c.query("select insert_section_at($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)",
  [presId, 1, "SMOKE", "smoke text", "smoke optimized", "sum", JSON.stringify(["k1"]), "medium", userId]);
const after = await c.query(
  "select order_index, title from segments where presentation_id=$1 order by order_index", [presId]);
console.log("after:", after.rows);
const prac = await c.query(
  "select segment_index from practice_records where presentation_id=$1 order by segment_index", [presId]);
console.log("practice indexes:", prac.rows.map(r => r.segment_index));
await c.end();
```

Run:

```bash
PRES_ID=<your-presentation-id> USER_ID=<your-user-id> node --env-file=.env.local scripts/_smoke-section.mjs
```

Expected: `after` shows `SMOKE` at `order_index` 1 with the old index-1 section pushed to 2; `practice indexes` are contiguous `0,1,2,...` with no gaps/duplicates.

- [ ] **Step 3: Clean up**

```bash
rm scripts/_smoke-section.mjs
```

(Optionally delete the SMOKE section via the app UI once Task 9 is done, or leave it — it's harmless test data.)

---

## Task 9: UI — `SectionAdd` component + wire into `SectionBoard`

**Files:**
- Create: `components/SectionAdd.tsx`
- Modify: `components/SectionBoard.tsx`

> Nothing design: monochrome, Space Mono caps labels, single red accent, no shadows. Follow `SectionRefine`'s in-flight/notify patterns. `Markdown` lives at `components/Markdown.tsx` (used to render `optimized`).

- [ ] **Step 1: Write `SectionAdd`**

```tsx
// components/SectionAdd.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Button, Card, Label } from "@/components/nothing";
import { Markdown } from "@/components/Markdown";
import { useNotify } from "@/components/Notify";
import type { Section } from "@/lib/agent/schema";

const STYLES = ["simple", "native", "formal", "concise"] as const;

// Lets the user paste raw text, generate one enriched section via the LLM
// pipeline, preview it, choose a position, and insert it into the plan.
export function SectionAdd({
  id,
  sectionTitles,
}: {
  id: string;
  sectionTitles: string[]; // existing section titles, in order
}) {
  const router = useRouter();
  const notify = useNotify();
  const [open, setOpen] = useState(false);
  const [rawText, setRawText] = useState("");
  const [style, setStyle] = useState<(typeof STYLES)[number]>("simple");
  const [position, setPosition] = useState(sectionTitles.length); // default: end
  const [candidate, setCandidate] = useState<Section | null>(null);
  const [generating, setGenerating] = useState(false);
  const [inserting, setInserting] = useState(false);

  function reset() {
    setOpen(false);
    setRawText("");
    setCandidate(null);
    setPosition(sectionTitles.length);
  }

  async function generate() {
    if (!rawText.trim() || generating) return;
    setGenerating(true);
    setCandidate(null);
    try {
      const res = await fetch("/api/section", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ presentationId: id, rawText, style }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "generate failed");
      const { section } = await res.json();
      setCandidate(section as Section);
    } catch (e) {
      notify(e instanceof Error ? e.message : "generate failed");
    } finally {
      setGenerating(false);
    }
  }

  async function insert() {
    if (!candidate || inserting) return;
    setInserting(true);
    try {
      const res = await fetch("/api/section", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ presentationId: id, position, section: candidate }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "save failed");
      reset();
      router.refresh();
    } catch (e) {
      notify(e instanceof Error ? e.message : "save failed");
    } finally {
      setInserting(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="label hover:text-primary flex items-center gap-1.5"
      >
        <Plus size={13} />
        NEW SECTION
      </button>
    );
  }

  return (
    <Card className="space-y-3 border-border-strong">
      <div className="flex items-center justify-between">
        <Label>New section</Label>
        <button onClick={reset} aria-label="Close" className="text-secondary hover:text-primary">
          <X size={15} />
        </button>
      </div>

      <textarea
        value={rawText}
        onChange={(e) => setRawText(e.target.value)}
        placeholder="Paste the text for the new section…"
        rows={5}
        className="w-full bg-surface border border-border rounded-[6px] p-3 text-body text-primary"
      />

      <div className="flex flex-wrap items-center gap-3">
        <label className="label flex items-center gap-2">
          Position
          <select
            value={position}
            onChange={(e) => setPosition(Number(e.target.value))}
            className="bg-surface border border-border rounded-[4px] px-2 py-1 text-label text-primary"
          >
            {sectionTitles.map((t, i) => (
              <option key={i} value={i}>{`Before ${i + 1}. ${t}`}</option>
            ))}
            <option value={sectionTitles.length}>At end</option>
          </select>
        </label>

        <label className="label flex items-center gap-2">
          Style
          <select
            value={style}
            onChange={(e) => setStyle(e.target.value as (typeof STYLES)[number])}
            className="bg-surface border border-border rounded-[4px] px-2 py-1 text-label text-primary"
          >
            {STYLES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>

        <Button onClick={generate} disabled={generating || !rawText.trim()}>
          {generating ? "GENERATING…" : "GENERATE"}
        </Button>
      </div>

      {candidate && (
        <div className="space-y-3 border-t border-border pt-3">
          <h3 className="font-grotesk font-medium text-primary text-title">{candidate.title}</h3>
          {candidate.summary && (
            <p className="text-secondary text-body leading-relaxed">{candidate.summary}</p>
          )}
          <Markdown>{candidate.optimized}</Markdown>
          <div className="flex items-center gap-3">
            <Button onClick={insert} disabled={inserting}>
              {inserting ? "INSERTING…" : "CONFIRM INSERT"}
            </Button>
            <button onClick={() => setCandidate(null)} className="label hover:text-primary">
              DISCARD
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
```

> Verify the import names against the codebase before running: `Button`, `Card`, `Label` are exported from `@/components/nothing`; `Markdown` from `@/components/Markdown` (check whether its prop is `children` or `content` — adjust the `<Markdown>` usage to match `Markdown.tsx`). `useNotify` returns a function used as `notify(message)` — confirm its signature in `components/Notify.tsx` and adapt if it differs.

- [ ] **Step 2: Wire it into `SectionBoard`**

In `components/SectionBoard.tsx`, add the import near the top:

```tsx
import { SectionAdd } from "@/components/SectionAdd";
```

Then in the sections `<section>`, change the header line so the add entry sits beside the count. Replace:

```tsx
        <Label>Sections — {sections.length}</Label>
```

with:

```tsx
        <div className="flex items-center justify-between gap-3">
          <Label>Sections — {sections.length}</Label>
          <SectionAdd id={id} sectionTitles={sections.map((s) => s.title)} />
        </div>
```

- [ ] **Step 3: Typecheck + visual check**

Run: `pnpm build`
Expected: build succeeds.

Then `pnpm dev`, open a presentation, click **NEW SECTION**, paste a paragraph, GENERATE, confirm a preview renders, pick a position, CONFIRM INSERT, and confirm the new section appears at the chosen spot after refresh.

- [ ] **Step 4: Commit**

```bash
git add components/SectionAdd.tsx components/SectionBoard.tsx
git commit -m "feat: SectionAdd UI — paste, preview, insert a new section

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 10: Docs

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the migrations list**

In `CLAUDE.md`, in the "DB migrations" section, append to the migration list:

```
· `0006_add_section` (insert_section_at function: atomic insert + reindex)
```

- [ ] **Step 2: Note the feature in key files**

In the "Architecture / key files" `lib/agent/` bullet, add a mention of `addSection.ts` (raw text → one enriched section, reuses normalize+analyze), and in `components/` note `SectionAdd` (paste → preview → insert a new section).

- [ ] **Step 3: Run the full test suite**

Run: `pnpm test`
Expected: all tests pass, including the three new files.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: note add-section feature + 0006 migration

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Done criteria

- `pnpm test` green (incl. `collapse-section`, `insert-section`, `store-add-section`).
- `pnpm build` succeeds; `/api/section` present.
- Migration `0006_add_section` applied to Supabase.
- In the app: NEW SECTION → paste → GENERATE → preview → choose position → CONFIRM INSERT → section appears at the chosen position with a fresh practice card; reindexing keeps `segment_index` contiguous.
```
