# Refine Image Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a section refine attach one reference image, sent inline (base64) to the existing multimodal gateway, with the instruction becoming optional when an image is present.

**Architecture:** A pure `isImageDataUrl` validator gates the inline image. `refineOptimized` gains an optional image argument and builds a multimodal user message when present (text-only path unchanged). The `/api/refine` POST body accepts an optional `image` + optional `instruction` (at least one required). `SectionRefine` adds an attach button, client-side downscale, and a thumbnail chip. Image is never stored.

**Tech Stack:** Next.js 16 (Node runtime), TypeScript, OpenAI SDK against the DashScope gateway (vision verified), Tailwind v4, lucide-react, Vitest, pnpm.

> **Spec:** `docs/superpowers/specs/2026-05-26-refine-image-design.md`

---

## File Structure

- **Create** `lib/image.ts` — `isImageDataUrl` + `MAX_IMAGE_DATA_URL_CHARS`.
- **Create** `tests/image.test.ts` — unit tests for the validator.
- **Modify** `lib/agent/refine.ts` — `buildRefinePrompt(..., hasImage)` + `refineOptimized(..., imageDataUrl?)`.
- **Modify** `tests/refine-prompt.test.ts` — add the empty-instruction-with-image branch tests.
- **Modify** `app/api/refine/route.ts` — POST body: optional instruction + optional image, at-least-one, image validation.
- **Modify** `components/SectionRefine.tsx` — attach button, downscale, chip, image-or-instruction submit.

No DB migration, no new env, no new route.

---

## Task 1: `isImageDataUrl` validator

**Files:**
- Test: `tests/image.test.ts`
- Create: `lib/image.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/image.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isImageDataUrl, MAX_IMAGE_DATA_URL_CHARS } from "@/lib/image";

describe("isImageDataUrl", () => {
  it("accepts png/jpeg/jpg/webp base64 data URLs", () => {
    expect(isImageDataUrl("data:image/png;base64,iVBORw0KGgo=")).toBe(true);
    expect(isImageDataUrl("data:image/jpeg;base64,/9j/4AAQSkZJRg==")).toBe(true);
    expect(isImageDataUrl("data:image/jpg;base64,/9j/4AAQ")).toBe(true);
    expect(isImageDataUrl("data:image/webp;base64,UklGRhZ")).toBe(true);
  });

  it("rejects non-image, non-data-url, gif, empty-body, or empty input", () => {
    expect(isImageDataUrl("https://example.com/x.png")).toBe(false);
    expect(isImageDataUrl("data:text/plain;base64,aGk=")).toBe(false);
    expect(isImageDataUrl("data:image/gif;base64,R0lGOD")).toBe(false);
    expect(isImageDataUrl("data:image/png;base64,")).toBe(false);
    expect(isImageDataUrl("")).toBe(false);
  });

  it("exposes a positive char cap", () => {
    expect(MAX_IMAGE_DATA_URL_CHARS).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- image`
Expected: FAIL — cannot resolve `@/lib/image`.

- [ ] **Step 3: Write the implementation**

Create `lib/image.ts`:

