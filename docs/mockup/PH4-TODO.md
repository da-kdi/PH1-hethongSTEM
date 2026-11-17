# PH4 · Vận hành giảng dạy & đánh giá người học — TODO (bản mẫu v315, C10–C13)

**Trạng thái:** chưa dựng trong bản tách này. Repo PH1-hethongSTEM chỉ chứa khung chung + màn của PH1 (Chương trình & học liệu) và PH2 (Đào tạo & đánh giá nhà giáo). Menu (`src/modules/ph1/nav.ts`, `src/modules/ph2/nav.ts`) và bảng trang (`pages.tsx`) không có mục nào của PH4; các màn Hồ sơ trường, Giáo viên, Học sinh, Lớp học nằm ở repo chính. Bảng CSDL lõi (`organizations`, `teachers`, `students`, `classes`) có sẵn nhưng không tạo màn/bảng mới ở đây — làm ở repo chính khi ghép.

## Việc cần làm (áp A1–A7, B1–B9 như PH1/PH2)

| Mục | sec mẫu | Cây bên trái (`TREECFG`) | Thao tác hàng loạt riêng (`BULK`) |
|---|---|---|---|
| C10 Hồ sơ cơ sở giáo dục | `sc` | Cấp học (theo `level` của cơ sở), đếm “cơ sở” | Gửi thông báo |
| C11 Nhà giáo & trợ giảng | `gv` | — | Gửi thông báo, Phân công lớp |
| C12 Người học | `hs` | — | Chuyển lớp, Gửi thông báo phụ huynh |
| C13 Lớp học | `lh` | Khối (theo `grade` của lớp), đếm “lớp” | Gán giáo viên, Xếp lịch |

- **Bố cục sổ đăng ký:** danh sách bên trái + khung chi tiết bên phải (`.ctw.regw`), khung phải kéo rộng/thu gọn (A5). Đã có sẵn để dùng lại: `AsideWrap kind="reg"` (`src/modules/ph1/mau/kit.tsx`, nhớ độ rộng ở `stem-aside` khoá `regW`/`regOff`).
- **Danh sách:** `DataTable` (`src/modules/ph1/mau/DataTable.tsx`) — chọn nhiều, thanh thao tác hàng loạt (Xuất CSV + thao tác riêng ở bảng trên + Thao tác khác), sắp xếp, dòng tổng, Chọn cột, lọc đã lưu, Mở rộng.
- **Cây Cấp học › Khối:** `LevelTree` (kit.tsx), nhớ ở `stem-tree`.
- Đường dẫn (crumb) chi tiết: `Back` / `useDetailCrumb` (`src/lib/crumb.ts`).

## TODO riêng
- Hồ sơ Nhà giáo có mục “Được phân công dạy (PH1)” lấy từ phân công cũ — **đổi nguồn hoặc ẩn**, vì Phân phối chương trình (C2) đã bỏ phân công giáo viên.

Tra bản mẫu: `grep -n "TREECFG\|\.regw\|const BULK\|Được phân công dạy" docs/mockup/he-thong-stem.html`, rồi đọc đoạn tương ứng.
