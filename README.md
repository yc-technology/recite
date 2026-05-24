# RECITE

An English-presentation rehearsal app. Upload your talk, an OpenAI agent breaks it
into recitation segments + a day-by-day study plan, then you drill each segment with
cloze (masked) recall on an SM-2 spaced-repetition schedule. UI is built in the
Nothing design language (monochrome, dot-matrix, one red accent), with light/dark modes.

## Stack

- **Next.js 16** (App Router) + TypeScript + Tailwind CSS v4
- **OpenAI Agents SDK** (`@openai/agents`) for presentation analysis (structured output via zod)
- **Supabase** — Auth + Postgres (RLS) for persistence
- **Vitest** for the pure-logic core (scheduler, cloze, parsing, schema)
- File parsing: `unpdf` (PDF), `jszip` (PPTX), native decode (md/txt)

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in the values below
```

### Environment variables

| Variable | Required | Notes |
|----------|----------|-------|
| `OPENAI_API_KEY` | yes | Your OpenAI key. |
| `OPENAI_BASE_URL` | no | Override the OpenAI endpoint (proxy / OpenAI-compatible gateway). Leave blank for the official API. |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Supabase anon/public key. |
| `SUPABASE_SERVICE_ROLE_KEY` | no | Reserved for server-only admin tasks. |

`.env.local` is gitignored. Never commit real keys.

### Database

Apply the migration to your Supabase project (creates the tables + row-level security
so each user only sees their own data):

```bash
# Supabase CLI
supabase db push
# — or — paste supabase/migrations/0001_init.sql into the Supabase SQL editor.
```

Email auth is used out of the box. If you disable "Confirm email" in the Supabase
Auth settings, sign-up logs you in immediately; otherwise confirm via the emailed link
before signing in.

## Develop

```bash
npm run dev      # http://localhost:3000
npm test         # run the unit suite (Vitest)
npm run build    # production build
```

### Flow

1. `/login` — sign up / sign in (Supabase).
2. `/upload` — pick a PDF/PPTX/MD/TXT; the text is extracted, then the agent builds a plan.
3. `/presentation/[id]` — review segments, difficulty, hints, and the daily schedule.
4. `/practice/[id]` — recall each segment from masked blanks, reveal, then self-grade
   (Again / Hard / Good / Easy). Grades feed the SM-2 schedule.
5. `/` — dashboard shows total cards due and an "Enter focus" shortcut to the busiest deck.

## Architecture notes

- `lib/srs/` — SM-2 lite scheduler (pure, unit-tested).
- `lib/cloze.ts` — sentence masking (pure, unit-tested).
- `lib/parse/` — file → text, dispatched by extension.
- `lib/agent/` — agent definition, zod `StudyPlanSchema`, and the OpenAI client
  (honors `OPENAI_BASE_URL`).
- `lib/store/` — a single `Store` interface with two implementations: `memory.ts`
  (kept for reference/local experiments) and `supabase.ts` (the live one). The store is
  the snake_case ↔ camelCase mapping boundary.
- `lib/supabase/` — browser + server (async-cookies) clients; `proxy.ts` at the root
  refreshes the session and gates unauthenticated users to `/login`.
- `components/nothing/` — Nothing design primitives (Button, Card, Label, ThemeToggle).

## Deploy (Vercel)

1. Import the repo into Vercel.
2. Set the environment variables from the table above in Project Settings.
3. Deploy. `vercel.json` gives `app/api/analyze` a 60s `maxDuration` for the agent call.

The OpenAI Agents SDK and all file parsing run on the Node.js runtime inside route
handlers (`export const runtime = "nodejs"`).
