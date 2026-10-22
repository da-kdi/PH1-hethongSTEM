-- 060. PH1 · 1.1.3 Phân phối chương trình — văn bản PPCT theo cấp – môn – khối – năm học.
-- Cần chạy sau 059.
--   ppct_docs     : một văn bản PPCT (cấp, môn, khối, năm học; số tuần × tiết/tuần từng học kỳ; số phút/tiết; liên kết chương trình giáo dục)
--   ppct_strands  : mạch nội dung / cột phân bổ (vd Số & Đại số, Thống kê, Hình học, Ôn tập – KT, Trải nghiệm) — tuỳ biến theo môn
--   ppct_chapters : chương / chủ đề theo học kỳ, gắn mạch
--   ppct_rows     : dòng bài học (số tiết, phần T1/T2, loại: bài học / luyện tập / ôn tập / kiểm tra / trải nghiệm), gắn bài chuẩn / học liệu
-- Tiết PPCT (đánh số liên tục cả năm) và tuần (theo tiết/tuần của học kỳ) được tính khi hiển thị; dòng có thể ghi đè tuần.
-- Kèm: cho phép đơn vị sở hữu xoá chương trình giáo dục kể cả đã ban hành (bản dựng khung).

-- ===== 1. Bảng =====
create table if not exists ppct_docs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,      -- đơn vị lập / ban hành (KDI, Sở, trường)
  level text,                                                               -- mã danh mục 'level' (tieuhoc, thcs, thpt…)
  subject text not null,                                                    -- mã danh mục 'subject'
  grade int not null check (grade between 0 and 12),
  school_year text not null check (school_year ~ '^\d{4}-\d{4}$'),
  title text,
  weeks_hk1 int not null default 18 check (weeks_hk1 between 0 and 30),
  weeks_hk2 int not null default 17 check (weeks_hk2 between 0 and 30),
  ppw_hk1 numeric(4,1) not null default 1 check (ppw_hk1 > 0),
  ppw_hk2 numeric(4,1) not null default 1 check (ppw_hk2 > 0),
  minutes_per_period int not null default 45 check (minutes_per_period between 5 and 240),
  curriculum_id uuid references curricula(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  issuer text,                                                              -- dòng tiêu đề trái (vd UBND PHƯỜNG … / TRƯỜNG THCS …)
  notes text,
  based_on_id uuid references ppct_docs(id) on delete set null,
  created_by uuid references profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ppct_docs_org_idx on ppct_docs (org_id, school_year, grade);
create table if not exists ppct_strands (
  id uuid primary key default gen_random_uuid(),
  doc_id uuid not null references ppct_docs(id) on delete cascade,
  seq int not null default 1,
  name text not null check (length(btrim(name)) between 1 and 120)
);
create table if not exists ppct_chapters (
  id uuid primary key default gen_random_uuid(),
  doc_id uuid not null references ppct_docs(id) on delete cascade,
  semester int not null default 1 check (semester in (1, 2)),
  seq int not null default 1,
  title text not null check (length(btrim(title)) between 1 and 300),
  strand_id uuid references ppct_strands(id) on delete set null,
  curriculum_unit_id uuid references curriculum_units(id) on delete set null,
  note text
);
create index if not exists ppct_chapters_doc_idx on ppct_chapters (doc_id, semester, seq);
create table if not exists ppct_rows (
  id uuid primary key default gen_random_uuid(),
  doc_id uuid not null references ppct_docs(id) on delete cascade,
  chapter_id uuid not null references ppct_chapters(id) on delete cascade,
  seq int not null default 1,
  title text not null check (length(btrim(title)) between 1 and 300),
  periods int not null default 1 check (periods between 1 and 20),        -- số tiết của dòng (vd "6, 7 · Luyện tập chung" = 2)
  part_label text,                                                        -- (T1), (T2)…
  kind text not null default 'bai_hoc' check (kind in ('bai_hoc', 'luyen_tap', 'on_tap', 'kiem_tra', 'trai_nghiem')),
  strand_id uuid references ppct_strands(id) on delete set null,          -- ghi đè mạch của chương
  week_override int check (week_override is null or week_override between 1 and 60),
  curriculum_lesson_id uuid references curriculum_lessons(id) on delete set null,
  material_lesson_id uuid references material_lessons(id) on delete set null,
  note text
);
create index if not exists ppct_rows_chapter_idx on ppct_rows (chapter_id, seq);
drop trigger if exists ppct_docs_touch on ppct_docs;
create trigger ppct_docs_touch before update on ppct_docs for each row execute function public.touch_updated_at();

-- ===== 2. Quyền =====
create or replace function public.ph1_parent_org(p_table text, p_id uuid) returns uuid
language plpgsql stable security definer set search_path = public as $$
declare v uuid;
begin
  case p_table
    when 'program_packages' then select owner_org_id into v from program_packages where id = p_id;
    when 'material_sets' then select owner_org_id into v from material_sets where id = p_id;
    when 'material_lessons' then select s.owner_org_id into v from material_lessons l join material_sets s on s.id = l.set_id where l.id = p_id;
    when 'ppct_plans' then select org_id into v from ppct_plans where id = p_id;
    when 'ppct_docs' then select org_id into v from ppct_docs where id = p_id;
    else v := null;
  end case;
  return v;
end $$;

alter table ppct_docs enable row level security;
alter table ppct_strands enable row level security;
alter table ppct_chapters enable row level security;
alter table ppct_rows enable row level security;
drop policy if exists ppct_docs_read on ppct_docs;
create policy ppct_docs_read on ppct_docs for select to authenticated using (public.ph1_can_read(org_id));
drop policy if exists ppct_docs_write on ppct_docs;
create policy ppct_docs_write on ppct_docs for all to authenticated using (public.ph1_can_write(org_id)) with check (public.ph1_can_write(org_id));
do $$
declare t text;
begin
  foreach t in array array['ppct_strands', 'ppct_chapters', 'ppct_rows'] loop
    execute format('drop policy if exists %I on %I', t || '_read', t);
    execute format('create policy %I on %I for select to authenticated using (public.ph1_can_read(public.ph1_parent_org(%L, doc_id)))', t || '_read', t, 'ppct_docs');
    execute format('drop policy if exists %I on %I', t || '_write', t);
    execute format('create policy %I on %I for all to authenticated using (public.ph1_can_write(public.ph1_parent_org(%L, doc_id))) with check (public.ph1_can_write(public.ph1_parent_org(%L, doc_id)))', t || '_write', t, 'ppct_docs', 'ppct_docs');
  end loop;
end $$;
grant select, insert, update, delete on ppct_docs, ppct_strands, ppct_chapters, ppct_rows to authenticated;

-- Chương / dòng phải cùng văn bản
create or replace function public.ppct_rows_check() returns trigger language plpgsql set search_path = public as $$
begin
  if not exists (select 1 from ppct_chapters c where c.id = new.chapter_id and c.doc_id = new.doc_id) then
    raise exception 'Chương không thuộc văn bản PPCT này' using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists ppct_rows_check on ppct_rows;
create trigger ppct_rows_check before insert or update on ppct_rows for each row execute function public.ppct_rows_check();

-- Sao chép một văn bản PPCT (sang năm học / đơn vị khác) — gồm mạch, chương, dòng
create or replace function public.ppct_doc_copy(p_doc uuid, p_org uuid default null, p_year text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare d ppct_docs; v_new uuid; v_org uuid := coalesce(p_org, public.my_org_id());
begin
  select * into d from ppct_docs where id = p_doc;
  if d.id is null or not public.ph1_can_read(d.org_id) then raise exception 'Không tìm thấy văn bản' using errcode = '42501'; end if;
  if not public.ph1_can_write(v_org) then raise exception 'Bạn không có quyền lập PPCT cho đơn vị này' using errcode = '42501'; end if;
  insert into ppct_docs (org_id, level, subject, grade, school_year, title, weeks_hk1, weeks_hk2, ppw_hk1, ppw_hk2, minutes_per_period, curriculum_id, status, issuer, notes, based_on_id)
    values (v_org, d.level, d.subject, d.grade, coalesce(p_year, d.school_year), d.title, d.weeks_hk1, d.weeks_hk2, d.ppw_hk1, d.ppw_hk2, d.minutes_per_period, d.curriculum_id,
            'draft', (select name from organizations where id = v_org), d.notes, d.id) returning id into v_new;
  create temp table if not exists _ppct_map (old_id uuid primary key, new_id uuid not null) on commit drop;
  delete from _ppct_map;
  insert into _ppct_map select id, gen_random_uuid() from ppct_strands where doc_id = d.id;
  insert into _ppct_map select id, gen_random_uuid() from ppct_chapters where doc_id = d.id;
  insert into ppct_strands (id, doc_id, seq, name) select m.new_id, v_new, s.seq, s.name from ppct_strands s join _ppct_map m on m.old_id = s.id;
  insert into ppct_chapters (id, doc_id, semester, seq, title, strand_id, curriculum_unit_id, note)
    select m.new_id, v_new, c.semester, c.seq, c.title, ms.new_id, c.curriculum_unit_id, c.note
      from ppct_chapters c join _ppct_map m on m.old_id = c.id left join _ppct_map ms on ms.old_id = c.strand_id;
  insert into ppct_rows (doc_id, chapter_id, seq, title, periods, part_label, kind, strand_id, week_override, curriculum_lesson_id, material_lesson_id, note)
    select v_new, mc.new_id, r.seq, r.title, r.periods, r.part_label, r.kind, ms.new_id, r.week_override, r.curriculum_lesson_id, r.material_lesson_id, r.note
      from ppct_rows r join _ppct_map mc on mc.old_id = r.chapter_id left join _ppct_map ms on ms.old_id = r.strand_id;
  return v_new;
end $$;
grant execute on function public.ppct_doc_copy(uuid, uuid, text) to authenticated;

-- Dựng chương / dòng từ chương trình giáo dục (chủ đề → chương, bài → dòng; bài nhiều tiết tách T1, T2…)
create or replace function public.ppct_doc_from_curriculum(p_doc uuid, p_replace boolean default true) returns int
language plpgsql security definer set search_path = public as $$
declare d ppct_docs; v_ver uuid; u record; l record; v_ch uuid; n int := 0; k int; useq int := 0; v_sem int; v_cum numeric := 0; v_cap numeric;
begin
  select * into d from ppct_docs where id = p_doc;
  if d.id is null or not public.ph1_can_write(d.org_id) then raise exception 'Bạn không có quyền với văn bản này' using errcode = '42501'; end if;
  v_ver := (select current_version_id from curricula where id = d.curriculum_id);
  if v_ver is null then raise exception 'Văn bản chưa gắn chương trình giáo dục đang hiệu lực' using errcode = '22023'; end if;
  if p_replace then delete from ppct_chapters where doc_id = d.id; end if;
  v_cap := d.weeks_hk1 * d.ppw_hk1;
  for u in select * from curriculum_units where version_id = v_ver and subject_main = d.subject and grade = d.grade order by seq loop
    useq := useq + 1; v_sem := case when v_cum < v_cap then 1 else 2 end;
    insert into ppct_chapters (doc_id, semester, seq, title, curriculum_unit_id, note) values (d.id, v_sem, useq, u.title, u.id, u.summary) returning id into v_ch;
    k := 0;
    for l in select * from curriculum_lessons where unit_id = u.id order by seq loop
      for j in 1 .. greatest(l.periods, 1) loop
        k := k + 1; n := n + 1; v_cum := v_cum + 1;
        insert into ppct_rows (doc_id, chapter_id, seq, title, periods, part_label, kind, curriculum_lesson_id)
          values (d.id, v_ch, k, l.title, 1, case when l.periods > 1 then 'T' || j end, 'bai_hoc', l.id);
      end loop;
    end loop;
  end loop;
  return n;
end $$;
grant execute on function public.ppct_doc_from_curriculum(uuid, boolean) to authenticated;

-- ===== 3. Xoá chương trình giáo dục: đơn vị sở hữu xoá được kể cả đã ban hành (gói / kế hoạch tham chiếu được gỡ theo) =====
drop policy if exists curricula_delete on curricula;
create policy curricula_delete on curricula for delete to authenticated using (
  owner_org_id = (select public.my_org_id()) and (select public.curriculum_can_manage()));
-- Phiên bản đã ban hành bị xoá theo chương trình: bỏ chặn của trigger khi xoá dây chuyền (trigger chỉ chạy ON UPDATE / INSERT) — không cần thay đổi

-- ===== 4. Dữ liệu mẫu (chỉ khi bật app.seed_demo) =====
-- Toán 8 – THCS Phố Hiến 2026–2027: 35 tuần × 4 tiết/tuần = 140 tiết (HK I 18 × 4 = 72; HK II 17 × 4 = 68), theo cấu trúc văn bản mẫu của trường.
create or replace function pg_temp.d_ch(p_doc uuid, p_sem int, p_seq int, p_title text, p_strand uuid, p_rows jsonb) returns void language plpgsql as $$
declare v_ch uuid; r jsonb; k int := 0;
begin
  insert into ppct_chapters (doc_id, semester, seq, title, strand_id) values (p_doc, p_sem, p_seq, p_title, p_strand) returning id into v_ch;
  for r in select * from jsonb_array_elements(p_rows) loop
    k := k + 1;
    insert into ppct_rows (doc_id, chapter_id, seq, title, periods, part_label, kind)
      values (p_doc, v_ch, k, r->>0, coalesce((r->>1)::int, 1), nullif(r->>2, ''), coalesce(nullif(r->>3, ''), 'bai_hoc'));
  end loop;
end $$;

do $$
declare v_ph uuid; v_kdi uuid; d uuid; s_ds uuid; s_tk uuid; s_hh uuid; s_ot uuid; s_tn uuid; v_c2 uuid; d2 uuid; x uuid;
begin
  if coalesce(current_setting('app.seed_demo', true), '') <> 'on' then return; end if; -- dữ liệu mẫu: chỉ chạy khi bật cờ app.seed_demo
  select id into v_ph from organizations where code = 'THCS-PH';
  select id into v_kdi from organizations where is_platform limit 1;
  if v_ph is null or exists (select 1 from ppct_docs where org_id = v_ph and subject = 'toan' and grade = 8) then return; end if;
  insert into ppct_docs (org_id, level, subject, grade, school_year, title, weeks_hk1, weeks_hk2, ppw_hk1, ppw_hk2, minutes_per_period, status, issuer)
    values (v_ph, 'thcs', 'toan', 8, '2026-2027', 'Phân phối chương trình môn Toán 8', 18, 17, 4, 4, 45, 'published', 'UBND PHƯỜNG · TRƯỜNG THCS PHỐ HIẾN') returning id into d;
  insert into ppct_strands (doc_id, seq, name) values (d, 1, 'Số & Đại số') returning id into s_ds;
  insert into ppct_strands (doc_id, seq, name) values (d, 2, 'Thống kê') returning id into s_tk;
  insert into ppct_strands (doc_id, seq, name) values (d, 3, 'Hình học') returning id into s_hh;
  insert into ppct_strands (doc_id, seq, name) values (d, 4, 'Ôn tập – KT') returning id into s_ot;
  insert into ppct_strands (doc_id, seq, name) values (d, 5, 'Trải nghiệm thực hành') returning id into s_tn;
  -- Học kì I (72 tiết)
  perform pg_temp.d_ch(d, 1, 1, 'Chương I: Đa thức', s_ds, '[["Bài 1: Đơn thức",1,"T1"],["Bài 1: Đơn thức",1,"T2"],["Bài 2: Đa thức",1,"T1"],["Bài 2: Đa thức",1,"T2"],["Bài 3: Phép cộng và phép trừ đa thức",1],["Luyện tập chung",2,"","luyen_tap"],["Bài 4: Phép nhân đa thức",1,"T1"],["Bài 4: Phép nhân đa thức",1,"T2"],["Bài 5: Phép chia đa thức cho đơn thức",1],["Luyện tập chung",1,"","luyen_tap"],["Bài tập cuối chương I",1,"T1","luyen_tap"],["Bài tập cuối chương I",1,"T2","luyen_tap"]]');
  perform pg_temp.d_ch(d, 1, 2, 'Chương II: Hằng đẳng thức đáng nhớ và ứng dụng', s_ds, '[["Bài 6: Hiệu hai bình phương. Bình phương của một tổng hay một hiệu",1,"T1"],["Bài 6: Hiệu hai bình phương. Bình phương của một tổng hay một hiệu",1,"T2"],["Bài 7: Lập phương của một tổng. Lập phương của một hiệu",1,"T1"],["Bài 7: Lập phương của một tổng. Lập phương của một hiệu",1,"T2"],["Bài 8: Tổng và hiệu hai lập phương",1,"T1"],["Bài 8: Tổng và hiệu hai lập phương",1,"T2"],["Luyện tập chung",1,"T1","luyen_tap"],["Luyện tập chung",1,"T2","luyen_tap"],["Bài 9: Phân tích đa thức thành nhân tử",1,"T1"],["Bài 9: Phân tích đa thức thành nhân tử",1,"T2"],["Bài 9: Phân tích đa thức thành nhân tử",1,"T3"],["Luyện tập chung",1,"","luyen_tap"],["Bài tập cuối chương II + Kiểm tra TX1",1,"","kiem_tra"]]');
  perform pg_temp.d_ch(d, 1, 3, 'Chương III: Tứ giác', s_hh, '[["Bài 10: Tứ giác",1],["Bài 11: Hình thang cân",1,"T1"],["Bài 11: Hình thang cân",1,"T2"],["Luyện tập chung",1,"","luyen_tap"],["Bài 12: Hình bình hành",1,"T1"],["Bài 12: Hình bình hành",1,"T2"],["Bài 12: Hình bình hành",1,"T3"],["Bài 13: Hình chữ nhật",1,"T1"],["Bài 13: Hình chữ nhật",1,"T2"],["Bài 14: Hình thoi và hình vuông",1,"T1"],["Bài 14: Hình thoi và hình vuông",1,"T2"],["Bài 14: Hình thoi và hình vuông",1,"T3"],["Luyện tập chung",1,"","luyen_tap"],["Bài tập cuối chương III",1,"T1","luyen_tap"],["Bài tập cuối chương III",1,"T2","luyen_tap"]]');
  perform pg_temp.d_ch(d, 1, 4, 'Ôn tập, kiểm tra giữa học kì I', s_ot, '[["Ôn tập giữa học kì I",2,"","on_tap"],["Kiểm tra giữa học kì I",1,"","kiem_tra"]]');
  perform pg_temp.d_ch(d, 1, 5, 'Chương IV: Định lí Thalès', s_hh, '[["Bài 15: Định lí Thalès trong tam giác",1,"T1"],["Bài 15: Định lí Thalès trong tam giác",1,"T2"],["Bài 16: Đường trung bình của tam giác",1,"T1"],["Bài 16: Đường trung bình của tam giác",1,"T2"],["Bài 17: Tính chất đường phân giác của tam giác",1,"T1"],["Bài 17: Tính chất đường phân giác của tam giác",1,"T2"],["Luyện tập chung",2,"","luyen_tap"],["Bài tập cuối chương IV",2,"","luyen_tap"]]');
  perform pg_temp.d_ch(d, 1, 6, 'Chương V: Dữ liệu và biểu đồ', s_tk, '[["Bài 18: Thu thập và phân loại dữ liệu",2],["Bài 19: Biểu diễn dữ liệu bằng bảng, biểu đồ",2],["Bài 20: Phân tích số liệu thống kê dựa vào biểu đồ",2],["Luyện tập chung",1,"","luyen_tap"],["Bài tập cuối chương V",1,"","luyen_tap"]]');
  perform pg_temp.d_ch(d, 1, 7, 'Hoạt động thực hành trải nghiệm', s_tn, '[["Vẽ hình đơn giản với phần mềm GeoGebra",2,"","trai_nghiem"],["Dự án STEM: Mô hình cầu giàn (tích hợp CT2)",3,"","trai_nghiem"]]');
  perform pg_temp.d_ch(d, 1, 8, 'Ôn tập, kiểm tra cuối học kì I', s_ot, '[["Ôn tập cuối học kì I",3,"","on_tap"],["Kiểm tra cuối học kì I",2,"","kiem_tra"]]');
  -- Học kì II (68 tiết)
  perform pg_temp.d_ch(d, 2, 1, 'Chương VI: Phân thức đại số', s_ds, '[["Bài 21: Phân thức đại số",2],["Bài 22: Tính chất cơ bản của phân thức đại số",2],["Luyện tập chung",1,"","luyen_tap"],["Bài 23: Phép cộng và phép trừ phân thức đại số",3],["Bài 24: Phép nhân và phép chia phân thức đại số",3],["Luyện tập chung",2,"","luyen_tap"],["Bài tập cuối chương VI",2,"","luyen_tap"]]');
  perform pg_temp.d_ch(d, 2, 2, 'Chương VII: Phương trình bậc nhất và hàm số bậc nhất', s_ds, '[["Bài 25: Phương trình bậc nhất một ẩn",2],["Bài 26: Giải bài toán bằng cách lập phương trình",2],["Luyện tập chung",1,"","luyen_tap"],["Bài 27: Khái niệm hàm số và đồ thị của hàm số",2],["Bài 28: Hàm số bậc nhất và đồ thị của hàm số bậc nhất",2],["Bài 29: Hệ số góc của đường thẳng",2],["Luyện tập chung",1,"","luyen_tap"],["Bài tập cuối chương VII",1,"","luyen_tap"]]');
  perform pg_temp.d_ch(d, 2, 3, 'Ôn tập, kiểm tra giữa học kì II', s_ot, '[["Ôn tập giữa học kì II",2,"","on_tap"],["Kiểm tra giữa học kì II",1,"","kiem_tra"]]');
  perform pg_temp.d_ch(d, 2, 4, 'Chương VIII: Mở đầu về tính xác suất của biến cố', s_tk, '[["Bài 30: Kết quả có thể và kết quả thuận lợi",2],["Bài 31: Cách tính xác suất của biến cố bằng tỉ số",2],["Bài 32: Mối liên hệ giữa xác suất thực nghiệm với xác suất và ứng dụng",2],["Bài tập cuối chương VIII",1,"","luyen_tap"]]');
  perform pg_temp.d_ch(d, 2, 5, 'Chương IX: Tam giác đồng dạng', s_hh, '[["Bài 33: Hai tam giác đồng dạng",2],["Bài 34: Ba trường hợp đồng dạng của hai tam giác",3],["Luyện tập chung",2,"","luyen_tap"],["Bài 35: Định lí Pythagore và ứng dụng",3],["Bài 36: Các trường hợp đồng dạng của hai tam giác vuông",2],["Bài tập cuối chương IX",2,"","luyen_tap"]]');
  perform pg_temp.d_ch(d, 2, 6, 'Chương X: Một số hình khối trong thực tiễn', s_hh, '[["Bài 37: Hình chóp tam giác đều",3],["Bài 38: Hình chóp tứ giác đều",3],["Bài tập cuối chương X",2,"","luyen_tap"]]');
  perform pg_temp.d_ch(d, 2, 7, 'Hoạt động thực hành trải nghiệm', s_tn, '[["Vẽ đồ thị hàm số bậc nhất bằng GeoGebra",2,"","trai_nghiem"],["Ứng dụng định lí Thalès, tam giác đồng dạng để đo chiều cao, khoảng cách",2,"","trai_nghiem"]]');
  perform pg_temp.d_ch(d, 2, 8, 'Ôn tập, kiểm tra cuối năm', s_ot, '[["Ôn tập cuối năm",2,"","on_tap"],["Kiểm tra cuối học kì II",2,"","kiem_tra"]]');

  -- KHTN 6 (STEM Liên môn CT2 của KDI) dựng tự động từ chương trình giáo dục — KDI ban hành để các trường sao chép
  select id into v_c2 from curricula where owner_org_id = v_kdi and code = 'CT2';
  if v_kdi is not null and v_c2 is not null then
    insert into ppct_docs (org_id, level, subject, grade, school_year, title, weeks_hk1, weeks_hk2, ppw_hk1, ppw_hk2, minutes_per_period, curriculum_id, status, issuer, notes)
      values (v_kdi, 'thcs', 'khtn', 6, '2026-2027', 'PPCT STEM Liên môn KHTN 6 (CT2)', 7, 0, 2, 1, 45, v_c2, 'published', 'KDI EDUCATION',
              'Thời lượng STEM lồng ghép trong môn KHTN 6; dựng từ chương trình CT2.') returning id into d2;
    insert into ppct_strands (doc_id, seq, name) values (d2, 1, 'Chất và sự biến đổi'), (d2, 2, 'Vật sống'), (d2, 3, 'Năng lượng');
    -- dựng như ppct_doc_from_curriculum (không kiểm quyền vì chạy khi seed)
    declare u record; l record; v_ch uuid; k int; useq int := 0;
    begin
      for u in select cu.* from curriculum_units cu join curricula c on c.current_version_id = cu.version_id where c.id = v_c2 and cu.subject_main = 'khtn' and cu.grade = 6 order by cu.seq loop
        useq := useq + 1;
        insert into ppct_chapters (doc_id, semester, seq, title, curriculum_unit_id, strand_id)
          values (d2, 1, useq, 'Chủ đề ' || useq || ': ' || u.title, u.id, (select id from ppct_strands where doc_id = d2 and seq = useq)) returning id into v_ch;
        k := 0;
        for l in select * from curriculum_lessons where unit_id = u.id order by seq loop
          for j in 1 .. greatest(l.periods, 1) loop
            k := k + 1;
            insert into ppct_rows (doc_id, chapter_id, seq, title, periods, part_label, kind, curriculum_lesson_id, material_lesson_id)
              values (d2, v_ch, k, l.title, 1, case when l.periods > 1 then 'T' || j end, 'bai_hoc', l.id,
                      (select ml.id from material_lessons ml where ml.curriculum_lesson_id = l.id limit 1));
          end loop;
        end loop;
      end loop;
    end;
    -- THCS Phố Hiến sao chép bản KDI thành PPCT của trường
    insert into ppct_docs (org_id, level, subject, grade, school_year, title, weeks_hk1, weeks_hk2, ppw_hk1, ppw_hk2, minutes_per_period, curriculum_id, status, issuer, based_on_id)
      select v_ph, level, subject, grade, school_year, title || ' – THCS Phố Hiến', weeks_hk1, weeks_hk2, ppw_hk1, ppw_hk2, minutes_per_period, curriculum_id, 'draft',
             'UBND PHƯỜNG · TRƯỜNG THCS PHỐ HIẾN', id from ppct_docs where id = d2 returning id into x;
    insert into ppct_strands (doc_id, seq, name) select x, seq, name from ppct_strands where doc_id = d2;
    insert into ppct_chapters (doc_id, semester, seq, title, curriculum_unit_id, strand_id)
      select x, c.semester, c.seq, c.title, c.curriculum_unit_id, (select s2.id from ppct_strands s2 join ppct_strands s1 on s1.seq = s2.seq where s1.id = c.strand_id and s2.doc_id = x)
        from ppct_chapters c where c.doc_id = d2;
    insert into ppct_rows (doc_id, chapter_id, seq, title, periods, part_label, kind, curriculum_lesson_id, material_lesson_id)
      select x, (select c2.id from ppct_chapters c2 where c2.doc_id = x and c2.seq = c.seq), r.seq, r.title, r.periods, r.part_label, r.kind, r.curriculum_lesson_id, r.material_lesson_id
        from ppct_rows r join ppct_chapters c on c.id = r.chapter_id where r.doc_id = d2;
  end if;
end $$;
