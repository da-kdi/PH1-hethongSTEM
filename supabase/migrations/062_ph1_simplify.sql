-- 062. PH1 · 1.1 đơn giản hoá theo quyết định 23/10/2026 (docs/PH1-cau-truc-1.1.md). Cần chạy sau 061.
--   Chương trình: bỏ phiên bản và phê duyệt. Trạng thái nằm ở chương trình: Nháp / Đã phát hành / Ngừng dùng; sửa trực tiếp.
--     Mỗi chương trình áp dụng cho MỘT khối (Cấp học, Khối ở Thông tin). Chương trình cũ nhiều khối được tách thành nhiều chương trình.
--     Nội dung vẫn lưu ở một phiên bản "chứa nội dung" (current_version_id) — chỉ là chi tiết kỹ thuật, giao diện không hiện.
--     Bài học thuộc Môn học (cột subject); Chủ đề/Chương không bắt buộc (unit_id null được). Yêu cầu cần đạt: một ô text.
--   Học liệu: có phiên bản (family_id + version_no), trạng thái theo từng phiên bản; đơn vị chọn phiên bản dùng (material_in_use);
--     phát hành phiên bản mới → báo đơn vị đang dùng bản cũ và người soạn bài giảng từ bản cũ. Không qua phê duyệt.

-- ===== 1. Cột mới =====
alter table curricula add column if not exists status text not null default 'draft';
alter table curricula drop constraint if exists curricula_status_check;
alter table curricula add constraint curricula_status_check check (status in ('draft', 'published', 'archived'));
alter table curricula add column if not exists outcomes_text text;

alter table curriculum_lessons add column if not exists subject text;
alter table curriculum_lessons alter column unit_id drop not null;
alter table curriculum_lessons drop constraint if exists curriculum_lessons_unit_id_fkey;
alter table curriculum_lessons add constraint curriculum_lessons_unit_id_fkey foreign key (unit_id) references curriculum_units(id) on delete set null;
create index if not exists curriculum_lessons_subject_idx on curriculum_lessons (version_id, subject, seq);

-- Bài học: chủ đề (nếu có) phải cùng nội dung; môn của bài mặc định theo chủ đề
create or replace function public.curriculum_content_check() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_table_name = 'curriculum_lessons' then
    if new.unit_id is not null then
      if not exists (select 1 from curriculum_units u where u.id = new.unit_id and u.version_id = new.version_id) then
        raise exception 'Chủ đề không thuộc chương trình này' using errcode = '23514';
      end if;
      if new.subject is null then new.subject := (select subject_main from curriculum_units where id = new.unit_id); end if;
    end if;
  else
    if new.unit_id is not null and not exists (select 1 from curriculum_units u where u.id = new.unit_id and u.version_id = new.version_id) then
      raise exception 'Chủ đề không thuộc chương trình này' using errcode = '23514';
    end if;
    if new.lesson_id is not null and not exists (select 1 from curriculum_lessons l where l.id = new.lesson_id and l.version_id = new.version_id) then
      raise exception 'Bài học không thuộc chương trình này' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;

