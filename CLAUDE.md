@AGENTS.md

# Recite — project guide

English-presentation rehearsal app. Upload/write content → an LLM normalizes &
structures it into sections → spaced-repetition practice + AI coaching. Now also a
**writing coach** that feeds into the same pipeline.

- **Live:** https://recite-nine.vercel.app (Vercel project `sixdjangos-projects/recite`)
- **Repo:** `git@github.com:yc-technology/recite.git` (default branch `main`, auto-deploys)
- **Test account:** `six.django@gmail.com` (password provided by the user out-of-band)

## Stack

Next.js 16 (App Router, Turbopack) · TypeScript · Tailwind v4 · Supabase (Auth +
Postgres/RLS) · `@openai/agents` SDK · Vitest · **pnpm** (pinned in package.json).
Icons: **lucide-react** (monoline; never use ASCII/emoji glyphs as icons). UI follows
the Nothing design system (see the `nothing-design` skill): monochrome, Space
Grotesk + Space Mono + Doto, single red accent `#d71921`, no shadows/blur.

## Commands

```bash
pnpm dev          # localhost:3000
pnpm test         # vitest (pure-logic units)
pnpm build        # production build
npx vercel --prod --yes   # deploy (already linked + GitHub-connected)
```

Secrets live in `.env.local` (gitignored). `psql` is NOT installed — apply DB
migrations with a throwaway Node script using `pg` over `POSTGRES_URL_NON_POOLING`:
strip the `?...` query string and pass `ssl: { rejectUnauthorized: false }`.

## LLM provider — Alibaba DashScope (OpenAI-compatible gateway)

Configured via env: `OPENAI_BASE_URL=https://coding.dashscope.aliyuncs.com/v1`,
`OPENAI_MODEL=qwen3.6-plus`. Non-obvious requirements (all handled in
`lib/agent/runtime.ts` + the prompts):

- SDK default model names are OpenAI's → **`OPENAI_MODEL` must be set** for gateways.
- When `OPENAI_BASE_URL` is set, call `setOpenAIAPI("chat_completions")` (no Responses API).
- `setTracingDisabled(true)` — the SDK otherwise phones home to OpenAI and hangs.
- The gateway only supports `response_format: json_object` (NOT json_schema), and
  **requires the word "json" in the prompt** plus the exact output shape spelled out.
- `lib/agent/chat.ts` calls chat completions directly (simpler than the Agents SDK).

## Architecture / key files

