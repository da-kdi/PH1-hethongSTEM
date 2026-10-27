import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { CatalogPanel } from './Catalog'
import { norm } from '../ui'
import {
  OPEN_LESSON_KEY, SCOPE, catName, catOf, effectiveCatalog, errText, gradeLabel, gradesOfLevel, inUseOf, loadContent, useCatalog, useOrgs,
  type CatItem, type Content, type Curriculum, type Lesson, type MVer, type Scope, type Unit,
} from './api'
import { Confirm, Cover, Empty, Flow, Group, Ic, Mau, PageHead, Panel, Search, Seg, Sel, StatCard, StatusPill, cssVar } from '../mau/kit'

// 1.1.1 Chương trình giáo dục — dựng theo bản mẫu giao diện (ph1-chuong-trinh-mau.html, 28/10/2026):
//   Danh sách: chuỗi bước Danh mục → Chương trình, 4 thẻ số liệu, lọc Cấp học / Khối / Môn / Trạng thái, Thẻ | Danh sách.
//   Chi tiết: Tổng quan (thông tin, bài học theo môn, yêu cầu cần đạt) · Thiết lập (thông tin — nhiều cấp học, nhiều khối, số tiết/tuần,
//   số phút/tiết · bài học: Môn › Chủ đề/Chương (tuỳ chọn) › Bài, số tiết, học liệu chính · yêu cầu cần đạt).
//   Trạng thái Nháp → Đã phát hành → Ngừng dùng (062). Số tiết/tuần, số phút/tiết: migration 063.

