-- 063 · PH1 theo bản mẫu giao diện (28/10/2026): chương trình có Số tiết/tuần, Số phút/tiết; một chương trình áp dụng nhiều khối, nhiều cấp học.
-- Không đổi dữ liệu cũ: chương trình đang có giữ nguyên khối; giá trị mặc định 2 tiết/tuần, 35 phút/tiết (THCS trở lên 45 phút).
alter table public.curricula add column if not exists periods_per_week numeric(4,1) not null default 2 check (periods_per_week > 0 and periods_per_week <= 40);
alter table public.curricula add column if not exists minutes_per_period integer not null default 35 check (minutes_per_period between 5 and 240);
update public.curricula set minutes_per_period = 45 where minutes_per_period = 35 and exists (select 1 from unnest(grades) g where g >= 6);
