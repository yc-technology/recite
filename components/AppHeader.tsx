import Link from "next/link";
import { Label, ThemeToggle } from "@/components/nothing";

/** Top bar: Doto wordmark (the one hero moment) + sparse nav + theme switch. */
export function AppHeader() {
  return (
    <header className="flex items-center justify-between px-6 md:px-10 py-5 border-b border-border">
      <Link
        href="/"
        className="font-doto text-display text-[22px] tracking-[-0.03em] leading-none"
      >
        RECITE
      </Link>
      <nav className="flex items-center gap-6">
        <Link href="/upload" className="label hover:text-primary">
          + NEW
        </Link>
        <ThemeToggle />
      </nav>
      <Label className="sr-only">English presentation trainer</Label>
    </header>
  );
}
