import type { NavGroup, RoleKey } from '../../lib/nav'

// Phân hệ 1 · Chương trình & học liệu (đề án Ver9: PH1 → nhóm 1.1, 6 chức năng).
// Đây là NGUỒN DUY NHẤT của menu PH1. Khi ghép về repo chính, các nhóm này thay cho nhóm
// "Chương trình & học liệu" hiện có trong NAV của từng cổng (xem docs/GHEP-VE-REPO-CHINH.md).
// Quy tắc mã trang giữ như lib/nav.ts: KHÔNG đổi chuỗi mã của mục đã có; muốn đổi tên hiển thị thì dùng PH1_LABEL.
const SECTION = '1. Chương trình & học liệu'

export const PH1_NAV: Record<RoleKey, NavGroup[]> = {
  platform: [
    { section: SECTION, title: '1.1. Chương trình giáo dục & học liệu', items: ['Chương trình đào tạo', 'Học liệu', 'Phân phối chương trình', 'Soạn bài giảng & kho hoạt động', 'Theo dõi chương trình CT1–CT5 (Môn học)', 'E-learning & luyện thi', 'Chương trình giáo dục'] },
  ],
  school_admin: [
    { title: 'Chương trình & học liệu', items: ['Chương trình đào tạo', 'Gói STEM', 'Đề xuất mua gói', 'Phân phối chương trình', 'Kho học liệu dùng chung', 'Phát hành học liệu', 'E-learning & luyện thi', 'Ngân hàng câu hỏi'] },
  ],
  department: [
    { title: 'Chương trình & học liệu', items: ['Chương trình đào tạo', 'Chương trình CT1–CT5', 'Theo dõi Môn học STEM', 'Phát hành học liệu', 'Kho học liệu dùng chung', 'E-learning & luyện thi', 'Ngân hàng câu hỏi'] },
  ],
  teacher: [
    { title: 'Soạn giảng', items: ['Chương trình đào tạo', 'Soạn bài giảng', 'Kho hoạt động & Bài giảng', 'Thư viện STEM', 'Ngân hàng câu hỏi', 'E-learning & luyện thi'] },
  ],
  student: [
    { title: 'Học tập', items: ['Chủ đề', 'E-learning & luyện thi'] },
  ],
  parent: [],
  judge: [],
}

// Tên hiển thị (mã trang giữ nguyên): danh mục gói STEM của KDI không còn gọi là "Chương trình giáo dục"
export const PH1_LABEL: Partial<Record<RoleKey | '*', Record<string, string>>> = {
  platform: { 'Chương trình giáo dục': 'Danh mục gói STEM (KDI)' },
}
// Mục menu → chức năng (quyền vai trò ở cổng Trường, gói dịch vụ ở mọi cổng)
export const PH1_MODULE_OF: Record<string, string> = { 'Chương trình đào tạo': 'curriculum' }
export const PH1_ENT_MODULE_OF: Record<string, string> = { 'Chương trình đào tạo': 'curriculum' }
