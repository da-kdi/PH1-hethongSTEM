import { PH1_NAV, PH1_LABEL, PH1_MODULE_OF, PH1_ENT_MODULE_OF } from '../modules/ph1/nav'

export type RoleKey = 'school_admin' | 'teacher' | 'student' | 'department' | 'platform' | 'parent' | 'judge'
// section: tên phân hệ khi phân hệ chia nhiều nhóm (menu hiện tiêu đề phân hệ phía trên các nhóm con)
export type NavGroup = { title: string; items: string[]; section?: string }

export const ROLE_LABEL: Record<RoleKey, string> = {
  school_admin: 'Trường · Quản trị', teacher: 'Giáo viên',
  student: 'Học sinh', department: 'Sở GD&ĐT', platform: 'Quản trị nền tảng', parent: 'Phụ huynh', judge: 'Giám khảo',
}

// MÃ TRANG = tên mục lúc tạo trang. Mã được dùng làm khoá ở nhiều nơi: bảng trang (App.tsx PAGES), ánh xạ quyền/gói
// (MODULE_OF, ENT_MODULE_OF), liên kết giữa các màn (go('…')), cột notifications.page trong CSDL (trigger ghi sẵn),
// lịch sử trình duyệt. Vì vậy KHÔNG sửa chuỗi mã trong NAV/PAGES.
//   • Đổi nhóm, thứ tự, chuyển mục sang nhóm/cổng khác, đổi tên nhóm: chỉ sửa NAV — không ảnh hưởng gì khác.
//   • Đổi TÊN HIỂN THỊ của một mục: thêm vào LABEL (theo cổng, hoặc '*' cho mọi cổng) — menu, tiêu đề trang,
//     ô Tìm chức năng, Sơ đồ hệ thống đều đọc qua labelOf().
export const LABEL: Partial<Record<RoleKey | '*', Record<string, string>>> = {
  // ví dụ: department: { 'Dashboard toàn Sở': 'Tổng quan toàn Sở' },
  school_admin: { 'Quản lý Phòng STEM': 'Quản lý phòng' },   // 056: phòng STEM, phòng học, kho
  platform: { ...PH1_LABEL.platform },   // PH1: src/modules/ph1/nav.ts
}
export const labelOf = (role: RoleKey, id: string) => LABEL[role]?.[id] ?? LABEL['*']?.[id] ?? id

// BẢN TÁCH PH1: menu chỉ gồm Phân hệ 1, lấy từ src/modules/ph1/nav.ts (repo chính giữ NAV đầy đủ).
export const NAV: Record<RoleKey, NavGroup[]> = PH1_NAV

// Mục menu của vai trò Trường – Quản trị → chức năng trong ma trận phân quyền
export const MODULE_OF: Record<string, string> = {
  ...PH1_MODULE_OF,   // PH1: src/modules/ph1/nav.ts
  'Giáo viên': 'teachers', 'Lớp học': 'classes', 'Học sinh': 'students', 'Phụ huynh': 'students', 'Phân công giảng dạy': 'assignments',
  'Quản lý Phòng STEM': 'stem_rooms', 'Quản lý Thiết bị': 'equipment', 'Vật tư tiêu hao': 'equipment', 'Đề xuất mua vật tư': 'equipment', 'Vận chuyển vật tư': 'equipment', 'Kiểm kê': 'equipment', 'Bảo hành thiết bị': 'warranty',
  'Thời khóa biểu': 'timetable', 'Duyệt đăng ký dạy STEM': 'stem_registrations', 'Tòa nhà & Tầng': 'buildings',
  'Cấu hình tiết học': 'periods', 'Năm học & học kỳ': 'periods', 'Tài khoản': 'accounts', 'Sao lưu & xuất dữ liệu': 'accounts', 'Giao diện & thương hiệu': 'accounts', 'Vai trò và phân quyền': 'roles',
  'Kế hoạch GD toàn trường': 'edu_plan', 'Phân công GV dạy STEM': 'stem_assign', 'Phân phối chương trình': 'curriculum',
  'Gói STEM': 'packages', 'Kế hoạch tập huấn': 'training', 'Lịch tập huấn': 'training', 'Bài giảng': 'training',
  'Lớp học ảo': 'training', 'Chứng chỉ': 'training',
  'Kho học liệu dùng chung': 'library', 'Phát hành học liệu': 'library',
  'Hộp phê duyệt': 'approvals', 'Quy trình phê duyệt': 'roles', 'Đề xuất mua gói': 'packages',
  'Buổi dạy & điểm danh': 'timetable', 'Dashboard điểm danh': 'timetable', 'Ngày nghỉ & lễ': 'periods',
  'Đánh giá năng lực GV': 'training', 'Năng lực học sinh': 'students',
}
// Vai trò → giao diện: lưu ở cột roles.portal (vai trò hệ thống và vai trò tuỳ chỉnh của trường).

