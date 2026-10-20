-- 058. PH1 · Khung nghiệp vụ mục 1.1 Chương trình giáo dục & học liệu. Cần chạy sau 057.
-- Tách ba khái niệm:
--   • Chương trình giáo dục (curricula, 057): nội dung & quy định chuyên môn. Mã CT1, CT2… CTn là DỮ LIỆU, không cố định.
--     + Môn học thuộc chương trình (curriculum_subjects): môn × khối × tổng tiết / tiết mỗi tuần, theo phiên bản.
--   • Gói chương trình (program_packages): tập hợp chương trình / môn / khối / phiên bản cung cấp cho nhóm trường
--     (Cơ bản, Nâng cao, gói riêng…). Gói áp dụng cho trường (program_package_schools): năm học, khối.
--   • Phân phối chương trình (ppct_plans, ppct_items): kế hoạch theo trường / lớp / tuần / số tiết từ gói đã chọn.
-- Và: Học liệu (material_sets → material_lessons → tệp, định mức vật tư), Giáo án triển khai (lesson_designs),
--     Theo dõi (trạng thái từng mục kế hoạch, minh chứng, mức đạt yêu cầu), E-learning (khoá học gắn chương trình / gói).
-- Quyền (bản dựng khung): đọc trong cây đơn vị + cấp trên + KDI; ghi khi có quyền quản lý chương trình (curriculum_can_manage)
-- trên đơn vị thuộc cây của mình — quản trị nền tảng làm được mọi việc để dựng demo. Giáo viên soạn giáo án, cập nhật tiến độ.

