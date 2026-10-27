import { supabase } from '../../lib/supabase'
import { catName, type CatItem } from '../ph1/curriculum/api'

// PH2 · Đào tạo & đánh giá năng lực nhà giáo — dữ liệu & quy tắc nghiệp vụ (chuyển từ bản mẫu giao diện ph1-chuong-trinh-mau.html, phần Phân hệ 2).
// Bảng: migration 067 (ph2_*). Học viên = giáo viên (bảng teachers).

export type Format = 'off' | 'on' | 'mix'
export type Crit = { id: string; name: string; pts: number; comp: string; req: boolean; desc: string[] }
export type Item = { id: string; name: string; kind: string; mod: string; mode: 'score' | 'rubric'; w: number; max: number; task: string; rubric: Crit[] }
export type Rel = { no: number; date: string; by: string; note: string; mods: number }
export type Prog = { id: string; owner_org_id: string; code: string | null; name: string; group_code: string | null; format: Format; mpp: number; status: string; issuer: string | null
  summary: string | null; outcomes: string | null; goal: string | null; audience: { levels: string[]; note: string }; subjects: string[]; subj_hours: Record<string, number>
  criteria: { att: number; score: number; req: boolean }; cert: string | null; items: Item[]; releases: Rel[]; created_at: string; updated_at: string }
export type Mod = { id: string; program_id: string; subject: string; seq: number; title: string; hours: number; sessions: number; mat_use: number | null }
export type MatContent = { desc: string; outcomes: string[]; product: string[]; doc: { written: string[][]; reviewed: string[][]; edited: string[][] }
  acts: { title: string; minutes: number; items: string[] }[]; practice: string; links: { kind: string; title: string; url: string }[]
  norms: { name: string; unit: string; qty: number; basis: string; cat: string }[] }
export type Mat = { id: string; module_id: string; version_no: number; status: string; groups: Record<string, string>; content: MatContent; published_at: string | null; updated_at: string }
export type Plan = { id: string; org_id: string; program_id: string; title: string; unit: string | null; status: string; subjs: string[]; cap: number; reg_due: string | null; schools: string[]
  subj_only: boolean; prereq: string | null; cond: string | null; assist: string[]; notice: { date: string; n: number; bgh: boolean } | null; confirmed: { date: string; by: string } | null
  survey: { form?: Q[]; sent?: string | null; due?: string; anon?: boolean; req?: boolean }; created_at: string }
export type Sess = { id: string; plan_id: string; date: string; start_t: string; end_t: string; module_id: string | null; subject: string | null; mode: 'off' | 'on'; place: string | null; link: string | null; rec: string | null; trainer: string | null }
export type Trainee = { plan_id: string; teacher_id: string; reg_at: string; supp: { kind: string; due: string } | null }
export type Grade = { plan_id: string; item_id: string; teacher_id: string; score: number | null; lv: Record<string, number> | null; note: string | null; sub: { at: string; file: string; late: boolean } | null }
export type Cert = { plan_id: string; teacher_id: string; no: string; issued_on: string }
export type Fb = { plan_id: string; teacher_id: string; answers: Record<string, number | string> }
export type CatRow = { id: string; owner_org_id: string | null; kind: 'group' | 'unit' | 'trainer'; code: string | null; name: string; color: string | null; info: Record<string, string>; sort: number }
export type Lect = { id: string; org_id: string; module_id: string; mat_version: number | null; title: string; author: string | null; status: string; parts: Part[]; updated_at: string }
export type Part = { title: string; minutes: number; note: string; blocks: { type: string; [k: string]: any }[] }
export type Q = { id: string; g: string; q: string; type?: 'scale' | 'text' }
export type Teacher = { id: string; org_id: string; full_name: string; subject: string | null; code: string; school: string; subj: string }
export type Org = { id: string; name: string; type: string; parent_id: string | null }