type Top = 'programs' | 'catalog'
type LRow = { id: string; version_id: string; subject: string | null; periods: number }
type Org = { id: string; name: string; type: string; parent_id: string | null }
type Mat = 'ok' | 'draft' | 'none'
const subjCount = (ls: LRow[]) => { const m = new Map<string, number>(); ls.forEach(l => l.subject && m.set(l.subject, (m.get(l.subject) ?? 0) + 1)); return m }
const mainSubj = (ls: LRow[]) => [...subjCount(ls).entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

export function CurriculumPage({ orgId, go }: { orgId: string | null; go?: (p: string) => void }) {
  const [canManage, setCanManage] = useState(false)
  const [isPlatform, setIsPlatform] = useState(false)
  const [list, setList] = useState<Curriculum[]>([])
  const [rows, setRows] = useState<LRow[]>([])
  const [mats, setMats] = useState<Map<string, Mat>>(new Map())
  const [top, setTop] = useState<Top>('programs')
  const [openId, setOpenId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [catKey, setCatKey] = useState(0)
  const [q, setQ] = useState('')
  const [f, setF] = useState({ level: '', grade: '', subject: '', status: '' })
  const [mode, setMode] = useState<'grid' | 'table'>(() => { try { return (localStorage.getItem('ph1.ct.mode') as 'grid' | 'table') || 'grid' } catch { return 'grid' } })
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('')
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
    if (!ids.length) { setRows([]); return }
    const le = await supabase.from('curriculum_lessons').select('id, version_id, subject, periods').in('version_id', ids)
    const rs = (le.data as LRow[]) ?? []; setRows(rs)
    if (!rs.length) return setMats(new Map())
    const [ml, iu] = await Promise.all([
      supabase.from('material_lessons').select('id, family_id, version_no, status, curriculum_lesson_id').not('curriculum_lesson_id', 'is', null),
      supabase.from('material_in_use').select('family_id, lesson_id').eq('org_id', orgId),
    ])
    setMats(matMap((ml.data as MVer[]) ?? [], new Map(((iu.data as { family_id: string; lesson_id: string }[]) ?? []).map(x => [x.family_id, x.lesson_id]))))
  }
  useEffect(() => { load() }, [orgId])
  if (err) return <Mau><p className="msg">{err}</p></Mau>
  if (!orgId) return <p className="sub">Đang tải…</p>

  const open = list.find(c => c.id === openId) ?? null
  if (open) return <Mau><ProgramDetail key={open.id} cur={open} orgId={orgId} cat={cat} canManage={canManage} orgs={orgs} below={below} isPlatform={isPlatform} mats={mats}
    sourceName={open.source_curriculum_id ? list.find(x => x.id === open.source_curriculum_id)?.name ?? 'chương trình nguồn' : null}
    back={() => { setOpenId(null); load() }} reload={load} go={go} onClone={clone} /></Mau>

  const lessonsOf = (c: Curriculum) => rows.filter(r => r.version_id === c.current_version_id)
  const qq = norm(q)
  const match = (c: Curriculum) => { const ls = lessonsOf(c)
    return (!qq || norm(`${c.code ?? ''} ${c.name} ${c.summary ?? ''}`).includes(qq)) && (!f.level || c.levels.includes(f.level) || c.grades.some(g => gradesOfLevel(cat, f.level).includes(g)))
      && (!f.grade || c.grades.includes(Number(f.grade))) && (!f.subject || ls.some(l => l.subject === f.subject)) && (!f.status || c.status === f.status) }
  const mine = list.filter(c => c.owner_org_id === orgId && match(c))
  const shared = list.filter(c => c.owner_org_id !== orgId && !below.has(c.owner_org_id) && match(c))
  const children = list.filter(c => below.has(c.owner_org_id) && match(c))

  async function clone(c: Curriculum) {
    const name = prompt(`Kế thừa “${c.code ?? ''} · ${c.name}” thành chương trình của ${me?.name ?? 'đơn vị'} để điều chỉnh. Tên:`, c.name)
    if (name === null) return
    const { data, error } = await supabase.rpc('curriculum_clone', { p_version: c.current_version_id, p_name: name })
    if (error) return setMsg(errText(error.message))
    await load(); setOpenId(data as string)
  }
  const grpOf = (c: Curriculum) => groupOfCur(cat, c)
  const grpLabel = (c: Curriculum) => { const g = grpOf(c); return g ? `${g.code} · ${g.name}` : 'Chưa xếp nhóm' }
  const colorOf = (c: Curriculum) => c.color ?? grpOf(c)?.color ?? '#64748b'
  const allLs = rows.filter(r => list.some(c => c.current_version_id === r.version_id))
  const okMat = allLs.filter(l => mats.get(l.id) === 'ok').length
  const levels = catOf(cat, 'level')
  const gradeOpts = (f.level ? gradesOfLevel(cat, f.level) : Array.from(new Set(list.flatMap(c => c.grades))).sort((a, b) => a - b))
  const subjOpts = Array.from(new Set(rows.map(r => r.subject).filter(Boolean) as string[]))
  const card = (c: Curriculum, owner: boolean) => { const ls = lessonsOf(c); const col = colorOf(c)
    return <button type="button" key={c.id} className="pcard dcard" style={cssVar(col)} onClick={() => setOpenId(c.id)}>
      <Cover subject={mainSubj(ls)} label={owner ? c.owner_name : grpLabel(c)} code={c.code ?? '—'} />
      <h3>{c.name}</h3>
      <p className="desc" style={{ margin: 0 }}>{c.summary}</p>
      <div className="chips">{c.grades.length ? c.grades.map(g => <span key={g} className="chip k" style={cssVar(col)}>{gradeLabel(g)}</span>) : <span className="chip">Chưa gán khối</span>}</div>
      <div className="foot"><span>{subjCount(ls).size} môn · {ls.length} bài · {ls.reduce((a, l) => a + l.periods, 0)} tiết</span><StatusPill s={c.status} /></div>
    </button> }
  const table = (cs: Curriculum[], owner: boolean, withClone = false) => <div className="panel" style={{ padding: 0 }}><div className="tblwrap"><table>
    <thead><tr><th></th><th>Chương trình</th><th>Cấp học · Khối</th><th>Môn học</th><th>Quy mô</th><th>Trạng thái</th>{withClone && <th></th>}</tr></thead>
    <tbody>{cs.map(c => { const ls = lessonsOf(c)
      return <tr key={c.id} onClick={() => setOpenId(c.id)} style={{ cursor: 'pointer' }}>
        <td><span className="code" style={{ ...cssVar(colorOf(c)), height: 32, minWidth: 38, fontSize: 11.5, borderRadius: 9 }}>{c.code ?? '—'}</span></td>
        <td><b>{c.name}</b><br /><small style={{ color: 'var(--muted)' }}>{owner ? c.owner_name : c.summary}</small></td>
        <td>{gradesText(cat, c.grades)}</td><td>{[...subjCount(ls).keys()].map(s => catName(cat, 'subject', s)).join(', ') || '—'}</td>
        <td>{ls.length} bài · {ls.reduce((a, l) => a + l.periods, 0)} tiết</td><td><StatusPill s={c.status} /></td>
        {withClone && <td>{canManage && <button type="button" className="btn sm" onClick={e => { e.stopPropagation(); clone(c) }}>Kế thừa</button>}</td>}</tr> })}</tbody></table></div></div>
  const section = (title: string, cs: Curriculum[], owner: boolean, withClone = false, empty?: string) => <>
    <Group title={title} n={cs.length} />
    {!cs.length ? <Empty>{empty ?? 'Không có chương trình phù hợp bộ lọc.'}</Empty> : mode === 'grid'
      ? <div className="grid">{cs.map(c => withClone && canManage ? <div key={c.id} className="cur-cardwrap">{card(c, owner)}<button type="button" className="linkbtn" onClick={() => clone(c)}>Kế thừa để điều chỉnh</button></div> : card(c, owner))}</div>
      : table(cs, owner, withClone)}</>

  return <Mau>
    <PageHead icon="book" title="Chương trình giáo dục" sub="Khung chương trình STEM theo cấp học, khối, môn và bài học">
      {top === 'programs' && canManage && <button type="button" className="btn primary" onClick={() => { setCreating(true); setMsg('') }}><Ic n="plus" /> Chương trình mới</button>}
    </PageHead>
    <Flow steps={[['catalog', 'Danh mục', 'Cấp học, khối, lớp, nhóm, môn'], ['programs', 'Chương trình', `${list.length} chương trình · bài học & phát hành`]] as [Top, string, string][]}
      value={top} onChange={t => { setTop(t); setCreating(false) }} />
    {msg && <p className="msg">{msg}</p>}
    {top === 'catalog' ? <CatalogPanel orgId={orgId} all={all} hidden={hidden} orgs={orgs} below={below} canManage={canManage} isPlatform={isPlatform} onChange={() => setCatKey(k => k + 1)} /> : <>
      {creating && <ProgramForm cat={cat} orgs={orgs} below={below} me={me} isPlatform={isPlatform} onCancel={() => setCreating(false)}
        suggestCode={`CT${Math.max(0, ...list.map(c => Number((c.code ?? '').match(/^CT(\d+)$/)?.[1] ?? 0))) + 1}`}
        onSave={async v => {
          const { data, error } = await supabase.rpc('curriculum_create', { p: { name: v.name, code: v.code, category: v.category, summary: v.summary, issuer: v.issuer, scope: v.scope, levels: v.levels, grades: v.grades } })
          if (error) return errText(error.message)
          const id = data as string
          const u = await supabase.from('curricula').update({ color: v.color, levels: v.levels, grades: v.grades, periods_per_week: v.ppw, minutes_per_period: v.mpp }).eq('id', id)
          if (u.error) return errText(u.error.message)
          if (v.scope === 'selected' && v.targets.length) await supabase.from('curriculum_targets').insert(v.targets.map(org_id => ({ curriculum_id: id, org_id })))
          setCreating(false); await load(); setOpenId(id); return null
        }} />}
      <div className="stats">
        <StatCard c="c-blue" icon="book" label="Chương trình" value={list.length} sub={`${list.filter(c => c.status === 'draft').length} đang ở trạng thái nháp`} />
        <StatCard c="c-green" icon="send" label="Đã phát hành" value={list.filter(c => c.status === 'published').length} sub="được gợi ý khi phân phối" />
        <StatCard c="c-violet" icon="list" label="Bài học" value={allLs.length} sub={`${allLs.reduce((a, l) => a + l.periods, 0)} tiết trên mọi chương trình`} />
        <StatCard c="c-amber" icon="file" label="Học liệu đủ" value={<>{okMat}<span style={{ fontSize: 13, color: 'var(--muted)' }}>/{allLs.length}</span></>} sub={`${allLs.length - okMat} bài còn thiếu hoặc đang soạn`} />
      </div>
      <div className="toolbar">
        <Search value={q} onChange={setQ} placeholder="Tìm theo mã, tên, mô tả chương trình…" />
        <Sel label="Tất cả cấp học" value={f.level} onChange={v => setF({ ...f, level: v, grade: v && f.grade && !gradesOfLevel(cat, v).includes(Number(f.grade)) ? '' : f.grade })} options={levels.map(l => [l.code, l.name])} />
        <Sel label="Tất cả khối" value={f.grade} onChange={v => setF({ ...f, grade: v })} options={gradeOpts.map(g => [String(g), gradeLabel(g)])} />
        <Sel label="Tất cả môn học" value={f.subject} onChange={v => setF({ ...f, subject: v })} options={subjOpts.map(s => [s, catName(cat, 'subject', s)])} />
        <Sel label="Mọi trạng thái" value={f.status} onChange={v => setF({ ...f, status: v })} options={[['draft', 'Nháp'], ['published', 'Đã phát hành'], ['archived', 'Ngừng dùng']]} />
        <Seg label="Kiểu xem" items={[['grid', 'Thẻ'], ['table', 'Danh sách']]} value={mode} onChange={v => { setMode(v); try { localStorage.setItem('ph1.ct.mode', v) } catch { /* bỏ qua */ } }} />
      </div>
      {section(me?.type === 'provider' ? 'Chương trình của KDI' : `Chương trình của ${me?.name ?? 'đơn vị'}`, mine, false, false,
        canManage ? 'Chưa có chương trình riêng. Bấm “Chương trình mới” hoặc kế thừa một chương trình bên dưới.' : 'Đơn vị chưa có chương trình riêng.')}
      {shared.length > 0 && section('Được phát hành tới đơn vị', shared, true, true)}
      {children.length > 0 && section('Của đơn vị trực thuộc', children, true)}
    </>}
  </Mau>
}

// Nhóm chương trình: theo cột category, chưa gán thì theo tiền tố mã (CT2-K7 → CT2)
export const groupOfCur = (cat: CatItem[], c: Pick<Curriculum, 'category' | 'code'>) => { const gs = catOf(cat, 'category')
  return gs.find(x => x.code === c.category) ?? gs.find(x => x.code === (c.code ?? '').split('-')[0]) ?? null }
// Trạng thái học liệu chính của từng bài (phiên bản đơn vị đang dùng)
function matMap(vers: MVer[], chosen: Map<string, string>) {
  const out = new Map<string, Mat>()
  for (const fam of new Set(vers.map(v => v.family_id))) {
    const cur = inUseOf(vers, fam, chosen); if (!cur?.curriculum_lesson_id) continue
    out.set(cur.curriculum_lesson_id, cur.status === 'published' ? 'ok' : 'draft')
  }
  return out
}
function MatPill({ m }: { m: Mat | undefined }) {
  return m === 'ok' ? <span className="pill good plain">Đủ</span> : m === 'draft' ? <span className="pill warn plain">Đang soạn</span> : <span className="pill draft plain">Chưa có</span>
}
export function gradesText(cat: CatItem[], gs: number[]) {
  if (!gs.length) return 'Chưa gán khối'
  return catOf(cat, 'level').map(l => [l.name, gs.filter(g => gradesOfLevel(cat, l.code).includes(g))] as const).filter(([, x]) => x.length)
    .map(([n, x]) => `${n}: ${x.map(gradeLabel).join(', ')}`).join(' · ') || gs.map(gradeLabel).join(', ')
}

// ===== Form thông tin chương trình (tạo mới / sửa) =====
type FormVals = { name: string; code: string; color: string; summary: string; issuer: string; category: string; levels: string[]; grades: number[]
  ppw: number; mpp: number; scope: Scope; targets: string[] }
function ProgramForm({ cur, cat, orgs, below, me, isPlatform, targets, onSave, onCancel, readOnly, suggestCode }: {
  cur?: Curriculum; cat: CatItem[]; orgs: Org[]; below: Set<string>; me: { id: string; name: string; type: string } | null; isPlatform: boolean; targets?: string[]
  onSave: (v: FormVals) => Promise<string | null>; onCancel?: () => void; readOnly?: boolean; suggestCode?: string
}) {
  const [v, setV] = useState<FormVals>(() => ({
    name: cur?.name ?? '', code: cur?.code ?? suggestCode ?? '', color: cur?.color ?? '#64748b', summary: cur?.summary ?? '', issuer: cur?.issuer ?? me?.name ?? '',
    category: cur?.category ?? '', levels: cur?.levels ?? [], grades: [...(cur?.grades ?? [])].sort((a, b) => a - b),
    ppw: Number((cur as any)?.periods_per_week ?? 2), mpp: Number((cur as any)?.minutes_per_period ?? 35),
    scope: cur?.scope ?? (me?.type === 'school' ? 'own' : me?.type === 'provider' ? 'public' : 'children'), targets: targets ?? [],
  }))
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [saved, setSaved] = useState(false)
  const ro = !!readOnly; const canPublic = me?.type === 'provider' || isPlatform
  const levels = catOf(cat, 'level'); const cats = catOf(cat, 'category')
  const set = (p: Partial<FormVals>) => { setV(x => ({ ...x, ...p })); setSaved(false) }
  const lvOf = (gs: number[]) => levels.filter(l => gradesOfLevel(cat, l.code).some(g => gs.includes(g))).map(l => l.code)
  const togGrade = (g: number) => { const gs = v.grades.includes(g) ? v.grades.filter(x => x !== g) : [...v.grades, g].sort((a, b) => a - b); set({ grades: gs, levels: lvOf(gs) }) }
  const togLevel = (code: string, on: boolean) => { const lg = gradesOfLevel(cat, code); const gs = on ? Array.from(new Set([...v.grades, ...lg])).sort((a, b) => a - b) : v.grades.filter(g => !lg.includes(g)); set({ grades: gs, levels: lvOf(gs) }) }
  const grpColor = cats.find(c => c.code === v.category)?.color ?? v.color
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (!v.name.trim()) return setErr('Nhập tên chương trình.')
    if (!v.grades.length) return setErr('Chọn ít nhất một khối.')
    if (v.scope === 'selected' && !v.targets.length) return setErr('Chọn ít nhất một đơn vị nhận.')
    setBusy(true); const m = await onSave({ ...v, name: v.name.trim(), code: v.code.trim() }); setBusy(false); setErr(m ?? ''); setSaved(!m)
  }
  return <form className="panel" onSubmit={submit} noValidate>
    <header><h2><span className="hi"><Ic n={cur ? 'edit' : 'plus'} /></span>{cur ? 'Thông tin chương trình' : 'Chương trình mới'}</h2>
      {!cur && <span className="act" style={{ color: 'var(--muted)', fontSize: 12.5 }}>Sau khi tạo, thêm Môn › Bài học ở tab Thiết lập</span>}</header>
    <fieldset disabled={ro} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, display: 'grid', gap: 14 }}>
      <div className="form">
        <label className="fld"><span>Tên chương trình *</span><input value={v.name} onChange={e => set({ name: e.target.value })} placeholder="VD: Sáng chế" required /></label>
        <label className="fld"><span>Nhóm chương trình</span><span className="selc" style={cssVar(grpColor)}><i></i>
          <select value={v.category} onChange={e => set({ category: e.target.value, color: cats.find(c => c.code === e.target.value)?.color ?? v.color })}>
            <option value="">Chưa xếp nhóm (mặc định)</option>{cats.map(c => <option key={c.id} value={c.code}>{c.code} · {c.name}</option>)}</select></span></label>
        <label className="fld"><span>Số tiết/tuần</span><input type="number" min={0.5} step={0.5} value={v.ppw} onChange={e => set({ ppw: Number(e.target.value) || 0 })} /></label>
        <label className="fld"><span>Số phút/tiết</span><input type="number" min={5} step={5} value={v.mpp} onChange={e => set({ mpp: Number(e.target.value) || 0 })} /></label>
        <div className="fld wide"><span>Cấp học / Khối *</span>
          <div className="lvbox">{levels.map(l => { const gs = gradesOfLevel(cat, l.code); const allOn = gs.length > 0 && gs.every(g => v.grades.includes(g)); const some = gs.some(g => v.grades.includes(g))
            return <div key={l.code} className="lvrow"><label className="lv"><input type="checkbox" checked={allOn} ref={el => { if (el) el.indeterminate = !allOn && some }} onChange={e => togLevel(l.code, e.target.checked)} /> {l.name}</label>
              <div className="gchips">{gs.map(g => <button type="button" key={g} className="gchip" aria-pressed={v.grades.includes(g)} onClick={() => togGrade(g)}>{gradeLabel(g)}</button>)}</div></div> })}</div>
          <span className="hint">Chọn nhiều khối ở nhiều cấp; tick tên cấp học để chọn cả cấp. Đang chọn: {gradesText(cat, v.grades)}</span></div>
        <label className="fld wide"><span>Mô tả</span><textarea value={v.summary} onChange={e => set({ summary: e.target.value })} placeholder="Chương trình nhằm… dành cho học sinh…" /></label>
      </div>
      <details className="adv"><summary>Thiết lập nâng cao (mã, phạm vi áp dụng)</summary><div className="form">
        <label className="fld"><span>Mã chương trình</span><input value={v.code} onChange={e => set({ code: e.target.value })} placeholder="CT1, SC…" /></label>
        <label className="fld"><span>Đơn vị xây dựng / ban hành</span><input value={v.issuer} onChange={e => set({ issuer: e.target.value })} /></label>
        <label className="fld"><span>Phạm vi áp dụng</span><select value={v.scope} onChange={e => set({ scope: e.target.value as Scope })}>
          {(Object.keys(SCOPE) as Scope[]).filter(s => s !== 'public' || canPublic).map(s => <option key={s} value={s}>{SCOPE[s]}</option>)}</select></label>
        <label className="fld"><span>Màu nhận diện</span><input type="color" value={v.color} onChange={e => set({ color: e.target.value })} style={{ height: 40, padding: 4 }} /></label>
        {v.scope === 'selected' && <div className="fld wide"><span>Đơn vị nhận</span><div className="lvbox">
          {orgs.filter(o => below.has(o.id)).map(o => <label key={o.id} className="lv"><input type="checkbox" checked={v.targets.includes(o.id)}
            onChange={e => set({ targets: e.target.checked ? [...v.targets, o.id] : v.targets.filter(x => x !== o.id) })} /> {o.name}</label>)}
          {!orgs.some(o => below.has(o.id)) && <span className="hint">Đơn vị chưa có cấp dưới.</span>}</div></div>}
      </div></details>
    </fieldset>
    {err && <p className="err">{err}</p>}
    {!ro && <div className="formact"><button className="btn primary" type="submit" disabled={busy}><Ic n="check" /> {cur ? 'Lưu thông tin' : 'Tạo chương trình'}</button>
      {onCancel && <button className="btn" type="button" onClick={onCancel}>Huỷ</button>}{saved && <span className="okmsg">Đã lưu.</span>}</div>}
  </form>
}

