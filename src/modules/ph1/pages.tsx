import { lazy, type ComponentType } from 'react'
import type { RoleKey } from '../../lib/nav'
import { TabbedPages } from '../../components/TabbedPages'

// Phân hệ 1 · Chương trình & học liệu: mã trang → màn hình, theo cổng.
// Khi ghép về repo chính: App.tsx trộn PH1_PAGES vào SCHOOL / TEACHER / STUDENT / DEPARTMENT / PLATFORM
// (xem docs/GHEP-VE-REPO-CHINH.md). Màn mới của PH1 đặt trong src/modules/ph1/ và chỉ cần khai báo ở đây.
type PageMap = Record<string, ComponentType<any>>

// Màn đã có ở repo chính (giữ nguyên đường dẫn để ghép lại không lệch)
const Packages = lazy(() => import('../../pages/Packages'))
const PackageOrders = lazy(() => import('../../pages/approvals/PackageOrders').then(m => ({ default: m.PackageOrders })))
const Curriculum = lazy(() => import('../../pages/School').then(m => ({ default: m.Curriculum })))
const LibraryBrowse = lazy(() => import('../../pages/library/Browse').then(m => ({ default: m.LibraryBrowse })))
const LibraryManage = lazy(() => import('../../pages/library/Manage').then(m => ({ default: m.LibraryManage })))
const ElearningManage = lazy(() => import('../../pages/elearning/Manage'))
const QuestionBank = lazy(() => import('../../pages/elearning/Bank'))
const StudentElearning = lazy(() => import('../../pages/elearning/Student'))
const TeacherLessonStudio = lazy(() => import('../../pages/teacher/Lessons').then(m => ({ default: m.TeacherLessonStudio })))
const TeacherActivities = lazy(() => import('../../pages/teacher/Activities').then(m => ({ default: m.TeacherActivities })))
const StudentTopics = lazy(() => import('../../pages/student/Topics').then(m => ({ default: m.StudentTopics })))
const DeptPrograms = lazy(() => import('../../pages/department/Overview').then(m => ({ default: m.DeptPrograms })))
const DeptSubjects = lazy(() => import('../../pages/department/Overview').then(m => ({ default: m.DeptSubjects })))
const PlatformCatalog = lazy(() => import('../../pages/platform/Catalog').then(m => ({ default: m.PlatformCatalog })))
const SysCurriculum = lazy(() => import('../../pages/platform/SystemViews').then(m => ({ default: m.SysCurriculum })))
const SysLessons = lazy(() => import('../../pages/platform/SystemViews').then(m => ({ default: m.SysLessons })))

export const PH1_PAGES: Partial<Record<RoleKey, PageMap>> = {
  school_admin: {
    'Gói STEM': Packages,
    'Đề xuất mua gói': PackageOrders,
    'Phân phối chương trình': Curriculum,
    'Kho học liệu dùng chung': LibraryBrowse,
    'Phát hành học liệu': LibraryManage,
    'E-learning & luyện thi': ElearningManage,
    'Ngân hàng câu hỏi': QuestionBank,
  },
  department: {
    'Chương trình CT1–CT5': DeptPrograms,
    'Theo dõi Môn học STEM': DeptSubjects,
    'Phát hành học liệu': LibraryManage,
    'Kho học liệu dùng chung': LibraryBrowse,
    'E-learning & luyện thi': ElearningManage,
    'Ngân hàng câu hỏi': QuestionBank,
  },
  teacher: {
    'Soạn bài giảng': TeacherLessonStudio,
    'Kho hoạt động & Bài giảng': TeacherActivities,
    'Thư viện STEM': LibraryBrowse,
    'Ngân hàng câu hỏi': QuestionBank,
    'E-learning & luyện thi': ElearningManage,
  },
  student: {
    'Chủ đề': StudentTopics,
    'E-learning & luyện thi': StudentElearning,
  },
  platform: {
    'Chương trình giáo dục': PlatformCatalog,
    'Học liệu': (p: any) => <TabbedPages {...p} tabs={[['Phát hành học liệu', LibraryManage], ['Kho học liệu dùng chung', LibraryBrowse]]} />,
    'Phân phối chương trình': SysCurriculum,
    'Soạn bài giảng & kho hoạt động': SysLessons,
    'Theo dõi chương trình CT1–CT5 (Môn học)': (p: any) => <TabbedPages {...p} tabs={[['Chương trình CT1–CT5', DeptPrograms], ['Môn học STEM', DeptSubjects]]} />,
    'E-learning & luyện thi': ElearningManage,
  },
}
