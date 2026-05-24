create table presentations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  raw_text text not null,
  source_type text not null,
  created_at timestamptz not null default now()
);
create table segments (
  id uuid primary key default gen_random_uuid(),
  presentation_id uuid not null references presentations(id) on delete cascade,
  order_index int not null,
  title text not null,
  content text not null,
  difficulty text not null,
  hints jsonb not null default '[]'
);
create table study_plans (
  id uuid primary key default gen_random_uuid(),
  presentation_id uuid not null references presentations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  generated_at timestamptz not null default now(),
  meta jsonb not null default '{}'
);
create table daily_tasks (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references study_plans(id) on delete cascade,
  day_index int not null,
  segment_indexes jsonb not null,
  task_type text not null,
  done boolean not null default false
);
create table practice_records (
  id uuid primary key default gen_random_uuid(),
  presentation_id uuid not null references presentations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  segment_index int not null,
  ease double precision not null default 2.5,
  interval_days int not null default 0,
  repetitions int not null default 0,
  due_at timestamptz not null default now(),
  last_reviewed_at timestamptz
);
-- RLS: owner-only on every table
alter table presentations enable row level security;
alter table segments enable row level security;
alter table study_plans enable row level security;
alter table daily_tasks enable row level security;
alter table practice_records enable row level security;
create policy own_pres on presentations for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_plan on study_plans for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_practice on practice_records for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_seg on segments for all using (
  exists (select 1 from presentations p where p.id = presentation_id and p.user_id = auth.uid()));
create policy own_task on daily_tasks for all using (
  exists (select 1 from study_plans s where s.id = plan_id and s.user_id = auth.uid()));
