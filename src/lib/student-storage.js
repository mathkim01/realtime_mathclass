export const answerStorageKey = (name, code) => `ans_${code}_${name}`;
export const submissionStorageKey = (name, code) => `submitted_${code}_${name}`;

export function clearStudentAnswerCache(storage, name, code) {
  if (!name || !code) return;
  storage.removeItem(answerStorageKey(name, code));
  storage.removeItem(submissionStorageKey(name, code));
}
