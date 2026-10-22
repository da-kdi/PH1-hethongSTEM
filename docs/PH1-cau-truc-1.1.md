# Phân hệ 1 · Cấu trúc, luồng và tính năng của mục 1.1

Cập nhật: 22/10/2026 · Phạm vi: **Chương trình giáo dục → Phân phối chương trình → Học liệu → Soạn bài giảng & kho hoạt động → E-learning & luyện thi**

> Bản này sắp lại tài liệu theo **cấu trúc menu mới**. Nội dung chi tiết của bản trước được giữ tạm ở đúng mục mới; phần nào không còn nằm trong cấu trúc mới được đánh dấu **⏳ Chờ xem lại** để quyết định sau.

---

## 0. Cây tổ chức chung

### 0.1 Cây đối tượng (liên kết theo cấp)
```
Danh mục (dùng chung)       Cấp học · Khối (thuộc một cấp học) · Lớp · Nhóm chương trình · Môn học

Chương trình giáo dục        Tên, mô tả, thuộc một Nhóm chương trình
 └─ Cấp học                  chọn từ Danh mục
     └─ Khối                 chỉ các khối thuộc cấp học đó
         └─ Môn học          chọn từ Danh mục
             └─ Bài học      Tên bài · Số buổi · Số tiết
                 ├─ Học liệu          1 bài học = 1 học liệu (Thông tin · Nội dung · Link học liệu · Định mức vật tư)
                 │   └─ Bài giảng     1 học liệu có nhiều phiên bản bài giảng → nằm trong Kho hoạt động
                 └─ E-learning        khoá học / bài luyện tập dựng từ bài học, học liệu

Phân phối chương trình       (Trường — tuỳ chọn) › Cấp học › Khối › Chương trình phù hợp › Môn học › Xếp lịch
 └─ Học kỳ › Tuần › Buổi     các môn, bài lấy từ chương trình; đổi được thứ tự
```

### 0.2 Quy tắc liên kết giữa các cấp
| Cấp dưới | Gắn vào | Quy tắc |
|---|---|---|
| Khối | Cấp học | Mỗi khối thuộc đúng một cấp học (Danh mục) |
| Môn học (trong chương trình) | Chương trình · Khối | Một môn chỉ nằm ở một khối của chương trình; cùng môn ở khối khác là dòng riêng |
| Bài học | Môn học của chương trình | Bài thuộc đúng một môn · khối · chương trình; cấp học suy ra từ khối |
| Học liệu | Bài học | Quan hệ 1 – 1; thông tin cấp học, khối, môn lấy theo bài |
| Bài giảng | Học liệu | Một học liệu có nhiều bài giảng (phiên bản); bài giảng kế thừa chương trình, môn, khối của học liệu |
| Phân phối | Cấp học · Khối (bắt buộc), Trường (tuỳ chọn) | Chỉ gợi ý chương trình có khối khớp; chỉ lấy môn, bài của đúng khối đó |
| Dòng lịch (buổi) | Bài học | Mỗi buổi trên lịch trỏ về một bài học → mở được học liệu, bài giảng của bài |

### 0.3 Luồng thao tác end-to-end
| Bước | Mục | Người dùng làm gì | Kết quả đưa sang bước sau |
|---|---|---|---|
| 1 | **Chương trình giáo dục** | Thiết lập Danh mục → tạo chương trình (tên, mô tả) → thêm Cấp học › Khối › Môn › Bài học (số buổi, số tiết) → phát hành | Cây môn, bài theo khối của chương trình |
| 2 | **Phân phối chương trình** | (Chọn trường) → chọn Cấp học › Khối → chọn chương trình được gợi ý → chọn môn → xếp lịch Học kỳ › Tuần › Buổi | Lịch phân phối theo khối (cho tất cả trường hoặc trường cụ thể) |
| 3 | **Học liệu** | Với từng bài học: điền Thông tin, Nội dung, Link học liệu (bài giảng, phiếu học tập), Định mức vật tư | Học liệu của bài |
| 4 | **Soạn bài giảng & kho hoạt động** | Soạn bài giảng từ học liệu; mỗi lần soạn là một phiên bản trong Kho hoạt động | Bài giảng để dạy / học sinh xem |
| 5 | **E-learning & luyện thi** | Dựng khoá học, đề luyện từ bài học, học liệu | Học trực tuyến |

