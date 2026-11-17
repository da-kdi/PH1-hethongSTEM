-- 070. Bản mẫu v315 · Danh mục PH2: “Năng lực” (dùng chung hai phân hệ) và “Khung đánh giá chung”. Chạy sau 069.
--   Năng lực: mã cố định (tk, tc, dg, cn, lt — xem COMP trong src/modules/ph2/api.ts) + năng lực thêm ở danh mục (ph2_catalog kind 'comp').
--   Chương trình đào tạo chọn năng lực hướng tới (ph2_programs.comps) và chương trình giáo dục liên quan (ph2_programs.edu);
--   chương trình giáo dục chọn năng lực giáo viên cần có (curricula.comps) — hệ thống tự khớp hai bên theo năng lực.
--   Khung đánh giá chung (ph2_settings.frame): tiêu chí, mức yêu cầu đạt; chương trình tạo mới nhận bản sao.
alter table ph2_catalog drop constraint if exists ph2_catalog_kind_check;
alter table ph2_catalog add constraint ph2_catalog_kind_check check (kind in ('group', 'unit', 'trainer', 'comp'));
alter table ph2_programs add column if not exists comps text[] not null default '{}';
alter table ph2_programs add column if not exists edu uuid[] not null default '{}';
alter table curricula add column if not exists comps text[] not null default '{}';
alter table ph2_settings add column if not exists frame jsonb;   -- {crit: [{id,name,comp,req,desc[]}], att, score, bands: {tot, kha}}
