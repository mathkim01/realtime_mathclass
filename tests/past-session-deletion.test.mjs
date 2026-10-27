import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const teacher = '11111111-1111-4111-8111-111111111111';
const anotherTeacher = '22222222-2222-4222-8222-222222222222';
const student = '33333333-3333-4333-8333-333333333333';

test('이전 수업 삭제는 소유 교사만 가능하며 관련 기록만 함께 삭제한다', async () => {
  const db = await PGlite.create();
  const as = async (uid, role = 'authenticated') => {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid || '']);
    await db.exec(`set role ${role}`);
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
    await db.exec(fs.readFileSync(new URL('../supabase/migrations/001_initial.sql', import.meta.url), 'utf8'));
    await db.exec(fs.readFileSync(new URL('../supabase/migrations/002_student_identity.sql', import.meta.url), 'utf8'));
    const migration = fs.readFileSync(new URL('../supabase/migrations/003_delete_past_session.sql', import.meta.url), 'utf8');
    await db.exec(migration);
    await db.exec(migration);
    await db.exec("insert into public.problem_sets(id,title,problem_count) values ('test','테스트',1)");
    await db.exec("insert into private.answer_keys(problem_set_id,problem_id,correct_answer) values ('test',1,'①')");
    for (const uid of [teacher, anotherTeacher, student]) await db.query('insert into auth.users(id) values ($1)', [uid]);
    await db.query('insert into public.teachers(user_id) values ($1),($2)', [teacher, anotherTeacher]);

    await as(teacher);
    const oldSession = await call('create_class_session', ['test']);
    await as(student);
    await call('join_class_session', [oldSession.code, 1, 2, 3]);
    await call('submit_student_answers', [oldSession.sessionId, { 1: { answer: '①' } }, '']);
    await call('post_class_item', [oldSession.sessionId, 'question', '질문', 1]);
    await call('post_class_item', [oldSession.sessionId, 'idea', '생각', 1]);
    await call('save_concept_record', [oldSession.sessionId, ['원소'], { id: 'set-1' }]);

    await as(teacher);
    await assert.rejects(call('delete_past_class_session', [oldSession.sessionId]), /진행 중/);
    await call('manage_class_session', [oldSession.sessionId, 'end']);
    const newSession = await call('create_class_session', ['test']);
    await as(null, 'anon');
    await assert.rejects(call('delete_past_class_session', [oldSession.sessionId]), /permission denied/);
    await as(student);
    await assert.rejects(call('delete_past_class_session', [oldSession.sessionId]), /교사 권한/);
    await as(anotherTeacher);
    await assert.rejects(call('delete_past_class_session', [oldSession.sessionId]), /교사 권한/);

    await as(teacher);
    assert.deepEqual(await call('delete_past_class_session', [oldSession.sessionId]), { success: true });
    await assert.rejects(call('delete_past_class_session', [oldSession.sessionId]), /교사 권한/);
    await db.exec('reset role');
    for (const table of ['participants', 'student_answers', 'submissions', 'questions', 'ideas', 'concept_learning_records']) {
      const { rows } = await db.query(`select count(*)::integer as count from public.${table} where session_id = $1`, [oldSession.sessionId]);
      assert.equal(rows[0].count, 0, `${table} must be removed`);
    }
    assert.equal((await db.query('select count(*)::integer as count from public.class_sessions where id = $1', [newSession.sessionId])).rows[0].count, 1);
    assert.equal((await db.query("select count(*)::integer as count from private.answer_keys where problem_set_id = 'test'")).rows[0].count, 1);
  } finally { await db.close(); }
});