### 0.4 Quy ước chung (giữ từ bản trước)
- Tên gọi thống nhất **Chương trình → Cấp học → Khối → Môn học → Bài học**.
- Trạng thái: **Nháp / Đã phát hành / Ngừng dùng** (màu trung tính, xanh lục, xám).
- Bảng: chữ canh trái và canh giữa dọc; nút tác vụ nằm **bên phải**, nút "← Quay lại" nằm **bên trái**; bảng một tác vụ thì bấm tên để làm, bảng nhiều tác vụ có ô tick ở cột đầu.
- Kiểu xem **Thẻ | Danh sách** (riêng Phân phối dùng **Bảng | Lịch**).
- Mọi thay đổi ghi vào Nhật ký hoạt động; đồng bộ hai chiều giữa Chương trình giáo dục và Học liệu.
- Mỗi mục đều mở đầu bằng **View tổng quan**, bấm dần vào chi tiết.

---

## 1. Chương trình giáo dục

**Mục đích:** khung chương trình theo cấp học, khối, môn, bài; nơi chốt chương trình nào được đưa vào phân phối.

### 1.1 View tổng quan
- Thẻ các chương trình (theo Nhóm chương trình), mỗi thẻ cho biết cấp học, khối, số môn, số bài, số tiết; bấm thẻ mở chi tiết.
- Kiểu xem **Thẻ | Danh sách**.

### 1.2 Thiết lập chương trình

#### a. Thông tin
- **Tên chương trình**, **mô tả**.
- *(giữ từ bản trước)* Nhóm CT (CT1–CT5, KDI-SC, Đề xuất; mỗi chương trình thuộc đúng một nhóm), số tiết/tuần, thời gian triển khai (Học kỳ 1 / Học kỳ 2 / Cả năm); phiên bản và trạng thái (Nháp → Đã phát hành → Ngừng dùng; không cho phát hành khi chưa có bài).

#### b. Đối tượng: Cấp học › Khối › Bài học
- Cây **Cấp học › Khối › Môn học › Bài học**.
- Mỗi bài học: **Tên bài**, **Số buổi**, **Số tiết**.
- *(giữ từ bản trước)* Môn học theo thứ tự dạy; yêu cầu cần đạt từng bài; yêu cầu vật tư/thiết bị của chương trình (loại, tên, đơn vị, số lượng).

#### c. Danh mục
Thiết lập các đối tượng dùng chung, mỗi mục có **Tên, Mô tả**:
- **Cấp học**
- **Khối** (gắn vào một cấp học)
- **Lớp**
- **Nhóm chương trình**
- **Môn học** — *(giữ từ bản trước)* môn dùng chung; môn đang dùng chỉ ngừng dùng, không đổi tên hay xoá.

### 1.3 Cách thiết kế (giữ từ bản trước)
- **Chương trình là khung**; chi tiết dạy học nằm ở Học liệu, sửa ở đâu cũng đồng bộ.
- **Thời gian triển khai + số tiết/tuần** điều khiển bước Xếp lịch ở Phân phối: Học kỳ 1 = tuần 1–18, Học kỳ 2 = tuần 19–35, Cả năm = tuần 1–35.
- Nhóm CT quyết định màu chip và màu ảnh bìa bài giảng mặc định.
- Dùng chung: Admin KDI, Sở và Trường cùng thấy; chương trình **Ngừng dùng** không được chọn để phân phối.

### 1.4 Đã chốt
- Khối gắn ở cấp **Môn học** (môn theo khối, bài riêng từng khối) — thay cho đề xuất "khối là thuộc tính của cả chương trình" ở bản trước. Phân phối chỉ lấy môn, bài đúng khối.

### 1.5 ⏳ Chờ xem lại
- **Gói chương trình** (Cơ bản / Nâng cao cho nhóm trường) — hiện đặt trong Chương trình giáo dục, chưa có chỗ trong cấu trúc mới.

---

## 2. Phân phối chương trình

**Mục đích:** đi tiếp từ Chương trình giáo dục — chọn đúng khối, lấy chương trình, môn phù hợp và xếp lên lịch Học kỳ › Tuần › Buổi.

### 2.1 View tổng quan
- Tổng quan theo **Cấp học › Khối**: mỗi khối cho biết các bản phân phối, số môn, số buổi/tiết, phạm vi (tất cả trường / trường cụ thể); bấm vào để xem lịch chi tiết.

### 2.2 Thiết lập phân phối chương trình
Đi theo thứ tự, không bỏ bước:

| Bước | Nội dung | Bắt buộc |
|---|---|---|
| 0 | **Trường**: tất cả các trường hoặc chọn trường cụ thể | Không |
| 1 | **Cấp học** | Có |
| 2 | **Khối** (chỉ khối thuộc cấp học đã chọn) | Có |
| 3 | **Chọn chương trình phù hợp**: hệ thống gợi ý các chương trình có môn ở đúng khối | Có |
| 4 | **Chọn môn** từ các chương trình đã chọn (chỉ môn của khối đó) | Có |
| 5 | **Xếp lịch**: thứ tự môn theo **Học kỳ › Tuần › Buổi**; đổi được thứ tự môn và bài bên trong | Có |

