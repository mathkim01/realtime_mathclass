import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { problemsData } from '../src/data/problems.js';
import { createDemoBackend } from '../src/lib/demo-backend.js';

test('13문항·그림 보존, 공개 데이터에 정답이 없음', () => {
  assert.equal(problemsData.length,13);
  assert.deepEqual(problemsData.map(p => p.id),Array.from({length:13},(_,i)=>i+1));
  assert.ok(problemsData.every(p => p.options.length === 5 && !('correctAnswer' in p) && !('keys' in p)));
  assert.equal(problemsData[12].image,'unit1-q13-factory-map');
  const app = fs.readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');
  assert.doesNotMatch(app,/google\.script|<\?!=|teacherPw !== 'teacher'/);
  assert.ok(fs.existsSync(new URL('../src/assets/unit1-q13-factory-map.svg',import.meta.url)));
});

test('로컬 체험 수업·학생·최종제출·마감 흐름', async () => {
  const store = () => {
    const map = new Map();
    return { getItem:k => map.get(k) ?? null,setItem:(k,v) => map.set(k,String(v)),removeItem:k => map.delete(k) };
  };
  const shared = store(), teacher = createDemoBackend(shared,store()), student = createDemoBackend(shared,store());
  await teacher.loginTeacher();
  const { code } = await teacher.createSession();
  const context = await student.joinClass(code,'10101 학생');
  assert.equal(context.participant.name,'10101 학생');
  await student.saveDraft({1:{answer:'④ 8'}});
  assert.equal((await teacher.getDashboard()).students[0].solved,1);
  const grade = await student.submit({1:{answer:'④ 8'}},'');
  assert.equal(grade.correctCount,1);
  await teacher.setDeadline(true);
  await assert.rejects(student.submit({},'수정'),/마감/);
  await teacher.endSession();
  await assert.rejects(student.saveDraft({}),/진행 중/);
});