-- ===== 0. Hàm dùng chung =====
create or replace function public.curriculum_is_platform_org(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$ select coalesce((select is_platform from organizations where id = p_org), false) $$;
create or replace function public.ph1_can_read(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_staff() and (p_org in (select public.my_org_tree()) or p_org in (select public.my_scope_orgs()) or public.curriculum_is_platform_org(p_org))
$$;
create or replace function public.ph1_can_write(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.curriculum_can_manage() and p_org in (select public.my_org_tree())
$$;
-- Ghi ở mức trường: người quản lý, hoặc nhân sự của chính trường (giáo viên cập nhật tiến độ, soạn giáo án)
create or replace function public.ph1_can_work(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.ph1_can_write(p_org) or (p_org = public.my_org_id() and public.is_staff())
$$;
grant execute on function public.curriculum_is_platform_org(uuid), public.ph1_can_read(uuid), public.ph1_can_write(uuid), public.ph1_can_work(uuid) to authenticated;

-- Danh mục: thêm loại "hạng gói"; mục KDI là mặc định cho mọi đơn vị
alter table curriculum_catalog drop constraint if exists curriculum_catalog_kind_check;
alter table curriculum_catalog add constraint curriculum_catalog_kind_check
  check (kind in ('category', 'level', 'subject', 'field', 'outcome_type', 'assessment_method', 'package_tier'));
drop policy if exists curriculum_catalog_read on curriculum_catalog;
create policy curriculum_catalog_read on curriculum_catalog for select to authenticated using (
  owner_org_id is null or owner_org_id in (select public.my_scope_orgs()) or owner_org_id in (select public.my_org_tree())
  or public.curriculum_is_platform_org(owner_org_id));
insert into curriculum_catalog (owner_org_id, kind, code, name, description, color, sort) values
  (null, 'package_tier', 'co_ban', 'Cơ bản', 'Một số chương trình, ít môn học', '#2a78d6', 1),
  (null, 'package_tier', 'nang_cao', 'Nâng cao', 'Bổ sung chương trình, môn học, thời lượng', '#7c3aed', 2),
  (null, 'package_tier', 'rieng', 'Gói riêng', 'Theo nhu cầu của Sở / trường', '#0f766e', 3),
  (null, 'subject', 'robotics', 'Robotics', null, null, 17),
  (null, 'subject', 'ai', 'Trí tuệ nhân tạo', null, null, 18),
  (null, 'subject', 'khkt', 'Nghiên cứu khoa học kỹ thuật', null, null, 19)
on conflict do nothing;

-- Chương trình: màu nhận diện; mặc định ban hành không cần duyệt (bản dựng khung)
alter table curricula add column if not exists color text check (color is null or color ~ '^#[0-9a-fA-F]{6}$');

-- ===== 1. Môn học thuộc chương trình (theo phiên bản) =====
create table if not exists curriculum_subjects (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references curriculum_versions(id) on delete cascade,
  seq int not null default 1,
  subject text not null,                                   -- mã danh mục 'subject'
  grade int not null check (grade between 0 and 12),
  periods_total int not null default 0 check (periods_total >= 0),          -- tổng tiết / năm theo quy định
  periods_per_week numeric(4,1) check (periods_per_week is null or periods_per_week > 0),
  is_required boolean not null default true,               -- bắt buộc / tự chọn trong chương trình
  notes text,
  unique (version_id, subject, grade)
);
create index if not exists curriculum_subjects_version_idx on curriculum_subjects (version_id, seq);
alter table curriculum_subjects enable row level security;
drop policy if exists curriculum_subjects_read on curriculum_subjects;
create policy curriculum_subjects_read on curriculum_subjects for select to authenticated using (public.curriculum_version_visible(version_id));
drop policy if exists curriculum_subjects_write on curriculum_subjects;
create policy curriculum_subjects_write on curriculum_subjects for all to authenticated
  using (public.curriculum_version_editable(version_id)) with check (public.curriculum_version_editable(version_id));
grant select, insert, update, delete on curriculum_subjects to authenticated;

-- Sao chép nội dung phiên bản: thêm môn học
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
  insert into curriculum_lessons (id, version_id, unit_id, seq, code, title, summary, periods, minutes_per_period, period_plan, library_item_id, notes)
    select m.new_id, p_to, mu.new_id, l.seq, l.code, l.title, l.summary, l.periods, l.minutes_per_period, l.period_plan, l.library_item_id, l.notes
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

-- ===== 2. Gói chương trình =====
create table if not exists program_packages (
  id uuid primary key default gen_random_uuid(),
  owner_org_id uuid not null references organizations(id) on delete cascade,
  code text,
  name text not null check (length(btrim(name)) between 1 and 300),
  tier text,                                               -- mã danh mục 'package_tier'
  description text,
  conditions text,                                         -- điều kiện áp dụng (phòng, thiết bị, GV tập huấn…)
  status text not null default 'draft' check (status in ('draft', 'proposed', 'approved', 'active', 'archived')),
  version_no int not null default 1,
  based_on_id uuid references program_packages(id) on delete set null,
  created_by uuid references profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists program_package_items (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references program_packages(id) on delete cascade,
  seq int not null default 1,
  curriculum_id uuid not null references curricula(id) on delete cascade,
  version_id uuid references curriculum_versions(id) on delete set null,   -- phiên bản cố định; null = bản đang hiệu lực
  subject text,                                                           -- null = mọi môn của chương trình
  grades int[] not null default '{}',                                     -- rỗng = mọi khối
  periods_total int check (periods_total is null or periods_total >= 0),  -- ghi đè thời lượng (gói Nâng cao tăng tiết)
  notes text
);
create index if not exists program_package_items_pkg_idx on program_package_items (package_id, seq);
create table if not exists program_package_schools (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references program_packages(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,     -- trường áp dụng
  school_year text not null check (school_year ~ '^\d{4}-\d{4}$'),
  grades int[] not null default '{}',
  status text not null default 'active' check (status in ('proposed', 'active', 'ended')),
  starts_on date, ends_on date, note text,
  created_at timestamptz not null default now(),
  unique (package_id, org_id, school_year)
);
create index if not exists program_package_schools_org_idx on program_package_schools (org_id, school_year);

-- ===== 3. Học liệu =====
create table if not exists material_sets (
  id uuid primary key default gen_random_uuid(),
  owner_org_id uuid not null references organizations(id) on delete cascade,
  code text,
  name text not null check (length(btrim(name)) between 1 and 300),
  curriculum_id uuid references curricula(id) on delete set null,
  version_id uuid references curriculum_versions(id) on delete set null,
  subject text, grade int check (grade between 0 and 12),
  description text,
  status text not null default 'draft' check (status in ('draft', 'review', 'published', 'archived')),
  version_no int not null default 1,
  created_by uuid references profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists material_lessons (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references material_sets(id) on delete cascade,
  curriculum_lesson_id uuid references curriculum_lessons(id) on delete set null,   -- bài chuẩn trong chương trình
  seq int not null default 1,
  code text,
  title text not null check (length(btrim(title)) between 1 and 300),
  periods int not null default 1 check (periods >= 0),
  sessions int not null default 1 check (sessions between 1 and 20),
  objectives text,
  subject_main text, subjects_integrated text[] not null default '{}',
  product_requirements text,                                 -- yêu cầu sản phẩm
  steps jsonb not null default '[]'::jsonb check (jsonb_typeof(steps) = 'array'),       -- [{session, title, minutes, teacher, student}]
  criteria jsonb not null default '[]'::jsonb check (jsonb_typeof(criteria) = 'array'), -- [{name, levels[4]}]
  notes text
);
create index if not exists material_lessons_set_idx on material_lessons (set_id, seq);
create table if not exists material_files (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references material_lessons(id) on delete cascade,
  seq int not null default 1,
  kind text not null check (kind in ('giao_an', 'huong_dan', 'phieu_hoc_tap', 'hinh_anh', 'video', 'tham_khao')),
  title text not null,
  url text
);
-- Định mức vật tư: nguyên vật liệu theo sản phẩm, dụng cụ theo nhóm, thiết bị dùng chung…
create table if not exists material_norms (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references material_lessons(id) on delete cascade,
  seq int not null default 1,
  category text not null default 'vat_tu' check (category in ('vat_tu', 'dung_cu', 'thiet_bi')),
  name text not null check (length(btrim(name)) between 1 and 200),
  spec text,                                                 -- quy cách
  unit text not null default 'cái',
  qty numeric(10,2) not null default 1 check (qty >= 0),
  basis text not null default 'per_product' check (basis in ('per_product', 'per_group', 'per_student', 'per_class')),
  consumable boolean not null default true,                  -- tiêu hao / dùng lại
  substitute text,                                           -- vật tư thay thế
  supply_id uuid references supplies(id) on delete set null -- nối danh mục kho (3.1)
);
create index if not exists material_norms_lesson_idx on material_norms (lesson_id, seq);

-- ===== 4. Phân phối chương trình =====
create table if not exists ppct_plans (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,         -- trường
  package_school_id uuid references program_package_schools(id) on delete set null,
  curriculum_id uuid references curricula(id) on delete set null,
  version_id uuid references curriculum_versions(id) on delete set null,
  material_set_id uuid references material_sets(id) on delete set null,
  title text not null,
  subject text, grade int check (grade between 0 and 12),
  class_ids uuid[] not null default '{}',
  school_year text not null check (school_year ~ '^\d{4}-\d{4}$'),
  start_date date not null,
  periods_per_week numeric(4,1) not null default 1 check (periods_per_week > 0),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  version_no int not null default 1,
  notes text,
  created_by uuid references profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ppct_plans_org_idx on ppct_plans (org_id, school_year);
create table if not exists ppct_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references ppct_plans(id) on delete cascade,
  seq int not null default 1,
  week_no int not null check (week_no between 1 and 60),
  planned_date date,
  curriculum_unit_id uuid references curriculum_units(id) on delete set null,
  curriculum_lesson_id uuid references curriculum_lessons(id) on delete set null,
  material_lesson_id uuid references material_lessons(id) on delete set null,
  title text not null,
  periods numeric(4,1) not null default 1 check (periods > 0),
  part int not null default 1,                                -- bài dài chia nhiều tuần: phần 1, 2…
  status text not null default 'planned' check (status in ('planned', 'done', 'moved', 'skipped')),
  done_on date,
  teacher_id uuid references teachers(id) on delete set null,
  room_kind text,
  evidence_url text, evidence_note text,
  achieved_pct numeric(5,2) check (achieved_pct is null or achieved_pct between 0 and 100),  -- mức đạt yêu cầu cần đạt
  note text
);
create index if not exists ppct_items_plan_idx on ppct_items (plan_id, week_no, seq);

-- Ngày nghỉ của trường và cấp trên rơi vào tuần (thứ Hai → thứ Sáu)?
create or replace function public.ppct_week_off(p_org uuid, p_monday date) returns boolean
language sql stable security definer set search_path = public as $$
  with recursive up as (
    select id, parent_id from organizations where id = p_org
    union all select o.id, o.parent_id from organizations o join up on o.id = up.parent_id
  ) select exists (select 1 from school_holidays h join up on up.id = h.org_id
                    where h.starts_on <= p_monday + 4 and h.ends_on >= p_monday and (h.ends_on - h.starts_on) >= 2)
$$;

-- Sinh kế hoạch: lấy bài học chuẩn (môn, khối của kế hoạch) theo thứ tự, xếp vào tuần theo số tiết / tuần,
-- bỏ tuần nghỉ; bài dài hơn số tiết còn trống của tuần được chia sang tuần sau. Ghép bài học liệu tương ứng.
create or replace function public.ppct_build(p_plan uuid) returns int
language plpgsql security definer set search_path = public as $$
declare p ppct_plans; l record; v_week int := 1; v_left numeric; v_cap numeric; v_take numeric; v_part int; v_seq int := 0;
  v_monday date; v_ver uuid; n int := 0; v_ml uuid;
begin
  select * into p from ppct_plans where id = p_plan;
  v_ver := coalesce(p.version_id, (select current_version_id from curricula where id = p.curriculum_id));
  delete from ppct_items where plan_id = p.id;
  v_monday := p.start_date - ((extract(isodow from p.start_date)::int) - 1);
  while public.ppct_week_off(p.org_id, v_monday) and v_week < 60 loop v_week := v_week + 1; v_monday := v_monday + 7; end loop;
  v_cap := p.periods_per_week;
  for l in
    select cl.id, cl.unit_id, cl.title, greatest(cl.periods, 1) as periods
      from curriculum_lessons cl join curriculum_units u on u.id = cl.unit_id
     where cl.version_id = v_ver
       and (p.subject is null or u.subject_main = p.subject)
       and (p.grade is null or u.grade = p.grade)
     order by u.seq, cl.seq
  loop
    v_left := l.periods; v_part := 1;
    select ml.id into v_ml from material_lessons ml where ml.set_id = p.material_set_id and ml.curriculum_lesson_id = l.id limit 1;
    while v_left > 0 loop
      if v_cap <= 0 then
        v_week := v_week + 1; v_monday := v_monday + 7; v_cap := p.periods_per_week;
        while public.ppct_week_off(p.org_id, v_monday) and v_week < 60 loop v_week := v_week + 1; v_monday := v_monday + 7; end loop;
      end if;
      exit when v_week > 60;
      v_take := least(v_left, v_cap); v_seq := v_seq + 1;
      insert into ppct_items (plan_id, seq, week_no, planned_date, curriculum_unit_id, curriculum_lesson_id, material_lesson_id, title, periods, part)
        values (p.id, v_seq, v_week, v_monday, l.unit_id, l.id, v_ml, l.title, v_take, v_part);
      v_left := v_left - v_take; v_cap := v_cap - v_take; v_part := v_part + 1; n := n + 1;
    end loop;
  end loop;
  return n;
end $$;
revoke execute on function public.ppct_build(uuid) from public, anon, authenticated;
create or replace function public.ppct_generate(p_plan uuid) returns int
language plpgsql security definer set search_path = public as $$
begin
  if not public.ph1_can_write((select org_id from ppct_plans where id = p_plan)) then
    raise exception 'Bạn không có quyền lập kế hoạch cho đơn vị này' using errcode = '42501';
  end if;
  return public.ppct_build(p_plan);
end $$;
grant execute on function public.ppct_generate(uuid) to authenticated;

-- ===== 5. Giáo án triển khai (từ học liệu gốc, không sửa học liệu / chương trình chuẩn) =====
create table if not exists lesson_designs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  teacher_id uuid references teachers(id) on delete set null,
  material_lesson_id uuid references material_lessons(id) on delete set null,
  curriculum_lesson_id uuid references curriculum_lessons(id) on delete set null,
  based_on_id uuid references lesson_designs(id) on delete set null,
  title text not null check (length(btrim(title)) between 1 and 300),
  subject text, grade int check (grade between 0 and 12),
  status text not null default 'draft' check (status in ('draft', 'review', 'published')),
  version_no int not null default 1,
  objectives text,
  sessions jsonb not null default '[]'::jsonb check (jsonb_typeof(sessions) = 'array'),   -- [{title, minutes, activities:[{title, minutes, teacher, student, product}]}]
  norms jsonb not null default '[]'::jsonb check (jsonb_typeof(norms) = 'array'),         -- định mức đã điều chỉnh theo lớp
  files jsonb not null default '[]'::jsonb check (jsonb_typeof(files) = 'array'),
  criteria jsonb not null default '[]'::jsonb check (jsonb_typeof(criteria) = 'array'),
  notes text,
  created_by uuid references profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists lesson_designs_org_idx on lesson_designs (org_id, status);

-- ===== 6. E-learning gắn chương trình / gói / bộ học liệu =====
alter table courses add column if not exists curriculum_id uuid references curricula(id) on delete set null;
alter table courses add column if not exists package_id uuid references program_packages(id) on delete set null;
alter table courses add column if not exists material_set_id uuid references material_sets(id) on delete set null;

-- ===== 7. updated_at + RLS =====
do $$
declare t text;
begin
  foreach t in array array['program_packages', 'material_sets', 'ppct_plans', 'lesson_designs'] loop
    execute format('drop trigger if exists %I on %I', t || '_touch', t);
    execute format('create trigger %I before update on %I for each row execute function public.touch_updated_at()', t || '_touch', t);
  end loop;
end $$;

create or replace function public.ph1_parent_org(p_table text, p_id uuid) returns uuid
language plpgsql stable security definer set search_path = public as $$
declare v uuid;
begin
  case p_table
    when 'program_packages' then select owner_org_id into v from program_packages where id = p_id;
    when 'material_sets' then select owner_org_id into v from material_sets where id = p_id;
    when 'material_lessons' then select s.owner_org_id into v from material_lessons l join material_sets s on s.id = l.set_id where l.id = p_id;
    when 'ppct_plans' then select org_id into v from ppct_plans where id = p_id;
    else v := null;
  end case;
  return v;
end $$;
grant execute on function public.ph1_parent_org(text, uuid) to authenticated;

alter table program_packages enable row level security;
alter table program_package_items enable row level security;
alter table program_package_schools enable row level security;
alter table material_sets enable row level security;
alter table material_lessons enable row level security;
alter table material_files enable row level security;
alter table material_norms enable row level security;
alter table ppct_plans enable row level security;
alter table ppct_items enable row level security;
alter table lesson_designs enable row level security;

-- Bảng gốc (có cột đơn vị)
drop policy if exists program_packages_read on program_packages;
create policy program_packages_read on program_packages for select to authenticated using (public.ph1_can_read(owner_org_id));
drop policy if exists program_packages_write on program_packages;
create policy program_packages_write on program_packages for all to authenticated
  using (public.ph1_can_write(owner_org_id)) with check (public.ph1_can_write(owner_org_id));
drop policy if exists material_sets_read on material_sets;
create policy material_sets_read on material_sets for select to authenticated using (public.ph1_can_read(owner_org_id));
drop policy if exists material_sets_write on material_sets;
create policy material_sets_write on material_sets for all to authenticated
  using (public.ph1_can_write(owner_org_id)) with check (public.ph1_can_write(owner_org_id));
drop policy if exists ppct_plans_read on ppct_plans;
create policy ppct_plans_read on ppct_plans for select to authenticated using (public.is_staff() and org_id in (select public.my_org_tree()));
drop policy if exists ppct_plans_write on ppct_plans;
create policy ppct_plans_write on ppct_plans for all to authenticated
  using (public.ph1_can_write(org_id)) with check (public.ph1_can_write(org_id));
drop policy if exists lesson_designs_read on lesson_designs;
create policy lesson_designs_read on lesson_designs for select to authenticated using (org_id in (select public.my_org_tree()) and public.is_staff());
drop policy if exists lesson_designs_write on lesson_designs;
create policy lesson_designs_write on lesson_designs for all to authenticated
  using (public.ph1_can_work(org_id)) with check (public.ph1_can_work(org_id));
-- Gói áp dụng cho trường: trường, cấp trên của trường và đơn vị sở hữu gói thấy
drop policy if exists program_package_schools_read on program_package_schools;
create policy program_package_schools_read on program_package_schools for select to authenticated using (
  public.is_staff() and (org_id in (select public.my_org_tree()) or public.ph1_parent_org('program_packages', package_id) in (select public.my_org_tree())));
drop policy if exists program_package_schools_write on program_package_schools;
create policy program_package_schools_write on program_package_schools for all to authenticated
  using (public.ph1_can_write(org_id) or public.ph1_can_write(public.ph1_parent_org('program_packages', package_id)))
  with check (public.ph1_can_write(org_id) or public.ph1_can_write(public.ph1_parent_org('program_packages', package_id)));

-- Bảng con: theo bảng cha
drop policy if exists program_package_items_read on program_package_items;
create policy program_package_items_read on program_package_items for select to authenticated using (public.ph1_can_read(public.ph1_parent_org('program_packages', package_id)));
drop policy if exists program_package_items_write on program_package_items;
create policy program_package_items_write on program_package_items for all to authenticated
  using (public.ph1_can_write(public.ph1_parent_org('program_packages', package_id))) with check (public.ph1_can_write(public.ph1_parent_org('program_packages', package_id)));
drop policy if exists material_lessons_read on material_lessons;
create policy material_lessons_read on material_lessons for select to authenticated using (public.ph1_can_read(public.ph1_parent_org('material_sets', set_id)));
drop policy if exists material_lessons_write on material_lessons;
create policy material_lessons_write on material_lessons for all to authenticated
  using (public.ph1_can_write(public.ph1_parent_org('material_sets', set_id))) with check (public.ph1_can_write(public.ph1_parent_org('material_sets', set_id)));
do $$
declare t text;
begin
  foreach t in array array['material_files', 'material_norms'] loop
    execute format('drop policy if exists %I on %I', t || '_read', t);
    execute format('create policy %I on %I for select to authenticated using (public.ph1_can_read(public.ph1_parent_org(%L, lesson_id)))', t || '_read', t, 'material_lessons');
    execute format('drop policy if exists %I on %I', t || '_write', t);
    execute format('create policy %I on %I for all to authenticated using (public.ph1_can_write(public.ph1_parent_org(%L, lesson_id))) with check (public.ph1_can_write(public.ph1_parent_org(%L, lesson_id)))', t || '_write', t, 'material_lessons', 'material_lessons');
  end loop;
end $$;
drop policy if exists ppct_items_read on ppct_items;
create policy ppct_items_read on ppct_items for select to authenticated using (
  public.is_staff() and public.ph1_parent_org('ppct_plans', plan_id) in (select public.my_org_tree()));
drop policy if exists ppct_items_write on ppct_items;
create policy ppct_items_write on ppct_items for all to authenticated
  using (public.ph1_can_work(public.ph1_parent_org('ppct_plans', plan_id))) with check (public.ph1_can_work(public.ph1_parent_org('ppct_plans', plan_id)));

grant select, insert, update, delete on program_packages, program_package_items, program_package_schools, material_sets, material_lessons,
  material_files, material_norms, ppct_plans, ppct_items, lesson_designs to authenticated;