// ===== Chi tiết chương trình: Tổng quan · Thiết lập =====
type DTab = 'overview' | 'setup'
type Ask = { text: string; yes: string; act: 'draft' | 'archive' | 'delete' }
function ProgramDetail({ cur, orgId, cat, canManage, orgs, below, isPlatform, mats, sourceName, back, reload, go, onClone }: {
  cur: Curriculum; orgId: string; cat: CatItem[]; canManage: boolean; orgs: Org[]; below: Set<string>; isPlatform: boolean; mats: Map<string, Mat>; sourceName: string | null
  back: () => void; reload: () => void; go?: (p: string) => void; onClone: (c: Curriculum) => void
}) {
  const [content, setContent] = useState<Content | null>(null)
  const [targets, setTargets] = useState<string[]>([])
  const [tab, setTab] = useState<DTab>('overview')
  const [ask, setAsk] = useState<Ask | null>(null)
  const [msg, setMsg] = useState(''); const [note, setNote] = useState('')
  const isOwner = cur.owner_org_id === orgId
  const editable = isOwner && canManage
  const me = orgs.find(o => o.id === orgId) ?? null
  const vid = cur.current_version_id
  const grp = groupOfCur(cat, cur)
  const color = cur.color ?? grp?.color ?? '#64748b'
  const loadC = async () => { if (vid) setContent(await loadContent(vid)) }
  useEffect(() => {
    loadC()
    supabase.from('curriculum_targets').select('org_id').eq('curriculum_id', cur.id).then(({ data }) => setTargets(((data as { org_id: string }[]) ?? []).map(x => x.org_id)))
  }, [cur.id])

  async function saveInfo(v: FormVals) {
    const { error } = await supabase.from('curricula').update({
      name: v.name, code: v.code || null, color: v.color, category: v.category || null, summary: v.summary.trim() || null, issuer: v.issuer.trim() || null,
      levels: v.levels, grades: v.grades, scope: v.scope, periods_per_week: v.ppw, minutes_per_period: v.mpp,
    }).eq('id', cur.id)
    if (error) return errText(error.message)
    await supabase.from('curriculum_targets').delete().eq('curriculum_id', cur.id)
    if (v.scope === 'selected' && v.targets.length) {
      const t = await supabase.from('curriculum_targets').insert(v.targets.map(org_id => ({ curriculum_id: cur.id, org_id })))
      if (t.error) return errText(t.error.message)
    }
    setTargets(v.targets); reload(); return null
  }
  async function setStatus(status: Curriculum['status']) {
    if (status === 'published' && !content?.lessons.length) return setMsg('Thêm ít nhất một bài học trước khi phát hành.')
    const { error } = await supabase.from('curricula').update({ status }).eq('id', cur.id)
    if (error) return setMsg(errText(error.message))
    setMsg(''); setNote(status === 'published' ? 'Đã phát hành.' : status === 'archived' ? 'Đã ngừng dùng — không còn được gợi ý khi phân phối.' : 'Đã chuyển về nháp.'); reload()
  }
  async function removeProgram() {
    const { data, error } = await supabase.from('curricula').delete().eq('id', cur.id).select('id')
    if (error) return setMsg(errText(error.message))
    if (!data?.length) return setMsg('Không xoá được — chỉ đơn vị xây dựng chương trình mới xoá được.')
    back()
  }
  const openMaterial = (lessonId: string) => { try { sessionStorage.setItem(OPEN_LESSON_KEY, lessonId) } catch { /* bỏ qua */ } go?.('Học liệu') }
  const ls = content?.lessons ?? []
  const subjects = content ? subjectsOf(content) : []

  return <>
    <div className="crumb"><button type="button" className="btn sm ghost" onClick={back}><Ic n="back" /> Quay lại</button></div>
    <div className="dhead"><span className="code" style={cssVar(color)}>{cur.code ?? '—'}</span>
      <div><h1>{cur.name}</h1><span className="crumb">{gradesText(cat, cur.grades)}{sourceName && <> · Kế thừa từ <b>{sourceName}</b></>}{!editable && <> · <i>chỉ xem</i></>}</span></div> <StatusPill s={cur.status} />
      <div className="act">
        {editable && cur.status === 'draft' && <button type="button" className="btn primary" onClick={() => setStatus('published')}><Ic n="send" /> Phát hành</button>}
        {editable && cur.status === 'published' && <><button type="button" className="btn" onClick={() => setAsk({ text: 'Chuyển về nháp? Đơn vị khác sẽ không còn thấy chương trình.', yes: 'Chuyển về nháp', act: 'draft' })}>Chuyển về nháp</button>
          <button type="button" className="btn" onClick={() => setAsk({ text: 'Ngừng dùng? Chương trình không còn được gợi ý khi phân phối.', yes: 'Ngừng dùng', act: 'archive' })}><Ic n="archive" /> Ngừng dùng</button></>}
        {editable && cur.status === 'archived' && <button type="button" className="btn" onClick={() => setStatus('published')}>Dùng lại</button>}
        {!isOwner && canManage && <button type="button" className="btn" onClick={() => onClone(cur)}><Ic n="copy" /> Kế thừa để điều chỉnh</button>}
        {editable && <button type="button" className="btn danger" onClick={() => setAsk({ text: `Xoá chương trình “${cur.name}” cùng mọi môn, bài học? Học liệu, phân phối gắn chương trình được giữ lại nhưng bỏ liên kết.`, yes: 'Xoá', act: 'delete' })}><Ic n="trash" /> Xoá</button>}
      </div></div>
    {ask && <Confirm text={ask.text} yes={ask.yes} danger={ask.act === 'delete'} onNo={() => setAsk(null)} onYes={() => { const a = ask.act; setAsk(null); a === 'delete' ? removeProgram() : setStatus(a === 'archive' ? 'archived' : 'draft') }} />}
    {msg && <p className="msg">{msg}</p>}
    {note && <p className="okmsg">{note}</p>}
    <div className="tabs" role="tablist">
      <button type="button" role="tab" className={tab === 'overview' ? 'on' : ''} onClick={() => setTab('overview')}>Tổng quan</button>
      <button type="button" role="tab" className={tab === 'setup' ? 'on' : ''} onClick={() => setTab('setup')}>Thiết lập <small>{ls.length} bài</small></button></div>
    {!vid ? <Empty>Chương trình chưa có nội dung.</Empty> : !content ? <p className="sub">Đang tải…</p> : tab === 'overview' ? <>
      <section className="hero" style={cssVar(color)}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 10 }}><h2 style={{ margin: 0, fontSize: 16, display: 'flex', gap: 9, alignItems: 'center' }}><Ic n="info" /> Thông tin chương trình</h2>
          {editable && <button type="button" className="btn sm" style={{ marginLeft: 'auto' }} onClick={() => setTab('setup')}><Ic n="edit" /> Sửa</button>}</header>
        <dl className="kv" style={{ margin: 0 }}>
          <div><dt>Tên chương trình</dt><dd>{cur.name}</dd></div><div><dt>Mã</dt><dd>{cur.code ?? '—'}</dd></div>
          <div><dt>Nhóm chương trình</dt><dd>{grp ? `${grp.code} · ${grp.name}` : <span className="pill draft plain">Chưa xếp nhóm</span>}</dd></div><div><dt>Trạng thái</dt><dd><StatusPill s={cur.status} /></dd></div>
          <div><dt>Cấp học</dt><dd>{catOf(cat, 'level').filter(l => gradesOfLevel(cat, l.code).some(g => cur.grades.includes(g))).map(l => l.name).join(', ') || '—'}</dd></div>
          <div><dt>Khối</dt><dd><div className="chips">{cur.grades.length ? cur.grades.map(g => <span key={g} className="chip k" style={cssVar(color)}>{gradeLabel(g)}</span>) : '—'}</div></dd></div>
          <div><dt>Môn học</dt><dd>{subjects.map(s => catName(cat, 'subject', s)).join(', ') || '—'}</dd></div>
          <div><dt>Số tiết/tuần</dt><dd>{Number((cur as any).periods_per_week ?? 2)}</dd></div><div><dt>Số phút/tiết</dt><dd>{(cur as any).minutes_per_period ?? 35} phút</dd></div>
          <div><dt>Đơn vị ban hành</dt><dd>{cur.issuer ?? cur.owner_name ?? '—'}</dd></div><div><dt>Phạm vi áp dụng</dt><dd>{SCOPE[cur.scope]}</dd></div>
          <div className="wide"><dt>Mô tả</dt><dd>{cur.summary || '—'}</dd></div>
        </dl>
        <div className="mini"><span><b>{subjects.length}</b>môn</span><span><b>{ls.length}</b>bài học</span><span><b>{ls.reduce((a, l) => a + l.periods, 0)}</b>tiết</span>
          <span><b>{ls.filter(l => mats.get(l.id) === 'ok').length}/{ls.length}</b>bài đủ học liệu</span></div>
      </section>
      <Panel icon="list" title="Danh sách bài học" act={<span style={{ color: 'var(--muted)', fontSize: 12.5 }}>Môn học › Bài học · thứ tự dạy xếp ở Phân phối chương trình</span>}>
        <SubjectBlocks content={content} cat={cat} mats={mats} editable={false} versionId={vid} grade={cur.grades[0] ?? null} reload={loadC} setMsg={setMsg} onOpenMaterial={go ? openMaterial : undefined} />
      </Panel>
      <Panel icon="target" title="Yêu cầu cần đạt">{cur.outcomes_text ? <p className="outcomes">{cur.outcomes_text}</p> : <Empty>Chưa nhập — thêm ở tab Thiết lập.</Empty>}</Panel>
    </> : <>
      <ProgramForm cur={cur} cat={cat} orgs={orgs} below={below} me={me} isPlatform={isPlatform} targets={targets} readOnly={!editable} onSave={saveInfo} />
      <SubjectsPanel content={content} cat={cat} mats={mats} editable={editable} versionId={vid} grade={cur.grades[0] ?? null} reload={loadC} setMsg={setMsg} onOpenMaterial={go ? openMaterial : undefined} />
      <Outcomes cur={cur} editable={editable} onSaved={() => { setNote('Đã lưu yêu cầu cần đạt.'); reload() }} setMsg={setMsg} />
    </>}
  </>
}

