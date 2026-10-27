import React from 'react';
import { backend } from './lib/backend';
import { problemSetId, problemsData } from './data/proposition-problems';
import { conceptLearningData } from './data/concepts';
import MathText from './components/MathText';
import PropositionConceptLearning from './components/PropositionConceptLearning';
import ProblemBlankActivity from './components/ProblemBlankActivity';
import Notifications from './components/Notifications';
import { downloadResultsCsv } from './lib/results-csv';
import { answerStorageKey, submissionStorageKey, clearStudentAnswerCache } from './lib/student-storage';
import { isProblemComplete, selectedChoiceLabel } from './lib/problem-bank';
const activityGuide = [
  { title: '수업 준비물', body: '교과서(또는 빈 종이), 필기구, 모바일 기기(또는 태블릿)를 준비해주세요.' },
  { title: '답변 방식', body: '각 문제에서 4지선다 답을 고르고, 질문과 답·답·아이디어와 답 중 하나를 선택합니다. 질문과 풀이 아이디어도 공유할 수 있습니다.' },
  { title: '풀이 빈칸', body: '풀이 과정의 빈칸을 모두 채워야 해당 문항이 완료로 표시됩니다. 빈칸 내용은 자동 채점하지 않고 선택한 답만 채점합니다.' },
  { title: '문항 이동과 제출', body: '문항 번호를 누르면 해당 문제로 이동합니다. 모든 문항을 풀도록 노력한 뒤 최종 답안 제출 버튼을 눌러주세요. 미응답 문항도 제출할 수 있지만 오답 처리됩니다. 제출 마감 전에는 수정 이유를 적고 재제출할 수 있습니다.' },
];
    export default function App() {
      const [studentName, setStudentName] = React.useState('');
      const [studentIdentity, setStudentIdentity] = React.useState({ grade: '', classNumber: '', studentNumber: '' });
      const [guideChecks, setGuideChecks] = React.useState([false, false, false, false]);
      const [inputCode, setInputCode] = React.useState('');
      const [sessionCode, setSessionCode] = React.useState('');
      const [isLoggedIn, setIsLoggedIn] = React.useState(false);
      const [studentMode, setStudentMode] = React.useState(null);
      const [selectedIndex, setSelectedIndex] = React.useState(0);
      const [userAnswers, setUserAnswers] = React.useState({});

      const [dashboard, setDashboard] = React.useState({ students: [], ideas: [], questions: [], submissions: [], problemProgress: [], activeSessionCode: '', isSessionActive: false, isSubmissionClosed: false, announcement: '', announcementTime: '' });
      const [showHint, setShowHint] = React.useState(true);
      const [enlargedImg, setEnlargedImg] = React.useState(null);
      const [cooldown, setCooldown] = React.useState(false);

      const [isTeacher, setIsTeacher] = React.useState(false);
      const [showTeacherModal, setShowTeacherModal] = React.useState(false);
      const [teacherPw, setTeacherPw] = React.useState('');
      const [teacherEmail, setTeacherEmail] = React.useState('');
      const [busy, setBusy] = React.useState(false);
      const [booting, setBooting] = React.useState(true);
      const answersRef = React.useRef({});
      const draftTimer = React.useRef(null);
      const draftQueue = React.useRef(Promise.resolve());
      const draftVersion = React.useRef(0);
      const dashboardRequest = React.useRef(0);
      const alive = React.useRef(true);
      const [announcementDraft, setAnnouncementDraft] = React.useState('');
      const [announcementPopup, setAnnouncementPopup] = React.useState(null);
      const [classSessions, setClassSessions] = React.useState([]);

      // 최종 제출 및 정오표 / 수정 사유 상태
      const [hasSubmitted, setHasSubmitted] = React.useState(false);
      const [showResultModal, setShowResultModal] = React.useState(false);
      const [showEditReasonModal, setShowEditReasonModal] = React.useState(false);
      const [editReason, setEditReason] = React.useState('');
      const [gradingData, setGradingData] = React.useState({ results: {}, correctCount: 0 });

      // 커스텀 알림 및 확인 모달 상태
      const [toast, setToast] = React.useState(null);
      const [confirmDialog, setConfirmDialog] = React.useState(null);

      // 학생 중복 표시 방지를 위한 유일 학생 추출 함수
      const getUniqueStudents = (studentsArr) => {
        if (!Array.isArray(studentsArr)) return [];
        const map = {};
        studentsArr.forEach(s => {
          if (s && s.name) {
            const trimmedName = String(s.name).trim();
            if (trimmedName) {
              map[trimmedName] = s;
            }
          }
        });
        return Object.values(map);
      };

      const safeStudents = getUniqueStudents(dashboard?.students);
      const safeIdeas = Array.isArray(dashboard?.ideas) ? dashboard.ideas : [];
      const safeQuestions = Array.isArray(dashboard?.questions) ? dashboard.questions : [];
      const safeSubmissions = Array.isArray(dashboard?.submissions) ? dashboard.submissions : [];

      const currentProblem = problemsData[selectedIndex] || problemsData[0];
      const getInlineImageMarkup = () => '';
      const currentProblemImageMarkup = getInlineImageMarkup(currentProblem.image);

      const showToastMessage = (message, type = 'info') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
      };

      const reportError = (error) => showToastMessage(error?.message || '요청을 처리하지 못했습니다.', 'error');
      const restoreStudent = (participant, answers = {}, submission = null) => {
        try {
          const cached = JSON.parse(localStorage.getItem(answerStorageKey(participant.name, participant.code)) || 'null');
          if (cached && typeof cached === 'object' && !Array.isArray(cached)) answers = cached;
        } catch {}
        setStudentName(participant.name);
        setSessionCode(participant.code);
        sessionStorage.setItem('student_name', participant.name);
        sessionStorage.setItem('session_code', participant.code);
        setUserAnswers(answers);
        answersRef.current = answers;
        setHasSubmitted(Boolean(submission));
        if (submission) setGradingData(submission);
        setIsLoggedIn(true);
        setIsTeacher(false);
        setStudentMode(null);
      };
      const fetchDashboard = async () => {
        const request = ++dashboardRequest.current;
        try {
          const data = await backend.getDashboard();
          if (!alive.current || request !== dashboardRequest.current) return;
          setDashboard(data);
          const code = sessionStorage.getItem('session_code');
          if (code && (!data.isSessionActive || data.activeSessionCode !== code)) {
            handleSessionTerminated('교사에 의해 수업이 종료되었습니다.');
          }
        } catch (error) { reportError(error); }
      };
      const loadClassSessions = async () => {
        try { setClassSessions(await backend.listSessions()); }
        catch (error) { reportError(error); }
      };
      React.useEffect(() => {
        if (!isLoggedIn || isTeacher || !sessionCode || !dashboard.announcement || !dashboard.announcementAt) return;
        const key = `${sessionCode}:${dashboard.announcementAt}`;
        const storageKey = `math-classroom:seen-announcement:${sessionCode}`;
        if (sessionStorage.getItem(storageKey) !== key && announcementPopup?.key !== key) {
          setAnnouncementPopup({ key, storageKey, message: dashboard.announcement });
        }
      }, [isLoggedIn, isTeacher, sessionCode, dashboard.announcement, dashboard.announcementAt, announcementPopup?.key]);
      React.useEffect(() => {
        alive.current = true;
        let unsubscribe = () => {};
        (async () => {
          try {
            const context = await backend.restoreContext();
            if (!alive.current) return;
            if (context?.role === 'teacher') { setIsTeacher(true); await loadClassSessions(); }
            if (context?.participant) {
              restoreStudent(context.participant, context.answers, context.submission);
            } else {
              sessionStorage.removeItem('student_name');
              sessionStorage.removeItem('session_code');
            }
            await fetchDashboard();
            unsubscribe = backend.subscribe(() => fetchDashboard());
          } catch (error) { reportError(error); }
          finally { if (alive.current) setBooting(false); }
        })();
        return () => { alive.current = false; unsubscribe(); clearTimeout(draftTimer.current); };
      }, []);

      const handleSessionTerminated = (reason) => {
        clearTimeout(draftTimer.current);
        clearStudentAnswerCache(localStorage, sessionStorage.getItem('student_name') || studentName, sessionStorage.getItem('session_code') || sessionCode);
        sessionStorage.removeItem('student_name');
        sessionStorage.removeItem('session_code');
        backend.leaveClass();
        setIsLoggedIn(false);
        setStudentMode(null);
        setSessionCode('');
        setUserAnswers({});
        answersRef.current = {};
        setHasSubmitted(false);
        setSelectedIndex(0);
        setAnnouncementPopup(null);
        showToastMessage(reason, 'warning');
      };
      const teacherAction = async (create) => {
        if (busy) return;
        setBusy(true);
        try {
          await backend.loginTeacher(teacherEmail.trim(), teacherPw);
          clearTimeout(draftTimer.current);
          sessionStorage.removeItem('student_name');
          sessionStorage.removeItem('session_code');
          setIsLoggedIn(false);
          if (create) {
            const result = await backend.createSession(problemSetId);
            showToastMessage(`수업을 개설했습니다. 코드: ${result.code}`, 'success');
          }
          setIsTeacher(true);
          await loadClassSessions();
          setShowTeacherModal(false);
          setTeacherPw('');
          await fetchDashboard();
        } catch (error) { reportError(error); }
        finally { setBusy(false); }
      };
      const handleCreateSession = () => teacherAction(true);
      const handleOpenTeacherDashboard = () => teacherAction(false);
      const handleTeacherLogout = async () => {
        try {
          await backend.logoutTeacher();
          setIsTeacher(false);
          setClassSessions([]);
          setDashboard(await backend.getDashboard());
        } catch (error) { reportError(error); }
      };
      const confirmAction = (title, message, action, options = {}) => setConfirmDialog({
        title, message, isBlockSubmit: false, ...options,
        onConfirm: async () => {
          if (busy) return;
          setBusy(true);
          try { await action(); setConfirmDialog(null); await fetchDashboard(); }
          catch (error) { reportError(error); }
          finally { setBusy(false); }
        }
      });
      const handleEndSession = () => confirmAction('수업 마침 확인', '수업을 종료하면 학생은 더 이상 입력하거나 제출할 수 없습니다. 수업을 마치시겠습니까?', async () => {
        await backend.endSession();
        await loadClassSessions();
        showToastMessage('수업을 종료했습니다.', 'success');
      });
      const handleDownloadResults = async sessionId => {
        try {
          const results = await backend.getSessionResults(sessionId);
          const count = results.session.problem_set_id === problemSetId || results.session.problem_set_id === 'propositions-v1'
            ? problemsData.length
            : results.students.find(student => student.submission)?.submission.problem_count || 13;
          downloadResultsCsv(results, count);
          showToastMessage('수업 결과 CSV를 다운로드했습니다.', 'success');
        } catch (error) { reportError(error); }
      };
      const handleDeletePastSession = classSession => confirmAction(
        '이전 수업 자료 영구 삭제',
        `${new Date(classSession.created_at).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })} · ${classSession.code} 수업의 학생, 답안, 제출 결과, 질문, 아이디어, 개념학습 기록을 모두 삭제합니다. 복구할 수 없습니다. 필요한 CSV를 먼저 다운로드하셨나요?`,
        async () => {
          await backend.deleteSession(classSession.id);
          await loadClassSessions();
          showToastMessage('선택한 이전 수업 자료를 삭제했습니다.', 'success');
        },
        { destructive: true, confirmText: '영구 삭제' },
      );
      const handleSubmissionDeadline = () => {
        const closing = !dashboard.isSubmissionClosed;
        confirmAction(closing ? '최종 제출 마감' : '최종 제출 재개', closing ? '최종 제출과 재제출을 마감하시겠습니까?' : '최종 제출을 다시 허용하시겠습니까?', async () => {
          await backend.setDeadline(closing);
          showToastMessage(closing ? '최종 제출을 마감했습니다.' : '최종 제출을 재개했습니다.', 'success');
        });
      };
      const sendAnnouncement = async (rawMessage) => {
        const message = String(rawMessage || '').trim();
        if (!message) return showToastMessage('공지 내용을 입력해주세요.', 'warning');
        try { await backend.announce(message); setAnnouncementDraft(''); await fetchDashboard(); showToastMessage('공지했습니다.', 'success'); }
        catch (error) { reportError(error); }
      };
      const handlePostAnnouncement = () => sendAnnouncement(announcementDraft);
      const handleTenMinuteNotice = () => sendAnnouncement('수업 종료 10분 전입니다. 현재 답안으로 최종 제출해주세요.');
      const handleUnsubmittedReminder = () => sendAnnouncement('아직 최종 제출하지 않은 학생은 현재 답안으로 최종 제출해주세요. 미응답 문항도 제출할 수 있습니다.');
      const handleLogin = async (event) => {
        event.preventDefault();
        if (busy) return;
        const code = inputCode.trim();
        const identity = Object.fromEntries(Object.entries(studentIdentity).map(([key, value]) => [key, Number(value)]));
        if (!/^\d{6}$/.test(code)) return showToastMessage('6자리 수업 코드를 입력해주세요.', 'warning');
        if (!Number.isInteger(identity.grade) || identity.grade < 1 || identity.grade > 12 ||
            !Number.isInteger(identity.classNumber) || identity.classNumber < 1 || identity.classNumber > 99 ||
            !Number.isInteger(identity.studentNumber) || identity.studentNumber < 1 || identity.studentNumber > 99) return showToastMessage('학년·반·번호를 확인해주세요.', 'warning');
        if (!guideChecks.every(Boolean)) return showToastMessage('활동 안내의 네 항목을 모두 확인해주세요.', 'warning');
        setBusy(true);
        try {
          const context = await backend.joinClass(code, identity);
          const name = context.participant.name;
          // 같은 브라우저에서 저장하지 못했던 최신 입력도 복원합니다.
          let cached = null;
          try { cached = JSON.parse(localStorage.getItem(answerStorageKey(name, code)) || 'null'); } catch {}
          const answers = cached && Object.keys(cached).length ? cached : context.answers;
          restoreStudent(context.participant, answers || {}, context.submission);
          setSelectedIndex(0);
          await fetchDashboard();
          showToastMessage(`${name} 학생, 환영합니다!`, 'success');
        } catch (error) { reportError(error); }
        finally { setBusy(false); }
      };
      const queueDraft = () => {
        const answers = structuredClone(answersRef.current);
        const version = draftVersion.current;
        // 이전 저장이 끝난 뒤 다음 저장을 보내어 응답 순서가 뒤바뀌지 않게 합니다.
        draftQueue.current = draftQueue.current.catch(() => {}).then(() => backend.saveDraft(answers));
        return draftQueue.current.then(() => {
          if (version === draftVersion.current) return fetchDashboard();
        });
      };
      const handleStudentLeave = () => confirmAction('수업 나가기', '현재 입력을 서버에 저장한 뒤, 이 기기에 저장된 내 답안 캐시를 삭제하고 수업에서 나가시겠습니까? 서버의 제출 기록은 유지됩니다.', async () => {
        clearTimeout(draftTimer.current);
        await queueDraft();
        handleSessionTerminated('수업을 마쳤습니다. 수고하셨습니다!');
      });
      const handleInputChange = (field, value) => {
        const current = answersRef.current[currentProblem.id] || { mode: '답', answer: '', question: '', idea: '' };
        const updated = { ...current, [field]: value };
        updated.isComplete = isProblemComplete(currentProblem, updated);
        const answers = { ...answersRef.current, [currentProblem.id]: updated };
        answersRef.current = answers;
        draftVersion.current += 1;
        setUserAnswers(answers);
        localStorage.setItem(answerStorageKey(studentName, sessionCode), JSON.stringify(answers));
        clearTimeout(draftTimer.current);
        draftTimer.current = setTimeout(() => queueDraft().catch(reportError), 600);
      };
      const submitRealtime = async (type) => {
        if (cooldown) return showToastMessage('3초 후 다시 시도해주세요.', 'warning');
        const content = String(userAnswers[currentProblem.id]?.[type] || '').trim();
        if (!content) return showToastMessage('내용을 입력해주세요.', 'warning');
        setCooldown(true);
        try { await backend.post(type, content, currentProblem.id); await fetchDashboard(); showToastMessage('등록했습니다.', 'success'); }
        catch (error) { reportError(error); }
        finally { setTimeout(() => setCooldown(false), 3000); }
      };
      const submitReply = async (id, content) => {
        if (!content.trim()) return;
        try { await backend.reply(id, content); await fetchDashboard(); showToastMessage('답변을 등록했습니다.', 'success'); }
        catch (error) { reportError(error); }
      };
      const handleDelete = (sheetName, id) => confirmAction('항목 삭제', '이 항목을 게시판에서 삭제하시겠습니까?', async () => {
        await backend.remove(sheetName === '아이디어_공유' ? 'idea' : 'question', id);
      });
      const handleFinalSubmit = () => {
        if (busy) return;
        if (dashboard.isSubmissionClosed) return showToastMessage('교사가 최종 제출을 마감했습니다.', 'warning');
        if (hasSubmitted) return setShowEditReasonModal(true);
        const unanswered = problemsData.filter(problem => !problem.choices.some(choice => choice.id === userAnswers[problem.id]?.answer)).length;
        const incompleteBlanks = problemsData.filter(problem =>
          problem.choices.some(choice => choice.id === userAnswers[problem.id]?.answer) && !isProblemComplete(problem, userAnswers[problem.id])).length;
        const notice = [
          unanswered && `답을 선택하지 않은 ${unanswered}문항은 오답 처리됩니다.`,
          incompleteBlanks && `풀이 빈칸을 다 채우지 않은 ${incompleteBlanks}문항은 미완료로 표시되지만 선택한 답은 채점됩니다.`,
        ].filter(Boolean).join(' ');
        setConfirmDialog({ title: '최종 제출 확인', message: `${notice} 현재 답안으로 제출하시겠습니까?`.trim(), isBlockSubmit: false, onConfirm: () => performSubmission('') });
      };
      const performSubmission = async (reason = '') => {
        if (busy) return;
        setBusy(true);
        clearTimeout(draftTimer.current);
        try {
          await queueDraft();
          const grade = await backend.submit(answersRef.current, reason);
          setGradingData(grade);
          setHasSubmitted(true);
          localStorage.setItem(submissionStorageKey(studentName, sessionCode), 'true');
          setShowEditReasonModal(false);
          setConfirmDialog(null);
          setShowResultModal(true);
          await fetchDashboard();
          showToastMessage('최종 답안을 저장하고 채점했습니다.', 'success');
        } catch (error) { reportError(error); }
        finally { setBusy(false); }
      };
      const handleConceptLearningFinish = async (ids, lessonSet) => {
        const names = ids.map(id => conceptLearningData.concepts.find(c => c.id === id)?.label || id);
        try { await backend.saveConcepts(names, lessonSet); setStudentMode(null); showToastMessage('개념학습 기록을 저장했습니다.', 'success'); }
        catch (error) { reportError(error); }
      };

      const completedCount = problemsData.filter(problem => isProblemComplete(problem, userAnswers[problem.id])).length;
      const progressPercent = Math.round((completedCount / problemsData.length) * 100);
      const submittedCount = safeStudents.filter(s => s && s.status === '제출완료').length;
      const averageProgress = safeStudents.length
        ? Math.round(safeStudents.reduce((sum, student) => sum + (Number(student.progress) || 0), 0) / safeStudents.length)
        : 0;
      const submissionMap = safeSubmissions.reduce((map, submission) => {
        if (submission && submission.name) map[submission.name] = submission;
        return map;
      }, {});
      const unsubmittedStudents = safeStudents.filter(student => student.status !== '제출완료');
      const completedByProblem = (Array.isArray(dashboard.problemProgress) ? dashboard.problemProgress : []).reduce((map, item) => {
        map[String(item.problemId)] = Number(item.completed) || 0;
        return map;
      }, {});
      const problemAnalysis = problemsData.map(problem => {
        const completed = completedByProblem[String(problem.id)] || 0;
        const incorrect = safeSubmissions.filter(submission => submission.results && submission.results[problem.id] === 'X').length;
        return { id: problem.id, title: problem.title, completed, pending: Math.max(0, safeStudents.length - completed), incorrect };
      }).sort((left, right) => right.pending - left.pending || right.incorrect - left.incorrect || left.id - right.id);

      const announcementDialog = announcementPopup && (
        <div role="dialog" aria-modal="true" aria-label="선생님 안내" className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border-2 border-indigo-200">
            <h2 className="text-lg font-black text-indigo-950 mb-3">📣 선생님 안내</h2>
            <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed mb-6">{announcementPopup.message}</p>
            <button className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3" onClick={() => {
              sessionStorage.setItem(announcementPopup.storageKey, announcementPopup.key);
              setAnnouncementPopup(null);
            }}>확인했습니다</button>
          </div>
        </div>
      );

      if (booting) return <div className="p-12 text-center">수업 정보를 불러오고 있습니다…</div>;
      // 교사 전용 실시간 모니터링 화면
      if (isTeacher && !isLoggedIn) {
        return (
          <div className="min-h-screen bg-slate-100 text-slate-800">
            <header className="bg-indigo-950 text-white px-6 py-4 shadow-lg">
              <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-indigo-300 mb-1">TEACHER MONITORING</div>
                  <h1 className="text-xl font-black">📊 실시간 수업 모니터링</h1>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                  {dashboard.isSessionActive ? (
                    <span className="bg-emerald-500/20 border border-emerald-400/50 text-emerald-200 px-3 py-2 rounded-xl">
                      수업 코드 <strong className="text-white text-base tracking-widest ml-1">{dashboard.activeSessionCode}</strong>
                    </span>
                  ) : (
                    <span className="bg-amber-500/20 border border-amber-400/50 text-amber-200 px-3 py-2 rounded-xl">진행 중인 수업 없음</span>
                  )}
                  <button onClick={() => { fetchDashboard(); loadClassSessions(); }} className="bg-indigo-800 hover:bg-indigo-700 px-3 py-2 rounded-xl">🔄 새로고침</button>
                  <button disabled={busy} onClick={handleCreateSession} className="bg-blue-600 hover:bg-blue-500 px-3 py-2 rounded-xl">＋ 새 수업</button>
                  {dashboard.isSessionActive && (
                    <button onClick={handleEndSession} className="bg-rose-600 hover:bg-rose-500 px-3 py-2 rounded-xl">🛑 수업 종료</button>
                  )}
                  <button onClick={handleTeacherLogout} className="bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-xl">나가기</button>
                </div>
              </div>
            </header>

            <main className="max-w-7xl mx-auto p-4 md:p-6 space-y-4">
              <section className="bg-white border rounded-2xl p-4 shadow-sm">
                <h2 className="font-black text-sm mb-2">📁 수업별 자료 관리</h2>
                <p className="text-xs text-slate-500 mb-3">진행 중·종료된 수업의 최신 최종 제출 결과를 CSV로 내려받습니다. 종료된 수업만 영구 삭제할 수 있으니 필요한 CSV를 먼저 보관하세요.</p>
                {classSessions.length === 0 ? <p className="text-xs text-slate-500">아직 수업 기록이 없습니다.</p> : (
                  <div className="space-y-2">
                    {classSessions.map(classSession => (
                      <div key={classSession.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-2">
                        <span className="text-xs font-semibold text-slate-700">{new Date(classSession.created_at).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })} · {classSession.code} · {classSession.status === 'ACTIVE' ? '진행 중' : '종료'}</span>
                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => handleDownloadResults(classSession.id)} className="text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 px-3 py-2 rounded-xl">CSV 다운로드</button>
                          {classSession.status === 'ENDED' && (
                            <button onClick={() => handleDeletePastSession(classSession)} disabled={busy} className="text-xs font-bold bg-rose-50 hover:bg-rose-100 disabled:opacity-50 text-rose-700 border border-rose-200 px-3 py-2 rounded-xl">이전 자료 삭제</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
              <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white border rounded-2xl p-4 shadow-sm">
                  <div className="text-xs text-slate-500 font-bold">참여 학생</div>
                  <div className="text-2xl font-black text-indigo-700 mt-1">{safeStudents.length}<span className="text-xs ml-1">명</span></div>
                </div>
                <div className="bg-white border rounded-2xl p-4 shadow-sm">
                  <div className="text-xs text-slate-500 font-bold">평균 진행률</div>
                  <div className="text-2xl font-black text-blue-600 mt-1">{averageProgress}<span className="text-xs ml-1">%</span></div>
                </div>
                <div className="bg-white border rounded-2xl p-4 shadow-sm">
                  <div className="text-xs text-slate-500 font-bold">최종 제출</div>
                  <div className="text-2xl font-black text-emerald-600 mt-1">{submittedCount}<span className="text-xs ml-1">명</span></div>
                </div>
                <div className="bg-white border rounded-2xl p-4 shadow-sm">
                  <div className="text-xs text-slate-500 font-bold">미답변 질문</div>
                  <div className="text-2xl font-black text-amber-600 mt-1">{safeQuestions.filter(q => !q.reply).length}<span className="text-xs ml-1">개</span></div>
                </div>
              </section>

              <section className="grid grid-cols-1 xl:grid-cols-12 gap-4">
                <div className="xl:col-span-7 bg-white border rounded-2xl p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div>
                      <h2 className="font-black text-sm">📣 수업 마무리 관리</h2>
                      <p className="text-[11px] text-slate-500 mt-1">공지와 제출 상태를 실시간으로 반영합니다. 연결 복구를 위해 30초마다 다시 확인합니다.</p>
                    </div>
                    <button
                      onClick={handleSubmissionDeadline}
                      disabled={!dashboard.isSessionActive}
                      className={`px-3 py-2 rounded-xl text-xs font-black disabled:opacity-40 ${dashboard.isSubmissionClosed ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-rose-600 hover:bg-rose-700 text-white'}`}
                    >
                      {dashboard.isSubmissionClosed ? '🔓 최종 제출 재개' : '🔒 최종 제출 마감'}
                    </button>
                  </div>
                  <div className={`text-xs font-bold rounded-lg px-3 py-2 mb-3 ${dashboard.isSubmissionClosed ? 'bg-rose-50 text-rose-700 border border-rose-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
                    현재 상태: {dashboard.isSubmissionClosed ? '최종 제출 마감 — 학생은 새 제출과 재제출을 할 수 없습니다.' : '최종 제출 가능'}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={announcementDraft}
                      onChange={event => setAnnouncementDraft(event.target.value)}
                      onKeyDown={event => { if (event.key === 'Enter') handlePostAnnouncement(); }}
                      placeholder="예: 수업 종료 10분 전입니다. 현재 답안으로 최종 제출해주세요."
                      className="flex-1 border rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                    <button onClick={handlePostAnnouncement} disabled={!dashboard.isSessionActive} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl px-3 py-2 text-xs font-black">공지 보내기</button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <button onClick={handleTenMinuteNotice} disabled={!dashboard.isSessionActive} className="text-[11px] font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 disabled:opacity-40 px-2.5 py-1.5 rounded-lg">⏱️ 종료 10분 전 안내</button>
                    <button onClick={handleUnsubmittedReminder} disabled={!dashboard.isSessionActive || unsubmittedStudents.length === 0} className="text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 disabled:opacity-40 px-2.5 py-1.5 rounded-lg">🔔 미제출자 제출 안내</button>
                  </div>
                  {dashboard.announcement && <p className="mt-2 text-[11px] text-slate-500">최근 공지: {dashboard.announcement} {dashboard.announcementTime && `(${dashboard.announcementTime})`}</p>}
                </div>

                <div className="xl:col-span-5 bg-white border rounded-2xl shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b flex items-center justify-between">
                    <h2 className="font-black text-sm">⚠️ 미제출자 목록</h2>
                    <span className="text-xs font-black text-rose-600">{unsubmittedStudents.length}명</span>
                  </div>
                  <div className="p-3 max-h-36 overflow-y-auto text-xs">
                    {unsubmittedStudents.length === 0 ? (
                      <div className="text-emerald-700 bg-emerald-50 rounded-lg p-2 font-bold">모든 참여 학생이 최종 제출했습니다.</div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {unsubmittedStudents.map(student => <span key={student.name} className="bg-rose-50 text-rose-800 border border-rose-100 px-2 py-1 rounded-lg font-bold">{student.name} · {student.solved}/{problemsData.length}</span>)}
                      </div>
                    )}
                  </div>
                </div>
              </section>

              <section className="bg-white border rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="font-black text-sm">🔎 문항별 막힘 분석</h2>
                    <p className="text-[11px] text-slate-500 mt-1">미완료 학생이 많은 문항부터 표시합니다. 오답 수는 최종 제출한 학생 기준입니다.</p>
                  </div>
                  <span className="text-[11px] text-slate-500">참여 학생 {safeStudents.length}명</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-slate-500"><tr><th className="text-left px-4 py-3">문항</th><th className="text-center px-4 py-3">풀이 완료</th><th className="text-center px-4 py-3">막힘/미완료</th><th className="text-center px-4 py-3">최종 오답</th><th className="px-4 py-3">진행 분포</th></tr></thead>
                    <tbody className="divide-y">
                      {problemAnalysis.map(item => (
                        <tr key={item.id} className={item.pending > 0 ? 'bg-amber-50/40' : ''}>
                          <td className="px-4 py-3 font-bold whitespace-nowrap">Q{item.id}. {item.title}</td>
                          <td className="px-4 py-3 text-center text-emerald-700 font-black">{item.completed}명</td>
                          <td className={`px-4 py-3 text-center font-black ${item.pending > 0 ? 'text-amber-700' : 'text-slate-400'}`}>{item.pending}명</td>
                          <td className="px-4 py-3 text-center text-rose-600 font-black">{item.incorrect}명</td>
                          <td className="px-4 py-3 min-w-40"><div className="h-2 bg-slate-200 rounded-full overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${safeStudents.length ? Math.round((item.completed / safeStudents.length) * 100) : 0}%` }}></div></div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="grid grid-cols-1 xl:grid-cols-12 gap-4">
                <div className="xl:col-span-12 lg:col-span-8 bg-white border rounded-2xl shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b flex items-center justify-between">
                    <h2 className="font-black text-sm">학생별 진행 및 제출 현황</h2>
                    <span className="text-[11px] text-slate-500">실시간 자동 갱신</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 text-slate-500">
                        <tr>
                          <th className="text-left px-4 py-3">학생</th>
                          <th className="text-left px-4 py-3">진행률</th>
                          <th className="text-center px-4 py-3">해결</th>
                          <th className="text-center px-4 py-3">상태</th>
                          <th className="text-center px-4 py-3">점수</th>
                          <th className="text-left px-4 py-3">최근 활동</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {safeStudents.length === 0 && (
                          <tr><td colSpan="6" className="text-center py-10 text-slate-400">참여한 학생이 없습니다.</td></tr>
                        )}
                        {safeStudents.map(student => {
                          const submission = submissionMap[student.name];
                          return (
                            <tr key={student.name} className="hover:bg-slate-50">
                              <td className="px-4 py-3 font-bold whitespace-nowrap">{student.name}</td>
                              <td className="px-4 py-3 min-w-44">
                                <div className="flex justify-between mb-1"><span>{student.progress}%</span></div>
                                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                                  <div className="h-full bg-blue-600" style={{ width: `${student.progress}%` }}></div>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center font-semibold">{student.solved}/{problemsData.length}</td>
                              <td className="px-4 py-3 text-center">
                                <span className={`px-2 py-1 rounded-full font-bold ${student.status === '제출완료' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                  {student.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center font-black text-indigo-700">{submission ? submission.score : '-'}</td>
                              <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{student.time || '-'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="xl:col-span-12 lg:col-span-4 space-y-4">
                  <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b font-black text-sm">❓ 질문 및 답변</div>
                    <div className="max-h-72 overflow-y-auto p-3 space-y-2">
                      {safeQuestions.length === 0 && <div className="text-xs text-slate-400 text-center py-6">등록된 질문이 없습니다.</div>}
                      {safeQuestions.map(question => (
                        <div key={question.id} className="bg-slate-50 border rounded-xl p-3 text-[13.333px]">
                          <div className="flex justify-between gap-2 mb-1">
                            <strong>{question.name}</strong>
                            <button onClick={() => handleDelete('질문_답글', question.id)} className="text-rose-500 font-bold">삭제</button>
                          </div>
                          <p className="text-slate-700 mb-2">{question.content}</p>
                          {question.reply ? (
                            <div className="bg-blue-50 text-blue-900 rounded-lg p-2"><strong>답변:</strong> {question.reply}</div>
                          ) : (
                            <input
                              type="text"
                              placeholder="답변 입력 후 Enter"
                              onKeyDown={event => {
                                if (event.key === 'Enter') {
                                  submitReply(question.id, event.currentTarget.value);
                                  event.currentTarget.value = '';
                                }
                              }}
                              className="w-full border rounded-lg p-2 outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b font-black text-sm">💡 공유 아이디어</div>
                    <div className="max-h-64 overflow-y-auto p-3 space-y-2">
                      {safeIdeas.length === 0 && <div className="text-xs text-slate-400 text-center py-6">공유된 아이디어가 없습니다.</div>}
                      {safeIdeas.map(idea => (
                        <div key={idea.id} className="flex gap-2 bg-amber-50 border border-amber-100 rounded-xl p-3 text-[13.333px]">
                          <span className="bg-amber-400 text-amber-950 h-fit px-1.5 py-0.5 rounded font-black">Q{idea.problemId || '-'}</span>
                          <div className="flex-1"><strong>{idea.name}</strong><p className="mt-1 text-slate-700">{idea.content}</p></div>
                          <button onClick={() => handleDelete('아이디어_공유', idea.id)} className="text-rose-500 font-bold h-fit">✕</button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            </main>

            {confirmDialog && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white p-6 rounded-2xl w-80 text-center shadow-xl border">
                  <h3 className="font-bold text-sm mb-2">{confirmDialog.title}</h3>
                  <p className="text-xs text-slate-600 mb-5 leading-relaxed">{confirmDialog.message}</p>
                  <div className="flex gap-2 text-xs font-bold">
                    <button onClick={() => setConfirmDialog(null)} className="flex-1 bg-slate-200 py-2 rounded-xl">취소</button>
                    <button onClick={confirmDialog.onConfirm} className="flex-1 bg-blue-600 text-white py-2 rounded-xl">확인</button>
                  </div>
                </div>
              </div>
            )}
            {toast && (
              <div className={`fixed bottom-5 right-5 text-xs px-4 py-3 rounded-xl shadow-2xl text-white font-bold ${toast.type === 'error' ? 'bg-red-600' : toast.type === 'warning' ? 'bg-amber-600' : toast.type === 'success' ? 'bg-emerald-600' : 'bg-slate-800'}`}>
                {toast.message}
              </div>
            )}
          </div>
        );
      }

      // 학생은 코드 로그인 후 원하는 학습 기능을 선택합니다.
      if (isLoggedIn && !studentMode) {
        return (
          <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
            <div className="w-full max-w-3xl">
              <div className="text-center mb-6">
                <div className="inline-flex bg-indigo-100 text-indigo-800 text-xs font-black px-3 py-1 rounded-full mb-3">수업 코드 {sessionCode}</div>
                <h1 className="text-2xl font-black text-indigo-950">어떤 학습을 시작할까요?</h1>
                <p className="text-sm text-slate-600 mt-2">{studentName}님, 오늘의 학습 기능을 선택하세요.</p>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <button onClick={() => setStudentMode('problem')} className="text-left bg-white hover:border-blue-400 hover:shadow-md border rounded-2xl p-6 transition group">
          <div className="text-3xl mb-3">🧩</div><h2 className="font-black text-lg text-slate-900 group-hover:text-blue-700">문제풀이</h2><p className="text-sm text-slate-600 mt-2 leading-relaxed">명제와 증명 {problemsData.length}개 문항에서 4지선다 답과 풀이 빈칸을 작성하고, 질문·아이디어 공유와 최종 제출을 진행합니다.</p><span className="inline-block mt-5 text-xs font-black text-blue-700">문제풀이 시작 →</span>
                </button>
                <button onClick={() => setStudentMode('concept')} className="text-left bg-white hover:border-indigo-400 hover:shadow-md border rounded-2xl p-6 transition group">
          <div className="text-3xl mb-3">🔎</div><h2 className="font-black text-lg text-slate-900 group-hover:text-indigo-700">개념학습</h2><p className="text-sm text-slate-600 mt-2 leading-relaxed">명제와 조건 클릭형 빈칸 활동지를 열어 풀이를 단계별로 확인합니다.</p><span className="inline-block mt-5 text-xs font-black text-indigo-700">개념학습 시작 →</span>
                </button>
              </div>
              <div className="text-center mt-5"><button onClick={handleStudentLeave} className="text-xs font-bold text-slate-500 hover:text-slate-800">수업 나가기</button></div>
              {announcementDialog}
              <Notifications toast={toast} confirmDialog={confirmDialog} setConfirmDialog={setConfirmDialog} busy={busy} />
            </div>
          </div>
        );
      }

      if (isLoggedIn && studentMode === 'concept') {
        return <><PropositionConceptLearning onBack={() => setStudentMode(null)} onFinish={handleConceptLearningFinish} />{announcementDialog}<Notifications toast={toast} busy={busy} /></>;
      }

      // 시작/로그인 화면
      if (!isLoggedIn) {
        return (
          <div className="flex flex-col items-center justify-center min-h-screen bg-slate-200 p-4">
            <div className="bg-white p-6 md:p-8 rounded-2xl shadow-xl w-full max-w-2xl border text-center relative">
              <div className="flex justify-between items-center mb-6 border-b pb-4">
                <h1 className="text-xl font-black text-indigo-900 flex items-center gap-1.5">
                  📐 실시간 수학 클래스
                </h1>
                <button
                  onClick={() => setShowTeacherModal(true)}
                  className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-3 py-1.5 rounded-lg border border-indigo-200 transition"
                >
                  {isTeacher ? '👨‍🏫 교사 메뉴' : '🔒 교사 로그인'}
                </button>
              </div>

              {dashboard.isSessionActive && dashboard.activeSessionCode ? (
                <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl mb-6 text-left">
                  <div className="flex justify-between items-center text-xs font-bold text-emerald-800 mb-1">
                    <span>🟢 진행 중인 수업 코드</span>
                    {isTeacher && (
                      <button onClick={handleEndSession} className="bg-rose-600 hover:bg-rose-700 text-white px-2 py-0.5 rounded text-[11px]">
                        🛑 수업 마침 (종료)
                      </button>
                    )}
                  </div>
                  <div className="text-2xl font-black text-emerald-900 tracking-widest text-center py-1">
                    {dashboard.activeSessionCode}
                  </div>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl mb-6 text-xs text-amber-900 font-medium leading-relaxed">
                  📢 선생님이 안내한 6자리 수업 코드와 학년·반·번호를 입력해주세요.
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-3 text-left">
                <div>
                  <label htmlFor="class-code" className="block text-xs font-bold text-slate-700 mb-1">수업 코드 (6자리 숫자)</label>
                  <input
                    type="text" id="class-code" inputMode="numeric" autoComplete="off"
                    maxLength={6}
                    placeholder="교사가 제시한 6자리 코드 (예: 123456)"
                    value={inputCode}
                    onChange={e => setInputCode(e.target.value.replace(/[^0-9]/g, ''))}
                    className="w-full px-4 py-2.5 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-mono tracking-widest"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    ['grade', '학년', '1~12'],
                    ['classNumber', '반', '1~99'],
                    ['studentNumber', '번호', '1~99'],
                  ].map(([field, label, placeholder]) => (
                    <div key={field}>
                      <label htmlFor={`student-${field}`} className="block text-xs font-bold text-slate-700 mb-1">{label}</label>
                      <input type="text" inputMode="numeric" autoComplete="off" id={`student-${field}`}
                        placeholder={placeholder} value={studentIdentity[field]}
                        onChange={event => setStudentIdentity(previous => ({ ...previous, [field]: event.target.value.replace(/[^0-9]/g, '').slice(0, 2) }))}
                        className="w-full px-3 py-2.5 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                  ))}
                </div>

                <section className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mt-4 space-y-3" aria-label="수업 전 활동 안내">
                  <h2 className="font-black text-base text-indigo-950">수학 수업 활동 안내</h2>
                  <p className="text-xs text-slate-700">교과서 문제를 풀며 질문하고 풀이 아이디어를 함께 나눕니다. 각 항목을 읽고 확인해주세요.</p>
                  {activityGuide.map((item, index) => (
                    <label key={item.title} className="block bg-white border rounded-lg p-3 cursor-pointer">
                      <span className="block font-bold text-sm text-slate-900">{index + 1}. {item.title}</span>
                      <span className="block text-xs text-slate-700 mt-1 leading-relaxed">{item.body}</span>
                      <span className="flex items-center gap-2 mt-2 text-xs font-bold text-indigo-800">
                        <input type="checkbox" checked={guideChecks[index]}
                          onChange={event => setGuideChecks(previous => previous.map((checked, position) => position === index ? event.target.checked : checked))}
                          className="h-4 w-4" />
                        {index + 1}번 안내를 확인했습니다.
                      </span>
                    </label>
                  ))}
                </section>

                <button
                  type="submit" disabled={busy || !guideChecks.every(Boolean)}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold text-sm shadow transition mt-2"
                >
                  🚀 수업 시작하기
                </button>
              </form>
            </div>

            {showTeacherModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white p-6 rounded-2xl w-80 text-center shadow-xl border">
                  <h3 className="font-bold text-sm mb-1 text-slate-800">👨‍🏫 교사 로그인 & 수업 관리</h3>
                  <p className="text-xs text-slate-500 mb-4">{backend.isDemo ? '이 브라우저에서만 작동하는 체험입니다.' : '등록된 교사 이메일과 비밀번호로 로그인하세요.'}</p>

                  {!backend.isDemo && <input type="email" aria-label="교사 이메일" placeholder="교사 이메일" value={teacherEmail} onChange={e => setTeacherEmail(e.target.value)} className="w-full p-2.5 border rounded-xl mb-2 text-xs" />}
                  {!backend.isDemo && <input
                    type="password"
                    placeholder="교사 비밀번호"
                    aria-label="교사 비밀번호"
                    value={teacherPw}
                    onChange={e => setTeacherPw(e.target.value)}
                    className="w-full p-2.5 border rounded-xl mb-4 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                  />}

                  <div className="space-y-2 text-xs font-bold">
                    {true && (
                      <button
                        disabled={busy}
                        onClick={handleOpenTeacherDashboard}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl transition"
                      >
                        📊 현재 수업 모니터링
                      </button>
                    )}
                    <button
                      onClick={handleCreateSession}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl transition"
                    >
                      🎲 새 6자리 수업 코드 개설
                    </button>
                    <button
                      onClick={() => setShowTeacherModal(false)}
                      className="w-full bg-slate-200 hover:bg-slate-300 text-slate-700 py-2 rounded-xl"
                    >
                      닫기
                    </button>
                  </div>
                </div>
              </div>
            )}

            {toast && (
              <div className="fixed bottom-5 right-5 bg-slate-800 text-white text-xs px-4 py-3 rounded-xl shadow-lg">
                {toast.message}
              </div>
            )}
          </div>
        );
      }

      return (
        <div className="flex flex-col min-h-screen lg:h-screen lg:overflow-hidden">
          {/* [상단 30%] 아이디어 공유 바 */}
          <header className="min-h-24 lg:h-[30vh] shrink-0 bg-indigo-950 text-white p-3 flex flex-col shadow-md">
            <div className="flex flex-wrap gap-3 justify-between items-center text-xs">
              <div className="flex items-center gap-2">
                <span className="bg-yellow-400 text-indigo-950 font-black px-2 py-0.5 rounded">IDEA</span>
                <span className="font-bold">풀이 아이디어 실시간 공유</span>
                <span className="bg-indigo-800 text-indigo-200 px-2 py-0.5 rounded text-[11px] font-mono">
                  코드: <strong>{sessionCode}</strong>
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span>접속자: <strong className="text-green-400">{studentName}</strong></span>
                {isTeacher && (
                  <button onClick={handleEndSession} className="bg-rose-600 hover:bg-rose-700 px-2 py-1 rounded font-bold transition">
                    🛑 수업 마침
                  </button>
                )}
                <button
                  onClick={handleStudentLeave}
                  className="bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded text-slate-200 font-bold transition flex items-center gap-1 border border-slate-700"
                >
                  🚪 수업 나가기
                </button>
              </div>
            </div>

            {(dashboard.announcement || dashboard.isSubmissionClosed) && (
              <div className={`text-xs font-bold px-3 py-1.5 rounded-lg ${dashboard.isSubmissionClosed ? 'bg-rose-500 text-white' : 'bg-amber-300 text-amber-950'}`}>
                {dashboard.isSubmissionClosed ? '🔒 최종 제출이 마감되었습니다.' : `📣 선생님 공지: ${dashboard.announcement}`}
              </div>
            )}

            <div className="flex flex-wrap content-start gap-3 overflow-y-auto py-2 min-h-0 flex-1">
              {safeIdeas.length === 0 && <span className="text-xs text-indigo-300 italic">등록된 아이디어가 없습니다.</span>}
              {safeIdeas.map(item => (
                <div key={item.id} className="max-w-full bg-indigo-900 border border-indigo-700 px-3 py-1.5 rounded-lg text-[13.333px] flex items-center gap-2 shadow-sm">
                  {item.problemId && <span className="bg-yellow-400 text-indigo-950 font-extrabold px-1.5 py-0.5 rounded text-[10px]">Q{item.problemId}</span>}
                  <span className="text-yellow-300 font-bold">{item.name}:</span>
                  <span className="break-words min-w-0">{item.content}</span>
                  {isTeacher && <button onClick={() => handleDelete('아이디어_공유', item.id)} className="text-red-400 font-bold ml-1 hover:text-red-300">✕</button>}
                </div>
              ))}
            </div>
          </header>

          {/* [중앙 20%] 실시간 진행률 막대그래프 */}
          <section className="h-[20vh] shrink-0 bg-white border-b px-6 py-2 flex flex-col justify-center">
            <div className="flex justify-between items-center mb-1 text-xs font-bold text-slate-700">
              <span>📊 전체 실시간 해결 진행 상황</span>
              <span className="bg-blue-100 text-blue-800 px-3 py-0.5 rounded-full">최종 제출 완료: {submittedCount} 명</span>
            </div>

            <div className="mb-2">
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold">내 진행률 ({completedCount} / {problemsData.length})</span>
                <span className="text-blue-600 font-bold">{progressPercent}%</span>
              </div>
              <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                <div className="bg-blue-600 h-full transition-all duration-300" style={{ width: `${progressPercent}%` }}></div>
              </div>
            </div>

            <div className="flex gap-2 overflow-x-auto text-[10px] py-1">
              {safeStudents.length === 0 && <span className="text-gray-400">참여 학생 대기 중...</span>}
              {safeStudents.map((s, idx) => (
                <div key={idx} className="flex-none bg-slate-100 px-2.5 py-1 rounded border text-center">
                  <div className="font-bold text-slate-700">{s.name}</div>
                  <div className="text-blue-600 font-extrabold">{s.progress}%</div>
                </div>
              ))}
            </div>
          </section>

          {/* [하단 50%] 메인 풀이 & Q&A */}
          <main className="flex-1 min-h-0 p-4 grid grid-cols-12 gap-4 overflow-y-auto">
            {/* 메인 작업 영역 */}
            <div className="col-span-12 lg:col-span-8 bg-white rounded-2xl border p-4 flex flex-col justify-between shadow-sm overflow-y-auto">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-3 border-b">
                  <span className="text-xs text-slate-600 font-bold">모든 문항을 확인한 뒤 최종 제출하세요. 미응답도 제출할 수 있습니다.</span>
                  <button onClick={handleFinalSubmit} disabled={busy || dashboard.isSubmissionClosed} className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow transition">
                    🚀 {hasSubmitted ? '수정된 답안 재제출하기' : '전체 답안 최종 제출하기'}
                  </button>
                </div>
                {/* 문항 탭 */}
                <div className="flex gap-1 border-b pb-2 mb-3 overflow-x-auto">
                  {problemsData.map((p, idx) => {
                    const isComp = isProblemComplete(p, userAnswers[p.id]);
                    return (
                      <button
                        key={p.id}
                        onClick={() => { setSelectedIndex(idx); setShowHint(true); }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${selectedIndex === idx ? 'bg-blue-600 text-white shadow' : isComp ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                      >
                        Q{p.id} {isComp && '✓'}
                      </button>
                    );
                  })}
                </div>

                {/* 문제 내용 */}
                <div className="flex gap-4 mb-3">
                  <div className="flex-1">
                    <h3 className="font-bold text-sm text-indigo-900 mb-1">{currentProblem.title}</h3>
                    <MathText as="p" text={currentProblem.content} className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap" />
                  </div>
                  {currentProblem.image && (
                    <div className="w-28 h-20 border rounded-lg overflow-hidden cursor-pointer hover:opacity-90 bg-slate-50" onClick={() => setEnlargedImg(currentProblem.image)}>
                      {currentProblemImageMarkup ? (
                        <div className="w-full h-full" dangerouslySetInnerHTML={{ __html: currentProblemImageMarkup }} />
                      ) : (
                        <img src={currentProblem.image} alt="그림" className="w-full h-full object-contain" />
                      )}
                    </div>
                  )}
                </div>

                {/* 문제은행의 풀이 빈칸은 정답을 공개하지 않고 학생 입력으로 보관합니다. */}
                <button onClick={() => setShowHint(!showHint)} className="text-xs bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold px-3 py-1 rounded-lg mb-3 transition">
                  💡 {showHint ? '풀이 빈칸 접기' : '풀이 빈칸 펼치기'}
                </button>
                {showHint && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl mb-3 overflow-x-auto">
                    <p className="text-xs font-bold text-amber-900 mb-2">풀이 빈칸을 모두 채우면 완료로 표시됩니다. 빈칸의 정오 여부는 자동 채점하지 않습니다.</p>
                    <ProblemBlankActivity
                      problem={currentProblem}
                      values={userAnswers[currentProblem.id]?.blanks || {}}
                      onChange={(id, value) => handleInputChange('blanks', { ...answersRef.current[currentProblem.id]?.blanks, [id]: value })}
                    />
                  </div>
                )}

                {/* 답변 방식 선택 */}
                <div className="bg-slate-50 p-3 rounded-xl border text-xs">
                  <div className="font-bold text-slate-500 mb-2">답변 방식 선택:</div>
                  <div className="flex gap-4 mb-3">
                    {['질문&답', '답', '답&아이디어'].map(mode => (
                      <label key={mode} className="flex items-center gap-1 cursor-pointer font-medium">
                        <input
                          type="radio" name={`mode_${currentProblem.id}`}
                          checked={(userAnswers[currentProblem.id]?.mode || '답') === mode}
                          onChange={() => handleInputChange('mode', mode)}
                        />
                        <span>{mode}</span>
                      </label>
                    ))}
                  </div>

                  {/* 정답 번호는 Supabase 비공개 정답표와 비교합니다. */}
                  <div className="mb-3">
                    <div className="block font-semibold text-slate-600 mb-1.5 text-xs">✍️ 최종 답 선택</div>
                    <div className="grid gap-2">
                      {currentProblem.choices.map(choice => (
                        <label key={choice.id} className={`flex items-start gap-2 p-2.5 border rounded-lg cursor-pointer ${userAnswers[currentProblem.id]?.answer === choice.id ? 'border-indigo-500 bg-indigo-50' : 'bg-white hover:bg-slate-50'}`}>
                          <input type="radio" name={`answer-${currentProblem.id}`} value={choice.id}
                            checked={userAnswers[currentProblem.id]?.answer === choice.id}
                            onChange={() => handleInputChange('answer', choice.id)} className="mt-0.5" />
                          <span>{choice.id}. {choice.text}</span>
                        </label>
                      ))}
                    </div>
                    <p className="mt-2 text-[11px] text-slate-500">선택한 답만 자동 채점합니다. 풀이 빈칸이 남아 있어도 최종 제출은 가능합니다.</p>
                  </div>

                  {/* 입력 필드 */}
                  {((userAnswers[currentProblem.id]?.mode || '답') === '질문&답') && (
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <input type="text" placeholder="질문 입력 (선택)" value={userAnswers[currentProblem.id]?.question || ''} onChange={e => handleInputChange('question', e.target.value)} className="flex-1 p-2 border rounded-lg bg-white outline-none focus:ring-1 focus:ring-indigo-500" />
                        <button onClick={() => submitRealtime('question')} className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded-lg font-bold">질문 등록</button>
                      </div>
                    </div>
                  )}

                  {(userAnswers[currentProblem.id]?.mode === '답&아이디어') && (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input type="text" placeholder="공유할 아이디어 입력" value={userAnswers[currentProblem.id]?.idea || ''} onChange={e => handleInputChange('idea', e.target.value)} className="flex-1 p-2 border rounded-lg bg-white outline-none focus:ring-1 focus:ring-indigo-500" />
                        <button onClick={() => submitRealtime('idea')} className="bg-amber-500 hover:bg-amber-600 text-slate-900 px-3 py-1 rounded-lg font-bold">아이디어 공유</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-2 border-t flex justify-between items-center">
                {hasSubmitted ? (
                  <button
                    onClick={() => {
                      // 저장된 서버 채점 결과를 표시합니다.
                      setShowResultModal(true);
                    }}
                    className="bg-indigo-100 hover:bg-indigo-200 text-indigo-900 font-bold px-4 py-2 rounded-xl text-xs transition flex items-center gap-1"
                  >
                    📊 정오표 다시보기
                  </button>
                ) : <div />}
              </div>
            </div>

            {/* Q&A 게시판 */}
            <div className="col-span-12 lg:col-span-4 bg-white rounded-2xl border p-4 flex flex-col justify-between shadow-sm overflow-hidden">
              <h3 className="font-bold text-xs text-slate-700 border-b pb-2 mb-2">❓ Q&A 실시간 게시판</h3>
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {safeQuestions.length === 0 && <div className="text-xs text-slate-400 text-center py-4">등록된 질문이 없습니다.</div>}
                {safeQuestions.map(q => (
                  <div key={q.id} className="p-2.5 bg-slate-50 border rounded-xl text-[13.333px] space-y-1">
                    <div className="flex justify-between font-bold text-slate-500">
                      <span>{q.name}</span>
                      {isTeacher && <button onClick={() => handleDelete('질문_답글', q.id)} className="text-red-500 font-bold hover:underline">삭제</button>}
                    </div>
                    <p className="text-slate-800">{q.content}</p>
                    {q.reply ? (
                      <div className="bg-blue-50 border border-blue-100 p-2 rounded-lg text-blue-900 mt-1">
                        <strong className="block text-[10px] text-blue-600">
                          💬 {q.replyAuthor ? `${q.replyAuthor}님의 답변:` : '답변:'}
                        </strong>
                        {q.reply}
                      </div>
                    ) : (
                      <input
                        type="text" placeholder="답글 작성 후 Enter..."
                        onKeyDown={e => { if (e.key === 'Enter') submitReply(q.id, e.target.value); }}
                        className="w-full p-1.5 border rounded-lg text-xs mt-1 bg-white outline-none focus:ring-1 focus:ring-blue-400"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </main>

          {announcementDialog}

          {/* 정오표 및 채점 결과 모달 */}
          {showResultModal && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
              <div className="bg-white p-6 rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl border overflow-hidden">
                <div className="flex justify-between items-center pb-3 border-b mb-3">
                  <div>
                    <h3 className="font-extrabold text-base text-indigo-900 flex items-center gap-2">
                      🎯 최종 답안 정오표 및 채점 결과
                    </h3>
                    <p className="text-xs text-slate-500">제출된 답안의 정오와 점수입니다. 채점용 정답표는 이 화면에 제공하지 않습니다.</p>
                  </div>
                  <button onClick={() => setShowResultModal(false)} className="text-slate-400 hover:text-slate-700 font-bold text-lg">✕</button>
                </div>

                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-center mb-3">
                  <div className="text-xs text-indigo-700 font-bold mb-1">🎉 총 맞춘 문항 개수</div>
                  <div className="text-3xl font-black text-indigo-900">
                    {gradingData.correctCount} <span className="text-sm font-normal text-indigo-600">/ {problemsData.length} 개 정답</span>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-1 mb-4 text-xs">
                  {problemsData.map(p => {
                    const res = gradingData.results ? gradingData.results[p.id] : 'X';
                    const isO = res === 'O';
                    const userAns = selectedChoiceLabel(p, gradingData.answers?.[p.id]?.answer);
                    return (
                      <div key={p.id} className={`p-3 rounded-xl border flex items-center justify-between gap-2 ${isO ? 'bg-emerald-50/60 border-emerald-200' : 'bg-rose-50/60 border-rose-200'}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-bold text-slate-800">Q{p.id}. {p.title}</span>
                          </div>
                          <div className="text-slate-600 truncate">
                            내 답안: <span className="font-semibold text-slate-900">{userAns}</span>
                          </div>
                          {!isO && gradingData.correctAnswers?.[p.id] && (
                            <div className="text-rose-600 font-medium text-[11px] mt-0.5">
                              정답: {gradingData.correctAnswers?.[p.id] || "-"}
                            </div>
                          )}
                        </div>
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-lg flex-none ${isO ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                          {isO ? 'O' : 'X'}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-2 border-t flex gap-2 font-bold text-xs">
                  <button
                    onClick={() => {
                      setShowResultModal(false);
                      showToastMessage('답안을 수정한 후 다시 [수정된 답안 재제출하기]를 눌러주세요.', 'info');
                    }}
                    className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-900 py-3 rounded-xl shadow transition"
                  >
                    ✏️ 답안 수정하기
                  </button>
                  <button
                    onClick={() => setShowResultModal(false)}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl shadow transition"
                  >
                    ✅ 확인 완료
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 답안 수정 사유 입력 모달 */}
          {showEditReasonModal && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
              <div className="bg-white p-6 rounded-2xl w-full max-w-md shadow-2xl border text-center">
                <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-3 text-xl font-bold">
                  📝
                </div>
                <h3 className="font-bold text-base mb-1 text-slate-800">답안 수정 사유 입력</h3>
                <p className="text-xs text-slate-500 mb-4">수정한 답안을 제출하기 위해 수정 이유를 적어주세요.</p>

                <textarea
                  rows={3}
                  placeholder="수정 이유를 입력하세요 (예: 2번 문제 계산 실수 수정, 5번 답변 변경 등)"
                  value={editReason}
                  onChange={e => setEditReason(e.target.value)}
                  className="w-full p-3 border rounded-xl text-xs mb-4 outline-none focus:ring-2 focus:ring-amber-500 resize-none bg-slate-50"
                />

                <div className="flex gap-2 text-xs font-bold">
                  <button
                    onClick={() => setShowEditReasonModal(false)}
                    className="flex-1 bg-slate-200 hover:bg-slate-300 py-2.5 rounded-xl text-slate-700 transition"
                  >
                    취소
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => {
                      if (!editReason.trim()) {
                        showToastMessage('수정 이유를 입력해 주세요.', 'warning');
                        return;
                      }
                      performSubmission(editReason);
                    }}
                    className="flex-1 bg-amber-600 hover:bg-amber-700 text-white py-2.5 rounded-xl transition"
                  >
                    수정 답안 제출하기
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 그림 확대 모달 */}
          {enlargedImg && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setEnlargedImg(null)}>
              <div className="bg-white p-4 rounded-2xl max-w-2xl max-h-[90vh] shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-xs text-slate-600">이미지 확대보기</span>
                  <button onClick={() => setEnlargedImg(null)} className="font-bold text-slate-500 hover:text-black">✕</button>
                </div>
                {getInlineImageMarkup(enlargedImg) ? (
                  <div className="w-[min(90vw,42rem)] h-[min(70vh,28rem)] mx-auto" dangerouslySetInnerHTML={{ __html: getInlineImageMarkup(enlargedImg) }} />
                ) : (
                  <img src={enlargedImg} alt="확대" className="max-w-full max-h-[70vh] mx-auto object-contain rounded" />
                )}
              </div>
            </div>
          )}

          {/* 확인 및 안내 모달 */}
          {confirmDialog && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white p-6 rounded-2xl w-80 text-center shadow-xl border">
                <h3 className="font-bold text-sm mb-2 text-slate-800">{confirmDialog.title}</h3>
                <p className="text-xs text-slate-600 mb-5 leading-relaxed">{confirmDialog.message}</p>
                {confirmDialog.isBlockSubmit ? (
                  <button
                    onClick={() => setConfirmDialog(null)}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-xl text-xs transition"
                  >
                    {confirmDialog.buttonText || '문제로 돌아가기'}
                  </button>
                ) : (
                  <div className="flex gap-2 text-xs font-bold">
                    <button onClick={() => setConfirmDialog(null)} className="flex-1 bg-slate-200 hover:bg-slate-300 py-2 rounded-xl text-slate-700">취소</button>
                    <button onClick={confirmDialog.onConfirm} disabled={busy} className={`flex-1 text-white py-2 rounded-xl disabled:opacity-50 ${confirmDialog.destructive ? 'bg-rose-700 hover:bg-rose-800' : 'bg-blue-600 hover:bg-blue-700'}`}>{confirmDialog.confirmText || '확인'}</button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 알림 토스트 */}
          {toast && (
            <div className={`fixed bottom-5 right-5 text-xs px-4 py-3 rounded-xl shadow-2xl text-white font-bold transition-all transform duration-300 ${toast.type === 'error' ? 'bg-red-600' : toast.type === 'warning' ? 'bg-amber-600' : toast.type === 'success' ? 'bg-emerald-600' : 'bg-slate-800'}`}>
              {toast.message}
            </div>
          )}
        </div>
      );
    }
