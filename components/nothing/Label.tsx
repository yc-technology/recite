import type { HTMLAttributes } from "react";

/** Instrument-panel label: Space Mono, ALL CAPS, wide tracking. Tertiary layer. */
export function Label({
  className = "",
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return <span className={`label ${className}`} {...props} />;
}