function Outcomes({ cur, editable, onSaved, setMsg }: { cur: Curriculum; editable: boolean; onSaved: () => void; setMsg: (m: string) => void }) {
  const [t, setT] = useState(cur.outcomes_text ?? '')
  return <Panel icon="target" title="Yêu cầu cần đạt">
    {editable ? <><textarea className="outcomes-edit" value={t} onChange={e => setT(e.target.value)} placeholder="Học sinh đạt được… (mỗi ý một dòng)" aria-label="Yêu cầu cần đạt" />
      <div className="formact"><button type="button" className="btn primary" onClick={async () => { const { error } = await supabase.from('curricula').update({ outcomes_text: t.trim() || null }).eq('id', cur.id); if (error) setMsg(errText(error.message)); else onSaved() }}><Ic n="check" /> Lưu yêu cầu cần đạt</button></div></>
      : cur.outcomes_text ? <p className="outcomes">{cur.outcomes_text}</p> : <Empty>Chưa nhập yêu cầu cần đạt.</Empty>}
  </Panel>
}

// ===== Bài học: Môn › Chủ đề/Chương (tuỳ chọn) › Bài =====
const subjectsOf = (c: Content) => Array.from(new Set([...c.subjects.map(s => s.subject), ...c.lessons.map(l => l.subject), ...c.units.map(u => u.subject_main)].filter(Boolean) as string[]))
type BlockProps = { content: Content; cat: CatItem[]; mats: Map<string, Mat>; editable: boolean; versionId: string; grade: number | null; reload: () => void; setMsg: (m: string) => void; onOpenMaterial?: (id: string) => void }
function SubjectsPanel(p: BlockProps) {
  const [add, setAdd] = useState('')
  const subjects = subjectsOf(p.content)
  async function addSubject() {
    if (!add) return p.setMsg('Chọn môn học.')
    const { error } = await supabase.from('curriculum_subjects').insert({ version_id: p.versionId, subject: add, grade: p.grade ?? 0, seq: p.content.subjects.length + 1, periods_total: 0, periods_per_week: 1 })
    if (error) return p.setMsg(errText(error.message)); setAdd(''); p.reload()
  }
  return <Panel icon="list" title="Bài học" act={p.editable && <>
    <select value={add} onChange={e => setAdd(e.target.value)} aria-label="Môn học" style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '6px 10px', background: 'var(--surface)' }}>
      <option value="">Môn học…</option>{catOf(p.cat, 'subject').filter(s => !subjects.includes(s.code)).map(s => <option key={s.id} value={s.code}>{s.name}</option>)}</select>
    <button type="button" className="btn sm" onClick={addSubject}><Ic n="plus" /> Thêm môn</button></>}>
    <SubjectBlocks {...p} />
  </Panel>
}
function SubjectBlocks(p: BlockProps) {
  const { content, cat, mats, editable } = p
  const subjects = subjectsOf(content)
  const [ask, setAsk] = useState<{ text: string; yes: string; run: () => void } | null>(null)
  const run = async (q: PromiseLike<{ error: { message: string } | null }>) => { const { error } = await q; if (error) { p.setMsg(errText(error.message)); return false } p.setMsg(''); p.reload(); return true }
  if (!subjects.length) return <Empty>Chương trình chưa có môn học.</Empty>
  return <>
    {ask && <Confirm text={ask.text} yes={ask.yes} danger onNo={() => setAsk(null)} onYes={() => { ask.run(); setAsk(null) }} />}
    {subjects.map(s => { const ls = content.lessons.filter(l => l.subject === s).sort((a, b) => a.seq - b.seq); const ok = ls.filter(l => mats.get(l.id) === 'ok').length
      return <details key={s} className="subj" open><summary><span className="chev"><Ic n="chev" /></span><span className="tag">Môn</span><b>{catName(cat, 'subject', s)}</b>
        <small>{ls.length} bài · {ls.reduce((a, l) => a + l.periods, 0)} tiết</small>
        <span className="right"><span className={'pill plain ' + (ok === ls.length && ls.length ? 'good' : 'info')}>Học liệu đủ {ok}/{ls.length}</span>
          {editable && <><button type="button" className="btn sm" onClick={e => { e.preventDefault(); run(supabase.from('curriculum_units').insert({ version_id: p.versionId, seq: Math.max(0, ...content.units.map(u => u.seq)) + 1, title: `Chủ đề mới ${content.units.filter(u => u.subject_main === s).length + 1}`, subject_main: s, grade: p.grade, periods: 0 })) }}><Ic n="plus" /> Chủ đề/Chương</button>
            <button type="button" className="btn sm danger" onClick={e => { e.preventDefault(); setAsk({ text: `Bỏ môn ${catName(cat, 'subject', s)} cùng ${ls.length} bài học và các chủ đề của môn?`, yes: 'Bỏ môn', run: async () => {
              const a = await supabase.from('curriculum_lessons').delete().eq('version_id', p.versionId).eq('subject', s); if (a.error) return p.setMsg(errText(a.error.message))
              const b = await supabase.from('curriculum_units').delete().eq('version_id', p.versionId).eq('subject_main', s); if (b.error) return p.setMsg(errText(b.error.message))
              run(supabase.from('curriculum_subjects').delete().eq('version_id', p.versionId).eq('subject', s)) } }) }}>Bỏ môn</button></>}</span></summary>
        <LessonTable {...p} s={s} ls={ls} run={run} />
      </details> })}
  </>
}
function LessonTable({ content, mats, editable, versionId, s, ls, run, onOpenMaterial }: BlockProps & { s: string; ls: Lesson[]; run: (q: PromiseLike<{ error: { message: string } | null }>) => Promise<boolean> }) {
  const us = useMemo(() => content.units.filter(u => u.subject_main === s).sort((a, b) => a.seq - b.seq), [content, s])
  const [d, setD] = useState({ title: '', periods: 2, unit: '' })
  const free = ls.filter(l => !l.unit_id || !us.some(u => u.id === l.unit_id))
  const cols = editable ? 5 + (us.length ? 1 : 0) : 4
  let n = 0
  const upd = (l: Lesson, x: Partial<Lesson>) => run(supabase.from('curriculum_lessons').update(x).eq('id', l.id))
  const mat = (l: Lesson) => <button className="matbtn" type="button" title="Mở học liệu của bài" onClick={() => onOpenMaterial?.(l.id)}><MatPill m={mats.get(l.id)} /></button>
  const row = (l: Lesson) => { n++; return editable
    ? <tr key={l.id}><td className="n">{n}</td><td><input defaultValue={l.title} aria-label="Tên bài" onBlur={e => e.target.value.trim() && e.target.value !== l.title && upd(l, { title: e.target.value.trim() })} /></td>
      <td><input type="number" min={0} defaultValue={l.periods} aria-label="Số tiết" onBlur={e => Number(e.target.value) !== l.periods && upd(l, { periods: Math.max(0, Number(e.target.value) || 0) })} /></td>
      {us.length > 0 && <td><select value={l.unit_id ?? ''} aria-label="Chủ đề/Chương" onChange={e => upd(l, { unit_id: e.target.value || null })}><option value="">— không —</option>{us.map(u => <option key={u.id} value={u.id}>{u.title}</option>)}</select></td>}
      <td>{mat(l)}</td><td><button type="button" className="btn sm danger" aria-label="Xoá bài" onClick={() => run(supabase.from('curriculum_lessons').delete().eq('id', l.id))}><Ic n="trash" /></button></td></tr>
    : <tr key={l.id}><td className="n">{n}</td><td>{l.title}</td><td>{l.periods}</td><td>{mat(l)}</td></tr> }
  const band = (u: Unit) => <tr key={'u' + u.id} className="band"><td colSpan={cols}><span className="tag">Chủ đề/Chương</span>{' '}
    {editable ? <input className="bandin" defaultValue={u.title} aria-label="Tên chủ đề" onBlur={e => e.target.value.trim() && e.target.value !== u.title && run(supabase.from('curriculum_units').update({ title: e.target.value.trim() }).eq('id', u.id))} /> : u.title}
    {editable && <button type="button" className="btn sm ghost" style={{ float: 'right' }} onClick={() => run(supabase.from('curriculum_units').delete().eq('id', u.id))}><Ic n="trash" /> Xoá chủ đề</button>}</td></tr>
  async function add() {
    if (!d.title.trim()) return
    const seq = Math.max(0, ...ls.map(l => l.seq)) + 1
    if (await run(supabase.from('curriculum_lessons').insert({ version_id: versionId, subject: s, unit_id: d.unit || null, seq, title: d.title.trim(), sessions: 1, periods: Math.max(0, d.periods) }))) setD({ ...d, title: '' })
  }
  return <div className="tblwrap"><table><thead><tr><th>#</th><th>Tên bài</th><th>Số tiết</th>{editable && us.length > 0 && <th>Chủ đề/Chương</th>}<th>Học liệu chính</th>{editable && <th></th>}</tr></thead><tbody>
    {us.map(u => [band(u), ...ls.filter(l => l.unit_id === u.id).map(row)])}
    {us.length > 0 && free.length > 0 && <tr className="band"><td colSpan={cols} style={{ fontWeight: 500 }}>Không thuộc chủ đề</td></tr>}
    {free.map(row)}
    {!ls.length && <tr><td colSpan={cols} style={{ color: 'var(--muted)' }}>Chưa có bài học.</td></tr>}
    {editable && <tr className="addrow"><td className="n">+</td><td><input value={d.title} placeholder="Tên bài mới" aria-label="Tên bài mới" onChange={e => setD({ ...d, title: e.target.value })} onKeyDown={e => e.key === 'Enter' && add()} /></td>
      <td><input type="number" min={0} value={d.periods} aria-label="Số tiết" onChange={e => setD({ ...d, periods: Number(e.target.value) || 0 })} /></td>
      {us.length > 0 && <td><select value={d.unit} aria-label="Chủ đề/Chương" onChange={e => setD({ ...d, unit: e.target.value })}><option value="">— không —</option>{us.map(u => <option key={u.id} value={u.id}>{u.title}</option>)}</select></td>}
      <td></td><td><button type="button" className="btn sm primary" onClick={add}><Ic n="plus" /> Thêm</button></td></tr>}
  </tbody></table></div>
}
