import { Fragment, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../../../lib/supabase'
import { Tabs } from '../../../pages/teacher/common'
import { CtBadge, Empty, Pill, SCHOOL_YEAR, Stat, VCard, errMsg, norm, useOrgList, useRpcBool } from '../ui'
import { catName, catOf, effectiveCatalog, gradeLabel, gradesOfLevel, levelOfGrade, useCatalog, useOrgs, type CatItem, type Curriculum } from '../curriculum/api'
import { PpctPage } from './PpctPage'
import { TrackingPage } from '../tracking/TrackingPage'

// 1.1.3 Phân phối chương trình (docs/PH1-cau-truc-1.1.md) — đi tiếp từ Chương trình giáo dục:
//   View tổng quan theo Cấp học › Khối → bản phân phối;
//   Thiết lập: (Trường — tuỳ chọn) › Cấp học › Khối › Chương trình phù hợp (gợi ý theo khối) › Môn học › Xếp lịch Học kỳ › Tuần › Buổi.
// Bản phân phối (ppct_docs, 060–061): mỗi môn đã chọn là một khối lịch (ppct_chapters), mỗi bài học là một dòng (số tiết, số buổi).
// Văn bản PPCT một môn kiểu cũ (Toán 8…) vẫn mở được. Lịch & tiến độ, Theo dõi giữ ở các tab sau (chờ xem lại).

export type Doc = { id: string; org_id: string; target_org_id: string | null; level: string | null; subject: string | null; grade: number; school_year: string; title: string | null
  weeks_hk1: number; weeks_hk2: number; ppw_hk1: number; ppw_hk2: number; minutes_per_period: number; curriculum_id: string | null
  status: string; issuer: string | null; notes: string | null; based_on_id: string | null; updated_at: string }
export type Strand = { id: string; doc_id: string; seq: number; name: string }
export type Chapter = { id: string; doc_id: string; semester: number; seq: number; title: string; strand_id: string | null; curriculum_unit_id: string | null
  curriculum_id: string | null; subject: string | null; note: string | null }
export type Row = { id: string; doc_id: string; chapter_id: string; seq: number; title: string; periods: number; sessions: number; part_label: string | null; kind: string
  strand_id: string | null; week_override: number | null; curriculum_lesson_id: string | null; material_lesson_id: string | null; note: string | null }

export const KIND: Record<string, [string, string]> = {
  bai_hoc: ['Bài học', ''], luyen_tap: ['Luyện tập', '#0f766e'], on_tap: ['Ôn tập', '#ca8a04'], kiem_tra: ['Kiểm tra', '#dc2626'], trai_nghiem: ['Trải nghiệm', '#7c3aed'],
}
const DOC_STATUS: Record<string, [string, '' | 'good' | 'warn']> = { draft: ['Bản nháp', ''], published: ['Đã ban hành', 'good'], archived: ['Lưu trữ', 'warn'] }
const LEVEL_COLOR: Record<string, string> = { mamnon: '#ea580c', tieuhoc: '#16a34a', thcs: '#2a78d6', thpt: '#7c3aed' }
export const levelOf = (g: number) => levelOfGrade([], g)
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
const docName = (d: Doc, cat: CatItem[]) => d.title || (d.subject ? `Phân phối môn ${catName(cat, 'subject', d.subject)} ${d.grade}` : `Phân phối ${gradeLabel(d.grade)}`)

// ===== Màn chính =====
export function PpctHome({ orgId }: { orgId: string | null }) {
  const [tab, setTab] = useState<'docs' | 'cal' | 'track'>('docs')
  return <>
    <div className="p1-tabbar"><Tabs items={[['docs', 'Phân phối chương trình'], ['cal', 'Lịch & tiến độ (chờ xem lại)'], ['track', 'Theo dõi (chờ xem lại)']] as ['docs' | 'cal' | 'track', string][]} value={tab} onChange={setTab} /></div>
    {tab === 'docs' ? <PpctDocs orgId={orgId} /> : tab === 'cal' ? <PpctPage orgId={orgId} /> : <TrackingPage orgId={orgId} />}
  </>
}

type Path = { level?: string; grade?: number; doc?: string }
type ChMeta = { doc_id: string; subject: string | null; curriculum_id: string | null }
export function PpctDocs({ orgId }: { orgId: string | null }) {
  const [docs, setDocs] = useState<Doc[]>([])
  const [sums, setSums] = useState<Record<string, number>>({})
  const [chs, setChs] = useState<ChMeta[]>([])
  const [progs, setProgs] = useState<Curriculum[]>([])
  const [path, setPath] = useState<Path>({})
  const [school, setSchool] = useState(''); const [year, setYear] = useState(SCHOOL_YEAR); const [q, setQ] = useState('')
  const [creating, setCreating] = useState<{ level?: string; grade?: number } | null>(null)
  const [msg, setMsg] = useState('')
  const canManage = useRpcBool('curriculum_can_manage')
  const orgs = useOrgList()
  const { all, hidden } = useCatalog()
  const { below } = useOrgs(orgId)
  const cat = effectiveCatalog(all, hidden, below)

  async function load(open?: string) {
    const [d, r, c, ch] = await Promise.all([
      supabase.from('ppct_docs').select('*').order('grade').order('title'),
      supabase.from('ppct_rows').select('doc_id, periods'),
      supabase.from('curricula').select('*').order('code'),
      supabase.from('ppct_chapters').select('doc_id, subject, curriculum_id'),
    ])
    if (d.error) return setMsg(errMsg(d.error.message))
    const s: Record<string, number> = {}; ((r.data as { doc_id: string; periods: number }[]) ?? []).forEach(x => { s[x.doc_id] = (s[x.doc_id] ?? 0) + x.periods })
    setDocs((d.data as Doc[]) ?? []); setSums(s); setProgs((c.data as Curriculum[]) ?? []); setChs((ch.data as ChMeta[]) ?? [])
    if (open) setPath(p => ({ ...p, doc: open }))
  }
  useEffect(() => { load() }, [orgId])

  const orgName = (id: string | null) => (id ? orgs.find(o => o.id === id)?.name ?? '' : 'Tất cả trường')
  const subjectsOf = (d: Doc) => Array.from(new Set([d.subject, ...chs.filter(c => c.doc_id === d.id).map(c => c.subject)].filter(Boolean) as string[]))
  const progsOf = (d: Doc) => progs.filter(p => p.id === d.curriculum_id || chs.some(c => c.doc_id === d.id && c.curriculum_id === p.id))
  const doc = docs.find(d => d.id === path.doc)
  if (creating) return <><button type="button" className="p1-back" onClick={() => setCreating(null)}>← Quay lại</button>
    <CreateDoc init={creating} orgId={orgId} orgs={orgs} cat={cat} progs={progs} docs={docs} school={school}
      onDone={id => { setCreating(null); load(id) }} /></>
  if (doc) return <DocView key={doc.id} doc={doc} prog={progs.find(c => c.id === doc.curriculum_id) ?? null} progs={progs} cat={cat} orgName={orgs.find(o => o.id === doc.org_id)?.name ?? ''}
    target={orgName(doc.target_org_id)} canManage={canManage} back={() => { setPath({ ...path, doc: undefined }); load() }} reload={() => load()} onCopied={id => load(id)}
    onDeleted={() => { setPath({ ...path, doc: undefined }); load() }} crumbs={<Crumbs path={path} setPath={setPath} cat={cat} doc={doc} />} />

  const qq = norm(q)
  // Trường: bản cho tất cả trường + bản riêng của trường đó (+ bản trường tự lập)
  const scope = docs.filter(d => d.school_year === year && (!school || d.target_org_id == null || d.target_org_id === school || d.org_id === school))
  const lv = (d: Doc) => d.level ?? levelOfGrade(cat, d.grade)
  const years = Array.from(new Set([SCHOOL_YEAR, ...docs.map(d => d.school_year)])).sort()
  const stat = (list: Doc[]) => ({ n: list.length, periods: list.reduce((a, d) => a + (sums[d.id] ?? 0), 0), subs: new Set(list.flatMap(subjectsOf)).size,
    pub: list.filter(d => d.status === 'published').length })
  const schools = orgs.filter(o => o.type === 'school')
  const head = <>
    {msg && <p className="msg">{msg}</p>}
    <div className="p1-stats">
      <Stat label="Bản phân phối" value={stat(scope).n} sub={`năm học ${year}`} />
      <Stat label="Đã ban hành" value={stat(scope).pub} tone="good" />
      <Stat label="Môn học" value={stat(scope).subs} />
      <Stat label="Tổng số tiết" value={stat(scope).periods} />
    </div>
    <div className="p1-toolbar">
      <div className="p1-search"><input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Tìm bản phân phối, môn, khối…" aria-label="Tìm kiếm" /></div>
      <select value={school} onChange={e => setSchool(e.target.value)} aria-label="Trường"><option value="">Tất cả trường</option>
        {schools.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
      <select value={year} onChange={e => setYear(e.target.value)} aria-label="Năm học">{years.map(y => <option key={y} value={y}>Năm học {y}</option>)}</select>
      {canManage && <button type="button" className="primary" style={{ marginLeft: 'auto' }} onClick={() => setCreating({ level: path.level, grade: path.grade })}>+ Thiết lập phân phối</button>}
    </div>
  </>
  const table = (list: Doc[]) => <DocTable list={list} sums={sums} cat={cat} subjectsOf={subjectsOf} progsOf={progsOf} orgName={orgName} onOpen={id => setPath({ ...path, doc: id })} />

  if (qq) {
    const list = scope.filter(d => norm(`${docName(d, cat)} ${subjectsOf(d).map(s => catName(cat, 'subject', s)).join(' ')} khối ${d.grade} ${orgName(d.target_org_id)}`).includes(qq))
    return <>{head}{list.length ? table(list) : <Empty>Không tìm thấy bản phân phối.</Empty>}</>
  }
  // Tầng 1: cấp học
  if (!path.level) {
    const lvls = catOf(cat, 'level').filter(l => scope.some(d => lv(d) === l.code))
    return <>{head}
      {lvls.length ? <div className="p1-grid">{lvls.map(l => { const list = scope.filter(d => lv(d) === l.code); const st = stat(list)
        const grades = Array.from(new Set(list.map(d => d.grade))).sort((a, b) => a - b)
        return <VCard key={l.code} color={l.color ?? LEVEL_COLOR[l.code] ?? '#475569'} code={l.name} title={`Cấp ${l.name}`} subtitle={'Khối ' + grades.join(', ')}
          chips={[`${st.n} bản phân phối`, `${st.subs} môn`, `${st.periods} tiết`]} onClick={() => setPath({ level: l.code })} more="Mở ›" /> })}</div>
        : <Empty>Chưa có bản phân phối cho năm học {year}{canManage ? ' — bấm “+ Thiết lập phân phối”.' : '.'}</Empty>}
    </>
  }
  const inLv = scope.filter(d => lv(d) === path.level)
  // Tầng 3: các bản phân phối của một khối
  if (path.grade != null) {
    const list = inLv.filter(d => d.grade === path.grade)
    return <>{head}<Crumbs path={path} setPath={setPath} cat={cat} />
      {list.length ? table(list) : <Empty>Khối này chưa có bản phân phối.</Empty>}</>
  }
  // Tầng 2: các khối của cấp học
  const color = LEVEL_COLOR[path.level] ?? '#2a78d6'
  const grades = gradesOfLevel(cat, path.level)
  return <>{head}<Crumbs path={path} setPath={setPath} cat={cat} />
    <div className="p1-grid">{grades.map(g => { const list = inLv.filter(d => d.grade === g); const st = stat(list)
      return list.length ? <VCard key={g} color={color} code={gradeLabel(g)} title={gradeLabel(g)} subtitle={`${st.n} bản phân phối · ${st.periods} tiết`}
        chips={Array.from(new Set(list.flatMap(subjectsOf))).slice(0, 4).map(s => catName(cat, 'subject', s))}
        desc={list.map(d => `${docName(d, cat)} — ${orgName(d.target_org_id)}`).join(' · ')} onClick={() => setPath({ ...path, grade: g })} more="Mở ›" />
        : canManage ? <button key={g} type="button" className="p1-addcard" onClick={() => setCreating({ level: path.level, grade: g })}><b>{gradeLabel(g)}</b><span>+ Thiết lập phân phối</span></button> : null })}</div>
  </>
}

function Crumbs({ path, setPath, cat, doc }: { path: Path; setPath: (p: Path) => void; cat: CatItem[]; doc?: Doc }) {
  const lv = path.level ?? (doc ? doc.level ?? levelOfGrade(cat, doc.grade) : undefined)
  const g = path.grade ?? doc?.grade
  return <nav className="p1-crumbs" aria-label="Đường dẫn">
    <button type="button" onClick={() => setPath({})}>Tất cả cấp học</button>
    {lv && <><span>›</span><button type="button" onClick={() => setPath({ level: lv })}>{catName(cat, 'level', lv)}</button></>}
    {g != null && <><span>›</span>{doc ? <button type="button" onClick={() => setPath({ level: lv, grade: g })}>{gradeLabel(g)}</button> : <b>{gradeLabel(g)}</b>}</>}
    {doc && <><span>›</span><b>{docName(doc, cat)}</b></>}
  </nav>
}

function DocTable({ list, sums, cat, subjectsOf, progsOf, orgName, onOpen }: {
  list: Doc[]; sums: Record<string, number>; cat: CatItem[]; subjectsOf: (d: Doc) => string[]; progsOf: (d: Doc) => Curriculum[]; orgName: (id: string | null) => string; onOpen: (id: string) => void
}) {
  return <table className="p1-list"><thead><tr><th>Bản phân phối</th><th>Áp dụng</th><th>Chương trình · môn</th><th>Thời lượng</th><th>Đã phân phối</th><th>Trạng thái</th></tr></thead>
    <tbody>{list.map(d => { const cap = capOf(d, 1) + capOf(d, 2)
      return <tr key={d.id} onClick={() => onOpen(d.id)}>
        <td><b>{docName(d, cat)}</b><br /><small className="sub">{gradeLabel(d.grade)} · {d.school_year}</small></td>
        <td>{orgName(d.target_org_id)}<br /><small className="sub">lập bởi {orgName(d.org_id)}</small></td>
        <td>{progsOf(d).map(p => <CtBadge key={p.id} color={p.color} code={p.code} />)} <small className="sub">{subjectsOf(d).map(s => catName(cat, 'subject', s)).join(', ')}</small></td>
        <td>{d.weeks_hk1 + d.weeks_hk2} tuần · {num(d.ppw_hk1)} tiết/tuần<br /><small className="sub">{d.minutes_per_period} phút/tiết</small></td>
        <td><b>{sums[d.id] ?? 0}</b>/{num(cap)} tiết {(sums[d.id] ?? 0) !== cap && <Pill tone="warn">lệch</Pill>}</td>
        <td><Pill tone={DOC_STATUS[d.status]?.[1]}>{DOC_STATUS[d.status]?.[0]}</Pill></td>
      </tr> })}</tbody></table>
}

// ===== Thiết lập phân phối: (Trường) › Cấp học › Khối › Chương trình phù hợp › Môn › Xếp lịch =====
type Avail = { curriculum_id: string; subject: string; lessons: number; sessions: number; periods: number }
function CreateDoc({ init, orgId, orgs, cat, progs, docs, school, onDone }: {
  init: { level?: string; grade?: number }; orgId: string | null; orgs: { id: string; name: string; type: string }[]; cat: CatItem[]; progs: Curriculum[]; docs: Doc[]
  school: string; onDone: (id: string) => void
}) {
  const [target, setTarget] = useState(school)
  const [level, setLevel] = useState(init.level ?? (init.grade != null ? levelOfGrade(cat, init.grade) : ''))
  const [grade, setGrade] = useState<number | null>(init.grade ?? null)
  const [picked, setPicked] = useState<string[]>([])
  const [items, setItems] = useState<{ curriculum_id: string; subject: string }[]>([])
  const [t, setT] = useState({ school_year: SCHOOL_YEAR, weeks_hk1: 18, weeks_hk2: 17, ppw_hk1: 2, ppw_hk2: 2, minutes_per_period: 45 })
  const [avail, setAvail] = useState<Avail[]>([])
  const [copyId, setCopyId] = useState('')
  const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false)

  // Môn của các chương trình đã phát hành áp dụng cho khối đã chọn (062: mỗi chương trình một khối; bài học thuộc môn)
  useEffect(() => {
    const ok = progs.filter(p => p.status === 'published' && p.current_version_id && grade != null && p.grades.includes(grade))
    if (!ok.length) return setAvail([])
    supabase.from('curriculum_lessons').select('version_id, subject, periods, sessions').in('version_id', ok.map(p => p.current_version_id!)).then(({ data }) => {
      const m = new Map<string, Avail>()
      for (const l of (data as { version_id: string; subject: string | null; periods: number; sessions: number }[]) ?? []) { if (!l.subject) continue
        const p = ok.find(x => x.current_version_id === l.version_id); if (!p) continue
        const k = p.id + '|' + l.subject; const a = m.get(k) ?? { curriculum_id: p.id, subject: l.subject, lessons: 0, sessions: 0, periods: 0 }
        a.lessons++; a.sessions += l.sessions ?? 1; a.periods += l.periods; m.set(k, a) }
      setAvail([...m.values()])
    })
  }, [grade, progs.length])

  const grades = level ? gradesOfLevel(cat, level) : []
  const matchProgs = progs.filter(p => avail.some(a => a.curriculum_id === p.id))
  const total = items.reduce((s, it) => s + (avail.find(a => a.curriculum_id === it.curriculum_id && a.subject === it.subject)?.periods ?? 0), 0)
  const cap = t.weeks_hk1 * t.ppw_hk1 + t.weeks_hk2 * t.ppw_hk2
  const toggleProg = (id: string) => {
    const on = picked.includes(id)
    setPicked(on ? picked.filter(x => x !== id) : [...picked, id])
    setItems(on ? items.filter(i => i.curriculum_id !== id) : [...items, ...avail.filter(a => a.curriculum_id === id).map(a => ({ curriculum_id: a.curriculum_id, subject: a.subject }))])
  }
  const has = (a: Avail) => items.some(i => i.curriculum_id === a.curriculum_id && i.subject === a.subject)
  const toggleItem = (a: Avail) => setItems(has(a) ? items.filter(i => !(i.curriculum_id === a.curriculum_id && i.subject === a.subject)) : [...items, { curriculum_id: a.curriculum_id, subject: a.subject }])
  const move = (k: number, d: -1 | 1) => { const x = [...items]; const o = x[k + d]; if (!o) return; x[k + d] = x[k]; x[k] = o; setItems(x) }
  const same = docs.filter(d => grade != null && d.grade === grade)

  async function save() {
    if (!orgId || grade == null) return
    setBusy(true); setMsg('')
    if (copyId) { const { data, error } = await supabase.rpc('ppct_doc_copy', { p_doc: copyId, p_org: orgId, p_year: t.school_year }); setBusy(false)
      if (error) return setMsg(errMsg(error.message)); return onDone(data as string) }
    const tname = target ? orgs.find(o => o.id === target)?.name : 'tất cả trường'
    const { data, error } = await supabase.from('ppct_docs').insert({ org_id: orgId, target_org_id: target || null, level, subject: null, grade, ...t,
      title: `Phân phối ${gradeLabel(grade)} – ${tname}`, issuer: orgs.find(o => o.id === orgId)?.name ?? null }).select('id').single()
    if (error) { setBusy(false); return setMsg(errMsg(error.message)) }
    const id = (data as { id: string }).id
    const r = await supabase.rpc('ppct_doc_build', { p_doc: id, p_items: items, p_replace: true })
    setBusy(false); if (r.error) setMsg(errMsg(r.error.message)); onDone(id)
  }

  const step = (n: number, title: string, body: ReactNode, opt?: boolean, off?: boolean) =>
    <div className={'p1-step' + (off ? ' off' : '')}><div className="no">{n}</div><div className="bd"><h4>{title}{opt && <small> · không bắt buộc</small>}</h4>{!off && body}</div></div>
  return (
    <section className="p1-section">
      <header><h3>Thiết lập phân phối chương trình</h3><small className="sub">Đi theo từ Chương trình giáo dục: chọn đúng khối, hệ thống gợi ý chương trình và môn phù hợp.</small></header>
      {msg && <p className="msg">{msg}</p>}
      <div className="p1-steps">
        {step(0, 'Trường', <select value={target} onChange={e => setTarget(e.target.value)} aria-label="Trường"><option value="">Tất cả các trường</option>
          {orgs.filter(o => o.type === 'school').map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select>, true)}
        {step(1, 'Cấp học', <div className="p1-seg">{catOf(cat, 'level').map(l => <button type="button" key={l.code} className={level === l.code ? 'on' : ''}
          onClick={() => { setLevel(l.code); setGrade(null); setPicked([]); setItems([]) }}>{l.name}</button>)}</div>)}
        {step(2, 'Khối', <div className="p1-seg">{grades.map(g => <button type="button" key={g} className={grade === g ? 'on' : ''}
          onClick={() => { setGrade(g); setPicked([]); setItems([]); setCopyId('') }}>{gradeLabel(g)}</button>)}</div>, false, !level)}
        {step(3, 'Chọn chương trình phù hợp', matchProgs.length ? <div className="p1-pickgrid">{matchProgs.map(p => { const as = avail.filter(a => a.curriculum_id === p.id)
          return <label key={p.id} className={'p1-pick' + (picked.includes(p.id) ? ' on' : '')}><input type="checkbox" checked={picked.includes(p.id)} onChange={() => toggleProg(p.id)} />
            <CtBadge color={p.color} code={p.code} /><b>{p.name}</b><small>{as.length} môn · {as.reduce((a, x) => a + x.lessons, 0)} bài · {as.reduce((a, x) => a + x.periods, 0)} tiết ở {gradeLabel(grade!)}</small></label> })}</div>
          : <Empty>Chưa có chương trình đã phát hành có bài học ở {grade != null ? gradeLabel(grade) : 'khối này'}.</Empty>, false, grade == null)}
        {step(4, 'Chọn môn từ các chương trình', <div className="p1-pickgrid">{avail.filter(a => picked.includes(a.curriculum_id)).map(a => { const p = progs.find(x => x.id === a.curriculum_id)
          return <label key={a.curriculum_id + a.subject} className={'p1-pick' + (has(a) ? ' on' : '')}><input type="checkbox" checked={has(a)} onChange={() => toggleItem(a)} />
            <b>{catName(cat, 'subject', a.subject)}</b><CtBadge color={p?.color} code={p?.code} /><small>{a.lessons} bài · {a.sessions} buổi · {a.periods} tiết</small></label> })}</div>, false, !picked.length)}
        {step(5, 'Xếp lịch: Học kỳ › Tuần › Buổi', <>
          <ol className="p1-order">{items.map((it, k) => { const a = avail.find(x => x.curriculum_id === it.curriculum_id && x.subject === it.subject); const p = progs.find(x => x.id === it.curriculum_id)
            return <li key={it.curriculum_id + it.subject}><span className="no">{k + 1}</span><b>{catName(cat, 'subject', it.subject)}</b><CtBadge color={p?.color} code={p?.code} />
              <small>{a?.lessons} bài · {a?.periods} tiết</small><span className="p1-rowact"><button type="button" onClick={() => move(k, -1)} aria-label="Lên">↑</button><button type="button" onClick={() => move(k, 1)} aria-label="Xuống">↓</button></span></li> })}</ol>
          <div className="p1-form" style={{ marginTop: 10 }}>
            <label>Năm học<input value={t.school_year} onChange={e => setT({ ...t, school_year: e.target.value })} /></label>
            <label>Học kỳ I<span className="p1-inline"><input type="number" min={0} value={t.weeks_hk1} onChange={e => setT({ ...t, weeks_hk1: Number(e.target.value) })} /> tuần ×
              <input type="number" min={0.5} step={0.5} value={t.ppw_hk1} onChange={e => setT({ ...t, ppw_hk1: Number(e.target.value) })} /> tiết</span></label>
            <label>Học kỳ II<span className="p1-inline"><input type="number" min={0} value={t.weeks_hk2} onChange={e => setT({ ...t, weeks_hk2: Number(e.target.value) })} /> tuần ×
              <input type="number" min={0.5} step={0.5} value={t.ppw_hk2} onChange={e => setT({ ...t, ppw_hk2: Number(e.target.value) })} /> tiết</span></label>
            <label>Số phút / tiết<input type="number" min={5} value={t.minutes_per_period} onChange={e => setT({ ...t, minutes_per_period: Number(e.target.value) })} /></label>
          </div>
          <p className="sub">Đã chọn {items.length} môn · {total} tiết / sức chứa {num(cap)} tiết {total > cap ? <Pill tone="warn">vượt {num(total - cap)} tiết</Pill> : null}.
            Môn xếp lần lượt theo thứ tự trên vào Học kỳ I rồi Học kỳ II; sau khi tạo, đổi thứ tự môn / bài, học kỳ, tuần trong bản phân phối.</p>
        </>, false, !items.length)}
      </div>
      {same.length > 0 && <details className="p1-adv"><summary>Hoặc sao chép bản phân phối có sẵn của {grade != null ? gradeLabel(grade) : ''} ({same.length})</summary>
        <select value={copyId} onChange={e => setCopyId(e.target.value)} style={{ marginTop: 8 }}><option value="">— không sao chép —</option>
          {same.map(d => <option key={d.id} value={d.id}>{docName(d, cat)} · {d.school_year}</option>)}</select></details>}
      <div className="p1-actions" style={{ marginTop: 16 }}>
        <button type="button" className="primary" disabled={busy || grade == null || (!copyId && !items.length)} onClick={save}>{busy ? 'Đang tạo…' : copyId ? 'Sao chép' : 'Tạo & xếp lịch'}</button>
      </div>
    </section>
  )
}

// ===== Văn bản PPCT =====
function DocView({ doc, prog, progs, cat, orgName, target, canManage, back, reload, onCopied, onDeleted, crumbs }: {
  doc: Doc; prog: Curriculum | null; progs: Curriculum[]; cat: CatItem[]; orgName: string; target: string; canManage: boolean
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
  // Bản nhiều môn: phân bổ theo môn (mỗi khối lịch là một môn); văn bản một môn: theo mạch nội dung
  const multi = !doc.subject
  const chOf = (l: Line) => chapters.find(c => c.id === l.chapter_id)
  const keyOf = (l: Line) => (multi ? chOf(l)?.subject ?? null : l.strand)
  const by = (s: number, k: string | null) => lines.filter(l => chOf(l)?.semester === s && keyOf(l) === k).reduce((a, l) => a + l.periods, 0)
  const noStrand = lines.some(l => !keyOf(l))
  const cols: [string | null, string][] = [...(multi ? Array.from(new Set(chapters.map(c => c.subject).filter(Boolean) as string[])).map(x => [x, catName(cat, 'subject', x)] as [string, string])
    : strands.map(s => [s.id, s.name] as [string, string])), ...(noStrand ? [[null, multi ? 'Khác' : 'Chưa phân mạch'] as [null, string]] : [])]
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
          <td colSpan={edit ? 6 : 4}>
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
        {cl.map(l => rowEdit === l.id ? <tr key={l.id}><td colSpan={6}><RowForm r={l} strands={strands} onCancel={() => setRowEdit(null)}
            onSave={v => run(supabase.from('ppct_rows').update(v).eq('id', l.id)).then(ok => ok && setRowEdit(null))} /></td></tr>
          : <tr key={l.id} className={'k-' + l.kind}>
            {(edit || span[l.id] !== 0) && <td className="wk" rowSpan={edit ? 1 : span[l.id]}>{l.week}{l.week_override ? <sup title="Tuần đặt tay">*</sup> : null}</td>}
            <td className="tp">{tiet(l)}</td>
            <td className="tp">{l.sessions}</td>
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
        {adding === c.id && <tr><td colSpan={6}><RowForm strands={strands} onCancel={() => setAdding(null)}
          onSave={v => addRows(c, [{ title: v.title!, periods: v.periods ?? 1, kind: v.kind ?? 'bai_hoc', part: v.part_label }]).then(ok => ok && setAdding(null))} /></td></tr>}
        {bulk === c.id && <tr><td colSpan={6}><BulkForm onCancel={() => setBulk(null)} onSave={items => addRows(c, items).then(ok => ok && setBulk(null))} /></td></tr>}
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
          <h2>{multi ? `PHÂN PHỐI CHƯƠNG TRÌNH ${gradeLabel(doc.grade).toUpperCase()}` : `PHÂN PHỐI CHƯƠNG TRÌNH MÔN: ${subj.toUpperCase()} ${doc.grade}`}</h2>
          <div className="yr">NĂM HỌC {doc.school_year.replace('-', '–')}</div>
          <div className="sub">Áp dụng: {target}</div>
        </header>
        <div className="p1-timebox">
          <div><b>Cả năm:</b> {doc.weeks_hk1 + doc.weeks_hk2} tuần{Number(doc.ppw_hk1) === Number(doc.ppw_hk2) ? ` × ${num(doc.ppw_hk1)} tiết/tuần` : ''} = <b>{num(capOf(doc, 1) + capOf(doc, 2))} tiết</b>
            <small> · {doc.minutes_per_period} phút/tiết ≈ {Math.round((capOf(doc, 1) + capOf(doc, 2)) * doc.minutes_per_period / 60)} giờ</small></div>
          {sems.map(s => { const cap = capOf(doc, s); const u = used(s)
            return <div key={s}><b>Học kì {s === 1 ? 'I' : 'II'}:</b> {s === 1 ? doc.weeks_hk1 : doc.weeks_hk2} tuần × {num(s === 1 ? doc.ppw_hk1 : doc.ppw_hk2)} tiết/tuần = <b>{num(cap)} tiết</b>
              {' '}{u === cap ? <Pill tone="good">đã phân phối đủ</Pill> : <Pill tone="warn">đã phân phối {u}/{num(cap)}</Pill>}</div> })}
        </div>

        <div className="p1-dochd"><h3>{multi ? 'Phân bổ số tiết theo môn học' : 'Phân bổ số tiết theo mạch nội dung'}</h3>{canManage && edit && !multi && <button type="button" onClick={() => setStrEdit(!strEdit)}>{strEdit ? 'Đóng' : 'Sửa các cột mạch'}</button>}</div>
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
            <colgroup><col style={{ width: 70 }} /><col style={{ width: 90 }} /><col style={{ width: 64 }} /><col />{edit && <col style={{ width: 150 }} />}{edit && <col style={{ width: 190 }} />}</colgroup>
            <thead><tr><th>Tuần</th><th>Tiết PPCT</th><th>Buổi</th><th>Bài học</th>{edit && <th>Mạch</th>}{edit && <th></th>}</tr></thead>
            <tbody>{semRows(s)}
              {edit && <tr><td colSpan={6}>{newCh === s ? <ChapterForm sem={s} strands={strands} onCancel={() => setNewCh(null)}
                onSave={v => run(supabase.from('ppct_chapters').insert({ ...v, doc_id: doc.id, semester: v.semester ?? s, seq: Math.max(0, ...chapters.filter(c => c.semester === (v.semester ?? s)).map(c => c.seq)) + 1 })).then(ok => ok && setNewCh(null))} />
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

function ChapterForm({ c, sem, strands, onSave, onCancel }: { c?: Chapter; sem?: number; strands: Strand[]; onSave: (v: Partial<Chapter>) => void; onCancel: () => void }) {
  const [t, setT] = useState(c?.title ?? ''); const [s, setS] = useState(c?.strand_id ?? ''); const [n, setN] = useState(c?.note ?? '')
  const [hk, setHk] = useState(c?.semester ?? sem ?? 1)
  return <div className="p1-inlineform">
    <input autoFocus value={t} placeholder="VD: Khoa học tự nhiên · CT2 hoặc Chương I: Đa thức" onChange={e => setT(e.target.value)} style={{ flex: 3 }} />
    <select value={hk} onChange={e => setHk(Number(e.target.value))} aria-label="Học kỳ"><option value={1}>Học kỳ I</option><option value={2}>Học kỳ II</option></select>
    <select value={s} onChange={e => setS(e.target.value)} aria-label="Mạch nội dung"><option value="">— mạch —</option>{strands.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
    <input value={n} placeholder="Ghi chú" onChange={e => setN(e.target.value)} style={{ flex: 2 }} />
    <button type="button" onClick={onCancel}>Huỷ</button><button type="button" className="primary" disabled={!t.trim()} onClick={() => onSave({ title: t.trim(), strand_id: s || null, note: n || null, semester: hk })}>Lưu</button>
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
