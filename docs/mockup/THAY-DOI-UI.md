# Thay đổi giao diện theo bản mẫu v315 (so với lần dựng 27–28/10)

Bản mẫu: `docs/mockup/he-thong-stem.html` (1 file HTML ~1,3 MB, JS thuần).
**Đừng đọc cả file.** Mỗi mục dưới đây ghi tên hàm/lớp CSS để `grep -n` rồi đọc đúng đoạn đó.
Mở file trong trình duyệt để xem trực tiếp (dữ liệu mẫu TP.HCM, không cần backend).

Phạm vi: **toàn bộ các mục có trong bản mẫu** (PH1, PH2, PH4 — 13 mục, xem bảng mục lục C0).
Thứ tự làm đề xuất: **A (khung chung) → B (bảng dùng chung) → C (từng mục: PH1 → PH2 → PH4)**. Mỗi mục một commit.
Giữ nguyên logic Supabase. Chỗ mẫu có mà backend chưa có dữ liệu thì ghi `TODO`, không tự tạo bảng.

---

## A. Khung chung

| # | Thay đổi | Tìm trong mẫu |
|---|---|---|
| A1 | **Thanh menu kiểu Sapo**: logo + tên hệ thống chỉ ở đầu menu (bỏ khỏi thanh trên). Nút ‹ › thu gọn → còn cột icon **52px** + logo chữ S; rê/bấm icon thì menu con bung ra (flyout). Nhớ trạng thái (`stem-side`). | `function renderSide`, `.shell.collapsed`, `.sidebrand`, `LOGO_S` |
| A2 | **Đường dẫn mục mẹ / mục con** trên thanh trên cùng, cạnh ô tìm chức năng: `Nhóm / Mục / Tên bản ghi đang xem`, bấm để quay lại. Bỏ số thứ tự (1., 1.1). Khi có đường dẫn thì ẩn link “← Danh sách…” trong trang chi tiết. | `function crumbs`, `.crumbs`, `body.hascrumb` |
| A3 | **Tab con kiểu gạch chân** (Sapo): chữ thường, xám; tab chọn xanh + gạch chân 3px; số đếm dạng chip. Áp dụng mọi `.tabs` và `.seg[role=tablist]`. Thanh bước quy trình có đánh số vẫn dạng nút bo tròn. | CSS `:root #app .tabs>button` |
| A4 | **Đầu trang chi tiết gọn**: bỏ ghi chú lặp (“Đã phát hành — chỉ xem…”, “Chốt đủ 4 nhóm…”) → 1 icon ổ khoá/ⓘ cạnh tên, nội dung trong tooltip. Bỏ dòng phụ dưới tên nếu trùng “Thông tin chung”. Thanh công cụ, thanh phiên bản luôn 1 hàng. | `function detailTidy`, `.hnote`, `.verbar`, `.cttools` |
| A5 | **Khung thông tin bên phải** (Thông tin chung…) kéo mép trái để rộng/hẹp, nút ‹ › để thu gọn; nhớ độ rộng (`stem-aside`). | `function asidePanel`, `.asbar`, `.asrz`, `.astog` |
| A6 | Trạng thái chỉ hiện ở **từng dòng**; bỏ nhãn trạng thái chung trên dòng nhóm/chương trình. Bỏ thanh tiến độ (progress bar) → chỉ ghi số `x/tổng`. | — |
| A7 | Ghi chú dài → tooltip (`data-tip`), không để đoạn văn trên trang. | `function bindTips` |

## B. Bảng dữ liệu dùng chung (áp cho mọi danh sách)

