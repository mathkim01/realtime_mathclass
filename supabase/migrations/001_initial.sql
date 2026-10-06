-- 신규 Supabase 프로젝트의 SQL Editor에서 실행합니다.
-- 원본 Google Sheets 데이터는 이 파일이 변경하지 않습니다.
begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.teachers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '선생님'
);
create table public.problem_sets (
  id text primary key,
  title text not null,
  problem_count integer not null check (problem_count between 1 and 100)
);
create table private.answer_keys (
  problem_set_id text not null references public.problem_sets(id),
  problem_id integer not null check (problem_id > 0),
  correct_answer text not null,
  primary key (problem_set_id, problem_id)
);
create table public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers(user_id),
  code text not null unique check (code ~ '^[0-9]{6}$'),
  problem_set_id text not null references public.problem_sets(id),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','ENDED')),
  submission_closed boolean not null default false,
  announcement text not null default '',
  announcement_at timestamptz,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);
create unique index one_active_session_per_teacher on public.class_sessions(teacher_id) where status = 'ACTIVE';
create table public.participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.class_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (length(display_name) between 1 and 80),
  solved integer not null default 0,
  progress integer not null default 0 check (progress between 0 and 100),
  submitted boolean not null default false,
  last_activity_at timestamptz not null default now(),
  unique (session_id, user_id),
  unique (session_id, display_name),
  unique (id, session_id)
);
create table public.student_answers (
  session_id uuid not null,
  participant_id uuid not null,
  problem_id integer not null check (problem_id > 0),
  payload jsonb not null default '{}',
  is_complete boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (participant_id, problem_id),
  foreign key (participant_id, session_id) references public.participants(id, session_id) on delete cascade
);
create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  participant_id uuid not null unique,
  answers jsonb not null,
  results jsonb not null,
  correct_count integer not null,
  problem_count integer not null,
  edit_reason text not null default '',
  submitted_at timestamptz not null default now(),
  foreign key (participant_id, session_id) references public.participants(id, session_id) on delete cascade
);
create table public.ideas (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  participant_id uuid not null,
  problem_id integer not null,
  content text not null check (length(content) between 1 and 2000),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (participant_id, session_id) references public.participants(id, session_id) on delete cascade
);
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  participant_id uuid not null,
  problem_id integer not null,
  content text not null check (length(content) between 1 and 2000),
  reply text not null default '',
  reply_author text not null default '',
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (participant_id, session_id) references public.participants(id, session_id) on delete cascade
);
create table public.concept_learning_records (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  participant_id uuid not null,
  concepts jsonb not null,
  lesson_set jsonb not null,
  recorded_at timestamptz not null default now(),
  foreign key (participant_id, session_id) references public.participants(id, session_id) on delete cascade
);
create table private.join_attempts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  count integer not null default 0
);
create index participants_user_idx on public.participants(user_id, session_id);
create index answers_session_idx on public.student_answers(session_id);
create index submissions_session_idx on public.submissions(session_id);
create index ideas_session_idx on public.ideas(session_id, created_at);
create index questions_session_idx on public.questions(session_id, created_at);
create index concepts_session_idx on public.concept_learning_records(session_id);

