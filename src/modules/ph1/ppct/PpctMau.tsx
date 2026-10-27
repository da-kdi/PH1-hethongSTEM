import { Fragment, useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react'
import { supabase } from '../../../lib/supabase'
import { SCHOOL_YEAR, errMsg, norm, useRpcBool } from '../ui'
import { OPEN_LESSON_KEY, catName, catOf, effectiveCatalog, gradesOfLevel, levelOfGrade, useCatalog, useOrgs, type CatItem, type Curriculum } from '../curriculum/api'
import { Confirm, Empty, Flow, Ic, Mau, PageHead, Panel, Search, Seg, Sel, StatCard, StatusPill, cssVar } from '../mau/kit'

// 1.1.3 Phân phối chương trình — dựng theo bản mẫu giao diện (ph1-chuong-trinh-mau.html):
//   Bước 1 · Năm học & lịch nghỉ: dùng chung cho mọi bản phân phối (ngày bắt đầu, số tuần HK I/II, lịch nghỉ toàn tỉnh + riêng từng trường, khoá tuần).
//   Bước 2 · Bản phân phối: Cấp học › Khối → bản phân phối; thiết lập (Trường) › Cấp học › Khối › Chương trình phù hợp › Môn › Xếp lịch Học kỳ › Tuần
//   (bắt đầu, nhịp tiết/tuần, thứ tự bài, ghim tuần bằng kéo thả; tuần nghỉ tự bỏ qua); kiểm tra lỗi / cảnh báo; Lưu nháp / Phát hành.
//   Lịch lưu ở ppct_docs.items, năm học ở ppct_years, lịch nghỉ ở school_holidays (migration 065).

type Item = { curriculum_id: string | null; subject: string; start: string; ppw: number; order?: string[]; pins?: Record<string, number>; chapter_ids?: string[] }
type Doc = { id: string; org_id: string; target_org_id: string | null; level: string | null; subject: string | null; grade: number; school_year: string; title: string | null
  status: string; max_ppw: number; items: Item[] | null; ppw_hk1: number; updated_at: string }
type Chap = { id: string; doc_id: string; semester: number; seq: number; curriculum_id: string | null; subject: string | null; title: string }
type PRow = { id: string; chapter_id: string; seq: number; title: string; periods: number; part_label: string | null; material_lesson_id: string | null }
type Mat = { s: 'none' | 'draft' | 'ok'; v: number | null }
type L = { id: string; title: string; periods: number; mat: Mat; cl: string | null }
type Year = { id?: string; org_id: string; school_year: string; start_date: string; weeks_hk1: number; weeks_hk2: number; locks: string[] }
type Hol = { id: string; org_id: string; name: string; short_name: string | null; starts_on: string; ends_on: string }
type Org = { id: string; name: string; type: string; parent_id: string | null }
type Wk = { cw: number; mon: Date; locked: boolean; manual: boolean; off: number; hol: string; hs: string; t: number | null; hk: 1 | 2 }
type Cal = { ws: Wk[]; WEEKS: number; HK1: number }
type QRow = { l: L; week: number; wEnd: number; pin: number | null }
type Sch = { it: Item; p: Curriculum | null; rows: QRow[]; start: number; end: number; periods: number; clash: number }

// ===== Lịch năm học =====
const dOf = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
const isoD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const ddmm = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
const fullD = (d: Date) => `${ddmm(d)}/${d.getFullYear()}`
const DOW = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
const shortOf = (h: Hol) => h.short_name || h.name.slice(0, 8)
function makeCal(y: Year, hols: Hol[]): Cal {
  const WEEKS = y.weeks_hk1 + y.weeks_hk2, HK1 = y.weeks_hk1
  const ws: Wk[] = []; let t = 0; const mon = dOf(y.start_date); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7))
  for (let cw = 1; t < WEEKS && cw < 80; cw++) {
    const days = Array.from({ length: 5 }, (_, i) => { const x = new Date(mon); x.setDate(x.getDate() + i); return isoD(x) })
    const hol = hols.filter(h => days.some(d => d >= h.starts_on && d <= h.ends_on))
    const off = days.filter(d => hols.some(h => d >= h.starts_on && d <= h.ends_on)).length
    const manual = y.locks.includes(isoD(mon)); const locked = manual || off >= 3
    if (!locked) t++
    ws.push({ cw, mon: new Date(mon), locked, manual, off, hol: hol.map(h => h.name).join(', '), hs: hol.map(shortOf).join(' · '), t: locked ? null : t, hk: (locked ? t + 1 : t) <= HK1 ? 1 : 2 })
    mon.setDate(mon.getDate() + 7)
  }
  return { ws, WEEKS, HK1 }
}
const dateOfWeek = (cal: Cal, t: number) => { const w = cal.ws.find(x => x.t === t); return w ? ddmm(w.mon) : '' }
function lessonDates(cal: Cal, t0: number, t1: number) { const a = cal.ws.find(x => x.t === t0), b = cal.ws.find(x => x.t === t1); if (!a || !b) return null
  const f = new Date(b.mon); f.setDate(f.getDate() + 4); return { from: a.mon, to: f, skip: cal.ws.filter(x => x.locked && x.cw > a.cw && x.cw < b.cw).length } }

// ===== Xếp lịch một bản phân phối: mỗi môn theo thứ tự bài + bài ghim tuần; bài sau một bài ghim chạy tiếp từ đó =====
function ordered(all: L[], it: Item) { const ord = (it.order ?? []).map(id => all.find(l => l.id === id)).filter(Boolean) as L[]; all.forEach(l => { if (!ord.includes(l)) ord.push(l) }); return ord }
function schedule(items: Item[], lessonsOf: (it: Item) => L[], progOf: (id: string | null) => Curriculum | null, HK1: number): Sch[] {
  const out: Sch[] = []; let prevEnd = 0
  for (const it of items) {
    const ppw = Number(it.ppw) || 1
    const start = it.start === 'hk1' ? 1 : it.start === 'hk2' ? HK1 + 1 : it.start === 'after' ? prevEnd + 1 : Number(String(it.start).replace('w', '')) || 1
    let pos = 0, clash = 0, cum = 0
    const rows = ordered(lessonsOf(it), it).map(l => { const pin = it.pins?.[l.id]
      if (pin) { const np = Math.ceil(Math.max(0, pin - start) * ppw); if (np < pos) clash++; else pos = np }
      const w = start + Math.floor(pos / ppw); pos += l.periods; cum += l.periods
      return { l, week: w, wEnd: Math.max(w, start + Math.ceil(pos / ppw) - 1), pin: pin ?? null } })
    const end = rows.length ? Math.max(...rows.map(r => r.wEnd)) : start - 1; prevEnd = end
    out.push({ it, p: progOf(it.curriculum_id), rows, start, end, periods: cum, clash })
  }
  return out
}
function checks(max: number, items: Item[], sch: Sch[], cal: Cal, sn: (s: string) => string) {
  const err: string[] = [], warn: string[] = []
  sch.forEach(x => { const s = sn(x.it.subject)
    if (x.it.curriculum_id && (!x.p || x.p.status !== 'published')) err.push(`${s}: chương trình không còn ở trạng thái đã phát hành`)
    if (x.end > cal.WEEKS) err.push(`${s} (${x.p?.code ?? ''}): kết thúc tuần ${x.end}, vượt quá ${cal.WEEKS} tuần của năm học`)
    if (x.it.start === 'hk1' && x.end > cal.HK1) warn.push(`${s}: bắt đầu HK I nhưng kéo sang tuần ${x.end} (HK II)`)
    if (x.clash) warn.push(`${s}: ${x.clash} bài có tuần ghim sớm hơn bài trước nên giữ theo thứ tự`)
    const miss = x.rows.filter(r => r.l.mat.s !== 'ok').length; if (miss) warn.push(`${s}: ${miss} bài chưa có học liệu đã phát hành`) })
  for (let w = 1; w <= cal.WEEKS; w++) { const load = sch.filter(x => w >= x.start && w <= x.end).reduce((a, x) => a + (Number(x.it.ppw) || 1), 0); if (load > max) { warn.push(`Tuần ${w}: ${load} tiết, quá ${max} tiết/tuần`); break } }
  const subs = items.map(i => i.subject); if (new Set(subs).size < subs.length) warn.push('Có môn được chọn hai lần')
  return { err, warn }
}

