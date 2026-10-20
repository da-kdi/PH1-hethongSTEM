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

PH1 dùng **project Supabase riêng**, tách hẳn khỏi CSDL của bản chính (`tsvujwddjpnchkdxqjza`). `vite.config.ts` và hai workflow `pages.yml`, `ph1-db.yml` đều dừng nếu cấu hình trỏ vào project của bản chính.

Dựng lần đầu (một lần):
1. supabase.com → **New project** (region Singapore như bản chính, gói Free được). Lưu mật khẩu CSDL ở chỗ riêng của bạn.
2. Project → **Connect → Session pooler**: chép chuỗi kết nối (thay `[YOUR-PASSWORD]`) → GitHub repo → Settings → Secrets and variables → Actions → **Secrets** → `PH1_SUPABASE_DB_URL`.
3. Project → **Settings → API**: chép Project URL và khoá *publishable* → GitHub → **Variables** (không phải Secrets): `PH1_SUPABASE_URL`, `PH1_SUPABASE_ANON_KEY`. Điền hai giá trị này vào `.env` trên máy (sao từ `.env.example`).
4. GitHub → Actions → **CSDL riêng của PH1** → Run workflow, *action* = `setup`: chạy toàn bộ migration + dữ liệu mẫu, ghi lịch sử migration.
5. Supabase → **Authentication → URL Configuration**: Site URL `https://da-kdi.github.io/PH1-hethongSTEM/`, thêm Redirect URL đó và `http://localhost:5173`.
6. Actions → **Xem thử trên GitHub Pages** → Run workflow (dựng lại trang trỏ vào CSDL mới). Mở trang → *Đăng ký* bằng email của bạn, xác nhận email.
7. Actions → **CSDL riêng của PH1** → Run workflow, *action* = `grant_admin`, *email* = email vừa đăng ký → có quyền Quản trị nền tảng trên CSDL PH1. Vai trò ở trường/Sở mẫu gán bằng SQL Editor của project PH1 (README gốc, mục *Chạy trên máy*).

Sau đó: đẩy migration mới (`supabase/migrations/**`) lên `main` → workflow tự chạy `supabase db push` **chỉ lên CSDL PH1**. Hàm máy chủ (`school-accounts`, `ai-assistant`) chưa đưa lên project PH1 — tài khoản mã và Trợ lý AI chưa dùng được, không ảnh hưởng các màn PH1.
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
3. **Chỉ lần ghép đầu tiên** — nối module PH1 vào khung của repo chính bằng `docs/ghep-lan-dau.diff` (đã thử trên repo chính tại `UPSTREAM_BASE`: build xanh):
   ```bash
   git apply -3 /đường/dẫn/KDISTEM-PH1/docs/ghep-lan-dau.diff
   ```
   - `src/lib/nav.ts`: nhóm "Chương trình & học liệu" của cổng KDI, Trường, Sở được thay bằng `...PH1_NAV.<cổng>`; trộn `PH1_LABEL` (tên hiển thị), `PH1_MODULE_OF` (quyền / gói của các mã trang mới).
   - `src/App.tsx`: `PH1_PAGES` được trộn vào SCHOOL / TEACHER / STUDENT / DEPARTMENT / PLATFORM (mục trùng mã lấy bản PH1).
   - Cổng **Giáo viên** và **Học sinh** giữ menu của repo chính (mục PH1 nằm lẫn trong nhóm theo công việc, có cả Trợ lý AI, Học trước & tự học…). Mục **mới** của PH1 ở hai cổng này phải thêm tay vào `NAV` repo chính khi ghép; màn thì đã tự có qua `PH1_PAGES`.
   - Từ lần ghép sau, cổng KDI/Trường/Sở không cần sửa `App.tsx`/`nav.ts` nữa: mục/màn mới của PH1 chỉ khai báo trong `src/modules/ph1/`.
   - Trước khi `git apply`, cây làm việc của repo chính phải sạch (`git status` trống); nếu báo `does not match index` thì chạy `git update-index --refresh`.
4. Đổi số migration nếu trùng, chạy `npm run build` và `supabase/tests/run.sh`, mở PR theo quy trình repo chính (CI xanh → merge → CI tự chạy migration lên Supabase).
5. Lưu ý thứ tự đề án Ver9: Chương trình & học liệu là **PH1**, Đào tạo nhà giáo là **PH2** (repo chính hiện đánh số ngược: "1. Đào tạo…", "2. Chương trình…"). Đổi số tiêu đề nhóm ở repo chính là việc của người giữ menu chung, làm cùng lúc cho cả 5 phân hệ.

## 6. Mục 1.1 trong bản tách (cập nhật)

- Migration của PH1: `057_ph1_curriculum.sql` (chương trình, phiên bản, nội dung, phê duyệt), `058_ph1_framework.sql` (môn học trong chương trình, gói chương trình, học liệu & định mức, phân phối, giáo án, liên kết e-learning), `059_ph1_demo.sql` (dữ liệu mẫu). Repo chính đã có 057–061 của nhóm khác (`edu_programs`…) trùng phạm vi: khi ghép phải chọn mô hình và đổi số migration.
- Mã trang: `Chương trình giáo dục`, `Học liệu`, `Phân phối chương trình`, `Soạn bài giảng & kho hoạt động`, `Theo dõi chương trình CT1–CT5 (Môn học)` (hiển thị *Theo dõi triển khai chương trình*), `E-learning & luyện thi`; danh mục gói STEM thương mại của KDI chuyển sang mã `Gói STEM (KDI)`.
- Dựng lại CSDL PH1 khi cấu trúc lại migration: đổi nội dung `supabase/ph1-reset.txt` rồi đẩy lên `main` (quản trị nền tảng được cấp lại quyền tự động).
