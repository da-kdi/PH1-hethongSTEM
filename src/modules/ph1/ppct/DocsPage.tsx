import { Fragment, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../../../lib/supabase'
import { Tabs } from '../../../pages/teacher/common'
import { CtBadge, Empty, Pill, SCHOOL_YEAR, Stat, VCard, errMsg, norm, useOrgList, useRpcBool } from '../ui'
import { catName, catOf, effectiveCatalog, gradeLabel, useCatalog, useOrgs, type CatItem, type Curriculum } from '../curriculum/api'
import { PpctPage } from './PpctPage'

// 1.1.3 Phân phối chương trình — văn bản PPCT theo cấp – môn – khối (migration 060_ph1_ppct_docs.sql):
// thời lượng (tuần × tiết/tuần từng học kỳ, số phút/tiết), bảng phân bổ tiết theo mạch nội dung, bảng Tuần | Tiết PPCT | Chương – Bài học.
// Lịch & tiến độ triển khai (kế hoạch theo lớp, ngày dạy) giữ ở tab thứ hai.

export type Doc = { id: string; org_id: string; level: string | null; subject: string; grade: number; school_year: string; title: string | null
  weeks_hk1: number; weeks_hk2: number; ppw_hk1: number; ppw_hk2: number; minutes_per_period: number; curriculum_id: string | null
  status: string; issuer: string | null; notes: string | null; based_on_id: string | null; updated_at: string }
export type Strand = { id: string; doc_id: string; seq: number; name: string }
export type Chapter = { id: string; doc_id: string; semester: number; seq: number; title: string; strand_id: string | null; curriculum_unit_id: string | null; note: string | null }
export type Row = { id: string; doc_id: string; chapter_id: string; seq: number; title: string; periods: number; part_label: string | null; kind: string
  strand_id: string | null; week_override: number | null; curriculum_lesson_id: string | null; material_lesson_id: string | null; note: string | null }

export const KIND: Record<string, [string, string]> = {
  bai_hoc: ['Bài học', ''], luyen_tap: ['Luyện tập', '#0f766e'], on_tap: ['Ôn tập', '#ca8a04'], kiem_tra: ['Kiểm tra', '#dc2626'], trai_nghiem: ['Trải nghiệm', '#7c3aed'],
}
const DOC_STATUS: Record<string, [string, '' | 'good' | 'warn']> = { draft: ['Bản nháp', ''], published: ['Đã ban hành', 'good'], archived: ['Lưu trữ', 'warn'] }
const LEVEL_COLOR: Record<string, string> = { mamnon: '#ea580c', tieuhoc: '#16a34a', thcs: '#2a78d6', thpt: '#7c3aed' }
export const levelOf = (g: number) => (g === 0 ? 'mamnon' : g <= 5 ? 'tieuhoc' : g <= 9 ? 'thcs' : 'thpt')
const DEFAULT_STRANDS: Record<string, string[]> = {
  toan: ['Số & Đại số', 'Thống kê & Xác suất', 'Hình học', 'Ôn tập – KT', 'Trải nghiệm thực hành'],
  khtn: ['Chất và sự biến đổi', 'Vật sống', 'Năng lượng', 'Trái Đất & bầu trời', 'Ôn tập – KT'],
  '*': ['Lý thuyết', 'Luyện tập – thực hành', 'Ôn tập – KT', 'Trải nghiệm'],
}
const num = (x: number) => (Number.isInteger(Number(x)) ? String(Number(x)) : String(Number(x)).replace('.', ','))
const capOf = (d: Doc, s: number) => (s === 1 ? d.weeks_hk1 * d.ppw_hk1 : d.weeks_hk2 * d.ppw_hk2)

// Đánh số tiết PPCT liên tục cả năm và tuần theo tiết/tuần của học kỳ
export type Line = Row & { from: number; to: number; week: number; strand: string | null }
export function number(doc: Doc, chapters: Chapter[], rows: Row[]) {
  const lines: Line[] = []
  let p = 0
  for (const s of [1, 2]) {
    let inSem = 0
    for (const c of chapters.filter(x => x.semester === s).sort((a, b) => a.seq - b.seq)) {
      for (const r of rows.filter(x => x.chapter_id === c.id).sort((a, b) => a.seq - b.seq)) {
        const ppw = Number(s === 1 ? doc.ppw_hk1 : doc.ppw_hk2) || 1
        const w = r.week_override ?? (s === 1 ? 0 : doc.weeks_hk1) + Math.floor(inSem / ppw) + 1
        lines.push({ ...r, from: p + 1, to: p + r.periods, week: w, strand: r.strand_id ?? c.strand_id })
        p += r.periods; inSem += r.periods
      }
    }
  }
  return lines
}
const tiet = (l: Line) => (l.to === l.from ? String(l.from) : l.to === l.from + 1 ? `${l.from}, ${l.to}` : `${l.from}–${l.to}`)

// ===== Màn chính: 2 tab =====
export function PpctHome({ orgId }: { orgId: string | null }) {
  const [tab, setTab] = useState<'docs' | 'cal'>('docs')
  return <>
    <div className="p1-tabbar"><Tabs items={[['docs', 'Phân phối chương trình'], ['cal', 'Lịch & tiến độ triển khai']] as ['docs' | 'cal', string][]} value={tab} onChange={setTab} /></div>
    {tab === 'docs' ? <PpctDocs orgId={orgId} /> : <PpctPage orgId={orgId} />}
  </>
}

type Path = { level?: string; grade?: number; subject?: string; doc?: string }
export function PpctDocs({ orgId }: { orgId: string | null }) {
  const [docs, setDocs] = useState<Doc[]>([])
  const [sums, setSums] = useState<Record<string, number>>({})
  const [progs, setProgs] = useState<Curriculum[]>([])
  const [path, setPath] = useState<Path>({})
  const [org, setOrg] = useState(''); const [year, setYear] = useState(SCHOOL_YEAR); const [q, setQ] = useState('')
  const [creating, setCreating] = useState<Partial<Doc> | null>(null)
  const [msg, setMsg] = useState('')
  const canManage = useRpcBool('curriculum_can_manage')
  const orgs = useOrgList()
  const { all, hidden } = useCatalog()
  const { below } = useOrgs(orgId)
  const cat = effectiveCatalog(all, hidden, below)

  async function load(open?: string) {
    const [d, r, c] = await Promise.all([
      supabase.from('ppct_docs').select('*').order('grade').order('subject'),
      supabase.from('ppct_rows').select('doc_id, periods'),
      supabase.from('curricula').select('*').order('code'),
    ])
    if (d.error) return setMsg(errMsg(d.error.message))
    const ds = (d.data as Doc[]) ?? []
    const s: Record<string, number> = {}; ((r.data as { doc_id: string; periods: number }[]) ?? []).forEach(x => { s[x.doc_id] = (s[x.doc_id] ?? 0) + x.periods })
    setDocs(ds); setSums(s); setProgs((c.data as Curriculum[]) ?? [])
    setOrg(o => o || (ds.find(x => x.org_id === orgId) ?? ds[0])?.org_id || '')
    if (open) setPath(p => ({ ...p, doc: open }))
  }
  useEffect(() => { load() }, [orgId])

  const orgName = (id: string) => orgs.find(o => o.id === id)?.name ?? ''
  const doc = docs.find(d => d.id === path.doc)
  if (creating) return <><button type="button" className="p1-back" onClick={() => setCreating(null)}>← Quay lại</button>
    <CreateDoc init={creating} orgId={org || orgId} orgs={orgs} cat={cat} progs={progs} docs={docs}
      onDone={id => { setCreating(null); load(id) }} /></>
  if (doc) return <DocView key={doc.id} doc={doc} prog={progs.find(c => c.id === doc.curriculum_id) ?? null} progs={progs} cat={cat} orgName={orgName(doc.org_id)}
    canManage={canManage} back={() => { setPath({ ...path, doc: undefined }); load() }} reload={() => load()} onCopied={id => load(id)}
    onDeleted={() => { setPath({ ...path, doc: undefined }); load() }} crumbs={<Crumbs path={path} setPath={setPath} cat={cat} doc={doc} />} />

  const qq = norm(q)
  const scope = docs.filter(d => (!org || d.org_id === org) && d.school_year === year)
  const lv = (d: Doc) => d.level ?? levelOf(d.grade)
  const years = Array.from(new Set([SCHOOL_YEAR, ...docs.map(d => d.school_year)])).sort()
  const stat = (list: Doc[]) => ({ n: list.length, periods: list.reduce((a, d) => a + (sums[d.id] ?? 0), 0), subs: new Set(list.map(d => d.subject)).size,
    pub: list.filter(d => d.status === 'published').length })
  const filters = (
    <div className="p1-toolbar">
      <div className="p1-search"><input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Tìm môn, khối, văn bản…" aria-label="Tìm kiếm" /></div>
      <select value={org} onChange={e => { setOrg(e.target.value); setPath({}) }} aria-label="Đơn vị"><option value="">Tất cả đơn vị</option>
        {Array.from(new Set(docs.map(d => d.org_id))).map(o => <option key={o} value={o}>{orgName(o)}</option>)}</select>
      <select value={year} onChange={e => setYear(e.target.value)} aria-label="Năm học">{years.map(y => <option key={y} value={y}>Năm học {y}</option>)}</select>
      {canManage && <button type="button" className="primary" style={{ marginLeft: 'auto' }}
        onClick={() => setCreating({ org_id: org || orgId || undefined, school_year: year, level: path.level, grade: path.grade, subject: path.subject })}>+ Lập PPCT</button>}
    </div>
  )
  const s = stat(scope)
  const head = <>
    {msg && <p className="msg">{msg}</p>}
    <div className="p1-stats">
      <Stat label="Văn bản PPCT" value={s.n} sub={`${s.subs} môn · năm học ${year}`} />
      <Stat label="Đã ban hành" value={s.pub} tone="good" />
      <Stat label="Tổng số tiết phân phối" value={s.periods} />
      <Stat label="Cấp học" value={new Set(scope.map(lv)).size} />
    </div>
    {filters}
  </>

  // Tìm kiếm: danh sách phẳng
  if (qq) {
    const list = scope.filter(d => norm(`${d.title ?? ''} ${catName(cat, 'subject', d.subject)} lớp ${d.grade} ${orgName(d.org_id)}`).includes(qq))
    return <>{head}{list.length ? <DocTable list={list} sums={sums} cat={cat} progs={progs} orgName={orgName} onOpen={id => setPath({ ...path, doc: id })} /> : <Empty>Không tìm thấy văn bản.</Empty>}</>
  }
  // Tầng 1: cấp học
  if (!path.level) {
    const lvls = catOf(cat, 'level').filter(l => scope.some(d => lv(d) === l.code))
    return <>{head}
      {lvls.length ? <div className="p1-grid">{lvls.map(l => { const list = scope.filter(d => lv(d) === l.code); const st = stat(list)
        const grades = Array.from(new Set(list.map(d => d.grade))).sort((a, b) => a - b)
        return <VCard key={l.code} color={l.color ?? LEVEL_COLOR[l.code] ?? '#475569'} code={l.name} title={`Cấp ${l.name}`} subtitle={'Khối ' + grades.join(', ')}
          chips={[`${st.n} văn bản`, `${st.subs} môn`, `${st.periods} tiết`, st.pub ? `${st.pub} đã ban hành` : '']}
          desc={Array.from(new Set(list.map(d => catName(cat, 'subject', d.subject)))).join(' · ')} onClick={() => setPath({ level: l.code })} more="Mở ›" /> })}</div>
        : <Empty>Chưa có văn bản phân phối chương trình cho năm học {year}{canManage ? ' — bấm “+ Lập PPCT” để tạo.' : '.'}</Empty>}
    </>
  }
  const inLv = scope.filter(d => lv(d) === path.level)
  // Tầng 3: nhiều văn bản trong một ô
  if (path.subject) {
    const list = inLv.filter(d => d.subject === path.subject && d.grade === path.grade)
    return <>{head}<Crumbs path={path} setPath={setPath} cat={cat} />
      {list.length ? <DocTable list={list} sums={sums} cat={cat} progs={progs} orgName={orgName} onOpen={id => setPath({ ...path, doc: id })} /> : <Empty>Chưa có văn bản.</Empty>}</>
  }
  // Tầng 2: bảng khối × môn
  const grades = Array.from(new Set(inLv.map(d => d.grade))).sort((a, b) => a - b)
  const subs = catOf(cat, 'subject').map(x => x.code).filter(c => inLv.some(d => d.subject === c))
  const color = LEVEL_COLOR[path.level] ?? '#2a78d6'
  return <>{head}<Crumbs path={path} setPath={setPath} cat={cat} />
    <div className="p1-matrixwrap">
      <table className="p1-matrix p1-ppctmatrix">
        <thead><tr><th>Khối \ Môn</th>{subs.map(c => <th key={c}>{catName(cat, 'subject', c)}</th>)}<th>Cộng</th></tr></thead>
        <tbody>{grades.map(g => <tr key={g}><th>{gradeLabel(g)}</th>
          {subs.map(c => { const l = inLv.filter(d => d.grade === g && d.subject === c); const d0 = l[0]
            return <td key={c}>{d0 ? <button type="button" style={{ borderColor: color + '66', background: color + '12' }}
              onClick={() => setPath(l.length === 1 ? { ...path, grade: g, subject: c, doc: d0.id } : { ...path, grade: g, subject: c })}>
              <b>{l.length === 1 ? sums[d0.id] ?? 0 : l.length}</b>{l.length === 1 ? 'tiết' : 'văn bản'}
              <small>{l.length === 1 ? `${num(d0.ppw_hk1)} tiết/tuần · ${DOC_STATUS[d0.status]?.[0]}` : ''}</small></button>
              : canManage ? <button type="button" className="add" onClick={() => setCreating({ org_id: org || orgId || undefined, school_year: year, level: path.level, grade: g, subject: c })}>+ Lập</button>
              : <span className="sub">—</span>}</td> })}
          <td><b>{inLv.filter(d => d.grade === g).reduce((a, d) => a + (sums[d.id] ?? 0), 0)}</b> <small className="sub">tiết</small></td></tr>)}</tbody>
      </table>
    </div>
    <p className="sub">Mỗi ô là văn bản PPCT của một môn · khối (số tiết đã phân phối). Bấm để mở văn bản.</p>
  </>
}

function Crumbs({ path, setPath, cat, doc }: { path: Path; setPath: (p: Path) => void; cat: CatItem[]; doc?: Doc }) {
  const lv = path.level ?? (doc ? doc.level ?? levelOf(doc.grade) : undefined)
  return <nav className="p1-crumbs" aria-label="Đường dẫn">
    <button type="button" onClick={() => setPath({})}>Tất cả cấp học</button>
    {lv && <><span>›</span><button type="button" onClick={() => setPath({ level: lv })}>{catName(cat, 'level', lv)}</button></>}
    {doc ? <><span>›</span><b>{catName(cat, 'subject', doc.subject)} · {gradeLabel(doc.grade)}</b></>
      : path.subject && <><span>›</span><b>{catName(cat, 'subject', path.subject)} · {path.grade != null ? gradeLabel(path.grade) : ''}</b></>}
  </nav>
}

function DocTable({ list, sums, cat, progs, orgName, onOpen }: { list: Doc[]; sums: Record<string, number>; cat: CatItem[]; progs: Curriculum[]; orgName: (id: string) => string; onOpen: (id: string) => void }) {
  return <table className="p1-list"><thead><tr><th>Văn bản</th><th>Môn · khối</th><th>Thời lượng</th><th>Đã phân phối</th><th>Chương trình</th><th>Trạng thái</th></tr></thead>
    <tbody>{list.map(d => { const p = progs.find(c => c.id === d.curriculum_id); const cap = capOf(d, 1) + capOf(d, 2)
      return <tr key={d.id} onClick={() => onOpen(d.id)}>
        <td><b>{d.title || 'Phân phối chương trình'}</b><br /><small className="sub">{orgName(d.org_id)} · {d.school_year}</small></td>
        <td>{catName(cat, 'subject', d.subject)} · {gradeLabel(d.grade)}</td>
        <td>{d.weeks_hk1 + d.weeks_hk2} tuần · {num(d.ppw_hk1)} tiết/tuần<br /><small className="sub">{d.minutes_per_period} phút/tiết</small></td>
        <td><b>{sums[d.id] ?? 0}</b>/{num(cap)} tiết {(sums[d.id] ?? 0) !== cap && <Pill tone="warn">lệch</Pill>}</td>
        <td><CtBadge color={p?.color} code={p?.code} /></td>
        <td><Pill tone={DOC_STATUS[d.status]?.[1]}>{DOC_STATUS[d.status]?.[0]}</Pill></td>
      </tr> })}</tbody></table>
}

// ===== Tạo văn bản =====
function CreateDoc({ init, orgId, orgs, cat, progs, docs, onDone }: {
  init: Partial<Doc>; orgId: string | null; orgs: { id: string; name: string }[]; cat: CatItem[]; progs: Curriculum[]; docs: Doc[]; onDone: (id: string) => void
}) {
  const [f, setF] = useState({ org_id: init.org_id ?? orgId ?? '', level: init.level ?? (init.grade != null ? levelOf(init.grade) : 'thcs'), subject: init.subject ?? 'toan',
    grade: init.grade ?? 6, school_year: init.school_year ?? SCHOOL_YEAR, weeks_hk1: 18, weeks_hk2: 17, ppw_hk1: 4, ppw_hk2: 4, minutes_per_period: 45,
    curriculum_id: '', source: 'blank' as 'blank' | 'curriculum' | 'copy', copy_id: '' })
  const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false)
  const set = (p: Partial<typeof f>) => setF({ ...f, ...p })
  const same = docs.filter(d => d.subject === f.subject && d.grade === f.grade)
  async function save() {
    setBusy(true); setMsg('')
    if (f.source === 'copy') {
      const { data, error } = await supabase.rpc('ppct_doc_copy', { p_doc: f.copy_id, p_org: f.org_id, p_year: f.school_year })
      setBusy(false); if (error) return setMsg(errMsg(error.message)); return onDone(data as string)
    }
    const org = orgs.find(o => o.id === f.org_id)
    const { data, error } = await supabase.from('ppct_docs').insert({ org_id: f.org_id, level: f.level, subject: f.subject, grade: f.grade, school_year: f.school_year,
      title: `Phân phối chương trình môn ${catName(cat, 'subject', f.subject)} ${f.grade}`, weeks_hk1: f.weeks_hk1, weeks_hk2: f.weeks_hk2, ppw_hk1: f.ppw_hk1, ppw_hk2: f.ppw_hk2,
      minutes_per_period: f.minutes_per_period, curriculum_id: f.curriculum_id || null, issuer: org?.name ?? null }).select('id').single()
    if (error) { setBusy(false); return setMsg(errMsg(error.message)) }
    const id = (data as { id: string }).id
    const names = DEFAULT_STRANDS[f.subject] ?? DEFAULT_STRANDS['*']
    await supabase.from('ppct_strands').insert(names.map((name, k) => ({ doc_id: id, seq: k + 1, name })))
    if (f.source === 'curriculum' && f.curriculum_id) { const r = await supabase.rpc('ppct_doc_from_curriculum', { p_doc: id, p_replace: true }); if (r.error) setMsg(errMsg(r.error.message)) }
    setBusy(false); onDone(id)
  }
  const total = f.weeks_hk1 * f.ppw_hk1 + f.weeks_hk2 * f.ppw_hk2
  return (
    <section className="p1-section">
      <header><h3>Lập văn bản phân phối chương trình</h3></header>
      {msg && <p className="msg">{msg}</p>}
      <div className="p1-form">
        <label>Đơn vị<select value={f.org_id} onChange={e => set({ org_id: e.target.value })}>{orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
        <label>Năm học<input value={f.school_year} onChange={e => set({ school_year: e.target.value })} placeholder="2026-2027" /></label>
        <label>Cấp học<select value={f.level} onChange={e => set({ level: e.target.value })}>{catOf(cat, 'level').map(l => <option key={l.code} value={l.code}>{l.name}</option>)}</select></label>
        <label>Môn học<select value={f.subject} onChange={e => set({ subject: e.target.value })}>{catOf(cat, 'subject').map(l => <option key={l.code} value={l.code}>{l.name}</option>)}</select></label>
        <label>Khối<select value={f.grade} onChange={e => set({ grade: Number(e.target.value), level: levelOf(Number(e.target.value)) })}>
          {Array.from({ length: 13 }, (_, g) => <option key={g} value={g}>{gradeLabel(g)}</option>)}</select></label>
        <label className="wide">Cách tạo<div className="p1-seg">
          {([['blank', 'Văn bản trống'], ['curriculum', 'Dựng từ chương trình giáo dục'], ['copy', `Sao chép văn bản có sẵn (${same.length})`]] as const).map(([k, l]) =>
            <button type="button" key={k} className={f.source === k ? 'on' : ''} onClick={() => set({ source: k })}>{l}</button>)}</div></label>
        {f.source === 'copy' ? <label className="wide">Văn bản nguồn<select value={f.copy_id} onChange={e => set({ copy_id: e.target.value })}><option value="">— chọn —</option>
          {same.map(d => <option key={d.id} value={d.id}>{d.title} · {orgs.find(o => o.id === d.org_id)?.name} · {d.school_year}</option>)}</select></label> : <>
          <label>Học kì I<span className="p1-inline"><input type="number" min={0} value={f.weeks_hk1} onChange={e => set({ weeks_hk1: Number(e.target.value) })} /> tuần ×
            <input type="number" min={0.5} step={0.5} value={f.ppw_hk1} onChange={e => set({ ppw_hk1: Number(e.target.value) })} /> tiết</span></label>
          <label>Học kì II<span className="p1-inline"><input type="number" min={0} value={f.weeks_hk2} onChange={e => set({ weeks_hk2: Number(e.target.value) })} /> tuần ×
            <input type="number" min={0.5} step={0.5} value={f.ppw_hk2} onChange={e => set({ ppw_hk2: Number(e.target.value) })} /> tiết</span></label>
          <label>Số phút / tiết<input type="number" min={5} value={f.minutes_per_period} onChange={e => set({ minutes_per_period: Number(e.target.value) })} /></label>
          <label>Gắn chương trình giáo dục{f.source === 'curriculum' ? ' *' : ' (tuỳ chọn)'}<select value={f.curriculum_id} onChange={e => set({ curriculum_id: e.target.value })}><option value="">— không —</option>
            {progs.filter(p => p.current_version_id).map(p => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}</select></label>
          <p className="wide sub" style={{ margin: 0 }}>Cả năm: {f.weeks_hk1 + f.weeks_hk2} tuần · {num(total)} tiết · {Math.round(total * f.minutes_per_period / 60)} giờ.
            {f.source === 'curriculum' && ' Chủ đề của chương trình → chương, bài học → dòng (bài nhiều tiết tách T1, T2…).'}</p>
        </>}
      </div>
      <div className="p1-actions" style={{ marginTop: 16 }}>
        <button type="button" className="primary" disabled={busy || !f.org_id || (f.source === 'copy' && !f.copy_id) || (f.source === 'curriculum' && !f.curriculum_id)} onClick={save}>{busy ? 'Đang tạo…' : 'Tạo văn bản'}</button>
      </div>
    </section>
  )
}

// ===== Văn bản PPCT =====
function DocView({ doc, prog, progs, cat, orgName, canManage, back, reload, onCopied, onDeleted, crumbs }: {
  doc: Doc; prog: Curriculum | null; progs: Curriculum[]; cat: CatItem[]; orgName: string; canManage: boolean
  back: () => void; reload: () => void; onCopied: (id: string) => void; onDeleted: () => void; crumbs: ReactNode
}) {
  const [strands, setStrands] = useState<Strand[]>([])
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [rows, setRows] = useState<Row[]>([])
  const [edit, setEdit] = useState(false)
  const [sem, setSem] = useState<0 | 1 | 2>(0)
  const [msg, setMsg] = useState('')
  const [info, setInfo] = useState(false)
  const [strEdit, setStrEdit] = useState(false)
  const [rowEdit, setRowEdit] = useState<string | null>(null)
  const [chEdit, setChEdit] = useState<string | null>(null)
  const [adding, setAdding] = useState<string | null>(null)
  const [bulk, setBulk] = useState<string | null>(null)
  const [newCh, setNewCh] = useState<number | null>(null)

  async function load() {
    const [s, c, r] = await Promise.all([
      supabase.from('ppct_strands').select('*').eq('doc_id', doc.id).order('seq'),
      supabase.from('ppct_chapters').select('*').eq('doc_id', doc.id).order('semester').order('seq'),
      supabase.from('ppct_rows').select('*').eq('doc_id', doc.id).order('seq'),
    ])
    setStrands((s.data as Strand[]) ?? []); setChapters((c.data as Chapter[]) ?? []); setRows((r.data as Row[]) ?? [])
  }
  useEffect(() => { load() }, [doc.id])
  const run = async (p: PromiseLike<{ error: { message: string } | null }>) => { const { error } = await p; if (error) { setMsg(errMsg(error.message)); return false } setMsg(''); await load(); return true }

  const lines = number(doc, chapters, rows)
  const subj = catName(cat, 'subject', doc.subject)
  const used = (s: number) => lines.filter(l => chapters.find(c => c.id === l.chapter_id)?.semester === s).reduce((a, l) => a + l.periods, 0)
  const by = (s: number, strand: string | null) => lines.filter(l => chapters.find(c => c.id === l.chapter_id)?.semester === s && l.strand === strand).reduce((a, l) => a + l.periods, 0)
  const noStrand = lines.some(l => !l.strand)
  const cols: [string | null, string][] = [...strands.map(s => [s.id, s.name] as [string, string]), ...(noStrand ? [[null, 'Chưa phân mạch'] as [null, string]] : [])]
  const sems = doc.weeks_hk2 > 0 || chapters.some(c => c.semester === 2) ? [1, 2] : [1]
  const chPeriods = (c: Chapter) => rows.filter(r => r.chapter_id === c.id).reduce((a, r) => a + r.periods, 0)

  async function moveRow(r: Row, d: -1 | 1) {
    const sib = rows.filter(x => x.chapter_id === r.chapter_id).sort((a, b) => a.seq - b.seq); const k = sib.findIndex(x => x.id === r.id); const o = sib[k + d]
    if (!o) return
    await supabase.from('ppct_rows').update({ seq: o.seq }).eq('id', r.id); await run(supabase.from('ppct_rows').update({ seq: r.seq === o.seq ? r.seq + d : r.seq }).eq('id', o.id))
  }
  async function moveCh(c: Chapter, d: -1 | 1) {
    const sib = chapters.filter(x => x.semester === c.semester).sort((a, b) => a.seq - b.seq); const k = sib.findIndex(x => x.id === c.id); const o = sib[k + d]
    if (!o) return
    await supabase.from('ppct_chapters').update({ seq: o.seq }).eq('id', c.id); await run(supabase.from('ppct_chapters').update({ seq: c.seq === o.seq ? c.seq + d : c.seq }).eq('id', o.id))
  }
  async function addRows(chapter: Chapter, items: { title: string; periods: number; kind: string; part?: string | null }[]) {
    const start = Math.max(0, ...rows.filter(r => r.chapter_id === chapter.id).map(r => r.seq))
    return run(supabase.from('ppct_rows').insert(items.map((it, k) => ({ doc_id: doc.id, chapter_id: chapter.id, seq: start + k + 1, title: it.title, periods: it.periods, kind: it.kind, part_label: it.part ?? null }))))
  }
  async function removeDoc() {
    if (!confirm(`Xoá văn bản “${doc.title}” cùng toàn bộ chương, bài? Không hoàn tác được.`)) return
    const { error } = await supabase.from('ppct_docs').delete().eq('id', doc.id); if (error) return setMsg(errMsg(error.message)); onDeleted()
  }
  async function fromCurriculum() {
    if (!confirm('Dựng lại toàn bộ chương / bài từ chương trình giáo dục? Các chương hiện có sẽ bị thay thế.')) return
    const { error } = await supabase.rpc('ppct_doc_from_curriculum', { p_doc: doc.id, p_replace: true }); if (error) return setMsg(errMsg(error.message)); load()
  }
  async function copy() {
    const y = prompt('Sao chép văn bản sang năm học:', doc.school_year.replace(/\d{4}-(\d{4})/, (_, b) => `${b}-${Number(b) + 1}`)); if (!y) return
    const { data, error } = await supabase.rpc('ppct_doc_copy', { p_doc: doc.id, p_org: doc.org_id, p_year: y }); if (error) return setMsg(errMsg(error.message)); onCopied(data as string)
  }

  const semRows = (s: number) => {
    const chs = chapters.filter(c => c.semester === s).sort((a, b) => a.seq - b.seq)
    const sl = lines.filter(l => chs.some(c => c.id === l.chapter_id))
    // gộp ô tuần cho các dòng liền nhau cùng tuần (giống văn bản giấy) — chỉ ở chế độ xem
    const span: Record<string, number> = {}
    if (!edit) { let i = 0; while (i < sl.length) { let j = i; while (j + 1 < sl.length && sl[j + 1].week === sl[i].week && sl[j + 1].chapter_id === sl[i].chapter_id) j++; span[sl[i].id] = j - i + 1; for (let k = i + 1; k <= j; k++) span[sl[k].id] = 0; i = j + 1 } }
    return chs.map(c => { const cl = sl.filter(l => l.chapter_id === c.id); const st = strands.find(x => x.id === c.strand_id); const p = chPeriods(c)
      return <Fragment key={c.id}>
        <tr className="p1-chrow">
          <td colSpan={edit ? 5 : 3}>
            {chEdit === c.id ? <ChapterForm c={c} strands={strands} onCancel={() => setChEdit(null)}
              onSave={v => run(supabase.from('ppct_chapters').update(v).eq('id', c.id)).then(ok => ok && setChEdit(null))} />
              : <div className="p1-chhead"><b>{c.title.toUpperCase()} ({p} TIẾT)</b>{st && <span className="p1-strand">{st.name}</span>}
                {edit && <span className="p1-rowact">
                  <button type="button" title="Lên" onClick={() => moveCh(c, -1)}>↑</button><button type="button" title="Xuống" onClick={() => moveCh(c, 1)}>↓</button>
                  <button type="button" onClick={() => setChEdit(c.id)}>Sửa</button>
                  <button type="button" onClick={() => { setAdding(c.id); setBulk(null) }}>+ Bài</button>
                  <button type="button" onClick={() => { setBulk(c.id); setAdding(null) }}>Nhập nhanh</button>
                  <button type="button" className="danger" onClick={() => confirm(`Xoá “${c.title}” và ${cl.length} dòng bài?`) && run(supabase.from('ppct_chapters').delete().eq('id', c.id))}>Xoá</button>
                </span>}</div>}
          </td>
        </tr>
        {cl.map(l => rowEdit === l.id ? <tr key={l.id}><td colSpan={5}><RowForm r={l} strands={strands} onCancel={() => setRowEdit(null)}
            onSave={v => run(supabase.from('ppct_rows').update(v).eq('id', l.id)).then(ok => ok && setRowEdit(null))} /></td></tr>
          : <tr key={l.id} className={'k-' + l.kind}>
            {(edit || span[l.id] !== 0) && <td className="wk" rowSpan={edit ? 1 : span[l.id]}>{l.week}{l.week_override ? <sup title="Tuần đặt tay">*</sup> : null}</td>}
            <td className="tp">{tiet(l)}</td>
            <td><span className="ttl">{l.title}{l.part_label ? ` (${l.part_label})` : ''}</span>
              {l.kind !== 'bai_hoc' && <span className="p1-kind" style={{ color: KIND[l.kind]?.[1], borderColor: KIND[l.kind]?.[1] + '55' }}>{KIND[l.kind]?.[0]}</span>}
              {l.material_lesson_id && <span className="p1-kind" title="Có học liệu STEM">Học liệu</span>}
              {l.note && <small className="sub"> · {l.note}</small>}</td>
            {edit && <td className="sub">{strands.find(s => s.id === l.strand)?.name ?? '—'}</td>}
            {edit && <td><span className="p1-rowact">
              <button type="button" title="Lên" onClick={() => moveRow(l, -1)}>↑</button><button type="button" title="Xuống" onClick={() => moveRow(l, 1)}>↓</button>
              <button type="button" onClick={() => setRowEdit(l.id)}>Sửa</button>
              <button type="button" className="danger" title="Xoá dòng" onClick={() => run(supabase.from('ppct_rows').delete().eq('id', l.id))}>✕</button></span></td>}
          </tr>)}
        {adding === c.id && <tr><td colSpan={5}><RowForm strands={strands} onCancel={() => setAdding(null)}
          onSave={v => addRows(c, [{ title: v.title!, periods: v.periods ?? 1, kind: v.kind ?? 'bai_hoc', part: v.part_label }]).then(ok => ok && setAdding(null))} /></td></tr>}
        {bulk === c.id && <tr><td colSpan={5}><BulkForm onCancel={() => setBulk(null)} onSave={items => addRows(c, items).then(ok => ok && setBulk(null))} /></td></tr>}
      </Fragment> })
  }

  return (
    <>
      <button type="button" className="p1-back" onClick={back}>← Tất cả văn bản</button>
      {crumbs}
      {msg && <p className="msg">{msg}</p>}
      <div className="p1-docbar">
        <Pill tone={DOC_STATUS[doc.status]?.[1]}>{DOC_STATUS[doc.status]?.[0]}</Pill>
        {prog && <CtBadge color={prog.color} code={prog.code} />}
        <span className="sub">{orgName} · cập nhật {new Date(doc.updated_at).toLocaleDateString('vi-VN')}</span>
        <div className="p1-actions" style={{ marginLeft: 'auto' }}>
          {canManage && <button type="button" className={edit ? 'primary' : ''} onClick={() => { setEdit(!edit); setRowEdit(null); setAdding(null); setBulk(null) }}>{edit ? '✓ Xong chỉnh sửa' : '✎ Chỉnh sửa'}</button>}
          {canManage && <button type="button" onClick={() => setInfo(!info)}>Thông số</button>}
          {canManage && doc.curriculum_id && <button type="button" onClick={fromCurriculum}>Dựng từ chương trình</button>}
          {canManage && <button type="button" onClick={copy}>Sao chép</button>}
          <button type="button" onClick={() => window.print()}>In</button>
          {canManage && <button type="button" className="danger" onClick={removeDoc}>Xoá văn bản</button>}
        </div>
      </div>
      {info && <InfoForm doc={doc} progs={progs} onCancel={() => setInfo(false)} onSave={v => supabase.from('ppct_docs').update(v).eq('id', doc.id).then(({ error }) => { if (error) setMsg(errMsg(error.message)); else { setInfo(false); reload() } })} />}

      <article className="p1-doc">
        <header className="p1-dochead">
          <div className="issuer">{(doc.issuer ?? orgName).split('·').map((x, i) => <div key={i}>{x.trim()}</div>)}</div>
          <h2>PHÂN PHỐI CHƯƠNG TRÌNH MÔN: {subj.toUpperCase()} {doc.grade}</h2>
          <div className="yr">NĂM HỌC {doc.school_year.replace('-', '–')}</div>
        </header>
        <div className="p1-timebox">
          <div><b>Cả năm:</b> {doc.weeks_hk1 + doc.weeks_hk2} tuần{Number(doc.ppw_hk1) === Number(doc.ppw_hk2) ? ` × ${num(doc.ppw_hk1)} tiết/tuần` : ''} = <b>{num(capOf(doc, 1) + capOf(doc, 2))} tiết</b>
            <small> · {doc.minutes_per_period} phút/tiết ≈ {Math.round((capOf(doc, 1) + capOf(doc, 2)) * doc.minutes_per_period / 60)} giờ</small></div>
          {sems.map(s => { const cap = capOf(doc, s); const u = used(s)
            return <div key={s}><b>Học kì {s === 1 ? 'I' : 'II'}:</b> {s === 1 ? doc.weeks_hk1 : doc.weeks_hk2} tuần × {num(s === 1 ? doc.ppw_hk1 : doc.ppw_hk2)} tiết/tuần = <b>{num(cap)} tiết</b>
              {' '}{u === cap ? <Pill tone="good">đã phân phối đủ</Pill> : <Pill tone="warn">đã phân phối {u}/{num(cap)}</Pill>}</div> })}
        </div>

        <div className="p1-dochd"><h3>Phân bổ số tiết theo mạch nội dung</h3>{canManage && edit && <button type="button" onClick={() => setStrEdit(!strEdit)}>{strEdit ? 'Đóng' : 'Sửa các cột mạch'}</button>}</div>
        {strEdit && <StrandEditor doc={doc} strands={strands} run={run} />}
        <div className="p1-matrixwrap">
          <table className="p1-strandtbl">
            <thead><tr><th>Học kì</th>{cols.map(([id, n]) => <th key={id ?? '_'}>{n}</th>)}<th>Tổng</th></tr></thead>
            <tbody>
              {sems.map(s => <tr key={s}><th>HK {s === 1 ? 'I' : 'II'}</th>{cols.map(([id]) => <td key={id ?? '_'}>{by(s, id) || '—'}</td>)}<td><b>{used(s)}</b></td></tr>)}
              <tr className="sum"><th>Cả năm</th>{cols.map(([id]) => <td key={id ?? '_'}>{sems.reduce((a, s) => a + by(s, id), 0) || '—'}</td>)}<td><b>{sems.reduce((a, s) => a + used(s), 0)}</b></td></tr>
            </tbody>
          </table>
        </div>

        <div className="p1-dochd"><h3>Phân phối chi tiết</h3>
          <div className="p1-statustabs" style={{ border: 0, margin: 0 }}>
            {([[0, 'Cả năm'], ...sems.map(s => [s, s === 1 ? 'Học kì I' : 'Học kì II'])] as [0 | 1 | 2, string][]).map(([k, l]) =>
              <button type="button" key={k} className={sem === k ? 'on' : ''} onClick={() => setSem(k)}>{l}</button>)}</div>
        </div>
        {!chapters.length && <Empty>Chưa có chương / bài. {canManage ? (doc.curriculum_id ? 'Bấm “Dựng từ chương trình” hoặc “✎ Chỉnh sửa” để thêm chương.' : 'Bấm “✎ Chỉnh sửa” để thêm chương.') : ''}</Empty>}
        {sems.filter(s => !sem || s === sem).map(s => <div key={s} className="p1-semblock">
          <h4>HỌC KÌ {s === 1 ? 'I' : 'II'} <small>({used(s)} tiết · tuần {s === 1 ? 1 : doc.weeks_hk1 + 1}–{s === 1 ? doc.weeks_hk1 : doc.weeks_hk1 + doc.weeks_hk2})</small></h4>
          <table className={'p1-ppcttbl' + (edit ? ' editing' : '')}>
            <colgroup><col style={{ width: 70 }} /><col style={{ width: 90 }} /><col />{edit && <col style={{ width: 150 }} />}{edit && <col style={{ width: 190 }} />}</colgroup>
            <thead><tr><th>Tuần</th><th>Tiết PPCT</th><th>Bài học</th>{edit && <th>Mạch</th>}{edit && <th></th>}</tr></thead>
            <tbody>{semRows(s)}
              {edit && <tr><td colSpan={5}>{newCh === s ? <ChapterForm strands={strands} onCancel={() => setNewCh(null)}
                onSave={v => run(supabase.from('ppct_chapters').insert({ ...v, doc_id: doc.id, semester: s, seq: Math.max(0, ...chapters.filter(c => c.semester === s).map(c => c.seq)) + 1 })).then(ok => ok && setNewCh(null))} />
                : <button type="button" className="p1-addline" onClick={() => setNewCh(s)}>+ Thêm chương / chủ đề vào học kì {s === 1 ? 'I' : 'II'}</button>}</td></tr>}
            </tbody>
          </table>
        </div>)}
        {doc.notes && <p className="sub" style={{ marginTop: 12 }}>Ghi chú: {doc.notes}</p>}
      </article>
      <p className="sub" style={{ marginTop: 8 }}>Tiết PPCT đánh liên tục cả năm, tuần tính theo số tiết/tuần (đặt tay ở từng dòng nếu cần).</p>
    </>
  )
}

function InfoForm({ doc, progs, onSave, onCancel }: { doc: Doc; progs: Curriculum[]; onSave: (v: Partial<Doc>) => void; onCancel: () => void }) {
  const [f, setF] = useState<Partial<Doc>>({ title: doc.title, issuer: doc.issuer, weeks_hk1: doc.weeks_hk1, weeks_hk2: doc.weeks_hk2, ppw_hk1: doc.ppw_hk1, ppw_hk2: doc.ppw_hk2,
    minutes_per_period: doc.minutes_per_period, curriculum_id: doc.curriculum_id, status: doc.status, school_year: doc.school_year, notes: doc.notes })
  const set = (p: Partial<Doc>) => setF({ ...f, ...p })
  return <section className="p1-section">
    <header><h3>Thông số văn bản</h3></header>
    <div className="p1-form">
      <label className="wide">Tên văn bản<input value={f.title ?? ''} onChange={e => set({ title: e.target.value })} /></label>
      <label className="wide">Đơn vị ban hành (dòng tiêu đề, tách bằng “·”)<input value={f.issuer ?? ''} onChange={e => set({ issuer: e.target.value })} /></label>
      <label>Học kì I · số tuần<input type="number" min={0} value={f.weeks_hk1} onChange={e => set({ weeks_hk1: Number(e.target.value) })} /></label>
      <label>Học kì I · tiết/tuần<input type="number" min={0.5} step={0.5} value={f.ppw_hk1} onChange={e => set({ ppw_hk1: Number(e.target.value) })} /></label>
      <label>Học kì II · số tuần<input type="number" min={0} value={f.weeks_hk2} onChange={e => set({ weeks_hk2: Number(e.target.value) })} /></label>
      <label>Học kì II · tiết/tuần<input type="number" min={0.5} step={0.5} value={f.ppw_hk2} onChange={e => set({ ppw_hk2: Number(e.target.value) })} /></label>
      <label>Số phút / tiết<input type="number" min={5} value={f.minutes_per_period} onChange={e => set({ minutes_per_period: Number(e.target.value) })} /></label>
      <label>Năm học<input value={f.school_year} onChange={e => set({ school_year: e.target.value })} /></label>
      <label>Chương trình giáo dục<select value={f.curriculum_id ?? ''} onChange={e => set({ curriculum_id: e.target.value || null })}><option value="">— không —</option>
        {progs.map(p => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}</select></label>
      <label>Trạng thái<select value={f.status} onChange={e => set({ status: e.target.value })}>{Object.entries(DOC_STATUS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select></label>
      <label className="wide">Ghi chú<textarea rows={2} value={f.notes ?? ''} onChange={e => set({ notes: e.target.value })} /></label>
    </div>
    <div className="p1-actions" style={{ marginTop: 14 }}><button type="button" onClick={onCancel}>Huỷ</button><button type="button" className="primary" onClick={() => onSave(f)}>Lưu</button></div>
  </section>
}

function StrandEditor({ doc, strands, run }: { doc: Doc; strands: Strand[]; run: (p: PromiseLike<{ error: { message: string } | null }>) => Promise<boolean> }) {
  const [name, setName] = useState('')
  return <div className="p1-strandedit">
    {strands.map(s => <span key={s.id} className="p1-chipedit">
      <input defaultValue={s.name} aria-label="Tên mạch" onBlur={e => e.target.value.trim() && e.target.value !== s.name && run(supabase.from('ppct_strands').update({ name: e.target.value.trim() }).eq('id', s.id))} />
      <button type="button" className="danger" title="Xoá cột" onClick={() => confirm(`Xoá cột “${s.name}”? Các chương / dòng gắn cột này chuyển về “Chưa phân mạch”.`) && run(supabase.from('ppct_strands').delete().eq('id', s.id))}>✕</button></span>)}
    <span className="p1-chipedit"><input value={name} placeholder="Thêm cột mạch…" onChange={e => setName(e.target.value)} />
      <button type="button" disabled={!name.trim()} onClick={() => run(supabase.from('ppct_strands').insert({ doc_id: doc.id, seq: strands.length + 1, name: name.trim() })).then(() => setName(''))}>+</button></span>
  </div>
}

function ChapterForm({ c, strands, onSave, onCancel }: { c?: Chapter; strands: Strand[]; onSave: (v: Partial<Chapter>) => void; onCancel: () => void }) {
  const [t, setT] = useState(c?.title ?? ''); const [s, setS] = useState(c?.strand_id ?? ''); const [n, setN] = useState(c?.note ?? '')
  return <div className="p1-inlineform">
    <input autoFocus value={t} placeholder="VD: Chương I: Đa thức" onChange={e => setT(e.target.value)} style={{ flex: 3 }} />
    <select value={s} onChange={e => setS(e.target.value)} aria-label="Mạch nội dung"><option value="">— mạch —</option>{strands.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
    <input value={n} placeholder="Ghi chú" onChange={e => setN(e.target.value)} style={{ flex: 2 }} />
    <button type="button" onClick={onCancel}>Huỷ</button><button type="button" className="primary" disabled={!t.trim()} onClick={() => onSave({ title: t.trim(), strand_id: s || null, note: n || null })}>Lưu</button>
  </div>
}

function RowForm({ r, strands, onSave, onCancel }: { r?: Row; strands: Strand[]; onSave: (v: Partial<Row>) => void; onCancel: () => void }) {
  const [f, setF] = useState<Partial<Row>>({ title: r?.title ?? '', periods: r?.periods ?? 1, part_label: r?.part_label ?? '', kind: r?.kind ?? 'bai_hoc', strand_id: r?.strand_id ?? null, week_override: r?.week_override ?? null, note: r?.note ?? '' })
  const set = (p: Partial<Row>) => setF({ ...f, ...p })
  return <div className="p1-inlineform">
    <input autoFocus value={f.title} placeholder="VD: Bài 1: Đơn thức" onChange={e => set({ title: e.target.value })} style={{ flex: 3 }} />
    <label>Số tiết<input type="number" min={1} max={20} value={f.periods} onChange={e => set({ periods: Number(e.target.value) })} style={{ width: 64 }} /></label>
    <label>Phần<input value={f.part_label ?? ''} placeholder="T1" onChange={e => set({ part_label: e.target.value })} style={{ width: 56 }} /></label>
    <select value={f.kind} onChange={e => set({ kind: e.target.value })} aria-label="Loại">{Object.entries(KIND).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select>
    <select value={f.strand_id ?? ''} onChange={e => set({ strand_id: e.target.value || null })} aria-label="Mạch"><option value="">Mạch theo chương</option>{strands.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
    <label>Tuần<input type="number" min={1} value={f.week_override ?? ''} placeholder="tự" onChange={e => set({ week_override: e.target.value ? Number(e.target.value) : null })} style={{ width: 60 }} /></label>
    <input value={f.note ?? ''} placeholder="Ghi chú" onChange={e => set({ note: e.target.value })} style={{ flex: 1 }} />
    <button type="button" onClick={onCancel}>Huỷ</button>
    <button type="button" className="primary" disabled={!f.title?.trim()} onClick={() => onSave({ ...f, title: f.title!.trim(), part_label: f.part_label || null, note: f.note || null })}>Lưu</button>
  </div>
}

// Nhập nhanh: mỗi dòng "Tên bài | số tiết" — bài nhiều tiết có thể tách thành T1, T2…
function BulkForm({ onSave, onCancel }: { onSave: (items: { title: string; periods: number; kind: string; part?: string | null }[]) => void; onCancel: () => void }) {
  const [text, setText] = useState(''); const [split, setSplit] = useState(true)
  const kindOf = (t: string) => /kiểm tra/i.test(t) ? 'kiem_tra' : /ôn tập/i.test(t) ? 'on_tap' : /luyện tập|bài tập/i.test(t) ? 'luyen_tap' : /trải nghiệm|thực hành|dự án/i.test(t) ? 'trai_nghiem' : 'bai_hoc'
  const items = text.split('\n').map(l => l.trim()).filter(Boolean).flatMap(l => {
    const [t, p] = l.split('|').map(x => x.trim()); const n = Math.max(1, Math.min(20, Number(p) || 1)); const kind = kindOf(t)
    return split && n > 1 && kind === 'bai_hoc' ? Array.from({ length: n }, (_, k) => ({ title: t, periods: 1, kind, part: 'T' + (k + 1) })) : [{ title: t, periods: n, kind }]
  })
  return <div className="p1-bulk">
    <textarea autoFocus rows={5} value={text} onChange={e => setText(e.target.value)} placeholder={'Mỗi dòng một bài, dạng: Tên bài | số tiết\nBài 1: Đơn thức | 2\nLuyện tập chung | 2\nBài tập cuối chương + Kiểm tra TX1 | 1'} />
    <div className="p1-actions"><label className="sub"><input type="checkbox" checked={split} onChange={e => setSplit(e.target.checked)} /> Tách bài nhiều tiết thành T1, T2…</label>
      <span className="sub">{items.length} dòng · {items.reduce((a, i) => a + i.periods, 0)} tiết</span>
      <button type="button" onClick={onCancel}>Huỷ</button><button type="button" className="primary" disabled={!items.length} onClick={() => onSave(items)}>Thêm</button></div>
  </div>
}