function MatPill({ m }: { m: Mat }) {
  return m.s === 'ok' ? <span className="pill good plain" title={`Phiên bản đang dùng: PB ${m.v}`}>Đủ</span> : m.s === 'draft' ? <span className="pill warn plain" title={`Phiên bản đang dùng: PB ${m.v}`}>Đang soạn</span> : <span className="pill draft plain">Chưa có</span>
}
const GRIP = <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><g fill="currentColor"><circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" /><circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" /><circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" /></g></svg>
function CheckBox({ c }: { c: { err: string[]; warn: string[] } }) {
  return c.err.length || c.warn.length ? <div className="checks">{c.err.map(x => <div key={x} className="chk err"><Ic n="alert" /> <b>Lỗi</b> {x}</div>)}{c.warn.map(x => <div key={x} className="chk warn"><Ic n="info" /> <b>Cảnh báo</b> {x}</div>)}<small>Lỗi chặn phát hành; cảnh báo vẫn cho phát hành.</small></div>
    : <div className="chk ok"><Ic n="check" /> Không có lỗi hay cảnh báo.</div>
}
// Chú thích nổi trên khối bài (giống bản mẫu)
function useTip() {
  const [tip, setTip] = useState<{ x: number; y: number; body: ReactNode } | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { const el = ref.current; if (!tip || !el) return
    const tw = el.offsetWidth, th = el.offsetHeight; let x = tip.x - tw / 2; x = Math.max(8, Math.min(x, innerWidth - tw - 8)); let y = tip.y - th - 8; if (y < 8) y = tip.y + 38
    el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.visibility = 'visible' }, [tip])
  const show = (e: { currentTarget: HTMLElement }, body: ReactNode) => { const r = e.currentTarget.getBoundingClientRect(); setTip({ x: r.left + r.width / 2, y: r.top, body }) }
  const bind = (body: ReactNode) => ({ onMouseEnter: (e: { currentTarget: HTMLElement }) => show(e, body), onFocus: (e: { currentTarget: HTMLElement }) => show(e, body), onMouseLeave: () => setTip(null), onBlur: () => setTip(null) })
  const node = tip ? <div ref={ref} className="ctip" style={{ visibility: 'hidden', left: 0, top: 0 }}>{tip.body}</div> : null
  return { node, bind, hide: () => setTip(null) }
}

