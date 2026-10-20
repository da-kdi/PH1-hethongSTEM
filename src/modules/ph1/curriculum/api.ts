import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

// Chương trình giáo dục (migration 057_ph1_curriculum.sql, 058_ph1_framework.sql)

export type CatKind = 'category' | 'level' | 'subject' | 'field' | 'outcome_type' | 'assessment_method' | 'package_tier'
export type CatItem = { id: string; owner_org_id: string | null; kind: CatKind; code: string; name: string; description: string | null; color: string | null; sort: number }
export type Labels = { unit: string; lesson: string; period: string }
export type Scope = 'own' | 'children' | 'selected' | 'public'
export type Curriculum = {
  id: string; owner_org_id: string; owner_name: string | null; code: string | null; name: string; category: string | null; color: string | null; summary: string | null
  issuer: string | null; levels: string[]; grades: number[]; subjects: string[]; fields: string[]; structure_labels: Labels; scope: Scope
  require_approval: boolean; source_curriculum_id: string | null; source_version_id: string | null; current_version_id: string | null
  archived_at: string | null; created_at: string; updated_at: string
}
export type VStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'published' | 'superseded'
export type Version = {
  id: string; curriculum_id: string; org_id: string; version_no: number; label: string | null; status: VStatus; change_note: string | null
  based_on_version_id: string | null; author_id: string | null; submitted_at: string | null; decided_at: string | null; published_at: string | null
  effective_from: string | null; effective_to: string | null; created_at: string; updated_at: string
}
export type Unit = {
  id: string; version_id: string; seq: number; code: string | null; title: string; summary: string | null; grade: number | null; periods: number
  subject_main: string | null; subjects_integrated: string[]; room_kind: string | null; notes: string | null
}
export type PeriodRow = { title: string; minutes?: number; note?: string }
export type Lesson = {
  id: string; version_id: string; unit_id: string; seq: number; code: string | null; title: string; summary: string | null; periods: number
  minutes_per_period: number; period_plan: PeriodRow[]; library_item_id: string | null; notes: string | null
}
export type Outcome = {
  id: string; version_id: string; unit_id: string | null; lesson_id: string | null; seq: number; code: string | null; kind: string | null
  subject: string | null; description: string; competency_key: string | null
}
export type Criterion = { name: string; levels: string[] }
export type Assessment = {
  id: string; version_id: string; unit_id: string | null; lesson_id: string | null; seq: number; title: string; method: string | null
  outcome_ids: string[]; rubric_id: string | null; criteria: Criterion[]; evidence: string | null; weight: number | null
}
export type Subject = { id: string; version_id: string; seq: number; subject: string; grade: number; periods_total: number; periods_per_week: number | null; is_required: boolean; notes: string | null }
export type Content = { units: Unit[]; lessons: Lesson[]; outcomes: Outcome[]; assessments: Assessment[]; subjects: Subject[] }

export const DEFAULT_LABELS: Labels = { unit: 'Chủ đề', lesson: 'Bài học', period: 'Tiết' }
export const labelsOf = (c: Pick<Curriculum, 'structure_labels'> | null) => ({ ...DEFAULT_LABELS, ...(c?.structure_labels ?? {}) })

export const STATUS: Record<VStatus, [string, string, string]> = {
  draft: ['✎', 'Đang soạn', ''], pending: ['⏳', 'Chờ duyệt', 'warn'], approved: ['✓', 'Đã duyệt — chờ ban hành', 'good'],
  rejected: ['✕', 'Bị trả lại', 'bad'], published: ['●', 'Đang hiệu lực', 'good'], superseded: ['−', 'Hết hiệu lực', ''],
}
export const SCOPE: Record<Scope, string> = {
  own: 'Chỉ trong đơn vị', children: 'Đơn vị trực thuộc', selected: 'Đơn vị được chọn', public: 'Công khai toàn hệ thống',
}
export const CAT_KIND: Record<CatKind, [string, string]> = {
  category: ['Loại chương trình', 'CT1–CT5 hoặc loại riêng của đơn vị'],
  level: ['Cấp học', ''], subject: ['Môn học', 'Môn chủ đạo, môn tích hợp'], field: ['Lĩnh vực', ''],
  outcome_type: ['Loại chuẩn đầu ra', 'Kiến thức, kỹ năng, năng lực…'], assessment_method: ['Hình thức đánh giá', ''],
  package_tier: ['Hạng gói', 'Cơ bản, Nâng cao, gói riêng…'],
}
export const ROOM_KIND: Record<string, string> = { stem: 'Phòng STEM', classroom: 'Phòng học', lab: 'Phòng thí nghiệm', outdoor: 'Ngoài trời' }
export const GRADES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
export const gradeLabel = (g: number) => (g === 0 ? 'Mầm non' : `Lớp ${g}`)
export const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('vi-VN') : '—')
export const vName = (v: Pick<Version, 'version_no' | 'label'>) => `Phiên bản ${v.version_no}${v.label ? ` · ${v.label}` : ''}`

