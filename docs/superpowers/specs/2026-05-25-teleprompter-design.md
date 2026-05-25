# Teleprompter (presentation delivery) mode — design

**Date:** 2026-05-25
**Status:** approved (brainstorming) → ready for implementation plan

## Goal

A distraction-free "delivery" mode for when the user is actually giving the talk: show
the whole presentation as flowing text, and let them tap any sentence to make it the
single highlighted, enlarged "cursor" sentence — a quick-recall teleprompter.

## Scope

In scope:
- A dedicated full-viewport route that renders the whole talk (all sections) as the
  **optimized** text, broken into paragraphs and sentences.
- Click a sentence → it becomes the single active sentence (highlighted + enlarged),
  the previous one returns to normal, and it smooth-scrolls to vertical center.
- An entry button on the presentation page; a close affordance + a one-tap true
  fullscreen toggle (browser Fullscreen API) inside the mode.

Out of scope (YAGNI):
- No keyboard/space/arrow advancing (click only, for now).
- No text-to-speech in this mode (purely visual; the user speaks).
- No editing, no original-vs-optimized toggle, no persistence — read-only view.
- No new API route, no DB change, no LLM call.

## UX

A new full-viewport route `/present/[id]`, black background, no app header/breadcrumb —
just the teleprompter surface (page fills the browser window). Nothing design system:
monochrome, Space Grotesk body, Space Mono caps for the small labels, single red accent.

```
┌──────────────────────────────────────────────────────────┐  full viewport · black
│  ✕                       figma-code-connect…    ⛶ FULLSCREEN│  top bar (dim)
│                                                            │
│    01 · OPENING AND THE AI CODING CHALLENGE                │  section label (mono, dim)
│                                                            │
│    Hello everyone. My name is Django.        ← dim grey    │
│                                                            │
│  ┃ TODAY I WANT TO SHARE HOW WE USE FIGMA CODE CONNECT.    │  ← ACTIVE: enlarged + bright,
│                                                            │     red left accent bar
│    Many of us already use AI tools like Claude or Cursor.  │  ← dim grey
│    A common workflow looks like this. …                    │
└──────────────────────────────────────────────────────────┘
```

States & behavior:
- **Content:** every section's `optimized` markdown, in order, split into paragraphs;
  each paragraph split into sentences. Each sentence is an individually clickable span.
- **Section dividers:** each section's title rendered as a small dim mono label above its
  paragraphs (orientation only).
- **Active sentence (single-cursor):** exactly one sentence is active at a time. Active =
  larger font + bright (`text-display`) + a red left accent bar. All other sentences are
  dim (`text-secondary`) at the base size. Clicking any sentence makes it active and
  reverts the previous one.
- **Auto-center:** on activation, the sentence smooth-scrolls to the vertical center of
  the viewport (`scrollIntoView({ behavior: "smooth", block: "center" })`).
- **Initial state:** no sentence active (or the first sentence active — see Decisions).
- **True fullscreen:** a `⛶ FULLSCREEN` toggle in the top bar calls the Fullscreen API on
  the teleprompter root (must be user-gesture-triggered — the click satisfies this).
  Label flips to `EXIT FULLSCREEN` while active; state tracked via a `fullscreenchange`
  listener.
- **Exit:** a `✕` button returns to `/presentation/[id]`. `Escape` also returns — but only
  when NOT in browser fullscreen (in fullscreen, the browser consumes Escape to leave
  fullscreen first; a second Escape then navigates back).

## Components / units

### 1. `lib/teleprompter.ts` (new) — pure text splitting
`toParagraphs(markdown: string): string[]`
- Splits optimized markdown into paragraph/line units: split on runs of newlines, trim,
  drop empties. Blank-line-separated paragraphs and individual bullet lines each become
  their own unit (the model's optimized output puts each paragraph and each bullet on its
  own line).
- The component then calls the existing `splitSentences` (from `lib/tts.ts`) on each
  paragraph to get clickable sentences (`splitSentences` already strips markdown/bullets).
- Pure → unit-tested.

