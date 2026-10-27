export function isProblemComplete(problem, response) {
  if (!problem || !response || !problem.choices.some(choice => choice.id === response.answer)) return false;
  return problem.blankActivity.blankIds.every(id => String(response.blanks?.[id] ?? '').trim().length > 0);
}

export function selectedChoiceLabel(problem, answer) {
  const choice = problem?.choices.find(item => item.id === answer);
  return choice ? `${choice.id}번 · ${choice.text}` : answer || '(미선택)';
}
