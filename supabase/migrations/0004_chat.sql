-- Persist the per-section AI coach conversation.
create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  presentation_id uuid not null references presentations(id) on delete cascade,
  segment_index int not null,
  role text not null,
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_lookup
  on chat_messages (presentation_id, segment_index, created_at);

alter table chat_messages enable row level security;
drop policy if exists own_chat on chat_messages;
create policy own_chat on chat_messages for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
