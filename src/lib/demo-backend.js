import { emptyDashboard } from './supabase-backend.js';
import { demoAnswers } from '../data/demo-answers.js';

export function createDemoBackend(storage = localStorage, tabStorage = sessionStorage) {
  const dataKey = 'math-classroom-demo-v1';
  const historyKey = 'math-classroom-demo-history-v1';
  const roleKey = 'math-classroom-demo-role';
  const nameKey = 'math-classroom-demo-name';
  const read = () => JSON.parse(storage.getItem(dataKey) || 'null') || { ...emptyDashboard(), drafts: {}, concepts: [] };
  const write = data => storage.setItem(dataKey, JSON.stringify(data));
  const readHistory = () => JSON.parse(storage.getItem(historyKey) || '[]');
  const sessionRow = data => ({ id: data.id || data.activeSessionCode, code: data.activeSessionCode, created_at: data.created_at || new Date().toISOString(), ended_at: data.ended_at || null, status: data.isSessionActive ? 'ACTIVE' : 'ENDED' });
  const requireTeacher = () => { if (tabStorage.getItem(roleKey) !== 'teacher') throw new Error('교사 로그인 후 사용할 수 있습니다.'); };
  const requireStudent = () => {
    if (tabStorage.getItem(roleKey) !== 'student' || !read().isSessionActive) throw new Error('진행 중인 수업에 입장해주세요.');
    return tabStorage.getItem(nameKey);
  };
  const requireActive = () => { if (!read().isSessionActive) throw new Error('진행 중인 수업이 없습니다.'); };
  const participation = () => {
    const name = tabStorage.getItem(nameKey), data = read();
    return {
      role: 'student', participant: { name, code: data.activeSessionCode },
      answers: data.drafts[name] || {},
      submission: data.submissions.find(row => row.name === name)?.grade || null,
    };
  };
  const api = {
    isDemo: true,
    async restoreContext() {
      if (tabStorage.getItem(roleKey) === 'teacher') return { role: 'teacher' };
      if (tabStorage.getItem(roleKey) === 'student' && read().isSessionActive) return participation();
      return null;
    },
    async loginTeacher() { tabStorage.setItem(roleKey, 'teacher'); tabStorage.removeItem(nameKey); },
    async logoutTeacher() { tabStorage.removeItem(roleKey); },
    async createSession(problemSetId = 'unit1-v1') {
      requireTeacher();
      if (problemSetId !== 'unit1-v1') throw new Error('명제 단원의 로컬 데모 자동 채점은 제공하지 않습니다. 실제 Supabase 연결을 사용해주세요.');
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const previous = read();
      if (previous.activeSessionCode) {
        previous.isSessionActive = false;
        previous.ended_at ||= new Date().toISOString();
        storage.setItem(historyKey, JSON.stringify([previous, ...readHistory()]));
      }
      write({ ...emptyDashboard(), id: crypto.randomUUID(), created_at: new Date().toISOString(), activeSessionCode: code, isSessionActive: true, drafts: {}, concepts: [] });
      return { code };
    },
    async joinClass(code, identity) {
      const data = read();
      if (!data.isSessionActive || data.activeSessionCode !== code) throw new Error('유효하지 않거나 종료된 수업 코드입니다.');
      const { grade, classNumber, studentNumber } = identity;
      if (![grade, classNumber, studentNumber].every(Number.isInteger) || grade < 1 || grade > 12 || classNumber < 1 || classNumber > 99 || studentNumber < 1 || studentNumber > 99) throw new Error('학년·반·번호를 확인해주세요.');
      const name = `${grade}학년 ${classNumber}반 ${studentNumber}번`;
      tabStorage.setItem(roleKey, 'student'); tabStorage.setItem(nameKey, name);
      if (!data.students.some(row => row.name === name)) data.students.push({ name, grade, class_number: classNumber, student_number: studentNumber, solved: 0, progress: 0, status: '진행중', time: '방금 전' });
      write(data);
      return participation();
    },
    leaveClass() { tabStorage.removeItem(roleKey); tabStorage.removeItem(nameKey); },
    async getDashboard() {
      const data = read(), role = tabStorage.getItem(roleKey);
      if (!role) return emptyDashboard();
      const { drafts, concepts, ...dashboard } = data;
      if (role !== 'teacher') dashboard.submissions = data.submissions.filter(row => row.name === tabStorage.getItem(nameKey));
      return dashboard;
    },
    async listSessions() {
      requireTeacher();
      const current = read();
      return [current, ...readHistory()].filter(data => data.activeSessionCode).map(sessionRow);
    },
    async getSessionResults(sessionId) {
      requireTeacher();
      const data = [read(), ...readHistory()].find(item => (item.id || item.activeSessionCode) === sessionId);
      if (!data) throw new Error('수업 기록을 찾을 수 없습니다.');
      const submissions = new Map(data.submissions.map(row => [row.name, row]));
      return {
        session: sessionRow(data),
        students: data.students.map(student => {
          const submission = submissions.get(student.name);
          return {
            display_name: student.name, grade: student.grade, class_number: student.class_number,
            student_number: student.student_number, solved: student.solved,
            submission: submission ? {
              answers: submission.answers, results: submission.results,
              correct_count: Number(submission.score.split(' / ')[0]), problem_count: submission.total,
              edit_reason: submission.reason, submitted_at: submission.submitted_at,
            } : null,
          };
        }),
      };
    },
    async deleteSession(sessionId) {
      requireTeacher();
      const current = read();
      if ((current.id || current.activeSessionCode) === sessionId) {
        if (current.isSessionActive) throw new Error('진행 중인 수업은 삭제할 수 없습니다. 먼저 수업을 종료해주세요.');
        write({ ...emptyDashboard(), drafts: {}, concepts: [] });
        return { success: true };
      }
      const history = readHistory();
      const past = history.find(item => (item.id || item.activeSessionCode) === sessionId);
      if (!past) throw new Error('수업 기록을 찾을 수 없습니다.');
      if (past.isSessionActive) throw new Error('진행 중인 수업은 삭제할 수 없습니다. 먼저 수업을 종료해주세요.');
      storage.setItem(historyKey, JSON.stringify(history.filter(item => (item.id || item.activeSessionCode) !== sessionId)));
      return { success: true };
    },
    async saveDraft(answers) {
      const name = requireStudent(), data = read();
      data.drafts[name] = structuredClone(answers);
      const student = data.students.find(row => row.name === name);
      student.solved = Object.values(answers).filter(answer => answer.answer?.trim()).length;
      student.progress = Math.round(student.solved / 13 * 100);
      student.time = '방금 전';
      data.problemProgress = Object.keys(demoAnswers).map(id => ({ problemId: id, completed: Object.values(data.drafts).filter(draft => draft[id]?.answer?.trim()).length }));
      write(data);
    },
    async submit(answers, reason) {
      const name = requireStudent(), data = read();
      if (data.isSubmissionClosed) throw new Error('교사가 최종 제출을 마감했습니다.');
      const previous = data.submissions.find(row => row.name === name);
      if (previous && !reason.trim()) throw new Error('재제출 이유를 입력해주세요.');
      const results = Object.fromEntries(Object.entries(demoAnswers).map(([id, answer]) => [id, answers[id]?.answer === answer ? 'O' : 'X']));
      const correctCount = Object.values(results).filter(value => value === 'O').length;
      const grade = { results, correctCount, correctAnswers: demoAnswers, answers: structuredClone(answers) };
      const submission = { name, answers: structuredClone(answers), results, score: `${correctCount} / 13`, total: 13, reason, time: '방금 전', submitted_at: new Date().toISOString(), grade };
      data.submissions = data.submissions.filter(row => row.name !== name).concat(submission);
      data.students.find(row => row.name === name).status = '제출완료';
      write(data); return grade;
    },
    async endSession() { requireTeacher(); requireActive(); const data = read(); data.isSessionActive = false; data.ended_at = new Date().toISOString(); write(data); },
    async setDeadline(closed) { requireTeacher(); requireActive(); const data = read(); data.isSubmissionClosed = closed; write(data); },
    async announce(text) { requireTeacher(); requireActive(); const data = read(); data.announcement = text; data.announcementAt = new Date().toISOString(); data.announcementTime = '방금 전'; write(data); },
    async post(type, content, problemId) {
      const name = requireStudent(), data = read(), id = crypto.randomUUID();
      const key = type === 'idea' ? 'ideas' : 'questions';
      data[key].unshift({ id, name, content, problemId, time: '방금 전', reply: '', replyAuthor: '' }); write(data);
    },
    async reply(id, content) {
      requireActive(); const data = read(), row = data.questions.find(row => row.id === id);
      if (!tabStorage.getItem(roleKey)) throw new Error('수업에 입장해주세요.');
      if (!row || row.reply) throw new Error('이미 답글이 있거나 질문을 찾을 수 없습니다.');
      row.reply = content; row.replyAuthor = tabStorage.getItem(roleKey) === 'teacher' ? '선생님' : tabStorage.getItem(nameKey); write(data);
    },
    async remove(type, id) { requireTeacher(); requireActive(); const data = read(), key = type === 'idea' ? 'ideas' : 'questions'; data[key] = data[key].filter(row => row.id !== id); write(data); },
    async saveConcepts(names, lessonSet) { const name = requireStudent(), data = read(); data.concepts.push({ name, names, lessonSet }); write(data); },
    subscribe(listener) {
      globalThis.addEventListener?.('storage', listener);
      return () => globalThis.removeEventListener?.('storage', listener);
    },
  };
  return api;
}
