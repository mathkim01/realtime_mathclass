import React from 'react';
import MathText from './MathText';
import { conceptLearningData } from '../data/concepts';
// 개념학습 화면입니다. 공통 로그인/시트 연동은 index.html과 Code.gs에서 담당합니다.
function formatSet(values) {
  return values.length ? `\\{${values.join(', ')}\\}` : '\\varnothing';
}

function setDifference(left, right) {
  return left.filter(value => !right.includes(value));
}

function parseSetAnswer(value) {
  const compact = String(value || '').replace(/\s/g, '');
  if (compact === '∅' || compact === '{}') return [];
  if (!/^\{[0-9]+(?:,[0-9]+)*\}$/.test(compact)) return null;
  const values = compact.slice(1, -1).split(',').map(Number);
  return [...new Set(values)].sort((a, b) => a - b);
}

function sameSet(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function ConceptVenn({ lessonSet, highlight = [] }) {
  const { universe, A, B } = lessonSet;
  const intersection = A.filter(value => B.includes(value));
  const aOnly = setDifference(A, B);
  const bOnly = setDifference(B, A);
  const outside = universe.filter(value => !A.includes(value) && !B.includes(value));
  const positions = {};
  aOnly.forEach((value, index) => { positions[value] = [157 + (index % 2) * 35, 132 + Math.floor(index / 2) * 42]; });
  intersection.forEach((value, index) => { positions[value] = [248, 125 + index * 44]; });
  bOnly.forEach((value, index) => { positions[value] = [338 - (index % 2) * 32, 132 + Math.floor(index / 2) * 42]; });
  const outsidePositions = [[90, 235], [140, 235], [400, 235], [445, 235]];
  outside.forEach((value, index) => { positions[value] = outsidePositions[index] || [90 + (index % 2) * 355, 105 + Math.floor(index / 2) * 65]; });

  return (
    <svg viewBox="0 0 500 290" className="w-full max-w-xl mx-auto" role="img" aria-label="전체집합 U 안의 집합 A와 B 벤다이어그램">
      <rect x="24" y="25" width="452" height="240" rx="18" fill="#f8fafc" stroke="#94a3b8" strokeWidth="2" />
      <text x="44" y="54" fill="#334155" fontSize="17" fontWeight="700">U</text>
      <circle cx="198" cy="148" r="91" fill="#dbeafe" stroke="#2563eb" strokeWidth="2.5" />
      <circle cx="298" cy="148" r="91" fill="#fce7f3" stroke="#db2777" strokeWidth="2.5" />
      <text x="153" y="78" fill="#1d4ed8" fontSize="17" fontWeight="700">A</text>
      <text x="334" y="78" fill="#be185d" fontSize="17" fontWeight="700">B</text>
      {universe.map(value => {
        const active = highlight.includes(value);
        const [x, y] = positions[value] || [60, 245];
        return (
          <g key={value}>
            <circle cx={x} cy={y} r="17" fill={active ? '#f59e0b' : '#ffffff'} stroke={active ? '#b45309' : '#94a3b8'} strokeWidth="2" opacity={highlight.length && !active ? 0.32 : 1} />
            <text x={x} y={y + 6} textAnchor="middle" fill={active ? '#ffffff' : '#0f172a'} fontSize="16" fontWeight="800" opacity={highlight.length && !active ? 0.42 : 1}>{value}</text>
          </g>
        );
      })}
    </svg>
  );
}

export default function ConceptLearning({ studentName, sessionCode, onBack, onFinish }) {
  const [lessonIndex, setLessonIndex] = React.useState(0);
  const [conceptId, setConceptId] = React.useState('element');
  const [viewedConcepts, setViewedConcepts] = React.useState(['element']);
  const [focusSet, setFocusSet] = React.useState('A');
  const [input, setInput] = React.useState('');
  const [feedback, setFeedback] = React.useState(null);
  const [elementQuestion, setElementQuestion] = React.useState(() => Math.floor(Math.random() * 3));
  const [emptyQuestion, setEmptyQuestion] = React.useState(() => Math.floor(Math.random() * conceptLearningData.emptyQuestions.length));
  const [disjointQuestion, setDisjointQuestion] = React.useState(() => Math.floor(Math.random() * conceptLearningData.disjointQuestions.length));
  const [operationStep, setOperationStep] = React.useState(0);
  const [subsetSize, setSubsetSize] = React.useState(2);
  const [disjointChoice, setDisjointChoice] = React.useState(null);
  const lessonSet = conceptLearningData.lessonSets[lessonIndex];
  const { universe, A, B } = lessonSet;
  const union = [...new Set([...A, ...B])].sort((a, b) => a - b);
  const intersection = A.filter(value => B.includes(value));
  const complementA = setDifference(universe, A);
  const areDisjoint = intersection.length === 0;
  const elementQuestions = [
    { text: `${universe.find(value => !A.includes(value))} (   ) A`, answer: '∉' },
    { text: `${B[0]} (   ) B`, answer: '∈' },
    { text: `A (   ) ${A[Math.min(1, A.length - 1)]}`, answer: '∋' }
  ];

  const chooseOtherQuestion = (setter, current, questions) => {
    const choices = questions.map((_, index) => index).filter(index => index !== current);
    setter(choices[Math.floor(Math.random() * choices.length)]);
    setInput('');
    setFeedback(null);
  };

  const selectConcept = id => {
    setConceptId(id);
    setViewedConcepts(previous => previous.includes(id) ? previous : [...previous, id]);
    setInput('');
    setFeedback(null);
    setOperationStep(0);
    setDisjointChoice(null);
    if (id === 'subset') setSubsetSize(Math.min(2, A.length));
  };

  const restartLearning = () => {
    setLessonIndex(previous => (previous + 1) % conceptLearningData.lessonSets.length);
    setConceptId('element');
    setViewedConcepts(['element']);
    setFocusSet('A');
    setInput('');
    setFeedback(null);
    setOperationStep(0);
    setDisjointChoice(null);
  };

  const activeHighlight = () => {
    if (conceptId === 'element') return focusSet === 'A' ? A : focusSet === 'B' ? B : universe;
    if (conceptId === 'subset') return focusSet === 'B' ? B : A;
    if (conceptId === 'universal') return universe;
    if (conceptId === 'union') return union;
    if (conceptId === 'intersection') return intersection;
    if (conceptId === 'complement') return complementA;
    if (conceptId === 'disjoint' && disjointChoice === 'not') return intersection;
    return [];
  };

  const currentQuestion = () => {
    if (conceptId === 'element') return { type: 'symbol', text: elementQuestions[elementQuestion].text, answer: elementQuestions[elementQuestion].answer, more: () => chooseOtherQuestion(setElementQuestion, elementQuestion, elementQuestions) };
    if (conceptId === 'empty') return { type: 'ox', text: conceptLearningData.emptyQuestions[emptyQuestion].text, answer: conceptLearningData.emptyQuestions[emptyQuestion].answer, more: () => chooseOtherQuestion(setEmptyQuestion, emptyQuestion, conceptLearningData.emptyQuestions) };
    if (conceptId === 'disjoint') return { type: 'ox', text: conceptLearningData.disjointQuestions[disjointQuestion].text, answer: conceptLearningData.disjointQuestions[disjointQuestion].answer, more: () => chooseOtherQuestion(setDisjointQuestion, disjointQuestion, conceptLearningData.disjointQuestions) };
    if (conceptId === 'subset') return { type: 'subset', text: `A의 부분집합 중 원소가 ${subsetSize}개인 집합을 하나 만드시오.`, answer: null, more: () => { setSubsetSize(previous => (previous + 1) % (A.length + 1)); setInput(''); setFeedback(null); } };
    if (conceptId === 'union') return { type: 'set', text: operationStep === 0 ? '벤다이어그램의 색칠한 부분의 원소를 모두 고르시오.' : '집합 A와 집합 B의 합집합을 원소나열법으로 표시하시오.', answer: union, more: () => { setOperationStep(1); setInput(''); setFeedback(null); } };
    if (conceptId === 'intersection') return { type: 'set', text: operationStep === 0 ? '벤다이어그램의 색칠한 부분의 원소를 모두 고르시오.' : '집합 A와 집합 B의 교집합을 원소나열법으로 표시하시오.', answer: intersection, more: () => { setOperationStep(1); setInput(''); setFeedback(null); } };
    if (conceptId === 'complement') return { type: 'set', text: operationStep === 0 ? '벤다이어그램의 색칠한 부분의 원소를 모두 고르시오.' : '집합 A의 여집합을 원소나열법으로 표시하시오.', answer: complementA, more: () => { setOperationStep(1); setInput(''); setFeedback(null); } };
    if (conceptId === 'roster') return { type: 'set', text: '집합 A를 원소나열법으로 입력하시오.', answer: A, more: null };
    if (conceptId === 'setBuilder') return { type: 'set', text: '집합 B를 원소나열법으로 입력하시오.', answer: B, more: null };
    return { type: 'set', text: '전체집합 U를 원소나열법으로 입력하시오.', answer: universe, more: null };
  };

  const submitAnswer = () => {
    const question = currentQuestion();
    let correct = false;
    if (question.type === 'symbol' || question.type === 'ox') correct = input === question.answer;
    if (question.type === 'set') {
      const parsed = parseSetAnswer(input);
      correct = Boolean(parsed) && sameSet(parsed, question.answer);
    }
    if (question.type === 'subset') {
      const parsed = parseSetAnswer(input);
      correct = Boolean(parsed) && parsed.length === subsetSize && parsed.every(value => A.includes(value));
    }
    setFeedback(correct ? { correct: true, text: '정답입니다! 개념과 벤다이어그램을 함께 확인해 보세요.' } : { correct: false, text: question.type === 'subset' ? 'A에 속하는 원소만 사용하고, 요구한 원소 수를 확인해 보세요.' : '다시 생각해 보고 버튼으로 답을 고쳐 보세요.' });
  };

  const question = currentQuestion();
  const baseTokens = ['{', '}', ',', '∅', '='];
  const numberTokens = universe.map(String);
  const relationTokens = ['∈', '∉', '∋', '∌', '⊂', '⊃', '≠'];
  const setTokens = ['U', 'A', 'B', '∪', '∩', 'ᶜ'];
  const isOx = question.type === 'ox';

  const conceptPanel = () => {
    const formulaBox = (formula, description) => <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-4 mb-4"><MathText as="div" text={formula} className="text-xl font-black text-indigo-950 mb-2" /><MathText as="p" text={description} className="text-xs text-indigo-900 leading-relaxed" /></div>;
    if (conceptId === 'element') return <>
      <p className="text-sm font-bold">집합을 이루는 대상 하나하나를 <span className="text-indigo-700">원소</span>라고 합니다.</p>
      {formulaBox('$a\\in A$: $a$는 집합 $A$의 원소이다.  $a\\notin A$: $a$는 집합 $A$의 원소가 아니다.', '집합이 앞에 올 때는 $A\\ni a$와 같이 나타낼 수도 있습니다.')}
      <div className="grid grid-cols-3 gap-2">{['A', 'B', 'U'].map(name => <button key={name} onClick={() => setFocusSet(name)} className={`rounded-xl border px-2 py-2 text-xs font-bold ${focusSet === name ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white hover:bg-indigo-50'}`}>집합 {name}의 원소</button>)}</div>
    </>;
    if (conceptId === 'roster') return <>
      <p className="text-sm font-bold mb-3">집합을 표현하는 방법입니다. 중괄호 안에 원소를 나열하고 쉼표로 구분합니다.</p>
      <div className="grid grid-cols-3 gap-2">{['A', 'B', 'U'].map(name => <button key={name} onClick={() => setFocusSet(name)} className={`rounded-xl border px-2 py-2 text-xs font-bold ${focusSet === name ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white hover:bg-indigo-50'}`}>집합 {name}</button>)}</div>
      {formulaBox(`$${focusSet}=${formatSet(focusSet === 'A' ? A : focusSet === 'B' ? B : universe)}$`, '원소의 순서는 달라도 같은 집합입니다.')}
    </>;
    if (conceptId === 'setBuilder') return <>
      <p className="text-sm font-bold mb-3">원소들이 가진 공통 성질을 기준으로 집합을 나타내는 방법입니다.</p>
      <div className="grid grid-cols-3 gap-2">{['A', 'B', 'U'].map(name => <button key={name} onClick={() => setFocusSet(name)} className={`rounded-xl border px-2 py-2 text-xs font-bold ${focusSet === name ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white hover:bg-indigo-50'}`}>집합 {name}</button>)}</div>
      {formulaBox(focusSet === 'A' ? `$A=\\{x\\mid x\\in U,\\ \\text{${lessonSet.conditionA}}\\}$` : focusSet === 'B' ? `$B=\\{x\\mid x\\in U,\\ \\text{${lessonSet.conditionB}}\\}$` : `$U=\\{x\\mid \\text{x는 자연수이고, }1\\leq x\\leq ${universe.length}\\}$`, 'x는 원소를 대표하고, | 뒤에는 원소들이 갖는 공통 성질을 씁니다.')}
    </>;
    if (conceptId === 'subset') return <>
      {formulaBox(`$${focusSet === 'B' ? 'B' : 'A'}\\subset U$`, `${focusSet === 'B' ? 'B' : 'A'}의 모든 원소는 U 안에 있습니다.`)}
      <div className="grid grid-cols-2 gap-2 mb-4"><button onClick={() => setFocusSet('A')} className={`rounded-xl border px-3 py-2 text-xs font-bold ${focusSet === 'A' ? 'bg-indigo-600 text-white' : 'bg-white'}`}>A는 U의 부분집합</button><button onClick={() => setFocusSet('B')} className={`rounded-xl border px-3 py-2 text-xs font-bold ${focusSet === 'B' ? 'bg-indigo-600 text-white' : 'bg-white'}`}>B는 U의 부분집합</button></div>
      <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 text-xs leading-relaxed"><strong>진부분집합</strong>: C ⊂ A이고 C ≠ A일 때 C를 A의 진부분집합이라고 합니다. ∅와 A 자신은 모두 A의 부분집합이지만, A 자신은 진부분집합이 아닙니다.</div>
    </>;
    if (conceptId === 'universal') return <>{formulaBox(`$U=${formatSet(universe)}$`, '이 학습에서 다루는 모든 원소의 모임입니다.')}</>;
    if (conceptId === 'empty') return <>{formulaBox('$\\varnothing$', '원소가 하나도 없는 집합입니다. 공집합은 모든 집합의 부분집합입니다.')}</>;
    if (conceptId === 'union') return <>{formulaBox(`$A\\cup B=${formatSet(union)}$`, '집합 A에 속하거나 집합 B에 속하는 원소의 모임입니다.')}</>;
    if (conceptId === 'intersection') return <>{formulaBox(`$A\\cap B=${formatSet(intersection)}$`, '집합 A와 집합 B에 공통으로 속하는 원소의 모임입니다.')}</>;
    if (conceptId === 'complement') return <>{formulaBox(`$A^c=${formatSet(complementA)}$`, '전체집합 U의 원소 중 집합 A에 속하지 않는 원소의 모임입니다.')}</>;
    return <>
      {formulaBox(`$A\\cap B=${formatSet(intersection)}$`, '두 집합의 교집합이 공집합인 경우, 두 집합을 서로소라고 합니다.')}
      <div className="grid grid-cols-2 gap-2"><button onClick={() => setDisjointChoice('yes')} className={`rounded-xl border p-2 text-xs font-bold ${disjointChoice === 'yes' ? 'bg-indigo-600 text-white' : 'bg-white'}`}>A와 B는 서로소이다</button><button onClick={() => setDisjointChoice('not')} className={`rounded-xl border p-2 text-xs font-bold ${disjointChoice === 'not' ? 'bg-indigo-600 text-white' : 'bg-white'}`}>A와 B는 서로소가 아니다</button></div>
      {disjointChoice && <p className={`mt-3 text-xs font-bold ${((disjointChoice === 'yes') === areDisjoint) ? 'text-emerald-700' : 'text-rose-700'}`}>{((disjointChoice === 'yes') === areDisjoint) ? '맞습니다. 교집합을 확인해 보세요.' : '교집합에 원소가 있는지 다시 확인해 보세요.'}</p>}
    </>;
  };

  return <div className="min-h-screen bg-slate-100 text-slate-800 pb-8">
    <header className="bg-indigo-950 text-white px-4 py-4 shadow-lg"><div className="max-w-6xl mx-auto flex flex-wrap justify-between items-center gap-3"><div><div className="text-xs font-bold text-indigo-300">CONCEPT LEARNING</div><h1 className="text-xl font-black">이번 시간에 배우는 주제: 집합</h1><p className="text-[11px] text-indigo-200 mt-1">{studentName} · 수업 코드 {sessionCode}</p></div><div className="flex gap-2 text-xs font-bold"><button onClick={restartLearning} className="bg-indigo-700 hover:bg-indigo-600 rounded-xl px-3 py-2">🔄 전체 학습 다시 하기</button><button onClick={() => onFinish(viewedConcepts, lessonSet)} className="bg-emerald-600 hover:bg-emerald-500 rounded-xl px-3 py-2">학습 끝내기</button><button onClick={onBack} className="bg-slate-700 hover:bg-slate-600 rounded-xl px-3 py-2">기능 선택</button></div></div></header>
    <main className="max-w-6xl mx-auto px-4 py-5 space-y-4">
      <nav className="grid grid-cols-2 sm:grid-cols-5 gap-2">{conceptLearningData.concepts.map(concept => <button key={concept.id} onClick={() => selectConcept(concept.id)} className={`rounded-xl px-2 py-2.5 text-xs font-black border transition ${conceptId === concept.id ? 'bg-indigo-600 text-white border-indigo-600 shadow' : 'bg-white text-slate-600 hover:bg-indigo-50 border-slate-200'}`}>{concept.label}</button>)}</nav>
      <section className="grid lg:grid-cols-5 gap-4"><div className="lg:col-span-2 bg-white rounded-2xl border shadow-sm p-4 flex flex-col justify-center"><ConceptVenn lessonSet={lessonSet} highlight={activeHighlight()} /><p className="text-center text-[11px] text-slate-500 mt-2">색칠된 원소가 현재 선택한 개념과 관련된 영역입니다.</p></div><div className="lg:col-span-3 bg-white rounded-2xl border shadow-sm p-5"><h2 className="font-black text-lg text-indigo-950 mb-3">{conceptLearningData.concepts.find(concept => concept.id === conceptId).label}</h2>{conceptPanel()}</div></section>
      <section className="bg-white rounded-2xl border shadow-sm p-5"><div className="flex flex-wrap items-center justify-between gap-2 mb-3"><div><h2 className="font-black text-base">✍️ 확인 문제</h2><p className="text-sm text-slate-700 mt-1">{question.text}</p></div>{feedback?.correct && question.more && <button onClick={question.more} className="bg-indigo-100 hover:bg-indigo-200 text-indigo-800 text-xs font-black px-3 py-2 rounded-xl">하나 더 풀어보기</button>}</div><div className="rounded-xl bg-slate-50 border p-3 min-h-12 text-lg font-bold text-indigo-950 mb-3">{input || <span className="text-sm text-slate-400 font-medium">아래 버튼을 눌러 답을 입력하세요.</span>}</div><div className="space-y-2"><div className="flex flex-wrap gap-1.5">{baseTokens.concat(numberTokens).map(token => <button key={token} onClick={() => setInput(previous => previous + token)} className="min-w-9 bg-white hover:bg-indigo-50 border rounded-lg px-2 py-1.5 text-sm font-bold">{token}</button>)}</div><div className="flex flex-wrap gap-1.5">{relationTokens.concat(setTokens).map(token => <button key={token} onClick={() => setInput(previous => previous + token)} className="min-w-9 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded-lg px-2 py-1.5 text-sm font-bold text-indigo-900">{token}</button>)}{isOx && ['O', 'X'].map(token => <button key={token} onClick={() => setInput(token)} className="min-w-9 bg-amber-100 hover:bg-amber-200 border border-amber-200 rounded-lg px-2 py-1.5 text-sm font-bold text-amber-900">{token}</button>)}</div>{conceptId === 'setBuilder' && <div className="flex flex-wrap gap-1.5">{['x', '|', '자연수', '≤', '짝수', '소수'].map(token => <button key={token} onClick={() => setInput(previous => previous + token)} className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 rounded-lg px-2 py-1.5 text-xs font-bold text-emerald-900">{token}</button>)}</div>}</div><div className="flex gap-2 mt-4"><button onClick={() => setInput(previous => previous.slice(0, -1))} className="bg-slate-200 hover:bg-slate-300 rounded-xl px-3 py-2 text-xs font-bold">지우기</button><button onClick={() => { setInput(''); setFeedback(null); }} className="bg-slate-200 hover:bg-slate-300 rounded-xl px-3 py-2 text-xs font-bold">초기화</button><button onClick={submitAnswer} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-5 py-2 text-xs font-black">정답 확인</button></div>{feedback && <div className={`mt-3 rounded-xl px-3 py-2 text-xs font-bold ${feedback.correct ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-rose-50 text-rose-800 border border-rose-100'}`}>{feedback.correct ? '✅ ' : '💡 '}{feedback.text}</div>}</section>
    </main>
  </div>;
}
