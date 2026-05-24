import type { HTMLAttributes } from "react";

/** Surface card: subtle elevation via background + hairline border, no shadows. */
export function Card({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`bg-surface border border-border rounded-[8px] p-5 ${className}`}
      {...props}
    />
  );
}
