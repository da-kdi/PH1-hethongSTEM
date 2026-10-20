import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { Tabs } from '../../../pages/teacher/common'
import { Empty, Pill, Section, Stat, Tree, errMsg, fmtDY, useOrgList, type TreeNode } from '../ui'
import { catName, effectiveCatalog, gradeLabel, useCatalog, useOrgs } from '../curriculum/api'
import { BASIS, NORM_CAT, type MLesson, type Norm } from '../materials/MaterialsPage'

type Activity = { title: string; minutes?: number; teacher?: string; student?: string; product?: string }
type DSession = { title: string; minutes?: number; activities: Activity[] }
type DNorm = { name: string; spec?: string | null; unit: string; qty: number; basis: string; category: string }
type Design = { id: string; org_id: string; teacher_id: string | null; material_lesson_id: string | null; curriculum_lesson_id: string | null; based_on_id: string | null
  title: string; subject: string | null; grade: number | null; status: string; version_no: number; objectives: string | null; sessions: DSession[]; norms: DNorm[]
  files: { title: string; url?: string }[]; criteria: { name: string; levels: string[] }[]; notes: string | null; updated_at: string }
type MSetLite = { id: string; name: string; subject: string | null; grade: number | null }

const STATUS: Record<string, [string, '' | 'good' | 'warn']> = { draft: ['Bản nháp', ''], review: ['Chờ duyệt', 'warn'], published: ['Đã phát hành', 'good'] }

