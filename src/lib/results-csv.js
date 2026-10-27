import { problemSetId, problemsData } from '../data/proposition-problems.js';
import { selectedChoiceLabel } from './problem-bank.js';

const csvCell = value => {
  const raw = value == null ? '' : String(value);
  // Excel이 학생 입력을 수식으로 실행하지 않도록 텍스트로 고정합니다.
  const safe = /^[\s]*[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
};

const seoulTime = value => value
  ? new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false })
  : '';

export function buildResultsCsv({ session, students }, problemCount = 13) {
  const isChoiceBank = session.problem_set_id === problemSetId;
  const headers = ['수업 코드', '수업 시작', '수업 종료', '학년', '반', '번호', '학생 식별', '제출 상태', '푼 문항 수', '정답 수', '전체 문항 수', '제출 시각', '재제출 이유'];
  for (let number = 1; number <= problemCount; number += 1) {
    headers.push(`${number}번 답안`);
    if (isChoiceBank) headers.push(`${number}번 풀이 빈칸`);
    headers.push(`${number}번 채점`);
  }
  const rows = students.map(student => {
    const submission = student.submission;
    const values = [
      session.code, seoulTime(session.created_at), seoulTime(session.ended_at),
      student.grade, student.class_number, student.student_number,
      student.display_name, submission ? '제출완료' : '미제출', student.solved,
      submission?.correct_count, submission?.problem_count,
      seoulTime(submission?.submitted_at), submission?.edit_reason,
    ];
    for (let number = 1; number <= problemCount; number += 1) {
      const answer = submission?.answers?.[number];
      values.push(isChoiceBank && answer?.answer
        ? selectedChoiceLabel(problemsData[number - 1], answer.answer)
        : answer?.answer ?? '');
      if (isChoiceBank) {
        const blanks = answer?.blanks || {};
        values.push(problemsData[number - 1]?.blankActivity.blankIds
          .map(id => `${id}: ${blanks[id] || ''}`).join(' / ') || '');
      }
      values.push(submission?.results?.[number] ?? '');
    }
    return values;
  });
  return '\uFEFF' + [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export function downloadResultsCsv(results, problemCount = 13) {
  const csv = buildResultsCsv(results, problemCount);
  const stamp = new Date(results.session.created_at).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
  const filename = `수학수업_${stamp}_${results.session.code}_결과.csv`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
