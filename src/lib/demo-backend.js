import { emptyDashboard } from './supabase-backend.js';
import { demoAnswers } from '../data/demo-answers.js';

export function createDemoBackend(storage = localStorage, tabStorage = sessionStorage) {
  const dataKey = 'math-classroom-demo-v1';
  const roleKey = 'math-classroom-demo-role';
  const nameKey = 'math-classroom-demo-name';
  const read = () => JSON.parse(storage.getItem(dataKey) || 'null') || { ...emptyDashboard(), drafts: {}, concepts: [] };
  const write = data => storage.setItem(dataKey, JSON.stringify(data));
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
    async createSession() {
      requireTeacher();
      const code = String(Math.floor(100000 + Math.random() * 900000));
      write({ ...emptyDashboard(), activeSessionCode: code, isSessionActive: true, drafts: {}, concepts: [] });
      return { code };
    },
    async joinClass(code, name) {
      const data = read();
      if (!data.isSessionActive || data.activeSessionCode !== code) throw new Error('유효하지 않거나 종료된 수업 코드입니다.');
      tabStorage.setItem(roleKey, 'student'); tabStorage.setItem(nameKey, name);
      if (!data.students.some(row => row.name === name)) data.students.push({ name, solved: 0, progress: 0, status: '진행중', time: '방금 전' });
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
      const submission = { name, answers: structuredClone(answers), results, score: `${correctCount} / 13`, total: 13, reason, time: '방금 전', grade };
      data.submissions = data.submissions.filter(row => row.name !== name).concat(submission);
      data.students.find(row => row.name === name).status = '제출완료';
      write(data); return grade;
    },
    async endSession() { requireTeacher(); requireActive(); const data = read(); data.isSessionActive = false; write(data); },
    async setDeadline(closed) { requireTeacher(); requireActive(); const data = read(); data.isSubmissionClosed = closed; write(data); },
    async announce(text) { requireTeacher(); requireActive(); const data = read(); data.announcement = text; data.announcementTime = '방금 전'; write(data); },
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
