import { Fragment, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { Tabs } from '../../../pages/teacher/common'
import { CatalogPanel } from './Catalog'
import { LessonsEditor } from './Lessons'
import { PackagesPanel } from '../packages/Packages'
import { Code, Empty, Pill, Section, Stat, Thumb, Toolbar, VCard, norm, useViewMode } from '../ui'
import {
  CSTATUS, OPEN_LESSON_KEY, SCOPE, catName, catOf, effectiveCatalog, errText, gradeLabel, gradesOfLevel, levelOfGrade, loadContent, useCatalog, useOrgs,
  type CatItem, type Content, type Curriculum, type Scope,
} from './api'
import './curriculum.css'

type Top = 'programs' | 'packages' | 'catalog'
type Info = { lessons: number; sessions: number; periods: number; subjects: string[] }
type Org = { id: string; name: string; type: string; parent_id: string | null }

// 1.1.1 Chương trình giáo dục (docs/PH1-cau-truc-1.1.md, quyết định 23/10/2026):
//   Tổng quan · Thiết lập (1. Thông tin — Cấp học, Khối áp dụng · 2. Bài học — Môn › Chủ đề/Chương (tuỳ chọn) › Bài · 3. Yêu cầu cần đạt).
//   Không còn phiên bản / phê duyệt: chương trình Nháp → Đã phát hành → Ngừng dùng, sửa trực tiếp. Mỗi chương trình một khối.
export function CurriculumPage({ orgId, go }: { orgId: string | null; go?: (p: string) => void }) {
  const [canManage, setCanManage] = useState(false)
  const [isPlatform, setIsPlatform] = useState(false)
  const [list, setList] = useState<Curriculum[]>([])
  const [info, setInfo] = useState<Map<string, Info>>(new Map())
  const [top, setTop] = useState<Top>('programs')
  const [openId, setOpenId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [catKey, setCatKey] = useState(0)
  const [q, setQ] = useState('')
  const [pf, setPf] = useState<Record<string, string>>({})
  const [view, setView] = useViewMode('programs')
  const [msg, setMsg] = useState(''); const [note, setNote] = useState(''); const [err, setErr] = useState('')
  const { all, hidden } = useCatalog(catKey)
  const { orgs, below, me } = useOrgs(orgId)
  const cat = effectiveCatalog(all, hidden, below)

  async function load() {
    if (!orgId) return
    const [c, m, p] = await Promise.all([
      supabase.from('curricula').select('*, owner_name').order('code'),
      supabase.rpc('curriculum_can_manage'),
      supabase.rpc('is_platform_admin'),
    ])
    if (c.error) return setErr(errText(c.error.message))
    const cs = (c.data as Curriculum[]) ?? []
    setList(cs); setCanManage(m.data === true); setIsPlatform(p.data === true)
    const ids = cs.map(x => x.current_version_id).filter(Boolean) as string[]
    if (!ids.length) return setInfo(new Map())
    const le = await supabase.from('curriculum_lessons').select('version_id, subject, sessions, periods').in('version_id', ids)
    const rows = (le.data as { version_id: string; subject: string | null; sessions: number; periods: number }[]) ?? []
    setInfo(new Map(cs.map(x => { const r = rows.filter(y => y.version_id === x.current_version_id)
      return [x.id, { lessons: r.length, sessions: r.reduce((a, y) => a + y.sessions, 0), periods: r.reduce((a, y) => a + y.periods, 0),
        subjects: Array.from(new Set(r.map(y => y.subject).filter(Boolean) as string[])) }] })))
  }
  useEffect(() => { load() }, [orgId])
  if (err) return <p className="msg">{err}</p>
  if (!orgId) return <p className="sub">Đang tải…</p>

  const open = list.find(c => c.id === openId) ?? null
  if (open) return <ProgramDetail key={open.id} cur={open} orgId={orgId} cat={cat} canManage={canManage} orgs={orgs} below={below} isPlatform={isPlatform}
    sourceName={open.source_curriculum_id ? list.find(x => x.id === open.source_curriculum_id)?.name ?? 'chương trình nguồn' : null}
    back={() => { setOpenId(null); load() }} reload={load} go={go} onClone={clone} />

  const qq = norm(q)
  const gradeOf = (c: Curriculum) => c.grades[0] ?? null
  const match = (c: Curriculum) => (!qq || norm(`${c.code} ${c.name} ${c.summary ?? ''}`).includes(qq)) && (!pf.level || c.levels.includes(pf.level))
    && (!pf.grade || gradeOf(c) === Number(pf.grade)) && (!pf.subject || (info.get(c.id)?.subjects ?? []).includes(pf.subject)) && (!pf.status || c.status === pf.status)
  const mine = list.filter(c => c.owner_org_id === orgId && match(c))
  const shared = list.filter(c => c.owner_org_id !== orgId && !below.has(c.owner_org_id) && match(c))
  const children = list.filter(c => below.has(c.owner_org_id) && match(c))

  async function clone(c: Curriculum) {
    const name = prompt(`Kế thừa “${c.code ?? ''} · ${c.name}” thành chương trình của ${me?.name ?? 'đơn vị'} để điều chỉnh. Tên:`, c.name)
    if (name === null) return
    const { data, error } = await supabase.rpc('curriculum_clone', { p_version: c.current_version_id, p_name: name })
    if (error) return setMsg(errText(error.message))
    setNote(`Đã tạo “${name}” (nháp) từ ${c.owner_name}.`); await load(); setOpenId(data as string)
  }
  const statusPill = (c: Curriculum) => <Pill tone={CSTATUS[c.status]?.[1]}>{CSTATUS[c.status]?.[0]}</Pill>
  const lvg = (c: Curriculum) => [c.levels.map(l => catName(cat, 'level', l)).join(', '), gradeOf(c) != null ? gradeLabel(gradeOf(c)!) : ''].filter(Boolean).join(' · ')
  const card = (c: Curriculum, showOwner: boolean) => { const i = info.get(c.id); const sj = i?.subjects ?? []
    return <VCard key={c.id} color={c.color} code={c.code} status={statusPill(c)} title={c.name}
      subtitle={showOwner ? c.owner_name : lvg(c) || 'Chưa chọn khối'} desc={c.summary}
      chips={[...sj.slice(0, 3).map(s => catName(cat, 'subject', s)), sj.length > 3 ? `+${sj.length - 3} môn` : '']}
      foot={<small>{sj.length} môn · {i?.lessons ?? 0} bài · {i?.periods ?? 0} tiết</small>} onClick={() => setOpenId(c.id)} /> }
  const table = (rows: Curriculum[], showOwner: boolean, withClone = false) => (
    <table className="p1-list"><thead><tr><th>Chương trình</th><th>Cấp học · Khối</th><th>Môn học</th><th>Quy mô</th><th>Trạng thái</th>{withClone && <th></th>}</tr></thead>
      <tbody>{rows.map(c => { const i = info.get(c.id); const sj = i?.subjects ?? []
        return <tr key={c.id} onClick={() => setOpenId(c.id)}>
          <td><div className="titlecell"><Thumb color={c.color} code={c.code} /><div><b>{c.name}</b><small>{showOwner ? c.owner_name : c.summary}</small></div></div></td>
          <td>{lvg(c) || '—'}</td>
          <td>{sj.map(s => catName(cat, 'subject', s)).join(', ') || '—'}</td>
          <td>{sj.length} môn · {i?.lessons ?? 0} bài<br /><small className="sub">{i?.periods ?? 0} tiết</small></td>
          <td>{statusPill(c)}</td>
          {withClone && <td>{canManage && <button type="button" onClick={e => { e.stopPropagation(); clone(c) }}>Kế thừa</button>}</td>}
        </tr> })}</tbody></table>)
  const levels = Array.from(new Set(list.flatMap(c => c.levels)))
  const grades = Array.from(new Set(list.map(gradeOf).filter(g => g != null) as number[])).sort((a, b) => a - b)
  const subjects = Array.from(new Set([...info.values()].flatMap(i => i.subjects)))

  return (
    <>
      <div className="bar">
        <Tabs items={[['programs', 'Tổng quan', list.length], ['catalog', 'Danh mục'], ['packages', 'Gói chương trình (chờ xem lại)']] as [Top, string, number?][]}
          value={top} onChange={t => { setTop(t); setCreating(false) }} />
        {top === 'programs' && canManage && <button type="button" className="primary" onClick={() => { setCreating(true); setMsg(''); setNote('') }}>+ Chương trình mới</button>}
      </div>
      {msg && <p className="msg">{msg}</p>}
      {note && <div className="p1-alert good">{note}</div>}

      {top === 'programs' && <>
        {creating && <InfoForm cat={cat} orgs={orgs} below={below} me={me} isPlatform={isPlatform} onCancel={() => setCreating(false)}
          suggestCode={`CT${Math.max(0, ...list.map(c => Number((c.code ?? '').match(/^CT(\d+)$/)?.[1] ?? 0))) + 1}`}
          onSave={async v => {
            const { data, error } = await supabase.rpc('curriculum_create', { p: { ...v, levels: v.level ? [v.level] : [], grades: v.grade != null ? [v.grade] : [] } })
            if (error) return errText(error.message)
            if (v.color) await supabase.from('curricula').update({ color: v.color }).eq('id', data as string)
            if (v.scope === 'selected' && v.targets.length) await supabase.from('curriculum_targets').insert(v.targets.map(org_id => ({ curriculum_id: data as string, org_id })))
            setCreating(false); await load(); setOpenId(data as string); return null
          }} />}
        <Toolbar q={q} onQ={setQ} placeholder="Tìm theo mã, tên, mô tả chương trình…" values={pf} onFilter={(k, v) => setPf({ ...pf, [k]: v })} view={view} onView={setView} filters={[
          { key: 'level', label: 'Tất cả cấp học', options: levels.map(l => ({ value: l, label: catName(cat, 'level', l) })) },
          { key: 'grade', label: 'Tất cả khối', options: grades.map(g => ({ value: String(g), label: gradeLabel(g) })) },
          { key: 'subject', label: 'Tất cả môn', options: subjects.map(s => ({ value: s, label: catName(cat, 'subject', s) })) },
          { key: 'status', label: 'Mọi trạng thái', options: Object.entries(CSTATUS).map(([k, [l]]) => ({ value: k, label: l })) },
        ]} />
        <h3 className="cur-group">{me?.type === 'provider' ? 'Chương trình của KDI' : `Chương trình của ${me?.name ?? 'đơn vị'}`} <small>{mine.length}</small></h3>
        {!mine.length ? <Empty>{canManage ? 'Chưa có chương trình riêng. Bấm “+ Chương trình mới” hoặc kế thừa một chương trình bên dưới.' : 'Đơn vị chưa có chương trình riêng.'}</Empty>
          : view === 'grid' ? <div className="p1-grid">{mine.map(c => card(c, false))}</div> : table(mine, false)}
        {shared.length > 0 && <>
          <h3 className="cur-group">Được phát hành tới đơn vị <small>{shared.length}</small></h3>
          {view === 'grid' ? <div className="p1-grid">{shared.map(c => <div key={c.id} className="cur-cardwrap">{card(c, true)}
            {canManage && <button type="button" className="linkbtn" onClick={() => clone(c)}>Kế thừa để điều chỉnh</button>}</div>)}</div> : table(shared, true, true)}
        </>}
        {children.length > 0 && <>
          <h3 className="cur-group">Của đơn vị trực thuộc <small>{children.length}</small></h3>
          {view === 'grid' ? <div className="p1-grid">{children.map(c => card(c, true))}</div> : table(children, true)}
        </>}
      </>}
      {top === 'packages' && <PackagesPanel orgId={orgId} cat={cat} programs={list} canManage={canManage} orgs={orgs} below={below} />}
      {top === 'catalog' && <CatalogPanel orgId={orgId} all={all} hidden={hidden} orgs={orgs} below={below} canManage={canManage} isPlatform={isPlatform} onChange={() => setCatKey(k => k + 1)} />}
    </>
  )
}

// ===== 1. Thông tin (tạo mới / sửa) =====
type InfoVals = { name: string; code: string; color: string; summary: string; issuer: string; category: string; level: string; grade: number | null
  scope: Scope; targets: string[] }
function InfoForm({ cur, cat, orgs, below, me, isPlatform, targets, onSave, onCancel, readOnly, suggestCode, embedded }: {
  cur?: Curriculum; cat: CatItem[]; orgs: Org[]; below: Set<string>; me: { id: string; name: string; type: string } | null; isPlatform: boolean; targets?: string[]
  onSave: (v: InfoVals) => Promise<string | null>; onCancel?: () => void; readOnly?: boolean; suggestCode?: string; embedded?: boolean
}) {
  const g0 = cur?.grades[0] ?? null
  const [v, setV] = useState<InfoVals>(() => ({
    name: cur?.name ?? '', code: cur?.code ?? suggestCode ?? '', color: cur?.color ?? '#2a78d6', summary: cur?.summary ?? '', issuer: cur?.issuer ?? me?.name ?? '',
    category: cur?.category ?? '', level: cur?.levels[0] ?? (g0 != null ? levelOfGrade(cat, g0) : ''), grade: g0,
    scope: cur?.scope ?? (me?.type === 'school' ? 'own' : me?.type === 'provider' ? 'public' : 'children'), targets: targets ?? [],
  }))
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [saved, setSaved] = useState(false)
  const canPublic = me?.type === 'provider' || isPlatform
  const ro = !!readOnly
  const belowList = orgs.filter(o => below.has(o.id))
  const set = (p: Partial<InfoVals>) => { setV({ ...v, ...p }); setSaved(false) }
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (!v.name.trim()) return setErr('Nhập tên chương trình.')
    if (!v.level || v.grade == null) return setErr('Chọn cấp học và khối áp dụng.')
    if (v.scope === 'selected' && v.targets.length === 0) return setErr('Chọn ít nhất một đơn vị nhận.')
    setBusy(true); const m = await onSave({ ...v, name: v.name.trim(), code: v.code.trim() }); setBusy(false); setErr(m ?? ''); setSaved(!m)
  }
  const body = <>
    <div className="p1-form">
      <label style={{ gridColumn: 'span 2' }}><span>Tên chương trình *</span><input required disabled={ro} value={v.name} onChange={e => set({ name: e.target.value })} placeholder="VD: Tích hợp nội môn" /></label>
      <label><span>Nhóm chương trình</span><select disabled={ro} value={v.category} onChange={e => { const c = catOf(cat, 'category').find(x => x.code === e.target.value)
        set({ category: e.target.value, color: c?.color ?? v.color }) }}>
        <option value="">— chọn —</option>{catOf(cat, 'category').map(c => <option key={c.id} value={c.code}>{c.code} · {c.name}</option>)}</select></label>
      <label><span>Cấp học *</span><select disabled={ro} value={v.level} onChange={e => set({ level: e.target.value, grade: null })}>
        <option value="">— chọn —</option>{catOf(cat, 'level').map(l => <option key={l.code} value={l.code}>{l.name}</option>)}</select></label>
      <label><span>Khối áp dụng *</span><select disabled={ro || !v.level} value={v.grade ?? ''} onChange={e => set({ grade: e.target.value === '' ? null : Number(e.target.value) })}>
        <option value="">— chọn —</option>{(v.level ? gradesOfLevel(cat, v.level) : []).map(g => <option key={g} value={g}>{gradeLabel(g)}</option>)}</select></label>
      <label className="wide"><span>Mô tả</span><textarea rows={3} disabled={ro} value={v.summary} onChange={e => set({ summary: e.target.value })}
        placeholder="Chương trình nhằm… dành cho học sinh…" /></label>
    </div>
    <details className="p1-adv"><summary>Thiết lập nâng cao (mã, màu, phạm vi áp dụng)</summary>
      <div className="p1-form">
        <label><span>Mã chương trình</span><input disabled={ro} value={v.code} onChange={e => set({ code: e.target.value })} placeholder="CT1, CT6…" /></label>
        <label><span>Màu nhận diện</span><input type="color" disabled={ro} value={v.color} onChange={e => set({ color: e.target.value })} style={{ height: 40, padding: 4 }} /></label>
        <label><span>Đơn vị xây dựng / ban hành</span><input disabled={ro} value={v.issuer} onChange={e => set({ issuer: e.target.value })} /></label>
        <label><span>Phạm vi áp dụng</span><select disabled={ro} value={v.scope} onChange={e => set({ scope: e.target.value as Scope })}>
          {(Object.keys(SCOPE) as Scope[]).filter(s => s !== 'public' || canPublic).map(s => <option key={s} value={s}>{SCOPE[s]}</option>)}</select></label>
        {v.scope === 'selected' && <fieldset className="libtargets wide" disabled={ro}><legend>Đơn vị nhận</legend>
          {belowList.length === 0 && <p className="sub">Đơn vị chưa có cấp dưới.</p>}
          {belowList.map(o => <label key={o.id}><input type="checkbox" checked={v.targets.includes(o.id)}
            onChange={e => set({ targets: e.target.checked ? [...v.targets, o.id] : v.targets.filter(x => x !== o.id) })} /> {o.name}</label>)}
        </fieldset>}
      </div>
    </details>
    {err && <p className="msg">{err}</p>}
    {!ro && <div className="formactions"><button className="primary" type="submit" disabled={busy}>{cur ? 'Lưu thông tin' : 'Tạo chương trình'}</button>
      {onCancel && <button type="button" onClick={onCancel}>Huỷ</button>}{saved && <span className="sub">Đã lưu.</span>}</div>}
  </>
  return embedded ? <form onSubmit={submit}>{body}</form> : (
    <form className="p1-section" onSubmit={submit}>
      <header><h3>Chương trình mới</h3><small className="sub">Sau khi tạo, thêm Môn › Bài học ở phần “Bài học” của tab Thiết lập.</small></header>
      {body}
    </form>
  )
}

// ===== Chi tiết một chương trình: Tổng quan · Thiết lập =====
type DTab = 'overview' | 'setup'
function ProgramDetail({ cur, orgId, cat, canManage, orgs, below, isPlatform, sourceName, back, reload, go, onClone }: {
  cur: Curriculum; orgId: string; cat: CatItem[]; canManage: boolean; orgs: Org[]; below: Set<string>; isPlatform: boolean; sourceName: string | null
  back: () => void; reload: () => void; go?: (p: string) => void; onClone: (c: Curriculum) => void
}) {
  const [content, setContent] = useState<Content | null>(null)
  const [targets, setTargets] = useState<string[]>([])
  const [pkgs, setPkgs] = useState<{ name: string; tier: string | null; subject: string | null; grades: number[] }[]>([])
  const [tab, setTab] = useState<DTab>('overview')
  const [msg, setMsg] = useState(''); const [note, setNote] = useState('')
  const isOwner = cur.owner_org_id === orgId
  const editable = isOwner && canManage
  const me = orgs.find(o => o.id === orgId) ?? null
  const vid = cur.current_version_id

  const loadC = async () => { if (vid) setContent(await loadContent(vid)) }
  useEffect(() => {
    loadC()
    supabase.from('curriculum_targets').select('org_id').eq('curriculum_id', cur.id).then(({ data }) => setTargets(((data as { org_id: string }[]) ?? []).map(x => x.org_id)))
    supabase.from('program_package_items').select('subject, grades, program_packages(name, tier)').eq('curriculum_id', cur.id)
      .then(({ data }) => setPkgs(((data as any[]) ?? []).map(x => ({ name: x.program_packages?.name ?? '', tier: x.program_packages?.tier ?? null, subject: x.subject, grades: x.grades }))))
  }, [cur.id])

  async function saveInfo(v: InfoVals) {
    const { error } = await supabase.from('curricula').update({
      name: v.name, code: v.code || null, color: v.color, category: v.category || null, summary: v.summary.trim() || null, issuer: v.issuer.trim() || null,
      levels: v.level ? [v.level] : [], grades: v.grade != null ? [v.grade] : [], scope: v.scope,
    }).eq('id', cur.id)
    if (error) return errText(error.message)
    await supabase.from('curriculum_targets').delete().eq('curriculum_id', cur.id)
    if (v.scope === 'selected' && v.targets.length) {
      const t = await supabase.from('curriculum_targets').insert(v.targets.map(org_id => ({ curriculum_id: cur.id, org_id })))
      if (t.error) return errText(t.error.message)
    }
    setTargets(v.targets); reload(); return null
  }
  async function setStatus(status: Curriculum['status'], ask?: string) {
    if (ask && !confirm(ask)) return
    const { error } = await supabase.from('curricula').update({ status }).eq('id', cur.id)
    if (error) return setMsg(errText(error.message))
    setMsg(''); setNote(status === 'published' ? 'Đã phát hành.' : status === 'archived' ? 'Đã ngừng dùng — không còn được chọn khi phân phối.' : 'Đã chuyển về nháp.'); reload()
  }
  async function removeProgram() {
    if (!confirm(`Xoá chương trình “${cur.name}” cùng mọi môn, chủ đề, bài học?${pkgs.length ? ` Chương trình đang nằm trong ${pkgs.length} gói — các dòng gói này cũng bị gỡ.` : ''} Học liệu, phân phối gắn chương trình được giữ lại nhưng bỏ liên kết. Không hoàn tác được.`)) return
    const { data, error } = await supabase.from('curricula').delete().eq('id', cur.id).select('id')
    if (error) return setMsg(errText(error.message))
    if (!data?.length) return setMsg('Không xoá được — chỉ đơn vị xây dựng chương trình mới xoá được.')
    back()
  }
  async function saveOutcomes(text: string) {
    if (text === (cur.outcomes_text ?? '')) return
    const { error } = await supabase.from('curricula').update({ outcomes_text: text.trim() || null }).eq('id', cur.id)
    if (error) setMsg(errText(error.message)); else { setNote('Đã lưu yêu cầu cần đạt.'); reload() }
  }
  const openMaterial = (lessonId: string) => { try { sessionStorage.setItem(OPEN_LESSON_KEY, lessonId) } catch { /* bỏ qua */ } go?.('Học liệu') }
  const g = cur.grades[0] ?? null

  return (
    <>
      <div className="p1-head">
        <button type="button" onClick={back}>← Quay lại</button>
        <Code color={cur.color}>{cur.code ?? '—'}</Code>
        <h2>{cur.name}</h2>
        <Pill tone={CSTATUS[cur.status]?.[1]}>{CSTATUS[cur.status]?.[0]}</Pill>
        <span className="p1-actions" style={{ marginLeft: 'auto' }}>
          {editable && cur.status === 'draft' && <button type="button" className="primary" onClick={() => setStatus('published')}>Phát hành</button>}
          {editable && cur.status === 'published' && <button type="button" onClick={() => setStatus('draft', 'Chuyển chương trình về nháp? Đơn vị khác sẽ không còn thấy chương trình.')}>Chuyển về nháp</button>}
          {editable && cur.status !== 'archived' && <button type="button" onClick={() => setStatus('archived', 'Ngừng dùng chương trình? Chương trình không còn được chọn khi phân phối.')}>Ngừng dùng</button>}
          {editable && cur.status === 'archived' && <button type="button" onClick={() => setStatus('published')}>Dùng lại</button>}
          {!isOwner && canManage && <button type="button" onClick={() => onClone(cur)}>Kế thừa để điều chỉnh</button>}
          {editable && <button type="button" className="danger" onClick={removeProgram}>Xoá chương trình</button>}
        </span>
        <p className="p1-sub">{[cur.issuer ?? cur.owner_name, cur.levels.map(l => catName(cat, 'level', l)).join(', '), g != null ? gradeLabel(g) : '', SCOPE[cur.scope]].filter(Boolean).join(' · ')}
          {sourceName && <> · Kế thừa từ <b>{sourceName}</b></>}{!editable && <> · <i>chỉ xem</i></>}</p>
      </div>
      {msg && <p className="msg">{msg}</p>}
      {note && <p className="sub"><b>{note}</b></p>}
      <div className="bar"><Tabs items={[['overview', 'Tổng quan'], ['setup', 'Thiết lập', content?.lessons.length]] as [DTab, string, number?][]} value={tab} onChange={setTab} /></div>

      {!vid ? <Empty>Chương trình chưa có nội dung.</Empty> : !content ? <p className="sub">Đang tải…</p> : <Fragment key={vid}>
        {tab === 'overview' && <Overview cur={cur} content={content} cat={cat} pkgs={pkgs} onOpen={() => setTab('setup')} />}
        {tab === 'setup' && <div className="p1-setup">
          <Section title="1. Thông tin">
            <InfoForm embedded cur={cur} cat={cat} orgs={orgs} below={below} me={me} isPlatform={isPlatform} targets={targets} readOnly={!editable} onSave={saveInfo} />
          </Section>
          <Section title="2. Bài học">
            <LessonsEditor orgId={orgId} versionId={vid} content={content} cat={cat} grade={g} editable={editable} reload={loadC} setMsg={setMsg} onOpenMaterial={go ? openMaterial : undefined} />
          </Section>
          <Section title="3. Yêu cầu cần đạt">
            <div className="p1-outcomes">{editable
              ? <textarea defaultValue={cur.outcomes_text ?? ''} placeholder="Học sinh đạt được… (mỗi ý một dòng)" onBlur={e => saveOutcomes(e.target.value)} aria-label="Yêu cầu cần đạt" />
              : cur.outcomes_text ? <p className="p1-text" style={{ whiteSpace: 'pre-line', margin: 0 }}>{cur.outcomes_text}</p> : <Empty>Chưa nhập yêu cầu cần đạt.</Empty>}</div>
          </Section>
        </div>}
      </Fragment>}
    </>
  )
}

function Overview({ cur, content, cat, pkgs, onOpen }: {
  cur: Curriculum; content: Content; cat: CatItem[]; pkgs: { name: string; tier: string | null; subject: string | null; grades: number[] }[]; onOpen: () => void
}) {
  const subjects = Array.from(new Set([...content.subjects.map(s => s.subject), ...content.lessons.map(l => l.subject).filter(Boolean) as string[]]))
  const by = (s: string) => content.lessons.filter(l => l.subject === s)
  const periods = content.lessons.reduce((a, l) => a + l.periods, 0)
  const g = cur.grades[0]
  return (<>
    <div className="p1-stats">
      <Stat label="Cấp học · Khối" value={g != null ? gradeLabel(g) : '—'} sub={cur.levels.map(l => catName(cat, 'level', l)).join(', ') || 'chưa chọn'} />
      <Stat label="Môn học" value={subjects.length} />
      <Stat label="Bài học" value={content.lessons.length} sub={`${content.lessons.reduce((a, l) => a + l.sessions, 0)} buổi`} />
      <Stat label="Tổng số tiết" value={periods} />
    </div>
    {cur.summary && <Section title="Mô tả"><p style={{ margin: 0 }}>{cur.summary}</p></Section>}
    <Section title="Môn học" actions={<button type="button" onClick={onOpen}>Mở Thiết lập ›</button>}>
      {subjects.length === 0 ? <Empty>Chưa có môn, bài học.</Empty> : (
        <table className="p1-table">
          <thead><tr><th>Môn học</th><th>Chủ đề/Chương</th><th>Bài</th><th>Buổi</th><th>Tiết</th></tr></thead>
          <tbody>{subjects.map(s => { const ls = by(s)
            return <tr key={s}><td><b>{catName(cat, 'subject', s)}</b></td><td>{content.units.filter(u => u.subject_main === s).length || '—'}</td>
              <td><button type="button" className="linkbtn" onClick={onOpen}>{ls.length} bài</button></td>
              <td>{ls.reduce((a, l) => a + l.sessions, 0)}</td><td>{ls.reduce((a, l) => a + l.periods, 0)}</td></tr> })}</tbody>
        </table>)}
    </Section>
    <Section title="Yêu cầu cần đạt">{cur.outcomes_text ? <p className="p1-text" style={{ whiteSpace: 'pre-line', margin: 0 }}>{cur.outcomes_text}</p> : <Empty>Chưa nhập — thêm ở tab Thiết lập.</Empty>}</Section>
    <Section title="Được dùng trong gói chương trình">
      {pkgs.length === 0 ? <Empty>Chương trình chưa nằm trong gói nào.</Empty> :
        <div className="p1-chips">{pkgs.map((p, i) => <Pill key={i} tone={p.tier === 'nang_cao' ? 'info' : ''}>{p.name}{p.subject ? ` · ${catName(cat, 'subject', p.subject)}` : ''}</Pill>)}</div>}
    </Section>
  </>)
}
