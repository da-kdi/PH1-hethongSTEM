-- 064 · Học liệu theo bản mẫu giao diện (28/10/2026), mẫu giáo án KDI:
--   Thông tin bài học: mô tả, nội dung tích hợp (môn chủ đạo + các môn tích hợp, mỗi môn một danh sách yêu cầu), thông tin tài liệu (soạn / review / hiệu chỉnh)
--   Nội dung bài học: Buổi › Hoạt động (phút) › Mục › các ý  (plan; steps giữ để tương thích, app ghi cả hai)
--   4 nhóm (Thông tin · Nội dung · Link · Định mức) có trạng thái Đã chốt / Cần kiểm tra; đủ 4 nhóm mới phát hành.
alter table public.material_lessons add column if not exists description text;
alter table public.material_lessons add column if not exists integration jsonb not null default '{"main": [], "others": []}'::jsonb check (jsonb_typeof(integration) = 'object');
alter table public.material_lessons add column if not exists doc_info jsonb not null default '{"written": [], "reviewed": [], "edited": []}'::jsonb check (jsonb_typeof(doc_info) = 'object');
alter table public.material_lessons add column if not exists plan jsonb not null default '[]'::jsonb check (jsonb_typeof(plan) = 'array');
alter table public.material_lessons add column if not exists groups jsonb not null default '{}'::jsonb check (jsonb_typeof(groups) = 'object');
-- Học liệu đã phát hành trước đây coi như đã chốt đủ 4 nhóm
update public.material_lessons set groups = '{"info":"ok","content":"ok","links":"ok","norms":"ok"}'::jsonb where status <> 'draft' and groups = '{}'::jsonb;

-- Phiên bản mới chép cả các phần mới
create or replace function public.material_new_version(p_lesson uuid, p_note text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare l material_lessons; v_id uuid; v_no int;
begin
  select * into l from material_lessons where id = p_lesson;
  if l.id is null or not public.ph1_can_write(public.ph1_parent_org('material_sets', l.set_id)) then
    raise exception 'Bạn không có quyền với học liệu này' using errcode = '42501';
  end if;
  select coalesce(max(version_no), 0) + 1 into v_no from material_lessons where family_id = l.family_id;
  insert into material_lessons (set_id, curriculum_lesson_id, seq, code, title, periods, sessions, objectives, subject_main, subjects_integrated,
                                product_requirements, steps, criteria, notes, family_id, version_no, status, change_note,
                                description, integration, doc_info, plan, groups)
    values (l.set_id, l.curriculum_lesson_id, l.seq, l.code, l.title, l.periods, l.sessions, l.objectives, l.subject_main, l.subjects_integrated,
            l.product_requirements, l.steps, l.criteria, l.notes, l.family_id, v_no, 'draft', nullif(btrim(p_note), ''),
            l.description, l.integration, l.doc_info, l.plan, l.groups)
    returning id into v_id;
  insert into material_files (lesson_id, seq, kind, title, url) select v_id, seq, kind, title, url from material_files where lesson_id = l.id;
  insert into material_norms (lesson_id, seq, category, name, spec, unit, qty, basis, consumable, substitute, supply_id)
    select v_id, seq, category, name, spec, unit, qty, basis, consumable, substitute, supply_id from material_norms where lesson_id = l.id;
  insert into audit_log (actor, org_id, entity, entity_id, action, summary)
    values (auth.uid(), public.ph1_parent_org('material_sets', l.set_id), 'material_lessons', v_id::text, 'insert', 'Tạo phiên bản ' || v_no || ' học liệu ' || l.title);
  return v_id;
end $$;
grant execute on function public.material_new_version(uuid, text) to authenticated;
