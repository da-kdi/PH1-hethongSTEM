-- 067. PH2 · Đào tạo & đánh giá năng lực nhà giáo — dựng theo bản mẫu giao diện (ph1-chuong-trinh-mau.html, phần Phân hệ 2).
-- Cần chạy sau 066. Bảng mới tiền tố ph2_ (không đụng bảng tập huấn cũ training_* của repo chính).
--   ph2_catalog   : danh mục dùng chung — nhóm chương trình, đơn vị đào tạo, giảng viên (môn học dùng chung danh mục môn của PH1)
--   ph2_programs  : chương trình tập huấn (môn học › mô-đun; không chia cấp, khối, lớp) + khung đánh giá (items: đầu điểm, rubric) + điều kiện hoàn thành
--   ph2_modules   : mô-đun theo môn (số giờ, số buổi, phiên bản học liệu đang dùng)
--   ph2_materials : học liệu mô-đun theo phiên bản (4 nhóm chốt: thông tin, nội dung, link, định mức)
--   ph2_lectures  : bài giảng tập huấn soạn từ một phiên bản học liệu (phần › khối trình chiếu)
--   ph2_plans     : kế hoạch / đợt tập huấn (môn của đợt, đăng ký, điều kiện tham gia, thông báo, chốt kết quả, phiếu khảo sát)
--   ph2_sessions  : buổi tập huấn (ngày, giờ, mô-đun, hình thức, địa điểm / lớp học ảo, giảng viên)
--   ph2_trainees  : học viên đăng ký đợt (giáo viên — bảng teachers), hoạt động bổ sung
--   ph2_attendance, ph2_grades, ph2_certs, ph2_feedback : điểm danh, chấm bài (điểm số / rubric, bài nộp), chứng nhận, phản hồi khoá
--   ph2_settings  : mẫu phiếu khảo sát chung của đơn vị