// ---------- Danh mục cố định ----------
export const TFORMAT: Record<string, string> = { off: 'Trực tiếp', on: 'Trực tuyến', mix: 'Kết hợp' }
export const IKIND: Record<string, [string, string]> = { quiz: ['Trắc nghiệm', 'check'], essay: ['Tự luận', 'edit'], practice: ['Bài tập thực hành', 'box'], product: ['Sản phẩm', 'file'], demo: ['Tiết dạy minh hoạ', 'users'] }
export const SUBMIT = (k: string) => k === 'practice' || k === 'product' || k === 'essay'
export const LV = ['Tốt', 'Khá', 'Đạt', 'Chưa đạt'], LVP = [1, .75, .5, 0], LVC = ['good', 'info', 'warn', 'bad']
export const COMP: Record<string, string> = { tk: 'Thiết kế bài học STEM', tc: 'Tổ chức hoạt động học', dg: 'Kiểm tra, đánh giá', cn: 'Công nghệ & thiết bị', lt: 'Lập trình & robotics' }
export const LVLS: [string, string][] = [['MN', 'Mầm non'], ['TH', 'Tiểu học'], ['THCS', 'THCS'], ['THPT', 'THPT']]
export const ATTK: Record<string, [string, string]> = { p: ['Có mặt', 'good'], l: ['Đi muộn', 'warn'], e: ['Vắng có phép', 'info'], a: ['Vắng', 'bad'] }
export const SURVEY: Q[] = [{ id: 'q1', g: 'Chương trình', q: 'Nội dung phù hợp nhu cầu giảng dạy' }, { id: 'q2', g: 'Chương trình', q: 'Vận dụng được ngay vào lớp học' },
  { id: 'q3', g: 'Giảng viên', q: 'Giảng viên truyền đạt dễ hiểu' }, { id: 'q4', g: 'Giảng viên', q: 'Giảng viên hỗ trợ, phản hồi kịp thời' },
  { id: 'q5', g: 'Học liệu', q: 'Học liệu, bài giảng đầy đủ, dễ dùng' }, { id: 'q6', g: 'Tổ chức', q: 'Lịch học, địa điểm / lớp ảo thuận tiện' }, { id: 'q7', g: 'Góp ý', q: 'Góp ý để khoá sau tốt hơn', type: 'text' }]
export const FBG = ['Chương trình', 'Giảng viên', 'Học liệu', 'Tổ chức', 'Góp ý']
export const SUPK: Record<string, string> = { makeup: 'Học bù buổi vắng', retest: 'Làm lại bài kiểm tra', resubmit: 'Nộp lại / bổ sung sản phẩm' }
export const TLINK: Record<string, string> = { slide: 'Slide', video: 'Video', doc: 'Tài liệu đọc', phieu: 'Phiếu / biểu mẫu' }
export const TBASIS: Record<string, string> = { student: 'mỗi học viên', group: 'mỗi nhóm', cls: 'mỗi lớp' }
export const TG4: [string, string][] = [['info', 'Thông tin bài học'], ['content', 'Nội dung bài học'], ['links', 'Link tài liệu'], ['norms', 'Định mức vật tư']]
export const CXN = { code: 'CXN', name: 'Chưa xếp nhóm', color: '#94a3b8' }

// ---------- Ngày ----------
export const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const pd = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)) }
const ds = (d: Date) => d.toISOString().slice(0, 10)
export const addD = (s: string, n: number) => { const d = pd(s); d.setUTCDate(d.getUTCDate() + n); return ds(d) }
export const vn = (s: string | null | undefined) => { if (!s) return '—'; const [y, m, d] = s.slice(0, 10).split('-'); return `${d}/${m}/${y}` }
export const vnS = (s: string) => { const [, m, d] = s.split('-'); return `${d}/${m}` }
const WD = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
export const wd = (s: string) => WD[pd(s).getUTCDay()]
export const wdFull = (s: string) => ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'][pd(s).getUTCDay()]
export const dow = (s: string) => pd(s).getUTCDay()
export const monOf = (iso: string) => addD(iso, -((pd(iso).getUTCDay() + 6) % 7))
export const fmtM = (m: number) => [Math.floor(m / 60) && Math.floor(m / 60) + ' giờ', m % 60 && m % 60 + ' phút'].filter(Boolean).join(' ') || '0 phút'
export const fmt1 = (v: number | null | undefined) => v == null ? '—' : (Math.round(v * 100) / 100).toFixed(2)
export const cap1 = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)
export const shortTitle = (t: string) => cap1(t.includes('–') ? t.split('–').pop()!.trim() : t)
export const lines = (t: string | null | undefined) => String(t ?? '').split('\n').map(x => x.trim()).filter(Boolean)
export const sessOf = (h: number, mpp: number) => Math.max(1, Math.ceil((+h || 0) * 60 / (+mpp || 180)))
export const platformOf = (u: string | null) => !u ? '—' : /meet\.google/.test(u) ? 'Google Meet' : /zoom\.us/.test(u) ? 'Zoom' : /teams\.microsoft/.test(u) ? 'MS Teams' : 'Liên kết'
export const slug = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
export const uid = (p: string) => p + '-' + Math.random().toString(36).slice(2, 9)

