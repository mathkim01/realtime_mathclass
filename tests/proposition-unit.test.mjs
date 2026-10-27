import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { problemSetId, problemsData } from '../src/data/proposition-problems.js';
import { isProblemComplete } from '../src/lib/problem-bank.js';
import { buildResultsCsv } from '../src/lib/results-csv.js';

test('문제은행의 4지선다·풀이 빈칸은 배포하고 정답표는 배포하지 않는다', () => {
  assert.equal(problemSetId, 'propositions-choice-v1');
  assert.equal(problemsData.length, 14);
  assert.deepEqual(problemsData.map(problem => problem.id), Array.from({ length: 14 }, (_, index) => index + 1));
  assert.ok(problemsData.every(problem => problem.content && problem.title && problem.sourceId &&
    problem.choices.length === 4 && problem.blankActivity.blankIds.length > 0 &&
    !('correctChoiceId' in problem) && !('originalAnswer' in problem) &&
    !('blanks' in problem.blankActivity)));
  assert.equal(problemsData[0].source, '98쪽 01');
  assert.equal(problemsData[13].source, '103쪽 13');
  const publicData = fs.readFileSync(new URL('../src/data/proposition-problems.js', import.meta.url), 'utf8');
  const setupSql = fs.readFileSync(new URL('../supabase/proposition-choice-bank-setup.sql', import.meta.url), 'utf8');
  assert.doesNotMatch(publicData, /correctChoiceId|originalAnswer|"answer"\s*:/);
  assert.doesNotMatch(setupSql, /insert into private\.answer_keys/i);
  assert.ok(isProblemComplete(problemsData[0], { answer: '2', blanks: Object.fromEntries(problemsData[0].blankActivity.blankIds.map(id => [id, '풀이'])) }));
  assert.equal(isProblemComplete(problemsData[0], { answer: '2', blanks: { b1: '풀이' } }), false);
  const html = fs.readFileSync(new URL('../public/proposition-concept.html', import.meta.url), 'utf8');
  assert.match(html, /명제와 조건/);
  assert.match(html, /정답 모두 가리기/);
  const app = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(app, /PropositionConceptLearning/);
  assert.match(app, /ProblemBlankActivity/);
  assert.match(app, /currentProblem\.choices/);
});

test('새 세트는 풀이 빈칸과 무관하게 선택 답안을 서버에서 채점하고 정답표를 반환하지 않는다', async () => {
  const db = await PGlite.create();
  const teacher = '11111111-1111-4111-8111-111111111111';
  const student = '33333333-3333-4333-8333-333333333333';
  const as = async uid => {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid]);
    await db.exec('set role authenticated');
  };
  const call = async (name, args = []) => {
    const { rows } = await db.query(`select public.${name}(${args.map((_, index) => '$' + (index + 1)).join(',')}) as value`, args);
    return rows[0].value;
  };
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth; create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth, public to anon, authenticated;
      grant execute on function auth.uid() to anon, authenticated;
    `);
    for (const file of ['001_initial.sql', '002_student_identity.sql', '003_delete_past_session.sql', '004_proposition_problem_set.sql']) {
      await db.exec(fs.readFileSync(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8'));
    }
    await db.exec(fs.readFileSync(new URL('../supabase/proposition-choice-bank-setup.sql', import.meta.url), 'utf8'));
    await db.query('insert into auth.users(id) values ($1),($2)', [teacher, student]);
    await db.query('insert into public.teachers(user_id) values ($1)', [teacher]);
    await db.exec("insert into private.answer_keys(problem_set_id,problem_id,correct_answer) select 'propositions-choice-v1',n,case when n=1 then '2' else '3' end from generate_series(1,14) n");
    await as(teacher);
    const session = await call('create_class_session', [problemSetId]);
    await as(student);
    await call('join_class_session', [session.code, 1, 2, 3]);
    const result = await call('submit_student_answers', [session.sessionId, { 1: { answer: '2', blanks: { b1: '풀이' } }, 2: { answer: '1' } }, '']);
    assert.equal(result.correctCount, 1);
    assert.equal(Object.keys(result.results).length, 14);
    assert.equal(result.results[1], 'O');
    assert.equal(result.results[2], 'X');
    assert.equal('correctAnswers' in result, false);
    const context = await call('classroom_context', [session.sessionId]);
    assert.equal('correctAnswers' in context.submission, false);
    await db.exec('reset role');
    const before = await db.query('select solved from public.participants where session_id = $1', [session.sessionId]);
    assert.equal(before.rows[0].solved, 0);
    await as(student);
    const completedBlanks = Object.fromEntries(problemsData[0].blankActivity.blankIds.map(id => [id, '풀이']));
    await call('save_student_draft', [session.sessionId, { 1: { answer: '2', blanks: completedBlanks } }]);
    await db.exec('reset role');
    const after = await db.query('select solved from public.participants where session_id = $1', [session.sessionId]);
    assert.equal(after.rows[0].solved, 1);
    const csv = buildResultsCsv({ session: { code: session.code, problem_set_id: problemSetId }, students: [{ display_name: '1학년 2반 3번', solved: 0, submission: { answers: { 1: { answer: '2', blanks: { b1: '풀이' } } }, results: { 1: 'O' }, correct_count: 1, problem_count: 14 } }] }, 14);
    assert.match(csv, /"1번 풀이 빈칸"/);
    assert.match(csv, /"2번 · ①, ④"/);
    assert.match(csv, /"b1: 풀이/);
  } finally { await db.close(); }
});