-- ===== 2. Chuyển dữ liệu chương trình =====
do $$
declare c record; v_hold uuid; g int; v_g0 int; v_grades int[]; v_new uuid; v_ver uuid; v_status text; v_lv text;
begin
  perform set_config('app.curriculum_internal', 'on', true);
  -- 2a. Phiên bản chứa nội dung: bản đang hiệu lực, không có thì bản mới nhất
  update curricula cu set current_version_id = (select id from curriculum_versions v where v.curriculum_id = cu.id order by version_no desc limit 1)
   where current_version_id is null;
  -- 2b. Trạng thái
  update curricula cu set status = case when cu.archived_at is not null then 'archived'
    when exists (select 1 from curriculum_versions v where v.id = cu.current_version_id and v.status = 'published') then 'published' else 'draft' end;
  -- 2c. Liên kết đang trỏ vào bài của phiên bản khác → bài cùng tên ở bản chứa nội dung; rồi xoá các phiên bản khác
  for c in select id, current_version_id from curricula where current_version_id is not null loop
    update material_lessons ml set curriculum_lesson_id = n.id
      from curriculum_lessons o, curriculum_versions ov, curriculum_lessons n
     where ml.curriculum_lesson_id = o.id and ov.id = o.version_id and ov.curriculum_id = c.id and o.version_id <> c.current_version_id
       and n.version_id = c.current_version_id and n.title = o.title;
    update ppct_rows r set curriculum_lesson_id = n.id
      from curriculum_lessons o, curriculum_versions ov, curriculum_lessons n
     where r.curriculum_lesson_id = o.id and ov.id = o.version_id and ov.curriculum_id = c.id and o.version_id <> c.current_version_id
       and n.version_id = c.current_version_id and n.title = o.title;
    update lesson_designs d set curriculum_lesson_id = n.id
      from curriculum_lessons o, curriculum_versions ov, curriculum_lessons n
     where d.curriculum_lesson_id = o.id and ov.id = o.version_id and ov.curriculum_id = c.id and o.version_id <> c.current_version_id
       and n.version_id = c.current_version_id and n.title = o.title;
    update ppct_items i set curriculum_lesson_id = n.id
      from curriculum_lessons o, curriculum_versions ov, curriculum_lessons n
     where i.curriculum_lesson_id = o.id and ov.id = o.version_id and ov.curriculum_id = c.id and o.version_id <> c.current_version_id
       and n.version_id = c.current_version_id and n.title = o.title;
    delete from curriculum_versions where curriculum_id = c.id and id <> c.current_version_id;
  end loop;
  update curricula set source_version_id = null where source_version_id is not null and source_version_id not in (select current_version_id from curricula where current_version_id is not null);
  update program_package_items set version_id = null where version_id is not null;
  -- 2d. Môn của bài theo chủ đề
  update curriculum_lessons l set subject = u.subject_main from curriculum_units u where u.id = l.unit_id and l.subject is null;
  -- 2e. Tách chương trình nhiều khối: giữ khối nhỏ nhất, mỗi khối còn lại thành một chương trình riêng
  for c in select * from curricula where current_version_id is not null order by created_at loop
    v_hold := c.current_version_id;
    v_grades := array(select distinct x from (select grade x from curriculum_units where version_id = v_hold and grade is not null
                      union select grade from curriculum_subjects where version_id = v_hold) s order by x);
    if coalesce(array_length(v_grades, 1), 0) = 0 then
      if array_length(c.grades, 1) > 1 then update curricula set grades = c.grades[1:1] where id = c.id; end if;
      continue;
    end if;
    v_g0 := v_grades[1];
    select status into v_status from curriculum_versions where id = v_hold;
    foreach g in array v_grades[2:] loop
      v_lv := coalesce((select parent_code from curriculum_catalog where kind = 'grade' and code = g::text and owner_org_id is null),
                       case when g = 0 then 'mamnon' when g <= 5 then 'tieuhoc' when g <= 9 then 'thcs' else 'thpt' end);
      insert into curricula (owner_org_id, code, name, category, color, summary, issuer, levels, grades, subjects, fields, structure_labels,
                             scope, require_approval, source_curriculum_id, status, archived_at, created_by)
        values (c.owner_org_id, case when c.code is null then null else c.code || '-K' || g end,
                c.name || ' · ' || case when g = 0 then 'Mầm non' else 'Khối ' || g end, c.category, c.color, c.summary, c.issuer,
                array[v_lv], array[g], c.subjects, c.fields, c.structure_labels, c.scope, false, c.source_curriculum_id, c.status, c.archived_at, c.created_by)
        returning id into v_new;
      insert into curriculum_versions (curriculum_id, org_id, version_no, status, change_note, published_at, effective_from)
        values (v_new, c.owner_org_id, 1, v_status, 'Tách từ ' || c.name, now(), current_date) returning id into v_ver;
      update curricula set current_version_id = v_ver where id = v_new;
      insert into curriculum_targets (curriculum_id, org_id) select v_new, org_id from curriculum_targets where curriculum_id = c.id on conflict do nothing;
      update curriculum_units set version_id = v_ver where version_id = v_hold and grade = g;
      update curriculum_lessons l set version_id = v_ver from curriculum_units u where u.id = l.unit_id and u.version_id = v_ver and l.version_id = v_hold;
      update curriculum_outcomes o set version_id = v_ver from curriculum_units u where u.id = o.unit_id and u.version_id = v_ver and o.version_id = v_hold;
      update curriculum_assessments a set version_id = v_ver from curriculum_units u where u.id = a.unit_id and u.version_id = v_ver and a.version_id = v_hold;
      update curriculum_subjects set version_id = v_ver where version_id = v_hold and grade = g;
      update material_sets set curriculum_id = v_new, version_id = v_ver where curriculum_id = c.id and grade = g;
      update ppct_docs set curriculum_id = v_new where curriculum_id = c.id and grade = g;
      update ppct_chapters ch set curriculum_id = v_new from ppct_docs d where d.id = ch.doc_id and ch.curriculum_id = c.id and d.grade = g;
      update ppct_plans set curriculum_id = v_new where curriculum_id = c.id and grade = g;
      insert into program_package_items (package_id, seq, curriculum_id, subject, grades, periods_total, notes)
        select package_id, seq, v_new, subject, array[g], periods_total, notes from program_package_items
         where curriculum_id = c.id and (grades = '{}' or g = any(grades));
    end loop;
    if array_length(v_grades, 1) > 1 then
      update program_package_items set grades = array[v_g0] where curriculum_id = c.id and (grades = '{}' or v_g0 = any(grades));
      delete from program_package_items where curriculum_id = c.id and not (v_g0 = any(grades));
    end if;
    v_lv := coalesce((select parent_code from curriculum_catalog where kind = 'grade' and code = v_g0::text and owner_org_id is null),
                     case when v_g0 = 0 then 'mamnon' when v_g0 <= 5 then 'tieuhoc' when v_g0 <= 9 then 'thcs' else 'thpt' end);
    update curricula set grades = array[v_g0], levels = array[v_lv],
           name = case when array_length(v_grades, 1) > 1 then name || ' · ' || case when v_g0 = 0 then 'Mầm non' else 'Khối ' || v_g0 end else name end
     where id = c.id;
  end loop;
  -- 2f. Bỏ chủ đề tự tạo của màn "Đối tượng" cũ (tên = "<môn> Khối n"): bài nằm thẳng dưới môn
  update curriculum_lessons l set unit_id = null from curriculum_units u
   where u.id = l.unit_id and u.subject_main is not null
     and u.title = coalesce((select name from curriculum_catalog k where k.kind = 'subject' and k.code = u.subject_main order by owner_org_id nulls first limit 1), u.subject_main)
                   || ' ' || case when u.grade = 0 then 'Mầm non' else 'Khối ' || u.grade end;
  delete from curriculum_units u where not exists (select 1 from curriculum_lessons l where l.unit_id = u.id)
     and u.subject_main is not null
     and u.title = coalesce((select name from curriculum_catalog k where k.kind = 'subject' and k.code = u.subject_main order by owner_org_id nulls first limit 1), u.subject_main)
                   || ' ' || case when u.grade = 0 then 'Mầm non' else 'Khối ' || u.grade end;
  -- 2g. Môn của chương trình: thêm môn có bài mà chưa khai báo
  insert into curriculum_subjects (version_id, subject, grade, seq, periods_total, periods_per_week)
    select distinct l.version_id, l.subject, coalesce(cu.grades[1], 0), 99, 0, 1
      from curriculum_lessons l join curricula cu on cu.current_version_id = l.version_id
     where l.subject is not null and not exists (select 1 from curriculum_subjects s where s.version_id = l.version_id and s.subject = l.subject)
  on conflict do nothing;
  -- 2h. Chương trình đã phát hành mà không có bài nào → về nháp
  update curricula cu set status = 'draft' where status = 'published'
     and not exists (select 1 from curriculum_lessons l where l.version_id = cu.current_version_id);
  perform set_config('app.curriculum_internal', 'off', true);