| # | Thay đổi | Tìm trong mẫu |
|---|---|---|
| B1 | **Ô chọn từng dòng + chọn tất cả**. Khi có dòng được tick → thanh thao tác dính trên bảng: “Đã chọn N …” · **Xuất file** (CSV các dòng đã chọn) · thao tác riêng từng mục · **Thao tác khác ▾** (In danh sách, Thêm thẻ, Lưu trữ, Xoá) · Bỏ chọn. Bấm ô tick không mở dòng. | `function rowSelect`, `BULK`, `BULKMORE`, `.bulkbar`, `td.chkc` |
| B2 | **Cùng cỡ chữ 14px** cho mọi ô (kể cả tên in đậm). Dòng cao đều 52px, căn giữa dọc. Ô dài 1 dòng + “…”, rê để xem đủ; cột tên tối đa 2 dòng. | `function rowTidy`, `td.tcell`, `td.one` |
| B3 | **Mọi cột căn lề trái**, kể cả cột số và tiêu đề (bỏ căn phải). | CSS `:root body #app table tr>td` |
| B4 | **Sort từng cột** (bấm tiêu đề: tăng → giảm → bỏ). Ngày dd/mm/yyyy, số, chữ tiếng Việt; ô trống luôn cuối; sort trong từng nhóm. | `function sortRows`, `sortIcons`, `sortVal` |
| B5 | **Dòng tổng ngay dưới tiêu đề cột** (thay các thẻ số tổng phía trên). Không cộng cột Điểm, Trọng số, Tuần, Tiết PPCT. | `function colSums` |
| B6 | **Mỗi mục có 1 cột ngày** quan trọng nhất (ngày tạo/cập nhật/phát hành…), cùng màu chữ với cột khác. | `function dateCols`, `DATECOLS` |
| B7 | **Chọn cột kiểu Sapo** (ẩn/hiện + kéo thả đổi thứ tự) và **Lưu bộ lọc**. Bảng lọc phải nổi trên bảng (không bị nhóm nút che). | `function colPicker`, `savedFilters`, `.fpanel` |
| B8 | **Độ rộng cột**: tên cột ngắn luôn hiện đủ; cột tên ≥ 26–30%. Nút **Mở rộng**: cột giãn theo nội dung, hiện đủ chữ, kéo ngang khi cần (bảng gom nhóm vẫn thẳng hàng). Thanh kéo ngang chỉ khi ≥ 9 cột. | `function tableSize`, `wideFit`, `.xscroll` |
| B9 | Tách cột gộp thành cột riêng: “Quy mô” → **Số bài / Số tiết** (PH2: Số chuyên đề / Số giờ); “Chương trình · môn” → **Chương trình / Môn học**. | — |

## C. Theo từng mục

### C0. Mục lục các mục trong bản mẫu
Mỗi mục có mã `sec` (dùng `go('<sec>')` trong console để mở). Thao tác hàng loạt riêng của từng mục nằm ở `const BULK`.

| Phân hệ | Mục | sec | Code mẫu | Thao tác hàng loạt (B1) |
|---|---|---|---|---|
| 1. Chương trình & học liệu | Chương trình giáo dục | `ct` | `st.sec === 'ct'`, `ctLessons` | Phát hành, Nhân bản |
| | Phân phối chương trình | `pp` | `MODS.pp`, `ppWizard`, `weekStrip` | Phát hành, Gán cho trường |
| | Học liệu | `hl` | `MODS.hl` | Phát hành phiên bản |
| | Soạn bài giảng & kho hoạt động | `bg` | `MODS.bg` | Xuất bản, Nhân bản |
| | E-learning & luyện thi | `el` | `MODS.el`, `qEditor` | Phát hành, Đóng |
| 2. Đào tạo & đánh giá năng lực nhà giáo | Chương trình đào tạo | `tp` | `MODS.tp`, `tpMods` | Phát hành, Nhân bản |
| | Kế hoạch đào tạo | `kh` | `MODS.kh`, `planSt` | Gửi thông báo nhắc, Phát hành |
| | Nội dung đào tạo | `bt` | `MODS.bt`, `btPractice` | Phát hành |
| | Đánh giá kết quả | `dg` | `MODS.dg` | Xuất kết quả, Cấp chứng nhận |
| 4. Vận hành giảng dạy & đánh giá người học | Hồ sơ cơ sở giáo dục | `sc` | `TREECFG.sc`, `.regw` | Gửi thông báo |
| | Nhà giáo & trợ giảng | `gv` | `.regw` | Gửi thông báo, Phân công lớp |
| | Người học | `hs` | `.regw` | Chuyển lớp, Gửi thông báo phụ huynh |
| | Lớp học | `lh` | `.regw` | Gán giáo viên, Xếp lịch |