// Mục menu (mọi giao diện trừ Quản trị nền tảng) → chức năng dùng để kiểm tra gói dịch vụ (migration 024).
// Mục không có ở đây là phần lõi, luôn hiện.
export const ENT_MODULE_OF: Record<string, string> = {
  ...PH1_ENT_MODULE_OF,
  ...MODULE_OF, 'Quy trình phê duyệt': 'approvals',
  'Đặt phòng STEM': 'stem_rooms', 'Thư viện STEM': 'library', 'Kho hoạt động & Bài giảng': 'library',
  'Lịch tập huấn': 'training', 'Bài giảng tập huấn': 'training', 'Kế hoạch tập huấn': 'training', 'Giám sát Tập huấn GV': 'training',
  'Kế hoạch giáo dục': 'edu_plan', 'Hiệu quả Phòng STEM': 'stem_rooms',
  'Điểm danh': 'timetable', 'Phòng STEM & lịch phòng': 'stem_rooms', 'Thiết bị & kho': 'stem_rooms',
  // PH5 (migration 033): điều hành & báo cáo của Sở
  'KPI & Xếp hạng Xã/Phường': 'governance', 'Báo cáo Bộ GD&ĐT': 'governance',
  'Cảnh báo & trường cần chú ý': 'governance', 'Giao chỉ tiêu': 'governance',
  'Chỉ số STEM': 'governance', 'So sánh trường / địa bàn': 'governance', 'Bộ chỉ số': 'governance',
  // 042: năng lực GV thuộc PH1 (Đào tạo & đánh giá năng lực nhà giáo), năng lực HS thuộc PH4
  'Hồ sơ năng lực': 'training', 'Năng lực học sinh': 'timetable', 'Năng lực của em': 'timetable',
}

// Cổng hiện mục chưa có trong gói ở dạng mờ "Chưa có trong gói" (để giới thiệu phân hệ); các cổng khác ẩn hẳn.
export const UPSELL_PORTALS = new Set<RoleKey>(['school_admin', 'department'])
// Chức năng (perm module) → phân hệ bán (khớp service_modules.perm_modules, migration 033)
export const PHASE_OF: Record<string, string> = {
  training: 'Đào tạo & đánh giá năng lực nhà giáo',
  library: 'Chương trình & học liệu', packages: 'Chương trình & học liệu', curriculum: 'Chương trình & học liệu',
  stem_rooms: 'Vật tư, thiết bị dạy & học', equipment: 'Vật tư, thiết bị dạy & học', warranty: 'Vật tư, thiết bị dạy & học',
  timetable: 'Vận hành giảng dạy & đánh giá người học', edu_plan: 'Vận hành giảng dạy & đánh giá người học',
  stem_registrations: 'Vận hành giảng dạy & đánh giá người học', stem_assign: 'Vận hành giảng dạy & đánh giá người học',
  governance: 'Hệ thống quản lý vận hành',
}
