# Add a section to an existing plan — design

**Date:** 2026-05-29
**Status:** approved (brainstorming) → ready for implementation plan

## Goal

Let the user incrementally **add a new section** to an existing presentation/plan after
it was first created. The user pastes raw text; it runs through the same
`normalize` + `analyze` pipeline as the main creation flow, is shown as a **preview**,
and on confirmation is **inserted at a chosen position** (with a fresh SRS practice card).

## Decisions (locked during brainstorming)

1. **Content source:** paste raw text → run the existing LLM pipeline
   (`normalize` + `analyze`) to produce a fully-enriched section.
2. **Position:** user-selectable insert position (not just append). Inserting in the
   middle reindexes the trailing sections.
3. **Granularity:** force the pasted text into **exactly one section** (collapse
   `normalize`'s multi-section output down to one) — mental model is "add *a* section".
4. **Flow:** two-step **preview → confirm**, mirroring the existing `refine` route
   (POST generates a candidate with no DB write; PUT persists).

## Scope

In scope:
- A new section produced from pasted raw text, enriched by the existing pipeline.
- Preview of the generated section before it is inserted.
- Insert at any position (start / between / end); reindex trailing sections + practice.
- A new SRS practice card for the inserted section (default SM-2 state).

Out of scope (YAGNI):
- Title given a manual editor (title comes from `normalize`; optional style picker only).
- Splitting pasted text into multiple sections (collapsed to one by decision #3).
- Reordering / deleting existing sections (separate feature).
- Editing the generated preview text by hand before insert (use `refine` afterwards).

## Data model recap

- `presentations` = the plan. `segments` = sections, ordered by `order_index`.
- `practice_records` = one SRS card per section, located by `segment_index`.
- Neither `order_index` nor `segment_index` has a DB unique constraint, so a bulk
  `+ 1` shift is safe (no transient-uniqueness conflict).

## Architecture / units

### 1. `lib/agent/addSection.ts` (new) — pipeline glue, pure-ish

Two small **pure** helpers (unit-tested) plus one orchestrator:

- `collapseToOneSection(normalized: Normalized): NormalizedSection`
  - Pure. Title = first section's title (fallback `"Untitled"` if none); text = all
    sections' `text` joined by a blank line. Trims. Handles the empty/0-section case.
- `generateSection(rawText, style?): Promise<Section>` (orchestrator, calls the LLM)
  - `normalizePresentation(rawText)` → `collapseToOneSection(...)` →
    `analyzeSections([one], style)` → returns the single merged `Section`.
  - Reuses the existing, tested `normalize` / `analyze` / `mergeEnrichments` — **no
    prompt changes**.

### 2. `lib/sections.ts` (new) — pure insert/reindex logic

- `insertSectionIntoPlan(plan: StudyPlan, position: number, section: Section): StudyPlan`
  - Pure. Clamps `position` to `[0, sections.length]`, splices in the section.
  - Used for the client-side optimistic refresh and as the single source of truth for
    insert semantics. Unit-tested.

### 3. DB migration `supabase/migrations/0006_add_section.sql` (new)

A Postgres function so the shift + two inserts are **atomic in one transaction**
(`SECURITY INVOKER` — RLS still applies, owner-only):

```sql
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
  insert into practice_records(presentation_id, user_id, segment_index)
    values (p_presentation_id, p_user_id, p_position);  -- SM-2 columns use table defaults
end;
$$;
```

Notes:
- `practice_records` SM-2 columns have table defaults (ease 2.5, interval 0, reps 0,
  due now, mastery 1), so the insert only sets the locating columns.
- `summary` / `key_points` / `difficulty` columns were added by `0002_v2_sections`;
  `optimized` by `0003_optimized`. The function references the current `segments` shape.
- Applied via the throwaway node + `pg` script over `POSTGRES_URL_NON_POOLING` (no psql),
  per project convention. `create or replace function` is idempotent.

### 4. `lib/store/` — new Store method

Add to `Store` (`types.ts`) and implement in `supabase.ts`:

```ts
addSection(id: string, userId: string, position: number, section: Section): Promise<void>
```

- Implemented via `supabase.rpc("insert_section_at", { ... })`.
- `userId` passed for the `practice_records.user_id` insert (RLS `with check`).
- `memory.ts` is retained for reference only — update its `Store` impl too if it still
  implements the interface, else note it as out of date.

### 5. `app/api/section/route.ts` (new) — Node runtime, mirrors `refine`

- **`POST`** — generate candidate (no DB write).
  - body: `{ presentationId, rawText, style? }` (zod; `rawText` non-empty, capped length;
    `style` = `OptimizeStyleSchema`, default `"simple"`).
  - auth → `isLlmAllowed` → `rateLimit(user.id, "section", 30, 600)` (own bucket).
  - ownership: `store.get(presentationId, user.id)` must exist (so you can only add to
    your own plan).
  - `generateSection(rawText, style)` → return `{ section }`. LLM failure → 502.
- **`PUT`** — confirm insert (no LLM).
  - body: `{ presentationId, position, section }` (zod validates the full `Section` via
    `SectionSchema`; `position` int `>= 0`).
  - ownership via `store.get`; clamp `position` to `[0, sections.length]`.
  - `store.addSection(presentationId, user.id, position, section)` → `{ ok: true }`.
  - DB failure → 502.

### 6. UI — `SectionBoard` + a new `SectionAdd` component

- A single **"+ NEW SECTION"** entry near the sticky progress bar / floating nav
  (lucide `Plus`, Nothing design — monochrome, Space Mono caps label, red accent, no
  shadow).
- Opens a panel (`SectionAdd`) with:
  - raw-text `textarea`,
  - **position** selector — default `END`, plus "after «section title»" for each
    existing section (maps to a `position` index),
  - optional **style** selector (default `simple`),
  - **GENERATE** button.
- On GENERATE → POST → render a **preview** (title / cleaned original text / optimized
  markdown via `Markdown.tsx`). Buttons: **CONFIRM INSERT** (primary/red) and
  **DISCARD**.
- CONFIRM → PUT → `router.refresh()`; panel collapses.
- In-flight: lock buttons while generating/inserting (follow `SectionRefine`'s pattern).
- Errors (400/403/429/502/network) surface via the global `Notify` toast; panel reverts.

## Error handling

- Empty / over-length `rawText` → 400 before any LLM call.
- Non-owner or missing presentation → 404 (same shape as `refine`).
- Rate limited → 429; not allowlisted → 403; unauth → 401.
- LLM error in POST → 502 (`"generate failed"`); DB error in PUT → 502 (`"save failed"`).
- The RPC is the only place indices change, and it is transactional, so a failure
  leaves the plan unmodified (no half-reindexed state).

## Testing

- `tests/add-section.test.ts` — `collapseToOneSection` (multi → one, empty, trimming).
- `tests/sections.test.ts` — `insertSectionIntoPlan` (start / middle / end / clamp).
- `mergeEnrichments` already covered by existing tests.
- `insert_section_at` + end-to-end (POST → PUT → reindex correctness) verified with a
  throwaway `tsx` smoke script against DashScope + Supabase (no psql; project convention).

## Files touched

- New: `lib/agent/addSection.ts`, `lib/sections.ts`,
  `supabase/migrations/0006_add_section.sql`, `app/api/section/route.ts`,
  `components/SectionAdd.tsx`, `tests/add-section.test.ts`, `tests/sections.test.ts`.
- Edit: `lib/store/types.ts`, `lib/store/supabase.ts` (+`memory.ts` if applicable),
  `components/SectionBoard.tsx`.
- Docs: update `CLAUDE.md` (DB migrations list → add `0006_add_section`; key files note).
```
