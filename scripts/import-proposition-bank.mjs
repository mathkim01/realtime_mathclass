import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [sourcePath, privateSqlPath] = process.argv.slice(2);
const problemSetId = 'propositions-choice-v1';

if (!sourcePath || !privateSqlPath) {
  throw new Error('사용법: node scripts/import-proposition-bank.mjs <문제은행.json> <저장소-밖-정답.sql>');
}

const privatePath = path.resolve(privateSqlPath);
const relativePrivatePath = path.relative(projectRoot, privatePath);
if (!relativePrivatePath.startsWith('..' + path.sep) || relativePrivatePath === '..') {
  throw new Error('정답 SQL은 웹 프로젝트 저장소 밖에 저장해야 합니다.');
}

const bank = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
if (bank.schemaVersion !== '1.0' || !Array.isArray(bank.problems) || bank.problems.length < 1 || bank.problems.length > 100) {
  throw new Error('지원하지 않는 문제은행 형식 또는 문항 수입니다.');
}

const seenSourceIds = new Set();
const publicProblems = bank.problems.map((problem, index) => {
  if (!problem.id || seenSourceIds.has(problem.id)) throw new Error(`문항 ${index + 1}: 중복되거나 비어 있는 원본 ID`);
  seenSourceIds.add(problem.id);
  if (!Number.isInteger(problem.page) || !problem.originalNumber || !problem.title ||
      !Array.isArray(problem.problemLines) || !problem.problemLines.length ||
      problem.problemLines.some(line => typeof line !== 'string') ||
      !Array.isArray(problem.choices) || problem.choices.length !== 4 ||
      problem.choices.some((choice, choiceIndex) => choice.id !== String(choiceIndex + 1) || !choice.text) ||
      !problem.choices.some(choice => choice.id === problem.correctChoiceId)) {
    throw new Error(`문항 ${index + 1}: 문제·선택지·정답 형식을 확인하세요.`);
  }
  const activity = problem.blankActivity;
  if (!Array.isArray(activity?.templateLines) || !Array.isArray(activity?.blanks) || !activity.blanks.length) {
    throw new Error(`문항 ${index + 1}: 빈칸 활동 형식을 확인하세요.`);
  }
  const blankIds = activity.blanks.map((blank, blankIndex) => {
    const expected = `b${blankIndex + 1}`;
    if (blank.id !== expected || typeof blank.answer !== 'string' || !blank.answer.trim()) {
      throw new Error(`문항 ${index + 1}: 빈칸 ${expected} 형식을 확인하세요.`);
    }
    return expected;
  });
  const placeholders = activity.templateLines.join('\n').match(/\{\{b\d+\}\}/g) || [];
  if (placeholders.length !== blankIds.length || blankIds.some(id => !placeholders.includes(`{{${id}}}`))) {
    throw new Error(`문항 ${index + 1}: 빈칸 ID와 본문 표시가 일치하지 않습니다.`);
  }
  if (Array.isArray(problem.images) && problem.images.length) {
    throw new Error(`문항 ${index + 1}: 이미지 가져오기는 아직 지원하지 않습니다.`);
  }
  return {
    id: index + 1,
    sourceId: problem.id,
    source: `${problem.page}쪽 ${problem.originalNumber}`,
    title: `${problem.page}쪽 ${problem.originalNumber}. ${problem.title}`,
    content: problem.problemLines.join('\n'),
    choices: problem.choices.map(choice => ({ id: choice.id, text: choice.text })),
    blankActivity: { templateLines: activity.templateLines, blankIds },
    image: null,
  };
});

const publicJs = `// ${path.basename(sourcePath)}에서 생성한 공개 문제 데이터입니다. 정답은 포함하지 않습니다.\n` +
  `export const problemSetId = '${problemSetId}';\n` +
  `export const problemsData = ${JSON.stringify(publicProblems, null, 2)};\n`;
const sqlLiteral = value => `'${String(value).replaceAll("'", "''")}'`;
const blankCounts = publicProblems.map(problem => problem.blankActivity.blankIds.length).join(', ');
const setupSql = `-- 공개 설정: 새 문제 세트 등록 및 풀이 빈칸 완료 기준. 정답은 포함하지 않습니다.
-- 기존 001~004 적용 후 실행하세요. 이전 수업의 세트와 제출 기록은 유지합니다.
begin;

insert into public.problem_sets(id, title, problem_count)
values ('${problemSetId}', ${sqlLiteral(bank.title + ' · 4지선다 문제은행')}, ${publicProblems.length})
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
  v_required_blanks integer[] := array[${blankCounts}];
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
    if v_session.problem_set_id = '${problemSetId}' then
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
`;
const answerRows = bank.problems.map((problem, index) =>
  `('${problemSetId}', ${index + 1}, ${sqlLiteral(problem.correctChoiceId)})`).join(',\n');
const privateSql = `-- 비공개: ${bank.title} 4지선다 정답 번호. GitHub에 올리지 마세요.\n` +
  `-- 공개 설정 SQL을 먼저 실행한 다음 Supabase SQL Editor에서 실행하세요.\n` +
  `begin;\ninsert into private.answer_keys(problem_set_id, problem_id, correct_answer) values\n${answerRows}\n` +
  `on conflict (problem_set_id, problem_id) do update set correct_answer = excluded.correct_answer;\ncommit;\n`;

fs.writeFileSync(path.join(projectRoot, 'src/data/proposition-problems.js'), publicJs);
fs.writeFileSync(path.join(projectRoot, 'supabase/proposition-choice-bank-setup.sql'), setupSql);
fs.writeFileSync(privatePath, privateSql, { flag: 'w' });
console.log(`문항 ${publicProblems.length}개를 변환했습니다. 공개 파일 2개와 저장소 밖의 비공개 정답 SQL을 생성했습니다.`);
