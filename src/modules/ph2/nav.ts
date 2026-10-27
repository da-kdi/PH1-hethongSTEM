import type { NavGroup, RoleKey } from '../../lib/nav'

// Phân hệ 2 · Đào tạo & đánh giá năng lực nhà giáo (đề án Ver9: nhóm 2.1). Nguồn duy nhất của menu PH2 — ghép sau PH1 trong lib/nav.ts.
// Quy tắc mã trang giữ như lib/nav.ts: KHÔNG đổi chuỗi mã của mục đã có; đổi tên hiển thị thì dùng LABEL.
const SECTION = '2. Đào tạo & đánh giá năng lực nhà giáo'
const CORE = ['Chương trình tập huấn', 'Kế hoạch tập huấn', 'Nội dung tập huấn', 'Đánh giá kết quả']
const G = (title: string): NavGroup => ({ section: SECTION, title, items: [...CORE] })

export const PH2_NAV: Partial<Record<RoleKey, NavGroup[]>> = {
  platform: [G('2.1. Đào tạo & đánh giá năng lực nhà giáo')],
  department: [{ title: 'Đào tạo & đánh giá nhà giáo', items: [...CORE] }],
  school_admin: [{ title: 'Đào tạo & đánh giá nhà giáo', items: [...CORE] }],
  teacher: [{ title: 'Tập huấn của tôi', items: ['Kế hoạch tập huấn', 'Nội dung tập huấn', 'Đánh giá kết quả'] }],
}
// Mục menu → chức năng (quyền vai trò ở cổng Trường, gói dịch vụ): phân hệ "training"
export const PH2_MODULE_OF: Record<string, string> = Object.fromEntries(CORE.map(k => [k, 'training']))
