import { lazy, type ComponentType } from 'react'
import type { RoleKey } from '../../lib/nav'

// Phân hệ 2 · Đào tạo & đánh giá năng lực nhà giáo: mã trang → màn hình, theo cổng (ghép vào PAGES ở App.tsx)
type PageMap = Record<string, ComponentType<any>>
const TrainProgs = lazy(() => import('./TrainProgs').then(m => ({ default: m.TrainProgs })))
const TrainPlans = lazy(() => import('./TrainPlans').then(m => ({ default: m.TrainPlans })))
const TrainContent = lazy(() => import('./TrainContent').then(m => ({ default: m.TrainContent })))
const TrainEval = lazy(() => import('./TrainEval').then(m => ({ default: m.TrainEval })))
const CORE: PageMap = { 'Chương trình tập huấn': TrainProgs, 'Kế hoạch tập huấn': TrainPlans, 'Nội dung tập huấn': TrainContent, 'Đánh giá kết quả': TrainEval }
export const PH2_PAGES: Partial<Record<RoleKey, PageMap>> = { platform: CORE, department: CORE, school_admin: CORE, teacher: CORE }
