export const emptyDashboard = () => ({ students: [], ideas: [], questions: [], submissions: [], problemProgress: [], activeSessionCode: '', isSessionActive: false, isSubmissionClosed: false, announcement: '', announcementTime: '', announcementAt: '' });

export function createSupabaseBackend(client) {
  let context = null;
  let channel = null;
  let timer = null;
  let fallbackTimer = null;
  let visibilityHandler = null;
  let listeners = new Set();
  const contextKey = () => `math-classroom:${client?.supabaseUrl}:class`;
  const rpc = async (name, args = {}) => {
    if (!client) throw new Error('Supabase 연결 설정이 필요합니다.');
    const { data, error } = await client.rpc(name, args);
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    return data;
  };
  const setContext = value => {
    context = value;
    if (value?.sessionId) localStorage.setItem(contextKey(), value.sessionId);
    else localStorage.removeItem(contextKey());
    connectRealtime();
    return value;
  };
  const notify = () => {
    clearTimeout(timer);
    timer = setTimeout(() => listeners.forEach(listener => listener()), 200);
  };
  function connectRealtime() {
    if (channel) { client.removeChannel(channel); channel = null; }
    if (!client || !context?.sessionId || !listeners.size) return;
    channel = client.channel(`class:${context.sessionId}`);
    for (const table of ['class_sessions', 'participants', 'submissions', 'ideas', 'questions']) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `${table === 'class_sessions' ? 'id' : 'session_id'}=eq.${context.sessionId}` }, notify);
    }
    channel.subscribe(status => { if (status === 'SUBSCRIBED') notify(); });
  }
  const api = {
    isDemo: false,
    async restoreContext() {
      if (!client) return null;
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      if (!data.session) return null;
      return setContext(await rpc('classroom_context', { p_session_id: localStorage.getItem(contextKey()) || null }));
    },
    async loginTeacher(email, password) {
      if (context?.role === 'teacher') return;
      if (!email || !password) throw new Error('교사 이메일과 비밀번호를 입력해주세요.');
      if (!client) throw new Error('Supabase 연결 설정이 필요합니다.');
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw new Error('이메일 또는 비밀번호를 확인해주세요.');
      const value = await rpc('classroom_context');
      if (value?.role !== 'teacher') {
        await client.auth.signOut();
        setContext(null);
        throw new Error('등록된 교사 계정이 아닙니다. teachers 테이블에 계정을 등록해주세요.');
      }
      setContext(value);
    },
    async logoutTeacher() {
      const { error } = await client.auth.signOut();
      if (error) throw error;
      setContext(null);
    },
    async createSession(problemSetId = 'propositions-choice-v1') {
      const result = await rpc('create_class_session', { p_problem_set_id: problemSetId });
      setContext(await rpc('classroom_context', { p_session_id: result.sessionId }));
      return result;
    },
    async joinClass(code, identity) {
      if (context?.role === 'teacher') throw new Error('교사 계정에서 로그아웃한 뒤 학생으로 입장해주세요.');
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      if (!data.session) {
        const result = await client.auth.signInAnonymously();
        if (result.error) throw new Error('학생 입장 인증에 실패했습니다. Supabase의 익명 로그인을 켜고 인증 요청 한도를 확인해주세요.');
      }
      const result = await rpc('join_class_session', {
        p_code: code,
        p_grade: identity.grade,
        p_class_number: identity.classNumber,
        p_student_number: identity.studentNumber,
      });
      return setContext(await rpc('classroom_context', { p_session_id: result.sessionId }));
    },
    leaveClass() { setContext(null); },
    async getDashboard() {
      if (!context?.sessionId) return emptyDashboard();
      const data = await rpc('classroom_dashboard', { p_session_id: context.sessionId });
      const formatTime = value => value ? new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '';
      for (const key of ['students', 'ideas', 'questions', 'submissions']) {
        data[key] = data[key].map(row => ({ ...row, time: formatTime(row.time) }));
      }
      data.announcementAt = data.announcementTime || '';
      data.announcementTime = formatTime(data.announcementTime);
      return data;
    },
    async listSessions() {
      if (context?.role !== 'teacher') throw new Error('교사 로그인 후 사용할 수 있습니다.');
      const sessions = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await client.from('class_sessions')
          .select('id,code,created_at,ended_at,status,problem_set_id')
          .order('created_at', { ascending: false }).range(offset, offset + 499);
        if (error) throw new Error(error.message);
        sessions.push(...(data || []));
        if (!data || data.length < 500) break;
      }
      return sessions;
    },
    async getSessionResults(sessionId) {
      if (context?.role !== 'teacher') throw new Error('교사 로그인 후 사용할 수 있습니다.');
      const { data: session, error: sessionError } = await client.from('class_sessions')
        .select('id,code,created_at,ended_at,status,problem_set_id')
        .eq('id', sessionId).single();
      if (sessionError || !session) throw new Error('수업 기록을 찾을 수 없습니다.');
      const { data: participants, error: participantsError } = await client.from('participants')
        .select('id,display_name,grade,class_number,student_number,solved')
        .eq('session_id', sessionId).order('display_name');
      if (participantsError) throw new Error(participantsError.message);
      const { data: submissions, error: submissionsError } = await client.from('submissions')
        .select('participant_id,answers,results,correct_count,problem_count,edit_reason,submitted_at')
        .eq('session_id', sessionId);
      if (submissionsError) throw new Error(submissionsError.message);
      const byParticipant = new Map((submissions || []).map(row => [row.participant_id, row]));
      return { session, students: (participants || []).map(row => ({ ...row, submission: byParticipant.get(row.id) || null })) };
    },
    async deleteSession(sessionId) {
      if (context?.role !== 'teacher') throw new Error('교사 로그인 후 사용할 수 있습니다.');
      return rpc('delete_past_class_session', { p_session_id: sessionId });
    },
    saveDraft(answers) { return rpc('save_student_draft', { p_session_id: context?.sessionId, p_answers: answers }); },
    submit(answers, reason) { return rpc('submit_student_answers', { p_session_id: context?.sessionId, p_answers: answers, p_reason: reason }); },
    endSession() { return rpc('manage_class_session', { p_session_id: context?.sessionId, p_action: 'end' }); },
    setDeadline(closed) { return rpc('manage_class_session', { p_session_id: context?.sessionId, p_action: closed ? 'close' : 'open' }); },
    announce(text) { return rpc('manage_class_session', { p_session_id: context?.sessionId, p_action: 'announce', p_message: text }); },
    post(type, content, problemId) { return rpc('post_class_item', { p_session_id: context?.sessionId, p_type: type, p_content: content, p_problem_id: problemId }); },
    reply(id, content) { return rpc('reply_class_question', { p_question_id: id, p_content: content }); },
    remove(type, id) { return rpc('remove_class_item', { p_session_id: context?.sessionId, p_type: type, p_id: id }); },
    saveConcepts(names, lessonSet) { return rpc('save_concept_record', { p_session_id: context?.sessionId, p_concepts: names, p_lesson_set: lessonSet }); },
    subscribe(listener) {
      listeners.add(listener);
      connectRealtime();
      // 연결이 끊기거나 이벤트가 누락되면 30초 간격 및 탭 복귀 시 상태를 복구합니다.
      if (!fallbackTimer) fallbackTimer = setInterval(notify, 30000);
      if (!visibilityHandler) {
        visibilityHandler = () => { if (document.visibilityState === 'visible') notify(); };
        document.addEventListener('visibilitychange', visibilityHandler);
      }
      return () => {
        listeners.delete(listener);
        if (!listeners.size) {
          if (channel) { client.removeChannel(channel); channel = null; }
          clearInterval(fallbackTimer); fallbackTimer = null;
          clearTimeout(timer);
          document.removeEventListener('visibilitychange', visibilityHandler); visibilityHandler = null;
        }
      };
    },
  };
  return api;
}