- `lib/srs/` — SM-2 scheduler (`sm2.ts`) + `mastery.ts` (scaffold level). Pure, tested.
- `lib/agent/` — `runtime.ts` (SDK config), `normalize.ts` (messy text → sectioned JSON),
  `analyze.ts` (per-section summary/keyPoints/difficulty/**optimized** rewrite, with a
  selectable style; `mergeEnrichments` is pure + tested), `write.ts` (writing review),
  `chat.ts` (section coach), `schema.ts` (all zod schemas),
  `addSection.ts` (produces one enriched section from raw text via normalize+analyze;
  `generateSection`; `collapseToOneSection` is pure + tested).
- `lib/store/` — `types.ts` (`Store` interface), `supabase.ts` (live impl, snake↔camel
  mapping boundary), `memory.ts` (retained for reference), `chat.ts` (chat persistence).
- `lib/sections.ts` — `insertSectionIntoPlan` (atomic insert + reindex helper). Pure, tested.
- `lib/ratelimit.ts` (per-user, api_usage table) · `lib/allowlist.ts` (LLM email gate)
  · `lib/tts.ts` (browser TTS helpers) · `lib/supabase/` (browser/server/proxy clients).
- `app/api/*` — Node-runtime route handlers. `proxy.ts` (root) gates unauthenticated
  users to `/login` and refreshes the Supabase session.
- `components/` — `SectionBoard` (sections + sticky progress + floating nav),
  `PracticeSession`, `SpeakableMarkdown` + `TtsProvider` (double-click a paragraph to
  hear it; controls in an animated floating panel), `SectionChat`, `SectionAdd` (paste
  raw text → preview → insert new section at a chosen position), `Notify` (global
  inline error toasts), `nothing/` primitives.

## Critical gotchas (learned the hard way)

- **Next.js 16:** route `params`/`searchParams` are Promises (`await` them); `cookies()`
  is async; middleware file is **`proxy.ts`** exporting `proxy` (not `middleware.ts`).
  `<html suppressHydrationWarning>` is required (no-flash theme script sets `data-theme`).
- **Login needs HTTPS / a secure context.** Supabase auth uses Web Crypto, which browsers
  disable on non-`localhost` HTTP origins (e.g. `http://<LAN-IP>:3000`) → sign-in throws
  before any request. Test on `localhost` or the HTTPS deployment. The login page detects
  `!window.isSecureContext` and shows a banner instead of failing silently.
- **Post-login uses `window.location.assign("/")`**, not `router.push` — a client RSC nav
  raced the just-set auth cookie on Vercel edge and bounced back to `/login`.
- **Login inputs are uncontrolled (refs)** so password-manager autofill is always read.
- **`analyze`/`write` never let the model alter the user's original text** — the model
  returns only the added fields, merged by index (`mergeEnrichments`).
- **TTS:** speak immediately on the user gesture (don't wait for `voiceschanged` — iOS
  often never fires it). iOS silent switch mutes it (platform limit). Markdown must stay
  rendered — play whole paragraphs on double-click, never per-sentence buttons.
- Optimized/“better” text is markdown → render via `react-markdown` (`Markdown.tsx`).

## Security model

- **Signups are local-only.** `/api/signup` admin-creates a confirmed user via the service
  role but 403s when `process.env.VERCEL` is set; the login "Sign up" button is hidden on
  deployments (`NEXT_PUBLIC_VERCEL_ENV`). (Supabase's own public-signup toggle is still on —
  to fully close the direct anon-key path, disable it in the Supabase dashboard.)
- **LLM allowlist:** `LLM_ALLOWED_EMAILS` (comma-separated). LLM routes 403 for any user not
  listed — a stranger who registers still can't spend the quota. Blank = allow all (dev).
- **Per-user rate limit** on normalize/analyze/write-review (20/10min) and chat (60/10min)
  → 429. All LLM routes require auth; Supabase RLS is owner-only on every table.

## Deploy to Vercel

The project is already linked (`.vercel/project.json` → `sixdjangos-projects/recite`)
and GitHub-connected, so **pushing to `main` auto-deploys**. Manual deploy:
`npx vercel --prod --yes`. Stable alias: `recite-nine.vercel.app`.

First-time / re-setup steps (CLI is logged in as `sixdjango`):

1. `npx vercel link --yes` — links/creates the project.
2. Set env vars for production (repeat per var; values from `.env.local`):
   `printf '%s' "$VALUE" | npx vercel env add <NAME> production`
   Required: `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`, `LLM_ALLOWED_EMAILS`,
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
   (`NEXT_PUBLIC_VERCEL_ENV` is auto-exposed by Vercel — used to hide signup in prod.)
3. `npx vercel --prod --yes`.
4. **Disable Deployment Protection** — new projects 401 every request behind "Vercel
   Authentication". Turn it off so the app is public:
   ```bash
   TOKEN=$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.env.HOME+'/Library/Application Support/com.vercel.cli/auth.json','utf8')).token)")
   # projectId/teamId are in .vercel/project.json (projectId / orgId)
   curl -s -X PATCH "https://api.vercel.com/v9/projects/<projectId>?teamId=<orgId>" \
     -H "Authorization: Bearer $TOKEN" -H "content-type: application/json" \
     -d '{"ssoProtection":null}'
   ```
   (Or Project Settings → Deployment Protection → disable in the dashboard.)
5. Apply any new SQL migrations to Supabase (see DB migrations below).

Build is pnpm + Next 16, no env needed at build time (pages are dynamic; the only
client-prerendered page, `/login`, creates the Supabase client lazily in handlers).

## Environment variables

`OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`, `LLM_ALLOWED_EMAILS`,
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`POSTGRES_URL_NON_POOLING` (local migrations only). See `.env.example`.

## DB migrations (`supabase/migrations/`, apply in order)

`0001_init` (tables + RLS) · `0002_v2_sections` (summary/key_points/mastery_level) ·
`0003_optimized` · `0004_chat` (chat_messages) · `0005_rate_limit` (api_usage) ·
`0006_add_section` (insert_section_at function: atomic insert + reindex).
New `create policy` statements need `drop policy if exists` first (idempotency).

## Testing

Pure logic is extracted and unit-tested (Vitest): SM-2, mastery level, cloze, parsing,
all zod schemas, `mergeEnrichments`, TTS sentence-splitting, the allowlist. LLM-dependent
code is verified manually with a throwaway `tsx` smoke script against DashScope. Keep new
pure logic testable (extract it from route handlers / components).