create function private.is_teacher() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.teachers where user_id = auth.uid());
$$;
create function private.owns_session(p_session_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.class_sessions where id = p_session_id and teacher_id = auth.uid());
$$;
create function private.can_read_session(p_session_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.owns_session(p_session_id) or exists(select 1 from public.participants where session_id = p_session_id and user_id = auth.uid());
$$;
create function private.can_read_answers(p_session_id uuid, p_participant_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.owns_session(p_session_id) or exists(select 1 from public.participants where id = p_participant_id and session_id = p_session_id and user_id = auth.uid());
$$;
-- 로그인 사용자는 정책 검사 함수만 호출할 수 있으며 private 테이블에 접근하지 못합니다.
grant usage on schema private to authenticated;
revoke all on all tables in schema private from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_teacher(), private.owns_session(uuid), private.can_read_session(uuid), private.can_read_answers(uuid,uuid) to authenticated;

alter table public.teachers enable row level security;
alter table public.problem_sets enable row level security;
alter table public.class_sessions enable row level security;
alter table public.participants enable row level security;
alter table public.student_answers enable row level security;
alter table public.submissions enable row level security;
alter table public.ideas enable row level security;
alter table public.questions enable row level security;
alter table public.concept_learning_records enable row level security;
-- 내부 테이블도 RLS로 보호합니다. 정책 없이 서버 소유자만 접근합니다.
alter table private.answer_keys enable row level security;
alter table private.join_attempts enable row level security;
revoke all on public.teachers, public.problem_sets, public.class_sessions, public.participants, public.student_answers, public.submissions, public.ideas, public.questions, public.concept_learning_records from public, anon, authenticated;
grant select on public.teachers, public.problem_sets, public.class_sessions, public.participants, public.student_answers, public.submissions, public.ideas, public.questions, public.concept_learning_records to authenticated;
create policy teacher_self on public.teachers for select to authenticated using (user_id = (select auth.uid()));
create policy problem_sets_read on public.problem_sets for select to authenticated using (true);
create policy session_members on public.class_sessions for select to authenticated using (private.can_read_session(id));
create policy participants_members on public.participants for select to authenticated using (private.can_read_session(session_id));
create policy answers_owner on public.student_answers for select to authenticated using (private.can_read_answers(session_id, participant_id));
create policy submissions_owner on public.submissions for select to authenticated using (private.can_read_answers(session_id, participant_id));
-- 삭제는 soft-delete로 처리하므로 Realtime DELETE 이벤트의 이전 데이터 노출을 피합니다.
create policy ideas_members on public.ideas for select to authenticated using (private.can_read_session(session_id));
create policy questions_members on public.questions for select to authenticated using (private.can_read_session(session_id));
create policy concepts_owner on public.concept_learning_records for select to authenticated using (private.can_read_answers(session_id, participant_id));

create function public.create_class_session(p_problem_set_id text default 'unit1-v1') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_code text; v_attempt integer;
begin
  if not private.is_teacher() then raise exception '교사 권한이 필요합니다.'; end if;
  -- 같은 교사의 동시 개설 요청을 직렬화합니다.
  perform 1 from public.teachers where user_id = auth.uid() for update;
  if not exists(select 1 from public.problem_sets s where s.id = p_problem_set_id and s.problem_count = (select count(*) from private.answer_keys k where k.problem_set_id = s.id)) then
    raise exception '문제 세트와 정답 데이터를 먼저 등록해주세요.';
  end if;
  update public.class_sessions set status = 'ENDED', ended_at = now() where teacher_id = auth.uid() and status = 'ACTIVE';
  for v_attempt in 1..100 loop
    v_code := floor(100000 + random() * 900000)::integer::text;
    begin
      insert into public.class_sessions(teacher_id, code, problem_set_id) values(auth.uid(), v_code, p_problem_set_id) returning id into v_id;
      return jsonb_build_object('sessionId', v_id, 'code', v_code);
    exception when unique_violation then null;
    end;
  end loop;
  raise exception '수업 코드를 생성하지 못했습니다. 다시 시도해주세요.';
end;
$$;

create function public.join_class_session(p_code text, p_display_name text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_session public.class_sessions; v_participant public.participants; v_attempt private.join_attempts;
begin
  if auth.uid() is null then raise exception '학생 인증이 필요합니다.'; end if;
  if private.is_teacher() then raise exception '교사 계정에서는 학생으로 입장할 수 없습니다.'; end if;
  if p_code is null or p_code !~ '^[0-9]{6}$' or p_display_name is null or length(trim(p_display_name)) not between 1 and 80 then raise exception '이름과 6자리 코드를 확인해주세요.'; end if;
  insert into private.join_attempts(user_id, count) values(auth.uid(), 1)
  on conflict (user_id) do update set count = case when private.join_attempts.started_at < now() - interval '1 minute' then 1 else private.join_attempts.count + 1 end,
    started_at = case when private.join_attempts.started_at < now() - interval '1 minute' then now() else private.join_attempts.started_at end
  returning * into v_attempt;
  -- 실패도 횟수가 기록되도록 오류 대신 JSON을 반환합니다.
  if v_attempt.count > 10 then return jsonb_build_object('error','입장 시도가 많습니다. 1분 후 다시 시도해주세요.'); end if;
  select * into v_session from public.class_sessions where code = p_code and status = 'ACTIVE' for share;
  if not found then return jsonb_build_object('error','유효하지 않거나 종료된 수업 코드입니다.'); end if;
  select * into v_participant from public.participants where session_id = v_session.id and user_id = auth.uid();
  if found then
    if v_participant.display_name <> trim(p_display_name) then return jsonb_build_object('error','이 브라우저는 이미 다른 이름으로 입장했습니다. 기존 이름을 사용해주세요.'); end if;
  else
    begin
      insert into public.participants(session_id, user_id, display_name) values(v_session.id, auth.uid(), trim(p_display_name)) returning * into v_participant;
    exception when unique_violation then
      return jsonb_build_object('error','같은 학번·이름이 이미 사용 중입니다. 원래 기기에서 재접속하거나 선생님에게 문의해주세요.');
    end;
  end if;
  return jsonb_build_object('sessionId',v_session.id);
end;
$$;

create function public.classroom_context(p_session_id uuid default null) returns jsonb
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
  select jsonb_build_object('results',s.results,'correctCount',s.correct_count,'answers',s.answers,'correctAnswers',(select jsonb_object_agg(problem_id::text,correct_answer) from private.answer_keys where problem_set_id = v_session.problem_set_id)) into v_grade from public.submissions s where participant_id = v_participant.id;
  return jsonb_build_object('role','student','sessionId',v_session.id,'participant',jsonb_build_object('name',v_participant.display_name,'code',v_session.code),'answers',v_answers,'submission',v_grade);
end;
$$;

create function public.classroom_dashboard(p_session_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_session public.class_sessions; v_teacher boolean; v_students jsonb; v_ideas jsonb; v_questions jsonb; v_submissions jsonb; v_progress jsonb;
begin
  if not private.can_read_session(p_session_id) then raise exception '이 수업에 접근할 권한이 없습니다.'; end if;
  select * into v_session from public.class_sessions where id = p_session_id;
  v_teacher := private.owns_session(p_session_id);
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',display_name,'solved',solved,'progress',progress,'status',case when submitted then '제출완료' else '진행중' end,'time',last_activity_at) order by display_name),'[]') into v_students from public.participants where session_id = p_session_id;
  select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'name',p.display_name,'problemId',i.problem_id,'content',i.content,'time',i.created_at) order by i.created_at desc),'[]') into v_ideas from public.ideas i join public.participants p on p.id = i.participant_id where i.session_id = p_session_id and i.deleted_at is null;
  select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'name',p.display_name,'problemId',q.problem_id,'content',q.content,'reply',q.reply,'replyAuthor',q.reply_author,'time',q.created_at) order by q.created_at desc),'[]') into v_questions from public.questions q join public.participants p on p.id = q.participant_id where q.session_id = p_session_id and q.deleted_at is null;
  select coalesce(jsonb_agg(jsonb_build_object('name',p.display_name,'score',s.correct_count::text || ' / ' || s.problem_count::text,'total',s.problem_count,'reason',s.edit_reason,'time',s.submitted_at,'answers',s.answers,'results',s.results)),'[]') into v_submissions from public.submissions s join public.participants p on p.id = s.participant_id where s.session_id = p_session_id and (v_teacher or p.user_id = auth.uid());
  select coalesce(jsonb_agg(jsonb_build_object('problemId',problem_id,'completed',completed)),'[]') into v_progress from (select problem_id,count(*) filter(where is_complete) as completed from public.student_answers where session_id = p_session_id group by problem_id) counts;
  return jsonb_build_object('students',v_students,'ideas',v_ideas,'questions',v_questions,'submissions',v_submissions,'problemProgress',v_progress,'activeSessionCode',v_session.code,'isSessionActive',v_session.status = 'ACTIVE','isSubmissionClosed',v_session.submission_closed,'announcement',v_session.announcement,'announcementTime',v_session.announcement_at);
