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
  const [lastImage, setLastImage] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [candidate, setCandidate] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [accepting, setAccepting] = useState(false);

  const canSubmit = Boolean(instruction.trim()) || Boolean(image);

  async function generate(text: string, img: string | null) {
    const q = text.trim();
    if ((!q && !img) || generating) return;
    setGenerating(true);
    setLastInstruction(q);
    setLastImage(img);
    try {
      const res = await fetch("/api/refine", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          presentationId,
          sectionIndex,
          instruction: q,
          image: img ?? undefined,
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
                  <Button variant="ghost" onClick={() => generate(lastInstruction, lastImage)} disabled={accepting} className="!px-4 !py-2 gap-1.5">
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
              onKeyDown={(e) => e.key === "Enter" && canSubmit && generate(instruction, image)}
              placeholder="how should I improve this? e.g. make it more conversational"
              className="flex-1 bg-surface border border-border rounded-[4px] px-3 py-2 text-primary text-body focus:border-primary outline-none"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={generating || accepting}
              aria-label="Attach reference image"
              className={`border border-border-strong rounded-[4px] px-3 flex items-center disabled:opacity-40 disabled:cursor-not-allowed ${image ? "text-accent" : "label hover:text-primary"}`}
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
              onClick={() => generate(instruction, image)}
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