// ---------- Nạp toàn bộ dữ liệu PH2 trong phạm vi được xem ----------
export type DB = { progs: Prog[]; mods: Mod[]; mats: Mat[]; plans: Plan[]; sess: Sess[]; trainees: Trainee[]; att: Map<string, string>; grades: Map<string, Grade>; certs: Map<string, Cert>
  fbs: Fb[]; cat: CatRow[]; lects: Lect[]; teachers: Teacher[]; orgs: Org[]; survey: Q[] | null; today: string }
export async function loadDB(orgId: string | null, subjCat: CatItem[]): Promise<DB> {
  const q = <T,>(r: PromiseLike<{ data: unknown; error: { message: string } | null }>) => r.then(x => { if (x.error) throw new Error(x.error.message); return (x.data as T[]) ?? [] })
  const [progs, mods, mats, plans, sess, trainees, att, grades, certs, fbs, cat, lects, orgs, st] = await Promise.all([
    q<Prog>(supabase.from('ph2_programs').select('*').order('created_at')), q<Mod>(supabase.from('ph2_modules').select('*').order('seq')),
    q<Mat>(supabase.from('ph2_materials').select('*').order('version_no')), q<Plan>(supabase.from('ph2_plans').select('*').order('created_at')),
    q<Sess>(supabase.from('ph2_sessions').select('*').order('date').order('start_t')), q<Trainee>(supabase.from('ph2_trainees').select('*')),
    q<{ session_id: string; teacher_id: string; mark: string }>(supabase.from('ph2_attendance').select('*')), q<Grade>(supabase.from('ph2_grades').select('*')),
    q<Cert>(supabase.from('ph2_certs').select('*').order('no')), q<Fb>(supabase.from('ph2_feedback').select('*')), q<CatRow>(supabase.from('ph2_catalog').select('*').order('sort')),
    q<Lect>(supabase.from('ph2_lectures').select('*').order('created_at')), q<Org>(supabase.from('organizations').select('id, name, type, parent_id').order('name')),
    orgId ? q<{ survey: Q[] }>(supabase.from('ph2_settings').select('survey').eq('org_id', orgId)) : Promise.resolve([]),
  ])
  // Giáo viên: học viên của các đợt + giáo viên trong cây đơn vị (để chọn thêm học viên)
  const ids = Array.from(new Set(trainees.map(t => t.teacher_id)))
  const [tA, tB] = await Promise.all([
    ids.length ? q<{ id: string; org_id: string; full_name: string; subject: string | null }>(supabase.from('teachers').select('id, org_id, full_name, subject').in('id', ids)) : Promise.resolve([]),
    q<{ id: string; org_id: string; full_name: string; subject: string | null }>(supabase.from('teachers').select('id, org_id, full_name, subject').eq('status', 'active').order('full_name').limit(800)),
  ])
  const subjKey = (name: string | null) => { if (!name) return ''; const n = name.trim().toLowerCase(); return subjCat.find(c => c.kind === 'subject' && c.name.toLowerCase() === n)?.code ?? slug(name) }
  const tmap = new Map<string, Teacher>()
  for (const t of [...tA, ...tB]) if (!tmap.has(t.id)) tmap.set(t.id, { ...t, code: 'GV' + t.id.replace(/-/g, '').slice(0, 5).toUpperCase(), school: orgs.find(o => o.id === t.org_id)?.name ?? '', subj: subjKey(t.subject) })
  return { progs, mods, mats, plans, sess, trainees, att: new Map(att.map(a => [a.session_id + '|' + a.teacher_id, a.mark])), grades: new Map(grades.map(g => [g.plan_id + '|' + g.item_id + '|' + g.teacher_id, g])),
    certs: new Map(certs.map(c => [c.plan_id + '|' + c.teacher_id, c])), fbs, cat, lects, teachers: [...tmap.values()], orgs, survey: st[0]?.survey?.length ? st[0].survey : null, today: todayIso() }
}

