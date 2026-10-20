import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { Code, Empty, Pill, Section, Stat, VCard, SCHOOL_YEAR, errMsg, fmtDY } from '../ui'
import { GRADES, catName, catOf, gradeLabel, type CatItem, type Curriculum } from '../curriculum/api'

type Pkg = { id: string; owner_org_id: string; code: string | null; name: string; tier: string | null; description: string | null; conditions: string | null
  status: string; version_no: number; based_on_id: string | null; created_at: string; updated_at: string }
type Item = { id: string; package_id: string; seq: number; curriculum_id: string; version_id: string | null; subject: string | null; grades: number[]; periods_total: number | null; notes: string | null }
type App = { id: string; package_id: string; org_id: string; school_year: string; grades: number[]; status: string; starts_on: string | null; ends_on: string | null; note: string | null }
type SubjRow = { version_id: string; subject: string; grade: number; periods_total: number }
type Ver = { id: string; curriculum_id: string; version_no: number; label: string | null; status: string }
type Org = { id: string; name: string; type: string; parent_id: string | null }

const STATUS: Record<string, [string, '' | 'good' | 'warn' | 'bad' | 'info']> = {
  draft: ['Đang soạn', ''], proposed: ['Đề xuất', 'warn'], approved: ['Đã duyệt', 'info'], active: ['Đang cung cấp', 'good'], archived: ['Ngừng', ''],
}
const APP_STATUS: Record<string, [string, '' | 'good' | 'warn']> = { proposed: ['Đề xuất', 'warn'], active: ['Đang áp dụng', 'good'], ended: ['Đã kết thúc', ''] }

