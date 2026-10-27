-- 065. PH1 · Phân phối chương trình dựng theo bản mẫu giao diện (ph1-chuong-trinh-mau.html).
-- Cần chạy sau 064.
--   ppct_years      : năm học dùng chung cho mọi bản phân phối của đơn vị (ngày bắt đầu, số tuần học HK I / HK II, tuần khoá tay)
--   school_holidays : thêm tên ngắn hiện trên lịch; đơn vị quản lý (Sở/KDI) ghi được lịch nghỉ riêng cho trường trực thuộc
--   ppct_docs       : tối đa tiết STEM/tuần và lịch xếp theo môn (items: chương trình, môn, bắt đầu, nhịp, thứ tự bài, bài ghim tuần)

create table if not exists ppct_years (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  school_year text not null check (school_year ~ '^\d{4}-\d{4}$'),
  start_date date not null default date '2026-09-07',
  weeks_hk1 int not null default 18 check (weeks_hk1 between 1 and 30),
  weeks_hk2 int not null default 17 check (weeks_hk2 between 1 and 30),
  locks date[] not null default '{}',                 -- thứ Hai của các tuần khoá tay
  updated_at timestamptz not null default now(),
  unique (org_id, school_year)
);
alter table ppct_years enable row level security;
drop policy if exists ppct_years_read on ppct_years;
create policy ppct_years_read on ppct_years for select to authenticated
  using (org_id in (select public.my_org_tree()) or org_id in (select public.my_ancestor_orgs()));
drop policy if exists ppct_years_write on ppct_years;
create policy ppct_years_write on ppct_years for all to authenticated
  using (public.ph1_can_write(org_id)) with check (public.ph1_can_write(org_id));
drop trigger if exists ppct_years_touch on ppct_years;
create trigger ppct_years_touch before update on ppct_years for each row execute function public.touch_updated_at();

alter table school_holidays add column if not exists short_name text;
drop policy if exists school_holidays_ph1_write on school_holidays;
create policy school_holidays_ph1_write on school_holidays for all to authenticated
  using (public.ph1_can_write(org_id)) with check (public.ph1_can_write(org_id));

alter table ppct_docs add column if not exists max_ppw numeric(4,1) not null default 3 check (max_ppw > 0);
alter table ppct_docs add column if not exists items jsonb not null default '[]'::jsonb;

-- Dữ liệu mẫu: năm học và lịch nghỉ toàn tỉnh cho đơn vị nền tảng (chỉ khi bật app.seed_demo)
do $$
declare v_kdi uuid;
begin
  if coalesce(current_setting('app.seed_demo', true), '') <> 'on' then return; end if;
  select id into v_kdi from organizations where is_platform limit 1;
  if v_kdi is null then return; end if;
  insert into ppct_years (org_id, school_year) values (v_kdi, '2026-2027') on conflict do nothing;
  if not exists (select 1 from school_holidays where org_id = v_kdi and starts_on >= date '2026-09-01' and starts_on < date '2027-07-01') then
    insert into school_holidays (org_id, name, short_name, starts_on, ends_on) values
      (v_kdi, 'Tết Dương lịch', 'Tết DL', '2027-01-01', '2027-01-01'),
      (v_kdi, 'Tết Nguyên đán', 'Tết NĐ', '2027-02-01', '2027-02-12'),
      (v_kdi, 'Giỗ Tổ Hùng Vương', 'Giỗ Tổ', '2027-04-16', '2027-04-16'),
      (v_kdi, 'Giải phóng miền Nam, Quốc tế Lao động', '30/4–1/5', '2027-04-30', '2027-05-01');
  end if;
end $$;
