-- 061. PH1 · 1.1 cây tổ chức theo docs/PH1-cau-truc-1.1.md. Cần chạy sau 060.
--   Danh mục: thêm Khối (thuộc một Cấp học) và Lớp (thuộc một Khối) — cột parent_code nối cấp trên
--   Chương trình › Cấp học › Khối › Môn học › Bài học: bài học có Số buổi
--   Học liệu: thêm loại link "Bài giảng"
--   Phân phối: theo Cấp học › Khối (bắt buộc), Trường tuỳ chọn; một bản phân phối gồm nhiều môn của nhiều chương trình,
--              mỗi môn là một khối lịch (ppct_chapters) xếp theo Học kỳ › Tuần › Buổi

-- ===== 1. Danh mục Khối, Lớp =====
alter table curriculum_catalog add column if not exists parent_code text;   -- khối → mã cấp học; lớp → mã khối
alter table curriculum_catalog drop constraint if exists curriculum_catalog_kind_check;
alter table curriculum_catalog add constraint curriculum_catalog_kind_check
  check (kind in ('category', 'level', 'grade', 'class', 'subject', 'field', 'outcome_type', 'assessment_method', 'package_tier'));
-- Khối mặc định của hệ thống (mã khối = số khối, dùng chung với cột grade của các bảng)
insert into curriculum_catalog (owner_org_id, kind, code, name, parent_code, sort)
  select null, 'grade', g::text, case when g = 0 then 'Mầm non' else 'Khối ' || g end,
         case when g = 0 then 'mamnon' when g <= 5 then 'tieuhoc' when g <= 9 then 'thcs' else 'thpt' end, g
    from generate_series(0, 12) g
on conflict do nothing;
update curriculum_catalog set parent_code = case when code = '0' then 'mamnon' when code::int <= 5 then 'tieuhoc' when code::int <= 9 then 'thcs' else 'thpt' end
  where kind = 'grade' and owner_org_id is null and parent_code is null and code ~ '^\d+$';
-- Khối phải là số 0–12 (để nối với cột grade)
alter table curriculum_catalog drop constraint if exists curriculum_catalog_grade_code;
alter table curriculum_catalog add constraint curriculum_catalog_grade_code check (kind <> 'grade' or code ~ '^(\d|1[0-2])$');

-- ===== 2. Bài học: số buổi =====
alter table curriculum_lessons add column if not exists sessions int not null default 1;
alter table curriculum_lessons drop constraint if exists curriculum_lessons_sessions_check;
alter table curriculum_lessons add constraint curriculum_lessons_sessions_check check (sessions between 1 and 50);
-- Sao chép phiên bản / kế thừa giữ số buổi
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
  insert into curriculum_lessons (id, version_id, unit_id, seq, code, title, summary, periods, sessions, minutes_per_period, period_plan, library_item_id, notes)
    select m.new_id, p_to, mu.new_id, l.seq, l.code, l.title, l.summary, l.periods, l.sessions, l.minutes_per_period, l.period_plan, l.library_item_id, l.notes
      from curriculum_lessons l join _cur_map m on m.old_id = l.id join _cur_map mu on mu.old_id = l.unit_id where l.version_id = p_from;
  insert into curriculum_outcomes (id, version_id, unit_id, lesson_id, seq, code, kind, subject, description, competency_key)
    select m.new_id, p_to, mu.new_id, ml.new_id, o.seq, o.code, o.kind, o.subject, o.description, o.competency_key
      from curriculum_outcomes o join _cur_map m on m.old_id = o.id
      left join _cur_map mu on mu.old_id = o.unit_id left join _cur_map ml on ml.old_id = o.lesson_id where o.version_id = p_from;
  insert into curriculum_assessments (version_id, unit_id, lesson_id, seq, title, method, outcome_ids, rubric_id, criteria, evidence, weight)
    select p_to, mu.new_id, ml.new_id, a.seq, a.title, a.method,
           coalesce((select array_agg(mo.new_id) from unnest(a.outcome_ids) x join _cur_map mo on mo.old_id = x), '{}'),
           a.rubric_id, a.criteria, a.evidence, a.weight
      from curriculum_assessments a left join _cur_map mu on mu.old_id = a.unit_id left join _cur_map ml on ml.old_id = a.lesson_id
     where a.version_id = p_from;
end $$;
revoke execute on function public.curriculum_copy_content(uuid, uuid) from public, anon, authenticated;