// ===== Màn chính =====
type Wiz = { id?: string; school: string; level: string; grade: number | null; progs: string[]; items: Item[]; max: number }
const EMPTY_F = { q: '', school: '', year: '', prog: '', subj: '', status: '', chk: '' }
export function PpctMau({ orgId, go }: { orgId: string | null; go?: (p: string) => void }) {
  const [tab, setTab] = useState<'year' | 'docs'>('docs')
  const [docs, setDocs] = useState<Doc[]>([])
  const [chaps, setChaps] = useState<Chap[]>([])
  const [prows, setPRows] = useState<PRow[]>([])
  const [progs, setProgs] = useState<Curriculum[]>([])
  const [les, setLes] = useState<Map<string, L[]>>(new Map())
  const [matOf, setMatOf] = useState<Map<string, Mat>>(new Map())
  const [year, setYear] = useState<Year | null>(null)
  const [hols, setHols] = useState<Hol[]>([])
  const [open, setOpen] = useState<string | null>(null)
  const [wiz, setWiz] = useState<Wiz | null>(null)
  const [level, setLevel] = useState<string | null>(null)
  const [grade, setGrade] = useState<number | null>(null)
  const [f, setF] = useState(EMPTY_F)
  const [preview, setPreview] = useState('')
  const [msg, setMsg] = useState('')
  const canManage = useRpcBool('curriculum_can_manage')
  const { all, hidden } = useCatalog()
  const { orgs, below } = useOrgs(orgId)
  const cat = effectiveCatalog(all, hidden, below)
  const tip = useTip()

  async function load() {
    const [d, ch, r, c, y, h] = await Promise.all([
      supabase.from('ppct_docs').select('id, org_id, target_org_id, level, subject, grade, school_year, title, status, max_ppw, items, ppw_hk1, updated_at').order('grade').order('title'),
      supabase.from('ppct_chapters').select('id, doc_id, semester, seq, curriculum_id, subject, title'),
      supabase.from('ppct_rows').select('id, chapter_id, seq, title, periods, part_label, material_lesson_id'),
      supabase.from('curricula').select('*').order('code'),
      supabase.from('ppct_years').select('*').eq('school_year', SCHOOL_YEAR),
      supabase.from('school_holidays').select('id, org_id, name, short_name, starts_on, ends_on').order('starts_on'),
    ])
    if (d.error) return setMsg(errMsg(d.error.message))
    setDocs((d.data as Doc[]) ?? []); setChaps((ch.data as Chap[]) ?? []); setPRows((r.data as PRow[]) ?? []); setHols((h.data as Hol[]) ?? [])
    const ys = (y.data as Year[]) ?? []
    setYear(ys.find(x => x.org_id === orgId) ?? ys[0] ?? { org_id: orgId ?? '', school_year: SCHOOL_YEAR, start_date: '2026-09-07', weeks_hk1: 18, weeks_hk2: 17, locks: [] })
    const ps = ((c.data as Curriculum[]) ?? []).filter(p => p.status !== 'archived'); setProgs(ps)
    const vids = ps.map(p => p.current_version_id).filter(Boolean) as string[]
    const [cl, ml] = await Promise.all([
      vids.length ? supabase.from('curriculum_lessons').select('id, title, periods, version_id, seq, subject, curriculum_units(seq)').in('version_id', vids) : Promise.resolve({ data: [] }),
      supabase.from('material_lessons').select('id, curriculum_lesson_id, status, version_no'),
    ])
    const mats = new Map<string, Mat>(); const mm = new Map<string, Mat>()
    for (const m of (ml.data as { id: string; curriculum_lesson_id: string | null; status: string; version_no: number }[]) ?? []) {
      const v: Mat = { s: m.status === 'published' ? 'ok' : m.status === 'draft' ? 'draft' : 'none', v: m.version_no }; mm.set(m.id, v)
      if (!m.curriculum_lesson_id || v.s === 'none') continue
      const o = mats.get(m.curriculum_lesson_id); if (!o || (v.s === 'ok' && o.s !== 'ok') || (v.s === o.s && (v.v ?? 0) > (o.v ?? 0))) mats.set(m.curriculum_lesson_id, v)
    }
    setMatOf(mm)
    const map = new Map<string, L[]>()
    type CLr = { id: string; title: string; periods: number; version_id: string; seq: number; subject: string | null; curriculum_units: { seq: number } | null }
    const sorted = ((cl.data as CLr[]) ?? []).filter(x => x.subject).sort((a, b) => (a.curriculum_units?.seq ?? 9999) - (b.curriculum_units?.seq ?? 9999) || a.seq - b.seq)
    for (const x of sorted) { const p = ps.find(q => q.current_version_id === x.version_id); if (!p) continue
      const k = p.id + '|' + x.subject; const arr = map.get(k) ?? []; arr.push({ id: x.id, title: x.title, periods: Math.max(1, x.periods || 1), mat: mats.get(x.id) ?? { s: 'none', v: null }, cl: x.id }); map.set(k, arr) }
    setLes(map)
  }
  useEffect(() => { load() }, [orgId])

  const schools = orgs.filter(o => o.type === 'school')
  const orgById = (id: string | null) => orgs.find(o => o.id === id)
  const sn = (s: string) => catName(cat, 'subject', s) || s
  const progOf = (id: string | null) => progs.find(p => p.id === id) ?? null
  // Lịch nghỉ của một trường: toàn tỉnh (đơn vị không phải trường) + riêng của trường đó
  const holsFor = (school: string) => { const xs = hols.filter(h => orgById(h.org_id)?.type !== 'school' || h.org_id === school).sort((a, b) => Number(!!b.short_name) - Number(!!a.short_name))
    return xs.filter((h, i) => !xs.some((x, j) => j < i && x.name === h.name && x.starts_on === h.starts_on)) }
  const calFor = (school: string) => makeCal(year ?? { org_id: '', school_year: SCHOOL_YEAR, start_date: '2026-09-07', weeks_hk1: 18, weeks_hk2: 17, locks: [] }, holsFor(school))
  // Bản cũ chưa có lịch xếp: dựng từ các khối lịch (chương) đã có, gộp theo chương trình · môn
  const itemsOf = (d: Doc): Item[] => { if (d.items?.length) return d.items
    const out: Item[] = []
    chaps.filter(c => c.doc_id === d.id).sort((a, b) => a.semester - b.semester || a.seq - b.seq).forEach(c => { const subject = c.subject ?? d.subject ?? ''
      const o = out.find(i => i.curriculum_id === c.curriculum_id && i.subject === subject)
      if (o) o.chapter_ids!.push(c.id); else out.push({ curriculum_id: c.curriculum_id, subject, start: out.length ? 'after' : 'hk1', ppw: Number(d.ppw_hk1) || 1, chapter_ids: [c.id] }) })
    return out }
  const lessonsOf = (it: Item): L[] => {
    const cur = it.curriculum_id ? les.get(it.curriculum_id + '|' + it.subject) : undefined
    if (cur?.length || !it.chapter_ids?.length) return cur ?? []
    const ord = (id: string) => it.chapter_ids!.indexOf(id)
    return prows.filter(r => it.chapter_ids!.includes(r.chapter_id)).sort((a, b) => ord(a.chapter_id) - ord(b.chapter_id) || a.seq - b.seq)
      .map(r => ({ id: r.id, title: r.title + (r.part_label ? ` (${r.part_label})` : ''), periods: Math.max(1, r.periods), mat: (r.material_lesson_id && matOf.get(r.material_lesson_id)) || { s: 'none', v: null }, cl: null }))
  }
  const docState = (d: Doc) => { const cal = calFor(d.target_org_id ?? ''); const items = itemsOf(d); const sch = schedule(items, lessonsOf, progOf, cal.HK1)
    return { cal, items, sch, c: checks(Number(d.max_ppw) || 3, items, sch, cal, sn) } }
  const states = useMemo(() => new Map(docs.map(d => [d.id, docState(d)])), [docs, chaps, prows, les, year, hols, orgs.length, progs])
  const openMat = (l: L) => { if (!l.cl) return; try { sessionStorage.setItem(OPEN_LESSON_KEY, l.cl) } catch { /* bỏ qua */ } go?.('Học liệu') }

  // ----- lưu năm học, lịch nghỉ -----
  async function saveYear(p: Partial<Year>) {
    if (!year || !orgId) return
    const nx = { ...year, ...p, org_id: year.org_id || orgId }; setYear(nx)
    const { id, ...row } = nx
    const r = id ? await supabase.from('ppct_years').update(row).eq('id', id) : await supabase.from('ppct_years').insert(row).select('id').single()
    if (r.error) return setMsg(errMsg(r.error.message))
    if (!id && r.data) setYear({ ...nx, id: (r.data as { id: string }).id })
  }
  async function holRun(p: PromiseLike<{ error: { message: string } | null }>) { const { error } = await p; if (error) setMsg(errMsg(error.message)); else { setMsg(''); const h = await supabase.from('school_holidays').select('id, org_id, name, short_name, starts_on, ends_on').order('starts_on'); setHols((h.data as Hol[]) ?? []) } }
  function toggleLock(mon: string) {
    if (!year) return; const w = calFor(preview).ws.find(x => isoD(x.mon) === mon)
    if (year.locks.includes(mon)) saveYear({ locks: year.locks.filter(x => x !== mon) })
    else if (w?.locked) setMsg('Tuần nghỉ lễ — sửa ở bảng lịch nghỉ')
    else saveYear({ locks: [...year.locks, mon] })
  }

  // ----- lưu bản phân phối -----
  async function saveDoc(w: Wiz, status: string) {
    if (!orgId || w.grade == null) return
    const cal = calFor(w.school); const sch = schedule(w.items, lessonsOf, progOf, cal.HK1)
    if (status === 'published' && checks(w.max, w.items, sch, cal, sn).err.length) return setMsg('Còn lỗi — sửa trước khi phát hành')
    const row = { org_id: orgId, target_org_id: w.school || null, level: w.level || levelOfGrade(cat, w.grade), subject: null, grade: w.grade, school_year: SCHOOL_YEAR,
      title: `Phân phối khối ${w.grade} – ${w.school ? orgById(w.school)?.name ?? '' : 'tất cả trường'}`, max_ppw: w.max, items: w.items, status,
      weeks_hk1: year?.weeks_hk1 ?? 18, weeks_hk2: year?.weeks_hk2 ?? 17, ppw_hk1: Math.max(0.5, ...w.items.map(i => Number(i.ppw) || 1)), ppw_hk2: Math.max(0.5, ...w.items.map(i => Number(i.ppw) || 1)),
      issuer: orgById(orgId)?.name ?? null }
    const r = w.id ? await supabase.from('ppct_docs').update(row).eq('id', w.id).select('id').single() : await supabase.from('ppct_docs').insert(row).select('id').single()
    if (r.error) return setMsg(errMsg(r.error.message))
    const id = (r.data as { id: string }).id
    const its = w.items.filter(i => i.curriculum_id).map(i => ({ curriculum_id: i.curriculum_id, subject: i.subject }))
    if (its.length) await supabase.rpc('ppct_doc_build', { p_doc: id, p_items: its, p_replace: true })   // giữ chương / dòng bài cho các màn theo dõi
    setMsg(status === 'published' ? 'Đã phát hành bản phân phối.' : 'Đã lưu nháp.'); setWiz(null); await load(); setOpen(id)
  }

  const body = (() => {
    if (wiz) return <Wizard w={wiz} setW={setWiz} cat={cat} schools={schools} progs={progs} les={les} lessonsOf={lessonsOf} progOf={progOf} sn={sn} cal={calFor(wiz.school)}
      yearLine={<YearLine year={year} n={holsFor(wiz.school).length} school={wiz.school ? orgById(wiz.school)?.name : ''} go={() => { setWiz(null); setTab('year') }} />}
      tip={tip} onSave={s => saveDoc(wiz, s)} onBack={() => setWiz(null)} setMsg={setMsg} />
    const d = docs.find(x => x.id === open)
    if (d) return <DocView d={d} st={states.get(d.id) ?? docState(d)} sn={sn} school={d.target_org_id ? orgById(d.target_org_id)?.name ?? '' : 'Tất cả các trường'} canManage={canManage} tip={tip}
      yearLine={<YearLine year={year} n={holsFor(d.target_org_id ?? '').length} school={d.target_org_id ? orgById(d.target_org_id)?.name : ''} go={() => { setOpen(null); setTab('year') }} />}
      onBack={() => setOpen(null)} openMat={openMat} setMsg={setMsg}
      onEdit={() => { const it = itemsOf(d); setWiz({ id: d.id, school: d.target_org_id ?? '', level: d.level ?? levelOfGrade(cat, d.grade), grade: d.grade, progs: [...new Set(it.map(i => i.curriculum_id).filter(Boolean) as string[])], items: it.map(i => ({ ...i })), max: Number(d.max_ppw) || 3 }); setOpen(null) }}
      onPublish={async () => { if (states.get(d.id)?.c.err.length) return setMsg('Còn lỗi — sửa trước khi phát hành'); const { error } = await supabase.from('ppct_docs').update({ status: 'published' }).eq('id', d.id); setMsg(error ? errMsg(error.message) : 'Đã phát hành.'); load() }}
      onCopy={async () => { if (!orgId) return; const { id: _i, updated_at: _u, ...rest } = d; const r = await supabase.from('ppct_docs').insert({ ...rest, org_id: orgId, items: itemsOf(d), title: (d.title ?? '') + ' (bản sao)', status: 'draft', based_on_id: d.id }).select('id').single()
        if (r.error) return setMsg(errMsg(r.error.message)); setMsg('Đã nhân bản.'); await load(); setOpen((r.data as { id: string }).id) }}
      onDelete={async () => { const { error } = await supabase.from('ppct_docs').delete().eq('id', d.id); if (error) return setMsg(errMsg(error.message)); setOpen(null); setMsg('Đã xoá bản phân phối.'); load() }} />
    const flow = <Flow steps={[['year', 'Năm học & lịch nghỉ', `${holsFor('').length} kỳ nghỉ · dùng chung`], ['docs', 'Bản phân phối', `${docs.length} bản · xếp lịch, rà soát, phát hành`]]} value={tab} onChange={t => { setTab(t); setOpen(null) }} />
    if (tab === 'year') return <>
      <PageHead icon="calendar" title="Phân phối chương trình" sub="Năm học và lịch nghỉ dùng chung cho mọi bản phân phối" />{flow}
      {year && <YearView year={year} hols={hols} orgId={orgId} orgs={orgs} schools={schools} canManage={canManage} preview={preview} setPreview={setPreview} cal={calFor(preview)}
        saveYear={saveYear} holRun={holRun} toggleLock={toggleLock} tip={tip} />}</>
    return <DocList docs={docs} states={states} cat={cat} progs={progs} schools={schools} sn={sn} orgById={orgById} flow={flow} canManage={canManage}
      level={level} setLevel={setLevel} grade={grade} setGrade={setGrade} f={f} setF={setF} onOpen={setOpen}
      onNew={() => setWiz({ school: '', level: level ?? '', grade, progs: [], items: [], max: 3 })} />
  })()
  return <Mau>{msg && <p className="msg" role="status" onClick={() => setMsg('')}>{msg}</p>}{body}{tip.node}</Mau>
}

function YearLine({ year, n, school, go }: { year: Year | null; n: number; school?: string; go: () => void }) {
  if (!year) return null
  return <div className="yearline"><Ic n="calendar" /><span><b>Năm học {year.school_year}</b> · bắt đầu {fullD(dOf(year.start_date))} · HK I {year.weeks_hk1} tuần · HK II {year.weeks_hk2} tuần · lịch nghỉ {school ? 'toàn tỉnh + ' + school : 'toàn tỉnh'} ({n} kỳ)</span>
    <button type="button" className="btn sm" onClick={go}>Xem / sửa lịch nghỉ ›</button></div>
}

