import type { NavGroup, RoleKey } from '../../lib/nav'

// Phân hệ 1 · Chương trình & học liệu (đề án Ver9: PH1 → nhóm 1.1; cấu trúc 5 mục theo docs/PH1-cau-truc-1.1.md).
// Đây là NGUỒN DUY NHẤT của menu PH1. Khi ghép về repo chính, các nhóm này thay cho nhóm
// "Chương trình & học liệu" hiện có trong NAV của từng cổng (xem docs/GHEP-VE-REPO-CHINH.md).
// Quy tắc mã trang giữ như lib/nav.ts: KHÔNG đổi chuỗi mã của mục đã có; muốn đổi tên hiển thị thì dùng PH1_LABEL.
const SECTION = '1. Chương trình & học liệu'
// 5 mục của 1.1 theo thứ tự luồng (cùng mã trang ở mọi cổng). "Theo dõi chương trình CT1–CT5 (Môn học)" nằm thành tab trong Phân phối.
const CORE = ['Chương trình giáo dục', 'Phân phối chương trình', 'Học liệu', 'Soạn bài giảng & kho hoạt động', 'E-learning & luyện thi']

export const PH1_NAV: Record<RoleKey, NavGroup[]> = {
  platform: [
    { section: SECTION, title: '1.1. Chương trình giáo dục & học liệu', items: [...CORE, 'Gói STEM (KDI)'] },
  ],
  school_admin: [
    { title: 'Chương trình & học liệu', items: [...CORE, 'Ngân hàng câu hỏi', 'Gói STEM', 'Đề xuất mua gói', 'Kho học liệu dùng chung', 'Phát hành học liệu'] },
  ],
  department: [
    { title: 'Chương trình & học liệu', items: [...CORE, 'Ngân hàng câu hỏi', 'Chương trình CT1–CT5', 'Theo dõi Môn học STEM', 'Phát hành học liệu', 'Kho học liệu dùng chung'] },
  ],
  teacher: [
    { title: 'Soạn giảng', items: ['Chương trình giáo dục', 'Phân phối chương trình', 'Học liệu', 'Soạn bài giảng & kho hoạt động', 'Soạn bài giảng', 'Kho hoạt động & Bài giảng', 'Thư viện STEM', 'Ngân hàng câu hỏi', 'E-learning & luyện thi'] },
  ],
  student: [
    { title: 'Học tập', items: ['Chủ đề', 'E-learning & luyện thi'] },
  ],
  parent: [],
  judge: [],
}

// Tên hiển thị (mã trang giữ nguyên)
export const PH1_LABEL: Partial<Record<RoleKey | '*', Record<string, string>>> = {
  '*': { 'Theo dõi chương trình CT1–CT5 (Môn học)': 'Theo dõi triển khai chương trình' },
  platform: { 'Gói STEM (KDI)': 'Danh mục gói STEM (KDI)' },
}
// Mục menu → chức năng (quyền vai trò ở cổng Trường, gói dịch vụ ở mọi cổng)
const CUR = Object.fromEntries(['Chương trình giáo dục', 'Học liệu', 'Soạn bài giảng & kho hoạt động', 'Theo dõi chương trình CT1–CT5 (Môn học)'].map(k => [k, 'curriculum']))
export const PH1_MODULE_OF: Record<string, string> = CUR
export const PH1_ENT_MODULE_OF: Record<string, string> = CUR