-- ===== 3. Học liệu: link "Bài giảng" =====
alter table material_files drop constraint if exists material_files_kind_check;
alter table material_files add constraint material_files_kind_check
  check (kind in ('bai_giang', 'giao_an', 'huong_dan', 'phieu_hoc_tap', 'hinh_anh', 'video', 'tham_khao'));

-- ===== 4. Phân phối nhiều môn theo khối =====
alter table ppct_docs alter column subject drop not null;
alter table ppct_docs add column if not exists target_org_id uuid references organizations(id) on delete cascade;  -- null = tất cả trường
alter table ppct_chapters add column if not exists curriculum_id uuid references curricula(id) on delete set null;
alter table ppct_chapters add column if not exists subject text;
alter table ppct_rows add column if not exists sessions int not null default 1;
alter table ppct_rows drop constraint if exists ppct_rows_sessions_check;
alter table ppct_rows add constraint ppct_rows_sessions_check check (sessions between 1 and 50);
-- Trường được chọn đọc được bản phân phối dành cho mình
drop policy if exists ppct_docs_read on ppct_docs;
create policy ppct_docs_read on ppct_docs for select to authenticated using (
  public.ph1_can_read(org_id) or (target_org_id is not null and target_org_id in (select public.my_org_tree())));

-- Dựng lịch từ các môn đã chọn: p_items = [{curriculum_id, subject}] theo thứ tự dạy.
-- Mỗi môn → một khối lịch (chương), mỗi bài học đúng khối → một dòng (số tiết, số buổi của bài); học kỳ chia theo sức chứa HK I.
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
    if c.id is null or c.current_version_id is null then continue; end if;
    v_seq := v_seq + 1; v_sem := case when v_cum < v_cap or d.weeks_hk2 = 0 then 1 else 2 end;
    insert into ppct_chapters (doc_id, semester, seq, title, curriculum_id, subject)
      values (d.id, v_sem, v_seq,
              coalesce((select name from curriculum_catalog where kind = 'subject' and code = it->>'subject' order by owner_org_id nulls first limit 1), it->>'subject')
                || ' · ' || coalesce(c.code, c.name),
              c.id, it->>'subject') returning id into v_ch;
    k := 0;
    for l in select cl.* from curriculum_lessons cl join curriculum_units u on u.id = cl.unit_id
              where u.version_id = c.current_version_id and u.subject_main = it->>'subject' and u.grade = d.grade order by u.seq, cl.seq loop
      k := k + 1; n := n + 1; v_cum := v_cum + greatest(l.periods, 1);
      insert into ppct_rows (doc_id, chapter_id, seq, title, periods, sessions, kind, curriculum_lesson_id, material_lesson_id)
        values (d.id, v_ch, k, l.title, least(greatest(l.periods, 1), 20), l.sessions, 'bai_hoc', l.id,
                (select ml.id from material_lessons ml where ml.curriculum_lesson_id = l.id limit 1));
    end loop;
  end loop;
  return n;
end $$;
revoke execute on function public.ppct_doc_build_internal(uuid, jsonb, boolean) from public, anon, authenticated;
create or replace function public.ppct_doc_build(p_doc uuid, p_items jsonb, p_replace boolean default true) returns int
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from ppct_docs where id = p_doc and public.ph1_can_write(org_id)) then raise exception 'Bạn không có quyền với bản phân phối này' using errcode = '42501'; end if;
  return public.ppct_doc_build_internal(p_doc, p_items, p_replace);
end $$;
grant execute on function public.ppct_doc_build(uuid, jsonb, boolean) to authenticated;

