# Bản tách PH1 — quy tắc làm việc & cách ghép về repo chính

Repo này là bản sao của `luantrandata-maker/KDISTEM` tại commit ghi trong `UPSTREAM_BASE`, chỉ giữ **khung giao diện** (đăng nhập, menu, đầu trang, quyền, thương hiệu, trợ giúp…) và các màn của **Phân hệ 1 · Chương trình & học liệu**. CSDL (`supabase/`) giữ nguyên toàn bộ vì PH1 dựa trên bảng lõi (tổ chức, quyền `has_perm`, lớp, giáo viên…).

## 1. Cấu trúc

| Phần | Vị trí | Ai sửa |
|---|---|---|
| Menu PH1 (mọi cổng) | `src/modules/ph1/nav.ts` | Nhóm PH1 |
| Bảng trang PH1 (mã trang → màn) | `src/modules/ph1/pages.tsx` | Nhóm PH1 |
| Màn **mới** của PH1 | `src/modules/ph1/**` | Nhóm PH1 |
| Màn PH1 **đã có** | giữ nguyên đường dẫn cũ: `pages/Packages.tsx`, `pages/School.tsx` (Curriculum), `pages/library/*`, `pages/elearning/*`, `pages/teacher/Lessons.tsx`, `pages/teacher/Activities.tsx`, `pages/teacher/activity.tsx`, `pages/student/Topics.tsx`, `pages/platform/Catalog.tsx`, `pages/platform/SystemViews.tsx` (SysCurriculum, SysLessons), `pages/department/Overview.tsx` (DeptPrograms, DeptSubjects), `pages/approvals/PackageOrders.tsx` | Nhóm PH1 — sửa tại chỗ, đừng di chuyển |
| Khung dùng chung | `src/components/*`, `src/lib/*` (trừ `nav.ts`), `src/index.css`, `src/main.tsx` | Hạn chế sửa. Cần sửa thì sửa nhỏ, ghi lại trong PR |
| **Chỉ của bản tách** (không đi theo patch) | `src/App.tsx`, `src/lib/nav.ts`, `.github/workflows/db-tests.yml`, `wrangler.jsonc`, `README.md` | Không sửa. Nếu buộc phải sửa, ghi rõ để ghép tay |
| CSDL | `supabase/migrations/*.sql` | Nhóm PH1 thêm migration mới (mục 3) |

Các mã trang (chuỗi trong menu) **không được đổi** — chúng là khoá ở quyền, gói, thông báo, liên kết. Đổi tên hiển thị thì thêm vào `LABEL` trong `lib/nav.ts` của repo chính (ghi lại để ghép tay), hoặc tạm đặt tên mới làm mã nếu là mục mới.

## 2. Môi trường chạy

- **Không** dùng chung CSDL Supabase demo của repo chính để thử migration mới. Mỗi người tạo một project Supabase riêng (gói miễn phí) hoặc Postgres trên máy, rồi dựng CSDL có dữ liệu mẫu:
  ```bash
  for f in supabase/migrations/*.sql; do PGOPTIONS="-c app.seed_demo=on" psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f "$f"; done
  ```
  rồi sửa `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) trỏ vào project đó.
- Chỉ đọc giao diện thì có thể dùng `.env.example` (CSDL demo) như repo chính.
- CI của repo này chỉ chạy kiểm thử trên CSDL tạm (`supabase/tests/run.sh`). Các job `migrate`, `deploy-functions`, `schema-diff` đã bị bỏ để không bao giờ ghi vào Supabase thật. Worker Cloudflare đổi tên `lms-ph1` để không đè bản chính.

## 3. Migration mới của PH1

- Đặt tên `NNN_ph1_<ten>.sql`, đánh số tiếp theo số lớn nhất hiện có (vd `057_ph1_dinh_muc_vat_tu.sql`).
- Làm đúng "Định nghĩa xong" của repo chính: policy theo thao tác qua `has_perm('<module>', '<action>')`, phép thử mới trong `supabase/tests/isolation_test.sql`, dữ liệu mẫu bọc cờ `app.seed_demo`, bảng danh mục mới thêm vào `tests/clean_check.sql`.
- Chức năng (perm module) của PH1 hiện có: `packages`, `library`, `curriculum` (xem `PHASE_OF` trong `lib/nav.ts`, `service_modules` ở migration 033). Bảng mới của PH1 dùng một trong ba mã này; cần mã mới thì thêm vào `service_modules.perm_modules` trong migration. **Lưu ý:** trong CSDL phân hệ này có khoá `ph2` (migration 033 đánh số theo bản cũ) — giữ nguyên khoá `ph2`, chỉ tên hiển thị mới theo Ver9.
- Khi ghép: nếu repo chính đã dùng số đó thì đổi sang số trống kế tiếp (chỉ đổi tên file, không đổi nội dung).

## 4. Đồng bộ thay đổi từ repo chính về đây

```bash
scripts/ph1-sync-upstream.sh ../KDISTEM
```
Áp 3 chiều các thay đổi của repo chính lên các file bản tách đang giữ, cập nhật `UPSTREAM_BASE`. Thay đổi ở `App.tsx`/`lib/nav.ts` của repo chính chỉ được liệt kê, không tự áp.

## 5. Ghép về repo chính

1. Ở repo này: `scripts/ph1-export-patch.sh` → ra `ph1.patch` (gồm `src/modules/ph1/`, sửa ở màn PH1 cũ, migration mới, tài liệu).
2. Ở repo chính, trên một nhánh mới:
   ```bash
   git apply -3 --index /đường/dẫn/ph1.patch
   ```
   (`-3` dùng các blob gốc có sẵn trong lịch sử repo chính nên tự gộp với thay đổi mới của nhóm khác; chỗ xung đột để lại dấu `<<<<<<<`.)
3. **Chỉ lần ghép đầu tiên** — nối module PH1 vào khung của repo chính:
   - `src/lib/nav.ts`: thêm `import { PH1_NAV } from '../modules/ph1/nav'`; trong `NAV`, thay nhóm "Chương trình & học liệu" của từng cổng bằng `...PH1_NAV.<cổng>` (cổng `platform`: thay nhóm `'2. Chương trình & học liệu'`; `teacher`: thay nhóm `'Soạn giảng'` — giữ lại mục `'Trợ lý AI'` bằng cách thêm vào PH1_NAV hoặc một nhóm riêng; `student`: chỉ lấy `'Chủ đề'`, `'E-learning & luyện thi'` vào nhóm Học tập hiện có).
   - `src/App.tsx`: thêm `import { PH1_PAGES } from './modules/ph1/pages'` rồi trộn vào cuối từng bảng, ví dụ `const SCHOOL: PageMap = { ...{/* như cũ */}, ...PH1_PAGES.school_admin }` (tương tự TEACHER, STUDENT, DEPARTMENT, PLATFORM). Mục trùng mã sẽ lấy bản PH1.
   - Từ lần ghép sau, `App.tsx`/`nav.ts` không cần sửa nữa: mọi mục/màn mới của PH1 chỉ khai báo trong `src/modules/ph1/`.
4. Đổi số migration nếu trùng, chạy `npm run build` và `supabase/tests/run.sh`, mở PR theo quy trình repo chính (CI xanh → merge → CI tự chạy migration lên Supabase).
5. Lưu ý thứ tự đề án Ver9: Chương trình & học liệu là **PH1**, Đào tạo nhà giáo là **PH2** (repo chính hiện đánh số ngược: "1. Đào tạo…", "2. Chương trình…"). Đổi số tiêu đề nhóm ở repo chính là việc của người giữ menu chung, làm cùng lúc cho cả 5 phân hệ.
