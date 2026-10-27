import { lazy, type ComponentType } from 'react'
import type { RoleKey } from '../../lib/nav'

// Phân hệ 1 · Chương trình & học liệu: mã trang → màn hình, theo cổng.
// Khi ghép về repo chính: App.tsx trộn PH1_PAGES vào SCHOOL / TEACHER / STUDENT / DEPARTMENT / PLATFORM
// (xem docs/GHEP-VE-REPO-CHINH.md). Màn mới của PH1 đặt trong src/modules/ph1/ và chỉ cần khai báo ở đây.
type PageMap = Record<string, ComponentType<any>>

// Màn của mục 1.1 (src/modules/ph1)
const CurriculumPage = lazy(() => import('./curriculum/CurriculumPage').then(m => ({ default: m.CurriculumPage })))
const MaterialsPage = lazy(() => import('./materials/MaterialsPage').then(m => ({ default: m.MaterialsPage })))
const PpctPage = lazy(() => import('./ppct/PpctMau').then(m => ({ default: m.PpctMau })))
const DesignsPage = lazy(() => import('./designs/DesignsPage').then(m => ({ default: m.DesignsPage })))
const TrackingPage = lazy(() => import('./tracking/TrackingPage').then(m => ({ default: m.TrackingPage })))
const ElearningByProgram = lazy(() => import('./elearning/ElearningByProgram').then(m => ({ default: m.ElearningByProgram })))

// Màn đã có ở repo chính (giữ nguyên đường dẫn để ghép lại không lệch)
const Packages = lazy(() => import('../../pages/Packages'))
const PackageOrders = lazy(() => import('../../pages/approvals/PackageOrders').then(m => ({ default: m.PackageOrders })))
const LibraryBrowse = lazy(() => import('../../pages/library/Browse').then(m => ({ default: m.LibraryBrowse })))
const LibraryManage = lazy(() => import('../../pages/library/Manage').then(m => ({ default: m.LibraryManage })))
const QuestionBank = lazy(() => import('../../pages/elearning/Bank'))
const StudentElearning = lazy(() => import('../../pages/elearning/Student'))
const TeacherLessonStudio = lazy(() => import('../../pages/teacher/Lessons').then(m => ({ default: m.TeacherLessonStudio })))
const TeacherActivities = lazy(() => import('../../pages/teacher/Activities').then(m => ({ default: m.TeacherActivities })))
const StudentTopics = lazy(() => import('../../pages/student/Topics').then(m => ({ default: m.StudentTopics })))
const DeptPrograms = lazy(() => import('../../pages/department/Overview').then(m => ({ default: m.DeptPrograms })))
const DeptSubjects = lazy(() => import('../../pages/department/Overview').then(m => ({ default: m.DeptSubjects })))
const PlatformCatalog = lazy(() => import('../../pages/platform/Catalog').then(m => ({ default: m.PlatformCatalog })))

// 6 chức năng 1.1 dùng chung cho cổng KDI, Sở, Trường, Giáo viên
const CORE: PageMap = {
  'Chương trình giáo dục': CurriculumPage,
  'Học liệu': MaterialsPage,
  'Phân phối chương trình': PpctPage,
  'Soạn bài giảng & kho hoạt động': DesignsPage,
  'Theo dõi chương trình CT1–CT5 (Môn học)': TrackingPage,
  'E-learning & luyện thi': ElearningByProgram,
}

export const PH1_PAGES: Partial<Record<RoleKey, PageMap>> = {
  school_admin: {
    ...CORE,
    'Ngân hàng câu hỏi': QuestionBank,
    'Gói STEM': Packages,
    'Đề xuất mua gói': PackageOrders,
    'Kho học liệu dùng chung': LibraryBrowse,
    'Phát hành học liệu': LibraryManage,
  },
  department: {
    ...CORE,
    'Ngân hàng câu hỏi': QuestionBank,
    'Chương trình CT1–CT5': DeptPrograms,
    'Theo dõi Môn học STEM': DeptSubjects,
    'Phát hành học liệu': LibraryManage,
    'Kho học liệu dùng chung': LibraryBrowse,
  },
  teacher: {
    ...CORE,
    'Soạn bài giảng': TeacherLessonStudio,
    'Kho hoạt động & Bài giảng': TeacherActivities,
    'Thư viện STEM': LibraryBrowse,
    'Ngân hàng câu hỏi': QuestionBank,
  },
  student: {
    'Chủ đề': StudentTopics,
    'E-learning & luyện thi': StudentElearning,
  },
  platform: {
    ...CORE,
    'Gói STEM (KDI)': PlatformCatalog,
  },
}
