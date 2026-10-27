-- 공개 설정: 새 문제 세트 등록 및 풀이 빈칸 완료 기준. 정답은 포함하지 않습니다.
-- 기존 001~004 적용 후 실행하세요. 이전 수업의 세트와 제출 기록은 유지합니다.
begin;

insert into public.problem_sets(id, title, problem_count)
values ('propositions-choice-v1', '명제와 증명 · 4지선다 문제은행', 14)
on conflict (id) do update set title = excluded.title, problem_count = excluded.problem_count;

create or replace function public.save_student_draft(p_session_id uuid, p_answers jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_session public.class_sessions;
  v_participant public.participants;
  v_key text;
  v_item jsonb;
  v_solved integer;
  v_count integer;
  v_complete boolean;
  v_blanks_complete boolean;
  v_required_blanks integer[] := array[8, 14, 5, 4, 9, 8, 7, 5, 10, 6, 6, 4, 4, 11];
begin
  select * into v_session from public.class_sessions where id = p_session_id for share;
  if not found or v_session.status <> 'ACTIVE' then raise exception '수업이 종료되었습니다.'; end if;
  select * into v_participant from public.participants where session_id = p_session_id and user_id = auth.uid() for update;
  if not found then raise exception '학생 입장이 필요합니다.'; end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' or length(p_answers::text) > 100000 then raise exception '답안 형식이 올바르지 않습니다.'; end if;
  select problem_count into v_count from public.problem_sets where id = v_session.problem_set_id;
  for v_key, v_item in select * from jsonb_each(p_answers) loop
    if v_key !~ '^[1-9][0-9]{0,2}$' or v_key::integer > v_count or jsonb_typeof(v_item) <> 'object' then raise exception '문항 번호 또는 답안 형식이 올바르지 않습니다.'; end if;
    if jsonb_typeof(coalesce(v_item->'answer','""'::jsonb)) <> 'string' or length(coalesce(v_item->>'answer','')) > 2000 then raise exception '답안은 2000자 이내 문자열이어야 합니다.'; end if;
  end loop;
  delete from public.student_answers where participant_id = v_participant.id and not (p_answers ? problem_id::text);
  for v_key, v_item in select * from jsonb_each(p_answers) loop
    v_complete := length(trim(coalesce(v_item->>'answer',''))) > 0;
    if v_session.problem_set_id = 'propositions-choice-v1' then
      select coalesce(bool_and(length(trim(coalesce(v_item->'blanks'->>('b' || required.n),''))) > 0), false)
      into v_blanks_complete
      from generate_series(1, v_required_blanks[v_key::integer]) as required(n);
      v_complete := v_complete and (v_item->>'answer') in ('1','2','3','4') and v_blanks_complete;
    end if;
    insert into public.student_answers(session_id,participant_id,problem_id,payload,is_complete)
      values(p_session_id,v_participant.id,v_key::integer,v_item,v_complete)
    on conflict (participant_id,problem_id) do update
      set payload = excluded.payload,is_complete = excluded.is_complete,updated_at = now();
  end loop;
  select count(*) filter(where is_complete) into v_solved from public.student_answers where participant_id = v_participant.id;
  update public.participants set solved = v_solved, progress = round(v_solved * 100.0 / v_count), last_activity_at = now() where id = v_participant.id;
  return jsonb_build_object('success',true);
end;
$$;

revoke all on function public.save_student_draft(uuid,jsonb) from public, anon, authenticated;
grant execute on function public.save_student_draft(uuid,jsonb) to authenticated;
commit;