// Gói chương trình: tập hợp chương trình / môn / khối / phiên bản cung cấp cho nhóm trường hoặc một trường
export function PackagesPanel({ orgId, cat, programs, canManage, orgs, below }: {
  orgId: string; cat: CatItem[]; programs: Curriculum[]; canManage: boolean; orgs: Org[]; below: Set<string>
}) {
  const [pkgs, setPkgs] = useState<Pkg[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [apps, setApps] = useState<App[]>([])
  const [subs, setSubs] = useState<SubjRow[]>([])
  const [vers, setVers] = useState<Ver[]>([])
  const [open, setOpen] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  async function load() {
    const [p, i, a, v] = await Promise.all([
      supabase.from('program_packages').select('*').order('created_at'),
      supabase.from('program_package_items').select('*').order('seq'),
      supabase.from('program_package_schools').select('*').order('school_year', { ascending: false }),
      supabase.from('curriculum_versions').select('id, curriculum_id, version_no, label, status').order('version_no'),
    ])
    if (p.error) return setMsg(errMsg(p.error.message))
    setPkgs((p.data as Pkg[]) ?? []); setItems((i.data as Item[]) ?? []); setApps((a.data as App[]) ?? []); setVers((v.data as Ver[]) ?? [])
    const vids = programs.map(c => c.current_version_id).filter(Boolean) as string[]
    if (vids.length) { const s = await supabase.from('curriculum_subjects').select('version_id, subject, grade, periods_total').in('version_id', vids); setSubs((s.data as SubjRow[]) ?? []) }
  }
  useEffect(() => { load() }, [programs.length])
  const prog = (id: string) => programs.find(c => c.id === id)

  // Thời lượng của một dòng gói: ghi đè, hoặc tổng tiết quy định của các môn / khối được chọn trong phiên bản
  const itemPeriods = (it: Item) => {
    if (it.periods_total != null) return it.periods_total
    const vid = it.version_id ?? prog(it.curriculum_id)?.current_version_id
    return subs.filter(s => s.version_id === vid && (!it.subject || s.subject === it.subject) && (!it.grades.length || it.grades.includes(s.grade))).reduce((a, s) => a + s.periods_total, 0)
  }
  const pkgPeriods = (p: Pkg) => items.filter(i => i.package_id === p.id).reduce((a, i) => a + itemPeriods(i), 0)

  async function create(base?: Pkg) {
    const name = prompt(base ? `Tạo gói mới từ “${base.name}” (sao chép chương trình, môn, khối). Tên gói:` : 'Tên gói chương trình mới:', base ? base.name + ' (bản sao)' : 'Gói ')
    if (!name) return
    const { data, error } = await supabase.from('program_packages').insert({ owner_org_id: orgId, name, tier: base?.tier ?? 'co_ban', description: base?.description ?? null,
      conditions: base?.conditions ?? null, based_on_id: base?.id ?? null, status: 'draft' }).select('id').single()
    if (error) return setMsg(errMsg(error.message))
    const id = (data as { id: string }).id
    if (base) {
      const rows = items.filter(i => i.package_id === base.id).map(({ id: _x, package_id: _y, ...r }) => ({ ...r, package_id: id }))
      if (rows.length) { const r = await supabase.from('program_package_items').insert(rows); if (r.error) setMsg(errMsg(r.error.message)) }
    }
    await load(); setOpen(id)
  }

  const p = pkgs.find(x => x.id === open)
  if (p) return <PackageDetail p={p} items={items.filter(i => i.package_id === p.id)} apps={apps.filter(a => a.package_id === p.id)} cat={cat} programs={programs}
    vers={vers} subs={subs} orgs={orgs} below={below} editable={canManage && p.owner_org_id === orgId} canApply={canManage} orgId={orgId}
    itemPeriods={itemPeriods} back={() => setOpen(null)} reload={load} copy={() => create(p)} />

  const mine = pkgs.filter(x => x.owner_org_id === orgId), others = pkgs.filter(x => x.owner_org_id !== orgId)
  const card = (x: Pkg) => {
    const its = items.filter(i => i.package_id === x.id)
    const tier = cat.find(c => c.kind === 'package_tier' && c.code === x.tier)
    const n = apps.filter(a => a.package_id === x.id && a.status === 'active').length
    return <VCard key={x.id} color={tier?.color} code={tier?.name ?? 'Gói'} icon="📦" status={<Pill tone={STATUS[x.status]?.[1]}>{STATUS[x.status]?.[0] ?? x.status}</Pill>}
      title={x.name} subtitle={x.code ?? undefined} desc={x.description}
      chips={Array.from(new Set(its.map(i => i.curriculum_id))).map(cid => prog(cid)?.code ?? '')}
      foot={<small>{its.length} dòng môn / khối · {pkgPeriods(x)} tiết · {n} trường</small>} onClick={() => setOpen(x.id)} />
  }
  return (
    <>
      {msg && <p className="msg">{msg}</p>}
      <p className="sub">Gói chương trình chọn chương trình, môn học, khối lớp và phiên bản để cung cấp cho một nhóm trường hoặc một trường. Gói Nâng cao có thể tạo từ gói Cơ bản rồi bổ sung chương trình, môn hoặc thời lượng.</p>
      <h3 className="cur-group">Gói của đơn vị <small>{mine.length}</small></h3>
      <div className="p1-grid">{mine.map(card)}{canManage && <button type="button" className="p1-card add" onClick={() => create()}>＋ Tạo gói chương trình</button>}</div>
      {others.length > 0 && <><h3 className="cur-group">Gói của KDI / cấp trên / đơn vị khác <small>{others.length}</small></h3><div className="p1-grid">{others.map(card)}</div></>}
      {!pkgs.length && !canManage && <Empty>Chưa có gói chương trình.</Empty>}
    </>
  )
}

function PackageDetail({ p, items, apps, cat, programs, vers, subs, orgs, below, editable, canApply, orgId, itemPeriods, back, reload, copy }: {
  p: Pkg; items: Item[]; apps: App[]; cat: CatItem[]; programs: Curriculum[]; vers: Ver[]; subs: SubjRow[]; orgs: Org[]; below: Set<string>
  editable: boolean; canApply: boolean; orgId: string; itemPeriods: (i: Item) => number; back: () => void; reload: () => void; copy: () => void
}) {
  const [msg, setMsg] = useState('')
  const [add, setAdd] = useState({ curriculum_id: '', subject: '', grades: [] as number[] })
  const [app, setApp] = useState({ org_id: '', school_year: SCHOOL_YEAR, grades: [] as number[] })
  const run = async (q: PromiseLike<{ error: { message: string } | null }>) => { const { error } = await q; if (error) setMsg(errMsg(error.message)); else { setMsg(''); reload() } }
  const upd = (patch: Partial<Pkg>) => run(supabase.from('program_packages').update(patch).eq('id', p.id))
  const updItem = (i: Item, patch: Partial<Item>) => run(supabase.from('program_package_items').update(patch).eq('id', i.id))
  const prog = (id: string) => programs.find(c => c.id === id)
  const subjectsOf = (cid: string) => { const vid = prog(cid)?.current_version_id; return Array.from(new Set(subs.filter(s => s.version_id === vid).map(s => s.subject))) }
  const gradesOf = (cid: string, subject: string | null) => { const vid = prog(cid)?.current_version_id; return Array.from(new Set(subs.filter(s => s.version_id === vid && (!subject || s.subject === subject)).map(s => s.grade))).sort((a, b) => a - b) }
  const schools = orgs.filter(o => o.type === 'school' && (below.has(o.id) || o.id === orgId || !below.size))
  const total = items.reduce((a, i) => a + itemPeriods(i), 0)
  const tiers = catOf(cat, 'package_tier')
  const published = programs.filter(c => c.current_version_id)

  return (
    <>
      <div className="p1-head">
        <button type="button" onClick={back}>← Tất cả gói</button>
        <h2>{p.name}</h2>
        <Pill tone={STATUS[p.status]?.[1]}>{STATUS[p.status]?.[0] ?? p.status}</Pill>
        {canApply && <button type="button" onClick={copy}>Tạo gói mới từ gói này</button>}
        {p.based_on_id && <p className="p1-sub">Tạo từ một gói có sẵn · cập nhật {fmtDY(p.updated_at.slice(0, 10))}</p>}
      </div>
      {msg && <p className="msg">{msg}</p>}
      <div className="p1-stats">
        <Stat label="Chương trình" value={new Set(items.map(i => i.curriculum_id)).size} sub={`${items.length} dòng môn / khối`} />
        <Stat label="Tổng thời lượng" value={total} sub="tiết / năm theo các môn đã chọn" />
        <Stat label="Trường đang áp dụng" value={apps.filter(a => a.status === 'active').length} sub={`${apps.filter(a => a.status === 'proposed').length} đề xuất`} />
      </div>
      <Section title="Thông tin gói">
        <div className="p1-form">
          <label><span>Tên gói</span><input disabled={!editable} defaultValue={p.name} onBlur={e => e.target.value !== p.name && upd({ name: e.target.value })} /></label>
          <label><span>Mã gói</span><input disabled={!editable} defaultValue={p.code ?? ''} onBlur={e => upd({ code: e.target.value || null })} /></label>
          <label><span>Hạng gói</span><select disabled={!editable} value={p.tier ?? ''} onChange={e => upd({ tier: e.target.value || null })}>
            <option value="">—</option>{tiers.map(t => <option key={t.id} value={t.code}>{t.name}</option>)}</select></label>
          <label><span>Trạng thái</span><select disabled={!editable} value={p.status} onChange={e => upd({ status: e.target.value })}>
            {Object.entries(STATUS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label className="wide"><span>Mô tả</span><textarea rows={2} disabled={!editable} defaultValue={p.description ?? ''} onBlur={e => upd({ description: e.target.value || null })} /></label>
          <label className="wide"><span>Điều kiện áp dụng (phòng, thiết bị, giáo viên…)</span><textarea rows={2} disabled={!editable} defaultValue={p.conditions ?? ''} onBlur={e => upd({ conditions: e.target.value || null })} /></label>
        </div>
      </Section>

      <Section title="Chương trình, môn học & khối lớp trong gói">
        {items.length === 0 ? <Empty>Gói chưa có chương trình nào.</Empty> : (
          <table className="p1-table">
            <thead><tr><th>Chương trình</th><th>Phiên bản</th><th>Môn học</th><th>Khối</th><th>Thời lượng</th>{editable && <th></th>}</tr></thead>
            <tbody>{items.map(i => {
              const c = prog(i.curriculum_id); const vs = vers.filter(v => v.curriculum_id === i.curriculum_id && ['published', 'superseded'].includes(v.status))
              return (
                <tr key={i.id}>
                  <td>{c ? <><Code color={c.color}>{c.code}</Code> {c.name}</> : '—'}</td>
                  <td>{editable ? <select value={i.version_id ?? ''} onChange={e => updItem(i, { version_id: e.target.value || null })} aria-label="Phiên bản">
                    <option value="">Bản đang hiệu lực</option>{vs.map(v => <option key={v.id} value={v.id}>Cố định: PB {v.version_no}{v.label ? ` · ${v.label}` : ''}</option>)}</select>
                    : i.version_id ? `PB ${vers.find(v => v.id === i.version_id)?.version_no}` : 'Bản đang hiệu lực'}</td>
                  <td>{editable ? <select value={i.subject ?? ''} onChange={e => updItem(i, { subject: e.target.value || null })} aria-label="Môn">
                    <option value="">Mọi môn</option>{subjectsOf(i.curriculum_id).map(s => <option key={s} value={s}>{catName(cat, 'subject', s)}</option>)}</select>
                    : i.subject ? catName(cat, 'subject', i.subject) : 'Mọi môn'}</td>
                  <td><div className="p1-chiprow">{gradesOf(i.curriculum_id, i.subject).map(g => { const on = !i.grades.length || i.grades.includes(g)
                    return <button type="button" key={g} className={on ? 'on' : ''} disabled={!editable} onClick={() => updItem(i, { grades: (i.grades.length ? i.grades : gradesOf(i.curriculum_id, i.subject)).includes(g) ? (i.grades.length ? i.grades : gradesOf(i.curriculum_id, i.subject)).filter(x => x !== g) : [...i.grades, g].sort((a, b) => a - b) })}>{g}</button> })}</div></td>
                  <td style={{ width: 150 }}>{editable ? <input type="number" min={0} defaultValue={i.periods_total ?? ''} placeholder={`${itemPeriods({ ...i, periods_total: null })} (theo quy định)`}
                    onBlur={e => updItem(i, { periods_total: e.target.value === '' ? null : Number(e.target.value) })} aria-label="Thời lượng" /> : `${itemPeriods(i)} tiết`}
                    {i.periods_total != null && <small className="sub"> ghi đè</small>}</td>
                  {editable && <td><button type="button" className="danger" aria-label="Bỏ dòng" onClick={() => run(supabase.from('program_package_items').delete().eq('id', i.id))}>×</button></td>}
                </tr>)
            })}</tbody>
          </table>)}
        {editable && <div className="p1-actions" style={{ marginTop: 12 }}>
          <select value={add.curriculum_id} onChange={e => setAdd({ curriculum_id: e.target.value, subject: '', grades: [] })} aria-label="Chương trình">
            <option value="">+ Thêm chương trình…</option>{published.map(c => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}</select>
          {add.curriculum_id && <select value={add.subject} onChange={e => setAdd({ ...add, subject: e.target.value })} aria-label="Môn">
            <option value="">Mọi môn</option>{subjectsOf(add.curriculum_id).map(s => <option key={s} value={s}>{catName(cat, 'subject', s)}</option>)}</select>}
          <button type="button" className="primary" disabled={!add.curriculum_id} onClick={() => run(supabase.from('program_package_items').insert({ package_id: p.id, curriculum_id: add.curriculum_id,
            subject: add.subject || null, grades: add.grades, seq: items.length + 1 })).then(() => setAdd({ curriculum_id: '', subject: '', grades: [] }))}>Thêm vào gói</button>
        </div>}
      </Section>

      <Section title="Trường áp dụng gói">
        {apps.length === 0 ? <Empty>Chưa áp dụng cho trường nào.</Empty> : (
          <table className="p1-table">
            <thead><tr><th>Trường</th><th>Năm học</th><th>Khối</th><th>Thời gian</th><th>Trạng thái</th>{canApply && <th></th>}</tr></thead>
            <tbody>{apps.map(a => (
              <tr key={a.id}>
                <td><b>{orgs.find(o => o.id === a.org_id)?.name ?? '—'}</b></td><td>{a.school_year}</td>
                <td>{a.grades.length ? a.grades.map(gradeLabel).join(', ') : 'Mọi khối'}</td>
                <td>{a.starts_on ? `${fmtDY(a.starts_on)} → ${fmtDY(a.ends_on)}` : '—'}</td>
                <td>{canApply ? <select value={a.status} onChange={e => run(supabase.from('program_package_schools').update({ status: e.target.value }).eq('id', a.id))} aria-label="Trạng thái">
                  {Object.entries(APP_STATUS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select> : <Pill tone={APP_STATUS[a.status]?.[1]}>{APP_STATUS[a.status]?.[0]}</Pill>}
                  {a.note && <><br /><small className="sub">{a.note}</small></>}</td>
                {canApply && <td><button type="button" className="danger" aria-label="Bỏ" onClick={() => confirm('Bỏ áp dụng gói cho trường này?') && run(supabase.from('program_package_schools').delete().eq('id', a.id))}>×</button></td>}
              </tr>))}</tbody>
          </table>)}
        {canApply && <div className="p1-actions" style={{ marginTop: 12 }}>
          <select value={app.org_id} onChange={e => setApp({ ...app, org_id: e.target.value })} aria-label="Trường"><option value="">+ Áp dụng cho trường…</option>
            {schools.filter(s => !apps.some(a => a.org_id === s.id && a.school_year === app.school_year)).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <input value={app.school_year} onChange={e => setApp({ ...app, school_year: e.target.value })} aria-label="Năm học" style={{ width: 110 }} />
          <div className="p1-chiprow">{GRADES.filter(g => g > 0).map(g => <button type="button" key={g} className={app.grades.includes(g) ? 'on' : ''}
            onClick={() => setApp({ ...app, grades: app.grades.includes(g) ? app.grades.filter(x => x !== g) : [...app.grades, g].sort((a, b) => a - b) })}>{g}</button>)}</div>
          <button type="button" className="primary" disabled={!app.org_id} onClick={() => run(supabase.from('program_package_schools').insert({ package_id: p.id, org_id: app.org_id,
            school_year: app.school_year, grades: app.grades, status: 'active' })).then(() => setApp({ org_id: '', school_year: SCHOOL_YEAR, grades: [] }))}>Áp dụng</button>
        </div>}
      </Section>
    </>
  )
}