-- ===== 1. Bảng =====
create table if not exists ph2_catalog (
  id uuid primary key default gen_random_uuid(),
  owner_org_id uuid references organizations(id) on delete cascade,
  kind text not null check (kind in ('group', 'unit', 'trainer')),
  code text,
  name text not null check (length(btrim(name)) between 1 and 200),
  color text,
  info jsonb not null default '{}'::jsonb,           -- unit: {type}; trainer: {org, field}
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists ph2_catalog_kind_idx on ph2_catalog (kind, owner_org_id);

create table if not exists ph2_programs (
  id uuid primary key default gen_random_uuid(),
  owner_org_id uuid not null references organizations(id) on delete cascade,
  code text,
  name text not null check (length(btrim(name)) between 1 and 300),
  group_code text,                                   -- mã nhóm trong ph2_catalog (null = chưa xếp nhóm)
  format text not null default 'off' check (format in ('off', 'on', 'mix')),
  mpp int not null default 180 check (mpp between 15 and 720),   -- số phút mỗi buổi
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  issuer text,
  summary text, outcomes text, goal text,
  audience jsonb not null default '{"levels": [], "note": ""}'::jsonb,
  subjects text[] not null default '{}',             -- môn học theo thứ tự
  subj_hours jsonb not null default '{}'::jsonb,     -- {mã môn: số giờ}
  criteria jsonb not null default '{"att": 80, "score": 5, "req": true}'::jsonb,
  cert text,
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),       -- đầu điểm: {id,name,kind,mod,mode,w,max,task,rubric:[{id,name,pts,comp,req,desc[4]}]}
  releases jsonb not null default '[]'::jsonb check (jsonb_typeof(releases) = 'array'), -- [{no,date,by,note,mods}]
  created_by uuid references profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ph2_programs_owner_idx on ph2_programs (owner_org_id, status);

create table if not exists ph2_modules (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references ph2_programs(id) on delete cascade,
  subject text not null,
  seq int not null default 1,
  title text not null check (length(btrim(title)) between 1 and 300),
  hours numeric(5,1) not null default 3 check (hours > 0),
  sessions int not null default 1 check (sessions between 1 and 60),
  mat_use int                                        -- phiên bản học liệu đang dùng
);
create index if not exists ph2_modules_prog_idx on ph2_modules (program_id, subject, seq);

create table if not exists ph2_materials (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references ph2_modules(id) on delete cascade,
  version_no int not null default 1,
  status text not null default 'draft' check (status in ('draft', 'published')),
  groups jsonb not null default '{}'::jsonb,         -- {info, content, links, norms: 'ok' | ''}
  content jsonb not null default '{}'::jsonb,        -- {desc, outcomes[], product[], doc{written,reviewed,edited}, acts[{title,minutes,items[]}], practice, links[], norms[]}
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (module_id, version_no)
);

create table if not exists ph2_lectures (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  module_id uuid not null references ph2_modules(id) on delete cascade,
  mat_version int,
  title text not null check (length(btrim(title)) between 1 and 300),
  author text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  parts jsonb not null default '[]'::jsonb check (jsonb_typeof(parts) = 'array'),   -- [{title, minutes, note, blocks[]}]
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ph2_plans (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  program_id uuid not null references ph2_programs(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 300),
  unit text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  subjs text[] not null default '{}',
  cap int not null default 40 check (cap between 1 and 5000),
  reg_due date,
  schools uuid[] not null default '{}',             -- trống = mở cho mọi trường
  subj_only boolean not null default false,
  prereq uuid references ph2_programs(id) on delete set null,
  cond text,
  assist text[] not null default '{}',
  notice jsonb,                                       -- {date, n, bgh}
  confirmed jsonb,                                    -- {date, by}: đã kết thúc đợt & chốt kết quả
  survey jsonb not null default '{}'::jsonb,          -- {form[], sent, due, anon, req}
  created_by uuid references profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ph2_plans_prog_idx on ph2_plans (program_id);

create table if not exists ph2_sessions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references ph2_plans(id) on delete cascade,
  date date not null,
  start_t text not null default '08:00',
  end_t text not null default '11:00',
  module_id uuid references ph2_modules(id) on delete set null,
  subject text,
  mode text not null default 'off' check (mode in ('off', 'on')),
  place text, link text, rec text, trainer text
);
create index if not exists ph2_sessions_plan_idx on ph2_sessions (plan_id, date);

create table if not exists ph2_trainees (
  plan_id uuid not null references ph2_plans(id) on delete cascade,
  teacher_id uuid not null references teachers(id) on delete cascade,
  reg_at date not null default current_date,
  supp jsonb,                                         -- {kind, due}: hoạt động bổ sung khi chưa đạt
  primary key (plan_id, teacher_id)
);
create table if not exists ph2_attendance (
  session_id uuid not null references ph2_sessions(id) on delete cascade,
  teacher_id uuid not null references teachers(id) on delete cascade,
  mark text not null check (mark in ('p', 'l', 'e', 'a')),
  primary key (session_id, teacher_id)
);
create table if not exists ph2_grades (
  plan_id uuid not null references ph2_plans(id) on delete cascade,
  item_id text not null,
  teacher_id uuid not null references teachers(id) on delete cascade,
  score numeric(5,2),
  lv jsonb,                                           -- {mã tiêu chí: 0..3}
  note text,
  sub jsonb,                                          -- bài nộp {at, file, late}
  updated_at timestamptz not null default now(),
  primary key (plan_id, item_id, teacher_id)
);
create sequence if not exists ph2_cert_seq;
create table if not exists ph2_certs (
  plan_id uuid not null references ph2_plans(id) on delete cascade,
  teacher_id uuid not null references teachers(id) on delete cascade,
  no text not null unique,
  issued_on date not null default current_date,
  primary key (plan_id, teacher_id)
);
create table if not exists ph2_feedback (
  plan_id uuid not null references ph2_plans(id) on delete cascade,
  teacher_id uuid not null references teachers(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (plan_id, teacher_id)
);
create table if not exists ph2_settings (
  org_id uuid primary key references organizations(id) on delete cascade,
  survey jsonb not null default '[]'::jsonb
);

do $$ declare t text; begin
  foreach t in array array['ph2_programs', 'ph2_materials', 'ph2_lectures', 'ph2_plans'] loop
    execute format('drop trigger if exists %I on %I', t || '_touch', t);
    execute format('create trigger %I before update on %I for each row execute function public.touch_updated_at()', t || '_touch', t);
  end loop;
end $$;

-- ===== 2. Quyền =====
-- Đọc: trong cây đơn vị, cấp trên, KDI. Ghi: quản lý chương trình (curriculum_can_manage) trên đơn vị thuộc cây của mình.
create or replace function public.ph2_can_read(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.ph1_can_read(p_org) or (public.is_staff() and p_org in (select public.my_ancestor_orgs()))
$$;
create or replace function public.ph2_prog_org(p_prog uuid) returns uuid
language sql stable security definer set search_path = public as $$ select owner_org_id from ph2_programs where id = p_prog $$;
create or replace function public.ph2_mod_org(p_mod uuid) returns uuid
language sql stable security definer set search_path = public as $$ select p.owner_org_id from ph2_modules m join ph2_programs p on p.id = m.program_id where m.id = p_mod $$;
create or replace function public.ph2_plan_org(p_plan uuid) returns uuid
language sql stable security definer set search_path = public as $$ select org_id from ph2_plans where id = p_plan $$;
-- Đợt đã phát hành: mọi cán bộ, giáo viên đều xem được (để đăng ký)
create or replace function public.ph2_plan_visible(p_plan uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from ph2_plans p where p.id = p_plan and (public.ph2_can_read(p.org_id) or (p.status = 'published' and public.is_staff())))
$$;
create or replace function public.ph2_plan_write(p_plan uuid) returns boolean
language sql stable security definer set search_path = public as $$ select public.ph1_can_write(public.ph2_plan_org(p_plan)) $$;
create or replace function public.ph2_session_plan(p_sess uuid) returns uuid
language sql stable security definer set search_path = public as $$ select plan_id from ph2_sessions where id = p_sess $$;
grant execute on function public.ph2_can_read(uuid), public.ph2_prog_org(uuid), public.ph2_mod_org(uuid), public.ph2_plan_org(uuid),
  public.ph2_plan_visible(uuid), public.ph2_plan_write(uuid), public.ph2_session_plan(uuid) to authenticated;

alter table ph2_catalog enable row level security;
alter table ph2_programs enable row level security;
alter table ph2_modules enable row level security;
alter table ph2_materials enable row level security;
alter table ph2_lectures enable row level security;
alter table ph2_plans enable row level security;
alter table ph2_sessions enable row level security;
alter table ph2_trainees enable row level security;
alter table ph2_attendance enable row level security;
alter table ph2_grades enable row level security;
alter table ph2_certs enable row level security;
alter table ph2_feedback enable row level security;
alter table ph2_settings enable row level security;

drop policy if exists ph2_catalog_read on ph2_catalog;
create policy ph2_catalog_read on ph2_catalog for select to authenticated using (owner_org_id is null or public.ph2_can_read(owner_org_id));
drop policy if exists ph2_catalog_write on ph2_catalog;
create policy ph2_catalog_write on ph2_catalog for all to authenticated using (public.ph1_can_write(owner_org_id)) with check (public.ph1_can_write(owner_org_id));

drop policy if exists ph2_programs_read on ph2_programs;
create policy ph2_programs_read on ph2_programs for select to authenticated using (public.ph2_can_read(owner_org_id));
drop policy if exists ph2_programs_write on ph2_programs;
create policy ph2_programs_write on ph2_programs for all to authenticated using (public.ph1_can_write(owner_org_id)) with check (public.ph1_can_write(owner_org_id));

drop policy if exists ph2_modules_read on ph2_modules;
create policy ph2_modules_read on ph2_modules for select to authenticated using (public.ph2_can_read(public.ph2_prog_org(program_id)));
drop policy if exists ph2_modules_write on ph2_modules;
create policy ph2_modules_write on ph2_modules for all to authenticated using (public.ph1_can_write(public.ph2_prog_org(program_id))) with check (public.ph1_can_write(public.ph2_prog_org(program_id)));

drop policy if exists ph2_materials_read on ph2_materials;
create policy ph2_materials_read on ph2_materials for select to authenticated using (public.ph2_can_read(public.ph2_mod_org(module_id)));
drop policy if exists ph2_materials_write on ph2_materials;
create policy ph2_materials_write on ph2_materials for all to authenticated using (public.ph1_can_write(public.ph2_mod_org(module_id))) with check (public.ph1_can_write(public.ph2_mod_org(module_id)));

drop policy if exists ph2_lectures_read on ph2_lectures;
create policy ph2_lectures_read on ph2_lectures for select to authenticated using (public.ph2_can_read(org_id) or public.ph2_can_read(public.ph2_mod_org(module_id)));
drop policy if exists ph2_lectures_write on ph2_lectures;
create policy ph2_lectures_write on ph2_lectures for all to authenticated using (public.ph1_can_work(org_id)) with check (public.ph1_can_work(org_id));

drop policy if exists ph2_plans_read on ph2_plans;
create policy ph2_plans_read on ph2_plans for select to authenticated using (public.ph2_can_read(org_id) or (status = 'published' and public.is_staff()));
drop policy if exists ph2_plans_write on ph2_plans;
create policy ph2_plans_write on ph2_plans for all to authenticated using (public.ph1_can_write(org_id)) with check (public.ph1_can_write(org_id));

drop policy if exists ph2_sessions_read on ph2_sessions;
create policy ph2_sessions_read on ph2_sessions for select to authenticated using (public.ph2_plan_visible(plan_id));
drop policy if exists ph2_sessions_write on ph2_sessions;
create policy ph2_sessions_write on ph2_sessions for all to authenticated using (public.ph2_plan_write(plan_id)) with check (public.ph2_plan_write(plan_id));

-- Học viên tự đăng ký / huỷ đăng ký đợt đã phát hành; đơn vị tổ chức thêm, bỏ học viên
drop policy if exists ph2_trainees_read on ph2_trainees;
create policy ph2_trainees_read on ph2_trainees for select to authenticated using (public.ph2_plan_visible(plan_id));
drop policy if exists ph2_trainees_write on ph2_trainees;
create policy ph2_trainees_write on ph2_trainees for all to authenticated using (public.ph2_plan_write(plan_id)) with check (public.ph2_plan_write(plan_id));
drop policy if exists ph2_trainees_self on ph2_trainees;
create policy ph2_trainees_self on ph2_trainees for insert to authenticated
  with check (teacher_id = public.my_teacher_id() and exists (select 1 from ph2_plans p where p.id = plan_id and p.status = 'published' and (p.reg_due is null or p.reg_due >= current_date)));
drop policy if exists ph2_trainees_selfdel on ph2_trainees;
create policy ph2_trainees_selfdel on ph2_trainees for delete to authenticated using (teacher_id = public.my_teacher_id());

drop policy if exists ph2_att_read on ph2_attendance;
create policy ph2_att_read on ph2_attendance for select to authenticated using (public.ph2_plan_visible(public.ph2_session_plan(session_id)));
drop policy if exists ph2_att_write on ph2_attendance;
create policy ph2_att_write on ph2_attendance for all to authenticated using (public.ph2_plan_write(public.ph2_session_plan(session_id))) with check (public.ph2_plan_write(public.ph2_session_plan(session_id)));

drop policy if exists ph2_grades_read on ph2_grades;
create policy ph2_grades_read on ph2_grades for select to authenticated using (public.ph2_plan_write(plan_id) or teacher_id = public.my_teacher_id() or public.ph2_can_read(public.ph2_plan_org(plan_id)));
drop policy if exists ph2_grades_write on ph2_grades;
create policy ph2_grades_write on ph2_grades for all to authenticated using (public.ph2_plan_write(plan_id)) with check (public.ph2_plan_write(plan_id));

drop policy if exists ph2_certs_read on ph2_certs;
create policy ph2_certs_read on ph2_certs for select to authenticated using (public.ph2_plan_visible(plan_id));
drop policy if exists ph2_certs_write on ph2_certs;
create policy ph2_certs_write on ph2_certs for delete to authenticated using (public.ph2_plan_write(plan_id));

drop policy if exists ph2_fb_read on ph2_feedback;
create policy ph2_fb_read on ph2_feedback for select to authenticated using (public.ph2_plan_write(plan_id) or teacher_id = public.my_teacher_id() or public.ph2_can_read(public.ph2_plan_org(plan_id)));
drop policy if exists ph2_fb_write on ph2_feedback;
create policy ph2_fb_write on ph2_feedback for all to authenticated using (teacher_id = public.my_teacher_id() or public.ph2_plan_write(plan_id)) with check (teacher_id = public.my_teacher_id() or public.ph2_plan_write(plan_id));

drop policy if exists ph2_settings_read on ph2_settings;
create policy ph2_settings_read on ph2_settings for select to authenticated using (public.ph2_can_read(org_id));
drop policy if exists ph2_settings_write on ph2_settings;
create policy ph2_settings_write on ph2_settings for all to authenticated using (public.ph1_can_write(org_id)) with check (public.ph1_can_write(org_id));

-- ===== 3. Hàm nghiệp vụ =====
-- Khung học liệu mô-đun (PB 1) theo mẫu của bản mẫu giao diện
create or replace function public.ph2_mat_template(p_title text, p_subject text) returns jsonb
language sql immutable as $$
  select jsonb_build_object(
    'desc', format('Mô-đun giúp giáo viên %s hiểu và vận dụng “%s” vào thiết kế, tổ chức bài dạy STEM của mình.', coalesce(p_subject, ''), p_title),
    'outcomes', jsonb_build_array(format('Trình bày được các nội dung cốt lõi của “%s”.', p_title), 'Vận dụng được vào 01 hoạt động dạy học cụ thể của môn mình.', 'Đánh giá, góp ý được sản phẩm của đồng nghiệp.'),
    'product', jsonb_build_array('01 kế hoạch hoạt động học tập (file Word, tối đa 2 trang)', 'Bản trình bày 5 phút của nhóm'),
    'doc', jsonb_build_object('written', jsonb_build_array(jsonb_build_array(to_char(current_date, 'DD/MM/YYYY'), 'KDI Education')), 'reviewed', '[]'::jsonb, 'edited', '[]'::jsonb),
    'acts', jsonb_build_array(
      jsonb_build_object('title', 'Khởi động: chia sẻ kinh nghiệm thực tế', 'minutes', 15, 'items', jsonb_build_array('Giảng viên nêu tình huống thực tế ở trường.', 'Học viên chia sẻ theo cặp 3 phút.')),
      jsonb_build_object('title', 'Nội dung 1: khái niệm và ví dụ', 'minutes', 45, 'items', jsonb_build_array('Trình bày khái niệm, quy trình.', '– Phân tích 02 ví dụ minh hoạ.', '[Hình] Sơ đồ quy trình')),
      jsonb_build_object('title', 'Nội dung 2: thực hành theo nhóm', 'minutes', 60, 'items', jsonb_build_array('Chia nhóm 4–5 học viên theo môn.', 'Mỗi nhóm thiết kế 01 hoạt động học tập.')),
      jsonb_build_object('title', 'Thảo luận, trình bày sản phẩm', 'minutes', 30, 'items', jsonb_build_array('Các nhóm trình bày 5 phút, nhóm khác góp ý theo phiếu.')),
      jsonb_build_object('title', 'Tổng kết và giao nhiệm vụ', 'minutes', 15, 'items', jsonb_build_array('Chốt kiến thức, giao nhiệm vụ thực hành sau buổi.'))),
    'practice', 'Mỗi nhóm thiết kế 01 hoạt động học tập, trình bày 5 phút và nhận góp ý.',
    'links', jsonb_build_array(jsonb_build_object('kind', 'slide', 'title', 'Slide mô-đun (PDF)', 'url', ''), jsonb_build_object('kind', 'video', 'title', 'Video minh hoạ', 'url', ''), jsonb_build_object('kind', 'phieu', 'title', 'Phiếu góp ý sản phẩm', 'url', '')),
    'norms', jsonb_build_array(
      jsonb_build_object('name', 'Giấy A0', 'unit', 'tờ', 'qty', 2, 'basis', 'group', 'cat', 'vl'), jsonb_build_object('name', 'Bút dạ màu', 'unit', 'bộ', 'qty', 1, 'basis', 'group', 'cat', 'vl'),
      jsonb_build_object('name', 'Tài liệu in', 'unit', 'bộ', 'qty', 1, 'basis', 'student', 'cat', 'vl'), jsonb_build_object('name', 'Máy chiếu', 'unit', 'cái', 'qty', 1, 'basis', 'cls', 'cat', 'cc'),
      jsonb_build_object('name', 'Bộ thí nghiệm mẫu', 'unit', 'bộ', 'qty', 1, 'basis', 'group', 'cat', 'cc')))
$$;
-- Tạo học liệu PB 1 (nháp) cho mô-đun
create or replace function public.ph2_material_new(p_module uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare m ph2_modules; v uuid; s text;
begin
  select * into m from ph2_modules where id = p_module;
  if m.id is null or not public.ph1_can_write(public.ph2_mod_org(p_module)) then raise exception 'Bạn không có quyền với mô-đun này' using errcode = '42501'; end if;
  select id into v from ph2_materials where module_id = p_module order by version_no desc limit 1;
  if v is not null then return v; end if;
  select name into s from curriculum_catalog where kind = 'subject' and code = m.subject order by owner_org_id nulls first limit 1;
  insert into ph2_materials (module_id, version_no, status, groups, content)
    values (p_module, 1, 'draft', '{"info": "", "content": "", "links": "", "norms": ""}'::jsonb, public.ph2_mat_template(m.title, coalesce(s, m.subject))) returning id into v;
  return v;
end $$;
-- Tạo phiên bản mới (nháp) từ một phiên bản
create or replace function public.ph2_material_new_version(p_material uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare x ph2_materials; v uuid; n int;
begin
  select * into x from ph2_materials where id = p_material;
  if x.id is null or not public.ph1_can_write(public.ph2_mod_org(x.module_id)) then raise exception 'Bạn không có quyền với học liệu này' using errcode = '42501'; end if;
  select coalesce(max(version_no), 0) + 1 into n from ph2_materials where module_id = x.module_id;
  insert into ph2_materials (module_id, version_no, status, groups, content) values (x.module_id, n, 'draft', x.groups, x.content) returning id into v;
  return v;
end $$;
-- Cấp chứng nhận (số hiệu CN-năm-xxxx, không qua bước duyệt) cho học viên của đợt đã chốt
create or replace function public.ph2_issue_certs(p_plan uuid, p_teachers uuid[]) returns int
language plpgsql security definer set search_path = public as $$
declare t uuid; n int := 0;
begin
  if not public.ph2_plan_write(p_plan) then raise exception 'Bạn không có quyền với đợt tập huấn này' using errcode = '42501'; end if;
  if (select confirmed from ph2_plans where id = p_plan) is null then raise exception 'Kết thúc đợt & chốt kết quả trước khi cấp chứng nhận' using errcode = '22023'; end if;
  foreach t in array p_teachers loop
    if exists (select 1 from ph2_trainees where plan_id = p_plan and teacher_id = t) and not exists (select 1 from ph2_certs where plan_id = p_plan and teacher_id = t) then
      insert into ph2_certs (plan_id, teacher_id, no) values (p_plan, t, 'CN-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('ph2_cert_seq')::text, 4, '0'));
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;
revoke execute on function public.ph2_material_new(uuid), public.ph2_material_new_version(uuid), public.ph2_issue_certs(uuid, uuid[]) from public, anon;
grant execute on function public.ph2_material_new(uuid), public.ph2_material_new_version(uuid), public.ph2_issue_certs(uuid, uuid[]), public.ph2_mat_template(text, text) to authenticated;

-- ===== 4. Danh mục mặc định: nhóm chương trình của đơn vị nền tảng =====
do $$
declare v_kdi uuid;
begin
  select id into v_kdi from organizations where is_platform limit 1;
  if v_kdi is null then return; end if;
  if not exists (select 1 from ph2_catalog where kind = 'group' and owner_org_id = v_kdi) then
    insert into ph2_catalog (owner_org_id, kind, code, name, color, sort) values
      (v_kdi, 'group', 'BDTX', 'Bồi dưỡng thường xuyên', '#2e6fd9', 1),
      (v_kdi, 'group', 'STEM-CB', 'STEM cơ bản', '#0e8fa8', 2),
      (v_kdi, 'group', 'STEM-NC', 'STEM nâng cao', '#7b5cd6', 3);
  end if;
end $$;

-- ===== 5. Dữ liệu mẫu theo bản mẫu giao diện (chỉ khi bật app.seed_demo) =====
do $$
declare
  v_kdi uuid; v_so uuid; v_tz uuid;
  p1 uuid; p2 uuid; p3 uuid; p4 uuid;
  m_k1 uuid; m_k2 uuid; m_k3 uuid; m_t1 uuid; m_t2 uuid; m_c1 uuid; m_r1 uuid; m_r2 uuid; m_i1 uuid; m_i2 uuid; m_b1 uuid; m_b2 uuid; m_n1 uuid; m_n2 uuid; m_n3 uuid;
  k1 uuid; k2 uuid; k3 uuid; k4 uuid;
  sch uuid[]; tch uuid[]; it jsonb; i jsonb; s record; t uuid; r float; d date; n int; k int; g jsonb; lv jsonb; c jsonb;
  rc jsonb;
begin
  if coalesce(current_setting('app.seed_demo', true), '') <> 'on' then return; end if;
  select id into v_kdi from organizations where is_platform limit 1;
  select id into v_so from organizations where code = 'SO-HY';
  if v_kdi is null or v_so is null or exists (select 1 from ph2_programs) then return; end if;
  perform setseed(0.37);
  insert into ph2_catalog (owner_org_id, kind, name, info, sort) values
    (v_kdi, 'unit', 'KDI Education', '{"type": "Đơn vị đào tạo"}', 1), (v_kdi, 'unit', 'Sở GD&ĐT Hưng Yên', '{"type": "Sở GD&ĐT"}', 2),
    (v_kdi, 'unit', 'Phòng GD&ĐT TP Hưng Yên', '{"type": "Phòng GD&ĐT"}', 3), (v_kdi, 'unit', 'Trường ĐHSP Hà Nội', '{"type": "Trường đại học"}', 4),
    (v_kdi, 'trainer', 'TS. Lê Minh Quân', '{"org": "KDI Education", "field": "Giáo dục STEM"}', 1), (v_kdi, 'trainer', 'ThS. Phạm Đức Anh', '{"org": "KDI Education", "field": "Robotics & AI"}', 2),
    (v_kdi, 'trainer', 'ThS. Nguyễn Thị Hồng', '{"org": "Trường ĐHSP Hà Nội", "field": "Phương pháp dạy học"}', 3), (v_kdi, 'trainer', 'TS. Vũ Văn Hải', '{"org": "Sở GD&ĐT Hưng Yên", "field": "Quản lý giáo dục"}', 4);

  -- Chương trình tập huấn
  insert into ph2_programs (owner_org_id, code, name, group_code, format, mpp, status, issuer, summary, outcomes, goal, audience, subj_hours, criteria, cert, releases)
    values (v_kdi, 'STEM-CB1', 'Dạy học STEM cơ bản', 'STEM-CB', 'mix', 180, 'published', 'KDI Education',
      'Giáo viên nắm quy trình thiết kế và tổ chức bài học STEM theo chủ đề, gắn với môn mình dạy.',
      E'Trình bày được quy trình 5 bước thiết kế bài học STEM.\nThiết kế được 01 kế hoạch bài dạy STEM cho môn mình phụ trách.\nTổ chức được tiết dạy minh hoạ và đánh giá sản phẩm của học sinh.',
      'Giáo viên thiết kế và tổ chức được bài học STEM gắn với môn mình dạy, đánh giá được sản phẩm của học sinh.', '{"levels": ["TH", "THCS"], "note": "Giáo viên dạy Khoa học tự nhiên, Toán, Công nghệ"}',
      '{"khtn": 9, "toan": 6, "cong_nghe": 3}', '{"att": 80, "score": 5, "req": true}', 'Chứng nhận hoàn thành bồi dưỡng “Dạy học STEM cơ bản”',
      '[{"no": 2, "date": "01/09/2026", "by": "Lê Minh Quân", "note": "Bổ sung mô-đun đánh giá sản phẩm STEM", "mods": 6}, {"no": 1, "date": "15/06/2026", "by": "Lê Minh Quân", "note": "Bản đầu tiên", "mods": 5}]') returning id into p1;
  insert into ph2_programs (owner_org_id, code, name, group_code, format, mpp, status, issuer, summary, outcomes, goal, audience, subj_hours, criteria, cert, releases)
    values (v_kdi, 'ROBO-AI', 'Robotics & AI cho giáo viên', 'STEM-NC', 'on', 120, 'published', 'KDI Education',
      'Lập trình micro:bit, cảm biến và robot di chuyển; ứng dụng AI nhận dạng hình ảnh trong lớp học.',
      E'Lập trình được robot di chuyển theo vạch bằng micro:bit.\nThiết kế được 01 hoạt động AI đơn giản cho học sinh.',
      'Giáo viên tự tin tổ chức hoạt động lập trình robot và AI đơn giản cho học sinh.', '{"levels": ["THCS"], "note": "Giáo viên Tin học, Robotics; đã dùng máy tính thành thạo"}',
      '{"robotics": 6, "tin_hoc": 4}', '{"att": 80, "score": 6, "req": true}', 'Chứng nhận hoàn thành khoá “Robotics & AI cho giáo viên”',
      '[{"no": 1, "date": "20/08/2026", "by": "Phạm Đức Anh", "note": "Bản đầu tiên", "mods": 4}]') returning id into p2;
  insert into ph2_programs (owner_org_id, code, name, group_code, format, mpp, status, issuer, summary, outcomes, goal, audience, subj_hours, criteria, cert)
    values (v_so, 'BDTX-27', 'Bồi dưỡng thường xuyên 2026–2027', 'BDTX', 'off', 240, 'draft', 'Sở GD&ĐT Hưng Yên',
      'Các mô-đun bồi dưỡng thường xuyên theo Thông tư 17/2019/TT-BGDĐT, tập trung đổi mới phương pháp.', '',
      'Hoàn thành nội dung bồi dưỡng thường xuyên năm học 2026–2027.', '{"levels": ["TH", "THCS"], "note": "Toàn bộ giáo viên trong tỉnh"}',
      '{"khoa_hoc": 4, "cong_nghe": 4}', '{"att": 80, "score": 5, "req": false}', 'Giấy chứng nhận bồi dưỡng thường xuyên') returning id into p3;
  insert into ph2_programs (owner_org_id, code, name, group_code, format, mpp, status, issuer, summary, outcomes, goal, audience, subj_hours, criteria, cert, releases)
    values (v_kdi, 'NLS-GV', 'Năng lực số cho giáo viên', 'BDTX', 'mix', 120, 'published', 'KDI Education',
      'Khai thác học liệu số, thiết kế bài giảng tương tác và đánh giá trực tuyến.', E'Thiết kế được 01 bài giảng số có hoạt động tương tác.\nTổ chức được 01 bài kiểm tra trực tuyến.',
      'Giáo viên khai thác học liệu số và tổ chức được đánh giá trực tuyến.', '{"levels": ["TH", "THCS", "THPT"], "note": "Giáo viên mọi môn"}',
      '{"tin_hoc": 6, "cong_nghe": 2}', '{"att": 80, "score": 5, "req": true}', 'Chứng nhận hoàn thành bồi dưỡng “Năng lực số cho giáo viên”',
      '[{"no": 1, "date": "10/10/2026", "by": "KDI Education", "note": "Bản đầu tiên", "mods": 3}]') returning id into p4;

  update ph2_programs set subjects = '{khtn,toan,cong_nghe}', created_at = now() - interval '4 min' where id = p1;
  update ph2_programs set subjects = '{robotics,tin_hoc}', created_at = now() - interval '3 min' where id = p2;
  update ph2_programs set subjects = '{khoa_hoc,cong_nghe}', created_at = now() - interval '2 min' where id = p3;
  update ph2_programs set subjects = '{tin_hoc,cong_nghe}', created_at = now() - interval '1 min' where id = p4;
  insert into ph2_modules (program_id, subject, seq, title, sessions, hours, mat_use) values (p1, 'khtn', 1, 'Tổng quan giáo dục STEM', 1, 3, 1) returning id into m_k1;
  insert into ph2_modules (program_id, subject, seq, title, sessions, hours, mat_use) values (p1, 'khtn', 2, 'Quy trình thiết kế bài học STEM', 1, 3, 1) returning id into m_k2;
  insert into ph2_modules (program_id, subject, seq, title, sessions, hours, mat_use) values (p1, 'khtn', 3, 'Đánh giá sản phẩm STEM', 1, 3, null) returning id into m_k3;
  insert into ph2_modules (program_id, subject, seq, title, sessions, hours, mat_use) values (p1, 'toan', 1, 'Toán học trong chủ đề STEM', 1, 3, 1) returning id into m_t1;
  insert into ph2_modules (program_id, subject, seq, title, sessions, hours, mat_use) values (p1, 'toan', 2, 'Mô hình hoá và đo lường', 1, 3, 2) returning id into m_t2;
  insert into ph2_modules (program_id, subject, seq, title, sessions, hours, mat_use) values (p1, 'cong_nghe', 1, 'Thiết kế kỹ thuật cho học sinh', 1, 3, null) returning id into m_c1;
  insert into ph2_modules (program_id, subject, seq, title, sessions, hours, mat_use) values (p2, 'robotics', 1, 'Làm quen micro:bit & cảm biến', 1, 2, 1) returning id into m_r1;
  insert into ph2_modules (program_id, subject, seq, title, sessions, hours, mat_use) values (p2, 'robotics', 2, 'Robot dò line', 2, 4, 2) returning id into m_r2;
  insert into ph2_modules (program_id, subject, seq, title, sessions, hours, mat_use) values (p2, 'tin_hoc', 1, 'Lập trình khối nâng cao', 1, 2, 1) returning id into m_i1;
  insert into ph2_modules (program_id, subject, seq, title, sessions, hours, mat_use) values (p2, 'tin_hoc', 2, 'AI nhận dạng hình ảnh', 1, 2, null) returning id into m_i2;
  insert into ph2_modules (program_id, subject, seq, title, sessions, hours) values (p3, 'khoa_hoc', 1, 'Dạy học phát triển năng lực', 1, 4) returning id into m_b1;
  insert into ph2_modules (program_id, subject, seq, title, sessions, hours) values (p3, 'cong_nghe', 1, 'Ứng dụng CNTT trong dạy học', 1, 4) returning id into m_b2;
  insert into ph2_modules (program_id, subject, seq, title, sessions, hours, mat_use) values (p4, 'tin_hoc', 1, 'Học liệu số và bản quyền', 1, 2, 1) returning id into m_n1;
  insert into ph2_modules (program_id, subject, seq, title, sessions, hours, mat_use) values (p4, 'tin_hoc', 2, 'Bài giảng tương tác', 2, 4, null) returning id into m_n2;
  insert into ph2_modules (program_id, subject, seq, title, sessions, hours) values (p4, 'cong_nghe', 1, 'Đánh giá trực tuyến', 1, 2) returning id into m_n3;

  -- Học liệu: PB đã phát hành (mat_use), PB nháp cho mô-đun đang soạn
  insert into ph2_materials (module_id, version_no, status, groups, content, published_at)
    select m.id, v.no, case when v.no <= coalesce(m.mat_use, 0) then 'published' else 'draft' end,
      case when v.no <= coalesce(m.mat_use, 0) then '{"info": "ok", "content": "ok", "links": "ok", "norms": "ok"}'::jsonb else '{"info": "ok", "content": "", "links": "ok", "norms": ""}'::jsonb end,
      public.ph2_mat_template(m.title, (select name from curriculum_catalog where kind = 'subject' and code = m.subject order by owner_org_id nulls first limit 1)),
      case when v.no <= coalesce(m.mat_use, 0) then now() - interval '40 days' end
    from ph2_modules m cross join lateral (select generate_series(1, case when m.id in (m_k3, m_i2, m_n2) then 1 else coalesce(m.mat_use, 0) end) as no) v
    where m.mat_use is not null or m.id in (m_k3, m_i2, m_n2);

  -- Khung đánh giá
  rc := jsonb_build_array(
    jsonb_build_object('id', 'rc-a1', 'name', 'Xác định vấn đề, nhiệm vụ', 'pts', 4, 'comp', 'tk', 'req', true, 'desc', jsonb_build_array('Vấn đề gắn thực tiễn, nêu rõ tiêu chí sản phẩm', 'Vấn đề rõ, tiêu chí sản phẩm chưa đầy đủ', 'Có nêu vấn đề nhưng còn chung chung', 'Chưa xác định được vấn đề')),
    jsonb_build_object('id', 'rc-a2', 'name', 'Tiến trình hoạt động', 'pts', 3, 'comp', 'tc', 'req', false, 'desc', jsonb_build_array('Đủ 5 bước, thời lượng từng bước hợp lý', 'Đủ 5 bước, thời lượng chưa hợp lý', 'Thiếu 1 bước', 'Thiếu từ 2 bước trở lên')),
    jsonb_build_object('id', 'rc-a3', 'name', 'Trình bày', 'pts', 3, 'comp', 'tk', 'req', false, 'desc', jsonb_build_array('Rõ ràng, có hình minh hoạ', 'Rõ ràng', 'Còn lỗi trình bày', 'Khó theo dõi')));
  update ph2_programs set items = jsonb_build_array(
    jsonb_build_object('id', 'it-cb1', 'name', 'Kiểm tra trắc nghiệm giữa khoá', 'kind', 'quiz', 'mod', m_k2, 'mode', 'score', 'w', 20, 'max', 10, 'rubric', '[]'::jsonb, 'task', '20 câu trắc nghiệm về giáo dục STEM và quy trình 5 bước, làm trực tuyến 30 phút cuối buổi.'),
    jsonb_build_object('id', 'it-cb2', 'name', 'Thực hành: thiết kế 01 hoạt động học tập', 'kind', 'practice', 'mod', m_k2, 'mode', 'rubric', 'w', 20, 'max', 10, 'rubric', rc,
      'task', 'Thiết kế 01 hoạt động học tập STEM theo quy trình 5 bước, nộp file Word tối đa 2 trang trong 7 ngày sau buổi học.'),
    jsonb_build_object('id', 'it-cb3', 'name', 'Kế hoạch bài dạy STEM', 'kind', 'product', 'mod', '', 'mode', 'rubric', 'w', 30, 'max', 10, 'task', 'Hoàn thiện 01 kế hoạch bài dạy STEM cho môn mình phụ trách theo mẫu của chương trình; nộp trước buổi tiết dạy minh hoạ.', 'rubric', jsonb_build_array(
      jsonb_build_object('id', 'rc-b1', 'name', 'Mục tiêu & yêu cầu cần đạt', 'pts', 3, 'comp', 'tk', 'req', true, 'desc', jsonb_build_array('Đúng chương trình môn, đo được', 'Đúng chương trình, khó đo', 'Còn chung chung', 'Không phù hợp chương trình')),
      jsonb_build_object('id', 'rc-b2', 'name', 'Tích hợp liên môn', 'pts', 3, 'comp', 'tk', 'req', false, 'desc', jsonb_build_array('Tích hợp tự nhiên từ 2 môn', 'Có tích hợp, còn gượng', 'Tích hợp mờ nhạt', 'Không có tích hợp')),
      jsonb_build_object('id', 'rc-b3', 'name', 'Công cụ đánh giá sản phẩm HS', 'pts', 4, 'comp', 'dg', 'req', true, 'desc', jsonb_build_array('Có rubric rõ mức độ', 'Có tiêu chí, chưa chia mức', 'Đánh giá cảm tính', 'Không có công cụ đánh giá')))),
    jsonb_build_object('id', 'it-cb4', 'name', 'Tiết dạy minh hoạ', 'kind', 'demo', 'mod', '', 'mode', 'rubric', 'w', 30, 'max', 10, 'task', 'Dạy minh hoạ 15 phút một hoạt động trong kế hoạch bài dạy; giảng viên và đồng nghiệp dự, góp ý.', 'rubric', jsonb_build_array(
      jsonb_build_object('id', 'rc-c1', 'name', 'Tổ chức hoạt động nhóm', 'pts', 4, 'comp', 'tc', 'req', true, 'desc', jsonb_build_array('HS chủ động, mọi nhóm có sản phẩm', 'Phần lớn nhóm hoạt động tốt', 'GV còn làm thay HS', 'Không tổ chức được hoạt động')),
      jsonb_build_object('id', 'rc-c2', 'name', 'Sử dụng thiết bị, học liệu', 'pts', 3, 'comp', 'cn', 'req', false, 'desc', jsonb_build_array('Đúng lúc, hiệu quả', 'Phù hợp', 'Còn lúng túng', 'Không sử dụng')),
      jsonb_build_object('id', 'rc-c3', 'name', 'Đánh giá, phản hồi HS', 'pts', 3, 'comp', 'dg', 'req', false, 'desc', jsonb_build_array('Phản hồi cụ thể theo tiêu chí', 'Có phản hồi', 'Phản hồi chung chung', 'Không phản hồi'))))) where id = p1;
  update ph2_programs set items = jsonb_build_array(
    jsonb_build_object('id', 'it-ro1', 'name', 'Kiểm tra lập trình micro:bit', 'kind', 'quiz', 'mod', m_r1, 'mode', 'score', 'w', 30, 'max', 10, 'rubric', '[]'::jsonb, 'task', '15 câu trắc nghiệm + 1 bài lập trình ngắn trên MakeCode, làm cuối buổi.'),
    jsonb_build_object('id', 'it-ro2', 'name', 'Sản phẩm: robot dò line', 'kind', 'practice', 'mod', m_r2, 'mode', 'rubric', 'w', 40, 'max', 10, 'task', 'Lắp ráp và lập trình robot dò line chạy hết sa bàn mẫu; quay video 1 phút, nộp kèm file chương trình.', 'rubric', jsonb_build_array(
      jsonb_build_object('id', 'rc-d1', 'name', 'Robot chạy đúng yêu cầu', 'pts', 4, 'comp', 'lt', 'req', true, 'desc', jsonb_build_array('Chạy hết sa bàn, không trượt line', 'Chạy hết, trượt 1–2 lần', 'Chạy được một phần', 'Không chạy')),
      jsonb_build_object('id', 'rc-d2', 'name', 'Chương trình rõ ràng', 'pts', 3, 'comp', 'lt', 'req', false, 'desc', jsonb_build_array('Có chú thích, chia khối hợp lý', 'Rõ ràng, ít chú thích', 'Khó đọc', 'Không nộp chương trình')),
      jsonb_build_object('id', 'rc-d3', 'name', 'Thuyết minh cách làm', 'pts', 3, 'comp', 'tc', 'req', false, 'desc', jsonb_build_array('Giải thích rõ, có gợi ý dạy HS', 'Giải thích rõ', 'Sơ sài', 'Không có')))),
    jsonb_build_object('id', 'it-ro3', 'name', 'Hoạt động AI cho học sinh', 'kind', 'product', 'mod', m_i2, 'mode', 'rubric', 'w', 30, 'max', 10, 'task', 'Thiết kế 01 hoạt động 45 phút cho học sinh dùng AI nhận dạng hình ảnh, kèm phiếu học tập.', 'rubric', jsonb_build_array(
      jsonb_build_object('id', 'rc-e1', 'name', 'Ý tưởng phù hợp lứa tuổi', 'pts', 3, 'comp', 'tk', 'req', true, 'desc', jsonb_build_array('Gần gũi, an toàn', 'Phù hợp', 'Hơi khó với HS', 'Không phù hợp')),
      jsonb_build_object('id', 'rc-e2', 'name', 'Ứng dụng công cụ AI', 'pts', 4, 'comp', 'cn', 'req', false, 'desc', jsonb_build_array('Dùng đúng, có hướng dẫn chi tiết', 'Dùng đúng', 'Còn lỗi thao tác', 'Không dùng được')),
      jsonb_build_object('id', 'rc-e3', 'name', 'Phiếu học tập', 'pts', 3, 'comp', 'dg', 'req', false, 'desc', jsonb_build_array('Có câu hỏi phân hoá', 'Đủ nội dung', 'Sơ sài', 'Không có'))))) where id = p2;
  update ph2_programs set items = jsonb_build_array(jsonb_build_object('id', 'it-bd1', 'name', 'Bài thu hoạch cuối khoá', 'kind', 'essay', 'mod', '', 'mode', 'score', 'w', 100, 'max', 10, 'rubric', '[]'::jsonb, 'task', 'Bài thu hoạch 3–5 trang về vận dụng nội dung bồi dưỡng tại đơn vị.')) where id = p3;
  update ph2_programs set items = jsonb_build_array(
    jsonb_build_object('id', 'it-ns1', 'name', 'Kiểm tra trắc nghiệm học liệu số', 'kind', 'quiz', 'mod', m_n1, 'mode', 'score', 'w', 40, 'max', 10, 'rubric', '[]'::jsonb, 'task', '20 câu trắc nghiệm trực tuyến về khai thác học liệu số và bản quyền.'),
    jsonb_build_object('id', 'it-ns2', 'name', 'Bài giảng số tương tác', 'kind', 'product', 'mod', m_n2, 'mode', 'rubric', 'w', 60, 'max', 10, 'task', 'Thiết kế 01 bài giảng số có ít nhất 3 hoạt động tương tác.', 'rubric', jsonb_build_array(
      jsonb_build_object('id', 'rc-f1', 'name', 'Hoạt động tương tác', 'pts', 4, 'comp', 'cn', 'req', true, 'desc', jsonb_build_array('Từ 3 hoạt động, đa dạng', 'Đủ 3 hoạt động', 'Dưới 3 hoạt động', 'Không có tương tác')),
      jsonb_build_object('id', 'rc-f2', 'name', 'Nội dung chính xác', 'pts', 3, 'comp', 'tk', 'req', false, 'desc', jsonb_build_array('Chính xác, cập nhật', 'Chính xác', 'Còn sai sót nhỏ', 'Sai kiến thức')),
      jsonb_build_object('id', 'rc-f3', 'name', 'Câu hỏi kiểm tra', 'pts', 3, 'comp', 'dg', 'req', false, 'desc', jsonb_build_array('Có câu hỏi phân hoá', 'Đủ câu hỏi', 'Ít câu hỏi', 'Không có'))))) where id = p4;

  -- Giáo viên học viên: 3 trường THCS của Hưng Yên, ưu tiên môn KHTN / Toán / Công nghệ / Tin học
  select array_agg(id) into sch from (select o.id from organizations o where o.type = 'school' and o.name ilike '%THCS%' and o.id in (
    with recursive tr as (select id from organizations where id = v_so union all select o2.id from organizations o2 join tr on o2.parent_id = tr.id) select id from tr) order by o.name limit 3) x;
  if sch is null then return; end if;
  select array_agg(id) into tch from (select te.id from teachers te where te.org_id = any(sch) and te.subject in ('Khoa học tự nhiên', 'Toán', 'Công nghệ', 'Tin học')
    order by array_position(sch, te.org_id), te.full_name limit 12) x;
  if coalesce(array_length(tch, 1), 0) < 12 then return; end if;

  insert into ph2_plans (org_id, program_id, title, unit, status, subjs, cap, reg_due, schools, assist, notice)
    values (v_so, p1, 'Tập huấn Dạy học STEM cơ bản – đợt 1', 'Sở GD&ĐT Hưng Yên', 'published', '{khtn,toan}', 40, '2026-08-30', sch, '{"ThS. Nguyễn Thị Hồng"}', '{"date": "15/08/2026", "n": 12, "bgh": true}') returning id into k1;
  insert into ph2_plans (org_id, program_id, title, unit, status, subjs, cap, reg_due, schools, assist, notice)
    values (v_kdi, p2, 'Robotics & AI – lớp trực tuyến tháng 10', 'KDI Education', 'published', '{robotics,tin_hoc}', 30, '2026-10-10', sch[2:3], '{"Nguyễn Văn Phúc"}', '{"date": "25/09/2026", "n": 6, "bgh": false}') returning id into k2;
  insert into ph2_plans (org_id, program_id, title, unit, status, subjs, cap, reg_due, schools, subj_only, cond)
    values (v_so, p2, 'Robotics & AI – đợt 2 (trực tiếp)', 'Phòng GD&ĐT TP Hưng Yên', 'draft', '{robotics}', 25, '2026-11-15', sch[2:2], true, 'Ưu tiên học viên đã học đợt trực tuyến tháng 10') returning id into k3;
  insert into ph2_plans (org_id, program_id, title, unit, status, subjs, cap, reg_due, notice)
    values (v_so, p1, 'Tập huấn Dạy học STEM cơ bản – đợt 2', 'Sở GD&ĐT Hưng Yên', 'published', '{cong_nghe}', 30, '2026-11-08', '{"date": "18/10/2026", "n": 12, "bgh": true}') returning id into k4;

  update ph2_plans set created_at = now() - interval '4 min' where id = k1; update ph2_plans set created_at = now() - interval '3 min' where id = k2;
  update ph2_plans set created_at = now() - interval '2 min' where id = k3; update ph2_plans set created_at = now() - interval '1 min' where id = k4;
  -- Buổi: mỗi mô-đun của các môn trong đợt × số buổi, cách nhau 7 ngày (bỏ Chủ nhật)
  d := '2026-09-05';
  for s in select m.* from ph2_modules m where m.program_id = p1 and m.subject in ('khtn', 'toan') order by array_position(array['khtn', 'toan'], m.subject), m.seq loop
    for k in 1..s.sessions loop
      if extract(dow from d) = 0 then d := d + 1; end if;
      insert into ph2_sessions (plan_id, date, start_t, end_t, module_id, subject, mode, place, trainer) values (k1, d, '08:00', '11:00', s.id, s.subject, 'off', 'Hội trường Sở GD&ĐT Hưng Yên', 'TS. Lê Minh Quân');
      d := d + 7;
    end loop;
  end loop;
  update ph2_sessions set mode = 'on', place = null, link = 'https://meet.google.com/kdi-stem-cb4' where id = (select id from ph2_sessions where plan_id = k1 order by date offset 3 limit 1);
  d := '2026-10-14'; n := 0;
  for s in select m.* from ph2_modules m where m.program_id = p2 order by array_position(array['robotics', 'tin_hoc'], m.subject), m.seq loop
    for k in 1..s.sessions loop
      insert into ph2_sessions (plan_id, date, start_t, end_t, module_id, subject, mode, link, rec, trainer)
        values (k2, d, '19:30', '21:30', s.id, s.subject, 'on', case when n < 3 then 'https://zoom.us/j/8812345' || n end, case when n = 0 then 'https://drive.google.com/file/d/rec-robo-1' end, 'ThS. Phạm Đức Anh');
      n := n + 1; d := d + 7;
    end loop;
  end loop;
  d := '2026-11-21';
  for s in select m.* from ph2_modules m where m.program_id = p2 and m.subject = 'robotics' order by m.seq loop
    for k in 1..s.sessions loop
      insert into ph2_sessions (plan_id, date, start_t, end_t, module_id, subject, mode, place, trainer) values (k3, d, '08:00', '10:00', s.id, s.subject, 'off', 'Phòng STEM của trường', 'ThS. Phạm Đức Anh');
      d := d + 7;
    end loop;
  end loop;
  insert into ph2_sessions (plan_id, date, start_t, end_t, module_id, subject, mode, place, trainer) values (k4, '2026-11-14', '08:00', '11:00', m_c1, 'cong_nghe', 'off', 'Hội trường Sở GD&ĐT Hưng Yên', 'TS. Lê Minh Quân');

  insert into ph2_trainees (plan_id, teacher_id, reg_at) select k1, x, '2026-08-20' from unnest(tch[1:9]) x;
  insert into ph2_trainees (plan_id, teacher_id, reg_at) select k2, x, '2026-10-02' from unnest(array[tch[4], tch[5], tch[8], tch[9], tch[11], tch[12]]) x;
  insert into ph2_trainees (plan_id, teacher_id, reg_at) select k4, x, '2026-10-21' from unnest(array[tch[1], tch[2], tch[3], tch[4], tch[9], tch[11]]) x;

  -- Điểm danh các buổi đã diễn ra
  insert into ph2_attendance (session_id, teacher_id, mark)
    select se.id, tr.teacher_id, (array['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p', 'p', 'p', 'p', 'p', 'p', 'l', 'e', 'a'])[1 + floor(random() * 16)::int]
    from ph2_sessions se join ph2_trainees tr on tr.plan_id = se.plan_id where se.date < current_date;

  -- Bài nộp & điểm: đợt 1 chấm đủ các đầu điểm đã mở; các đợt khác chỉ trắc nghiệm
  for t in select teacher_id from ph2_trainees where plan_id = k1 loop
    for it in select * from jsonb_array_elements((select items from ph2_programs where id = p1)) loop
      if it->>'kind' <> 'quiz' and random() < 0.07 then continue; end if;
      if it->>'mode' = 'score' then
        insert into ph2_grades (plan_id, item_id, teacher_id, score) values (k1, it->>'id', t, round((4.5 + random() * 5.5)::numeric * 2) / 2);
      else
        lv := '{}'::jsonb;
        for c in select * from jsonb_array_elements(it->'rubric') loop
          r := random(); lv := lv || jsonb_build_object(c->>'id', case when r < .3 then 0 when r < .66 then 1 when r < .94 then 2 else 3 end);
        end loop;
        insert into ph2_grades (plan_id, item_id, teacher_id, lv, note, sub) values (k1, it->>'id', t, lv,
          (array['Sản phẩm tốt, cần chú ý thời lượng.', 'Ý tưởng sáng tạo.', '', 'Cần bổ sung tiêu chí đánh giá học sinh.'])[1 + floor(random() * 4)::int],
          jsonb_build_object('at', '10/10', 'file', 'bai-nop.pdf', 'late', random() < .15));
      end if;
    end loop;
  end loop;
  insert into ph2_grades (plan_id, item_id, teacher_id, score) select k2, 'it-ro1', teacher_id, round((5 + random() * 5)::numeric * 2) / 2 from ph2_trainees where plan_id = k2;

  -- Phản hồi khoá đợt 1 (7 học viên)
  update ph2_plans set survey = jsonb_build_object('sent', '04/10/2026', 'due', '2026-10-11', 'anon', true) where id = k1;
  n := 0;
  for t in select teacher_id from ph2_trainees where plan_id = k1 order by teacher_id limit 7 loop
    insert into ph2_feedback (plan_id, teacher_id, answers) values (k1, t, jsonb_build_object('q1', 3 + floor(random() * 3), 'q2', 3 + floor(random() * 3), 'q3', least(5, 4 + floor(random() * 2)), 'q4', least(5, 4 + floor(random() * 2)),
      'q5', 3 + floor(random() * 3), 'q6', 3 + floor(random() * 3), 'q7', (array['Mong có thêm ví dụ cho môn Toán.', 'Nên tăng thời gian thực hành nhóm.', 'Học liệu rất dễ dùng.', '', 'Lớp ảo đôi lúc mất tiếng.', 'Giảng viên nhiệt tình, góp ý cụ thể.', ''])[n % 7 + 1]));
    n := n + 1;
  end loop;

  -- Bài giảng tập huấn
  insert into ph2_lectures (org_id, module_id, mat_version, title, author, status, parts) values
    (v_kdi, m_k2, 1, 'Quy trình 5 bước thiết kế bài học STEM', 'Lê Minh Quân', 'published', jsonb_build_array(
      jsonb_build_object('title', 'Khởi động: chia sẻ kinh nghiệm thực tế', 'minutes', 15, 'note', '', 'blocks', jsonb_build_array(
        jsonb_build_object('type', 'text', 'text', 'Mỗi thầy cô chia sẻ một tiết học “có tính STEM” mình đã dạy: học sinh làm ra sản phẩm gì?'),
        jsonb_build_object('type', 'video', 'url', 'https://youtube.com/watch?v=stemquytrinh', 'title', 'Video: Quy trình thiết kế kỹ thuật', 'start', ''))),
      jsonb_build_object('title', 'Nội dung 1: khái niệm và ví dụ', 'minutes', 45, 'note', '', 'blocks', jsonb_build_array(
        jsonb_build_object('type', 'quiz', 'q', 'Bước đầu tiên của quy trình thiết kế kỹ thuật là gì?', 'opts', jsonb_build_array('Xác định vấn đề', 'Chế tạo mẫu', 'Thử nghiệm'), 'ans', 0, 'explain', 'Bắt đầu bằng việc xác định vấn đề/nhu cầu cần giải quyết.'))),
      jsonb_build_object('title', 'Nội dung 2: thực hành theo nhóm', 'minutes', 60, 'note', '', 'blocks', '[]'::jsonb),
      jsonb_build_object('title', 'Thảo luận, trình bày sản phẩm', 'minutes', 30, 'note', '', 'blocks', '[]'::jsonb),
      jsonb_build_object('title', 'Tổng kết và giao nhiệm vụ', 'minutes', 15, 'note', '', 'blocks', '[]'::jsonb))),
    (v_kdi, m_r2, 2, 'Robot dò line với micro:bit', 'Phạm Đức Anh', 'published', '[{"title": "Khởi động", "minutes": 15, "note": "", "blocks": []}, {"title": "Lắp ráp robot", "minutes": 45, "note": "", "blocks": []}, {"title": "Lập trình dò line", "minutes": 45, "note": "", "blocks": []}, {"title": "Tổng kết", "minutes": 15, "note": "", "blocks": []}]'),
    (v_kdi, m_t1, 1, 'Toán học trong chủ đề STEM', 'Trần Văn Bình', 'draft', '[{"title": "Khởi động", "minutes": 20, "note": "", "blocks": []}, {"title": "Nội dung chính", "minutes": 60, "note": "", "blocks": []}, {"title": "Thực hành", "minutes": 60, "note": "", "blocks": []}, {"title": "Tổng kết", "minutes": 20, "note": "", "blocks": []}]');
end $$;
