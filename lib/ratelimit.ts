import { createClient } from "@/lib/supabase/server";

// Per-user fixed-window limiter backed by the api_usage table (RLS scopes rows
// to the user). Returns true if allowed; records the call when allowed.
export async function rateLimit(
  userId: string,
  route: string,
  max: number,
  windowSec: number,
): Promise<boolean> {
  const supabase = await createClient();
  const since = new Date(Date.now() - windowSec * 1000).toISOString();

  const { count } = await supabase
    .from("api_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("route", route)
    .gte("created_at", since);

  if ((count ?? 0) >= max) return false;

  await supabase.from("api_usage").insert({ user_id: userId, route });
  return true;
}
