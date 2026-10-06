-- 초기 데이터: SQL Editor에서 001_initial.sql 실행 후 실행합니다.
insert into public.problem_sets(id, title, problem_count) values ('unit1-v1', '1단원 대단원 마무리', 13) on conflict (id) do nothing;
insert into private.answer_keys(problem_set_id, problem_id, correct_answer) values
('unit1-v1', 1, '④ 8'),
('unit1-v1', 2, '③ 3'),
('unit1-v1', 3, '③ a=5, b=-5'),
('unit1-v1', 4, '② 1/2<t<5/8'),
('unit1-v1', 5, '③ -3'),
('unit1-v1', 6, '④ 1, -3'),
('unit1-v1', 7, '② 2'),
('unit1-v1', 8, '② -1'),
('unit1-v1', 9, '⑤ 2'),
('unit1-v1', 10, '④ a=6, b=-2, r=3'),
('unit1-v1', 11, '② -11/2'),
('unit1-v1', 12, '② 7, -13'),
('unit1-v1', 13, '④ (12, 0)')
on conflict (problem_set_id, problem_id) do update set correct_answer = excluded.correct_answer;
