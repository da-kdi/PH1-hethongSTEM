# PH1 · 1.1 Chương trình giáo dục & học liệu — hiện trạng và đề xuất

Đối chiếu: đề án *Hệ thống quản lý vận hành* Ver9 (PH1 = 1 nhóm, 6 chức năng), repo KDISTEM tại `UPSTREAM_BASE`, mẫu KHBD "Cột đèn giao thông xoay" (Sáng chế, khối 1, 2 tiết).

Trong sơ đồ quy trình tổng của đề án, 1.1 cấp ba luồng cho phân hệ khác: **Phân phối chương trình → 4.2 Kế hoạch & TKB**, **Yêu cầu phòng học → 3.2 Cơ sở vật chất**, **Định mức vật tư theo bài → 3.1 Thiết bị, vật tư & kho**. Hiện code mới có luồng thứ nhất (gián tiếp, qua chủ đề của gói), chưa có hai luồng sau.

## Xương sống dữ liệu hiện có

```
stem_packages (gói: programs 'CT1,CT3', grades, topics/devices/sessions là SỐ nhập tay)
 └─ package_topics (chủ đề: seq, program CT1–CT5, title, minutes, grade_assigned)
     └─ package_topic_sessions (buổi: seq, title, minutes)
class_programs (lớp ↔ CT1–CT5)          stem_teacher_programs (GV ↔ CT1–CT5)
class_topics → topic_lessons (bring_items: "mang theo", text tự do) → topic_materials (link)
curriculum_books (khối, môn, tên sách, tổng tiết)        ← "Phân phối chương trình" hiện tại
library_items (program | lesson | material; phát hành theo cây đơn vị) → library_copies
lesson_plans (slide JSON, program, from_package)    activities (8 mẫu hoạt động)
question_bank, practice_exams, courses … (053 e-learning)
supplies / supply_moves (044 — kho vật tư, CHƯA nối với bài học)
```

CT1–CT5 hiện chỉ là **mã văn bản** gắn rải rác (`class_programs`, `stem_teacher_programs`, `package_topics.program`, `lesson_plans.program`, `activities.program`, `library_items.program`); tên CT lặp ở 4 file (`lib/programs.ts`, `department/data.tsx`, `teacher/common.tsx`, `library/common.tsx`). Không có bảng danh mục chương trình.

## Từng chức năng

### 1. Chương trình giáo dục
- **Có:** KDI quản lý danh mục gói (`platform/Catalog.tsx`: gói, chủ đề, buổi; giá; giao gói cho trường bằng cách sao chép). Trường: `Gói STEM` (thẻ gói, số chủ đề/thiết bị/buổi nhập tay), `Đề xuất mua gói`.
- **Thiếu:** khung chương trình là một thực thể (CT1–CT5 × cấp học × khối, môn chủ đạo/tích hợp, YCCĐ theo CT GDPT 2018); phiên bản chương trình; gói chỉ là *cách bán* một tập chủ đề, nên tách "chương trình" (nội dung) khỏi "gói" (thương mại).
- **Đề xuất:** bảng `stem_programs` (mã CT1–CT5, tên, mô tả, màu — thay 4 chỗ khai báo cứng) và `program_units` (chủ đề chuẩn của KDI: khối, môn chủ đạo, môn tích hợp, số tiết, YCCĐ). `package_topics` tham chiếu `program_units` thay vì chép tiêu đề. Màn: cây Chương trình → Khối → Chủ đề → Bài, xem theo CT hoặc theo khối.

### 2. Học liệu (đã bao gồm định mức vật tư)
- **Có:** phát hành học liệu theo cây đơn vị, kho dùng chung, nhận về trường (`library/*`). Bài trong gói có `topic_lessons.bring_items` là text tự do.
- **Thiếu:** định mức vật tư. Mẫu KHBD cho thấy cấu trúc rõ ràng cần số hoá:
  - *Nguyên vật liệu cho **một sản phẩm***: tên, quy cách, đơn vị, số lượng (vd giấy carton 20×10 cm · miếng · 1; băng keo 2 mặt · cm · 10);
  - *Công cụ, thiết bị cho **một nhóm***: kéo · cái · 4; màu · bộ · 1;
  - tài liệu/phiếu học tập (đường dẫn).
- **Đề xuất:** bảng `lesson_bom` (bài học → dòng định mức): `supply_id` hoặc `equipment_type` (nối danh mục 044), `basis` = `per_product | per_group | per_student | per_class`, `qty`, `unit`, `consumable` (tiêu hao hay dùng lại). Hàm `lesson_material_need(lesson, so_hs, so_nhom)` → nhu cầu vật tư; tổng theo kế hoạch dạy → **"Nhu cầu vật tư theo kế hoạch"** đẩy sang 3.1 (đề xuất mua / cấp phát). Đây là điểm nối quan trọng nhất PH1 ↔ PH3, cần thống nhất mã vật tư với người làm 3.1.

