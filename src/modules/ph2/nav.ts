import type { NavGroup, RoleKey } from '../../lib/nav'

// Phân hệ 2 · Đào tạo & đánh giá năng lực nhà giáo (đề án Ver9: nhóm 2.1). Nguồn duy nhất của menu PH2 — ghép sau PH1 trong lib/nav.ts.
// Quy tắc mã trang giữ như lib/nav.ts: KHÔNG đổi chuỗi mã của mục đã có; đổi tên hiển thị thì dùng LABEL.
const SECTION = '2. Đào tạo & đánh giá năng lực nhà giáo'
const CORE = ['Chương trình tập huấn', 'Kế hoạch tập huấn', 'Nội dung tập huấn', 'Đánh giá kết quả']
const G = (title: string): NavGroup => ({ section: SECTION, title, items: [...CORE] })

export const PH2_NAV: Partial<Record<RoleKey, NavGroup[]>> = {
  platform: [G('2.1. Đào tạo & đánh giá năng lực nhà giáo')],
  // Bản mẫu v315: mọi cổng dùng cùng cấu trúc phân hệ › nhóm như bản mẫu
  department: [G('2.1. Đào tạo & đánh giá năng lực nhà giáo')],
  school_admin: [G('2.1. Đào tạo & đánh giá năng lực nhà giáo')],
  teacher: [{ section: SECTION, title: '2.1. Đào tạo của tôi', items: ['Kế hoạch tập huấn', 'Nội dung tập huấn', 'Đánh giá kết quả'] }],
}
// Mục menu → chức năng (quyền vai trò ở cổng Trường, gói dịch vụ): phân hệ "training"
// Bản mẫu v315: “tập huấn” → “đào tạo” (chỉ đổi tên hiển thị, giữ mã trang)
export const PH2_LABEL: Record<string, string> = { 'Chương trình tập huấn': 'Chương trình đào tạo', 'Kế hoạch tập huấn': 'Kế hoạch đào tạo', 'Nội dung tập huấn': 'Nội dung đào tạo' }
export const PH2_MODULE_OF: Record<string, string> = Object.fromEntries(CORE.map(k => [k, 'training']))