```ts
export function toParagraphs(md: string): string[] {
  return md
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
}
```

### 2. `app/present/[id]/page.tsx` (new) — server route
- Mirrors `app/presentation/[id]/page.tsx`: `await params`, `createClient`, get the user,
  `supabaseStore.get(id, user.id)`, `notFound()` if missing.
- Renders only `<Teleprompter title={record.title} sections={record.plan.sections} />`.
  No `AppHeader`, no `Breadcrumb`, no page padding wrapper — the component owns the full
  viewport.

### 3. `components/Teleprompter.tsx` (new) — client component
- Props: `{ title: string; sections: { title: string; optimized: string }[] }`.
- Precompute (via `useMemo`) a flat list of render items: for each section, a `section`
  divider item, then for each paragraph (`toParagraphs(sec.optimized)`) a `paragraph` item
  whose sentences come from `splitSentences(paragraph)`. Assign every sentence a unique
  running `index`.
- State: `active: number | null` (the active sentence's running index);
  `isFullscreen: boolean`.
- A `ref` per active sentence (or query by `data-idx`) to `scrollIntoView` on change.
- Renders: a fixed top bar (`✕` close → `Link`/`router` to `/presentation/[id]`, the
  title, and the `⛶ FULLSCREEN` toggle); below it the scrollable transcript. Each sentence
  is a `<span role="button">` (or `<button>`) that sets `active` on click; active styling
  applied conditionally.
- Fullscreen: `toggleFullscreen()` → `document.fullscreenElement ? document.exitFullscreen()
  : rootRef.current?.requestFullscreen()`. `useEffect` adds a `fullscreenchange` listener to
  sync `isFullscreen`.
- `useEffect` keydown listener: `Escape` && `!document.fullscreenElement` → navigate to
  `/presentation/[id]`.
- Uses Nothing primitives (`Label`) and lucide icons (`X`, `Maximize`/`Minimize`).

### 4. `components/PlanView.tsx` (changed) — entry button
- In the hero action row (near the `ENTER FOCUS` link / `PresentationActions`), add a
  secondary `PRESENT` button linking to `/present/${record.id}` (lucide `Presentation` or
  `Maximize` icon). Outline/ghost weight so `ENTER FOCUS` stays the single primary CTA.

## Data flow

```
/present/[id] (server) → supabaseStore.get → plan.sections[].optimized
   → <Teleprompter> (client)
       toParagraphs(optimized) → splitSentences(paragraph) → indexed sentence spans
       click span → setActive(index) → scrollIntoView(center)
       ⛶ → requestFullscreen()/exitFullscreen(); ✕ / Esc → back to /presentation/[id]
```

No writes, no API, no LLM. Practice/SRS untouched.

## Error handling

- Missing/non-owner record → `notFound()` (same as the presentation page; RLS-scoped get).
- Fullscreen API rejection (e.g. unsupported/denied) → caught and ignored; the page-fill
  layout still works, so the mode degrades gracefully.

## Testing

- **Vitest (pure):** `toParagraphs` — multi-paragraph (blank-line separated), bullet lines
  become separate units, leading/trailing whitespace and empty input handled. Sentence
  splitting itself is already covered by the existing `tts` tests for `splitSentences`.
- **Manual:** the route + click-to-highlight + center-scroll + fullscreen toggle verified
  live in the browser.

## Decisions / defaults

- **Initial active sentence:** none active on load (clean wall of dim text); the user taps
  to begin. (Alternative — auto-activate the first sentence — rejected as presumptuous.)
- **Active color:** bright `text-display` (white/near-white) + red left accent bar, not
  fully red text (keeps the red accent as a thin marker, per the one-accent-moment rule).
- **Entry button label:** `PRESENT`.

## Affected files

- New: `lib/teleprompter.ts`, `app/present/[id]/page.tsx`, `components/Teleprompter.tsx`,
  `tests/teleprompter.test.ts`.
- Changed: `components/PlanView.tsx` (entry button).
- No DB migration, no API route, no env change.
