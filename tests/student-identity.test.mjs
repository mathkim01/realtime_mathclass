import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

test('기존 수업을 보존하고 학년·반·번호로 새 학생을 입장시킨다', async () => {
  const db = await PGlite.create();
  const teacher = '11111111-1111-4111-8111-111111111111';
  const firstStudent = '33333333-3333-4333-8333-333333333333';
  const secondStudent = '44444444-4444-4444-8444-444444444444';
  const as = async uid => {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid]);
    await db.exec('set role authenticated');
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
    for (const id of [teacher, firstStudent, secondStudent]) await db.query('insert into auth.users(id) values ($1)', [id]);
    await db.query("insert into public.teachers(user_id) values ($1)", [teacher]);
    await db.exec("insert into public.problem_sets(id,title,problem_count) values ('test','테스트',1)");
    await db.exec("insert into private.answer_keys(problem_set_id,problem_id,correct_answer) values ('test',1,'①')");
    await as(teacher);
    const oldSession = (await db.query("select public.create_class_session('test') as value")).rows[0].value;
    await as(firstStudent);
    await db.query('select public.join_class_session($1,$2) as value', [oldSession.code, '기존 학생']);

    await db.exec('reset role');
    const migration = fs.readFileSync(new URL('../supabase/migrations/002_student_identity.sql', import.meta.url), 'utf8');
    await db.exec(migration);
    await db.exec(migration);
    await as(teacher);
    const newSession = (await db.query("select public.create_class_session('test') as value")).rows[0].value;
    await as(firstStudent);
    const joined = (await db.query('select public.join_class_session($1,$2,$3,$4) as value', [newSession.code, 1, 2, 3])).rows[0].value;
    assert.equal(joined.sessionId, newSession.sessionId);
    await as(secondStudent);
    const duplicate = (await db.query('select public.join_class_session($1,$2,$3,$4) as value', [newSession.code, 1, 2, 3])).rows[0].value;
    assert.match(duplicate.error, /이미 사용/);
    await as(teacher);
    const { rows } = await db.query('select display_name,grade,class_number,student_number from public.participants order by display_name');
    assert.equal(rows.length, 2);
    assert.deepEqual(rows.find(row => row.display_name === '기존 학생'), { display_name: '기존 학생', grade: null, class_number: null, student_number: null });
    assert.deepEqual(rows.find(row => row.display_name === '1학년 2반 3번'), { display_name: '1학년 2반 3번', grade: 1, class_number: 2, student_number: 3 });
  } finally { await db.close(); }
});
