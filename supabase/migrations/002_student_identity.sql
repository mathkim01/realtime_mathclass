-- 기존 프로젝트에서 001_initial.sql을 다시 실행하지 말고 이 파일만 실행합니다.
-- 기존 학생 기록의 이름은 그대로 보존하며, 새 학생부터 학년·반·번호를 별도로 저장합니다.
begin;

alter table public.participants add column if not exists grade integer;
alter table public.participants add column if not exists class_number integer;
alter table public.participants add column if not exists student_number integer;

do $$ begin
  if not exists(select 1 from pg_constraint where conname = 'participants_identity_range' and conrelid = 'public.participants'::regclass) then
    alter table public.participants
      add constraint participants_identity_range check (
        (grade is null and class_number is null and student_number is null)
        or (grade between 1 and 12 and class_number between 1 and 99 and student_number between 1 and 99)
      );
  end if;
end $$;

create unique index if not exists participants_class_number_unique
  on public.participants(session_id, grade, class_number, student_number)
  where grade is not null;

create or replace function public.join_class_session(p_code text, p_grade integer, p_class_number integer, p_student_number integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_session public.class_sessions; v_participant public.participants; v_attempt private.join_attempts; v_label text;
begin
  if auth.uid() is null then raise exception '학생 인증이 필요합니다.'; end if;
  if private.is_teacher() then raise exception '교사 계정에서는 학생으로 입장할 수 없습니다.'; end if;
  if p_code is null or p_code !~ '^[0-9]{6}$'
    or p_grade is null or p_grade not between 1 and 12
    or p_class_number is null or p_class_number not between 1 and 99
    or p_student_number is null or p_student_number not between 1 and 99
  then raise exception '수업 코드와 학년·반·번호를 확인해주세요.'; end if;
  v_label := p_grade::text || '학년 ' || p_class_number::text || '반 ' || p_student_number::text || '번';

  insert into private.join_attempts(user_id, count) values(auth.uid(), 1)
  on conflict (user_id) do update set count = case when private.join_attempts.started_at < now() - interval '1 minute' then 1 else private.join_attempts.count + 1 end,
    started_at = case when private.join_attempts.started_at < now() - interval '1 minute' then now() else private.join_attempts.started_at end
  returning * into v_attempt;
  if v_attempt.count > 10 then return jsonb_build_object('error','입장 시도가 많습니다. 1분 후 다시 시도해주세요.'); end if;

  select * into v_session from public.class_sessions where code = p_code and status = 'ACTIVE' for share;
  if not found then return jsonb_build_object('error','유효하지 않거나 종료된 수업 코드입니다.'); end if;
  select * into v_participant from public.participants where session_id = v_session.id and user_id = auth.uid();
  if found then
    if v_participant.grade is distinct from p_grade or v_participant.class_number is distinct from p_class_number or v_participant.student_number is distinct from p_student_number
    then return jsonb_build_object('error','이 브라우저는 이미 다른 학생 번호로 입장했습니다. 기존 번호를 사용해주세요.'); end if;
  else
    begin
      insert into public.participants(session_id, user_id, display_name, grade, class_number, student_number)
      values(v_session.id, auth.uid(), v_label, p_grade, p_class_number, p_student_number)
      returning * into v_participant;
    exception when unique_violation then
      return jsonb_build_object('error','같은 학년·반·번호가 이미 사용 중입니다. 원래 기기에서 재접속하거나 선생님에게 문의해주세요.');
    end;
  end if;
  return jsonb_build_object('sessionId',v_session.id);
end;
$$;

revoke all on function public.join_class_session(text,integer,integer,integer) from public, anon, authenticated;
grant execute on function public.join_class_session(text,integer,integer,integer) to authenticated;
drop function if exists public.join_class_session(text,text);
commit;