*(giữ từ bản trước, áp dụng cho bước 5)*
- Mỗi chương trình/môn: **Bắt đầu** (đầu HK1, đầu HK2, tuần cụ thể, hoặc ngay sau môn khác), **Nhịp** tiết/tuần, thứ tự dạy kéo thả (hoặc Alt + mũi tên); kết quả "Tuần x–y · n tiết", cảnh báo khi ngoài khung học kỳ; xem trước trên trục tuần.
- Xem bản phối: Bảng | Lịch; tuỳ chỉnh từng bài (sửa tuần, số tiết, ghi chú, bỏ bài; tuần sửa tay có nhãn "tay" và nút tự tính lại); kiểm tra thiếu/thừa buổi, trùng môn, quá tải tiết/tuần, ngoài học kỳ.
- Hành động: Huỷ thay đổi · Lưu nháp · **Phát hành** (bị chặn khi còn lỗi; cảnh báo vẫn cho phát hành) · Nhân bản.
- Máy xếp lịch theo nhịp (tiết/tuần); trường hợp "1 bài/tuần với bài 1 hoặc 2 tiết" xử lý bằng tuần đặt tay và override theo môn. Cảnh báo tách **lỗi** (chặn phát hành) và **cảnh báo** (cho phát hành).

### 2.3 ⏳ Chờ xem lại (giữ nội dung bản trước)
- **Khung phân loại Cấp học › Khối › Mức độ**: bước 1–2 mới đã thay phần Cấp học › Khối; chưa rõ còn dùng **Mức độ** không.
- **Bản phân phối mẫu → Gán theo trường**: bản mới chọn trường ngay ở bước 0. Nội dung cũ: chọn bản đã phát hành → chọn trường, lớp, năm học, học kỳ → tạo PPCT theo trường (mỗi môn một PPCT: tuần, bài, tiết kế hoạch, tiết thực tế, đã xác minh, ngày); "bản phối là mẫu, PPCT là bản gán".
- **Danh sách bản phân phối**: tick chọn một bản; Nhân bản, Gán trường.
- **Theo dõi** tiến độ/kết quả thực hiện: chip Tiến độ thực hiện / Cần rà soát; theo chương trình hoặc môn, học kỳ, tuần đang xét; chỉ số tiết đến hạn, đã thực hiện, chênh lệch, dòng chưa ghi nhận/chưa xác minh; xuất CSV. Tab "Ghi nhận thực hiện" tạm ẩn.

---

## 3. Học liệu

**Mục đích:** nội dung dạy học của từng bài học. **Một bài học (gán vào một môn trong một chương trình) có đúng một học liệu.**

### 3.1 View tổng quan
- Đi theo cây **Chương trình › Cấp học › Khối › Môn › Bài học**; bài chưa có học liệu hiện là **bài chờ** kèm nút tạo (tự gắn đúng chương trình/môn/bài).

### 3.2 Các thông tin chính
| Nhóm | Nội dung |
|---|---|
| **Thông tin bài học** | Tên; thuộc **cấp học, khối, môn học** (lấy theo bài trong chương trình) |
| **Nội dung bài học** | Buổi, hoạt động |
| **Link học liệu** | **Bài giảng**, **Phiếu học tập** (tên, loại, liên kết/tệp) |
| **Định mức vật tư** | Tên, đơn vị, số lượng (theo sản phẩm / nhóm / học sinh / lớp) |

*(giữ từ bản trước)*
- Mỗi nhóm có trạng thái **Đã chốt / Cần kiểm tra**; đủ 4 nhóm chốt mới phát hành.
- Ba cách tạo: tự tạo từ bài chờ; tải giáo án Word/PowerPoint để **tách tự động** thành 4 nhóm; **điền nhanh bằng file mẫu** (CSV/Excel 4 sheet → xem trước → áp dụng, chuyển "Cần kiểm tra").
- Tên, đơn vị, loại **chọn từ danh sách hoặc thêm mới**; xoá mục có nội dung phải xác nhận lần 2.
- Ba nguồn học liệu: file giáo án mẫu (.docx/.pptx), Google Sheet/Drive, LMS (Kohota).

