-- 068. Bản mẫu v315 — các mục TODO cần CSDL (chạy sau 067). Chỉ thêm cột / bảng / hàm, không xoá dữ liệu.
--   1. Chương trình giáo dục: phiên bản mới khi đã phát hành (bản nháp sửa riêng, bản đang dùng giữ nguyên đến khi phát hành bản mới)
--   2. Chương trình giáo dục: “Giáo viên cần có gì”
--   3. Ngân hàng câu hỏi: câu điền khuyết (short) và tự luận (essay)
--   4. Kế hoạch đào tạo (PH2): trạng thái đợt “Đã huỷ”
--   5. Thẻ (tag) dùng chung cho mọi danh sách (thao tác hàng loạt “Thêm thẻ”)

-- ===== 1. Phiên bản chương trình =====
alter table curricula add column if not exists draft_version_id uuid references curriculum_versions(id) on delete set null;

-- Tạo phiên bản mới (nháp) từ bản đang dùng; đã có thì trả lại bản đó
create or replace function public.curriculum_start_revision(p_curriculum uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare c curricula; v_id uuid; v_no int;
begin
  select * into c from curricula where id = p_curriculum for update;
  if c.id is null or c.owner_org_id <> public.my_org_id() or not public.curriculum_can_manage() then
    raise exception 'Bạn không có quyền với chương trình này' using errcode = '42501';
  end if;
  if c.draft_version_id is not null then return c.draft_version_id; end if;
  if c.status <> 'published' then raise exception 'Chương trình chưa phát hành — sửa trực tiếp bản nháp' using errcode = '22023'; end if;
  select coalesce(max(version_no), 0) + 1 into v_no from curriculum_versions where curriculum_id = c.id;
  perform set_config('app.curriculum_internal', 'on', true);
  insert into curriculum_versions (curriculum_id, org_id, version_no, change_note, based_on_version_id)
    values (c.id, c.owner_org_id, v_no, 'Phiên bản ' || v_no, c.current_version_id) returning id into v_id;
  if c.current_version_id is not null then perform public.curriculum_copy_content(c.current_version_id, v_id); end if;
  update curricula set draft_version_id = v_id where id = c.id;
  perform set_config('app.curriculum_internal', 'off', true);
  return v_id;
end $$;

-- Phát hành phiên bản mới: bản cũ hết hiệu lực; học liệu / phân phối / bài giảng trỏ sang bài cùng tên ở bản mới
create or replace function public.curriculum_release_revision(p_curriculum uuid, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare c curricula; v_old uuid;
begin
  select * into c from curricula where id = p_curriculum for update;
  if c.id is null or c.owner_org_id <> public.my_org_id() or not public.curriculum_can_manage() then
    raise exception 'Bạn không có quyền với chương trình này' using errcode = '42501';
  end if;
  if c.draft_version_id is null then raise exception 'Chương trình không có phiên bản đang soạn' using errcode = '22023'; end if;
  if not exists (select 1 from curriculum_lessons where version_id = c.draft_version_id) then
    raise exception 'Phiên bản mới chưa có bài học' using errcode = '22023';
  end if;
  v_old := c.current_version_id;
  perform set_config('app.curriculum_internal', 'on', true);
  update curriculum_versions set status = 'superseded', effective_to = current_date where id = v_old;
  update curriculum_versions set status = 'published', published_at = now(), published_by = auth.uid(), effective_from = current_date,
         change_note = coalesce(nullif(btrim(p_note), ''), change_note) where id = c.draft_version_id;
  update material_lessons ml set curriculum_lesson_id = n.id from curriculum_lessons o, curriculum_lessons n
   where ml.curriculum_lesson_id = o.id and o.version_id = v_old and n.version_id = c.draft_version_id and n.title = o.title;
  update ppct_rows r set curriculum_lesson_id = n.id from curriculum_lessons o, curriculum_lessons n
   where r.curriculum_lesson_id = o.id and o.version_id = v_old and n.version_id = c.draft_version_id and n.title = o.title;
  update lesson_designs d set curriculum_lesson_id = n.id from curriculum_lessons o, curriculum_lessons n
   where d.curriculum_lesson_id = o.id and o.version_id = v_old and n.version_id = c.draft_version_id and n.title = o.title;
  update ppct_items i set curriculum_lesson_id = n.id from curriculum_lessons o, curriculum_lessons n
   where i.curriculum_lesson_id = o.id and o.version_id = v_old and n.version_id = c.draft_version_id and n.title = o.title;
  update curricula set current_version_id = c.draft_version_id, draft_version_id = null where id = c.id;
  perform set_config('app.curriculum_internal', 'off', true);
  insert into audit_log (actor, org_id, entity, entity_id, action, summary)
    values (auth.uid(), c.owner_org_id, 'curricula', c.id::text, 'update', 'Phát hành phiên bản mới của ' || c.name);
end $$;

-- Bỏ phiên bản đang soạn
create or replace function public.curriculum_discard_revision(p_curriculum uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c curricula;
begin
  select * into c from curricula where id = p_curriculum for update;
  if c.id is null or c.owner_org_id <> public.my_org_id() or not public.curriculum_can_manage() then
    raise exception 'Bạn không có quyền với chương trình này' using errcode = '42501';
  end if;
  if c.draft_version_id is null then return; end if;
  update curricula set draft_version_id = null where id = c.id;
  perform set_config('app.curriculum_internal', 'on', true);
  delete from curriculum_versions where id = c.draft_version_id and status = 'draft';
  perform set_config('app.curriculum_internal', 'off', true);
end $$;
grant execute on function public.curriculum_start_revision(uuid), public.curriculum_release_revision(uuid, text), public.curriculum_discard_revision(uuid) to authenticated;

-- ===== 2. Giáo viên cần có gì =====
alter table curricula add column if not exists teacher_needs text check (length(teacher_needs) <= 4000);

-- ===== 3. Câu điền khuyết / tự luận =====
alter table question_bank drop constraint if exists question_bank_kind_check;
alter table question_bank add constraint question_bank_kind_check check (kind in ('single', 'multi', 'truefalse', 'short', 'essay'));
alter table question_bank drop constraint if exists question_bank_options_check;
alter table question_bank add constraint question_bank_options_check check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) <= 8);
alter table question_bank drop constraint if exists question_bank_answer_check;
alter table question_bank add constraint question_bank_answer_check check (jsonb_typeof(answer) = 'array');

-- short: answer = các đáp án chấp nhận (chữ); essay: answer rỗng, gợi ý chấm ở explain; câu chọn: như cũ
create or replace function public.guard_question() returns trigger
language plpgsql set search_path = public as $$
declare v jsonb; n int;
begin
  if new.kind in ('short', 'essay') then
    new.options := '[]'::jsonb;
    if new.kind = 'essay' then new.answer := '[]'::jsonb; end if;
    if new.kind = 'short' then
      if jsonb_array_length(new.answer) < 1 then raise exception 'Câu điền khuyết cần ít nhất một đáp án' using errcode = '22023'; end if;
      for v in select * from jsonb_array_elements(new.answer) loop
        if jsonb_typeof(v) <> 'string' or btrim(v #>> '{}') = '' then raise exception 'Đáp án điền khuyết phải là chữ' using errcode = '22023'; end if;
      end loop;
    end if;
  else
    if new.kind = 'truefalse' then new.options := '["Đúng","Sai"]'::jsonb; end if;
    n := jsonb_array_length(new.options);
    if n < 2 then raise exception 'Câu trắc nghiệm cần ít nhất hai lựa chọn' using errcode = '22023'; end if;
    if jsonb_array_length(new.answer) < 1 then raise exception 'Chưa chọn đáp án đúng' using errcode = '22023'; end if;
    for v in select * from jsonb_array_elements(new.answer) loop
      if jsonb_typeof(v) <> 'number' or (v #>> '{}')::numeric <> floor((v #>> '{}')::numeric) or (v #>> '{}')::int < 0 or (v #>> '{}')::int >= n then
        raise exception 'Đáp án không khớp với các lựa chọn' using errcode = '22023';
      end if;
    end loop;
    if new.kind in ('single', 'truefalse') and jsonb_array_length(new.answer) <> 1 then raise exception 'Câu một đáp án chỉ có một đáp án đúng' using errcode = '22023'; end if;
  end if;
  if tg_op = 'INSERT' then new.created_by := coalesce(new.created_by, auth.uid()); end if;
  if tg_op = 'UPDATE' then new.created_by := old.created_by; new.org_id := old.org_id; end if;
  new.updated_at := now();
  return new;
end $$;

-- Chấm: câu chọn theo chỉ số; điền khuyết so chữ (bỏ hoa/thường, khoảng trắng thừa); tự luận không tự chấm (không tính vào tổng)
create or replace function public.exam_submit(p_attempt uuid, p_answers jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a exam_attempts; v_ok int := 0; v_total int := 0; r record; v_given jsonb; v_txt text;
begin
  select * into a from exam_attempts where id = p_attempt for update;
  if not found or a.student_id is distinct from public.my_student_id() then
    raise exception 'Không tìm thấy lượt làm bài' using errcode = '42501';
  end if;
  if a.status = 'submitted' then return public.exam_result(a.id); end if;
  if p_answers is not null and (jsonb_typeof(p_answers) <> 'object' or length(p_answers::text) > 50000) then raise exception 'Bài làm không hợp lệ' using errcode = '22023'; end if;
  for r in select q.id, q.kind, q.answer from question_bank q where q.id = any(a.questions) loop
    if r.kind = 'essay' then continue; end if;
    v_total := v_total + 1;
    v_given := coalesce(p_answers -> r.id::text, '[]'::jsonb);
    if r.kind = 'short' then
      v_txt := lower(regexp_replace(btrim(coalesce(case when jsonb_typeof(v_given) = 'array' then v_given ->> 0 else v_given #>> '{}' end, '')), '\s+', ' ', 'g'));
      if v_txt <> '' and exists (select 1 from jsonb_array_elements_text(r.answer) x where lower(regexp_replace(btrim(x), '\s+', ' ', 'g')) = v_txt) then v_ok := v_ok + 1; end if;
    elsif jsonb_typeof(v_given) = 'array'
       and (select coalesce(array_agg(x::int order by x::int), '{}') from jsonb_array_elements_text(v_given) x where x ~ '^\d+$')
         = (select array_agg(x::int order by x::int) from jsonb_array_elements_text(r.answer) x) then
      v_ok := v_ok + 1;
    end if;
  end loop;
  update exam_attempts set answers = p_answers, status = 'submitted', submitted_at = now(), correct = v_ok, total = v_total,
    score = case when v_total > 0 then round(10.0 * v_ok / v_total, 1) end,
    late = a.deadline is not null and now() > a.deadline + interval '2 minutes'
  where id = a.id;
  return public.exam_result(a.id);
end $$;

-- ===== 4. Đợt đào tạo: Đã huỷ =====
alter table ph2_plans drop constraint if exists ph2_plans_status_check;
alter table ph2_plans add constraint ph2_plans_status_check check (status in ('draft', 'published', 'cancelled'));
alter table ph2_plans add column if not exists cancelled jsonb;   -- {date, by, reason}
drop policy if exists ph2_plans_read on ph2_plans;
create policy ph2_plans_read on ph2_plans for select to authenticated using (public.ph2_can_read(org_id) or (status in ('published', 'cancelled') and public.is_staff()));

-- ===== 5. Thẻ (tag) =====
create table if not exists item_tags (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null default public.my_org_id() references organizations(id) on delete cascade,
  entity     text not null check (length(entity) between 1 and 40),      -- khoá danh sách, vd 'ct', 'pp', 'tp'
  item_id    text not null check (length(item_id) between 1 and 80),
  tag        text not null check (length(btrim(tag)) between 1 and 40),
  created_by uuid default auth.uid() references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (org_id, entity, item_id, tag)
);
create index if not exists item_tags_lookup on item_tags (org_id, entity);
alter table item_tags enable row level security;
drop policy if exists item_tags_read on item_tags;
create policy item_tags_read on item_tags for select to authenticated using (org_id = (select public.my_org_id()));
drop policy if exists item_tags_write on item_tags;
create policy item_tags_write on item_tags for all to authenticated
  using (org_id = (select public.my_org_id()) and (select public.is_staff()))
  with check (org_id = (select public.my_org_id()) and (select public.is_staff()));
grant select, insert, update, delete on item_tags to authenticated;
