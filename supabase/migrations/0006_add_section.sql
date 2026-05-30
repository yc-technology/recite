-- 0006_add_section: atomically insert a section at a position, shifting the
-- trailing segments + practice cards + chat messages. SECURITY INVOKER (default) → RLS applies.
create or replace function insert_section_at(
  p_presentation_id uuid,
  p_position int,
  p_title text,
  p_content text,
  p_optimized text,
  p_summary text,
  p_key_points jsonb,
  p_difficulty text,
  p_user_id uuid
) returns void
language plpgsql
as $$
begin
  update segments set order_index = order_index + 1
    where presentation_id = p_presentation_id and order_index >= p_position;
  update practice_records set segment_index = segment_index + 1
    where presentation_id = p_presentation_id and segment_index >= p_position;
  update chat_messages set segment_index = segment_index + 1
    where presentation_id = p_presentation_id and segment_index >= p_position;
  insert into segments(presentation_id, order_index, title, content, optimized,
                       summary, key_points, difficulty)
    values (p_presentation_id, p_position, p_title, p_content, p_optimized,
            p_summary, p_key_points, p_difficulty);
  -- SM-2 columns (ease, interval_days, repetitions, due_at, mastery_level) use
  -- their table defaults: 2.5 / 0 / 0 / now() / 1.
  insert into practice_records(presentation_id, user_id, segment_index)
    values (p_presentation_id, p_user_id, p_position);
end;
$$;