### 3. Phân phối chương trình (Hardware — có cần đổi menu bên trong?)
- **Có:** `Phân phối chương trình` của trường chỉ là danh sách sách giáo khoa (`curriculum_books`: khối, môn, tên sách, tổng tiết/năm). Cổng KDI xem tổng hợp (`SysCurriculum`). Gói có ô "Số thiết bị" nhập tay.
- **Thiếu:** PPCT đúng nghĩa = chủ đề/bài phân theo **tuần/tiết** của năm học cho từng khối, gắn môn và tiết của môn đó (để 4.2 sinh kế hoạch giáo dục và TKB). Phần "hardware" (bộ thiết bị/kit đi kèm từng chủ đề, nhất là CT4 Robotics/AI) chưa có chỗ khai báo.
- **Đề xuất đổi menu bên trong** (giữ mã trang `Phân phối chương trình`, thay nội dung bằng các tab):
  1. *Khung PPCT* — lưới tuần × khối: chủ đề/bài, số tiết, môn lồng ghép; KDI đặt mẫu → Sở/trường điều chỉnh (kế thừa như Bộ chỉ số).
  2. *Thiết bị & bộ kit theo chủ đề* (hardware) — loại thiết bị, số bộ/lớp, dùng chung hay theo nhóm; nối danh mục thiết bị 3.1 để báo thiếu.
  3. *Yêu cầu phòng học* — loại phòng (STEM Nâng cao/Cơ bản/Tối thiểu, phòng học thường) theo chủ đề → 3.2.
  4. *Sách giáo khoa* — giữ màn `curriculum_books` hiện tại.

  Bảng: `ppct_templates` (đơn vị chủ, năm học, khối), `ppct_slots` (tuần, thứ tự, `program_unit_id`/bài, số tiết, môn), `unit_equipment` (chủ đề → loại thiết bị, số lượng, căn cứ). Không cần đổi mã trang; chỉ cần thêm tab — nên **không phải sửa menu ngoài**.

### 4. Soạn bài giảng & kho hoạt động (tuỳ chỉnh theo trường, thêm/bớt vật tư)
- **Có:** GV soạn bài giảng slide (`lesson_plans`), 8 mẫu hoạt động (`activities`), bài mẫu của trường (`is_template`), lấy từ học liệu (`library_copies`). KDI xem toàn hệ thống (`SysLessons`).
- **Thiếu:** bài giảng chưa có phần "đồ dùng dạy học"; trường không tuỳ chỉnh được nội dung bài chuẩn của KDI mà vẫn giữ liên kết với bản gốc.
- **Đề xuất:** KHBD theo khung mẫu (thông tin chung · nội dung tích hợp · YCCĐ · đồ dùng · hoạt động 1–4 · thông tin tài liệu). Bài của trường = **bản kế thừa** của bài KDI (`source_id` đã có): được thêm/bớt/đổi số lượng dòng định mức (`lesson_bom` của bản trường ghi đè bản gốc theo dòng), đổi hoạt động; khi KDI phát hành phiên bản mới thì báo "có cập nhật", cho xem khác biệt. Nhu cầu vật tư (mục 2) lấy theo bản của trường.

### 5. Theo dõi chương trình CT1–CT5 (Môn học) — phân bổ hiện tại
Màn này đang là 2 tab dùng lại màn của Sở (`department/Overview.tsx`), số liệu từ `useDeptStats()`:
- **Chương trình CT1–CT5** (`DeptPrograms`): 4 thẻ (trường đang triển khai ≥ 1 CT; trường đủ 5 CT; GV STEM; HS tham gia); 5 thẻ CT, mỗi thẻ: số trường · GV · HS, % số trường; bảng trường: CT đang dạy, GV STEM, HS, lớp STEM/tổng lớp.
  - Một trường "có" CT khi có lớp trong `class_programs`; GV STEM đếm từ `stem_teacher_programs`; HS = HS thuộc lớp có CT.