**Mọi mục** đều áp A1–A7 và B1–B9. Dưới đây chỉ ghi phần riêng của từng mục.

### PH1 · Chương trình & học liệu

**C1. Chương trình giáo dục (`ct`)**
- Danh sách: cây Cấp học › Khối bên trái; cột Chương trình · Cấp học·Khối · Môn học · **Số bài** · **Số tiết** · Phát hành gần nhất · Trạng thái.
- Chi tiết: tab Chương trình | Phân phối & trường áp dụng | …; STT đánh lại từ 1 khi chọn 1 môn ở cột trái. Không còn hàng Xuất/Nhập thừa ở tab Phân phối & trường áp dụng.
- Đã phát hành → nút **Tạo phiên bản mới**, **Ngừng dùng**, **Gán cho trường**.

**C2. Phân phối chương trình (`pp`)** — thay đổi nhiều nhất
- **Thiết lập**: gộp “Cấp học” + “Khối” thành 1 bước (bấm khối là tự chọn cấp) → 2 Chọn chương trình → 3 Chọn môn → 4 Xếp lịch. (`.wlvg`)
- **Bỏ phân công giáo viên** trong phân phối (`ppTeach` không còn được gọi).
- **Xếp lịch chia đôi**: trái = danh sách bài theo môn (cuộn riêng), phải = **lịch cả năm** HK I + HK II (đứng yên khi cuộn); kéo vách giữa; rê bài ↔ tô sáng ô tuần; kéo bài từ danh sách thả vào tuần để ghim. (`function ppSplit`, `.ppsplit`, `PPSPLIT`)
- **Gộp bảng môn vào đầu mỗi môn** bên trái: kéo đổi thứ tự môn, chọn Bắt đầu, số tiết/tuần, kết quả “T1–11 · 11 tiết”, cảnh báo ⓘ. (`.lotitle.losub`)
- Tuỳ chọn xem: **Cả năm | HK I | HK II**, **Xem gọn**, **Toàn màn hình** (Esc thoát). (`PPV`, `.ppopts`)
- **Chi tiết bản phân phối**: tab **Lịch năm học** (mặc định) | **Bảng PPCT** nằm bên trái; số liệu bên phải: N môn học · T tiết/năm học · W/35 tuần học · bài · cảnh báo.
- **Bảng PPCT theo mẫu Bộ GD&ĐT**: chia Học kỳ I/II; cột **Tuần · Thời gian · Tiết PPCT · Bài học (Tiết k/N) · Chương trình · Môn học · Số tiết · Học liệu**; Tiết PPCT đánh liên tục cả năm cho mọi môn. Nút **Xuất file PPCT** (mỗi tiết 1 dòng: Tuần, Thời gian, Tiết PPCT, Học kỳ, Tên bài, Chương trình, Môn học, Ghi chú) để nhập VnEdu/SMAS. (`ppctRows`, `ppctTable`, `ppctExport`)
- Danh sách bản phân phối: cột Chương trình và Môn học tách riêng.

**C3. Học liệu (`hl`)**
- Danh sách cố định theo nhóm › chương trình (dạng bảng mặc định, có Thẻ).
- Chi tiết: tab Thông tin bài học · Nội dung bài học · Link học liệu · Định mức vật tư · Bài giảng (tab gạch chân, chấm trạng thái). Thanh phiên bản 1 hàng: Tạo phiên bản mới / Ngừng dùng / Xoá PB.

**C4. Soạn bài giảng & kho hoạt động (`bg`)**
- Danh sách dạng bảng cố định, chia theo chương trình / môn / cấp độ giống các mục khác.
- Trình soạn: thanh trên (`.edbar`) 1 hàng; **Trình chiếu toàn màn hình** kiểu Canva/PPT (thanh điều khiển, phím tắt, Esc thoát) — `function presView`, `presFit`, `presFs`.