```ts
// Helpers for the inline reference image shared by the refine route and client.

// A single-line base64 data URL for a PNG/JPEG/WebP image.
const IMAGE_DATA_URL = /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

export function isImageDataUrl(s: string): boolean {
  return IMAGE_DATA_URL.test(s);
}

// ~7.5 MB decoded — a backstop on the inline image payload sent to the model.
export const MAX_IMAGE_DATA_URL_CHARS = 10_000_000;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- image`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/image.ts tests/image.test.ts
git commit -m "feat: isImageDataUrl validator for refine image upload"
```

---

## Task 2: multimodal `refineOptimized`

**Files:**
- Modify: `lib/agent/refine.ts`
- Test: `tests/refine-prompt.test.ts`

- [ ] **Step 1: Add the failing tests**

In `tests/refine-prompt.test.ts`, add these two `it` blocks inside the existing `describe("buildRefinePrompt", () => { ... })` block:

```ts
  it("uses image-reference wording when instruction is empty and an image is attached", () => {
    const p = buildRefinePrompt("Market", "Our market is huge.", "", true);
    expect(p).toMatch(/using the attached image as reference/i);
    expect(p).toMatch(/image is attached as visual reference/i);
    expect(p).toMatch(/do not add new facts/i);
    expect(p).not.toContain("Apply this instruction");
  });

  it("keeps the instruction line and adds the image rule when both are present", () => {
    const p = buildRefinePrompt("Market", "Our market is huge.", "shorten it", true);
    expect(p).toContain("shorten it");
    expect(p).toMatch(/image is attached as visual reference/i);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- refine-prompt`
Expected: FAIL — `buildRefinePrompt` takes 3 args / the image wording isn't present.

- [ ] **Step 3: Update `buildRefinePrompt` and `refineOptimized`**

Replace the entire contents of `lib/agent/refine.ts` with:

```ts
import OpenAI from "openai";
import { openaiClient } from "./client";

// Pure prompt builder (unit-tested). Steers the model to rewrite ONE section's
// already-optimized markdown per the user's instruction and/or an attached
// reference image, without inventing facts or breaking markdown conventions.
export function buildRefinePrompt(
  title: string,
  currentOptimized: string,
  instruction: string,
  hasImage = false,
): string {
  const trimmed = instruction.trim();
  const directive = trimmed
    ? `Apply this instruction from the speaker to improve it: "${trimmed}"`
    : "Improve this section using the attached image as reference.";
  const imageRule = hasImage
    ? "\n- An image is attached as visual reference. Use it to inform the rewrite (align wording or incorporate relevant details it shows), but still preserve the speaker's meaning and invent no unrelated facts."
    : "";
  return `You are an English presentation coach. Below is the current presentation-ready version of ONE section of a talk, written in markdown.

Section title: ${title}
Current version:
${currentOptimized}

${directive}

Rules:
- Preserve the speaker's meaning and intent. Do NOT add new facts.
- Keep clean standard markdown: short paragraphs separated by blank lines, "- " bullet lists for enumerations, **bold** for only a few key terms. Do NOT use headings (#).${imageRule}
- Output ONLY the revised markdown for this section — no preamble, no explanation.`;
}

// Returns the revised markdown. Direct chat-completions call (works through the
// OpenAI-compatible gateway). When an image data URL is given, it is attached to
// a multimodal user message; otherwise the call is text-only (unchanged).
export async function refineOptimized(
  title: string,
  currentOptimized: string,
  instruction: string,
  imageDataUrl?: string,
): Promise<string> {
  const client = openaiClient();
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: buildRefinePrompt(title, currentOptimized, instruction, !!imageDataUrl) },
  ];
  if (imageDataUrl) {
    messages.push({
      role: "user",
      content: [
        { type: "text", text: instruction.trim() || "Use the attached image as reference." },
        { type: "image_url", image_url: { url: imageDataUrl } },
      ],
    });
  }
  const resp = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages,
  });
  return resp.choices[0]?.message?.content?.trim() ?? "";
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- refine-prompt`
Expected: PASS — the original test plus the 2 new ones.

- [ ] **Step 5: Typecheck via build**

Run: `pnpm build`
Expected: build succeeds (confirms the OpenAI multimodal message types compile).

- [ ] **Step 6: Commit**

```bash
git add lib/agent/refine.ts tests/refine-prompt.test.ts
git commit -m "feat: refineOptimized accepts an optional reference image (multimodal)"
```

---

## Task 3: `/api/refine` POST accepts an image

**Files:**
- Modify: `app/api/refine/route.ts`

- [ ] **Step 1: Add the image import**

In `app/api/refine/route.ts`, after the existing `import { createClient } from "@/lib/supabase/server";` line, add:

```ts
import { isImageDataUrl, MAX_IMAGE_DATA_URL_CHARS } from "@/lib/image";
```

- [ ] **Step 2: Replace the `GenBody` schema**

Replace:

```ts
const GenBody = z.object({
  presentationId: z.string().min(1),
  sectionIndex: z.number().int().nonnegative(),
  instruction: z.string().min(1).max(500),
});
```

with:

```ts
const GenBody = z
  .object({
    presentationId: z.string().min(1),
    sectionIndex: z.number().int().nonnegative(),
    instruction: z.string().max(500).optional(),
    image: z.string().optional(),
  })
  .refine((d) => Boolean(d.instruction?.trim()) || Boolean(d.image), {
    message: "instruction or image required",
  });
