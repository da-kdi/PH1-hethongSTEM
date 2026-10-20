import { Fragment, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { Tabs } from '../../../pages/teacher/common'
import { CatalogPanel } from './Catalog'
import { StructureEditor, MultiPick } from './Structure'
import { OutcomesEditor } from './Outcomes'
import { VersionsPanel, VStatusPill } from './Versions'
import { SubjectsEditor } from './Subjects'
import { PackagesPanel } from '../packages/Packages'
import { Code, Empty, Pill, Section, SideNav, Stat } from '../ui'
import {
  GRADES, SCOPE, catName, catOf, effectiveCatalog, errText, fmtDate, gradeLabel, labelsOf, loadContent, useCatalog, useOrgs, vName,
  type CatItem, type Content, type Curriculum, type Labels, type Scope, type Version,
} from './api'
import './curriculum.css'

type Top = 'programs' | 'packages' | 'catalog'
type Info = { units: number; lessons: number; subjects: { subject: string; grade: number }[]; periods: number }

// 1.1.1 Chương trình giáo dục — định nghĩa nội dung & quy định chuyên môn. Mã CT1, CT2… CTn là dữ liệu: thêm chương trình mới
// không cần sửa hệ thống. Gói chương trình (Cơ bản / Nâng cao / riêng) chọn chương trình, môn, khối, phiên bản để cung cấp cho trường.
export function CurriculumPage({ orgId, go }: { orgId: string | null; go?: (p: string) => void }) {
  const [canManage, setCanManage] = useState(false)
  const [isPlatform, setIsPlatform] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [list, setList] = useState<Curriculum[]>([])
  const [versions, setVersions] = useState<Version[]>([])
  const [info, setInfo] = useState<Map<string, Info>>(new Map())
  const [top, setTop] = useState<Top>('programs')
  const [openId, setOpenId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [catKey, setCatKey] = useState(0)
  const [q, setQ] = useState('')
  const [msg, setMsg] = useState(''); const [note, setNote] = useState(''); const [err, setErr] = useState('')
  const { all, hidden } = useCatalog(catKey)
  const { orgs, below, me } = useOrgs(orgId)
  const cat = effectiveCatalog(all, hidden, below)

  async function load() {
    if (!orgId) return
    const [c, v, m, p, u] = await Promise.all([
      supabase.from('curricula').select('*, owner_name').order('code'),
      supabase.from('curriculum_versions').select('*').order('version_no'),
      supabase.rpc('curriculum_can_manage'),
      supabase.rpc('is_platform_admin'),
      supabase.auth.getUser(),
    ])
    if (c.error) return setErr(errText(c.error.message))
    const cs = (c.data as Curriculum[]) ?? [], vs = (v.data as Version[]) ?? []
    setList(cs); setVersions(vs); setCanManage(m.data === true); setIsPlatform(p.data === true); setUserId(u.data.user?.id ?? null)
    // Quy mô theo phiên bản đang hiệu lực (hoặc bản mới nhất)
    const key = new Map(cs.map(x => [x.id, x.current_version_id ?? vs.filter(y => y.curriculum_id === x.id).sort((a, b) => b.version_no - a.version_no)[0]?.id ?? '']))
    const ids = [...key.values()].filter(Boolean)
    if (!ids.length) return setInfo(new Map())
    const [su, un, le] = await Promise.all([
      supabase.from('curriculum_subjects').select('version_id, subject, grade, periods_total').in('version_id', ids),
      supabase.from('curriculum_units').select('version_id, periods').in('version_id', ids),
      supabase.from('curriculum_lessons').select('version_id').in('version_id', ids),
    ])
    const m2 = new Map<string, Info>()
    for (const [cid, vid] of key) {
      const s = ((su.data as any[]) ?? []).filter(x => x.version_id === vid)
      m2.set(cid, { subjects: s, periods: s.reduce((a, x) => a + x.periods_total, 0) || ((un.data as any[]) ?? []).filter(x => x.version_id === vid).reduce((a, x) => a + x.periods, 0),
        units: ((un.data as any[]) ?? []).filter(x => x.version_id === vid).length, lessons: ((le.data as any[]) ?? []).filter(x => x.version_id === vid).length })
    }
    setInfo(m2)
  }
  useEffect(() => { load() }, [orgId])
  if (err) return <p className="msg">{err}</p>
  if (!orgId) return <p className="sub">Đang tải…</p>

  const open = list.find(c => c.id === openId) ?? null
  if (open) return <ProgramDetail key={open.id} cur={open} orgId={orgId} cat={cat} canManage={canManage} userId={userId} orgs={orgs} below={below} isPlatform={isPlatform}
    sourceName={open.source_curriculum_id ? list.find(x => x.id === open.source_curriculum_id)?.name ?? 'chương trình nguồn' : null}
    newerSource={!!open.source_curriculum_id && list.some(x => x.id === open.source_curriculum_id && x.current_version_id !== open.source_version_id)}
    back={() => { setOpenId(null); load() }} reload={load} go={go} />

  const match = (c: Curriculum) => !q || `${c.code} ${c.name} ${c.summary ?? ''}`.toLowerCase().includes(q.toLowerCase())
  const mine = list.filter(c => c.owner_org_id === orgId && match(c))
  const shared = list.filter(c => c.owner_org_id !== orgId && !below.has(c.owner_org_id) && c.current_version_id && match(c))
  const children = list.filter(c => below.has(c.owner_org_id) && match(c))

  async function clone(c: Curriculum) {
    const name = prompt(`Kế thừa “${c.code} · ${c.name}” thành chương trình của ${me?.name ?? 'đơn vị'} để điều chỉnh. Tên:`, c.name)
    if (name === null) return
    const { data, error } = await supabase.rpc('curriculum_clone', { p_version: c.current_version_id, p_name: name })
    if (error) return setMsg(errText(error.message))
    setNote(`Đã tạo “${name}” (bản nháp) từ ${c.owner_name}.`); await load(); setOpenId(data as string)
  }
  const card = (c: Curriculum, showOwner: boolean) => {
    const i = info.get(c.id)
    const vs = versions.filter(v => v.curriculum_id === c.id)
    const wip = vs.find(v => ['draft', 'pending', 'approved', 'rejected'].includes(v.status))
    const cur = vs.find(v => v.id === c.current_version_id)
    const subj = Array.from(new Set((i?.subjects ?? []).map(s => s.subject)))
    return (
      <button type="button" className="p1-card" key={c.id} onClick={() => setOpenId(c.id)}>
        <i className="p1-stripe" style={{ background: c.color ?? '#475569' }} />
        <div className="p1-cardtop"><Code color={c.color}>{c.code ?? '—'}</Code><h4>{c.name}</h4></div>
        {c.summary && <p>{c.summary}</p>}
        <div className="p1-chips">{subj.slice(0, 4).map(s => <Pill key={s}>{catName(cat, 'subject', s)}</Pill>)}{subj.length > 4 && <Pill>+{subj.length - 4}</Pill>}</div>
        <div className="p1-cardfoot">
          <span>{c.grades.length ? 'Khối ' + c.grades.join(', ') : 'Chưa chọn khối'}</span><span>·</span>
          <span>{i?.units ?? 0} chủ đề · {i?.periods ?? 0} tiết</span><span>·</span>
          <span>{vs.length} phiên bản</span>
          <span style={{ marginLeft: 'auto' }}>{cur ? <Pill tone="good">● {cur.label ?? `PB ${cur.version_no}`}</Pill> : wip ? <VStatusPill s={wip.status} /> : <Pill>Chưa ban hành</Pill>}</span>
        </div>
        {showOwner && <small className="sub">{c.owner_name}</small>}
      </button>
    )
  }

  return (
    <>
      <div className="bar">
        <Tabs items={[['programs', 'Chương trình', list.length], ['packages', 'Gói chương trình'], ['catalog', 'Danh mục']] as [Top, string, number?][]}
          value={top} onChange={t => { setTop(t); setCreating(false) }} />
        {top === 'programs' && <div className="actions">
          <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Tìm mã, tên chương trình…" aria-label="Tìm chương trình" style={{ minWidth: 220 }} />
          {canManage && <button type="button" className="primary" onClick={() => { setCreating(true); setMsg(''); setNote('') }}>+ Chương trình mới</button>}
        </div>}
      </div>
      {msg && <p className="msg">{msg}</p>}
      {note && <p className="sub"><b>{note}</b></p>}

      {top === 'programs' && <>
        {creating && <InfoForm cat={cat} orgs={orgs} below={below} me={me} isPlatform={isPlatform} onCancel={() => setCreating(false)}
          suggestCode={`CT${Math.max(0, ...list.map(c => Number((c.code ?? '').match(/^CT(\d+)$/)?.[1] ?? 0))) + 1}`}
          onSave={async v => {
            const { data, error } = await supabase.rpc('curriculum_create', { p: v })
            if (error) return errText(error.message)
            if (v.color) await supabase.from('curricula').update({ color: v.color }).eq('id', data as string)
            setCreating(false); await load(); setOpenId(data as string); return null
          }} />}
        <h3 className="cur-group">{me?.type === 'provider' ? 'Chương trình của KDI' : `Chương trình của ${me?.name ?? 'đơn vị'}`} <small>{mine.length}</small></h3>
        {mine.length ? <div className="p1-grid">{mine.map(c => card(c, false))}</div>
          : <Empty>{canManage ? 'Chưa có chương trình riêng. Bấm “+ Chương trình mới” hoặc kế thừa một chương trình bên dưới.' : 'Đơn vị chưa có chương trình riêng.'}</Empty>}
        {shared.length > 0 && <>
          <h3 className="cur-group">Được phát hành tới đơn vị <small>{shared.length}</small></h3>
          <div className="p1-grid">{shared.map(c => <div key={c.id} className="cur-cardwrap">{card(c, true)}
            {canManage && <button type="button" className="linkbtn" onClick={() => clone(c)}>Kế thừa để điều chỉnh</button>}</div>)}</div>
        </>}
        {children.length > 0 && <>
          <h3 className="cur-group">Của đơn vị trực thuộc <small>{children.length}</small></h3>
          <div className="p1-grid">{children.map(c => card(c, true))}</div>
        </>}
      </>}
      {top === 'packages' && <PackagesPanel orgId={orgId} cat={cat} programs={list} canManage={canManage} orgs={orgs} below={below} />}
      {top === 'catalog' && <CatalogPanel orgId={orgId} all={all} hidden={hidden} orgs={orgs} below={below} canManage={canManage} isPlatform={isPlatform} onChange={() => setCatKey(k => k + 1)} />}
    </>
  )
}

// ===== Thông tin chung (tạo mới / sửa) =====
type InfoVals = { name: string; code: string; color: string; summary: string; issuer: string; levels: string[]; grades: number[]; subjects: string[]
  fields: string[]; scope: Scope; require_approval: boolean; structure_labels: Labels; targets: string[] }
function InfoForm({ cur, cat, orgs, below, me, isPlatform, targets, onSave, onCancel, readOnly, suggestCode }: {
  cur?: Curriculum; cat: CatItem[]; orgs: { id: string; name: string; type: string; parent_id: string | null }[]; below: Set<string>
  me: { id: string; name: string; type: string } | null; isPlatform: boolean; targets?: string[]
  onSave: (v: InfoVals) => Promise<string | null>; onCancel?: () => void; readOnly?: boolean; suggestCode?: string
}) {
  const [v, setV] = useState<InfoVals>(() => ({
    name: cur?.name ?? '', code: cur?.code ?? suggestCode ?? '', color: cur?.color ?? '#2a78d6', summary: cur?.summary ?? '', issuer: cur?.issuer ?? me?.name ?? '',
    levels: cur?.levels ?? [], grades: cur?.grades ?? [], subjects: cur?.subjects ?? [], fields: cur?.fields ?? [],
    scope: cur?.scope ?? (me?.type === 'school' ? 'own' : me?.type === 'provider' ? 'public' : 'children'), require_approval: cur?.require_approval ?? false,
    structure_labels: labelsOf(cur ?? null), targets: targets ?? [],
  }))
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const canPublic = me?.type === 'provider' || isPlatform
  const ro = !!readOnly
  const belowList = orgs.filter(o => below.has(o.id))
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (!v.name.trim() || !v.code.trim()) return setErr('Nhập mã và tên chương trình.')
    if (v.scope === 'selected' && v.targets.length === 0) return setErr('Chọn ít nhất một đơn vị nhận.')
    setBusy(true); const m = await onSave({ ...v, name: v.name.trim(), code: v.code.trim() }); setBusy(false); setErr(m ?? '')
  }
  return (
    <form className="p1-section" onSubmit={submit}>
      {!cur && <header><h3>Chương trình mới</h3></header>}
      <div className="p1-form">
        <label><span>Mã chương trình * <small>(CT1, CT2… hoặc mã riêng)</small></span><input required disabled={ro} value={v.code} onChange={e => setV({ ...v, code: e.target.value })} /></label>
        <label className="wide" style={{ gridColumn: 'span 2' }}><span>Tên chương trình *</span><input required disabled={ro} value={v.name} onChange={e => setV({ ...v, name: e.target.value })} placeholder="VD: Tích hợp nội môn" /></label>
        <label><span>Màu nhận diện</span><input type="color" disabled={ro} value={v.color} onChange={e => setV({ ...v, color: e.target.value })} style={{ height: 40, padding: 4 }} /></label>
        <label style={{ gridColumn: 'span 2' }}><span>Đơn vị xây dựng / ban hành</span><input disabled={ro} value={v.issuer} onChange={e => setV({ ...v, issuer: e.target.value })} /></label>
        <label><span>Phạm vi áp dụng</span><select disabled={ro} value={v.scope} onChange={e => setV({ ...v, scope: e.target.value as Scope })}>
          {(Object.keys(SCOPE) as Scope[]).filter(s => s !== 'public' || canPublic).map(s => <option key={s} value={s}>{SCOPE[s]}</option>)}</select></label>
        <label><span>Phê duyệt</span><select disabled={ro} value={v.require_approval ? '1' : '0'} onChange={e => setV({ ...v, require_approval: e.target.value === '1' })}>
          <option value="0">Ban hành không cần duyệt</option><option value="1">Phải duyệt trước khi ban hành</option></select></label>
        <label className="wide"><span>Mục tiêu / đối tượng áp dụng</span><textarea rows={3} disabled={ro} value={v.summary} onChange={e => setV({ ...v, summary: e.target.value })} /></label>
        <div className="wide"><span className="sub">Cấp học</span><MultiPick label="Cấp học" items={catOf(cat, 'level')} value={v.levels} disabled={ro} onChange={x => setV({ ...v, levels: x })} /></div>
        <div className="wide"><span className="sub">Khối lớp</span>
          <div className="cur-chips">{GRADES.map(g => { const on = v.grades.includes(g); return <button type="button" key={g} disabled={ro} className={'chip' + (on ? ' on' : '')} aria-pressed={on}
            onClick={() => setV({ ...v, grades: on ? v.grades.filter(x => x !== g) : [...v.grades, g].sort((a, b) => a - b) })}>{gradeLabel(g)}</button> })}</div></div>
        <div className="wide"><span className="sub">Lĩnh vực</span><MultiPick label="Lĩnh vực" items={catOf(cat, 'field')} value={v.fields} disabled={ro} onChange={x => setV({ ...v, fields: x })} /></div>
        <fieldset className="cur-labels wide" disabled={ro}><legend>Tên các cấp cấu trúc (mỗi chương trình tự đặt)</legend>
          {(['unit', 'lesson', 'period'] as const).map(k => <label className="field" key={k}><span>{({ unit: 'Cấp 1 (vd Chủ đề, Mạch nội dung)', lesson: 'Cấp 2 (vd Bài học, Dự án)', period: 'Đơn vị thời lượng (vd Tiết, Buổi)' })[k]}</span>
            <input value={v.structure_labels[k]} onChange={e => setV({ ...v, structure_labels: { ...v.structure_labels, [k]: e.target.value } })} /></label>)}
        </fieldset>
      </div>
      {v.scope === 'selected' && <fieldset className="libtargets" disabled={ro}><legend>Đơn vị nhận</legend>
        {belowList.length === 0 && <p className="sub">Đơn vị chưa có cấp dưới.</p>}
        {belowList.map(o => <label key={o.id}><input type="checkbox" checked={v.targets.includes(o.id)}
          onChange={e => setV({ ...v, targets: e.target.checked ? [...v.targets, o.id] : v.targets.filter(x => x !== o.id) })} /> {o.name}</label>)}
      </fieldset>}
      {err && <p className="msg">{err}</p>}
      {!ro && <div className="formactions"><button className="primary" type="submit" disabled={busy}>{cur ? 'Lưu thông tin chung' : 'Tạo chương trình'}</button>
        {onCancel && <button type="button" onClick={onCancel}>Huỷ</button>}</div>}
    </form>
  )
}

// ===== Chi tiết một chương trình =====
type DTab = 'overview' | 'subjects' | 'structure' | 'outcomes' | 'versions' | 'info'
function ProgramDetail({ cur, orgId, cat, canManage, userId, orgs, below, isPlatform, sourceName, newerSource, back, reload }: {
  cur: Curriculum; orgId: string; cat: CatItem[]; canManage: boolean; userId: string | null; orgs: { id: string; name: string; type: string; parent_id: string | null }[]
  below: Set<string>; isPlatform: boolean; sourceName: string | null; newerSource: boolean; back: () => void; reload: () => void; go?: (p: string) => void
}) {
  const [versions, setVersions] = useState<Version[]>([])
  const [sel, setSel] = useState<string | null>(null)
  const [content, setContent] = useState<Content | null>(null)
  const [targets, setTargets] = useState<string[]>([])
  const [pkgs, setPkgs] = useState<{ name: string; tier: string | null; subject: string | null; grades: number[] }[]>([])
  const [tab, setTab] = useState<DTab>('overview')
  const [filter, setFilter] = useState<{ subject: string | null; grade: number | null }>({ subject: null, grade: null })
  const [msg, setMsg] = useState(''); const [note, setNote] = useState('')
  const isOwner = cur.owner_org_id === orgId
  const labels = labelsOf(cur)
  const me = orgs.find(o => o.id === orgId) ?? null

  async function loadVersions(pick?: string) {
    const { data, error } = await supabase.from('curriculum_versions').select('*').eq('curriculum_id', cur.id).order('version_no', { ascending: false })
    if (error) return setMsg(errText(error.message))
    const vs = (data as Version[]) ?? []; setVersions(vs)
    const keep = pick ?? sel
    const def = vs.find(v => v.id === cur.current_version_id) ?? vs.find(v => ['draft', 'pending', 'approved', 'rejected'].includes(v.status)) ?? vs[0]
    setSel(keep && vs.some(v => v.id === keep) ? keep : def?.id ?? null)
  }
  const loadC = async () => { if (sel) setContent(await loadContent(sel)) }
  useEffect(() => {
    loadVersions()
    supabase.from('curriculum_targets').select('org_id').eq('curriculum_id', cur.id).then(({ data }) => setTargets(((data as { org_id: string }[]) ?? []).map(x => x.org_id)))
    supabase.from('program_package_items').select('subject, grades, program_packages(name, tier)').eq('curriculum_id', cur.id)
      .then(({ data }) => setPkgs(((data as any[]) ?? []).map(x => ({ name: x.program_packages?.name ?? '', tier: x.program_packages?.tier ?? null, subject: x.subject, grades: x.grades }))))
  }, [cur.id])
  useEffect(() => { setContent(null); loadC() }, [sel])

  const version = versions.find(v => v.id === sel) ?? null
  const editable = !!version && isOwner && canManage && !cur.archived_at && ['draft', 'rejected'].includes(version.status)
  const refresh = () => { loadVersions(); loadC(); reload() }
  const wip = versions.find(v => ['draft', 'pending', 'approved', 'rejected'].includes(v.status))

  async function saveInfo(v: InfoVals) {
    const { error } = await supabase.from('curricula').update({
      name: v.name, code: v.code || null, color: v.color, summary: v.summary.trim() || null, issuer: v.issuer.trim() || null,
      levels: v.levels, grades: v.grades, subjects: v.subjects, fields: v.fields, scope: v.scope, require_approval: v.require_approval, structure_labels: v.structure_labels,
    }).eq('id', cur.id)
    if (error) return errText(error.message)
    await supabase.from('curriculum_targets').delete().eq('curriculum_id', cur.id)
    if (v.scope === 'selected' && v.targets.length) {
      const t = await supabase.from('curriculum_targets').insert(v.targets.map(org_id => ({ curriculum_id: cur.id, org_id })))
      if (t.error) return errText(t.error.message)
    }
    setTargets(v.targets); setNote('Đã lưu thông tin chung.'); reload(); return null
  }
  async function newVersion() {
    const { data, error } = await supabase.rpc('curriculum_new_version', { p_curriculum: cur.id, p_from: sel, p_label: null, p_note: null })
    if (error) return setMsg(errText(error.message))
    setNote('Đã tạo phiên bản mới (bản nháp) — sửa xong bấm Ban hành ở “Phiên bản”.'); await loadVersions(data as string); reload()
  }

  // Nội dung lọc theo môn / khối (cấu trúc, chuẩn đầu ra)
  const fc: Content | null = content && (filter.subject || filter.grade != null) ? (() => {
    const units = content.units.filter(u => (!filter.subject || u.subject_main === filter.subject) && (filter.grade == null || u.grade === filter.grade))
    const ids = new Set(units.map(u => u.id))
    return { ...content, units, lessons: content.lessons.filter(l => ids.has(l.unit_id)),
      outcomes: content.outcomes.filter(o => !o.unit_id || ids.has(o.unit_id)), assessments: content.assessments.filter(a => !a.unit_id || ids.has(a.unit_id)) }
  })() : content
  const combos = content ? Array.from(new Map([...content.subjects.map(s => [`${s.subject}|${s.grade}`, s] as const),
    ...content.units.filter(u => u.subject_main && u.grade != null).map(u => [`${u.subject_main}|${u.grade}`, { subject: u.subject_main!, grade: u.grade! }] as const)]).values())
    .sort((a, b) => a.grade - b.grade || a.subject.localeCompare(b.subject)) : []
  const filterBar = content && combos.length > 1 && (
    <div className="p1-chiprow" style={{ marginBottom: 12 }}>
      <button type="button" className={!filter.subject && filter.grade == null ? 'on' : ''} onClick={() => setFilter({ subject: null, grade: null })}>Tất cả</button>
      {combos.map(c => <button type="button" key={c.subject + c.grade} className={filter.subject === c.subject && filter.grade === c.grade ? 'on' : ''}
        onClick={() => setFilter({ subject: c.subject, grade: c.grade })}>{catName(cat, 'subject', c.subject)} · {gradeLabel(c.grade)}</button>)}
    </div>
  )
  const nav: [DTab, string, number?][] = [['overview', 'Tổng quan'], ['subjects', 'Môn học & thời lượng', content?.subjects.length], ['structure', 'Cấu trúc nội dung', content?.units.length],
    ['outcomes', 'Chuẩn đầu ra & đánh giá', content?.outcomes.length], ['versions', 'Phiên bản & phê duyệt', versions.length], ['info', 'Thông tin chung']]

  return (
    <>
      <div className="p1-head">
        <button type="button" onClick={back}>← Tất cả chương trình</button>
        <Code color={cur.color}>{cur.code ?? '—'}</Code>
        <h2>{cur.name}</h2>
        {version && <span className="cur-vpick">
          <select value={sel ?? ''} onChange={e => setSel(e.target.value)} aria-label="Phiên bản đang xem">
            {versions.map(v => <option key={v.id} value={v.id}>{vName(v)}{v.id === cur.current_version_id ? ' — đang hiệu lực' : ''}</option>)}</select>
          <VStatusPill s={version.status} />
        </span>}
        {isOwner && canManage && !wip && <button type="button" className="primary" onClick={newVersion}>Tạo phiên bản mới để sửa</button>}
        {isOwner && canManage && wip && wip.id !== sel && <button type="button" onClick={() => setSel(wip.id)}>Mở bản đang soạn</button>}
        <p className="p1-sub">{[cur.issuer ?? cur.owner_name, cur.grades.length ? 'Khối ' + cur.grades.join(', ') : '', SCOPE[cur.scope]].filter(Boolean).join(' · ')}
          {sourceName && <> · Kế thừa từ <b>{sourceName}</b></>}
          {version && !editable && <> · <i>{isOwner && canManage ? (version.status === 'pending' ? 'đang chờ duyệt — chỉ xem' : version.status === 'approved' ? 'đã duyệt — chờ ban hành' : 'phiên bản đã ban hành không sửa trực tiếp: bấm “Tạo phiên bản mới để sửa”') : 'chỉ xem'}</i></>}</p>
      </div>
      {newerSource && isOwner && <div className="p1-alert info">Chương trình nguồn đã ban hành phiên bản mới — kế thừa lại hoặc cập nhật thủ công.</div>}
      {msg && <p className="msg">{msg}</p>}
      {note && <p className="sub"><b>{note}</b></p>}

      <div className="p1-layout">
        <aside className="p1-aside"><SideNav items={nav} value={tab} onChange={setTab} /></aside>
        <div>
          {tab === 'info' && <InfoForm cur={cur} cat={cat} orgs={orgs} below={below} me={me} isPlatform={isPlatform} targets={targets} readOnly={!(isOwner && canManage)} onSave={saveInfo} />}
          {tab === 'versions' && <VersionsPanel cur={cur} versions={versions} selected={version} onSelect={id => setSel(id)} canManage={canManage} isOwner={isOwner}
            userId={userId} labels={labels} reload={refresh} setMsg={setMsg} setInfo={setNote} />}
          {!['info', 'versions'].includes(tab) && (!version ? <Empty>Chương trình chưa có phiên bản.</Empty> : !content || !fc ? <p className="sub">Đang tải…</p> : <Fragment key={version.id}>
            {tab === 'overview' && <Overview cur={cur} content={content} cat={cat} pkgs={pkgs} version={version} onOpen={(s, g) => { setFilter({ subject: s, grade: g }); setTab('structure') }} />}
            {tab === 'subjects' && <SubjectsEditor versionId={version.id} content={content} cat={cat} editable={editable} reload={loadC} setMsg={setMsg}
              onOpen={(s, g) => { setFilter({ subject: s, grade: g }); setTab('structure') }} />}
            {tab === 'structure' && <>{filterBar}<StructureEditor key={`${filter.subject}-${filter.grade}`} versionId={version.id} content={fc} cat={cat} labels={labels} editable={editable}
              reload={loadC} setMsg={setMsg} defaults={{ subject_main: filter.subject, grade: filter.grade }} /></>}
            {tab === 'outcomes' && <>{filterBar}<OutcomesEditor versionId={version.id} content={fc} cat={cat} labels={labels} editable={editable} reload={loadC} setMsg={setMsg} /></>}
          </Fragment>)}
        </div>
      </div>
    </>
  )
}

function Overview({ cur, content, cat, pkgs, version, onOpen }: {
  cur: Curriculum; content: Content; cat: CatItem[]; pkgs: { name: string; tier: string | null; subject: string | null; grades: number[] }[]; version: Version
  onOpen: (s: string, g: number) => void
}) {
  const periods = content.subjects.reduce((a, s) => a + s.periods_total, 0)
  const bySubject = new Map<string, typeof content.subjects>()
  content.subjects.forEach(s => bySubject.set(s.subject, [...(bySubject.get(s.subject) ?? []), s]))
  return (<>
    <div className="p1-stats">
      <Stat label="Môn học" value={bySubject.size} sub={`${content.subjects.length} môn – khối`} />
      <Stat label="Chủ đề / bài học" value={`${content.units.length} / ${content.lessons.length}`} />
      <Stat label="Tổng thời lượng" value={periods} sub="tiết theo quy định" />
      <Stat label="Yêu cầu cần đạt" value={content.outcomes.length} sub={`${content.assessments.length} tiêu chí đánh giá`} />
    </div>
    {cur.summary && <Section title="Mục tiêu"><p style={{ margin: 0 }}>{cur.summary}</p></Section>}
    <Section title="Môn học theo khối">
      {bySubject.size === 0 ? <Empty>Chưa khai báo môn học.</Empty> : (
        <table className="p1-table">
          <thead><tr><th>Môn học</th>{cur.grades.map(g => <th key={g}>{gradeLabel(g)}</th>)}</tr></thead>
          <tbody>{[...bySubject.entries()].map(([s, rows]) => (
            <tr key={s}><td><b>{catName(cat, 'subject', s)}</b></td>
              {cur.grades.map(g => { const r = rows.find(x => x.grade === g); return <td key={g}>{r ? <button type="button" className="linkbtn" onClick={() => onOpen(s, g)}>{r.periods_total} tiết{r.periods_per_week ? ` · ${r.periods_per_week}/tuần` : ''}{!r.is_required ? ' · tự chọn' : ''}</button> : <span className="sub">—</span>}</td> })}
            </tr>))}</tbody>
        </table>)}
    </Section>
    <Section title="Được dùng trong gói chương trình">
      {pkgs.length === 0 ? <Empty>Chương trình chưa nằm trong gói nào.</Empty> :
        <div className="p1-chips">{pkgs.map((p, i) => <Pill key={i} tone={p.tier === 'nang_cao' ? 'info' : ''}>{p.name}{p.subject ? ` · ${catName(cat, 'subject', p.subject)}` : ''}{p.grades.length ? ` · khối ${p.grades.join(', ')}` : ''}</Pill>)}</div>}
    </Section>
    <Section title="Phiên bản đang xem"><dl className="p1-kv">
      <div><dt>Phiên bản</dt><dd>{vName(version)}</dd></div><div><dt>Trạng thái</dt><dd><VStatusPill s={version.status} /></dd></div>
      <div><dt>Hiệu lực</dt><dd>{version.effective_from ? `${fmtDate(version.effective_from)} →${version.effective_to ? ' ' + fmtDate(version.effective_to) : ''}` : '—'}</dd></div>
      <div><dt>Ghi chú thay đổi</dt><dd>{version.change_note ?? '—'}</dd></div>
    </dl></Section>
  </>)
}
