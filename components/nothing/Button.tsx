import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "outline" | "ghost";

const base =
  "inline-flex items-center justify-center font-mono uppercase tracking-[0.08em] text-[12px] " +
  "px-5 py-3 rounded-[4px] disabled:opacity-40 disabled:cursor-not-allowed select-none";

const variants: Record<Variant, string> = {
  // The red accent moment — one per screen. Active / commit actions.
  primary: "bg-accent text-white hover:opacity-90",
  // Default control: hairline border, brightens on hover.
  outline:
    "border border-border-strong text-primary hover:border-primary",
  // Lowest weight: text only.
  ghost: "text-secondary hover:text-primary",
};

export function Button({
  variant = "outline",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props} />
  );
}
