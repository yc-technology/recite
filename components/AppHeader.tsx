import Link from "next/link";
import { Label } from "@/components/nothing";
import { AccountMenu } from "@/components/AccountMenu";

/** Top bar: Doto wordmark (the one hero moment) + account menu. The "+ NEW"
 *  nav lives inside AccountMenu so it only shows when signed in. */
export function AppHeader() {
  return (
    <header className="flex items-center justify-between px-6 md:px-10 py-5 border-b border-border">
      <Link
        href="/"
        className="font-doto text-display text-title tracking-[-0.03em] leading-none hover:opacity-80"
      >
        RECITE
      </Link>
      <nav className="flex items-center gap-6">
        <AccountMenu />
      </nav>
      <Label className="sr-only">English presentation trainer</Label>
    </header>
  );
}