```

- [ ] **Step 3: Use the image in POST**

In the POST handler, replace:

```ts
  const { presentationId, sectionIndex, instruction } = parsed.data;

  const rec = await supabaseStore.get(presentationId, user.id);
  const section = rec?.plan.sections[sectionIndex];
  if (!rec || !section) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  try {
    const optimized = await refineOptimized(section.title, section.optimized, instruction);
```

with:

```ts
  const { presentationId, sectionIndex, instruction, image } = parsed.data;
  if (image && (!isImageDataUrl(image) || image.length > MAX_IMAGE_DATA_URL_CHARS)) {
    return NextResponse.json({ error: "invalid image" }, { status: 400 });
  }

  const rec = await supabaseStore.get(presentationId, user.id);
  const section = rec?.plan.sections[sectionIndex];
  if (!rec || !section) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  try {
    const optimized = await refineOptimized(section.title, section.optimized, instruction ?? "", image);
```

(Leave the rest of POST and the entire PUT handler unchanged.)

- [ ] **Step 4: Typecheck via build**

Run: `pnpm build`
Expected: build succeeds; route list still shows `ƒ /api/refine`.

- [ ] **Step 5: Commit**

```bash
git add app/api/refine/route.ts
git commit -m "feat: /api/refine POST accepts an optional reference image"
```

## Context for Task 3
- `isImageDataUrl` + `MAX_IMAGE_DATA_URL_CHARS` come from Task 1 (`lib/image.ts`).
- `refineOptimized`'s 4th arg (`imageDataUrl?`) comes from Task 2.
- Instruction is now optional; pass `instruction ?? ""` so the text-only signature still gets a string. The Zod `.refine` guarantees at least one of instruction/image is present.

---

## Task 4: `SectionRefine` image attach UI

**Files:**
- Modify: `components/SectionRefine.tsx`

- [ ] **Step 1: Replace the whole component file**

Replace the entire contents of `components/SectionRefine.tsx` with:

```tsx
"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { Sparkles, Check, RotateCcw, X, ImagePlus } from "lucide-react";
import { Button, Label } from "@/components/nothing";
import { SpeakableMarkdown } from "@/components/SpeakableMarkdown";
import { useNotify } from "@/components/Notify";

// Read a File into a downscaled JPEG data URL (max edge `maxDim`) to keep the
// inline payload small. Browser-only (canvas).
function fileToDataUrl(file: File, maxDim = 1280, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("decode failed"));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("no canvas context"));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// Self-contained per-section refine UI: renders the current optimized text and,
// on demand, an LLM-generated draft the user can accept / regenerate / discard.
// An optional reference image can be attached and sent with the instruction.
export function SectionRefine({
  presentationId,
  sectionIndex,
  optimized: initialOptimized,
}: {
  presentationId: string;
  sectionIndex: number;
  optimized: string;
}) {
  const notify = useNotify();
  const fileRef = useRef<HTMLInputElement>(null);
  const [optimized, setOptimized] = useState(initialOptimized);
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [lastInstruction, setLastInstruction] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [candidate, setCandidate] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [accepting, setAccepting] = useState(false);

  const canSubmit = Boolean(instruction.trim()) || Boolean(image);

  async function generate(text: string) {
    const q = text.trim();
    if ((!q && !image) || generating) return;
    setGenerating(true);
    setLastInstruction(q);
    try {
      const res = await fetch("/api/refine", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          presentationId,
          sectionIndex,
          instruction: q,
          image: image ?? undefined,
        }),
      });
      if (!res.ok) throw new Error(`refine failed (${res.status})`);
      const { optimized: draft } = await res.json();
      if (!draft) throw new Error("empty draft");
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
      setImage(null);
      setImageName(null);
      setOpen(false);
    } catch (e) {
      notify(`[ERROR: ${e instanceof Error ? e.message : "save failed"}]`);
    } finally {
      setAccepting(false);
    }
  }

  async function pickImage(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      setImage(await fileToDataUrl(f));
      setImageName(f.name);
    } catch {
      notify("[ERROR: could not read image]");
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
            {generating
              ? "Draft · generating…"
              : lastInstruction
                ? `Draft · "${lastInstruction}"`
                : "Draft · image"}
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
                  <Button variant="ghost" onClick={() => generate(lastInstruction)} disabled={accepting} className="!px-4 !py-2 gap-1.5">
                    <RotateCcw size={13} />
                    REGENERATE
                  </Button>
                  <Button variant="ghost" onClick={() => setCandidate(null)} disabled={accepting} className="!px-4 !py-2 gap-1.5">
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
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              autoFocus
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && canSubmit && generate(instruction)}
              placeholder="how should I improve this? e.g. make it more conversational"
              className="flex-1 bg-surface border border-border rounded-[4px] px-3 py-2 text-primary text-body focus:border-primary outline-none"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              aria-label="Attach reference image"
              className="label hover:text-primary border border-border-strong rounded-[4px] px-3 flex items-center"
            >
              <ImagePlus size={16} />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={pickImage}
            />
            <Button
              variant="primary"
              onClick={() => generate(instruction)}
              disabled={generating || !canSubmit}
              className="gap-1.5"
            >
              <Sparkles size={13} />
              {generating ? "OPTIMIZING…" : "OPTIMIZE"}
            </Button>
          </div>
          {image && (
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image} alt="" className="w-10 h-10 object-cover rounded-[4px] border border-border" />
              <span className="label truncate flex-1">{imageName}</span>
              <button
                type="button"
                onClick={() => {
                  setImage(null);
                  setImageName(null);
                }}
                aria-label="Remove image"
                className="label hover:text-accent flex items-center"
              >
                <X size={13} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck via build**

Run: `pnpm build`
Expected: build succeeds; no type or blocking-lint errors.

- [ ] **Step 3: Run the full unit suite**

Run: `pnpm test`
Expected: all tests pass (includes Task 1 `image` + Task 2 `refine-prompt` additions).

- [ ] **Step 4: Manual verification (dev server)**

Run: `pnpm dev`, open a presentation, click `REFINE` on a section, then:
- Confirm an image button (🖼) sits between the instruction input and OPTIMIZE.
- With the input empty and no image, OPTIMIZE is disabled.
- Type an instruction → OPTIMIZE enables → works as before (text-only).
- Click 🖼, choose a png/jpeg/webp → a thumbnail + filename chip appears; OPTIMIZE enables even with an empty instruction.
- Click OPTIMIZE → a draft is generated using the image; ACCEPT persists it (reload to confirm).
- Remove the image via the chip ✕ → with an empty instruction, OPTIMIZE disables again.

- [ ] **Step 5: Commit**

```bash
git add components/SectionRefine.tsx
git commit -m "feat: attach a reference image when refining a section"
```

## Context for Task 4
- `DISCARD` intentionally clears only the candidate (keeps the instruction AND the image) so the user can tweak and retry; `ACCEPT` clears everything and closes. This refines the spec's "accept/discard clears the image" wording — keeping the image on discard is the retry-friendly behavior.
- `fileToDataUrl` downscales to a max edge of 1280px at JPEG quality 0.85 — well within the server's `MAX_IMAGE_DATA_URL_CHARS` backstop.
- The `{/* eslint-disable-next-line @next/next/no-img-element */}` keeps the data-URL thumbnail from tripping the Next image lint rule.

---

## Self-Review Notes

- **Spec coverage:** validator + cap (Task 1), multimodal call + empty-instruction wording (Task 2), POST body optional-instruction/optional-image/at-least-one/image-validation (Task 3), attach button + downscale + chip + image-or-instruction submit + ephemeral (Task 4). All covered. No persistence/migration/env (none added).
- **Type consistency:** `isImageDataUrl`/`MAX_IMAGE_DATA_URL_CHARS` defined in Task 1, imported in Task 3. `buildRefinePrompt(title, currentOptimized, instruction, hasImage?)` and `refineOptimized(title, currentOptimized, instruction, imageDataUrl?)` defined in Task 2, called in Task 3 (`instruction ?? ""`, `image`). Client POST body `{presentationId, sectionIndex, instruction, image?}` matches `GenBody`.
- **Deliberate spec refinement:** DISCARD keeps the image for retry (documented above) rather than clearing it.
- **Manual-only surfaces:** the multimodal LLM call (gateway image acceptance already smoke-verified) and the browser canvas downscale / upload UI are verified by build + the Task 4 manual checklist, per project convention.
```
