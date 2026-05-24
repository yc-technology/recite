// LLM access allowlist. Set LLM_ALLOWED_EMAILS to a comma-separated list of
// emails permitted to call the (costly) LLM routes. When unset, everyone is
// allowed (convenient for local dev). When set, only listed emails pass — so a
// stranger who registers still cannot spend your LLM quota.
export function isLlmAllowed(email?: string | null): boolean {
  const raw = process.env.LLM_ALLOWED_EMAILS;
  if (!raw) return true;
  const allowed = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return !!email && allowed.includes(email.toLowerCase());
}