// ===== Danh sách: Cấp học › Khối → bản phân phối =====
type St = { cal: Cal; items: Item[]; sch: Sch[]; c: { err: string[]; warn: string[] } }
function DocList({ docs, states, cat, progs, schools, sn, orgById, flow, canManage, level, setLevel, grade, setGrade, f, setF, onOpen, onNew }: {
  docs: Doc[]; states: Map<string, St>; cat: CatItem[]; progs: Curriculum[]; schools: Org[]; sn: (s: string) => string; orgById: (id: string | null) => Org | undefined; flow: ReactNode; canManage: boolean
  level: string | null; setLevel: (v: string | null) => void; grade: number | null; setGrade: (v: number | null) => void; f: typeof EMPTY_F; setF: (v: typeof EMPTY_F) => void; onOpen: (id: string) => void; onNew: () => void
}) {
  const levels = catOf(cat, 'level').filter(l => gradesOfLevel(cat, l.code).length)
  const lv = levels.find(l => l.code === level)
  const st = (d: Doc) => states.get(d.id)
  const chkOf = (d: Doc) => { const c = st(d)?.c; return c?.err.length ? 'err' : c?.warn.length ? 'warn' : 'ok' }
  const subsOf = (d: Doc) => st(d)?.items ?? []
  const qq = norm(f.q)
  const filtered = Object.values(f).some(Boolean)
  const match = (d: Doc) => (!qq || norm(d.title ?? '').includes(qq)) && (!f.school || (f.school === '_all' ? !d.target_org_id : d.target_org_id === f.school)) && (!f.year || d.school_year === f.year)
    && (!f.prog || subsOf(d).some(i => i.curriculum_id === f.prog)) && (!f.subj || subsOf(d).some(i => i.subject === f.subj)) && (!f.status || d.status === f.status) && (!f.chk || chkOf(d) === f.chk)
    && (!level || gradesOfLevel(cat, level).includes(d.grade)) && (grade == null || d.grade === grade)
  const head = <PageHead icon="calendar" title="Phân phối chương trình" sub="Chọn khối, lấy chương trình và môn phù hợp, xếp lịch theo Học kỳ › Tuần">
    {canManage && <button type="button" className="btn primary" onClick={onNew}><Ic n="plus" /> Thiết lập phân phối</button>}</PageHead>
  const stats = <div className="stats">
    <StatCard c="c-blue" icon="calendar" label="Bản phân phối" value={docs.length} sub={`năm học ${SCHOOL_YEAR}`} />
    <StatCard c="c-green" icon="send" label="Đã phát hành" value={docs.filter(d => d.status === 'published').length} sub="trường đang áp dụng" />
    <StatCard c="c-violet" icon="list" label="Môn được xếp" value={docs.reduce((a, d) => a + subsOf(d).length, 0)} sub="trên mọi bản phân phối" />
    <StatCard c="c-amber" icon="alert" label="Cần rà soát" value={docs.filter(d => st(d)?.c.warn.length).length} sub="bản có cảnh báo" /></div>
  const years = Array.from(new Set([SCHOOL_YEAR, ...docs.map(d => d.school_year)])).sort()
  const subjOpts = Array.from(new Set(docs.flatMap(d => subsOf(d).map(i => i.subject)).filter(Boolean))).map(s => [s, sn(s)] as [string, string])
  const tb = <div className="toolbar"><Search value={f.q} onChange={q => setF({ ...f, q })} placeholder="Tìm bản phân phối…" />
    <Sel label="Tất cả trường" value={f.school} onChange={v => setF({ ...f, school: v })} options={[['_all', 'Tất cả các trường (bản chung)'], ...schools.map(s => [s.id, s.name] as [string, string])]} />
    <Sel label="Mọi năm học" value={f.year} onChange={v => setF({ ...f, year: v })} options={years.map(y => [y, y])} />
    <Sel label="Tất cả cấp học" value={level ?? ''} onChange={v => { setLevel(v || null); if (grade != null && v && levelOfGrade(cat, grade) !== v) setGrade(null) }} options={levels.map(l => [l.code, l.name])} />
    <Sel label="Tất cả khối" value={grade == null ? '' : String(grade)} onChange={v => { const g = v ? Number(v) : null; setGrade(g); if (g != null) setLevel(levelOfGrade(cat, g)) }}
      options={(lv ? gradesOfLevel(cat, lv.code) : levels.flatMap(l => gradesOfLevel(cat, l.code))).map(g => [String(g), 'Khối ' + g])} />
    <Sel label="Tất cả chương trình" value={f.prog} onChange={v => setF({ ...f, prog: v })} options={progs.map(p => [p.id, `${p.code ?? ''} · ${p.name}`])} />
    <Sel label="Tất cả môn học" value={f.subj} onChange={v => setF({ ...f, subj: v })} options={subjOpts} />
    <Sel label="Mọi trạng thái" value={f.status} onChange={v => setF({ ...f, status: v })} options={[['draft', 'Nháp'], ['published', 'Đã phát hành'], ['archived', 'Ngừng dùng']]} />
    <Sel label="Mọi kết quả kiểm tra" value={f.chk} onChange={v => setF({ ...f, chk: v })} options={[['err', 'Có lỗi'], ['warn', 'Có cảnh báo'], ['ok', 'Hợp lệ']]} />
    {(filtered || level) && <button type="button" className="btn sm ghost" onClick={() => { setF(EMPTY_F); setLevel(null); setGrade(null) }}>Xoá lọc</button>}</div>
  const crumbs = <div className="crumbs"><button type="button" onClick={() => { setLevel(null); setGrade(null) }}>Tất cả cấp học</button>
    {lv && <><span>›</span><button type="button" onClick={() => setGrade(null)}>{lv.name}</button></>}{grade != null && <><span>›</span><b>Khối {grade}</b></>}</div>
  const docRow = (d: Doc) => { const c = st(d)?.c ?? { err: [], warn: [] }
    return <tr key={d.id} onClick={() => onOpen(d.id)} style={{ cursor: 'pointer' }}>
      <td><b>{d.title}</b><br /><small style={{ color: 'var(--muted)' }}>Khối {d.grade} · {d.school_year}</small></td>
      <td>{d.target_org_id ? orgById(d.target_org_id)?.name : 'Tất cả các trường'}</td>
      <td>{subsOf(d).map((i, k) => <Fragment key={k}>{k > 0 && <br />}{progs.find(p => p.id === i.curriculum_id)?.code ?? '—'} · {sn(i.subject)}</Fragment>)}</td>
      <td>{c.err.length > 0 && <span className="pill" style={{ background: 'var(--bad-bg)', color: 'var(--bad)' }}>{c.err.length} lỗi</span>} {c.warn.length ? <span className="pill warn">{c.warn.length} cảnh báo</span> : !c.err.length ? <span className="pill good">Hợp lệ</span> : null}</td>
      <td><StatusPill s={d.status} /></td></tr> }
  const table = (ds: Doc[]) => <div className="panel" style={{ padding: 0 }}><div className="tblwrap"><table><thead><tr><th>Bản phân phối</th><th>Áp dụng</th><th>Chương trình · môn</th><th>Kiểm tra</th><th>Trạng thái</th></tr></thead><tbody>{ds.map(docRow)}</tbody></table></div></div>
  if (filtered) { const ds = docs.filter(match); return <>{head}{flow}{stats}{tb}{ds.length ? table(ds) : <Empty>Không có bản phân phối phù hợp bộ lọc.</Empty>}</> }
  if (grade != null) { const ds = docs.filter(d => d.grade === grade)
    return <>{head}{flow}{stats}{tb}{crumbs}{ds.length ? table(ds) : <Empty>Khối {grade} chưa có bản phân phối. {canManage && <button type="button" className="btn sm primary" onClick={onNew}><Ic n="plus" /> Thiết lập phân phối</button>}</Empty>}</> }
  return <>{head}{flow}{stats}{tb}{crumbs}
    {(lv ? [lv] : levels).map(l => { const gs = gradesOfLevel(cat, l.code)
      return <Fragment key={l.code}><div className="group">{l.name} <small>{docs.filter(d => gs.includes(d.grade)).length} bản</small></div>
        <div className="grid g6">{gs.map(g => { const ds = docs.filter(d => d.grade === g); const ps = progs.filter(p => p.status === 'published' && p.grades.includes(g))
          return <button type="button" key={g} className={'pcard gcard' + (ds.length ? '' : ' dim')} style={cssVar(ds.length ? 'var(--primary)' : 'var(--faint)')} onClick={() => { setGrade(g); setLevel(l.code) }}>
            <span className="gno">{g}</span><div><b>Khối {g}</b><small>{ds.length ? ds.length + ' bản phân phối' : 'chưa phân phối'} · {ps.length} chương trình</small></div></button> })}</div></Fragment> })}</>
}

// ===== Lịch theo học kỳ: Tháng · Tuần · Ngày · Nghỉ lễ; mỗi môn một hàng, mỗi bài một khối (kéo thả khi soạn) =====
type Dnd = { lesson: (k: number, id: string) => void; row: (k: number) => void; dropLesson: (k: number, id: string) => void; dropWeek: (k: number, t: number) => void; unpin: (k: number, id: string) => void; ok: (k: number, id?: string) => boolean }
const dropProps = (ok: () => boolean, onDrop: () => void) => ({
  onDragOver: (e: DragEvent<HTMLElement>) => { if (ok()) { e.preventDefault(); e.currentTarget.classList.add('dropover') } },
  onDragLeave: (e: DragEvent<HTMLElement>) => e.currentTarget.classList.remove('dropover'),
  onDrop: (e: DragEvent<HTMLElement>) => { e.preventDefault(); e.stopPropagation(); document.querySelectorAll('.dropover').forEach(x => x.classList.remove('dropover')); if (ok()) onDrop() },
})
const dragProps = (start: () => void, hide: () => void) => ({ draggable: true,
  onDragStart: (e: DragEvent<HTMLElement>) => { start(); hide(); e.currentTarget.classList.add('dragging'); try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'x') } catch { /* bỏ qua */ } },
  onDragEnd: (e: DragEvent<HTMLElement>) => { e.currentTarget.classList.remove('dragging'); document.querySelectorAll('.dropover').forEach(x => x.classList.remove('dropover')) } })
