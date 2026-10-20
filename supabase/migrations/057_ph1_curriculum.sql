-- 057. PH1 · 1.1.1 Chương trình đào tạo — quản lý nội dung chuẩn.
-- Cần chạy sau 056.
--   1. Danh mục điều chỉnh được (loại chương trình CT1–CT5, cấp học, môn, lĩnh vực, loại chuẩn đầu ra, hình thức đánh giá):
--      mặc định hệ thống → đơn vị (KDI, Sở, trường) thêm mục riêng hoặc ẩn mục kế thừa.
--   2. Chương trình (curricula) + phiên bản (curriculum_versions). Nội dung theo phiên bản:
--      chủ đề (curriculum_units) → bài học (curriculum_lessons, kế hoạch tiết) ; chuẩn đầu ra / YCCĐ (curriculum_outcomes)
--      gắn năng lực (042) ; tiêu chí đánh giá & minh chứng (curriculum_assessments) gắn mẫu rubric (041).
--   3. Vòng đời phiên bản: Nháp → Chờ duyệt (engine phê duyệt 022, loại "curriculum") → Đã duyệt → Ban hành (hiệu lực từ ngày)
--      → Hết hiệu lực khi có bản ban hành mới. Tạo phiên bản mới = sao chép bản đang hiệu lực. Đơn vị cấp dưới "kế thừa" =
--      sao chép thành chương trình của mình (giữ liên kết nguồn, được báo khi nguồn ban hành phiên bản mới).
--   4. Điểm nối cho các phần khác (cột tuỳ chọn, thêm mới): gói STEM (package_topics), chủ đề của lớp (class_topics),
--      bài giảng (lesson_plans), ngân hàng câu hỏi (question_bank) → chủ đề / bài học chuẩn; bài học → học liệu (library_items).
--      Hàm curriculum_available() trả các phiên bản đang hiệu lực đơn vị dùng được — đầu vào cho 1.1.3 Phân phối chương trình.
-- Quyền: chức năng 'curriculum' (thuộc phân hệ Chương trình & học liệu, khoá 'ph2' trong service_modules).

