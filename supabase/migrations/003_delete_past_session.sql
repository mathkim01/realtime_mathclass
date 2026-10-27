-- 수업 종료 후 교사 본인의 이전 수업만 삭제할 수 있습니다.
-- class_sessions 삭제 시 참가자·답안·제출·질문·아이디어·개념학습 기록은 외래 키에 따라 함께 삭제됩니다.
-- 실제 데이터는 이 파일을 실행하는 것만으로 삭제되지 않습니다.
begin;

create or replace function public.delete_past_class_session(p_session_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_status text;
begin
  if not private.owns_session(p_session_id) then
    raise exception '이 수업의 교사 권한이 필요합니다.';
  end if;

  select status into v_status
  from public.class_sessions
  where id = p_session_id and teacher_id = auth.uid()
  for update;

  if not found then raise exception '수업 기록을 찾을 수 없습니다.'; end if;
  if v_status <> 'ENDED' then raise exception '진행 중인 수업은 삭제할 수 없습니다. 먼저 수업을 종료해주세요.'; end if;

  delete from public.class_sessions where id = p_session_id and teacher_id = auth.uid() and status = 'ENDED';
  return jsonb_build_object('success', true);
end;
$$;

revoke all on function public.delete_past_class_session(uuid) from public, anon, authenticated;
grant execute on function public.delete_past_class_session(uuid) to authenticated;

commit;
