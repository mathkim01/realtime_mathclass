import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const teacher = '11111111-1111-4111-8111-111111111111';
const otherTeacher = '22222222-2222-4222-8222-222222222222';
const student = '33333333-3333-4333-8333-333333333333';
const otherStudent = '44444444-4444-4444-8444-444444444444';
const outsider = '55555555-5555-4555-8555-555555555555';

test('실제 PostgreSQL 엔진에서 수업·제출·RLS 권한 검사', async t => {
  const db = await PGlite.create();
  const as = async (uid, role = 'authenticated') => {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid || '']);
    await db.exec(`set role ${role}`);
  };
  const call = async (name, args = []) => {
    const { rows } = await db.query(`select public.${name}(${args.map((_,i) => '$'+(i+1)).join(',')}) as value`, args);
    return rows[0].value;
  };
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth;
      create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth, public to anon, authenticated;
      grant execute on function auth.uid() to anon, authenticated;
    `);
    await db.exec(fs.readFileSync(new URL('../supabase/migrations/001_initial.sql', import.meta.url), 'utf8'));
    await db.exec(fs.readFileSync(new URL('../supabase/seed.sql', import.meta.url), 'utf8'));
    for (const id of [teacher,otherTeacher,student,otherStudent,outsider]) await db.query('insert into auth.users(id) values ($1)',[id]);
    await db.query("insert into public.teachers(user_id,display_name) values ($1,'수학 선생님'),($2,'다른 선생님')",[teacher,otherTeacher]);
    await as(teacher);
    const first = await call('create_class_session', ['unit1-v1']);
    assert.match(first.code,/^\d{6}$/);
    await as(otherTeacher);
    const second = await call('create_class_session',['unit1-v1']);
    let questionId;

    await t.test('미로그인 및 일반 학생은 교사 기능과 정답에 접근할 수 없음', async () => {
      await as(null,'anon');
      await assert.rejects(call('create_class_session', ['unit1-v1']),/permission denied/);
      await assert.rejects(db.query('select * from public.class_sessions'),/permission denied/);
      await as(student);
      await assert.rejects(call('create_class_session',['unit1-v1']),/교사 권한/);
      await assert.rejects(db.query('select * from private.answer_keys'),/permission denied/);
      assert.equal((await db.query('select count(*)::integer as n from public.class_sessions')).rows[0].n,0);
    });
    await t.test('학생 입장, 동일 이름 보호, 수업 격리', async () => {
      await as(student);
      assert.ok((await call('join_class_session',['000000','학생 A'])).error);
      assert.equal((await call('join_class_session',[first.code,'학생 A'])).sessionId,first.sessionId);
      assert.equal((await call('join_class_session',[first.code,'학생 A'])).sessionId,first.sessionId);
      assert.ok((await call('join_class_session',[first.code,'학생 B'])).error);
      await as(otherStudent);
      assert.match((await call('join_class_session',[first.code,'학생 A'])).error,/이미 사용/);
      await call('join_class_session',[first.code,'학생 B']);
      await as(outsider);
      await call('join_class_session',[second.code,'다른 반 학생']);
      await assert.rejects(call('classroom_dashboard',[first.sessionId]),/권한/);
      assert.equal((await db.query('select count(*)::integer as n from public.participants')).rows[0].n,1);
    });
    await t.test('자동 저장·진행률은 서버가 계산하고 다른 학생 답안은 비공개', async () => {
      await as(student);
      await call('save_student_draft',[first.sessionId, { 1: {answer:'④ 8',isComplete:false}, 2: {answer:'오답',isComplete:true} }]);
      const dashboard = await call('classroom_dashboard',[first.sessionId]);
      assert.equal(dashboard.students.find(s => s.name === '학생 A').solved,2);
      assert.equal(dashboard.students.find(s => s.name === '학생 A').progress,15);
      await assert.rejects(call('save_student_draft',[first.sessionId,{999:{answer:'답'}}]),/문항/);
      await assert.rejects(call('save_student_draft',[first.sessionId,{1:{answer:5}}]),/문자열/);
      await assert.rejects(db.query("update public.participants set progress = 100"),/permission denied/);
      await assert.rejects(call('save_student_draft',[second.sessionId,{}]),/입장/);
      await as(otherStudent);
      assert.equal((await db.query('select count(*)::integer as n from public.student_answers')).rows[0].n,0);
      await assert.rejects(call('manage_class_session',[first.sessionId,'close']),/교사/);
    });
    await t.test('최종 제출 서버 채점·재제출 이유·교사 조회·새로고침 복원', async () => {
      await as(student);
      const grade = await call('submit_student_answers',[first.sessionId,{1:{answer:'④ 8'},2:{answer:'오답'}},'']);
      assert.equal(grade.correctCount,1);
      assert.equal(grade.results[1],'O');
      assert.equal(grade.results[2],'X');
      assert.equal(Object.keys(grade.results).length,13);
      assert.equal(grade.correctAnswers[13],'④ (12, 0)');
      await assert.rejects(call('submit_student_answers',[first.sessionId,{},'']),/재제출/);
      await call('submit_student_answers',[first.sessionId,{1:{answer:'④ 8'},2:{answer:'③ 3'}},'계산 수정']);
      const context = await call('classroom_context',[first.sessionId]);
      assert.equal(context.submission.correctCount,2);
      assert.equal(context.answers[2].answer,'③ 3');
      await as(otherStudent);
      assert.equal((await call('classroom_dashboard',[first.sessionId])).submissions.length,0);
      assert.equal((await db.query('select count(*)::integer as n from public.submissions')).rows[0].n,0);
      await as(teacher);
      const dashboard = await call('classroom_dashboard',[first.sessionId]);
      assert.equal(dashboard.submissions[0].score,'2 / 13');
      assert.equal(dashboard.submissions[0].reason,'계산 수정');
      assert.equal((await db.query('select count(*)::integer as n from public.submissions')).rows[0].n,1);
    });
    await t.test('질문·아이디어·답글과 교사만 가능한 삭제', async () => {
      await as(student);
      questionId = (await call('post_class_item',[first.sessionId,'question','풀이가 궁금해요',1])).id;
      const ideaId = (await call('post_class_item',[first.sessionId,'idea','그래프로 풀어요',1])).id;
      await assert.rejects(call('remove_class_item',[first.sessionId,'idea',ideaId]),/교사/);
      await as(outsider);
      await assert.rejects(call('reply_class_question',[questionId,'다른 수업']),/권한/);
      await as(teacher);
      await call('reply_class_question',[questionId,'좌표를 먼저 표시해보세요']);
      await assert.rejects(call('reply_class_question',[questionId,'중복 답글']),/이미 답글/);
      await call('remove_class_item',[first.sessionId,'idea',ideaId]);
      assert.equal((await call('classroom_dashboard',[first.sessionId])).ideas.length,0);
    });
    await t.test('개념학습 기록과 공지 저장', async () => {
      await as(student);
      await call('save_concept_record',[first.sessionId,['원소','합집합'],{id:'set-1',A:[2,4],B:[1,2]}]);
      assert.equal((await db.query('select count(*)::integer as n from public.concept_learning_records')).rows[0].n,1);
      await as(otherStudent);
      assert.equal((await db.query('select count(*)::integer as n from public.concept_learning_records')).rows[0].n,0);
      await as(teacher);
      await call('manage_class_session',[first.sessionId,'announce','마지막 10분입니다.']);
      assert.equal((await call('classroom_dashboard',[first.sessionId])).announcement,'마지막 10분입니다.');
    });
    await t.test('마감·수업 종료는 서버에서 강제하며 다른 교사의 수업은 영향 없음', async () => {
      await as(teacher);
      await assert.rejects(call('manage_class_session',[second.sessionId,'end']),/교사/);
      await call('manage_class_session',[first.sessionId,'close']);
      await as(student);
      await assert.rejects(call('submit_student_answers',[first.sessionId,{},'수정']),/마감/);
      await call('save_student_draft',[first.sessionId,{1:{answer:'④ 8'}}]);
      await as(teacher);
      await call('manage_class_session',[first.sessionId,'open']);
      await call('manage_class_session',[first.sessionId,'end']);
      await as(student);
      await assert.rejects(call('save_student_draft',[first.sessionId,{}]),/종료/);
      await assert.rejects(call('submit_student_answers',[first.sessionId,{},'수정']),/종료/);
      await assert.rejects(call('reply_class_question',[questionId,'종료 후 답변']),/종료/);
      assert.match((await call('join_class_session',[first.code,'학생 A'])).error,/종료/);
      await as(otherTeacher);
      assert.equal((await call('classroom_dashboard',[second.sessionId])).isSessionActive,true);
    });
    await t.test('동일 계정 수업 코드 추측 시도 제한', async () => {
      await as(outsider);
      for (let i=0;i<12;i++) await call('join_class_session',['000000','다른 반 학생']);
      assert.match((await call('join_class_session',[second.code,'다른 반 학생'])).error,/1분/);
    });
  } finally { await db.close(); }
});
