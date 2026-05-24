-- v2.1: store an AI-optimized, presentation-ready rewrite alongside the original.
alter table segments add column if not exists optimized text not null default '';
