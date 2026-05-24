import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { Button, Card, Label } from "@/components/nothing";
import { DeckCard } from "@/components/DeckCard";
import { supabaseStore } from "@/lib/store/supabase";
import { createClient } from "@/lib/supabase/server";

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const records = user ? await supabaseStore.listByUser(user.id) : [];
  const now = Date.now();

  const decks = records.map((r) => ({
    id: r.id,
    title: r.title,
    total: r.plan.sections.length,
    due: r.practice.filter((p) => new Date(p.dueAt).getTime() <= now).length,
  }));

  const totalDue = decks.reduce((sum, d) => sum + d.due, 0);
  const focusTarget = [...decks].sort((a, b) => b.due - a.due)[0];
  const focusHref =
    focusTarget && focusTarget.due > 0
      ? `/practice/${focusTarget.id}`
      : "/upload";

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl px-6 md:px-10 py-12 md:py-16 space-y-16">
        {/* Hero: enter focus */}
        <section className="space-y-8">
          <Label>Due now</Label>
          <div className="flex flex-wrap items-end justify-between gap-8">
            <span className="font-mono text-display text-[clamp(4rem,20vw,9rem)] leading-[0.85] tracking-[-0.04em]">
              {totalDue}
            </span>
            <Link href={focusHref}>
              <Button variant="primary" className="px-10 py-5 text-[13px]">
                {totalDue > 0 ? "Enter focus →" : "Start a deck →"}
              </Button>
            </Link>
          </div>
          <p className="text-secondary text-[15px] max-w-md">
            {totalDue > 0
              ? "Cards waiting across all decks. One session clears the queue."
              : "No reviews queued. Upload a presentation to begin."}
          </p>
        </section>

        {/* Decks */}
        <section className="space-y-5">
          <div className="flex items-center justify-between">
            <Label>Decks — {decks.length}</Label>
            <Link href="/upload" className="label hover:text-primary">
              + NEW
            </Link>
          </div>

          {decks.length === 0 ? (
            <Card className="dot-grid py-12 text-center">
              <Label className="!text-primary">[ NO DECKS YET ]</Label>
            </Card>
          ) : (
            <div className="space-y-2">
              {decks.map((d) => (
                <DeckCard
                  key={d.id}
                  id={d.id}
                  title={d.title}
                  total={d.total}
                  due={d.due}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