// 1.1.4 Soạn bài giảng & kho hoạt động: giáo án triển khai tạo từ học liệu gốc (hoặc từ đầu), tuỳ chỉnh buổi / hoạt động / vật tư theo lớp.
// Học liệu gốc và chương trình chuẩn không bị sửa → giữ chuẩn hoá và truy xuất được nguồn.
export function DesignsPage({ orgId, teacherId }: { orgId: string | null; teacherId?: string | null }) {
  const [list, setList] = useState<Design[]>([])
  const [sets, setSets] = useState<MSetLite[]>([])
  const [mlessons, setMlessons] = useState<Pick<MLesson, 'id' | 'set_id' | 'title' | 'seq'>[]>([])
  const [sel, setSel] = useState<string | null>(null)
  const [from, setFrom] = useState('')
  const [msg, setMsg] = useState('')
  const orgs = useOrgList()
  const { all, hidden } = useCatalog()
  const { below } = useOrgs(orgId)
  const cat = effectiveCatalog(all, hidden, below)
  async function load(pick?: string) {
    const [d, s, l] = await Promise.all([
      supabase.from('lesson_designs').select('*').order('updated_at', { ascending: false }),
      supabase.from('material_sets').select('id, name, subject, grade').neq('status', 'archived').order('name'),
      supabase.from('material_lessons').select('id, set_id, title, seq').order('seq'),
    ])
    if (d.error) return setMsg(errMsg(d.error.message))
    const ds = (d.data as Design[]) ?? []; setList(ds); setSets((s.data as MSetLite[]) ?? []); setMlessons((l.data as any[]) ?? [])
    setSel(pick ?? (sel && ds.some(x => x.id === sel) ? sel : ds[0]?.id ?? null))
  }
  useEffect(() => { load() }, [orgId])

  async function createFrom(mlId: string | null) {
    if (!orgId) return
    let row: Partial<Design> = { title: 'Giáo án mới', sessions: [{ title: 'Buổi 1', minutes: 45, activities: [] }], norms: [], criteria: [], files: [] }
    if (mlId) {
      const [a, n, f] = await Promise.all([
        supabase.from('material_lessons').select('*').eq('id', mlId).single(),
        supabase.from('material_norms').select('*').eq('lesson_id', mlId).order('seq'),
        supabase.from('material_files').select('title, url').eq('lesson_id', mlId).order('seq'),
      ])
      const m = a.data as MLesson; const st = sets.find(s => s.id === m.set_id)
      const ss = Array.from(new Set(m.steps.map(s => s.session ?? 1))).sort((x, y) => x - y)
      row = { title: m.title, subject: st?.subject ?? m.subject_main, grade: st?.grade ?? null, objectives: m.objectives, material_lesson_id: m.id, curriculum_lesson_id: m.curriculum_lesson_id,
        sessions: (ss.length ? ss : [1]).map(k => ({ title: `Buổi ${k}`, minutes: m.steps.filter(s => (s.session ?? 1) === k).reduce((x, s) => x + (s.minutes ?? 0), 0),
          activities: m.steps.filter(s => (s.session ?? 1) === k).map(s => ({ title: s.title, minutes: s.minutes, teacher: s.teacher, student: s.student, product: '' })) })),
        norms: ((n.data as Norm[]) ?? []).map(x => ({ name: x.name, spec: x.spec, unit: x.unit, qty: Number(x.qty), basis: x.basis, category: x.category })),
        files: ((f.data as any[]) ?? []).map(x => ({ title: x.title, url: x.url ?? undefined })), criteria: m.criteria }
    }
    const { data, error } = await supabase.from('lesson_designs').insert({ ...row, org_id: orgId, teacher_id: teacherId ?? null, status: 'draft' }).select('id').single()
    if (error) return setMsg(errMsg(error.message))
    setFrom(''); load((data as { id: string }).id)
  }

  const tree: TreeNode[] = useMemo(() => {
    const byOrg = new Map<string, Design[]>(); list.forEach(d => byOrg.set(d.org_id, [...(byOrg.get(d.org_id) ?? []), d]))
    return [...byOrg.entries()].map(([oid, ds]) => ({ id: 'o:' + oid, label: <b>{orgs.find(o => o.id === oid)?.name ?? 'Đơn vị'}</b>, meta: `${ds.length} giáo án`,
      children: ds.map(d => ({ id: d.id, label: d.title, meta: `${catName(cat, 'subject', d.subject)}${d.grade != null ? ' · ' + gradeLabel(d.grade) : ''} · ${STATUS[d.status]?.[0]}`,
        badge: d.material_lesson_id ? <Pill tone="info">Từ học liệu</Pill> : undefined })) }))
  }, [list, orgs, cat])
  const d = list.find(x => x.id === sel)
  return (
    <>
      <div className="p1-stats">
        <Stat label="Giáo án" value={list.length} sub={`${list.filter(x => x.status === 'published').length} đã phát hành`} />
        <Stat label="Tạo từ học liệu gốc" value={list.filter(x => x.material_lesson_id).length} />
        <Stat label="Đang soạn" value={list.filter(x => x.status === 'draft').length} />
      </div>
      {msg && <p className="msg">{msg}</p>}
      <div className="p1-layout">
        <aside className="p1-aside">
          <h4>Tạo giáo án</h4>
          <select value={from} onChange={e => setFrom(e.target.value)} aria-label="Từ học liệu" style={{ width: '100%', marginBottom: 6 }}>
            <option value="">— Từ bài trong học liệu —</option>
            {sets.map(s => <optgroup key={s.id} label={s.name}>{mlessons.filter(l => l.set_id === s.id).map(l => <option key={l.id} value={l.id}>{l.title}</option>)}</optgroup>)}
          </select>
          <div className="p1-actions" style={{ marginBottom: 14 }}>
            <button type="button" className="primary" disabled={!from} onClick={() => createFrom(from)}>Tạo từ học liệu</button>
            <button type="button" onClick={() => createFrom(null)}>Giáo án trống</button>
          </div>
          <h4>Giáo án</h4>
          {tree.length ? <Tree nodes={tree} selected={sel} onSelect={id => !id.startsWith('o:') && setSel(id)} defaultOpen={2} /> : <Empty>Chưa có giáo án.</Empty>}
        </aside>
        <div>{d ? <DesignEditor key={d.id} d={d} cat={cat} orgs={orgs} reload={() => load(d.id)} onCopy={async () => {
          const { id: _i, updated_at: _u, ...rest } = d
          const r = await supabase.from('lesson_designs').insert({ ...rest, title: d.title + ' (bản sao)', based_on_id: d.id, status: 'draft', version_no: 1, org_id: orgId }).select('id').single()
          if (r.error) setMsg(errMsg(r.error.message)); else load((r.data as { id: string }).id)
        }} onDelete={async () => { if (!confirm('Xoá giáo án này?')) return; const r = await supabase.from('lesson_designs').delete().eq('id', d.id); if (r.error) setMsg(errMsg(r.error.message)); else load() }} />
          : <Empty>Chọn hoặc tạo một giáo án.</Empty>}</div>
      </div>
    </>
  )
}