### 3.3 ⏳ Chờ xem lại (giữ nội dung bản trước)
- **Cần chuẩn bị theo chương trình**: tự tổng hợp thiết bị, vật tư, tài liệu theo định mức × số nhóm; theo dõi trạng thái chuẩn bị.
- **Danh mục học liệu**: tra cứu mọi học liệu (Thẻ | Danh sách), thao tác hàng loạt (Phát hành, Ngừng dùng, Dùng lại, Chuyển về Nháp, Xuất CSV, Xoá), đổi ảnh đại diện.
- **Bộ học liệu** (nhóm nhiều bài theo chương trình/môn/khối) — với quan hệ 1 bài = 1 học liệu, chưa rõ còn cần cấp "bộ" không.
- Chưa làm: trình soạn có cấu trúc cho nhóm Thông tin; bộ lọc danh sách chương trình.

---

## 4. Soạn bài giảng & Kho hoạt động

**Quy tắc:** bài giảng gán vào học liệu; **một học liệu có thể có nhiều phiên bản bài giảng**.

### 4.1 Soạn bài giảng
*(giữ từ bản trước)*
- Bắt đầu từ một học liệu (hoặc nhân bản bài giảng mẫu); bài giảng kế thừa chương trình, môn, khối của học liệu.
- Khung soạn: thanh trên (← Danh sách · nhóm CT · trạng thái · Tự động lưu · View học sinh · Trình chiếu · Khác · Lưu · Xuất bản); bố cục 3 cột: dàn ý (trái) · nội dung từng khối (giữa) · Thông tin (phải: ảnh bìa, tên, mô tả, chương trình/môn/lớp).
- Ảnh bìa tự tạo từ màu nền và hoa văn; khối nội dung và hoạt động tương tác; mục Khác: xuất file, nhân bản, lưu làm mẫu.
- Xuất bản: bài đã xuất bản mở ở chế độ xem; sửa qua **bản nháp** ("Nháp của BG-xxx"), học sinh vẫn xem bản cũ đến khi **Xuất bản thay bản cũ**; có Bỏ bản nháp, Gỡ xuất bản.

### 4.2 Kho hoạt động
- **Chứa tất cả các bài giảng**, xem theo học liệu → các phiên bản bài giảng của học liệu đó.
- *(giữ từ bản trước)* Chip trạng thái (Tất cả · Đã xuất bản · Đang soạn · Nháp), lọc nhóm CT, khối, tìm kiếm; Thẻ | Danh sách; dạng thẻ có 3 nút Soạn · View học sinh · Khác.
- Bài giảng mẫu của KDI: "Cột đèn giao thông xoay"; nhân bản để bắt đầu bài mới.

### 4.3 ⏳ Chờ xem lại
- **Hoạt động tương tác dùng lại** (bản trước gọi là "Kho hoạt động": danh mục hoạt động nhiều loại, thêm vào bài giảng khi soạn) — bản mới định nghĩa Kho hoạt động là kho bài giảng; cần đặt tên khác cho kho hoạt động tương tác nếu vẫn giữ.

---

## 5. E-learning & luyện thi
- Khoá học trực tuyến, đề luyện dựng từ bài học / học liệu của chương trình (giữ như hiện tại, chi tiết bổ sung sau).

---

## 6. Liên kết giữa các mục
| Từ | Sang | Cách liên kết |
|---|---|---|
| Danh mục | Chương trình giáo dục | Cấp học, khối, môn, nhóm chương trình chọn từ Danh mục; khối lọc theo cấp học |
| Chương trình giáo dục | Phân phối | Gợi ý chương trình theo khối; chỉ lấy môn, bài của đúng khối; số buổi, số tiết của bài quyết định số buổi trên lịch |
| Chương trình giáo dục | Học liệu | Mỗi bài học có một học liệu; cấp, khối, môn của học liệu lấy theo bài |
| Học liệu | Soạn bài giảng & Kho hoạt động | Bài giảng tạo từ học liệu; nhiều phiên bản / học liệu |
| Phân phối | Học liệu, Bài giảng | Mỗi buổi trên lịch trỏ về bài học → mở học liệu, bài giảng |
| Bài học, học liệu | E-learning | Khoá học, đề luyện dựng từ bài học / học liệu |

---

## 7. Việc còn mở
1. Các mục **⏳ Chờ xem lại** ở 1.5, 2.3, 3.3, 4.3.
2. **Danh mục Lớp**: hiện hiểu là danh mục riêng bên cạnh Khối — cần chốt Lớp dùng ở bước nào (phân phối theo lớp?).
3. Giao diện **Xếp lịch** khi có nhiều môn: lịch xem trước bị đẩy xuống dưới, cần hướng khác.
4. Tài liệu bản A (cách build) và slide bản B (demo cho sếp, chỉ làm khi chị xác nhận).
