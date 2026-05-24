"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Card, Label } from "@/components/nothing";
import { useNotify } from "@/components/Notify";

export function DeckCard({
  id,
  title,
  total,
  due,
}: {
  id: string;
  title: string;
  total: number;
  due: number;
}) {
  const router = useRouter();
  const notify = useNotify();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function del() {
    setBusy(true);
    try {
      const res = await fetch(`/api/presentation/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`delete failed (${res.status})`);
      router.refresh();
    } catch (e) {
      notify(`[ERROR: ${e instanceof Error ? e.message : "delete failed"}]`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex items-center justify-between gap-4 hover:border-border-strong">
      <button
        onClick={() => router.push(`/presentation/${id}`)}
        className="text-left min-w-0 flex-1"
      >
        <h3 className="font-grotesk font-medium text-primary text-subtitle truncate">
          {title}
        </h3>
        <Label>{total} sections</Label>
      </button>

      <div className="flex items-center gap-5 shrink-0">
        <div className="flex items-baseline gap-2">
          <span
            className={`font-mono text-metric leading-none ${due > 0 ? "text-accent" : "text-disabled"}`}
          >
            {due}
          </span>
          <Label>due</Label>
        </div>
        {confirming ? (
          <div className="flex gap-3">
            <button
              onClick={del}
              disabled={busy}
              className="label !text-accent hover:opacity-80"
            >
              {busy ? "…" : "DELETE"}
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="label hover:text-primary"
            >
              CANCEL
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="text-disabled hover:text-accent"
            aria-label="Delete deck"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </Card>
  );
}
