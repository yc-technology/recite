import Link from "next/link";

type Crumb = { label: string; href?: string };

/** Nothing-style breadcrumb: monospace caps, last item is the current page. */
export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav className="flex items-center gap-2 flex-wrap mb-8">
      {items.map((it, i) => {
        const last = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-2 min-w-0">
            {it.href && !last ? (
              <Link href={it.href} className="label hover:text-primary">
                {it.label}
              </Link>
            ) : (
              <span className={`label ${last ? "!text-primary truncate max-w-[50vw]" : ""}`}>
                {it.label}
              </span>
            )}
            {!last && <span className="label !text-disabled">/</span>}
          </span>
        );
      })}
    </nav>
  );
}
