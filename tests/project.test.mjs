import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { problemsData } from '../src/data/problems.js';
import { createDemoBackend } from '../src/lib/demo-backend.js';
import { buildResultsCsv } from '../src/lib/results-csv.js';
import { answerStorageKey, submissionStorageKey, clearStudentAnswerCache } from '../src/lib/student-storage.js';

test('13문항·그림 보존, 공개 데이터에 정답이 없음', () => {
  assert.equal(problemsData.length,13);
  assert.deepEqual(problemsData.map(p => p.id),Array.from({length:13},(_,i)=>i+1));
  assert.ok(problemsData.every(p => p.options.length === 5 && !('correctAnswer' in p) && !('keys' in p)));
  assert.equal(problemsData[12].image,'unit1-q13-factory-map');
  const app = fs.readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');
  assert.doesNotMatch(app,/google\.script|<\?!=|teacherPw !== 'teacher'/);
  assert.match(app,/clearStudentAnswerCache\(localStorage, sessionStorage\.getItem\('student_name'\)/);
  assert.ok(fs.existsSync(new URL('../src/assets/unit1-q13-factory-map.svg',import.meta.url)));
});

test('로컬 체험 수업·학생·최종제출·마감 흐름', async () => {
  const store = () => {
    const map = new Map();
    return { getItem:k => map.get(k) ?? null,setItem:(k,v) => map.set(k,String(v)),removeItem:k => map.delete(k) };
  };
  const shared = store(), teacher = createDemoBackend(shared,store()), student = createDemoBackend(shared,store()), absent = createDemoBackend(shared,store());
  await teacher.loginTeacher();
  await assert.rejects(teacher.createSession('propositions-v1'), /데모 자동 채점/);
  const { code } = await teacher.createSession();
  const context = await student.joinClass(code,{ grade: 1, classNumber: 2, studentNumber: 3 });
  assert.equal(context.participant.name,'1학년 2반 3번');
  await absent.joinClass(code,{ grade: 1, classNumber: 2, studentNumber: 4 });
  await student.saveDraft({1:{answer:'④ 8'}});
  assert.equal((await teacher.getDashboard()).students[0].solved,1);
  const grade = await student.submit({1:{answer:'④ 8'}},'');
  assert.equal(grade.correctCount,1);
  const sessions = await teacher.listSessions();
  const results = await teacher.getSessionResults(sessions[0].id);
  const csv = buildResultsCsv(results);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.match(csv,/"학년","반","번호"/);
  assert.match(csv,/"1","2","3","1학년 2반 3번"/);
  assert.match(csv,/"④ 8","O"/);
  assert.match(csv,/"1","2","4","1학년 2반 4번","미제출"/);
  await teacher.setDeadline(true);
  await assert.rejects(student.submit({},'수정'),/마감/);
  await assert.rejects(teacher.deleteSession(sessions[0].id),/진행 중/);
  await assert.rejects(student.deleteSession(sessions[0].id),/교사 로그인/);
  await teacher.endSession();
  assert.equal((await teacher.listSessions())[0].status, 'ENDED');
  assert.equal((await teacher.getSessionResults(sessions[0].id)).students.length, 2);
  await assert.rejects(student.saveDraft({}),/진행 중/);
  await teacher.deleteSession(sessions[0].id);
  assert.equal((await teacher.listSessions()).length, 0);
  await assert.rejects(teacher.getSessionResults(sessions[0].id),/찾을 수/);
});

test('수업 나가기용 로컬 캐시는 해당 학생·수업 답안만 지운다', () => {
  const map = new Map();
  const storage = {
    getItem: key => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: key => map.delete(key),
  };
  const ownAnswer = answerStorageKey('1학년 2반 3번', '123456');
  const ownSubmission = submissionStorageKey('1학년 2반 3번', '123456');
  const anotherAnswer = answerStorageKey('1학년 2반 4번', '123456');
  storage.setItem(ownAnswer, '{"1":{"answer":"①"}}');
  storage.setItem(ownSubmission, 'true');
  storage.setItem(anotherAnswer, '다른 학생의 캐시');
  clearStudentAnswerCache(storage, '1학년 2반 3번', '123456');
  assert.equal(storage.getItem(ownAnswer), null);
  assert.equal(storage.getItem(ownSubmission), null);
  assert.equal(storage.getItem(anotherAnswer), '다른 학생의 캐시');
});

test('CSV에서 학생이 입력한 수식을 실행하지 않도록 보호', () => {
  const csv = buildResultsCsv({
    session: { code: '123456', created_at: '2026-10-15T00:00:00Z', ended_at: null },
    students: [{ display_name: '1학년 2반 3번', grade: 1, class_number: 2, student_number: 3, solved: 1,
      submission: { answers: { 1: { answer: '=HYPERLINK("example")' } }, results: { 1: 'X' }, correct_count: 0, problem_count: 13, submitted_at: '2026-10-15T00:01:00Z', edit_reason: '' } }],
  }, 1);
  assert.match(csv, /"'=HYPERLINK\(""example""\)"/);
});
