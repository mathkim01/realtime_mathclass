// 개념학습 데이터입니다. 새 학습 세트를 추가하거나 개념 문구를 수정할 때 이 파일만 편집하면 됩니다.
export const conceptLearningData = {
  concepts: [
    { id: 'element', label: '원소' },
    { id: 'roster', label: '원소나열법' },
    { id: 'setBuilder', label: '조건제시법' },
    { id: 'subset', label: '부분집합' },
    { id: 'universal', label: '전체집합' },
    { id: 'empty', label: '공집합' },
    { id: 'union', label: '합집합' },
    { id: 'intersection', label: '교집합' },
    { id: 'complement', label: '여집합' },
    { id: 'disjoint', label: '서로소' }
  ],
  lessonSets: [
    {
      id: 'set-1',
      universe: [1, 2, 3, 4, 5, 6, 7, 8],
      A: [2, 4, 6, 8],
      B: [1, 2, 3, 6],
      conditionA: 'x는 짝수',
      conditionB: 'x는 6의 약수'
    },
    {
      id: 'set-2',
      universe: [1, 2, 3, 4, 5, 6, 7],
      A: [2, 4, 6],
      B: [2, 3, 5, 7],
      conditionA: 'x는 짝수',
      conditionB: 'x는 소수'
    },
    {
      id: 'set-3',
      universe: [1, 2, 3, 4, 5, 6, 7, 8, 9],
      A: [3, 6, 9],
      B: [1, 2, 3, 4, 6, 9],
      conditionA: 'x는 3의 배수',
      conditionB: 'x는 12의 약수이거나 9이다'
    }
  ],
  emptyQuestions: [
    { text: '공집합은 모든 집합의 부분집합이다.', answer: 'O' },
    { text: '공집합에는 원소가 하나 있다.', answer: 'X' },
    { text: '원소가 하나도 없는 집합은 공집합이다.', answer: 'O' }
  ],
  disjointQuestions: [
    { text: '{1, 3}과 {2, 4}는 서로소이다.', answer: 'O' },
    { text: '{1, 2}와 {2, 3}은 서로소이다.', answer: 'X' },
    { text: '{1, 4, 7}과 {2, 5, 8}은 서로소이다.', answer: 'O' }
  ]
};
