"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Label } from "@/components/nothing";

export function PresentationActions({
  id,
  title,
}: {
  id: string;
  title: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!value.trim()) return;
    setBusy(true);
    try {
      await fetch(`/api/presentation/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: value.trim() }),
      });
      setEditing(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function del() {
    setBusy(true);
    try {
      await fetch(`/api/presentation/${id}`, { method: "DELETE" });
      router.push("/");
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          className="flex-1 bg-surface border border-border rounded-[4px] px-3 py-2 text-primary font-grotesk focus:border-primary outline-none"
        />
        <Button variant="primary" onClick={save} disabled={busy}>
          {busy ? "…" : "Save"}
        </Button>
        <button
          onClick={() => {
            setValue(title);
            setEditing(false);
          }}
          className="label hover:text-primary"
        >
          CANCEL
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-5">
      <button
        onClick={() => setEditing(true)}
        className="label hover:text-primary"
      >
        RENAME
      </button>
      {confirming ? (
        <div className="flex gap-3">
          <button
            onClick={del}
            disabled={busy}
            className="label !text-accent hover:opacity-80"
          >
            {busy ? "…" : "CONFIRM DELETE"}
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
          className="label hover:text-accent"
        >
          DELETE
        </button>
      )}
    </div>
  );
}