function WeekStrip({ sch, cal, sn, dnd, lockable, onLock, tip, yearBtn }: { sch: Sch[]; cal: Cal; sn: (s: string) => string; dnd?: Dnd; lockable?: boolean; onLock?: (mon: string) => void; tip: ReturnType<typeof useTip>; yearBtn?: () => void }) {
  const editable = !!dnd
  const lessonTip = (r: Sch, q: QRow, i: number) => { const dt = lessonDates(cal, q.week, q.wEnd); const m = q.l.mat
    return <><b>Bài {i + 1}: {q.l.title}</b><span>{sn(r.it.subject)} · {r.p?.code ?? ''}</span>
      <dl><dt>Số tiết</dt><dd>{q.l.periods} tiết</dd><dt>Tuần học</dt><dd>Tuần {q.week}{q.wEnd > q.week ? '–' + q.wEnd : ''} · {q.week <= cal.HK1 ? 'HK I' : 'HK II'}</dd>
        <dt>Học từ</dt><dd>{dt ? <>{DOW[dt.from.getDay()]} {fullD(dt.from)} – {DOW[dt.to.getDay()]} {fullD(dt.to)}{dt.skip ? <em> (qua {dt.skip} tuần nghỉ)</em> : null}</> : 'ngoài năm học'}</dd>
        <dt>Học liệu</dt><dd>{m.s === 'ok' ? 'Đủ · PB ' + m.v : m.s === 'draft' ? 'Đang soạn · PB ' + m.v : 'Chưa có'}</dd></dl>
      {q.pin ? <small>Đã ghim vào tuần {q.pin}{editable ? ' — bấm đúp để bỏ ghim' : ''}</small> : editable ? <small>Kéo sang tuần khác để ghim</small> : null}</> }
  const block = (hk: 1 | 2) => { const ws = cal.ws.filter(x => x.hk === hk); if (!ws.length) return null
    const col = new Map(ws.map((x, i) => [x.cw, i + 2]))
    const first = ws[0].mon, last = new Date(ws[ws.length - 1].mon); last.setDate(last.getDate() + 4)
    const months: { k: string; c: number; n: number; d: Date }[] = []; ws.forEach((x, i) => { const k = x.mon.getMonth() + '-' + x.mon.getFullYear(); const m = months[months.length - 1]; if (m && m.k === k) m.n++; else months.push({ k, c: i + 2, n: 1, d: x.mon }) })
    const fri = (x: Wk) => { const f = new Date(x.mon); f.setDate(f.getDate() + 4); return f }
    const gcols = { gridTemplateColumns: `var(--lab) repeat(${ws.length},var(--cw))` }
    const segs = (t0: number, t1: number) => { const out: { c: number; n: number; part: number; parts: number }[] = []; let cur: typeof out[0] | null = null
      ws.forEach(x => { const on = !x.locked && x.t != null && x.t >= t0 && x.t <= t1; if (on) { if (cur) cur.n++; else { cur = { c: col.get(x.cw)!, n: 1, part: 0, parts: 0 }; out.push(cur) } } else cur = null })
      out.forEach((g, i) => { g.part = i; g.parts = out.length }); return out }
    const lanesOf = (r: Sch) => { const lane = new Map<string, number>(); const ends: number[] = []
      r.rows.forEach(q => segs(q.week, q.wEnd).forEach((sg, si) => { let k = ends.findIndex(e => e < sg.c); if (k < 0) { k = ends.length; ends.push(0) } ends[k] = sg.c + sg.n - 1; lane.set(q.l.id + '|' + si, k) }))
      return { lane, n: Math.max(1, ends.length) } }
    const holW = ws.filter(x => x.hol || x.manual)
    return <div className="hkblock" key={hk}><div className="hktitle"><b>Học kỳ {hk === 1 ? 'I' : 'II'}</b><small>{fullD(first)} – {fullD(last)} · {ws.filter(x => !x.locked).length} tuần học{ws.some(x => x.locked) ? ' · ' + ws.filter(x => x.locked).length + ' tuần nghỉ' : ''}</small></div>
      <div className="tblwrap"><div className="cal">
        <div className="crow chead" style={gcols}><span className="clab">Tháng</span>{months.map(m => <div key={m.k} className="cmonth" style={{ gridColumn: `${m.c}/span ${m.n}` }}>Tháng {m.d.getMonth() + 1}/{m.d.getFullYear()}</div>)}</div>
        <div className="crow chead" style={gcols}><span className="clab">Tuần học</span>{ws.map(x => <button type="button" key={x.cw} className={'cweek' + (x.locked ? ' lk' : '')} style={{ gridColumn: col.get(x.cw) }} disabled={!lockable}
          onClick={() => onLock?.(isoD(x.mon))} title={x.locked ? 'Tuần nghỉ' + (x.hol ? ': ' + x.hol : ' (khoá tay)') + (lockable ? ' — bấm để mở khoá' : '') : 'Tuần học ' + x.t + (lockable ? ' — bấm để khoá tuần này' : '')}>{x.locked ? <Ic n="lock" cls="i lk" /> : x.t}</button>)}</div>
        <div className="crow chead" style={gcols}><span className="clab">Ngày (T2–T6)</span>{ws.map(x => <div key={x.cw} className={'cday' + (x.locked ? ' lk' : '')} style={{ gridColumn: col.get(x.cw) }}>{String(x.mon.getDate()).padStart(2, '0')}<small>–{String(fri(x).getDate()).padStart(2, '0')}</small></div>)}</div>
        {holW.length > 0 && <div className="crow chead" style={gcols}><span className="clab">Nghỉ lễ</span>{holW.map(x => <div key={x.cw} className={'chol ' + (x.locked ? 'full' : 'part')} style={{ gridColumn: col.get(x.cw) }}
          title={(x.hol || 'Khoá tay') + (x.locked ? ' — cả tuần nghỉ' : ' — nghỉ ' + x.off + ' ngày, vẫn xếp tiết')}>{x.hs || 'Khoá'}</div>)}</div>}
        {sch.map((r, k) => { const L = lanesOf(r)
          return <div key={k} className="crow cbody" style={{ ...gcols, gridTemplateRows: `repeat(${L.n},30px)` }}>
            <span className="clab" {...(dnd ? { ...dragProps(() => dnd.row(k), tip.hide), title: 'Kéo để dời cả môn sang tuần khác' } : {})}>{dnd && GRIP}<b>{sn(r.it.subject)}</b><small>{r.p?.code}</small></span>
            {ws.map(x => <div key={x.cw} className={'ccell' + (x.locked ? ' lk' : '') + (x.off && !x.locked ? ' hol' : '')} style={{ gridColumn: col.get(x.cw), gridRow: `1/span ${L.n}` }}
              {...(dnd && !x.locked && x.t != null ? dropProps(() => dnd.ok(k), () => dnd.dropWeek(k, x.t!)) : {})} />)}
            {r.rows.flatMap((q, i) => segs(q.week, q.wEnd).map((sg, si) => <div key={q.l.id + si}
              className={`clesson c${k % 4}${q.pin ? ' pinned' : ''}${sg.parts > 1 ? ' ' + (sg.part ? 'cont' : 'brk') + (sg.part && sg.part < sg.parts - 1 ? ' brk' : '') : ''}`}
              style={{ gridColumn: `${sg.c}/span ${sg.n}`, gridRow: (L.lane.get(q.l.id + '|' + si) ?? 0) + 1 }} tabIndex={0} aria-label={`Bài ${i + 1}: ${q.l.title}, ${q.l.periods} tiết`}
              {...tip.bind(lessonTip(r, q, i))}
              {...(dnd ? { ...dragProps(() => dnd.lesson(k, q.l.id), tip.hide), ...dropProps(() => dnd.ok(k, q.l.id), () => dnd.dropLesson(k, q.l.id)), onDoubleClick: () => q.pin && dnd.unpin(k, q.l.id) } : {})}>
              <span>{sg.part ? '↳ ' : ''}{sg.n > 1 ? `${i + 1}. ${q.l.title}${sg.part ? ' (tiếp)' : ''}` : i + 1}</span>{q.pin ? <Ic n="pin" cls="i pin" /> : null}</div>))}
          </div> })}
      </div></div></div> }
  const over = sch.filter(r => r.end > cal.WEEKS)
  return <>{block(1)}{block(2)}<div className="legend"><span><i className="lkdot" />Tuần nghỉ (khoá) — lịch tự bỏ qua</span><span><i className="hdot" />Tuần có ngày nghỉ lẻ — vẫn xếp tiết</span><span><i className="pdot" />Bài đã ghim tuần</span>
    {editable && <span>Kéo khối bài sang tuần khác để ghim · kéo lên khối bài khác để đổi thứ tự · kéo tên môn để dời cả môn</span>}
    {lockable ? <span>Bấm số tuần để khoá / mở khoá cả tuần</span> : yearBtn ? <button type="button" className="btn sm" onClick={yearBtn}><Ic n="calendar" /> Năm học &amp; lịch nghỉ</button> : null}
    {over.length > 0 && <span style={{ color: 'var(--bad)' }}>{over.map(r => sn(r.it.subject) + ' vượt ' + (r.end - cal.WEEKS) + ' tuần').join(', ')}</span>}</div></>
}

