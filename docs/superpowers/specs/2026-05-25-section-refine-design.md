# Per-section LLM iterative refinement — design

**Date:** 2026-05-25
**Status:** approved (brainstorming) → ready for implementation plan

## Goal

Let the user iteratively improve the **optimized version** of any single section by
giving the LLM a one-line instruction (e.g. "make it more conversational"). The result
is shown as a **draft candidate**; the user decides whether to **accept**, **regenerate**,
or **discard** it. Nothing is persisted until the user accepts.

## Scope

In scope:
- Per-section, instruction-driven LLM refinement of the `optimized` text only.
- Candidate-preview flow with Accept / Regenerate / Discard.

Out of scope (YAGNI):
- Manual hand-editing of any text (original or optimized).
- Refreshing `summary` / `keyPoints` / `difficulty` (the section's meaning is unchanged).
- Touching the original `text` (原版) — it stays exactly as-is.
- Candidate history / undo stack (discard drops it; accept overwrites).

## UX

Lives in the section cards on the presentation page (`SectionBoard`, fed by `PlanView`).
Nothing design system: monochrome, Space Mono caps labels, single red accent `#d71921`,
no shadows.

States per section:

1. **Idle** — under the Optimized block, a single compact `✦ REFINE` link (kept minimal).
2. **Input** — clicking `✦ REFINE` expands a one-line instruction input + `OPTIMIZE`
   button. Enter submits.
3. **Generating** — `OPTIMIZE` shows `OPTIMIZING…` (disabled); a `✦ DRAFT · generating…`
   skeleton block appears below the current optimized.
4. **Candidate** — the current optimized stays visible but **dimmed** (so the user can
   compare old vs new); below it, a **red dashed-border draft block** renders the
   candidate markdown, labelled `✦ DRAFT · "<instruction>"`, with three actions:
   - **ACCEPT** (red/primary, the only emphasised action) → persist, replace current,
     dismiss draft, clear input, TTS picks up the new text.
   - **REGENERATE** (secondary) → re-run the **same instruction** against the **current**
     optimized (not the candidate) to produce an alternative draft.
   - **DISCARD** (secondary) → drop the candidate client-side; current returns to full
     opacity. No network call.

Errors (403/429/502/network) surface via the existing global `Notify` top toast; the
card reverts to its prior state.

## Components / units

### 1. `lib/agent/refine.ts` (new)
`refineOptimized(title, currentOptimized, instruction) => Promise<string>`

> Note: no `style` parameter — the per-section optimize-style is not persisted on the
> record, and the free-text instruction is the sole steering signal here.

- Direct chat-completions call, modelled on `lib/agent/chat.ts` (works through the
  DashScope OpenAI-compatible gateway). Returns plain markdown — **no** `json_object`
  response format, so the gateway's json constraints don't apply.
- System prompt: given the current presentation-ready markdown for a section, apply the
  user's instruction to improve it. Preserve meaning/intent, add no new facts, keep the
  existing formatting rules (short paragraphs, `- ` bullet lists, sparing `**bold**`, no
  headings). Output ONLY the revised markdown.
- The prompt-builder is a pure function (extracted, unit-tested like other prompts).

### 2. `lib/store/` — add `updateOptimized`
- `types.ts`: extend `Store` with
  `updateOptimized(id, userId, sectionIndex, optimized): Promise<void>`.
- `supabase.ts`: update `segments.optimized` where `presentation_id = id` and
  `order_index = sectionIndex`. RLS scopes to the owner; mirror the `rename` pattern
  (`void userId`). **No migration** — the `optimized` column already exists (0003).
- Called only on ACCEPT.

### 3. `app/api/refine/route.ts` (new) — two methods
Auth + allowlist + ownership boilerplate copied from `analyze`/`chat` routes.
`runtime = "nodejs"`, `maxDuration = 60`.

- **POST = generate candidate (no DB write)**
  - Body: `{ presentationId: string, sectionIndex: number, instruction: string }`.
  - Auth → `isLlmAllowed` → `rateLimit(user.id, "refine", 30, 600)` (new bucket).
  - `supabaseStore.get(presentationId, user.id)` to verify ownership and read the
    **authoritative** current `optimized` (and title) as the base — the client's
    copy is never trusted.
  - Call `refineOptimized(...)`; return `{ optimized: <candidate> }`. Nothing persisted.
  - Regenerate = the client simply POSTs again.

- **PUT = accept / persist**
  - Body: `{ presentationId: string, sectionIndex: number, optimized: string }`.
  - Auth → ownership check → `supabaseStore.updateOptimized(...)`. No LLM call, light.
  - Persisting the client-sent candidate text is acceptable: it is the user's own row
    (RLS owner-only); "no manual edit" is a UI decision, not a security boundary.

### 4. `components/SectionBoard.tsx` (changed)
- Lift `sections` (currently a prop) into local `useState` so an accepted optimized can
  be replaced in place without a full reload.
- Per-section local UI state: `refineOpen`, `instruction`, `candidate`,
  `generating`, `accepting`.
- Render the `✦ REFINE` toggle → input row → draft block per the UX above.
- Use Nothing primitives (`Button`, `Label`) and `lucide-react` icons (e.g. `Wand2`/
  `Sparkles`, `Check`, `RotateCcw`, `X`). Candidate markdown renders via the existing
  `Markdown` / `SpeakableMarkdown` component.

## Data flow

```
[input instruction] → POST /api/refine
        → store.get (verify owner, read current optimized as base)
        → refineOptimized(LLM) → { optimized: candidate }   (no write)
[ACCEPT] → PUT /api/refine → store.updateOptimized → segments.optimized
        → client replaces optimized in local state
[REGENERATE] → POST /api/refine again (same instruction, same base)
[DISCARD]    → client drops candidate (no network)
```

SRS/practice is unaffected: practice cards are keyed by `segmentIndex`; editing optimized
text in place changes no indices, so progress is preserved.

## Error handling

- 401 unauthorized / 403 not-allowed / 429 rate-limited / 502 LLM failure → JSON error
  consumed by the client and shown via global `Notify`.
- In-flight: OPTIMIZE / ACCEPT buttons disabled; on failure the card reverts.

## Testing

- **Vitest (pure):** the `refine` prompt-builder string function (same approach as the
  existing analyze/chat/write prompt tests).
- **Manual:** the live LLM call verified with a throwaway `tsx` smoke script against
  DashScope, per project convention.

## Affected files

- New: `lib/agent/refine.ts`, `app/api/refine/route.ts`, prompt-builder test.
- Changed: `lib/store/types.ts`, `lib/store/supabase.ts`, `components/SectionBoard.tsx`.
- No DB migration.