// ---------- Truy vấn dẫn xuất ----------
export function mk(db: DB, subjCat: CatItem[]) {
  const T = db.today
  const SUBJ = (k: string | null | undefined) => (k ? catName(subjCat, 'subject', k) || k : '')
  const groups = () => db.cat.filter(c => c.kind === 'group')
  const groupOf = (code: string | null) => { const g = groups().find(x => x.code === code); return g ? { code: g.code!, name: g.name, color: g.color ?? '#64748b' } : CXN }
  const prog = (id: string | null) => db.progs.find(p => p.id === id) ?? null
  const modsOf = (pid: string) => db.mods.filter(m => m.program_id === pid).sort((a, b) => a.seq - b.seq)
  const mod = (id: string | null) => db.mods.find(m => m.id === id) ?? null
  const subjectsOf = (p: Prog) => Array.from(new Set([...(p.subjects ?? []), ...Object.keys(p.subj_hours ?? {}), ...modsOf(p.id).map(m => m.subject)]))
  const subjMods = (p: Prog, s: string) => modsOf(p.id).filter(m => m.subject === s)
  const allMods = (p: Prog) => subjectsOf(p).flatMap(s => subjMods(p, s).map(m => ({ s, m })))
  const subjH = (p: Prog, k: string) => +(p.subj_hours?.[k] ?? subjMods(p, k).reduce((a, m) => a + Number(m.hours), 0)) || 0
  const progH = (p: Prog) => subjectsOf(p).reduce((a, k) => a + subjH(p, k), 0)
  const progS = (p: Prog) => sessOf(progH(p), p.mpp)
  const matsOf = (mid: string) => db.mats.filter(x => x.module_id === mid).sort((a, b) => a.version_no - b.version_no)
  const matSt = (m: Mod): { s: 'ok' | 'draft' | 'none'; v: number } => { const vs = matsOf(m.id); if (m.mat_use && vs.some(x => x.version_no === m.mat_use && x.status === 'published')) return { s: 'ok', v: m.mat_use }
    return vs.length ? { s: 'draft', v: vs[vs.length - 1].version_no } : { s: 'none', v: 0 } }
  const teacher = (id: string) => db.teachers.find(t => t.id === id) ?? { id, org_id: '', full_name: '(không xem được)', subject: null, code: '—', school: '', subj: '' }
  const orgName = (id: string | null) => db.orgs.find(o => o.id === id)?.name ?? ''
  const plan = (id: string | null) => db.plans.find(p => p.id === id) ?? null
  const sessOfPlan = (pid: string) => db.sess.filter(s => s.plan_id === pid).sort((a, b) => (a.date + a.start_t).localeCompare(b.date + b.start_t))
  const traineesOf = (pid: string) => db.trainees.filter(t => t.plan_id === pid).map(t => t.teacher_id)
  const trainee = (pid: string, t: string) => db.trainees.find(x => x.plan_id === pid && x.teacher_id === t)
  const plansOfTeacher = (t: string) => db.plans.filter(p => db.trainees.some(x => x.plan_id === p.id && x.teacher_id === t))
  const sessEnd = (s: Sess) => s.date < T
  const sessSubj = (s: Sess) => s.subject ?? mod(s.module_id)?.subject ?? null
  const sessTitle = (s: Sess) => mod(s.module_id)?.title ?? SUBJ(s.subject)
  const planSubjs = (p: Plan) => p.subjs?.length ? p.subjs : Array.from(new Set(sessOfPlan(p.id).map(sessSubj).filter(Boolean) as string[]))
  const planRange = (p: Plan) => { const ss = sessOfPlan(p.id); return ss.length ? `${vnS(ss[0].date)} → ${vn(ss[ss.length - 1].date)}` : 'chưa có buổi' }
  const planItems = (p: Plan) => (prog(p.program_id)?.items ?? []).filter(i => !i.mod || planSubjs(p).includes(mod(i.mod)?.subject ?? ''))
  const itemSess = (p: Plan, i: Item) => sessOfPlan(p.id).filter(s => !i.mod || s.module_id === i.mod)
  const itemOpen = (p: Plan, i: Item) => { const ss = itemSess(p, i); const all = sessOfPlan(p.id); return ss.length ? sessEnd(ss[ss.length - 1]) : all.length > 0 && !all.some(s => !sessEnd(s)) }
  const itemFrom = (p: Plan, i: Item) => { const ss = itemSess(p, i); const all = sessOfPlan(p.id); return (ss[ss.length - 1] ?? all[all.length - 1])?.date ?? T }
  const itemDue = (p: Plan, i: Item) => addD(itemFrom(p, i), 7)
  const grOf = (p: Plan, i: Item, t: string) => db.grades.get(p.id + '|' + i.id + '|' + t)
  const itemScore = (p: Plan, i: Item, t: string): number | null => { const g = grOf(p, i, t); if (!g) return null
    if (i.mode === 'score') return g.score == null ? null : Number(g.score) / (i.max || 10) * 10
    if (!i.rubric.length || i.rubric.some(c => g.lv?.[c.id] == null)) return null
    return i.rubric.reduce((a, c) => a + c.pts * LVP[g.lv![c.id]], 0) / (i.rubric.reduce((a, c) => a + c.pts, 0) || 1) * 10 }
  const reqFails = (p: Plan, i: Item, t: string) => i.mode === 'rubric' ? i.rubric.filter(c => c.req && grOf(p, i, t)?.lv?.[c.id] === 3) : []
  const mark = (s: Sess, t: string) => db.att.get(s.id + '|' + t)
  const evalOf = (p: Plan, t: string) => {
    const pr = prog(p.program_id)!; const C = pr.criteria; const all = sessOfPlan(p.id); const past = all.filter(sessEnd)
    const marks = past.map(s => mark(s, t)).filter(Boolean); const att = past.length ? Math.round(100 * marks.filter(x => x === 'p' || x === 'l').length / past.length) : null
    const its = planItems(p); const items = its.map(i => ({ i, v: itemScore(p, i, t) })); const got = items.filter(x => x.v != null)
    const score = got.length ? got.reduce((a, x) => a + x.v! * x.i.w, 0) / (got.reduce((a, x) => a + (+x.i.w || 0), 0) || 1) : null
    const fails = its.flatMap(i => reqFails(p, i, t).map(c => ({ i, c })))
    const ended = all.length > 0 && !all.some(s => !sessEnd(s))
    const pass = att != null && att >= C.att && score != null && score >= C.score && !(C.req && fails.length)
    const risk = att != null && (att < C.att || (score != null && score < C.score) || (C.req && fails.length > 0))
    const result = !ended ? (risk ? 'Có nguy cơ chưa đạt' : 'Đang tập huấn') : got.length < its.length ? 'Thiếu điểm' : pass ? 'Hoàn thành' : 'Chưa hoàn thành'
    return { att, score, items, fails, graded: got.length, total: its.length, result }
  }
  const planSt = (p: Plan): [string, string] => { const ss = sessOfPlan(p.id)
    return p.status === 'draft' ? ['Đang lập (nháp)', 'warn'] : !ss.some(sessEnd) ? ['Sắp diễn ra', 'info'] : ss.some(s => !sessEnd(s)) ? ['Đang diễn ra', 'good'] : p.confirmed ? ['Đã kết thúc', 'draft'] : ['Học xong · chờ kết thúc', 'warn'] }
  const regSt = (p: Plan): [string, string, 'draft' | 'open' | 'closed'] => p.status === 'draft' ? ['Chưa mở đăng ký', 'draft', 'draft']
    : (p.reg_due ?? '0') >= T && sessOfPlan(p.id).some(s => !sessEnd(s)) ? ['Đang mở đăng ký', 'good', 'open'] : ['Quá hạn đăng ký', 'warn', 'closed']
  const plansOf = (pid: string) => db.plans.filter(p => p.program_id === pid)
  const progCover = (pr: Prog) => { const c = new Set(plansOf(pr.id).flatMap(planSubjs)); return subjectsOf(pr).filter(k => c.has(k)).length }
  const progPlanSt = (pr: Prog): [string, string, string] => { const ps = plansOf(pr.id); return !ps.length ? ['none', 'Chưa lập kế hoạch', 'bad'] : ps.some(p => p.status === 'draft') || progCover(pr) < subjectsOf(pr).length ? ['doing', 'Đang lập dở', 'warn'] : ['done', 'Đã lập kế hoạch', 'good'] }
  const eligibleOf = (p: Plan) => db.teachers.filter(t => (!p.schools?.length || p.schools.includes(t.org_id)) && (!p.subj_only || planSubjs(p).includes(t.subj)))
  const doneProg = (t: string, pid: string) => db.plans.some(p => p.program_id === pid && traineesOf(p.id).includes(t) && evalOf(p, t).result === 'Hoàn thành')
  const canReg = (p: Plan, t: string) => { const Tt = teacher(t); if (regSt(p)[2] !== 'open') return 'Đợt không mở đăng ký'
    if (p.schools?.length && !p.schools.includes(Tt.org_id)) return 'Đợt chỉ dành cho ' + p.schools.map(orgName).join(', ')
    if (p.subj_only && !planSubjs(p).includes(Tt.subj)) return 'Đợt dành cho học viên dạy ' + planSubjs(p).map(SUBJ).join(', ')
    if (p.prereq && !doneProg(t, p.prereq)) return 'Cần hoàn thành ' + (prog(p.prereq)?.code ?? '') + ' trước'
    if (traineesOf(p.id).length >= (p.cap ?? 999)) return 'Đã đủ sĩ số'; return '' }
  const progProgress = (t: string, pr: Prog) => { const ps = plansOf(pr.id).filter(p => traineesOf(p.id).includes(t)); const all = subjectsOf(pr)
    const done = new Set(ps.filter(p => evalOf(p, t).result === 'Hoàn thành').flatMap(planSubjs)); const pend = new Set(ps.filter(p => evalOf(p, t).result !== 'Hoàn thành').flatMap(planSubjs).filter(k => !done.has(k)))
    return { ps, all, done, pend, left: all.filter(k => !done.has(k) && !pend.has(k)) } }
  const condText = (p: Plan) => [p.subj_only && 'Dạy đúng môn của đợt (' + planSubjs(p).map(SUBJ).join(', ') + ')', p.prereq && 'Đã hoàn thành ' + (prog(p.prereq)?.code ?? ''), p.cond].filter(Boolean) as string[]
  const certOf = (p: Plan, t: string) => db.certs.get(p.id + '|' + t)
  const compOf = (tid: string) => { const out: Record<string, { k: number; n: number; src: Set<string> }> = {}
    for (const p of db.plans.filter(x => traineesOf(x.id).includes(tid))) for (const i of planItems(p)) { if (i.mode !== 'rubric') continue; const g = grOf(p, i, tid); if (!g?.lv) continue
      for (const c of i.rubric) { const k = g.lv[c.id]; if (k == null) continue; const o = out[c.comp] ?? (out[c.comp] = { k: 9, n: 0, src: new Set() }); o.n++; o.src.add(prog(p.program_id)?.code ?? ''); if (k < o.k) o.k = k } }
    return out }
  const fbOf = (pid: string) => db.fbs.filter(f => f.plan_id === pid)
  const fbQs = (p: Plan) => p.survey?.form?.length ? p.survey.form : db.survey ?? SURVEY
  const fbAvg = (p: Plan, f: (q: Q) => boolean = () => true) => { const qs = fbQs(p).filter(q => q.type !== 'text' && f(q)); const v = fbOf(p.id).flatMap(r => qs.map(q => r.answers[q.id])).filter(x => typeof x === 'number') as number[]
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null }
  // Lịch dự kiến: mỗi mô-đun của các môn trong đợt × số buổi; môn chưa chia mô-đun tính theo số giờ ÷ thời lượng buổi
  const genSessions = (pr: Prog, start: string, step: number | { days: number[]; every: number }, from: string, to: string, mode: 'off' | 'on', place: string, trainer: string, subjs: string[]) => {
    const units = subjs.flatMap(k => subjMods(pr, k).length ? subjMods(pr, k).map(m => ({ module_id: m.id as string | null, subject: k, sessions: m.sessions })) : [{ module_id: null, subject: k, sessions: sessOf(subjH(pr, k), pr.mpp) }])
    const cus = typeof step === 'object' && step.days.length ? step : null; const w0 = cus ? pd(monOf(start)).getTime() : 0
    const okDay = (x: string) => { const dd = pd(x); const wk = Math.floor((dd.getTime() - w0) / 864e5 / 7); return cus!.days.includes(dd.getUTCDay()) && wk % (cus!.every || 1) === 0 }
    let d = start; if (cus) { let g = 0; while (!okDay(d) && g++ < 400) d = addD(d, 1) }
    const out: Omit<Sess, 'id' | 'plan_id'>[] = []
    for (const u of units) for (let k = 0; k < u.sessions; k++) {
      if (!cus && dow(d) === 0) d = addD(d, 1)
      out.push({ date: d, start_t: from, end_t: to, module_id: u.module_id, subject: u.subject, mode, place: mode === 'on' ? '' : place, link: '', rec: null, trainer })
      if (cus) { let g = 0; d = addD(d, 1); while (!okDay(d) && g++ < 400) d = addD(d, 1) } else d = addD(d, step as number)
    }
    return out
  }
  return { T, SUBJ, groups, groupOf, prog, modsOf, mod, subjectsOf, subjMods, allMods, subjH, progH, progS, matsOf, matSt, teacher, orgName, plan, sessOfPlan, traineesOf, trainee, plansOfTeacher, sessEnd, sessSubj, sessTitle,
    planSubjs, planRange, planItems, itemSess, itemOpen, itemFrom, itemDue, grOf, itemScore, reqFails, mark, evalOf, planSt, regSt, plansOf, progCover, progPlanSt, eligibleOf, doneProg, canReg,
    progProgress, condText, certOf, compOf, fbOf, fbQs, fbAvg, genSessions }
}
export type K = ReturnType<typeof mk>

// Chuyển màn kèm ý định (mở đợt, mở học liệu…) giữa 4 mục của PH2
const INTENT_KEY = 'ph2:intent'
export function goto(go: ((p: string) => void) | undefined, page: string, intent: Record<string, unknown>) {
  try { sessionStorage.setItem(INTENT_KEY, JSON.stringify({ page, ...intent })) } catch { /* bỏ qua */ }
  go?.(page)
}
export function takeIntent(page: string): Record<string, any> | null {
  try { const s = sessionStorage.getItem(INTENT_KEY); if (!s) return null; const x = JSON.parse(s); if (x.page !== page) return null; sessionStorage.removeItem(INTENT_KEY); return x } catch { return null }
}
export const PAGE = { tp: 'Chương trình tập huấn', kh: 'Kế hoạch tập huấn', bt: 'Nội dung tập huấn', dg: 'Đánh giá kết quả' }
export const resPill = (r: string) => r === 'Hoàn thành' ? 'good' : r === 'Chưa hoàn thành' ? 'bad' : r === 'Có nguy cơ chưa đạt' || r === 'Thiếu điểm' ? 'warn' : 'info'