-- ===== 1. Danh mục điều chỉnh được =====
create table if not exists curriculum_catalog (
  id uuid primary key default gen_random_uuid(),
  owner_org_id uuid references organizations(id) on delete cascade,     -- null = mặc định hệ thống
  kind text not null check (kind in ('category', 'level', 'subject', 'field', 'outcome_type', 'assessment_method')),
  code text not null check (length(btrim(code)) between 1 and 40),
  name text not null check (length(btrim(name)) between 1 and 200),
  description text,
  color text check (color is null or color ~ '^#[0-9a-fA-F]{6}$'),
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create unique index if not exists curriculum_catalog_uq
  on curriculum_catalog (coalesce(owner_org_id, '00000000-0000-0000-0000-000000000000'::uuid), kind, code);
-- Đơn vị ẩn một mục kế thừa (mục của hệ thống hoặc của cấp trên) cho chính mình và đơn vị trực thuộc
create table if not exists curriculum_catalog_hidden (
  org_id uuid not null references organizations(id) on delete cascade,
  item_id uuid not null references curriculum_catalog(id) on delete cascade,
  primary key (org_id, item_id)
);

-- ===== 2. Chương trình & phiên bản =====
create table if not exists curricula (
  id uuid primary key default gen_random_uuid(),
  owner_org_id uuid not null references organizations(id) on delete cascade,
  code text check (code is null or length(btrim(code)) between 1 and 40),
  name text not null check (length(btrim(name)) between 1 and 300),
  category text,                                  -- mã danh mục 'category' (CT1–CT5 hoặc loại riêng của đơn vị)
  summary text,
  issuer text,                                    -- đơn vị ban hành (mặc định tên đơn vị sở hữu)
  levels text[] not null default '{}',            -- mã danh mục 'level'
  grades int[] not null default '{}' check (grades <@ array[0,1,2,3,4,5,6,7,8,9,10,11,12]),
  subjects text[] not null default '{}',          -- mã danh mục 'subject'
  fields text[] not null default '{}',            -- mã danh mục 'field'
  structure_labels jsonb not null default '{"unit": "Chủ đề", "lesson": "Bài học", "period": "Tiết"}'::jsonb
    check (jsonb_typeof(structure_labels) = 'object'),
  scope text not null default 'children' check (scope in ('own', 'children', 'selected', 'public')),
  require_approval boolean not null default true, -- false: người soạn ban hành thẳng, không qua phê duyệt
  source_curriculum_id uuid references curricula(id) on delete set null,   -- kế thừa từ chương trình nào
  source_version_id uuid,                                                  -- … phiên bản nào (khoá ngoại thêm bên dưới)
  current_version_id uuid,                                                 -- phiên bản đang hiệu lực
  archived_at timestamptz,
  created_by uuid references profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists curricula_code_uq on curricula (owner_org_id, lower(code)) where code is not null;
create index if not exists curricula_owner_idx on curricula (owner_org_id);
create index if not exists curricula_source_idx on curricula (source_curriculum_id);

create table if not exists curriculum_targets (
  curriculum_id uuid not null references curricula(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  primary key (curriculum_id, org_id)
);

create table if not exists curriculum_versions (
  id uuid primary key default gen_random_uuid(),
  curriculum_id uuid not null references curricula(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,     -- = curricula.owner_org_id (engine phê duyệt dùng)
  version_no int not null check (version_no > 0),
  label text,                                                              -- vd "2026–2027", "1.1"
  status text not null default 'draft'
    check (status in ('draft', 'pending', 'approved', 'rejected', 'published', 'superseded')),
  change_note text,
  based_on_version_id uuid references curriculum_versions(id) on delete set null,
  author_id uuid references profiles(id) on delete set null default auth.uid(),
  submitted_at timestamptz,
  decided_at timestamptz,
  published_at timestamptz,
  published_by uuid references profiles(id) on delete set null,
  effective_from date,
  effective_to date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (curriculum_id, version_no),
  check (effective_to is null or effective_from is null or effective_to >= effective_from)
);
-- Mỗi chương trình chỉ một phiên bản đang soạn / chờ duyệt / đã duyệt chưa ban hành
create unique index if not exists curriculum_versions_open_uq on curriculum_versions (curriculum_id)
  where status in ('draft', 'pending', 'approved', 'rejected');
create index if not exists curriculum_versions_org_idx on curriculum_versions (org_id, status);

alter table curricula drop constraint if exists curricula_current_version_fk;
alter table curricula add constraint curricula_current_version_fk foreign key (current_version_id) references curriculum_versions(id) on delete set null;
alter table curricula drop constraint if exists curricula_source_version_fk;
alter table curricula add constraint curricula_source_version_fk foreign key (source_version_id) references curriculum_versions(id) on delete set null;

-- ===== 3. Nội dung theo phiên bản =====
create table if not exists curriculum_units (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references curriculum_versions(id) on delete cascade,
  seq int not null default 1,
  code text,
  title text not null check (length(btrim(title)) between 1 and 300),
  summary text,
  grade int check (grade between 0 and 12),
  periods int not null default 0 check (periods >= 0),        -- tổng số tiết dự kiến
  subject_main text,                                          -- môn chủ đạo (mã danh mục 'subject')
  subjects_integrated text[] not null default '{}',           -- môn tích hợp
  room_kind text,                                             -- yêu cầu phòng học (→ 3.2), vd 'stem', 'classroom'
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists curriculum_units_version_idx on curriculum_units (version_id, seq);

create table if not exists curriculum_lessons (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references curriculum_versions(id) on delete cascade,
  unit_id uuid not null references curriculum_units(id) on delete cascade,
  seq int not null default 1,
  code text,
  title text not null check (length(btrim(title)) between 1 and 300),
  summary text,
  periods int not null default 1 check (periods >= 0),
  minutes_per_period int not null default 35 check (minutes_per_period between 5 and 240),
  period_plan jsonb not null default '[]'::jsonb check (jsonb_typeof(period_plan) = 'array'),  -- [{title, minutes, note}]
  library_item_id uuid references library_items(id) on delete set null,                       -- học liệu chính (→ 1.1.2)
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists curriculum_lessons_unit_idx on curriculum_lessons (unit_id, seq);
create index if not exists curriculum_lessons_version_idx on curriculum_lessons (version_id);

-- Chuẩn đầu ra / yêu cầu cần đạt: cấp chương trình (unit_id null), chủ đề, hoặc bài học
create table if not exists curriculum_outcomes (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references curriculum_versions(id) on delete cascade,
  unit_id uuid references curriculum_units(id) on delete cascade,
  lesson_id uuid references curriculum_lessons(id) on delete cascade,
  seq int not null default 1,
  code text,
  kind text,                                                  -- mã danh mục 'outcome_type' (kiến thức, kỹ năng, năng lực, phẩm chất…)
  subject text,                                               -- môn mà YCCĐ thuộc về (bài tích hợp nhiều môn)
  description text not null check (length(btrim(description)) between 1 and 2000),
  competency_key text references competencies(key) on delete set null,   -- năng lực HS (042)
  created_at timestamptz not null default now(),
  check (lesson_id is null or unit_id is not null)
);
create index if not exists curriculum_outcomes_version_idx on curriculum_outcomes (version_id, unit_id, lesson_id, seq);

-- Tiêu chí đánh giá & minh chứng
create table if not exists curriculum_assessments (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references curriculum_versions(id) on delete cascade,
  unit_id uuid references curriculum_units(id) on delete cascade,
  lesson_id uuid references curriculum_lessons(id) on delete cascade,
  seq int not null default 1,
  title text not null check (length(btrim(title)) between 1 and 300),
  method text,                                                -- mã danh mục 'assessment_method'
  outcome_ids uuid[] not null default '{}',                   -- chuẩn đầu ra được đánh giá
  rubric_id uuid references rubrics(id) on delete set null,   -- mẫu tiêu chí dùng lại (041)
  criteria jsonb not null default '[]'::jsonb check (jsonb_typeof(criteria) = 'array'),   -- [{name, levels: [4 mô tả]}]
  evidence text,                                              -- minh chứng cần thu
  weight numeric(5,2) check (weight is null or weight between 0 and 100),
  created_at timestamptz not null default now(),
  check (lesson_id is null or unit_id is not null)
);
create index if not exists curriculum_assessments_version_idx on curriculum_assessments (version_id, unit_id, lesson_id, seq);

-- ===== 4. Điểm nối với các phần khác (cột tuỳ chọn) =====
alter table package_topics add column if not exists curriculum_unit_id uuid references curriculum_units(id) on delete set null;
alter table class_topics   add column if not exists curriculum_unit_id uuid references curriculum_units(id) on delete set null;
alter table lesson_plans   add column if not exists curriculum_lesson_id uuid references curriculum_lessons(id) on delete set null;
alter table question_bank  add column if not exists curriculum_lesson_id uuid references curriculum_lessons(id) on delete set null;

drop trigger if exists curricula_touch on curricula;
create trigger curricula_touch before update on curricula for each row execute function public.touch_updated_at();
drop trigger if exists curriculum_versions_touch on curriculum_versions;
create trigger curriculum_versions_touch before update on curriculum_versions for each row execute function public.touch_updated_at();

-- ===== 5. Hàm quyền =====
-- Được soạn / quản lý chương trình tại đơn vị đang làm việc
create or replace function public.curriculum_can_manage() returns boolean
language sql stable security definer set search_path = public as $$
  select public.my_org_id() is not null and (
    public.is_platform_admin()
    or (public.org_has_module(public.my_org_id(), 'curriculum')
        and (public.is_admin() or public.is_authority() or public.has_role(array['provider']) or public.has_perm('curriculum', 'edit'))))
$$;

create or replace function public.curriculum_owner(p_curriculum uuid) returns uuid
language sql stable security definer set search_path = public as $$ select owner_org_id from curricula where id = p_curriculum $$;

-- Người dùng hiện tại thấy chương trình: của đơn vị mình / trực thuộc, hoặc đã ban hành và được phát hành tới mình
create or replace function public.curriculum_visible(p_curriculum uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from curricula c
     where c.id = p_curriculum and public.is_staff()
       and (c.owner_org_id in (select public.my_org_tree())
            or (c.current_version_id is not null and (
                  c.scope = 'public'
                  or (c.scope = 'children' and c.owner_org_id in (select public.my_ancestor_orgs()))
                  or (c.scope = 'selected' and exists (select 1 from curriculum_targets t
                        where t.curriculum_id = c.id and t.org_id in (select public.my_scope_orgs())))))))
$$;

-- Thấy một phiên bản: bản đã ban hành / hết hiệu lực của chương trình thấy được; bản đang soạn chỉ người quản lý của đơn vị (và cấp trên)
create or replace function public.curriculum_version_visible(p_version uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from curriculum_versions v join curricula c on c.id = v.curriculum_id
     where v.id = p_version and public.curriculum_visible(c.id)
       and (v.status in ('published', 'superseded')
            or (c.owner_org_id in (select public.my_org_tree()) and public.curriculum_can_manage())))
$$;

-- Sửa được nội dung phiên bản: đơn vị sở hữu, người quản lý, phiên bản đang soạn hoặc bị trả lại
create or replace function public.curriculum_version_editable(p_version uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from curriculum_versions v join curricula c on c.id = v.curriculum_id
     where v.id = p_version and c.owner_org_id = public.my_org_id() and c.archived_at is null
       and v.status in ('draft', 'rejected') and public.curriculum_can_manage())
$$;

grant execute on function public.curriculum_can_manage(), public.curriculum_visible(uuid), public.curriculum_version_visible(uuid),
  public.curriculum_version_editable(uuid) to authenticated;
revoke execute on function public.curriculum_owner(uuid) from public, anon;
grant execute on function public.curriculum_owner(uuid) to authenticated;

-- Cột tính toán cho API: tên đơn vị sở hữu (trường không đọc được hồ sơ KDI / Sở khác). select('*, owner_name')
create or replace function public.owner_name(curricula) returns text
language sql stable security definer set search_path = public as $$ select name from organizations where id = $1.owner_org_id $$;
grant execute on function public.owner_name(curricula) to authenticated;

-- ===== 6. Toàn vẹn nội dung =====
-- Chủ đề / bài học / chuẩn đầu ra / tiêu chí phải cùng phiên bản với chủ đề, bài học được tham chiếu
create or replace function public.curriculum_content_check() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_table_name = 'curriculum_lessons' then
    if not exists (select 1 from curriculum_units u where u.id = new.unit_id and u.version_id = new.version_id) then
      raise exception 'Chủ đề không thuộc phiên bản này' using errcode = '23514';
    end if;
  else
    if new.unit_id is not null and not exists (select 1 from curriculum_units u where u.id = new.unit_id and u.version_id = new.version_id) then
      raise exception 'Chủ đề không thuộc phiên bản này' using errcode = '23514';
    end if;
    if new.lesson_id is not null and not exists (select 1 from curriculum_lessons l where l.id = new.lesson_id and l.unit_id = new.unit_id) then
      raise exception 'Bài học không thuộc chủ đề này' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
do $$
declare t text;
begin
  foreach t in array array['curriculum_lessons', 'curriculum_outcomes', 'curriculum_assessments'] loop
    execute format('drop trigger if exists %I on %I', t || '_check', t);
    execute format('create trigger %I before insert or update on %I for each row execute function public.curriculum_content_check()', t || '_check', t);
  end loop;
end $$;

-- Phiên bản: org_id luôn = đơn vị sở hữu chương trình; chuyển trạng thái đúng vòng đời
create or replace function public.curriculum_version_guard() returns trigger
language plpgsql set search_path = public as $$
declare v_internal boolean := coalesce(current_setting('app.curriculum_internal', true), 'off') = 'on';
        v_engine boolean := coalesce(current_setting('app.approval_engine', true), 'off') = 'on';
begin
  new.org_id := (select owner_org_id from curricula where id = new.curriculum_id);
  if tg_op = 'INSERT' then
    if not v_internal then raise exception 'Tạo phiên bản qua curriculum_new_version()' using errcode = '42501'; end if;
    return new;
  end if;
  if new.curriculum_id <> old.curriculum_id or new.version_no <> old.version_no then
    raise exception 'Không đổi chương trình / số phiên bản' using errcode = '42501';
  end if;
  if new.status is distinct from old.status and new.status in ('approved', 'rejected') then new.decided_at := now(); end if;
  if v_internal or v_engine or new.status is not distinct from old.status then
    -- Ngoài hàm nội bộ: bản đã ban hành / hết hiệu lực không sửa được
    if not v_internal and old.status in ('published', 'superseded') and row(new.*) is distinct from row(old.*) then
      raise exception 'Phiên bản đã ban hành không sửa được — tạo phiên bản mới' using errcode = '42501';
    end if;
    return new;
  end if;
  -- Người dùng: gửi duyệt, sửa lại sau khi bị trả; duyệt / từ chối do approval_source_guard xử lý (đã chạy trước)
  if (old.status in ('draft', 'rejected') and new.status = 'pending')
     or (old.status = 'rejected' and new.status = 'draft')
     or (old.status = 'pending' and new.status in ('approved', 'rejected', 'pending')) then
    if new.status = 'pending' then
      if (select require_approval from curricula where id = new.curriculum_id) is false then
        raise exception 'Chương trình này ban hành không cần duyệt' using errcode = '22023';
      end if;
      if not exists (select 1 from curriculum_units where version_id = new.id) then
        raise exception 'Phiên bản chưa có chủ đề nào' using errcode = '22023';
      end if;
      new.submitted_at := now();
    end if;
    return new;
  end if;
  raise exception 'Không chuyển được trạng thái % → %', old.status, new.status using errcode = '42501';
end $$;
drop trigger if exists curriculum_versions_status_guard on curriculum_versions;
create trigger curriculum_versions_status_guard before insert or update on curriculum_versions
  for each row execute function public.curriculum_version_guard();

-- ===== 7. Phê duyệt (engine 022): loại "curriculum" =====
alter table approval_workflows drop constraint if exists approval_workflows_kind_check;
alter table approval_workflows add constraint approval_workflows_kind_check
  check (kind in ('stem_registration', 'borrow_request', 'package_purchase', 'edu_plan', 'project', 'supply_purchase', 'stock_transfer', 'curriculum'));
create or replace function public.approval_kind_module(p_kind text) returns text language sql immutable as $$
  select case p_kind when 'stem_registration' then 'stem_registrations' when 'borrow_request' then 'stem_rooms'
    when 'package_purchase' then 'packages' when 'edu_plan' then 'edu_plan' when 'project' then 'projects'
    when 'supply_purchase' then 'equipment' when 'stock_transfer' then 'equipment' when 'curriculum' then 'curriculum' end
$$;
create or replace function public.approval_kind_label(p_kind text) returns text language sql immutable as $$
  select case p_kind when 'stem_registration' then 'Đăng ký dạy STEM' when 'borrow_request' then 'Phiếu mượn thiết bị'
    when 'package_purchase' then 'Đề xuất mua gói STEM' when 'edu_plan' then 'Kế hoạch giáo dục' when 'project' then 'Dự án STEM'
    when 'supply_purchase' then 'Đề xuất mua vật tư' when 'stock_transfer' then 'Phiếu vận chuyển'
    when 'curriculum' then 'Chương trình đào tạo' end
$$;

-- Gửi duyệt → mở hồ sơ (không sửa approval_source_opened dùng chung)
create or replace function public.curriculum_version_opened() returns trigger
language plpgsql security definer set search_path = public as $$
declare c curricula; v_units int; v_periods int;
begin
  if new.status <> 'pending' or old.status = 'pending' then return null; end if;
  select * into c from curricula where id = new.curriculum_id;
  select count(*), coalesce(sum(periods), 0) into v_units, v_periods from curriculum_units where version_id = new.id;
  perform public.approval_open(new.org_id, 'curriculum', 'curriculum_versions', new.id,
    c.name || ' · phiên bản ' || coalesce(new.label, new.version_no::text),
    concat_ws(' · ', nullif(c.category, ''), v_units || ' chủ đề', v_periods || ' tiết', nullif(left(new.change_note, 120), '')),
    auth.uid());
  return null;
end $$;
drop trigger if exists curriculum_versions_approval_open on curriculum_versions;
create trigger curriculum_versions_approval_open after update of status on curriculum_versions
  for each row execute function public.curriculum_version_opened();
drop trigger if exists curriculum_versions_approval_guard on curriculum_versions;
create trigger curriculum_versions_approval_guard before update of status on curriculum_versions
  for each row execute function public.approval_source_guard();
drop trigger if exists curriculum_versions_approval_deleted on curriculum_versions;
create trigger curriculum_versions_approval_deleted after delete on curriculum_versions
  for each row execute function public.approval_source_deleted();

-- Người duyệt mặc định (bước "theo quyền"): đơn vị quản lý / cung cấp / nền tảng có quyền 'curriculum'
insert into role_permissions (role_id, module, can_view, can_detail, can_create, can_edit, can_delete)
select r.id, 'curriculum', true, true, true, true, true
  from roles r where r.org_id is null and r.key in ('ministry', 'province', 'department', 'district', 'provider', 'platform_admin')
on conflict do nothing;

-- ===== 8. Hàm nghiệp vụ =====
-- Sao chép nội dung phiên bản p_from sang p_to (giữ liên kết chủ đề ↔ bài học ↔ chuẩn đầu ra ↔ tiêu chí)
create or replace function public.curriculum_copy_content(p_from uuid, p_to uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  create temp table if not exists _cur_map (old_id uuid primary key, new_id uuid not null) on commit drop;
  delete from _cur_map;
  insert into _cur_map select id, gen_random_uuid() from curriculum_units where version_id = p_from;
  insert into _cur_map select id, gen_random_uuid() from curriculum_lessons where version_id = p_from;
  insert into _cur_map select id, gen_random_uuid() from curriculum_outcomes where version_id = p_from;
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

-- Tạo chương trình mới (kèm phiên bản 1 nháp)
create or replace function public.curriculum_create(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_org uuid := public.my_org_id(); v_id uuid; v_type text;
begin
  if not public.curriculum_can_manage() then raise exception 'Bạn không có quyền soạn chương trình' using errcode = '42501'; end if;
  select type into v_type from organizations where id = v_org;
  if coalesce(p->>'scope', 'children') = 'public' and v_type <> 'provider' and not public.is_platform_admin() then
    raise exception 'Chỉ đơn vị cung cấp phát hành công khai' using errcode = '42501';
  end if;
  insert into curricula (owner_org_id, code, name, category, summary, issuer, levels, grades, subjects, fields, scope, require_approval, structure_labels)
  values (v_org, nullif(btrim(p->>'code'), ''), btrim(p->>'name'), nullif(p->>'category', ''), nullif(p->>'summary', ''),
          coalesce(nullif(btrim(p->>'issuer'), ''), (select name from organizations where id = v_org)),
          coalesce(array(select jsonb_array_elements_text(p->'levels')), '{}'),
          coalesce(array(select (jsonb_array_elements_text(p->'grades'))::int), '{}'),
          coalesce(array(select jsonb_array_elements_text(p->'subjects')), '{}'),
          coalesce(array(select jsonb_array_elements_text(p->'fields')), '{}'),
          coalesce(p->>'scope', case when v_type = 'school' then 'own' else 'children' end),
          coalesce((p->>'require_approval')::boolean, true),
          coalesce(p->'structure_labels', '{"unit": "Chủ đề", "lesson": "Bài học", "period": "Tiết"}'::jsonb))
  returning id into v_id;
  perform set_config('app.curriculum_internal', 'on', true);
  insert into curriculum_versions (curriculum_id, org_id, version_no, label, change_note) values (v_id, v_org, 1, nullif(p->>'label', ''), 'Bản đầu tiên');
  perform set_config('app.curriculum_internal', 'off', true);
  insert into audit_log (actor, org_id, entity, entity_id, action, summary)
    values (auth.uid(), v_org, 'curricula', v_id::text, 'insert', 'Tạo chương trình đào tạo ' || btrim(p->>'name'));
  return v_id;
end $$;

-- Tạo phiên bản mới từ bản đang hiệu lực (hoặc bản chỉ định)
create or replace function public.curriculum_new_version(p_curriculum uuid, p_from uuid default null, p_label text default null, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare c curricula; v_from uuid; v_id uuid; v_no int;
begin
  select * into c from curricula where id = p_curriculum;
  if c.id is null or c.owner_org_id <> public.my_org_id() or not public.curriculum_can_manage() then
    raise exception 'Bạn không có quyền với chương trình này' using errcode = '42501';
  end if;
  if exists (select 1 from curriculum_versions where curriculum_id = c.id and status in ('draft', 'pending', 'approved', 'rejected')) then
    raise exception 'Chương trình đang có phiên bản chưa ban hành — hoàn tất hoặc xoá bản đó trước' using errcode = '22023';
  end if;
  v_from := coalesce(p_from, c.current_version_id, (select id from curriculum_versions where curriculum_id = c.id order by version_no desc limit 1));
  if v_from is not null and not exists (select 1 from curriculum_versions where id = v_from and curriculum_id = c.id) then
    raise exception 'Phiên bản nguồn không thuộc chương trình' using errcode = '22023';
  end if;
  select coalesce(max(version_no), 0) + 1 into v_no from curriculum_versions where curriculum_id = c.id;
  perform set_config('app.curriculum_internal', 'on', true);
  insert into curriculum_versions (curriculum_id, org_id, version_no, label, change_note, based_on_version_id)
    values (c.id, c.owner_org_id, v_no, nullif(btrim(p_label), ''), nullif(btrim(p_note), ''), v_from) returning id into v_id;
  perform set_config('app.curriculum_internal', 'off', true);
  if v_from is not null then perform public.curriculum_copy_content(v_from, v_id); end if;
  return v_id;
end $$;

-- Kế thừa: sao một phiên bản (đã ban hành, đơn vị thấy được) thành chương trình của đơn vị mình để điều chỉnh
create or replace function public.curriculum_clone(p_version uuid, p_name text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v curriculum_versions; c curricula; v_org uuid := public.my_org_id(); v_id uuid; v_new uuid; v_type text;
begin
  if not public.curriculum_can_manage() then raise exception 'Bạn không có quyền soạn chương trình' using errcode = '42501'; end if;
  select * into v from curriculum_versions where id = p_version;
  if v.id is null or not public.curriculum_version_visible(v.id) then raise exception 'Không tìm thấy phiên bản' using errcode = '42501'; end if;
  select * into c from curricula where id = v.curriculum_id;
  select type into v_type from organizations where id = v_org;
  insert into curricula (owner_org_id, code, name, category, summary, issuer, levels, grades, subjects, fields, scope, require_approval,
                         structure_labels, source_curriculum_id, source_version_id)
  values (v_org, null, coalesce(nullif(btrim(p_name), ''), c.name), c.category, c.summary, (select name from organizations where id = v_org),
          c.levels, c.grades, c.subjects, c.fields, case when v_type = 'school' then 'own' else 'children' end, c.require_approval,
          c.structure_labels, c.id, v.id)
  returning id into v_id;
  perform set_config('app.curriculum_internal', 'on', true);
  insert into curriculum_versions (curriculum_id, org_id, version_no, change_note, based_on_version_id)
    values (v_id, v_org, 1, 'Kế thừa từ ' || c.name || ' · phiên bản ' || coalesce(v.label, v.version_no::text), null) returning id into v_new;
  perform set_config('app.curriculum_internal', 'off', true);
  perform public.curriculum_copy_content(v.id, v_new);
  insert into audit_log (actor, org_id, entity, entity_id, action, summary, detail)
    values (auth.uid(), v_org, 'curricula', v_id::text, 'insert', 'Kế thừa chương trình ' || c.name, jsonb_build_object('source_version', v.id));
  return v_id;
end $$;

-- Ban hành: bản đã duyệt (hoặc bản nháp nếu chương trình không cần duyệt) → hiệu lực từ ngày; bản cũ hết hiệu lực
create or replace function public.curriculum_publish(p_version uuid, p_effective_from date default null) returns void
language plpgsql security definer set search_path = public as $$
declare v curriculum_versions; c curricula; v_from date := coalesce(p_effective_from, current_date); u record;
begin
  select * into v from curriculum_versions where id = p_version for update;
  select * into c from curricula where id = v.curriculum_id;
  if v.id is null or c.owner_org_id <> public.my_org_id() or not public.curriculum_can_manage() then
    raise exception 'Bạn không có quyền ban hành chương trình này' using errcode = '42501';
  end if;
  if not (v.status = 'approved' or (v.status in ('draft', 'rejected') and not c.require_approval)) then
    raise exception 'Phiên bản phải được duyệt trước khi ban hành' using errcode = '22023';
  end if;
  if not exists (select 1 from curriculum_units where version_id = v.id) then
    raise exception 'Phiên bản chưa có chủ đề nào' using errcode = '22023';
  end if;
  perform set_config('app.curriculum_internal', 'on', true);
  update curriculum_versions set status = 'superseded', effective_to = greatest(coalesce(effective_from, v_from), v_from - 1)
   where curriculum_id = c.id and status = 'published';
  update curriculum_versions set status = 'published', published_at = now(), published_by = auth.uid(), effective_from = v_from, effective_to = null
   where id = v.id;
  update curricula set current_version_id = v.id, archived_at = null where id = c.id;
  perform set_config('app.curriculum_internal', 'off', true);
  insert into audit_log (actor, org_id, entity, entity_id, action, summary, detail)
    values (auth.uid(), c.owner_org_id, 'curriculum_versions', v.id::text, 'update',
            'Ban hành ' || c.name || ' · phiên bản ' || coalesce(v.label, v.version_no::text), jsonb_build_object('effective_from', v_from));
  -- Báo người quản lý các đơn vị đã kế thừa chương trình này: có phiên bản mới
  for u in select distinct m.user_id, k.owner_org_id, o.type
             from curricula k join organizations o on o.id = k.owner_org_id
             join memberships m on m.org_id = k.owner_org_id join roles r on r.id = m.role_id
            where k.source_curriculum_id = c.id and k.archived_at is null and r.org_id is null
              and r.key in ('principal', 'it_admin', 'ministry', 'province', 'department', 'district', 'provider', 'platform_admin') loop
    perform public.notify_user(u.user_id, u.owner_org_id, 'status', 'Chương trình nguồn có phiên bản mới',
      c.name || ' · phiên bản ' || coalesce(v.label, v.version_no::text) || ' hiệu lực từ ' || to_char(v_from, 'DD/MM/YYYY'),
      'Chương trình đào tạo', case when u.type = 'school' then 'school_admin' when u.type = 'provider' then 'platform' else 'department' end, c.id);
  end loop;
end $$;

-- Lưu trữ / mở lại chương trình (không xoá lịch sử)
create or replace function public.curriculum_archive(p_curriculum uuid, p_archive boolean default true) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.curriculum_owner(p_curriculum) is distinct from public.my_org_id() or not public.curriculum_can_manage() then
    raise exception 'Bạn không có quyền với chương trình này' using errcode = '42501';
  end if;
  update curricula set archived_at = case when p_archive then now() end where id = p_curriculum;
end $$;

-- Chương trình đang hiệu lực mà đơn vị hiện tại dùng được (đầu vào cho Phân phối chương trình, kế hoạch, theo dõi CT1–CT5)
create or replace function public.curriculum_available()
returns table (curriculum_id uuid, version_id uuid, owner_org_id uuid, owner_name text, code text, name text, category text,
               levels text[], grades int[], subjects text[], version_label text, version_no int, effective_from date,
               units int, lessons int, periods int, is_own boolean, source_curriculum_id uuid)
language sql stable security definer set search_path = public as $$
  select c.id, v.id, c.owner_org_id, o.name, c.code, c.name, c.category, c.levels, c.grades, c.subjects, v.label, v.version_no, v.effective_from,
         (select count(*)::int from curriculum_units u where u.version_id = v.id),
         (select count(*)::int from curriculum_lessons l where l.version_id = v.id),
         (select coalesce(sum(u.periods), 0)::int from curriculum_units u where u.version_id = v.id),
         c.owner_org_id = public.my_org_id(), c.source_curriculum_id
    from curricula c join curriculum_versions v on v.id = c.current_version_id join organizations o on o.id = c.owner_org_id
   where c.archived_at is null and public.curriculum_visible(c.id)
   order by c.owner_org_id = public.my_org_id() desc, c.name
$$;

grant execute on function public.curriculum_create(jsonb), public.curriculum_new_version(uuid, uuid, text, text), public.curriculum_clone(uuid, text),
  public.curriculum_publish(uuid, date), public.curriculum_archive(uuid, boolean), public.curriculum_available() to authenticated;

-- ===== 9. RLS =====
alter table curriculum_catalog enable row level security;
alter table curriculum_catalog_hidden enable row level security;
alter table curricula enable row level security;
alter table curriculum_targets enable row level security;
alter table curriculum_versions enable row level security;
alter table curriculum_units enable row level security;
alter table curriculum_lessons enable row level security;
alter table curriculum_outcomes enable row level security;
alter table curriculum_assessments enable row level security;

-- Danh mục: thấy mục hệ thống + của đơn vị mình và cấp trên (và cấp dưới để quản lý); sửa mục của đơn vị mình
drop policy if exists curriculum_catalog_read on curriculum_catalog;
create policy curriculum_catalog_read on curriculum_catalog for select to authenticated using (
  owner_org_id is null or owner_org_id in (select public.my_scope_orgs()) or owner_org_id in (select public.my_org_tree()));
drop policy if exists curriculum_catalog_write on curriculum_catalog;
create policy curriculum_catalog_write on curriculum_catalog for all to authenticated
  using ((owner_org_id = (select public.my_org_id()) and (select public.curriculum_can_manage())) or (owner_org_id is null and (select public.is_platform_admin())))
  with check ((owner_org_id = (select public.my_org_id()) and (select public.curriculum_can_manage())) or (owner_org_id is null and (select public.is_platform_admin())));
drop policy if exists curriculum_catalog_hidden_read on curriculum_catalog_hidden;
create policy curriculum_catalog_hidden_read on curriculum_catalog_hidden for select to authenticated using (
  org_id in (select public.my_scope_orgs()) or org_id in (select public.my_org_tree()));
drop policy if exists curriculum_catalog_hidden_write on curriculum_catalog_hidden;
create policy curriculum_catalog_hidden_write on curriculum_catalog_hidden for all to authenticated
  using (org_id = (select public.my_org_id()) and (select public.curriculum_can_manage()))
  with check (org_id = (select public.my_org_id()) and (select public.curriculum_can_manage()));

-- Chương trình: thêm qua curriculum_create(); sửa thông tin chung khi là của đơn vị mình
drop policy if exists curricula_read on curricula;
create policy curricula_read on curricula for select to authenticated using (public.curriculum_visible(id));
drop policy if exists curricula_update on curricula;
create policy curricula_update on curricula for update to authenticated
  using (owner_org_id = (select public.my_org_id()) and (select public.curriculum_can_manage()))
  with check (owner_org_id = (select public.my_org_id()) and (select public.curriculum_can_manage())
    and (scope <> 'public' or (select public.is_platform_admin())
         or (select type from organizations where id = (select public.my_org_id())) = 'provider'));
-- Xoá: chỉ khi chưa từng ban hành
drop policy if exists curricula_delete on curricula;
create policy curricula_delete on curricula for delete to authenticated using (
  owner_org_id = (select public.my_org_id()) and (select public.curriculum_can_manage())
  and not exists (select 1 from curriculum_versions v where v.curriculum_id = curricula.id and v.status in ('published', 'superseded')));

drop policy if exists curriculum_targets_read on curriculum_targets;
create policy curriculum_targets_read on curriculum_targets for select to authenticated using (
  public.curriculum_owner(curriculum_id) in (select public.my_org_tree()) or org_id in (select public.my_scope_orgs()));
drop policy if exists curriculum_targets_write on curriculum_targets;
create policy curriculum_targets_write on curriculum_targets for insert to authenticated with check (
  public.curriculum_owner(curriculum_id) = (select public.my_org_id()) and (select public.curriculum_can_manage())
  and org_id in (select public.my_org_tree()) and org_id <> (select public.my_org_id()));
drop policy if exists curriculum_targets_delete on curriculum_targets;
create policy curriculum_targets_delete on curriculum_targets for delete to authenticated using (
  public.curriculum_owner(curriculum_id) = (select public.my_org_id()) and (select public.curriculum_can_manage()));

-- Phiên bản: tạo qua hàm; sửa (ghi chú, nhãn, gửi duyệt) và xoá bản chưa ban hành của đơn vị mình
drop policy if exists curriculum_versions_read on curriculum_versions;
create policy curriculum_versions_read on curriculum_versions for select to authenticated using (public.curriculum_version_visible(id));
drop policy if exists curriculum_versions_update on curriculum_versions;
create policy curriculum_versions_update on curriculum_versions for update to authenticated
  using (org_id = (select public.my_org_id()) and (select public.curriculum_can_manage()))
  with check (org_id = (select public.my_org_id()) and (select public.curriculum_can_manage()));
drop policy if exists curriculum_versions_delete on curriculum_versions;
create policy curriculum_versions_delete on curriculum_versions for delete to authenticated using (
  org_id = (select public.my_org_id()) and (select public.curriculum_can_manage()) and status in ('draft', 'rejected'));

-- Nội dung: đọc theo phiên bản; ghi khi phiên bản đang soạn
do $$
declare t text;
begin
  foreach t in array array['curriculum_units', 'curriculum_lessons', 'curriculum_outcomes', 'curriculum_assessments'] loop
    execute format('drop policy if exists %I on %I', t || '_read', t);
    execute format('create policy %I on %I for select to authenticated using (public.curriculum_version_visible(version_id))', t || '_read', t);
    execute format('drop policy if exists %I on %I', t || '_write', t);
    execute format('create policy %I on %I for all to authenticated using (public.curriculum_version_editable(version_id)) with check (public.curriculum_version_editable(version_id))', t || '_write', t);
  end loop;
end $$;

grant select, insert, update, delete on curriculum_catalog, curriculum_catalog_hidden, curriculum_targets,
  curriculum_units, curriculum_lessons, curriculum_outcomes, curriculum_assessments to authenticated;
grant select, update, delete on curricula, curriculum_versions to authenticated;

-- Nhật ký khi sửa thông tin chung / xoá chương trình
create or replace function public.curricula_audit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    insert into audit_log (actor, org_id, entity, entity_id, action, summary)
      values (auth.uid(), old.owner_org_id, 'curricula', old.id::text, 'delete', 'Xoá chương trình đào tạo ' || old.name);
    return old;
  end if;
  if (new.name, new.code, new.category, new.scope, new.require_approval, new.levels, new.grades, new.subjects, new.fields, new.issuer)
     is distinct from (old.name, old.code, old.category, old.scope, old.require_approval, old.levels, old.grades, old.subjects, old.fields, old.issuer) then
    insert into audit_log (actor, org_id, entity, entity_id, action, summary)
      values (auth.uid(), new.owner_org_id, 'curricula', new.id::text, 'update', 'Sửa thông tin chương trình ' || new.name);
  end if;
  return new;
end $$;
drop trigger if exists curricula_audit on curricula;
create trigger curricula_audit after update or delete on curricula for each row execute function public.curricula_audit();

-- ===== 10. Danh mục mặc định hệ thống (dữ liệu hệ thống, có ở cả production) =====
insert into curriculum_catalog (owner_org_id, kind, code, name, description, color, sort) values
  (null, 'category', 'CT1', 'Tích hợp nội môn', 'STEM lồng ghép trong một môn học', '#64748b', 1),
  (null, 'category', 'CT2', 'Liên môn', 'Chủ đề STEM tích hợp nhiều môn', '#2e95f2', 2),
  (null, 'category', 'CT3', 'Đổi mới sáng tạo', 'Thiết kế, chế tạo, sáng chế', '#7c3aed', 3),
  (null, 'category', 'CT4', 'Robotics / AI', 'Lập trình, robot, trí tuệ nhân tạo', '#dc2626', 4),
  (null, 'category', 'CT5', 'Nghiên cứu khoa học', 'Dự án nghiên cứu khoa học, kỹ thuật', '#16a34a', 5),
  (null, 'level', 'mamnon', 'Mầm non', null, null, 1),
  (null, 'level', 'tieuhoc', 'Tiểu học', null, null, 2),
  (null, 'level', 'thcs', 'THCS', null, null, 3),
  (null, 'level', 'thpt', 'THPT', null, null, 4),
  (null, 'subject', 'toan', 'Toán', null, null, 1),
  (null, 'subject', 'tieng_viet', 'Tiếng Việt', null, null, 2),
  (null, 'subject', 'ngu_van', 'Ngữ văn', null, null, 3),
  (null, 'subject', 'tnxh', 'Tự nhiên và Xã hội', null, null, 4),
  (null, 'subject', 'khoa_hoc', 'Khoa học', null, null, 5),
  (null, 'subject', 'khtn', 'Khoa học tự nhiên', null, null, 6),
  (null, 'subject', 'vat_li', 'Vật lí', null, null, 7),
  (null, 'subject', 'hoa_hoc', 'Hoá học', null, null, 8),
  (null, 'subject', 'sinh_hoc', 'Sinh học', null, null, 9),
  (null, 'subject', 'tin_hoc', 'Tin học', null, null, 10),
  (null, 'subject', 'cong_nghe', 'Công nghệ', null, null, 11),
  (null, 'subject', 'ls_dl', 'Lịch sử và Địa lí', null, null, 12),
  (null, 'subject', 'mi_thuat', 'Mĩ thuật', null, null, 13),
  (null, 'subject', 'am_nhac', 'Âm nhạc', null, null, 14),
  (null, 'subject', 'hdtn', 'Hoạt động trải nghiệm', null, null, 15),
  (null, 'subject', 'sang_che', 'Sáng chế', 'Môn STEM của KDI', null, 16),
  (null, 'field', 'stem', 'STEM', null, null, 1),
  (null, 'field', 'robotics', 'Robotics', null, null, 2),
  (null, 'field', 'ai', 'Trí tuệ nhân tạo', null, null, 3),
  (null, 'field', 'lap_trinh', 'Lập trình', null, null, 4),
  (null, 'field', 'khkt', 'Khoa học kỹ thuật', null, null, 5),
  (null, 'field', 'sang_tao', 'Thiết kế & sáng tạo', null, null, 6),
  (null, 'outcome_type', 'kien_thuc', 'Kiến thức', null, null, 1),
  (null, 'outcome_type', 'ky_nang', 'Kỹ năng', null, null, 2),
  (null, 'outcome_type', 'nang_luc', 'Năng lực', null, null, 3),
  (null, 'outcome_type', 'pham_chat', 'Phẩm chất', null, null, 4),
  (null, 'assessment_method', 'quan_sat', 'Quan sát', null, null, 1),
  (null, 'assessment_method', 'san_pham', 'Đánh giá sản phẩm', null, null, 2),
  (null, 'assessment_method', 'thuyet_trinh', 'Thuyết trình', null, null, 3),
  (null, 'assessment_method', 'phieu_hoc_tap', 'Phiếu học tập', null, null, 4),
  (null, 'assessment_method', 'trac_nghiem', 'Trắc nghiệm', null, null, 5),
  (null, 'assessment_method', 'tu_danh_gia', 'Tự đánh giá', null, null, 6),
  (null, 'assessment_method', 'dong_dang', 'Đánh giá đồng đẳng', null, null, 7)
on conflict do nothing;

-- Dữ liệu mẫu: 059_ph1_demo.sql