end $$;

-- ===== 3. Quyền & hàm chương trình (không còn phiên bản, phê duyệt) =====
-- Thấy chương trình: của đơn vị mình / trực thuộc; của đơn vị khác khi đã phát hành tới mình (kể cả đã ngừng dùng)
create or replace function public.curriculum_visible(p_curriculum uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from curricula c
     where c.id = p_curriculum and public.is_staff()
       and (c.owner_org_id in (select public.my_org_tree())
            or (c.status <> 'draft' and (
                  c.scope = 'public'
                  or (c.scope = 'children' and c.owner_org_id in (select public.my_ancestor_orgs()))
                  or (c.scope = 'selected' and exists (select 1 from curriculum_targets t
                        where t.curriculum_id = c.id and t.org_id in (select public.my_scope_orgs())))))))
$$;
create or replace function public.curriculum_version_visible(p_version uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from curriculum_versions v where v.id = p_version and public.curriculum_visible(v.curriculum_id))
$$;
-- Sửa nội dung: đơn vị sở hữu, người quản lý — ở mọi trạng thái
create or replace function public.curriculum_version_editable(p_version uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from curriculum_versions v join curricula c on c.id = v.curriculum_id
     where v.id = p_version and c.owner_org_id = public.my_org_id() and public.curriculum_can_manage())
