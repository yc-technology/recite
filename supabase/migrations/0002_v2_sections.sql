-- v2: comprehension-oriented sections + scaffold level.
-- segments now carry a summary and key points; content holds the cleaned text.
alter table segments add column if not exists summary text not null default '';
alter table segments add column if not exists key_points jsonb not null default '[]';

-- practice tracks a scaffold/mastery level (1..3) independent of the SM-2 interval.
alter table practice_records
  add column if not exists mastery_level int not null default 1;