end;
$$;

create function public.save_student_draft(p_session_id uuid, p_answers jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_session public.class_sessions; v_participant public.participants; v_key text; v_item jsonb; v_solved integer; v_count integer;
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
    insert into public.student_answers(session_id,participant_id,problem_id,payload,is_complete) values(p_session_id,v_participant.id,v_key::integer,v_item,length(trim(coalesce(v_item->>'answer',''))) > 0)
    on conflict (participant_id,problem_id) do update set payload = excluded.payload,is_complete = excluded.is_complete,updated_at = now();
  end loop;
  select count(*) filter(where is_complete) into v_solved from public.student_answers where participant_id = v_participant.id;
  update public.participants set solved = v_solved, progress = round(v_solved * 100.0 / v_count), last_activity_at = now() where id = v_participant.id;
  return jsonb_build_object('success',true);
end;
$$;

create function public.submit_student_answers(p_session_id uuid, p_answers jsonb, p_reason text default '') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_session public.class_sessions; v_participant public.participants; v_results jsonb; v_correct_answers jsonb; v_score integer; v_total integer;
begin
  select * into v_session from public.class_sessions where id = p_session_id for share;
  if not found or v_session.status <> 'ACTIVE' then raise exception '수업이 종료되었습니다.'; end if;
  if v_session.submission_closed then raise exception '교사가 최종 제출을 마감했습니다.'; end if;
  perform public.save_student_draft(p_session_id,p_answers);
  select * into v_participant from public.participants where session_id = p_session_id and user_id = auth.uid() for update;
  if length(coalesce(p_reason,'')) > 2000 then raise exception '수정 이유는 2000자 이내로 입력해주세요.'; end if;
  if exists(select 1 from public.submissions where participant_id = v_participant.id) and length(trim(coalesce(p_reason,''))) = 0 then raise exception '재제출 이유를 입력해주세요.'; end if;
  select jsonb_object_agg(k.problem_id::text,case when trim(coalesce(p_answers->k.problem_id::text->>'answer','')) = k.correct_answer then 'O' else 'X' end),
    jsonb_object_agg(k.problem_id::text,k.correct_answer),
    count(*) filter(where trim(coalesce(p_answers->k.problem_id::text->>'answer','')) = k.correct_answer),count(*)
  into v_results,v_correct_answers,v_score,v_total from private.answer_keys k where k.problem_set_id = v_session.problem_set_id;
  if v_total = 0 then raise exception '정답 데이터가 없습니다.'; end if;
  insert into public.submissions(session_id,participant_id,answers,results,correct_count,problem_count,edit_reason) values(p_session_id,v_participant.id,p_answers,v_results,v_score,v_total,coalesce(p_reason,''))
  on conflict(participant_id) do update set answers = excluded.answers,results = excluded.results,correct_count = excluded.correct_count,problem_count = excluded.problem_count,edit_reason = excluded.edit_reason,submitted_at = now();
  update public.participants set submitted = true,last_activity_at = now() where id = v_participant.id;
  return jsonb_build_object('results',v_results,'correctCount',v_score,'answers',p_answers,'correctAnswers',v_correct_answers);
end;
$$;

create function public.manage_class_session(p_session_id uuid, p_action text, p_message text default '') returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not private.owns_session(p_session_id) then raise exception '이 수업의 교사 권한이 필요합니다.'; end if;
  perform 1 from public.class_sessions where id = p_session_id and status = 'ACTIVE' for update;
  if not found then raise exception '진행 중인 수업이 없습니다.'; end if;
  if p_action = 'end' then update public.class_sessions set status = 'ENDED',ended_at = now() where id = p_session_id;
  elsif p_action in ('close','open') then update public.class_sessions set submission_closed = (p_action = 'close') where id = p_session_id;
  elsif p_action = 'announce' then
    if p_message is null or length(trim(p_message)) not between 1 and 2000 then raise exception '공지 내용은 1~2000자로 입력해주세요.'; end if;
    update public.class_sessions set announcement = trim(p_message),announcement_at = now() where id = p_session_id;
  else raise exception '지원하지 않는 수업 관리 작업입니다.';
  end if;
  return jsonb_build_object('success',true);
end;
$$;

create function public.post_class_item(p_session_id uuid,p_type text,p_content text,p_problem_id integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_participant public.participants; v_session public.class_sessions; v_count integer; v_id uuid;
begin
  select * into v_session from public.class_sessions where id = p_session_id and status = 'ACTIVE' for share;
  if not found then raise exception '수업이 종료되었습니다.'; end if;
  select * into v_participant from public.participants where session_id = p_session_id and user_id = auth.uid();
  if not found then raise exception '학생 입장이 필요합니다.'; end if;
  select problem_count into v_count from public.problem_sets where id = v_session.problem_set_id;
  if p_problem_id is null or p_problem_id not between 1 and v_count or p_content is null or length(trim(p_content)) not between 1 and 2000 then raise exception '문항 번호와 내용(1~2000자)을 확인해주세요.'; end if;
  if p_type = 'idea' then insert into public.ideas(session_id,participant_id,problem_id,content) values(p_session_id,v_participant.id,p_problem_id,trim(p_content)) returning id into v_id;
  elsif p_type = 'question' then insert into public.questions(session_id,participant_id,problem_id,content) values(p_session_id,v_participant.id,p_problem_id,trim(p_content)) returning id into v_id;
  else raise exception '지원하지 않는 게시물입니다.';
  end if;
  return jsonb_build_object('id',v_id);
end;
$$;

create function public.reply_class_question(p_question_id uuid,p_content text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_question public.questions; v_author text;
begin
  select * into v_question from public.questions where id = p_question_id and deleted_at is null;
  if not found or not private.can_read_session(v_question.session_id) then raise exception '질문에 접근할 권한이 없습니다.'; end if;
  perform 1 from public.class_sessions where id = v_question.session_id and status = 'ACTIVE' for share;
  if not found then raise exception '수업이 종료되었습니다.'; end if;
  if p_content is null or length(trim(p_content)) not between 1 and 2000 then raise exception '답글은 1~2000자로 입력해주세요.'; end if;
  if private.owns_session(v_question.session_id) then select display_name into v_author from public.teachers where user_id = auth.uid();
  else select display_name into v_author from public.participants where session_id = v_question.session_id and user_id = auth.uid(); end if;
  update public.questions set reply = trim(p_content),reply_author = v_author where id = p_question_id and reply = '' and deleted_at is null;
  if not found then raise exception '이미 답글이 등록되었습니다.'; end if;
  return jsonb_build_object('success',true);
end;
$$;

create function public.remove_class_item(p_session_id uuid,p_type text,p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not private.owns_session(p_session_id) then raise exception '교사 권한이 필요합니다.'; end if;
  perform 1 from public.class_sessions where id = p_session_id and status = 'ACTIVE' for share;
  if not found then raise exception '수업이 종료되었습니다.'; end if;
  if p_type = 'idea' then update public.ideas set deleted_at = now() where id = p_id and session_id = p_session_id;
  elsif p_type = 'question' then update public.questions set deleted_at = now() where id = p_id and session_id = p_session_id;
  else raise exception '지원하지 않는 게시물입니다.'; end if;
  if not found then raise exception '항목을 찾을 수 없습니다.'; end if;
  return jsonb_build_object('success',true);
end;
$$;

create function public.save_concept_record(p_session_id uuid,p_concepts jsonb,p_lesson_set jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_participant_id uuid;
begin
  perform 1 from public.class_sessions where id = p_session_id and status = 'ACTIVE' for share;
  if not found then raise exception '수업이 종료되었습니다.'; end if;
  select id into v_participant_id from public.participants where session_id = p_session_id and user_id = auth.uid();
  if not found then raise exception '학생 입장이 필요합니다.'; end if;
  if p_concepts is null or jsonb_typeof(p_concepts) <> 'array' or p_lesson_set is null or jsonb_typeof(p_lesson_set) <> 'object' or length(p_concepts::text) > 5000 or length(p_lesson_set::text) > 20000 then raise exception '학습 기록 형식이 올바르지 않습니다.'; end if;
  insert into public.concept_learning_records(session_id,participant_id,concepts,lesson_set) values(p_session_id,v_participant_id,p_concepts,p_lesson_set);
  return jsonb_build_object('success',true);
end;
$$;

-- API 쓰기는 검증을 포함한 지정 함수만 통과합니다.
revoke all on function public.create_class_session(text), public.join_class_session(text,text), public.classroom_context(uuid), public.classroom_dashboard(uuid), public.save_student_draft(uuid,jsonb), public.submit_student_answers(uuid,jsonb,text), public.manage_class_session(uuid,text,text), public.post_class_item(uuid,text,text,integer), public.reply_class_question(uuid,text), public.remove_class_item(uuid,text,uuid), public.save_concept_record(uuid,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.create_class_session(text), public.join_class_session(text,text), public.classroom_context(uuid), public.classroom_dashboard(uuid), public.save_student_draft(uuid,jsonb), public.submit_student_answers(uuid,jsonb,text), public.manage_class_session(uuid,text,text), public.post_class_item(uuid,text,text,integer), public.reply_class_question(uuid,text), public.remove_class_item(uuid,text,uuid), public.save_concept_record(uuid,jsonb,jsonb) to authenticated;

do $$
declare v_table text;
begin
  -- 로컬 SQL 테스트 환경에는 Supabase publication이 없을 수 있습니다.
  if exists(select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach v_table in array array['class_sessions','participants','submissions','ideas','questions'] loop
      if not exists(select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = v_table) then
        execute format('alter publication supabase_realtime add table public.%I',v_table);
      end if;
    end loop;
  end if;
end;
$$;
commit;