$$;

-- Xoá chương trình: đơn vị sở hữu, ở mọi trạng thái
drop policy if exists curricula_delete on curricula;
create policy curricula_delete on curricula for delete to authenticated using (
  owner_org_id = (select public.my_org_id()) and (select public.curriculum_can_manage()));

-- Phát hành cần có ít nhất một bài học; archived_at đi theo trạng thái
create or replace function public.curricula_status_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published')
     and not exists (select 1 from curriculum_lessons where version_id = new.current_version_id) then
    raise exception 'Chương trình chưa có bài học — thêm bài trước khi phát hành' using errcode = '22023';
  end if;
  new.archived_at := case when new.status = 'archived' then coalesce(new.archived_at, now()) end;
  return new;
end $$;
drop trigger if exists curricula_status_guard on curricula;
create trigger curricula_status_guard before insert or update of status on curricula for each row execute function public.curricula_status_guard();

-- Tạo chương trình: kèm nội dung rỗng; Cấp học, Khối từ Thông tin
create or replace function public.curriculum_create(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_org uuid := public.my_org_id(); v_id uuid; v_ver uuid; v_type text;
begin
  if not public.curriculum_can_manage() then raise exception 'Bạn không có quyền soạn chương trình' using errcode = '42501'; end if;
  select type into v_type from organizations where id = v_org;
  if coalesce(p->>'scope', 'children') = 'public' and v_type <> 'provider' and not public.is_platform_admin() then
    raise exception 'Chỉ đơn vị cung cấp phát hành công khai' using errcode = '42501';
  end if;
  insert into curricula (owner_org_id, code, name, category, summary, issuer, levels, grades, subjects, fields, scope, require_approval, outcomes_text, status)
  values (v_org, nullif(btrim(p->>'code'), ''), btrim(p->>'name'), nullif(p->>'category', ''), nullif(p->>'summary', ''),
          coalesce(nullif(btrim(p->>'issuer'), ''), (select name from organizations where id = v_org)),
          coalesce(array(select jsonb_array_elements_text(p->'levels')), '{}'),
          coalesce(array(select (jsonb_array_elements_text(p->'grades'))::int), '{}'),
          coalesce(array(select jsonb_array_elements_text(p->'subjects')), '{}'),
          coalesce(array(select jsonb_array_elements_text(p->'fields')), '{}'),
          coalesce(p->>'scope', case when v_type = 'school' then 'own' else 'children' end), false, nullif(p->>'outcomes_text', ''), 'draft')
  returning id into v_id;
  perform set_config('app.curriculum_internal', 'on', true);
  insert into curriculum_versions (curriculum_id, org_id, version_no, change_note) values (v_id, v_org, 1, 'Nội dung chương trình') returning id into v_ver;
  update curricula set current_version_id = v_ver where id = v_id;
  perform set_config('app.curriculum_internal', 'off', true);
  insert into audit_log (actor, org_id, entity, entity_id, action, summary)
    values (auth.uid(), v_org, 'curricula', v_id::text, 'insert', 'Tạo chương trình ' || btrim(p->>'name'));
  return v_id;
end $$;

-- Sao chép nội dung (kế thừa): giữ môn của bài, chủ đề không bắt buộc
create or replace function public.curriculum_copy_content(p_from uuid, p_to uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  create temp table if not exists _cur_map (old_id uuid primary key, new_id uuid not null) on commit drop;
  delete from _cur_map;
  insert into _cur_map select id, gen_random_uuid() from curriculum_units where version_id = p_from;
  insert into _cur_map select id, gen_random_uuid() from curriculum_lessons where version_id = p_from;
  insert into _cur_map select id, gen_random_uuid() from curriculum_outcomes where version_id = p_from;
  insert into curriculum_subjects (version_id, seq, subject, grade, periods_total, periods_per_week, is_required, notes)
    select p_to, seq, subject, grade, periods_total, periods_per_week, is_required, notes from curriculum_subjects where version_id = p_from;
  insert into curriculum_units (id, version_id, seq, code, title, summary, grade, periods, subject_main, subjects_integrated, room_kind, notes)
    select m.new_id, p_to, u.seq, u.code, u.title, u.summary, u.grade, u.periods, u.subject_main, u.subjects_integrated, u.room_kind, u.notes
      from curriculum_units u join _cur_map m on m.old_id = u.id where u.version_id = p_from;
  insert into curriculum_lessons (id, version_id, unit_id, subject, seq, code, title, summary, periods, sessions, minutes_per_period, period_plan, library_item_id, notes)
    select m.new_id, p_to, mu.new_id, l.subject, l.seq, l.code, l.title, l.summary, l.periods, l.sessions, l.minutes_per_period, l.period_plan, l.library_item_id, l.notes
      from curriculum_lessons l join _cur_map m on m.old_id = l.id left join _cur_map mu on mu.old_id = l.unit_id where l.version_id = p_from;
  insert into curriculum_outcomes (id, version_id, unit_id, lesson_id, seq, code, kind, subject, description, competency_key)
    select m.new_id, p_to, mu.new_id, ml.new_id, o.seq, o.code, o.kind, o.subject, o.description, o.competency_key
      from curriculum_outcomes o join _cur_map m on m.old_id = o.id
      left join _cur_map mu on mu.old_id = o.unit_id left join _cur_map ml on ml.old_id = o.lesson_id where o.version_id = p_from;
end $$;
revoke execute on function public.curriculum_copy_content(uuid, uuid) from public, anon, authenticated;

-- Kế thừa: sao chương trình (đã phát hành, thấy được) thành bản nháp của đơn vị mình
create or replace function public.curriculum_clone(p_version uuid, p_name text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v curriculum_versions; c curricula; v_org uuid := public.my_org_id(); v_id uuid; v_new uuid; v_type text;
begin
  if not public.curriculum_can_manage() then raise exception 'Bạn không có quyền soạn chương trình' using errcode = '42501'; end if;
  select * into v from curriculum_versions where id = p_version;
  if v.id is null or not public.curriculum_version_visible(v.id) then raise exception 'Không tìm thấy chương trình' using errcode = '42501'; end if;
  select * into c from curricula where id = v.curriculum_id;
  select type into v_type from organizations where id = v_org;
  insert into curricula (owner_org_id, code, name, category, color, summary, issuer, levels, grades, subjects, fields, scope, require_approval,
                         structure_labels, source_curriculum_id, outcomes_text, status)
  values (v_org, null, coalesce(nullif(btrim(p_name), ''), c.name), c.category, c.color, c.summary, (select name from organizations where id = v_org),
          c.levels, c.grades, c.subjects, c.fields, case when v_type = 'school' then 'own' else 'children' end, false,
          c.structure_labels, c.id, c.outcomes_text, 'draft')
  returning id into v_id;
  perform set_config('app.curriculum_internal', 'on', true);
  insert into curriculum_versions (curriculum_id, org_id, version_no, change_note) values (v_id, v_org, 1, 'Kế thừa từ ' || c.name) returning id into v_new;
  update curricula set current_version_id = v_new where id = v_id;
  perform set_config('app.curriculum_internal', 'off', true);
  perform public.curriculum_copy_content(v.id, v_new);
  insert into audit_log (actor, org_id, entity, entity_id, action, summary, detail)
    values (auth.uid(), v_org, 'curricula', v_id::text, 'insert', 'Kế thừa chương trình ' || c.name, jsonb_build_object('source', c.id));
  return v_id;
end $$;

-- Chương trình đã phát hành đơn vị dùng được (đầu vào Phân phối)
drop function if exists public.curriculum_available();
create or replace function public.curriculum_available()
returns table (curriculum_id uuid, version_id uuid, owner_org_id uuid, owner_name text, code text, name text, category text,
               levels text[], grades int[], subjects text[], units int, lessons int, periods int, is_own boolean, source_curriculum_id uuid)
language sql stable security definer set search_path = public as $$
  select c.id, c.current_version_id, c.owner_org_id, o.name, c.code, c.name, c.category, c.levels, c.grades, c.subjects,
         (select count(*)::int from curriculum_units u where u.version_id = c.current_version_id),
         (select count(*)::int from curriculum_lessons l where l.version_id = c.current_version_id),
         (select coalesce(sum(l.periods), 0)::int from curriculum_lessons l where l.version_id = c.current_version_id),
         c.owner_org_id = public.my_org_id(), c.source_curriculum_id
    from curricula c join organizations o on o.id = c.owner_org_id
   where c.status = 'published' and public.curriculum_visible(c.id)
   order by c.owner_org_id = public.my_org_id() desc, c.name
$$;
grant execute on function public.curriculum_available() to authenticated;

-- Phân phối: dựng lịch từ bài học theo môn của chương trình (khối của chương trình phải khớp khối của bản phân phối)
create or replace function public.ppct_doc_build_internal(p_doc uuid, p_items jsonb, p_replace boolean default true) returns int
language plpgsql security definer set search_path = public as $$
declare d ppct_docs; it jsonb; c curricula; l record; v_ch uuid; n int := 0; k int; v_seq int := 0; v_sem int; v_cum numeric := 0; v_cap numeric;
begin
  select * into d from ppct_docs where id = p_doc;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Chưa chọn môn' using errcode = '22023'; end if;
  if p_replace then delete from ppct_chapters where doc_id = d.id; else select coalesce(max(seq), 0) into v_seq from ppct_chapters where doc_id = d.id; end if;
  v_cap := d.weeks_hk1 * d.ppw_hk1;
  for it in select * from jsonb_array_elements(p_items) loop
    select * into c from curricula where id = (it->>'curriculum_id')::uuid;
    if c.id is null or c.current_version_id is null or c.status = 'archived' then continue; end if;
    if c.grades <> '{}' and not (d.grade = any(c.grades)) then continue; end if;
    v_seq := v_seq + 1; v_sem := case when v_cum < v_cap or d.weeks_hk2 = 0 then 1 else 2 end;
    insert into ppct_chapters (doc_id, semester, seq, title, curriculum_id, subject)
      values (d.id, v_sem, v_seq,
              coalesce((select name from curriculum_catalog where kind = 'subject' and code = it->>'subject' order by owner_org_id nulls first limit 1), it->>'subject')
                || ' · ' || coalesce(c.code, c.name),
              c.id, it->>'subject') returning id into v_ch;
    k := 0;
    for l in select cl.* from curriculum_lessons cl left join curriculum_units u on u.id = cl.unit_id
              where cl.version_id = c.current_version_id and cl.subject = it->>'subject' order by u.seq nulls last, cl.seq loop
      k := k + 1; n := n + 1; v_cum := v_cum + greatest(l.periods, 1);
      insert into ppct_rows (doc_id, chapter_id, seq, title, periods, sessions, kind, curriculum_lesson_id, material_lesson_id)
        values (d.id, v_ch, k, l.title, least(greatest(l.periods, 1), 20), l.sessions, 'bai_hoc', l.id,
                (select ml.id from material_lessons ml where ml.curriculum_lesson_id = l.id order by ml.status = 'published' desc, ml.version_no desc limit 1));
    end loop;
  end loop;
  return n;
end $$;
revoke execute on function public.ppct_doc_build_internal(uuid, jsonb, boolean) from public, anon, authenticated;

-- ===== 4. Học liệu có phiên bản =====
alter table material_lessons add column if not exists family_id uuid;
alter table material_lessons add column if not exists version_no int not null default 1;
alter table material_lessons add column if not exists status text not null default 'draft';
alter table material_lessons drop constraint if exists material_lessons_status_check;
alter table material_lessons add constraint material_lessons_status_check check (status in ('draft', 'published', 'archived'));
alter table material_lessons add column if not exists change_note text;
alter table material_lessons add column if not exists published_at timestamptz;
alter table material_lessons add column if not exists created_at timestamptz not null default now();
update material_lessons ml set family_id = coalesce(ml.family_id, ml.id),
  status = case s.status when 'published' then 'published' when 'archived' then 'archived' else 'draft' end,
  published_at = case when s.status = 'published' then now() end
  from material_sets s where s.id = ml.set_id and ml.family_id is null;
create or replace function public.material_lessons_family() returns trigger
language plpgsql set search_path = public as $$
begin
  new.family_id := coalesce(new.family_id, new.id);
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then new.published_at := now(); end if;
  return new;
end $$;
drop trigger if exists material_lessons_family on material_lessons;
create trigger material_lessons_family before insert or update on material_lessons for each row execute function public.material_lessons_family();
alter table material_lessons alter column family_id set not null;
create unique index if not exists material_lessons_family_uq on material_lessons (family_id, version_no);
-- Một bài học có đúng một học liệu (nhiều phiên bản)
create unique index if not exists material_lessons_lesson_uq on material_lessons (curriculum_lesson_id, version_no) where curriculum_lesson_id is not null;
create or replace function public.material_lessons_one_family() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.curriculum_lesson_id is not null and exists (select 1 from material_lessons x where x.curriculum_lesson_id = new.curriculum_lesson_id
       and x.family_id <> new.family_id and x.id <> new.id) then
    raise exception 'Bài học này đã có học liệu — tạo phiên bản mới thay vì học liệu mới' using errcode = '23505';
  end if;
  return new;
end $$;
drop trigger if exists material_lessons_one_family on material_lessons;
create trigger material_lessons_one_family before insert or update of curriculum_lesson_id, family_id on material_lessons
  for each row execute function public.material_lessons_one_family();

-- Phiên bản học liệu đơn vị đang dùng (chưa chọn = phiên bản đã phát hành mới nhất)
create table if not exists material_in_use (
  org_id uuid not null references organizations(id) on delete cascade,
  family_id uuid not null,
  lesson_id uuid not null references material_lessons(id) on delete cascade,
  chosen_by uuid references profiles(id) on delete set null default auth.uid(),
  chosen_at timestamptz not null default now(),
  primary key (org_id, family_id)
);
alter table material_in_use enable row level security;
drop policy if exists material_in_use_read on material_in_use;
create policy material_in_use_read on material_in_use for select to authenticated using (public.is_staff() and org_id in (select public.my_org_tree()));
drop policy if exists material_in_use_write on material_in_use;
create policy material_in_use_write on material_in_use for all to authenticated
  using (public.ph1_can_work(org_id)) with check (public.ph1_can_work(org_id)
    and exists (select 1 from material_lessons l where l.id = lesson_id and l.family_id = material_in_use.family_id));
grant select, insert, update, delete on material_in_use to authenticated;

-- Tạo phiên bản mới: sao nội dung, link học liệu, định mức vật tư của phiên bản nguồn; bản mới là nháp
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
                                product_requirements, steps, criteria, notes, family_id, version_no, status, change_note)
    values (l.set_id, l.curriculum_lesson_id, l.seq, l.code, l.title, l.periods, l.sessions, l.objectives, l.subject_main, l.subjects_integrated,
            l.product_requirements, l.steps, l.criteria, l.notes, l.family_id, v_no, 'draft', nullif(btrim(p_note), ''))
    returning id into v_id;
  insert into material_files (lesson_id, seq, kind, title, url) select v_id, seq, kind, title, url from material_files where lesson_id = l.id;
  insert into material_norms (lesson_id, seq, category, name, spec, unit, qty, basis, consumable, substitute, supply_id)
    select v_id, seq, category, name, spec, unit, qty, basis, consumable, substitute, supply_id from material_norms where lesson_id = l.id;
  insert into audit_log (actor, org_id, entity, entity_id, action, summary)
    values (auth.uid(), public.ph1_parent_org('material_sets', l.set_id), 'material_lessons', v_id::text, 'insert', 'Tạo phiên bản ' || v_no || ' học liệu ' || l.title);
  return v_id;
end $$;

-- Phát hành một phiên bản: báo đơn vị đang dùng bản khác và người soạn bài giảng từ bản cũ
create or replace function public.material_publish(p_lesson uuid) returns void
language plpgsql security definer set search_path = public as $$
declare l material_lessons; v_org uuid; u record; v_body text;
begin
  select * into l from material_lessons where id = p_lesson;
  v_org := public.ph1_parent_org('material_sets', l.set_id);
  if l.id is null or not public.ph1_can_write(v_org) then raise exception 'Bạn không có quyền với học liệu này' using errcode = '42501'; end if;
  update material_lessons set status = 'published' where id = l.id;
  insert into audit_log (actor, org_id, entity, entity_id, action, summary)
    values (auth.uid(), v_org, 'material_lessons', l.id::text, 'update', 'Phát hành phiên bản ' || l.version_no || ' học liệu ' || l.title);
  v_body := l.title || ' · phiên bản ' || l.version_no || coalesce(' — ' || l.change_note, '');
  -- Người soạn bài giảng từ phiên bản cũ
  for u in select distinct d.created_by uid, d.org_id, exists (select 1 from teachers t where t.profile_id = d.created_by) is_teacher
             from lesson_designs d join material_lessons m on m.id = d.material_lesson_id
            where m.family_id = l.family_id and m.version_no < l.version_no and d.created_by is not null loop
    perform public.notify_user(u.uid, u.org_id, 'status', 'Có phiên bản học liệu mới', v_body, 'Soạn bài giảng & kho hoạt động',
      case when u.is_teacher then 'teacher' else 'school_admin' end, l.id, true);
  end loop;
  -- Quản lý của đơn vị đang dùng phiên bản khác
  for u in select distinct m.user_id uid, i.org_id, o.type
             from material_in_use i join organizations o on o.id = i.org_id
             join memberships m on m.org_id = i.org_id join roles r on r.id = m.role_id
            where i.family_id = l.family_id and i.lesson_id <> l.id and r.org_id is null
              and r.key in ('principal', 'it_admin', 'ministry', 'province', 'department', 'district', 'provider', 'platform_admin') loop
    perform public.notify_user(u.uid, u.org_id, 'status', 'Có phiên bản học liệu mới', v_body, 'Học liệu',
      case when u.type = 'school' then 'school_admin' when u.type = 'provider' then 'platform' else 'department' end, l.id, true);
  end loop;
end $$;
grant execute on function public.material_new_version(uuid, text), public.material_publish(uuid) to authenticated;