- **Môn học STEM** (`DeptSubjects`): tỉ lệ tiết STEM theo môn (tiết STEM/tổng tiết của môn trong TKB), số lớp, số trường — tính từ TKB, **không** theo CT.
- **Nhận xét:** đang đo *độ phủ* (có/không), chưa đo *tiến độ*: không biết mỗi trường đã dạy bao nhiêu chủ đề/tiết so với PPCT, theo CT nào, theo khối nào. Hai tab không nối nhau (CT không gắn môn).
- **Đề xuất cấu trúc:** khi có PPCT (mục 3) và buổi dạy thật (`teaching_sessions` đã có), tính **kế hoạch vs thực dạy** theo ma trận *CT × khối × môn*:
  - Tầng KDI/Sở: % trường đủ 5 CT; tiến độ PPCT (% tiết đã dạy/kế hoạch đến tuần hiện tại) theo CT; cảnh báo trường chậm > 2 tuần.
  - Tầng trường: theo lớp — chủ đề đang học, tuần thứ mấy, lệch PPCT; GV phụ trách CT.
  - Tab Môn học: mỗi môn hiển thị đóng góp tiết vào CT nào (từ "môn chủ đạo/tích hợp" của chủ đề).

  Cần thêm `teaching_sessions.program_unit_id` (hoặc liên kết qua `class_topics`) để biết tiết đã dạy thuộc chủ đề nào.

### 6. E-learning & luyện thi
- **Có (053):** ngân hàng câu hỏi (nhập tay/Excel/AI, dùng chung từ Sở–KDI), đề luyện cố định/ngẫu nhiên, chấm trên CSDL, thống kê từng câu; khoá học (video, bài đọc, liên kết, đề) + tiến độ. Cổng HS làm bài.
- **Thiếu:** gắn câu hỏi/khoá học với chủ đề – CT – YCCĐ; khoá học ôn tập theo PPCT; báo cáo kết quả luyện theo CT để đưa vào mục 5.
- **Đề xuất:** thêm `program_unit_id` cho câu hỏi, đề, khoá; lọc theo CT/khối; KDI phát hành khoá học qua cơ chế học liệu (mục 2) thay vì kho riêng.

## Thứ tự làm & chia việc gợi ý

Phụ thuộc: **A** là nền cho mọi phần còn lại; B, C, D làm song song được sau khi A có bảng; E cần C + dữ liệu buổi dạy; F độc lập.

| Gói việc | Nội dung | Bảng / màn chính | Ghi chú phối hợp |
|---|---|---|---|
| **A. Danh mục chương trình** | `stem_programs`, `program_units`; thay 4 chỗ khai báo cứng CT1–CT5 bằng dữ liệu; cây chương trình ở màn *Chương trình giáo dục* | migration `057_ph1_programs`, `platform/Catalog.tsx` | Làm trước, chốt cấu trúc trong 1 tuần |
| **B. Định mức vật tư & KHBD** | `lesson_bom`, khung KHBD theo mẫu, nhập định mức từ Excel/Word | Học liệu, Soạn bài giảng | Thống nhất mã vật tư/thiết bị với người làm 3.1 |
| **C. Phân phối chương trình** | `ppct_templates`, `ppct_slots`, `unit_equipment`; 4 tab mới | `Phân phối chương trình` (trường + KDI) | Thống nhất với người làm 4.2 cách sinh KHGD/TKB |
| **D. Tuỳ chỉnh bài theo trường** | bản kế thừa bài KDI, thêm/bớt vật tư, báo phiên bản mới | `teacher/Lessons.tsx`, `library/*` | Sau B |
| **E. Theo dõi CT1–CT5** | kế hoạch vs thực dạy theo CT × khối × môn | `DeptPrograms`, `DeptSubjects` | Cần C + `teaching_sessions` |
| **F. E-learning theo chủ đề** | gắn `program_unit_id`, lọc, báo cáo theo CT | `elearning/*` | Sau A |

Mỗi gói việc = một nhánh + một PR trong repo này; khi xong cả nhóm thì xuất patch ghép về repo chính (xem `GHEP-VE-REPO-CHINH.md`).

## Câu hỏi cần chốt
1. "Hardware" trong Phân phối chương trình là bộ kit thiết bị theo chủ đề (cách hiểu ở trên) hay một dòng sản phẩm phần cứng riêng của KDI cần quản lý khác?
2. Định mức tính theo **sản phẩm** hay **học sinh**? Mẫu KHBD dùng "cho một sản phẩm" (vật tư) và "cho một nhóm" (công cụ); cần biết một sản phẩm do 1 HS hay 1 nhóm làm để nhân ra nhu cầu.
3. Trường được sửa bài KDI đến mức nào (chỉ vật tư, hay cả hoạt động)? Có cần KDI duyệt bản sửa không?
4. PPCT do KDI đặt mẫu theo khối rồi trường chỉnh, hay trường tự lập từ đầu?
5. Thứ tự phân hệ theo Ver9 (Chương trình = PH1, Đào tạo = PH2) có áp ngay cho menu và gói dịch vụ không? CSDL đang lưu phân hệ này với khoá `ph2` (`service_modules`, migration 033); đề xuất giữ khoá, chỉ đổi tên hiển thị.