**C5. E-learning & luyện thi (`el`)**
- Đề luyện / khoá học: tạo câu hỏi mới hoặc **nhập file câu hỏi có sẵn** (Word/Excel, có file mẫu) — `qEditor`, `qParse`, `docxLines`, `sheetToQText`, `qTemplate`.
- Câu hỏi chọn theo nội dung đã thiết lập được hiện ra để thêm/bớt; phần câu hỏi tách riêng bên dưới, thu gọn theo phần. Ô nhập cùng style với cả hệ thống.

### PH2 · Đào tạo & đánh giá năng lực nhà giáo
(Thuật ngữ: Học liệu PH2 = **Học phần**, mô-đun = **Chuyên đề**, người học = **Học viên**, người dạy = **Giảng viên**, “tập huấn” → “đào tạo”.)

**C6. Chương trình đào tạo (`tp`)**
- Cột: Chương trình · Nhóm · Học phần · **Số chuyên đề** · **Số giờ** · Phát hành gần nhất · Trạng thái.
- Chi tiết: tab Chương trình | Khung đánh giá | Kế hoạch đào tạo; khung **Thông tin chung** bên phải kéo rộng/thu gọn (A5); STT chuyên đề đánh lại từ 1 theo học phần (`tpMods`).

**C7. Kế hoạch đào tạo (`kh`)**
- Bỏ nhãn trạng thái chung trên dòng chương trình (kể cả “n đang mở”); trạng thái chỉ ở từng đợt.
- Tab Thông báo và đăng ký: cột Đăng ký chỉ ghi `n/cap`. Chi tiết đợt: Đã nộp `x/y` (+ “· n quá hạn”), Đã chấm `x/y`, Có mặt `x/y` — **không thanh tiến độ**.
- Trạng thái đợt: Nháp · Đã lập kế hoạch · … · **Đã huỷ** (nút Huỷ đợt / Khôi phục). Học phần chưa đủ: “Chưa đủ học phần (x/y)”. (`planSt`, `progPlanSt`)

**C8. Nội dung đào tạo (`bt`)**
- Tab **Hoạt động thực hành** dạng **bảng** (mặc định; còn nút Thẻ): gom theo chương trình › học phần (cuối khoá ở cuối); cột Đề bài · Loại · Chuyên đề · Trọng số · Đợt dùng · Đã chấm; dòng tổng không cộng Trọng số; tìm kiếm + lọc chương trình. (`btPractice`)

**C9. Đánh giá kết quả (`dg`)**
- Trạng thái kết quả: **Chờ đánh giá** (thay cho tên cũ). Bảng chương trình/đợt trước, bấm vào mới thấy bảng điểm danh/điểm.

### PH4 · Vận hành giảng dạy & đánh giá người học (tạm thời)

**C10–C13. Hồ sơ cơ sở GD (`sc`) · Nhà giáo & trợ giảng (`gv`) · Người học (`hs`) · Lớp học (`lh`)**
- Bố cục sổ đăng ký: danh sách bên trái + khung chi tiết bên phải (`.ctw.regw`) — khung phải kéo rộng/thu gọn (A5).
- Cây Cấp học › Khối (`TREECFG`), áp đủ B1–B9 với thao tác hàng loạt riêng (bảng C0).
- Hồ sơ Nhà giáo còn mục “Được phân công dạy (PH1)” lấy từ phân công cũ — **TODO**: đổi nguồn hoặc ẩn vì phân phối đã bỏ phân công giáo viên.

---

## Quy ước giữ khi code
- Thống nhất toàn hệ thống: phần tử mới **dùng lại style sẵn có** (font, màu, cỡ), không tạo style riêng.
- Nhãn thuần, dùng “Huỷ”; đã phát hành thì **tạo phiên bản mới**, không sửa trực tiếp.
- “Tất cả các trường” là cách gọi duy nhất; giờ/tiết là số nguyên.
