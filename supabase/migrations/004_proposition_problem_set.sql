-- 신규 명제 단원: 문제 메타데이터, 텍스트 답안 비교, 비공개 채점 응답.
-- 정답은 이 파일에 넣지 않습니다. 비공개 SQL을 별도로 실행하세요.
begin;

insert into public.problem_sets(id, title, problem_count)
values ('propositions-v1', '명제와 증명 · 교과서 활동', 14)
on conflict (id) do update set title = excluded.title, problem_count = excluded.problem_count;

create or replace function private.normalize_proposition_answer(p_value text) returns text
language sql immutable set search_path = '' as $$
  select regexp_replace(
    regexp_replace(
      translate(lower(replace(coalesce(p_value, ''), '−', '-')), '①②③④⑤⑥⑦⑧⑨⑩', '1234567890'),
      '[ab][[:space:]]*=', '', 'g'
    ),
    '[[:space:],，;；/·、(){}=]|개', '', 'g'
  );
$$;

-- 이전에 제출한 학생이 수업 중 새로고침해도 정답표를 받을 수 없게 합니다.
create or replace function public.classroom_context(p_session_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_session public.class_sessions; v_participant public.participants; v_answers jsonb; v_grade jsonb;
begin
  if auth.uid() is null then return null; end if;
  if private.is_teacher() then
    select * into v_session from public.class_sessions where teacher_id = auth.uid() and status = 'ACTIVE' order by created_at desc limit 1;
    return jsonb_build_object('role','teacher','sessionId',v_session.id);
  end if;
  select * into v_session from public.class_sessions where id = p_session_id and status = 'ACTIVE';
  if not found then return null; end if;
  select * into v_participant from public.participants where session_id = v_session.id and user_id = auth.uid();
  if not found then return null; end if;
  select coalesce(jsonb_object_agg(problem_id::text,payload),'{}') into v_answers from public.student_answers where participant_id = v_participant.id;
  select jsonb_build_object('results',s.results,'correctCount',s.correct_count,'answers',s.answers)
    into v_grade from public.submissions s where participant_id = v_participant.id;
  return jsonb_build_object('role','student','sessionId',v_session.id,
    'participant',jsonb_build_object('name',v_participant.display_name,'code',v_session.code),
    'answers',v_answers,'submission',v_grade);
end;
$$;

create or replace function public.submit_student_answers(p_session_id uuid, p_answers jsonb, p_reason text default '') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_session public.class_sessions; v_participant public.participants; v_results jsonb; v_score integer; v_total integer;
begin
  select * into v_session from public.class_sessions where id = p_session_id for share;
  if not found or v_session.status <> 'ACTIVE' then raise exception '수업이 종료되었습니다.'; end if;
  if v_session.submission_closed then raise exception '교사가 최종 제출을 마감했습니다.'; end if;
  perform public.save_student_draft(p_session_id,p_answers);
  select * into v_participant from public.participants where session_id = p_session_id and user_id = auth.uid() for update;
  if length(coalesce(p_reason,'')) > 2000 then raise exception '수정 이유는 2000자 이내로 입력해주세요.'; end if;
  if exists(select 1 from public.submissions where participant_id = v_participant.id) and length(trim(coalesce(p_reason,''))) = 0 then raise exception '재제출 이유를 입력해주세요.'; end if;

  select jsonb_object_agg(k.problem_id::text,case when matched.is_correct then 'O' else 'X' end),
    count(*) filter(where matched.is_correct),count(*)
  into v_results,v_score,v_total
  from private.answer_keys k
  cross join lateral (
    select case when v_session.problem_set_id = 'propositions-v1'
      then length(trim(coalesce(p_answers->k.problem_id::text->>'answer',''))) > 0
        and private.normalize_proposition_answer(p_answers->k.problem_id::text->>'answer') = private.normalize_proposition_answer(k.correct_answer)
      else trim(coalesce(p_answers->k.problem_id::text->>'answer','')) = k.correct_answer
    end as is_correct
  ) matched
  where k.problem_set_id = v_session.problem_set_id;
  if v_total = 0 then raise exception '정답 데이터가 없습니다.'; end if;

  insert into public.submissions(session_id,participant_id,answers,results,correct_count,problem_count,edit_reason)
    values(p_session_id,v_participant.id,p_answers,v_results,v_score,v_total,coalesce(p_reason,''))
  on conflict(participant_id) do update set answers = excluded.answers,results = excluded.results,
    correct_count = excluded.correct_count,problem_count = excluded.problem_count,
    edit_reason = excluded.edit_reason,submitted_at = now();
  update public.participants set submitted = true,last_activity_at = now() where id = v_participant.id;
  return jsonb_build_object('results',v_results,'correctCount',v_score,'answers',p_answers);
end;
$$;

revoke all on function private.normalize_proposition_answer(text) from public, anon, authenticated;
revoke all on function public.classroom_context(uuid), public.submit_student_answers(uuid,jsonb,text) from public, anon, authenticated;
grant execute on function public.classroom_context(uuid), public.submit_student_answers(uuid,jsonb,text) to authenticated;
commit;
