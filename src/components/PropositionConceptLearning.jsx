import React from 'react';

// 첨부한 클릭형 활동지를 격리된 프레임으로 표시합니다. 학생·교사 인증 세션에는 접근할 수 없습니다.
export default function PropositionConceptLearning({ onBack, onFinish }) {
  const [saving, setSaving] = React.useState(false);
  const finish = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onFinish([], { id: 'proposition-click-note', completed: true });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 p-3 md:p-5">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white border rounded-xl p-3 mb-3 shadow-sm">
          <div>
            <h1 className="font-black text-indigo-900">명제와 조건 · 클릭형 빈칸 활동지</h1>
            <p className="text-xs text-slate-600">빈칸을 눌러 풀이를 확인하세요. 활동지 안의 정답은 스스로 확인하는 학습용입니다.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onBack} className="rounded-lg bg-slate-200 px-3 py-2 text-xs font-bold text-slate-700">선택 화면으로</button>
            <button type="button" onClick={finish} disabled={saving} className="rounded-lg bg-indigo-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">학습 완료 기록</button>
          </div>
        </div>
        <iframe
          title="명제와 조건 클릭형 빈칸 활동지"
          src={`${import.meta.env.BASE_URL}proposition-concept.html`}
          sandbox="allow-scripts allow-modals"
          className="w-full min-h-[78vh] h-[calc(100vh-9rem)] rounded-xl border bg-white shadow"
        />
      </div>
    </div>
  );
}
