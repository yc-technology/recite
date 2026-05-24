-- Per-user rate limiting for the (costly) LLM endpoints.
create table if not exists api_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  route text not null,
  created_at timestamptz not null default now()
);
create index if not exists api_usage_lookup
  on api_usage (user_id, route, created_at);

alter table api_usage enable row level security;
drop policy if exists own_usage on api_usage;
create policy own_usage on api_usage for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