-- Sao chép văn bản giữ cột mới
create or replace function public.ppct_doc_copy(p_doc uuid, p_org uuid default null, p_year text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare d ppct_docs; v_new uuid; v_org uuid := coalesce(p_org, public.my_org_id());
begin
  select * into d from ppct_docs where id = p_doc;
  if d.id is null or not (public.ph1_can_read(d.org_id) or d.target_org_id in (select public.my_org_tree())) then raise exception 'Không tìm thấy văn bản' using errcode = '42501'; end if;
  if not public.ph1_can_write(v_org) then raise exception 'Bạn không có quyền lập PPCT cho đơn vị này' using errcode = '42501'; end if;
  insert into ppct_docs (org_id, target_org_id, level, subject, grade, school_year, title, weeks_hk1, weeks_hk2, ppw_hk1, ppw_hk2, minutes_per_period, curriculum_id, status, issuer, notes, based_on_id)
    values (v_org, case when v_org = d.org_id then d.target_org_id end, d.level, d.subject, d.grade, coalesce(p_year, d.school_year), d.title, d.weeks_hk1, d.weeks_hk2, d.ppw_hk1, d.ppw_hk2,
            d.minutes_per_period, d.curriculum_id, 'draft', (select name from organizations where id = v_org), d.notes, d.id) returning id into v_new;
  create temp table if not exists _ppct_map (old_id uuid primary key, new_id uuid not null) on commit drop;
  delete from _ppct_map;
  insert into _ppct_map select id, gen_random_uuid() from ppct_strands where doc_id = d.id;
  insert into _ppct_map select id, gen_random_uuid() from ppct_chapters where doc_id = d.id;
  insert into ppct_strands (id, doc_id, seq, name) select m.new_id, v_new, s.seq, s.name from ppct_strands s join _ppct_map m on m.old_id = s.id;
  insert into ppct_chapters (id, doc_id, semester, seq, title, strand_id, curriculum_unit_id, curriculum_id, subject, note)
    select m.new_id, v_new, c.semester, c.seq, c.title, ms.new_id, c.curriculum_unit_id, c.curriculum_id, c.subject, c.note
      from ppct_chapters c join _ppct_map m on m.old_id = c.id left join _ppct_map ms on ms.old_id = c.strand_id;
  insert into ppct_rows (doc_id, chapter_id, seq, title, periods, sessions, part_label, kind, strand_id, week_override, curriculum_lesson_id, material_lesson_id, note)
    select v_new, mc.new_id, r.seq, r.title, r.periods, r.sessions, r.part_label, r.kind, ms.new_id, r.week_override, r.curriculum_lesson_id, r.material_lesson_id, r.note
      from ppct_rows r join _ppct_map mc on mc.old_id = r.chapter_id left join _ppct_map ms on ms.old_id = r.strand_id;
  return v_new;
end $$;

-- ===== 5. Dữ liệu mẫu (chỉ khi bật app.seed_demo) =====
do $$
declare v_kdi uuid; v_ph uuid; d uuid; g int; s text;
begin
  if coalesce(current_setting('app.seed_demo', true), '') <> 'on' then return; end if; -- dữ liệu mẫu: chỉ chạy khi bật cờ app.seed_demo
  select id into v_kdi from organizations where is_platform limit 1;
  select id into v_ph from organizations where code = 'THCS-PH';
  -- Số buổi của bài: theo học liệu nếu có, không thì ~2 tiết / buổi
  update curriculum_lessons cl set sessions = coalesce((select ml.sessions from material_lessons ml where ml.curriculum_lesson_id = cl.id limit 1), greatest(1, ceil(cl.periods / 2.0)::int));
  -- Lớp mẫu của THCS Phố Hiến
  if v_ph is not null then
    foreach g in array array[6, 7, 8, 9] loop
      foreach s in array array['A1', 'A2', 'A3'] loop
        insert into curriculum_catalog (owner_org_id, kind, code, name, parent_code, sort) values (v_ph, 'class', g || s, 'Lớp ' || g || s, g::text, g * 10)
          on conflict do nothing;
      end loop;
    end loop;
  end if;
  -- Bản phân phối khối 6 cho tất cả trường (KDI): các môn của CT1 + CT2 khối 6
  if v_kdi is not null and not exists (select 1 from ppct_docs where org_id = v_kdi and grade = 6 and subject is null) then
    insert into ppct_docs (org_id, level, subject, grade, school_year, title, weeks_hk1, weeks_hk2, ppw_hk1, ppw_hk2, minutes_per_period, status, issuer, notes)
      values (v_kdi, 'thcs', null, 6, '2026-2027', 'Phân phối STEM khối 6 – tất cả trường', 18, 17, 2, 2, 45, 'published', 'KDI EDUCATION',
              'Ghép các môn khối 6 của chương trình CT1, CT2.') returning id into d;
    perform public.ppct_doc_build_internal(d, coalesce((select jsonb_agg(jsonb_build_object('curriculum_id', x.cid, 'subject', x.subject) order by x.code, x.subject)
      from (select distinct c.id cid, c.code, u.subject_main subject from curricula c join curriculum_units u on u.version_id = c.current_version_id
            where c.owner_org_id = v_kdi and c.code in ('CT1', 'CT2') and u.grade = 6 and u.subject_main is not null) x), '[]'::jsonb));
  end if;
end $$;
