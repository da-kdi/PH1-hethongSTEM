-- 066. PH1 · Soạn bài giảng & kho hoạt động dựng theo bản mẫu giao diện (ph1-chuong-trinh-mau.html).
-- Cần chạy sau 065.
--   lesson_designs.description : mô tả bài giảng
--   lesson_designs.draft_of    : bản nháp sửa của một bài giảng đã xuất bản (học sinh vẫn xem bản cũ đến khi "Xuất bản thay bản cũ")
--   Nội dung trình chiếu nằm trong sessions[].activities[].blocks (văn bản, hình ảnh, video, trắc nghiệm, câu hỏi ngắn, liên kết, hoạt động từ kho).
alter table lesson_designs add column if not exists description text;
alter table lesson_designs add column if not exists draft_of uuid references lesson_designs(id) on delete cascade;
create index if not exists lesson_designs_draft_idx on lesson_designs (draft_of);