// ===== Năm học & lịch nghỉ =====
function YearView({ year, hols, orgId, orgs, schools, canManage, preview, setPreview, cal, saveYear, holRun, toggleLock, tip }: {
  year: Year; hols: Hol[]; orgId: string | null; orgs: Org[]; schools: Org[]; canManage: boolean; preview: string; setPreview: (v: string) => void; cal: Cal
  saveYear: (p: Partial<Year>) => void; holRun: (p: PromiseLike<{ error: { message: string } | null }>) => void; toggleLock: (mon: string) => void; tip: ReturnType<typeof useTip>
}) {
  const start = dOf(year.start_date); const endW = new Date(start); endW.setDate(endW.getDate() + 7 * 60)
  const inYear = hols.filter(h => h.ends_on >= isoD(start) && h.starts_on <= isoD(endW)).sort((a, b) => Number(b.org_id === orgId) - Number(a.org_id === orgId) || a.starts_on.localeCompare(b.starts_on))
  const typeOf = (id: string) => orgs.find(o => o.id === id)?.type
  const scopeOf = (h: Hol) => typeOf(h.org_id) === 'school' ? h.org_id : ''
  const shown = inYear.filter((h, i) => !inYear.some((x, j) => j < i && x.name === h.name && x.starts_on === h.starts_on && scopeOf(x) === scopeOf(h))).sort((a, b) => a.starts_on.localeCompare(b.starts_on))
  const upd = (h: Hol, p: Partial<Hol>) => holRun(supabase.from('school_holidays').update(p).eq('id', h.id))
  const ro = !canManage
  return <>
    <Panel icon="calendar" title={`Năm học ${year.school_year}`} act={<span style={{ color: 'var(--muted)', fontSize: 12.5 }}>Áp dụng cho mọi bản phân phối của {orgs.find(o => o.id === orgId)?.name ?? 'đơn vị'}</span>}>
      <div className="form"><label className="fld"><span>Ngày bắt đầu năm học</span><input type="date" disabled={ro} value={year.start_date} onChange={e => e.target.value && saveYear({ start_date: e.target.value })} /></label>
        <label className="fld"><span>Số tuần học HK I</span><input type="number" min={1} disabled={ro} value={year.weeks_hk1} onChange={e => saveYear({ weeks_hk1: Math.max(1, Number(e.target.value) || 1) })} /></label>
        <label className="fld"><span>Số tuần học HK II</span><input type="number" min={1} disabled={ro} value={year.weeks_hk2} onChange={e => saveYear({ weeks_hk2: Math.max(1, Number(e.target.value) || 1) })} /></label></div></Panel>
    <Panel icon="lock" title="Lịch nghỉ" act={<span style={{ color: 'var(--muted)', fontSize: 12.5 }}>Nghỉ toàn tỉnh áp dụng cho mọi trường; nghỉ riêng chỉ cho trường được chọn</span>}>
      <div className="tblwrap"><table><thead><tr><th>Ngày nghỉ</th><th>Tên ngắn trên lịch</th><th>Phạm vi</th><th>Từ ngày</th><th>Đến ngày</th><th></th></tr></thead><tbody>
        {shown.map(h => <tr key={h.id}>
          <td><input defaultValue={h.name} disabled={ro} aria-label="Tên ngày nghỉ" onBlur={e => e.target.value.trim() && e.target.value !== h.name && upd(h, { name: e.target.value.trim() })} /></td>
          <td><input defaultValue={h.short_name ?? ''} disabled={ro} aria-label="Tên ngắn" style={{ width: 100 }} onBlur={e => e.target.value !== (h.short_name ?? '') && upd(h, { short_name: e.target.value || null })} /></td>
          <td><select value={scopeOf(h)} disabled={ro} aria-label="Phạm vi" onChange={e => upd(h, { org_id: e.target.value || orgId! })}><option value="">Toàn tỉnh</option>{schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></td>
          <td><input type="date" value={h.starts_on} disabled={ro} aria-label="Từ ngày" onChange={e => e.target.value && upd(h, { starts_on: e.target.value, ...(e.target.value > h.ends_on ? { ends_on: e.target.value } : {}) })} /></td>
          <td><input type="date" value={h.ends_on} disabled={ro} aria-label="Đến ngày" onChange={e => e.target.value && e.target.value >= h.starts_on && upd(h, { ends_on: e.target.value })} /></td>
          <td>{!ro && <button type="button" className="btn sm ghost" aria-label="Xoá" onClick={() => holRun(supabase.from('school_holidays').delete().eq('id', h.id))}><Ic n="trash" /></button>}</td></tr>)}
        <tr className="addrow"><td colSpan={6}>{!ro && orgId && <button type="button" className="btn sm" onClick={() => holRun(supabase.from('school_holidays').insert({ org_id: orgId, name: 'Nghỉ giữa kỳ', short_name: 'Giữa kỳ', starts_on: '2026-11-16', ends_on: '2026-11-20' }))}><Ic n="plus" /> Ngày nghỉ</button>}{' '}
          <small style={{ color: 'var(--muted)' }}>Tuần có từ 3 ngày nghỉ (thứ Hai – thứ Sáu) bị khoá, lịch tự bỏ qua; tuần nghỉ lẻ vẫn xếp tiết.</small></td></tr></tbody></table></div></Panel>
    <Panel icon="grid" title="Xem trước lịch năm học" act={<select value={preview} onChange={e => setPreview(e.target.value)} aria-label="Xem lịch của"><option value="">Toàn tỉnh</option>{schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>}>
      <WeekStrip sch={[]} cal={cal} sn={s => s} lockable={canManage} onLock={toggleLock} tip={tip} /></Panel>
  </>
}

// ===== Thiết lập phân phối (wizard 0–5) =====
let DRAG: { t: 'les' | 'row'; k: number; id?: string } | null = null
function Wizard({ w, setW, cat, schools, progs, les, lessonsOf, progOf, sn, cal, yearLine, tip, onSave, onBack, setMsg }: {
  w: Wiz; setW: (w: Wiz) => void; cat: CatItem[]; schools: Org[]; progs: Curriculum[]; les: Map<string, L[]>; lessonsOf: (it: Item) => L[]; progOf: (id: string | null) => Curriculum | null
  sn: (s: string) => string; cal: Cal; yearLine: ReactNode; tip: ReturnType<typeof useTip>; onSave: (s: string) => void; onBack: () => void; setMsg: (m: string) => void
}) {
  const levels = catOf(cat, 'level').filter(l => gradesOfLevel(cat, l.code).length)
  const grades = w.level ? gradesOfLevel(cat, w.level) : []
  const subjOf = (pid: string) => Array.from(les.keys()).filter(k => k.startsWith(pid + '|')).map(k => k.slice(pid.length + 1))
  const ok = w.grade != null ? progs.filter(p => p.status === 'published' && p.grades.includes(w.grade!) && subjOf(p.id).length) : []
  const sch = schedule(w.items, lessonsOf, progOf, cal.HK1); const c = checks(w.max, w.items, sch, cal, sn)
  const set = (p: Partial<Wiz>) => setW({ ...w, ...p })
  const setItems = (items: Item[]) => set({ items })
  const sum = (ls: L[]) => ls.reduce((a, l) => a + l.periods, 0)
  const toggleProg = (pid: string, on: boolean) => on
    ? set({ progs: [...w.progs, pid], items: [...w.items, ...subjOf(pid).map((s, i) => ({ curriculum_id: pid, subject: s, start: w.items.length || i ? 'after' : 'hk1', ppw: 1 }))] })
    : set({ progs: w.progs.filter(x => x !== pid), items: w.items.filter(i => i.curriculum_id !== pid) })
  const moveItem = (from: number, to: number) => { if (to < 0 || to >= w.items.length || from === to) return; const x = [...w.items]; const [m] = x.splice(from, 1); x.splice(to, 0, m)
    if (x[0].start === 'after') x[0] = { ...x[0], start: 'hk1' }; setItems(x); setTimeout(() => (document.querySelector(`[data-grip="${to}"]`) as HTMLElement | null)?.focus()) }
  const patch = (k: number, p: Partial<Item>) => setItems(w.items.map((it, i) => i === k ? { ...it, ...p } : it))
  const ordIds = (k: number) => sch[k].rows.map(q => q.l.id)
  const reorder = (k: number, id: string, beforeId: string | null) => { const ids = ordIds(k).filter(x => x !== id); const at = beforeId ? ids.indexOf(beforeId) : ids.length; ids.splice(at < 0 ? ids.length : at, 0, id)
    const pins = { ...(w.items[k].pins ?? {}) }; delete pins[id]; patch(k, { order: ids, pins }) }
  const unpin = (k: number, id: string) => { const pins = { ...(w.items[k].pins ?? {}) }; delete pins[id]; patch(k, { pins }); setMsg('Đã bỏ ghim') }
  const dropWeek = (k: number, t: number) => { const d = DRAG; DRAG = null; if (!d) return; const it = w.items[k]
    if (d.t === 'les' && d.id) {
      const rows = sch[k].rows; const me = rows.findIndex(q => q.l.id === d.id)
      const at = rows.findIndex(q => t >= q.week && t <= q.wEnd); const prevEnd = me > 0 ? rows[me - 1].wEnd : 0
      let order = it.order; const pins = { ...(it.pins ?? {}) }
      if (at >= 0 && at < me) { const ids = rows.map(q => q.l.id).filter(x => x !== d.id); ids.splice(at, 0, d.id); order = ids
        for (const x of ids.slice(at + 1)) if (pins[x] != null && pins[x] <= t) delete pins[x] }
      else if (t <= prevEnd && at !== me) return setMsg('Tuần đó đang có bài trước — kéo lên khối bài đó để đổi thứ tự')
      pins[d.id] = t; patch(k, { order, pins }); setMsg(`Đã ghim “${rows[me].l.title}” vào tuần ${t} (${dateOfWeek(cal, t)}) — các bài sau chạy tiếp`)
    } else { const delta = t - sch[k].start; const pins = Object.fromEntries(Object.entries(it.pins ?? {}).map(([x, v]) => [x, Math.max(1, v + delta)]))
      patch(k, { start: 'w' + t, pins }); setMsg(`Đã dời ${sn(it.subject)} bắt đầu từ tuần ${t}`) }
  }
  const dnd: Dnd = { lesson: (k, id) => { DRAG = { t: 'les', k, id } }, row: k => { DRAG = { t: 'row', k } }, unpin,
    ok: (k, id) => !!DRAG && DRAG.k === k && (id == null || (DRAG.t === 'les' && DRAG.id !== id)),
    dropLesson: (k, id) => { const d = DRAG; DRAG = null; if (d?.id) reorder(k, d.id, id) }, dropWeek }
  const startSel = (it: Item, k: number) => <select value={it.start} onChange={e => patch(k, { start: e.target.value })} aria-label="Bắt đầu">
    <option value="hk1">Đầu HK I</option><option value="hk2">Đầu HK II</option>{k > 0 && <option value="after">Ngay sau môn trước</option>}
    {Array.from({ length: cal.WEEKS }, (_, i) => <option key={i} value={'w' + (i + 1)}>Tuần {i + 1}</option>)}</select>
  const step = (n: number, title: string, body: ReactNode, off?: boolean, opt?: boolean) => <div className={'wstep' + (off ? ' off' : '')}><span className="wno">{n}</span><div className="wbody"><h3>{title}{opt && <small> không bắt buộc</small>}</h3>{!off && body}</div></div>
  let rowFrom: number | null = null
  return <>
    <button type="button" className="btn sm ghost" onClick={onBack}><Ic n="back" /> Quay lại</button>
    <Panel icon="calendar" title={w.id ? 'Xếp lại lịch phân phối' : 'Thiết lập phân phối chương trình'} act={<span style={{ color: 'var(--muted)', fontSize: 12.5 }}>Chọn đúng khối, hệ thống gợi ý chương trình và môn phù hợp</span>}>
      <div className="wsteps">
        {step(0, 'Trường', <select value={w.school} onChange={e => set({ school: e.target.value })} aria-label="Trường"><option value="">Tất cả các trường</option>{schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>, false, true)}
        {step(1, 'Cấp học', <div className="seg">{levels.map(l => <button type="button" key={l.code} className={w.level === l.code ? 'on' : ''} onClick={() => set({ level: l.code, grade: null, progs: [], items: [] })}>{l.name}</button>)}</div>)}
        {step(2, 'Khối', <div className="gchips">{grades.map(g => <button type="button" key={g} className="gchip" aria-pressed={w.grade === g} onClick={() => set({ grade: g, progs: [], items: [] })}>Khối {g}</button>)}</div>, !w.level)}
        {step(3, 'Chọn chương trình phù hợp', ok.length ? <div className="picks">{ok.map(p => { const ls = subjOf(p.id).flatMap(s => les.get(p.id + '|' + s) ?? []); const on = w.progs.includes(p.id)
          return <label key={p.id} className={'pick' + (on ? ' on' : '')} style={cssVar(p.color)}><input type="checkbox" checked={on} onChange={e => toggleProg(p.id, e.target.checked)} /><span className="code sm">{p.code}</span>
            <span><b>{p.name}</b><small>{subjOf(p.id).length} môn · {ls.length} bài · {sum(ls)} tiết</small></span></label> })}</div>
          : <Empty>Chưa có chương trình đã phát hành áp dụng cho khối {w.grade}.</Empty>, w.grade == null)}
        {step(4, 'Chọn môn', <div className="picks">{w.progs.flatMap(pid => { const p = progOf(pid); return subjOf(pid).map(s => { const on = w.items.some(i => i.curriculum_id === pid && i.subject === s); const ls = les.get(pid + '|' + s) ?? []
          return <label key={pid + s} className={'pick' + (on ? ' on' : '')} style={cssVar(p?.color)}><input type="checkbox" checked={on}
            onChange={e => setItems(e.target.checked ? [...w.items, { curriculum_id: pid, subject: s, start: w.items.length ? 'after' : 'hk1', ppw: 1 }] : w.items.filter(i => !(i.curriculum_id === pid && i.subject === s)))} />
            <span className="code sm">{p?.code}</span><span><b>{sn(s)}</b><small>{ls.length} bài · {sum(ls)} tiết</small></span></label> }) })}</div>, !w.progs.length)}
        {step(5, 'Xếp lịch: Học kỳ › Tuần', <>{yearLine}
          <div className="tblwrap"><table className="dragtbl"><thead><tr><th></th><th>#</th><th>Môn</th><th>Bắt đầu</th><th>Nhịp (tiết/tuần)</th><th>Kết quả</th></tr></thead><tbody>
            {sch.map((x, k) => <tr key={(x.it.curriculum_id ?? '') + x.it.subject + k} draggable onDragStart={e => { rowFrom = k; e.currentTarget.classList.add('dragging'); try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(k)) } catch { /* bỏ qua */ } }}
              onDragEnd={e => { e.currentTarget.classList.remove('dragging'); document.querySelectorAll('.dropover').forEach(z => z.classList.remove('dropover')) }}
              onDragOver={e => { if (rowFrom != null) { e.preventDefault(); e.currentTarget.classList.add('dropover') } }} onDragLeave={e => e.currentTarget.classList.remove('dropover')}
              onDrop={e => { e.preventDefault(); if (rowFrom != null) moveItem(rowFrom, k); rowFrom = null }}>
              <td className="grip"><button type="button" className="griph" data-grip={k} aria-label="Kéo để đổi thứ tự (hoặc Alt + mũi tên lên/xuống)" title="Kéo thả để đổi thứ tự"
                onKeyDown={e => { if (!e.altKey) return; if (e.key === 'ArrowUp') { e.preventDefault(); moveItem(k, k - 1) } if (e.key === 'ArrowDown') { e.preventDefault(); moveItem(k, k + 1) } }}>{GRIP}</button></td>
              <td className="n">{k + 1}</td><td><b>{sn(x.it.subject)}</b> <small style={{ color: 'var(--muted)' }}>{x.p?.code}</small></td><td>{startSel(x.it, k)}</td>
              <td><input type="number" min={0.5} step={0.5} value={x.it.ppw} aria-label="Nhịp" style={{ width: 80 }} onChange={e => patch(k, { ppw: Math.max(0.5, Number(e.target.value) || 1) })} /></td>
              <td>Tuần {x.start}–{x.end} <small style={{ color: 'var(--muted)' }}>({dateOfWeek(cal, x.start)} → {dateOfWeek(cal, Math.min(x.end, cal.WEEKS))})</small> · {x.periods} tiết{x.end > cal.WEEKS && <> <span className="pill" style={{ background: 'var(--bad-bg)', color: 'var(--bad)' }}>ngoài năm học</span></>}</td></tr>)}</tbody></table></div>
          <label className="fld" style={{ maxWidth: 260 }}><span>Tối đa tiết STEM/tuần</span><input type="number" min={1} value={w.max} onChange={e => set({ max: Number(e.target.value) || 1 })} /></label>
          <div className="lesorder"><div className="loh"><b>Thứ tự bài học</b><small>Kéo thả tay nắm để đổi thứ tự (hoặc Alt + ↑/↓). Bài ghim tuần có biểu tượng ghim — bấm ✕ để bỏ ghim.</small></div>
            <div className="logrid">{sch.map((x, k) => <div key={k} className={'lobox c' + (k % 4)}><div className="lotitle"><i /><b>{sn(x.it.subject)}</b><small>{x.p?.code} · {x.rows.length} bài</small></div><ol>
              {x.rows.map((q, i) => <li key={q.l.id} {...dragProps(() => dnd.lesson(k, q.l.id), tip.hide)} {...dropProps(() => dnd.ok(k, q.l.id), () => dnd.dropLesson(k, q.l.id))}>
                <button type="button" className="griph" data-ligrip={`${k}|${q.l.id}`} aria-label="Kéo để đổi thứ tự bài (Alt + mũi tên)"
                  onKeyDown={e => { if (!e.altKey || !['ArrowUp', 'ArrowDown'].includes(e.key)) return; e.preventDefault(); const ids = ordIds(k); const j = e.key === 'ArrowUp' ? i - 1 : i + 1; if (j < 0 || j >= ids.length) return
                    ids.splice(i, 1); ids.splice(j, 0, q.l.id); patch(k, { order: ids }); setTimeout(() => (document.querySelector(`[data-ligrip="${k}|${q.l.id}"]`) as HTMLElement | null)?.focus()) }}>{GRIP}</button>
                <span className="lono">{i + 1}</span><span className="lot">{q.l.title}</span><span className="low">T{q.week}{q.wEnd > q.week ? '–' + q.wEnd : ''}<small>{dateOfWeek(cal, q.week)}</small></span>
                {q.pin && <button type="button" className="pinx" title={`Bỏ ghim tuần ${q.pin}`} onClick={() => unpin(k, q.l.id)}><Ic n="pin" cls="i pin" />✕</button>}</li>)}</ol></div>)}</div></div>
          <WeekStrip sch={sch} cal={cal} sn={sn} dnd={dnd} tip={tip} /><CheckBox c={c} /></>, !w.items.length)}
      </div>
      <div className="formact"><button type="button" className="btn" onClick={() => w.grade != null && w.items.length ? onSave('draft') : setMsg('Chọn khối và ít nhất một môn')}>Lưu nháp</button>
        <button type="button" className="btn primary" disabled={!w.items.length} onClick={() => onSave('published')}><Ic n="send" /> Phát hành</button></div>
    </Panel></>
}

// ===== Bản phân phối =====
function DocView({ d, st, sn, school, canManage, tip, yearLine, onBack, openMat, onEdit, onPublish, onCopy, onDelete, setMsg: _m }: {
  d: Doc; st: St; sn: (s: string) => string; school: string; canManage: boolean; tip: ReturnType<typeof useTip>; yearLine: ReactNode
  onBack: () => void; openMat: (l: L) => void; onEdit: () => void; onPublish: () => void; onCopy: () => void; onDelete: () => void; setMsg: (m: string) => void
}) {
  const [view, setView] = useState<'table' | 'cal'>('table')
  const [shut, setShut] = useState<Set<number>>(new Set())
  const [del, setDel] = useState(false)
  const { sch, cal, c } = st
  const s0 = sch.length ? Math.min(...sch.map(x => x.start)) : 0, s1 = sch.length ? Math.max(...sch.map(x => x.end)) : 0
  const tot = sch.reduce((a, x) => a + x.periods, 0)
  const h1 = sch.reduce((a, x) => a + x.rows.filter(r => r.week <= cal.HK1).reduce((b, r) => b + r.l.periods, 0), 0)
  const allShut = sch.length > 0 && sch.every((_, k) => shut.has(k))
  return <>
    <button type="button" className="btn sm ghost" onClick={onBack}><Ic n="back" /> Quay lại</button>
    <div className="dhead"><span className="code" style={cssVar('var(--primary)')}>K{d.grade}</span><div><h1>{d.title}</h1><span className="crumb">Áp dụng: {school} · năm học {d.school_year} · tối đa {Number(d.max_ppw) || 3} tiết STEM/tuần · cập nhật {new Date(d.updated_at).toLocaleDateString('vi-VN')}</span></div><StatusPill s={d.status} />
      {canManage && <div className="act">{d.status !== 'published' && <button type="button" className="btn primary" onClick={onPublish}><Ic n="send" /> Phát hành</button>}
        <button type="button" className="btn" onClick={onEdit}><Ic n="edit" /> Xếp lại lịch</button><button type="button" className="btn" onClick={onCopy}><Ic n="copy" /> Nhân bản</button>
        <button type="button" className="btn ghost" aria-label="Xoá bản phân phối" onClick={() => setDel(true)}><Ic n="trash" /></button></div>}</div>
    {del && <Confirm danger text={`Xoá “${d.title}”? Không hoàn tác được.`} yes="Xoá" onYes={onDelete} onNo={() => setDel(false)} />}
    <div className="stats">
      <StatCard c="c-blue" icon="book" label="Môn học" value={sch.length} sub={sch.map(x => sn(x.it.subject)).join(', ') || '—'} />
      <StatCard c="c-violet" icon="calendar" label="Số tuần" value={sch.length ? s1 - s0 + 1 : 0} sub={sch.length ? `tuần ${s0}–${s1} · ${dateOfWeek(cal, s0)} → ${dateOfWeek(cal, Math.min(s1, cal.WEEKS))}` : '—'} />
      <StatCard c="c-green" icon="list" label="Số tiết" value={tot} sub={`HK I ${h1} · HK II ${tot - h1} tiết`} />
      <StatCard c="c-amber" icon="file" label="Bài học" value={sch.reduce((a, x) => a + x.rows.length, 0)} sub={sch.reduce((a, x) => a + x.rows.filter(r => r.l.mat.s === 'ok').length, 0) + ' bài đủ học liệu'} /></div>
    <CheckBox c={c} />
    <div className="toolbar"><Seg label="Kiểu xem" items={[['table', 'Bảng'], ['cal', 'Lịch']]} value={view} onChange={setView} /></div>
    {view === 'cal' ? <Panel>{yearLine}<WeekStrip sch={sch} cal={cal} sn={sn} tip={tip} /><p className="note">Muốn kéo thả bài trên lịch: bấm “Xếp lại lịch”.</p></Panel> : <>
      <div className="toolbar" style={{ justifyContent: 'flex-end', marginTop: -4 }}><button type="button" className="btn sm ghost" onClick={() => setShut(allShut ? new Set() : new Set(sch.map((_, k) => k)))}>{allShut ? 'Mở tất cả' : 'Thu gọn tất cả'}</button></div>
      {!sch.length && <Empty>Bản phân phối chưa có môn. {canManage && 'Bấm “Xếp lại lịch” để chọn chương trình và môn.'}</Empty>}
      {sch.map((x, k) => { const p1 = x.rows.filter(r => r.week <= cal.HK1).reduce((a, r) => a + r.l.periods, 0), okN = x.rows.filter(r => r.l.mat.s === 'ok').length
        return <details key={k} className="panel dsub" style={{ padding: 0, gap: 0 }} open={!shut.has(k)} onToggle={e => { const o = (e.currentTarget as HTMLDetailsElement).open; setShut(s => { const n = new Set(s); if (o) n.delete(k); else n.add(k); return n }) }}>
          <summary className="phead" style={cssVar(x.p?.color)}><span className="chev"><Ic n="chev" /></span><span className="code sm">{x.p?.code ?? '—'}</span><b>{sn(x.it.subject)}</b>
            <small>{x.rows.length} bài · tuần {x.start}–{x.end} ({dateOfWeek(cal, x.start)} → {dateOfWeek(cal, Math.min(x.end, cal.WEEKS))}) · {x.it.ppw} tiết/tuần · {x.periods} tiết</small></summary>
          <div className="tblwrap"><table><thead><tr><th>STT</th><th>Bài học</th><th>Tuần</th><th>Học kỳ</th><th>Tiết</th><th>Học liệu</th></tr></thead>
            <tbody>{x.rows.map((r, i) => <tr key={r.l.id}><td className="n">{i + 1}</td><td><b>{r.l.title}</b>{r.pin ? <> <Ic n="pin" cls="i pinmini" /></> : null}</td>
              <td>{r.week === r.wEnd ? r.week : r.week + '–' + r.wEnd} <small style={{ color: 'var(--muted)' }}>{dateOfWeek(cal, r.week)}</small></td><td>{r.week <= cal.HK1 ? 'HK I' : 'HK II'}</td><td>{r.l.periods}</td>
              <td>{r.l.cl ? <button type="button" className="matbtn" title="Mở học liệu" onClick={() => openMat(r.l)}><MatPill m={r.l.mat} /></button> : <MatPill m={r.l.mat} />}</td></tr>)}</tbody>
            <tfoot><tr><td className="n">{x.rows.length}</td><td>Tổng {x.rows.length} bài</td><td>{x.end - x.start + 1} tuần</td><td>HK I {p1} · HK II {x.periods - p1} tiết</td><td>{x.periods}</td><td>{okN}/{x.rows.length} đủ</td></tr></tfoot></table></div></details> })}</>}
  </>
}
