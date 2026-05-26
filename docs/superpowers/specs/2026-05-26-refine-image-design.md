# Refine with image upload — design

**Date:** 2026-05-26
**Status:** approved (brainstorming) → ready for implementation plan

## Goal

Let the user attach an image when refining a section's optimized text, so the LLM can
use it as visual reference (a slide, diagram, photo of notes) while applying the
instruction. The image is sent inline with the existing refine request and is not stored.

## Feasibility (verified)

A throwaway smoke script confirmed the existing model + gateway accept image input:
`qwen3.6-plus` via `https://coding.dashscope.aliyuncs.com/v1`, using the OpenAI-compatible
multimodal content format (`{ type: "image_url", image_url: { url: "data:image/png;base64,…" } }`),
correctly answered a vision question. **No new model, endpoint, or env var is needed.**

## Scope

In scope:
- Single image per refine, attached in the open refine input row.
- Image sent as a base64 data URL inline with `POST /api/refine`; used by the LLM as
  reference; never persisted.
- Instruction becomes optional when an image is attached (at least one of instruction /
  image is required).

Out of scope (YAGNI):
- No multiple images, no image storage (Supabase Storage / DB), no image history.
- No paste/drag-drop (file picker only) — can be added later.
- PUT (accept) is unchanged — it persists only the chosen optimized text; the image plays
  no part in persistence.

## UX

In `SectionRefine`, the open refine row gains an image button next to the instruction
input. Picking a file (png/jpeg/webp) shows a small thumbnail chip with the filename and a
remove (✕). `OPTIMIZE` is enabled when there is a non-empty instruction OR an attached
image. On accept/discard, the attached image is cleared along with the instruction.

```
[ how should I improve this? …          ] [🖼] [ ✦ OPTIMIZE ]
   ┌────────────┐
   │▣ slide.png ✕│   ← attached image (thumbnail + remove)
   └────────────┘
```

The draft / ACCEPT / REGENERATE / DISCARD flow is unchanged; REGENERATE re-sends the same
instruction AND the same image.

## Components / units

### 1. `lib/image.ts` (new) — pure validation
- `isImageDataUrl(s: string): boolean` — true iff `s` matches
  `^data:image/(png|jpe?g|webp);base64,` followed by non-empty base64.
- `MAX_IMAGE_DATA_URL_CHARS = 10_000_000` — exported cap (~7.5 MB decoded) used by the route.
- Pure → unit-tested.

### 2. `lib/agent/refine.ts` (changed)
- `buildRefinePrompt(title, currentOptimized, instruction, hasImage = false): string`
  - When `instruction` is non-empty: include the existing "Apply this instruction: …" line.
  - When `instruction` is empty AND `hasImage`: replace it with a line instructing the model
    to improve the section using the attached image as reference.
  - When `hasImage`: add a rule line noting an image is attached as visual reference — use it
    to inform the rewrite, but still preserve meaning and invent no unrelated facts.
  - Text-only, non-empty-instruction output is unchanged from today.
- `refineOptimized(title, currentOptimized, instruction, imageDataUrl?: string): Promise<string>`
  - No image → unchanged: single system message = `buildRefinePrompt(..., false)`.
  - With image → messages = `[{ role: "system", content: buildRefinePrompt(..., true) },
    { role: "user", content: [ { type: "text", text: instruction.trim() || "Use the attached
    image as reference." }, { type: "image_url", image_url: { url: imageDataUrl } } ] }]`
    (the text part is always non-empty so gateways that require it are satisfied).
  - Same `chat.completions.create`, same model fallback, same `.trim()` extraction.

### 3. `app/api/refine/route.ts` (changed — POST only)
- `GenBody` becomes:
  ```ts
  z.object({
    presentationId: z.string().min(1),
    sectionIndex: z.number().int().nonnegative(),
    instruction: z.string().max(500).optional(),
    image: z.string().optional(),
  }).refine((d) => (d.instruction?.trim() || d.image), {
    message: "instruction or image required",
  })
  ```
- If `image` is present, validate with `isImageDataUrl(image)` and
  `image.length <= MAX_IMAGE_DATA_URL_CHARS`; otherwise 400.
- Call `refineOptimized(section.title, section.optimized, instruction ?? "", image)`.
- Auth + allowlist + `rateLimit(user.id, "refine", 30, 600)` + ownership `get` — unchanged.
- PUT handler unchanged.

### 4. `components/SectionRefine.tsx` (changed)
- New state: `image: string | null` (downscaled data URL), `imageName: string | null`.
- Image button (lucide `ImagePlus`) + hidden `<input type="file" accept="image/png,image/jpeg,image/webp">`.
- On select: client-side downscale via a canvas helper (e.g. `fileToDataUrl(file, maxDim = 1280, quality = 0.85)`) → JPEG/webp data URL; set `image` + `imageName`. Browser-only; manually verified.
- Thumbnail chip (small `<img>` + filename + ✕ to clear).
- `canSubmit = !!instruction.trim() || !!image`; `OPTIMIZE`/Enter disabled otherwise.
- `generate()` body includes `image: image ?? undefined`; REGENERATE reuses `lastInstruction` + the still-attached `image`.
- `accept()` and DISCARD clear `image`/`imageName` along with the instruction.

## Data flow

```
[attach image] → client downscale → data URL (state)
[OPTIMIZE] → POST /api/refine { presentationId, sectionIndex, instruction?, image? }
   → validate (isImageDataUrl + size cap; instruction-or-image) + ownership get
   → refineOptimized(title, optimized, instruction, image)
       image ? multimodal [system + user(text+image_url)] : system-only (unchanged)
   → { optimized: draft }   (no persistence; image discarded after the call)
[ACCEPT] → PUT /api/refine { … optimized } (unchanged; no image)
```

## Error handling

- Missing both instruction and image, bad image data URL, or oversized image → 400.
- 401 / 403 / 429 / 502 unchanged; client surfaces all via the global `Notify` toast.
- Client downscale failure (unreadable file) → notify and leave no image attached.

## Testing

- **Vitest (pure):** `isImageDataUrl` (accepts png/jpeg/webp data URLs, rejects non-image /
  non-data-URL / empty); `buildRefinePrompt` empty-instruction-with-image branch (produces
  image-reference wording and still forbids inventing facts) and the unchanged text-only branch.
- **Manual:** the multimodal `refineOptimized` call + the upload UI verified live (gateway
  image acceptance already confirmed by the smoke test).

## Decisions / defaults

- **Ephemeral image:** sent inline as base64, never stored.
- **Instruction optional when image present;** at least one required.
- **Single image; file picker only** (no paste/drag-drop yet).
- **Client downscale** to max edge ~1280px, quality ~0.85, to keep the payload small;
  server cap `MAX_IMAGE_DATA_URL_CHARS = 10_000_000` as a backstop.
- **Accepted types:** png, jpeg, webp.

## Affected files

- New: `lib/image.ts`, `tests/image.test.ts`.
- Changed: `lib/agent/refine.ts` (+ `tests/refine-prompt.test.ts` for the new branch),
  `app/api/refine/route.ts`, `components/SectionRefine.tsx`.
- No DB migration, no new env var, no new route.