export function errText(m: string) {
  if (/schema cache|does not exist|curricul/i.test(m) && /relation|function|column|schema/i.test(m)) return 'CSDL chưa có chương trình đào tạo — chạy migration 057_ph1_curriculum.sql.'
  if (/row-level security|permission denied/i.test(m)) return 'Bạn không có quyền thực hiện thao tác này.'
  if (/duplicate key.*curricula_code/i.test(m)) return 'Mã chương trình đã dùng trong đơn vị.'
  if (/duplicate key.*curriculum_catalog/i.test(m)) return 'Mã này đã có trong danh mục.'
  return m
}

// Danh mục hiệu lực của đơn vị: mục hệ thống + của cấp trên + của mình, bỏ mục đơn vị (hoặc cấp trên) đã ẩn
export function useCatalog(reloadKey = 0) {
  const [all, setAll] = useState<CatItem[]>([])
  const [hidden, setHidden] = useState<{ org_id: string; item_id: string }[]>([])
  useEffect(() => {
    Promise.all([
      supabase.from('curriculum_catalog').select('*').order('kind').order('sort').order('name'),
      supabase.from('curriculum_catalog_hidden').select('org_id, item_id'),
    ]).then(([c, h]) => { setAll((c.data as CatItem[]) ?? []); setHidden((h.data as any[]) ?? []) })
  }, [reloadKey])
  return { all, hidden }
}
// CSDL chỉ trả mục hệ thống, của mình, cấp trên và cấp dưới → bỏ mục / lệnh ẩn của cấp dưới
export function effectiveCatalog(all: CatItem[], hidden: { org_id: string; item_id: string }[], below: Set<string>) {
  const hid = new Set(hidden.filter(h => !below.has(h.org_id)).map(h => h.item_id))
  return all.filter(i => (i.owner_org_id === null || !below.has(i.owner_org_id)) && !hid.has(i.id))
}
export const catOf = (items: CatItem[], kind: CatKind) => items.filter(i => i.kind === kind)
export const catName = (items: CatItem[], kind: CatKind, code: string | null | undefined) =>
  code ? items.find(i => i.kind === kind && i.code === code)?.name ?? code : ''

export async function loadContent(versionId: string): Promise<Content> {
  const [u, l, o, a, s] = await Promise.all([
    supabase.from('curriculum_units').select('*').eq('version_id', versionId).order('seq'),
    supabase.from('curriculum_lessons').select('*').eq('version_id', versionId).order('seq'),
    supabase.from('curriculum_outcomes').select('*').eq('version_id', versionId).order('seq'),
    supabase.from('curriculum_assessments').select('*').eq('version_id', versionId).order('seq'),
    supabase.from('curriculum_subjects').select('*').eq('version_id', versionId).order('grade').order('seq'),
  ])
  return { units: (u.data as Unit[]) ?? [], lessons: (l.data as Lesson[]) ?? [], outcomes: (o.data as Outcome[]) ?? [], assessments: (a.data as Assessment[]) ?? [], subjects: (s.data as Subject[]) ?? [] }
}

export type Org = { id: string; name: string; type: string; parent_id: string | null }
// Đơn vị đọc được + tập đơn vị cấp dưới của mình (lọc danh mục, chọn đơn vị nhận)
export function useOrgs(orgId: string | null) {
  const [orgs, setOrgs] = useState<Org[]>([])
  useEffect(() => { supabase.from('organizations').select('id, name, type, parent_id').order('name').then(({ data }) => setOrgs((data as Org[]) ?? [])) }, [orgId])
  const below = new Set<string>()
  const walk = (id: string) => orgs.filter(o => o.parent_id === id).forEach(o => { if (!below.has(o.id)) { below.add(o.id); walk(o.id) } })
  if (orgId) walk(orgId)
  return { orgs, below, me: orgs.find(o => o.id === orgId) ?? null }
}
