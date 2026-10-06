import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { backend } from './lib/backend';
import './styles.css';

class ErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) return <div role="alert" className="m-8 p-6 bg-white rounded-2xl border"><h1 className="font-bold mb-3">화면을 열지 못했습니다.</h1><p className="text-sm mb-4">{this.state.error.message}</p><button className="bg-indigo-600 text-white p-3 rounded-xl" onClick={() => window.location.reload()}>다시 열기</button></div>;
    return this.props.children;
  }
}

function SetupScreen() {
  return <main className="max-w-xl mx-auto my-16 p-8 bg-white rounded-3xl border shadow-sm">
    <p className="text-xs text-indigo-600 font-bold">실시간 수학 클래스</p>
    <h1 className="text-2xl font-black mt-3 mb-4">수업 데이터 연결을 준비해주세요</h1>
    <p className="text-slate-600 leading-relaxed">웹 프로젝트가 준비되었습니다. Supabase 프로젝트 설정이 끝나면 교사와 학생이 서로 다른 기기에서 같은 수업에 참여할 수 있습니다.</p>
    <ol className="list-decimal ml-5 mt-6 space-y-3 text-sm text-slate-700">
      <li>프로젝트의 README에 따라 Supabase 테이블과 교사 계정을 준비합니다.</li>
      <li>로컬 .env 또는 배포 서비스 환경 변수에 프로젝트 URL과 공개 키를 넣습니다.</li>
      <li>서버를 다시 실행하거나 배포하면 로그인 화면이 열립니다.</li>
    </ol>
    <p className="mt-6 p-3 bg-indigo-50 rounded-xl text-sm">연결 없이 화면을 확인하려면 로컬 환경에서 VITE_DEMO_MODE=true로 실행하세요.</p>
  </main>;
}

createRoot(document.getElementById('root')).render(<ErrorBoundary>
  {backend.isDemo && <div role="status" className="bg-amber-100 text-amber-900 text-center py-2 text-xs font-bold">로컬 체험 · 이 브라우저에만 저장됩니다. 실제 수업용 서버에 연결되어 있지 않습니다.</div>}
  {backend.isConfigured || backend.isDemo ? <App /> : <SetupScreen />}
</ErrorBoundary>);
