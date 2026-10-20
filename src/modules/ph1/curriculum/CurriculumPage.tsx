import { Fragment, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { Tabs } from '../../../pages/teacher/common'
import { Tiles } from '../../../pages/department/charts'
import { CatalogPanel } from './Catalog'
import { StructureEditor, MultiPick } from './Structure'
import { OutcomesEditor } from './Outcomes'
import { VersionsPanel, VStatusPill } from './Versions'
import {
  CAT_KIND, GRADES, SCOPE, catName, catOf, effectiveCatalog, errText, fmtDate, gradeLabel, labelsOf, loadContent, useCatalog, useOrgs, vName,
  type CatItem, type Content, type Curriculum, type Labels, type Scope, type Version,
} from './api'
import './curriculum.css'

type Avail = { curriculum_id: string; version_id: string; owner_org_id: string; owner_name: string; code: string | null; name: string; category: string | null
  levels: string[]; grades: number[]; subjects: string[]; version_label: string | null; version_no: number; effective_from: string | null
  units: number; lessons: number; periods: number; is_own: boolean; source_curriculum_id: string | null }
type Top = 'mine' | 'shared' | 'catalog'

// 1.1.1 Chương trình đào tạo: chương trình gồm những gì, học sinh cần đạt gì.
// Đơn vị (KDI, Sở/Phòng, trường) soạn chương trình theo phiên bản → duyệt → ban hành; đơn vị cấp dưới kế thừa để điều chỉnh.
export function CurriculumPage({ orgId, go }: { orgId: string | null; go?: (p: string) => void }) {
  const [canManage, setCanManage] = useState(false)
  const [isPlatform, setIsPlatform] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [list, setList] = useState<Curriculum[]>([])
  const [avail, setAvail] = useState<Avail[]>([])
  const [top, setTop] = useState<Top>('mine')
  const [openId, setOpenId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [catKey, setCatKey] = useState(0)
  const [msg, setMsg] = useState(''); const [info, setInfo] = useState(''); const [err, setErr] = useState('')
  const { all, hidden } = useCatalog(catKey)
  const { orgs, below, me } = useOrgs(orgId)
  const cat = effectiveCatalog(all, hidden, below)

  async function load() {
    if (!orgId) return
    const [c, a, m, p, u] = await Promise.all([
      supabase.from('curricula').select('*, owner_name').order('updated_at', { ascending: false }),
      supabase.rpc('curriculum_available'),
      supabase.rpc('curriculum_can_manage'),
      supabase.rpc('is_platform_admin'),
      supabase.auth.getUser(),
    ])
    if (c.error) return setErr(errText(c.error.message))
    setList((c.data as Curriculum[]) ?? []); setAvail((a.data as Avail[]) ?? [])
    setCanManage(m.data === true); setIsPlatform(p.data === true); setUserId(u.data.user?.id ?? null)
  }
  useEffect(() => { load() }, [orgId])
  if (err) return <p className="msg">{err}</p>
  if (!orgId) return <p className="sub">Đang tải…</p>

  const open = list.find(c => c.id === openId) ?? null
  if (open) return <CurriculumDetail key={open.id} cur={open} orgId={orgId} cat={cat} canManage={canManage} userId={userId} orgs={orgs} below={below}
    sourceName={open.source_curriculum_id ? list.find(x => x.id === open.source_curriculum_id)?.name ?? avail.find(x => x.curriculum_id === open.source_curriculum_id)?.name ?? 'chương trình nguồn' : null}
    newerSource={!!open.source_curriculum_id && avail.some(x => x.curriculum_id === open.source_curriculum_id && x.version_id !== open.source_version_id)}
    back={() => { setOpenId(null); load() }} reload={load} go={go} />

  const mine = list.filter(c => c.owner_org_id === orgId)
  const shared = avail.filter(a => !a.is_own)
  const below_ = list.filter(c => c.owner_org_id !== orgId && below.has(c.owner_org_id))
  async function clone(a: Avail) {
    const name = prompt(`Kế thừa “${a.name}” thành chương trình của ${me?.name ?? 'đơn vị'} để điều chỉnh. Tên chương trình:`, a.name)
    if (name === null) return
    const { data, error } = await supabase.rpc('curriculum_clone', { p_version: a.version_id, p_name: name })
    if (error) return setMsg(errText(error.message))
    setInfo(`Đã tạo “${name}” (bản nháp) từ ${a.owner_name}. Sửa nội dung rồi gửi duyệt / ban hành.`); await load(); setOpenId(data as string)
  }

  return (
    <>
      <Tiles items={[
        { label: 'Chương trình của đơn vị', value: mine.length, sub: `${mine.filter(c => c.current_version_id).length} đang hiệu lực` },
        { label: 'Đang soạn / chờ duyệt', value: mine.filter(c => !c.current_version_id).length, sub: 'chưa ban hành lần nào' },
        { label: 'Được phát hành tới đơn vị', value: shared.length, sub: 'từ KDI / cấp trên' },
        ...(below_.length ? [{ label: 'Của đơn vị trực thuộc', value: below_.length, sub: 'xem để theo dõi' }] : []),
      ]} />
      <div className="bar">
        <Tabs items={[['mine', 'Chương trình của đơn vị', mine.length + below_.length], ['shared', 'Được phát hành tới', shared.length], ['catalog', 'Danh mục']] as [Top, string, number?][]}
          value={top} onChange={t => { setTop(t); setCreating(false) }} />
        {canManage && top === 'mine' && <div className="actions"><button type="button" className="primary" onClick={() => { setCreating(true); setMsg(''); setInfo('') }}>+ Chương trình mới</button></div>}
      </div>
      {msg && <p className="msg">{msg}</p>}
      {info && <p className="sub"><b>{info}</b></p>}
      {top === 'mine' && creating && <InfoForm cat={cat} orgs={orgs} below={below} me={me} isPlatform={isPlatform} onCancel={() => setCreating(false)}
        onSave={async v => {
          const { data, error } = await supabase.rpc('curriculum_create', { p: v })
          if (error) return errText(error.message)
          setCreating(false); await load(); setOpenId(data as string); return null
        }} />}

      {top === 'mine' && <CurriculumTable rows={[...mine, ...below_]} cat={cat} orgId={orgId} open={setOpenId}
        empty={canManage ? 'Chưa có chương trình. Bấm “+ Chương trình mới” hoặc kế thừa một chương trình ở tab “Được phát hành tới”.' : 'Đơn vị chưa có chương trình riêng.'} />}
      {top === 'shared' && <div className="wrap"><table>
        <thead><tr><th>Chương trình</th><th>Đơn vị ban hành</th><th>Phạm vi áp dụng</th><th>Phiên bản hiệu lực</th><th>Quy mô</th><th></th></tr></thead>
        <tbody>
          {shared.map(a => (
            <tr key={a.curriculum_id}>
              <td><CatChip cat={cat} code={a.category} /> <b>{a.name}</b>{a.code && <small className="sub"> · {a.code}</small>}</td>
              <td>{a.owner_name}</td>
              <td>{[a.levels.map(l => catName(cat, 'level', l)).join(', '), a.grades.length ? 'Khối ' + a.grades.join(', ') : ''].filter(Boolean).join(' · ') || '—'}</td>
              <td>{vName({ version_no: a.version_no, label: a.version_label })}<br /><small className="sub">từ {fmtDate(a.effective_from)}</small></td>
              <td>{a.units} chủ đề · {a.lessons} bài · {a.periods} tiết</td>
              <td className="actions">
                <button type="button" onClick={() => setOpenId(a.curriculum_id)}>Xem</button>
                {canManage && <button type="button" className="primary" onClick={() => clone(a)}
                  title="Tạo bản của đơn vị mình để điều chỉnh; được báo khi nguồn có phiên bản mới">{mine.some(c => c.source_curriculum_id === a.curriculum_id) ? 'Kế thừa lại' : 'Kế thừa để điều chỉnh'}</button>}
              </td>
            </tr>
          ))}
          {shared.length === 0 && <tr><td colSpan={6}>Chưa có chương trình nào được phát hành tới đơn vị.</td></tr>}
        </tbody>
      </table></div>}
      {top === 'catalog' && <CatalogPanel orgId={orgId} all={all} hidden={hidden} orgs={orgs} below={below} canManage={canManage} isPlatform={isPlatform} onChange={() => setCatKey(k => k + 1)} />}
    </>
  )
}

function CatChip({ cat, code }: { cat: CatItem[]; code: string | null }) {
  if (!code) return null
  const c = cat.find(i => i.kind === 'category' && i.code === code)
  return <span className="progchip" style={{ background: c?.color ?? '#64748b', color: '#fff' }} title={c?.name ?? code}>{code}</span>
}

function CurriculumTable({ rows, cat, orgId, open, empty }: { rows: Curriculum[]; cat: CatItem[]; orgId: string; open: (id: string) => void; empty: string }) {
  const [vers, setVers] = useState<Map<string, Version[]>>(new Map())
  useEffect(() => {
    if (!rows.length) return
    supabase.from('curriculum_versions').select('*').in('curriculum_id', rows.map(r => r.id)).order('version_no').then(({ data }) => {
      const m = new Map<string, Version[]>(); ((data as Version[]) ?? []).forEach(v => m.set(v.curriculum_id, [...(m.get(v.curriculum_id) ?? []), v])); setVers(m)
    })
  }, [rows.map(r => r.id + r.updated_at).join()])
  return (
    <div className="wrap"><table>
      <thead><tr><th>Chương trình</th><th>Phạm vi áp dụng</th><th>Đang hiệu lực</th><th>Đang soạn</th><th>Phát hành tới</th><th></th></tr></thead>
      <tbody>
        {rows.map(c => {
          const vs = vers.get(c.id) ?? []
          const cur = vs.find(v => v.id === c.current_version_id)
          const wip = vs.find(v => ['draft', 'pending', 'approved', 'rejected'].includes(v.status))
          return (
            <tr key={c.id} className={c.archived_at ? 'cur-muted' : ''}>
              <td><CatChip cat={cat} code={c.category} /> <b>{c.name}</b>{c.code && <small className="sub"> · {c.code}</small>}
                {c.owner_org_id !== orgId && <><br /><small className="sub">{c.owner_name}</small></>}
                {c.archived_at && <><br /><small className="sub">Đã lưu trữ</small></>}</td>
              <td>{[c.levels.map(l => catName(cat, 'level', l)).join(', '), c.grades.length ? 'Khối ' + c.grades.join(', ') : ''].filter(Boolean).join(' · ') || '—'}</td>
              <td>{cur ? <>{vName(cur)}<br /><small className="sub">từ {fmtDate(cur.effective_from)}</small></> : <span className="sub">Chưa ban hành</span>}</td>
              <td>{wip ? <VStatusPill s={wip.status} /> : <span className="sub">—</span>}</td>
              <td>{SCOPE[c.scope]}</td>
              <td className="actions"><button type="button" className="primary" onClick={() => open(c.id)}>Mở</button></td>
            </tr>
          )
        })}
        {rows.length === 0 && <tr><td colSpan={6}>{empty}</td></tr>}
      </tbody>
    </table></div>
  )
}

// ===== Thông tin chung (tạo mới / sửa) =====
type InfoVals = { name: string; code: string; category: string; summary: string; issuer: string; levels: string[]; grades: number[]; subjects: string[]
  fields: string[]; scope: Scope; require_approval: boolean; structure_labels: Labels; targets: string[] }
function InfoForm({ cur, cat, orgs, below, me, isPlatform, targets, onSave, onCancel, readOnly }: {
  cur?: Curriculum; cat: CatItem[]; orgs: { id: string; name: string; type: string; parent_id: string | null }[]; below: Set<string>
  me: { id: string; name: string; type: string } | null; isPlatform: boolean; targets?: string[]
  onSave: (v: InfoVals) => Promise<string | null>; onCancel?: () => void; readOnly?: boolean
}) {
  const [v, setV] = useState<InfoVals>(() => ({
    name: cur?.name ?? '', code: cur?.code ?? '', category: cur?.category ?? '', summary: cur?.summary ?? '', issuer: cur?.issuer ?? me?.name ?? '',
    levels: cur?.levels ?? [], grades: cur?.grades ?? [], subjects: cur?.subjects ?? [], fields: cur?.fields ?? [],
    scope: cur?.scope ?? (me?.type === 'school' ? 'own' : 'children'), require_approval: cur?.require_approval ?? true,
    structure_labels: labelsOf(cur ?? null), targets: targets ?? [],
  }))
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const canPublic = me?.type === 'provider' || isPlatform
  const ro = !!readOnly
  const belowList = orgs.filter(o => below.has(o.id))
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (!v.name.trim()) return setErr('Nhập tên chương trình.')
    if (v.scope === 'selected' && v.targets.length === 0) return setErr('Chọn ít nhất một đơn vị nhận.')
    setBusy(true); const m = await onSave({ ...v, name: v.name.trim() }); setBusy(false); setErr(m ?? '')
  }
  return (
    <form className="panel" onSubmit={submit}>
      {!cur && <h3>Chương trình mới</h3>}
      <div className="formgrid">
        <label className="field" style={{ gridColumn: 'span 2' }}><span>Tên chương trình *</span><input required disabled={ro} value={v.name} onChange={e => setV({ ...v, name: e.target.value })} /></label>
        <label className="field"><span>Mã</span><input disabled={ro} value={v.code} onChange={e => setV({ ...v, code: e.target.value })} placeholder="VD: SC-TH" /></label>
        <label className="field"><span>{CAT_KIND.category[0]}</span><select disabled={ro} value={v.category} onChange={e => setV({ ...v, category: e.target.value })}>
          <option value="">—</option>{catOf(cat, 'category').map(c => <option key={c.id} value={c.code}>{c.code} · {c.name}</option>)}</select></label>
        <label className="field" style={{ gridColumn: 'span 2' }}><span>Đơn vị ban hành</span><input disabled={ro} value={v.issuer} onChange={e => setV({ ...v, issuer: e.target.value })} /></label>
        <label className="field"><span>Phát hành tới</span><select disabled={ro} value={v.scope} onChange={e => setV({ ...v, scope: e.target.value as Scope })}>
          {(Object.keys(SCOPE) as Scope[]).filter(s => s !== 'public' || canPublic).map(s => <option key={s} value={s}>{SCOPE[s]}</option>)}</select></label>
        <label className="field"><span>Phê duyệt</span><select disabled={ro} value={v.require_approval ? '1' : '0'} onChange={e => setV({ ...v, require_approval: e.target.value === '1' })}>
          <option value="1">Phải duyệt trước khi ban hành</option><option value="0">Ban hành không cần duyệt</option></select></label>
        <label className="field" style={{ gridColumn: '1 / -1' }}><span>Giới thiệu / mục tiêu chung</span><textarea rows={3} disabled={ro} value={v.summary} onChange={e => setV({ ...v, summary: e.target.value })} /></label>
        <div className="field" style={{ gridColumn: '1 / -1' }}><span>Cấp học</span><MultiPick label="Cấp học" items={catOf(cat, 'level')} value={v.levels} disabled={ro} onChange={x => setV({ ...v, levels: x })} /></div>
        <div className="field" style={{ gridColumn: '1 / -1' }}><span>Khối lớp</span>
          <div className="cur-chips">{GRADES.map(g => { const on = v.grades.includes(g); return <button type="button" key={g} disabled={ro} className={'chip' + (on ? ' on' : '')} aria-pressed={on}
            onClick={() => setV({ ...v, grades: on ? v.grades.filter(x => x !== g) : [...v.grades, g].sort((a, b) => a - b) })}>{gradeLabel(g)}</button> })}</div></div>
        <div className="field" style={{ gridColumn: '1 / -1' }}><span>Môn học</span><MultiPick label="Môn học" items={catOf(cat, 'subject')} value={v.subjects} disabled={ro} onChange={x => setV({ ...v, subjects: x })} /></div>
        <div className="field" style={{ gridColumn: '1 / -1' }}><span>Lĩnh vực áp dụng</span><MultiPick label="Lĩnh vực" items={catOf(cat, 'field')} value={v.fields} disabled={ro} onChange={x => setV({ ...v, fields: x })} /></div>
        <fieldset className="cur-labels" style={{ gridColumn: '1 / -1' }} disabled={ro}><legend>Tên các cấp cấu trúc (đơn vị tự đặt)</legend>
          {(['unit', 'lesson', 'period'] as const).map(k => <label className="field" key={k}><span>{({ unit: 'Cấp 1', lesson: 'Cấp 2', period: 'Đơn vị thời lượng' })[k]}</span>
            <input value={v.structure_labels[k]} onChange={e => setV({ ...v, structure_labels: { ...v.structure_labels, [k]: e.target.value } })} /></label>)}
        </fieldset>
      </div>
      {v.scope === 'selected' && <fieldset className="libtargets" disabled={ro}><legend>Đơn vị nhận (gồm đơn vị trực thuộc của đơn vị được chọn)</legend>
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
type DTab = 'info' | 'structure' | 'outcomes' | 'versions'
function CurriculumDetail({ cur, orgId, cat, canManage, userId, orgs, below, sourceName, newerSource, back, reload, go }: {
  cur: Curriculum; orgId: string; cat: CatItem[]; canManage: boolean; userId: string | null; orgs: { id: string; name: string; type: string; parent_id: string | null }[]
  below: Set<string>; sourceName: string | null; newerSource: boolean; back: () => void; reload: () => void; go?: (p: string) => void
}) {
  const [versions, setVersions] = useState<Version[]>([])
  const [sel, setSel] = useState<string | null>(null)
  const [content, setContent] = useState<Content | null>(null)
  const [targets, setTargets] = useState<string[]>([])
  const [tab, setTab] = useState<DTab>('structure')
  const [msg, setMsg] = useState(''); const [info, setInfo] = useState('')
  const [isPlatform, setIsPlatform] = useState(false)
  const isOwner = cur.owner_org_id === orgId
  const labels = labelsOf(cur)
  const me = orgs.find(o => o.id === orgId) ?? null

  async function loadVersions(pick?: string) {
    const { data, error } = await supabase.from('curriculum_versions').select('*').eq('curriculum_id', cur.id).order('version_no', { ascending: false })
    if (error) return setMsg(errText(error.message))
    const vs = (data as Version[]) ?? []; setVersions(vs)
    const keep = pick ?? sel
    const def = vs.find(v => ['draft', 'pending', 'approved', 'rejected'].includes(v.status)) ?? vs.find(v => v.id === cur.current_version_id) ?? vs[0]
    setSel(keep && vs.some(v => v.id === keep) ? keep : def?.id ?? null)
  }
  const loadC = async () => { if (sel) setContent(await loadContent(sel)) }
  useEffect(() => {
    loadVersions()
    supabase.from('curriculum_targets').select('org_id').eq('curriculum_id', cur.id).then(({ data }) => setTargets(((data as { org_id: string }[]) ?? []).map(x => x.org_id)))
    supabase.rpc('is_platform_admin').then(({ data }) => setIsPlatform(data === true))
  }, [cur.id])
  useEffect(() => { setContent(null); loadC() }, [sel])

  const version = versions.find(v => v.id === sel) ?? null
  const editable = !!version && isOwner && canManage && !cur.archived_at && ['draft', 'rejected'].includes(version.status)
  const refresh = () => { loadVersions(); loadC(); reload() }

  async function saveInfo(v: InfoVals) {
    const { error } = await supabase.from('curricula').update({
      name: v.name, code: v.code.trim() || null, category: v.category || null, summary: v.summary.trim() || null, issuer: v.issuer.trim() || null,
      levels: v.levels, grades: v.grades, subjects: v.subjects, fields: v.fields, scope: v.scope, require_approval: v.require_approval, structure_labels: v.structure_labels,
    }).eq('id', cur.id)
    if (error) return errText(error.message)
    await supabase.from('curriculum_targets').delete().eq('curriculum_id', cur.id)
    if (v.scope === 'selected' && v.targets.length) {
      const t = await supabase.from('curriculum_targets').insert(v.targets.map(org_id => ({ curriculum_id: cur.id, org_id })))
      if (t.error) return errText(t.error.message)
    }
    setTargets(v.targets); setInfo('Đã lưu thông tin chung.'); reload(); return null
  }
  async function archive(on: boolean) {
    if (on && !confirm(`Lưu trữ “${cur.name}”? Chương trình không còn hiện ở “Được phát hành tới” của đơn vị khác; lịch sử giữ nguyên.`)) return
    const { error } = await supabase.rpc('curriculum_archive', { p_curriculum: cur.id, p_archive: on })
    if (error) setMsg(errText(error.message)); else { setInfo(on ? 'Đã lưu trữ.' : 'Đã mở lại.'); reload() }
  }
  async function remove() {
    if (!confirm(`Xoá hẳn “${cur.name}”? Chỉ xoá được chương trình chưa từng ban hành.`)) return
    const { error, count } = await supabase.from('curricula').delete({ count: 'exact' }).eq('id', cur.id)
    if (error) setMsg(errText(error.message)); else if (!count) setMsg('Không xoá được: chương trình đã từng ban hành — dùng Lưu trữ.'); else back()
  }

  const cats = catName(cat, 'category', cur.category)
  return (
    <>
      <div className="bar">
        <button type="button" onClick={back}>← Danh sách</button>
        <h2 className="cur-title"><CatChip cat={cat} code={cur.category} /> {cur.name}</h2>
        {isOwner && canManage && <div className="actions">
          {cur.archived_at ? <button type="button" onClick={() => archive(false)}>Mở lại</button> : <button type="button" onClick={() => archive(true)}>Lưu trữ</button>}
          {!cur.current_version_id && <button type="button" className="danger" onClick={remove}>Xoá</button>}
        </div>}
      </div>
      <p className="sub">{[cats, cur.issuer ?? cur.owner_name, cur.grades.length ? 'Khối ' + cur.grades.join(', ') : '', SCOPE[cur.scope]].filter(Boolean).join(' · ')}
        {sourceName && <> · Kế thừa từ <b>{sourceName}</b></>}</p>
      {newerSource && isOwner && <p className="msg">Chương trình nguồn đã ban hành phiên bản mới. Xem ở tab “Được phát hành tới” và kế thừa lại hoặc cập nhật thủ công.</p>}
      {!isOwner && <p className="sub">Bạn đang xem chương trình của {cur.owner_name}{canManage ? ' — dùng “Kế thừa để điều chỉnh” ở danh sách để có bản riêng.' : '.'}</p>}

      <div className="bar">
        <Tabs items={[['structure', 'Cấu trúc nội dung'], ['outcomes', 'Chuẩn đầu ra & đánh giá'], ['versions', 'Phiên bản & phê duyệt', versions.length], ['info', 'Thông tin chung']] as [DTab, string, number?][]}
          value={tab} onChange={setTab} />
        {version && <span className="cur-vpick">
          <select value={sel ?? ''} onChange={e => setSel(e.target.value)} aria-label="Phiên bản đang xem">
            {versions.map(v => <option key={v.id} value={v.id}>{vName(v)}</option>)}</select>
          <VStatusPill s={version.status} />
          {!editable && <small className="sub">{isOwner && canManage ? (version.status === 'pending' ? 'đang chờ duyệt — chỉ xem' : version.status === 'approved' ? 'đã duyệt — chờ ban hành' : 'muốn sửa: tạo phiên bản mới') : 'chỉ xem'}</small>}
        </span>}
      </div>
      {msg && <p className="msg">{msg}</p>}
      {info && <p className="sub"><b>{info}</b></p>}

      {tab === 'info' && <InfoForm cur={cur} cat={cat} orgs={orgs} below={below} me={me} isPlatform={isPlatform} targets={targets} readOnly={!(isOwner && canManage)} onSave={saveInfo} />}
      {tab !== 'info' && tab !== 'versions' && (!version ? <p className="sub">Chương trình chưa có phiên bản.</p> : !content ? <p className="sub">Đang tải…</p> : <Fragment key={version.id}>
        {tab === 'structure' && <StructureEditor versionId={version.id} content={content} cat={cat} labels={labels} editable={editable} reload={loadC} setMsg={setMsg} />}
        {tab === 'outcomes' && <OutcomesEditor versionId={version.id} content={content} cat={cat} labels={labels} editable={editable} reload={loadC} setMsg={setMsg} />}
      </Fragment>)}
      {tab === 'versions' && <VersionsPanel cur={cur} versions={versions} selected={version} onSelect={id => setSel(id)} canManage={canManage} isOwner={isOwner}
        userId={userId} labels={labels} reload={refresh} setMsg={setMsg} setInfo={setInfo} />}
    </>
  )
}