type T = 'flow' | 'norms' | 'files' | 'criteria'
function DesignEditor({ d, cat, orgs, reload, onCopy, onDelete }: { d: Design; cat: ReturnType<typeof effectiveCatalog>; orgs: { id: string; name: string }[]; reload: () => void; onCopy: () => void; onDelete: () => void }) {
  const [tab, setTab] = useState<T>('flow')
  const [msg, setMsg] = useState('')
  const [src, setSrc] = useState<Norm[] | null>(null)
  useEffect(() => { if (d.material_lesson_id) supabase.from('material_norms').select('*').eq('lesson_id', d.material_lesson_id).then(({ data }) => setSrc((data as Norm[]) ?? [])) }, [d.material_lesson_id])
  const upd = async (p: Partial<Design>) => { const { error } = await supabase.from('lesson_designs').update(p).eq('id', d.id); if (error) setMsg(errMsg(error.message)); else { setMsg(''); reload() } }
  const setSess = (i: number, p: Partial<DSession>) => upd({ sessions: d.sessions.map((s, j) => j === i ? { ...s, ...p } : s) })
  const setAct = (i: number, k: number, p: Partial<Activity>) => setSess(i, { activities: d.sessions[i].activities.map((a, j) => j === k ? { ...a, ...p } : a) })
  const total = d.sessions.reduce((a, s) => a + s.activities.reduce((x, y) => x + (y.minutes ?? 0), 0), 0)
  const changed = (n: DNorm) => { const o = src?.find(x => x.name === n.name); return !o ? 'Thêm mới' : Number(o.qty) !== Number(n.qty) || o.basis !== n.basis ? `Gốc: ${o.qty} ${o.unit} / ${BASIS[o.basis]}` : '' }
  return (
    <>
      <div className="p1-head"><h2>{d.title}</h2><Pill tone={STATUS[d.status]?.[1]}>{STATUS[d.status]?.[0]}</Pill><Pill>PB {d.version_no}</Pill>
        <button type="button" onClick={onCopy}>Sao chép</button><button type="button" className="danger" onClick={onDelete}>Xoá</button>
        <p className="p1-sub">{orgs.find(o => o.id === d.org_id)?.name} · {catName(cat, 'subject', d.subject)}{d.grade != null ? ' ' + gradeLabel(d.grade) : ''} · {total} phút · cập nhật {fmtDY(d.updated_at.slice(0, 10))}
          {d.material_lesson_id ? ' · tạo từ học liệu gốc (học liệu gốc không đổi)' : ''}</p></div>
      {msg && <p className="msg">{msg}</p>}
      <Section title="Thông tin" actions={<>
        {d.status === 'draft' && <button type="button" onClick={() => upd({ status: 'review' })}>Trình duyệt</button>}
        {d.status !== 'published' && <button type="button" className="primary" onClick={() => upd({ status: 'published', version_no: d.version_no + (d.status === 'draft' ? 0 : 0) })}>Phát hành</button>}
        {d.status === 'published' && <button type="button" onClick={() => upd({ status: 'draft', version_no: d.version_no + 1 })}>Sửa (tạo phiên bản {d.version_no + 1})</button>}</>}>
        <div className="p1-form">
          <label style={{ gridColumn: 'span 2' }}><span>Tên giáo án</span><input defaultValue={d.title} onBlur={e => e.target.value && e.target.value !== d.title && upd({ title: e.target.value })} /></label>
          <label><span>Khối</span><input type="number" min={0} max={12} defaultValue={d.grade ?? ''} onBlur={e => upd({ grade: e.target.value === '' ? null : Number(e.target.value) })} /></label>
          <label className="wide"><span>Mục tiêu</span><textarea rows={2} defaultValue={d.objectives ?? ''} onBlur={e => upd({ objectives: e.target.value || null })} /></label>
          <label className="wide"><span>Ghi chú điều chỉnh theo lớp</span><textarea rows={2} defaultValue={d.notes ?? ''} onBlur={e => upd({ notes: e.target.value || null })} /></label>
        </div>
      </Section>
      <div className="bar"><Tabs items={[['flow', 'Buổi & hoạt động', d.sessions.length], ['norms', 'Vật tư', d.norms.length], ['files', 'Tài liệu', d.files.length], ['criteria', 'Tiêu chí', d.criteria.length]] as [T, string, number?][]} value={tab} onChange={setTab} /></div>
      {tab === 'flow' && <>
        {d.sessions.map((s, i) => (
          <Section key={i} title={<>{s.title} <small className="sub">{s.activities.reduce((x, a) => x + (a.minutes ?? 0), 0)} phút</small></>} actions={<>
            <button type="button" onClick={() => setSess(i, { activities: [...s.activities, { title: 'Hoạt động mới', minutes: 5 }] })}>+ Hoạt động</button>
            {i > 0 && <button type="button" onClick={() => { const x = [...d.sessions]; [x[i - 1], x[i]] = [x[i], x[i - 1]]; upd({ sessions: x }) }} aria-label="Lên">↑</button>}
            <button type="button" className="danger" onClick={() => confirm('Xoá buổi này?') && upd({ sessions: d.sessions.filter((_, j) => j !== i) })} aria-label="Xoá buổi">×</button></>}>
            <ol className="p1-steps">{s.activities.map((a, k) => (
              <li key={k}><span className="no">{k + 1}</span><div>
                <div className="p1-actions"><input defaultValue={a.title} onBlur={e => setAct(i, k, { title: e.target.value })} aria-label="Tên hoạt động" style={{ flex: 1 }} />
                  <label>Phút <input type="number" min={0} defaultValue={a.minutes ?? ''} onBlur={e => setAct(i, k, { minutes: Number(e.target.value) || 0 })} style={{ width: 64 }} /></label>
                  {k > 0 && <button type="button" aria-label="Lên" onClick={() => { const x = [...s.activities]; [x[k - 1], x[k]] = [x[k], x[k - 1]]; setSess(i, { activities: x }) }}>↑</button>}
                  <button type="button" className="danger" aria-label="Xoá" onClick={() => setSess(i, { activities: s.activities.filter((_, j) => j !== k) })}>×</button></div>
                <div className="p1-form" style={{ marginTop: 6 }}>
                  <label><span>Hướng dẫn giáo viên</span><textarea rows={2} defaultValue={a.teacher ?? ''} onBlur={e => setAct(i, k, { teacher: e.target.value })} /></label>
                  <label><span>Nhiệm vụ học sinh</span><textarea rows={2} defaultValue={a.student ?? ''} onBlur={e => setAct(i, k, { student: e.target.value })} /></label>
                  <label><span>Sản phẩm đầu ra</span><textarea rows={2} defaultValue={a.product ?? ''} onBlur={e => setAct(i, k, { product: e.target.value })} /></label>
                </div></div></li>))}</ol>
            {!s.activities.length && <Empty>Buổi chưa có hoạt động.</Empty>}
          </Section>))}
        <button type="button" onClick={() => upd({ sessions: [...d.sessions, { title: `Buổi ${d.sessions.length + 1}`, minutes: 45, activities: [] }] })}>+ Thêm buổi</button>
      </>}
      {tab === 'norms' && <Section title="Vật tư theo điều kiện lớp" actions={<button type="button" onClick={() => upd({ norms: [...d.norms, { name: 'Vật tư mới', unit: 'cái', qty: 1, basis: 'per_group', category: 'vat_tu' }] })}>+ Vật tư</button>}>
        {d.norms.length === 0 ? <Empty>Chưa có vật tư.</Empty> : <table className="p1-table"><thead><tr><th>Loại</th><th>Tên</th><th>Đơn vị</th><th>Số lượng</th><th>Tính theo</th><th>So với học liệu gốc</th><th></th></tr></thead>
          <tbody>{d.norms.map((n, i) => { const u = (p: Partial<DNorm>) => upd({ norms: d.norms.map((x, j) => j === i ? { ...x, ...p } : x) }); const c = d.material_lesson_id ? changed(n) : ''
            return <tr key={i}><td><select value={n.category} onChange={e => u({ category: e.target.value })} aria-label="Loại">{Object.entries(NORM_CAT).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></td>
              <td><input defaultValue={n.name} onBlur={e => u({ name: e.target.value })} aria-label="Tên" /></td>
              <td style={{ width: 80 }}><input defaultValue={n.unit} onBlur={e => u({ unit: e.target.value })} aria-label="Đơn vị" /></td>
              <td style={{ width: 90 }}><input type="number" step="any" min={0} defaultValue={n.qty} onBlur={e => u({ qty: Number(e.target.value) || 0 })} aria-label="Số lượng" /></td>
              <td><select value={n.basis} onChange={e => u({ basis: e.target.value })} aria-label="Tính theo">{Object.entries(BASIS).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></td>
              <td>{c ? <Pill tone="warn">{c}</Pill> : d.material_lesson_id ? <Pill tone="good">Như gốc</Pill> : '—'}</td>
              <td><button type="button" className="danger" aria-label="Xoá" onClick={() => upd({ norms: d.norms.filter((_, j) => j !== i) })}>×</button></td></tr> })}</tbody></table>}
      </Section>}
      {tab === 'files' && <Section title="Phiếu học tập, video, hình ảnh" actions={<button type="button" onClick={() => upd({ files: [...d.files, { title: 'Tài liệu mới' }] })}>+ Tài liệu</button>}>
        {d.files.length === 0 ? <Empty>Chưa có tài liệu.</Empty> : <table className="p1-table"><thead><tr><th>Tên</th><th>Đường dẫn</th><th></th></tr></thead>
          <tbody>{d.files.map((f, i) => <tr key={i}><td><input defaultValue={f.title} onBlur={e => upd({ files: d.files.map((x, j) => j === i ? { ...x, title: e.target.value } : x) })} aria-label="Tên" /></td>
            <td><input defaultValue={f.url ?? ''} placeholder="https://…" onBlur={e => upd({ files: d.files.map((x, j) => j === i ? { ...x, url: e.target.value || undefined } : x) })} aria-label="Đường dẫn" /></td>
            <td><button type="button" className="danger" aria-label="Xoá" onClick={() => upd({ files: d.files.filter((_, j) => j !== i) })}>×</button></td></tr>)}</tbody></table>}
      </Section>}
      {tab === 'criteria' && <Section title="Tiêu chí đánh giá" actions={<button type="button" onClick={() => upd({ criteria: [...d.criteria, { name: 'Tiêu chí mới', levels: ['', '', '', ''] }] })}>+ Tiêu chí</button>}>
        {d.criteria.length === 0 ? <Empty>Chưa có tiêu chí.</Empty> : <table className="p1-table"><thead><tr><th>Tiêu chí</th><th>Mức 1</th><th>Mức 2</th><th>Mức 3</th><th>Mức 4</th><th></th></tr></thead>
          <tbody>{d.criteria.map((c, i) => <tr key={i}><td><input defaultValue={c.name} onBlur={e => upd({ criteria: d.criteria.map((x, j) => j === i ? { ...x, name: e.target.value } : x) })} aria-label="Tiêu chí" /></td>
            {[0, 1, 2, 3].map(m => <td key={m}><input defaultValue={c.levels?.[m] ?? ''} aria-label={`Mức ${m + 1}`} onBlur={e => upd({ criteria: d.criteria.map((x, j) => j === i ? { ...x, levels: [0, 1, 2, 3].map(z => z === m ? e.target.value : x.levels?.[z] ?? '') } : x) })} /></td>)}
            <td><button type="button" className="danger" aria-label="Xoá" onClick={() => upd({ criteria: d.criteria.filter((_, j) => j !== i) })}>×</button></td></tr>)}</tbody></table>}
      </Section>}
    </>
  )
}
