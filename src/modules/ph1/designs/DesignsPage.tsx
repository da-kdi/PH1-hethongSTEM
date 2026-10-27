import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { Tabs } from '../../../pages/teacher/common'
import { CtBadge, Drawer, Empty, FlowSteps, Mini, Pill, Section, StatusTabs, Thumb, Toolbar, VCard, errMsg, fmtDY, norm, timeAgo, useOrgList, useViewMode } from '../ui'
import { Drill, useDrill } from '../drill'
import { catName, effectiveCatalog, gradeLabel, inUseOf, newerOf, useCatalog, useOrgs, type Curriculum, type MStatus } from '../curriculum/api'
import { BASIS, NORM_CAT, type MLesson, type Norm } from '../materials/MaterialsPage'

type Activity = { title: string; minutes?: number; teacher?: string; student?: string; product?: string }
type DSession = { title: string; minutes?: number; activities: Activity[] }
type DNorm = { name: string; spec?: string | null; unit: string; qty: number; basis: string; category: string }
type Design = { id: string; org_id: string; teacher_id: string | null; material_lesson_id: string | null; curriculum_lesson_id: string | null; based_on_id: string | null
  title: string; subject: string | null; grade: number | null; status: string; version_no: number; objectives: string | null; sessions: DSession[]; norms: DNorm[]
  files: { title: string; url?: string }[]; criteria: { name: string; levels: string[] }[]; notes: string | null; updated_at: string; created_at: string }
type ML = Pick<MLesson, 'id' | 'set_id' | 'title' | 'seq' | 'periods' | 'objectives'> & { family_id: string; version_no: number; status: MStatus }
type MSetLite = { id: string; name: string; subject: string | null; grade: number | null; curriculum_id: string | null }

const STATUS: Record<string, [string, '' | 'good' | 'warn']> = { draft: ['Nháp', ''], review: ['Nháp', ''], published: ['Đã xuất bản', 'good'] }

// 1.1.4 Soạn bài giảng & Kho hoạt động (docs/PH1-cau-truc-1.1.md): bài giảng gán vào học liệu; một học liệu có nhiều phiên bản bài giảng.
//   Soạn bài giảng: chọn học liệu → bài giảng mới (sao nội dung, vật tư của học liệu) → chỉnh theo lớp; học liệu gốc không bị sửa.
//   Kho hoạt động: chứa tất cả bài giảng, xem theo Chương trình › Khối × Môn › Học liệu → các phiên bản.
export function DesignsPage({ orgId, teacherId }: { orgId: string | null; teacherId?: string | null }) {
  const [list, setList] = useState<Design[]>([])
  const [sets, setSets] = useState<MSetLite[]>([])
  const [progs, setProgs] = useState<Curriculum[]>([])
  const [mlessons, setMlessons] = useState<ML[]>([])
  const [chosen, setChosen] = useState<Map<string, string>>(new Map())
  const [status, setStatus] = useState<'all' | 'published' | 'draft'>('all')
  const [tab, setTab] = useState<'compose' | 'store'>('compose')
  const [q, setQ] = useState(''); const [f, setF] = useState<Record<string, string>>({})
  const [view, setView] = useViewMode('designs', 'table')
  const [path, setPath] = useDrill()
  const [open, setOpen] = useState<string | null>(null)
  const [peek, setPeek] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  const [msg, setMsg] = useState('')
  const orgs = useOrgList()
  const { all, hidden } = useCatalog()
  const { below } = useOrgs(orgId)
  const cat = effectiveCatalog(all, hidden, below)
  async function load(pick?: string) {
    const [d, s, l, c, u] = await Promise.all([
      supabase.from('lesson_designs').select('*').order('updated_at', { ascending: false }),
      supabase.from('material_sets').select('id, name, subject, grade, curriculum_id').neq('status', 'archived').order('name'),
      supabase.from('material_lessons').select('id, set_id, title, seq, periods, objectives, family_id, version_no, status').order('seq'),
      supabase.from('curricula').select('*').order('code'),
      orgId ? supabase.from('material_in_use').select('family_id, lesson_id').eq('org_id', orgId) : Promise.resolve({ data: [] }),
    ])
    if (d.error) return setMsg(errMsg(d.error.message))
    setList((d.data as Design[]) ?? []); setSets((s.data as MSetLite[]) ?? []); setMlessons((l.data as ML[]) ?? []); setProgs((c.data as Curriculum[]) ?? [])
    setChosen(new Map(((u.data as { family_id: string; lesson_id: string }[]) ?? []).map(x => [x.family_id, x.lesson_id])))
    if (pick) setOpen(pick)
  }
  useEffect(() => { load() }, [orgId])

  const mlOf = (d: Design) => mlessons.find(x => x.id === d.material_lesson_id)
  // Phiên bản bài giảng của một học liệu: đánh số theo thứ tự tạo
  const verOf = (d: Design) => d.material_lesson_id ? list.filter(x => mlOf(x)?.family_id === mlOf(d)?.family_id).sort((a, b) => a.created_at.localeCompare(b.created_at)).findIndex(x => x.id === d.id) + 1 : 1
  const progOf = (d: Design) => { const ml = mlessons.find(x => x.id === d.material_lesson_id); const s = sets.find(x => x.id === ml?.set_id); return progs.find(p => p.id === s?.curriculum_id) }
  const srcOf = (d: Design) => { const ml = mlessons.find(x => x.id === d.material_lesson_id); const s = sets.find(x => x.id === ml?.set_id); return s ? `Từ học liệu · ${s.name}` : d.based_on_id ? 'Sao chép từ bài giảng khác' : 'Soạn từ trang trắng' }
  // Học liệu có bản phát hành mới hơn bản bài giảng đang dựa vào
  const newerFor = (d: Design) => { const m = mlessons.find(x => x.id === d.material_lesson_id); return m ? newerOf(mlessons, m) : null }
  // Học liệu để chọn khi soạn: mỗi học liệu một dòng — phiên bản đơn vị đang dùng, bỏ bản ngừng dùng
  const heads = Array.from(new Set(mlessons.map(m => m.family_id))).map(f => inUseOf(mlessons.filter(m => m.status !== 'archived'), f, chosen)).filter(Boolean) as ML[]
  async function createFrom(mlId: string | null, basedOn?: Design) {
    if (!orgId) return
    let row: Partial<Design> = { title: 'Bài giảng mới', sessions: [{ title: 'Buổi 1', minutes: 45, activities: [] }], norms: [], criteria: [], files: [] }
    if (mlId) {
      const [a, n, fl] = await Promise.all([
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
        files: ((fl.data as any[]) ?? []).map(x => ({ title: x.title, url: x.url ?? undefined })), criteria: m.criteria }
    }
    if (basedOn) row = { ...row, title: basedOn.title, notes: basedOn.notes, based_on_id: basedOn.id }
    const { data, error } = await supabase.from('lesson_designs').insert({ ...row, org_id: orgId, teacher_id: teacherId ?? null, status: 'draft' }).select('id').single()
    if (error) return setMsg(errMsg(error.message))
    setPicking(false); load((data as { id: string }).id)
  }

  const d = list.find(x => x.id === open)
  if (d) return <DesignEditor key={d.id} d={d} prog={progOf(d) ?? null} source={srcOf(d)} cat={cat} orgs={orgs}
    newer={newerFor(d)} onUpdate={() => { const n = newerFor(d); if (n) createFrom(n.id, d) }} back={() => { setOpen(null); load() }} reload={() => load()} onCopy={async () => {
    const { id: _i, updated_at: _u, ...rest } = d
    const r = await supabase.from('lesson_designs').insert({ ...rest, title: d.title + ' (bản sao)', based_on_id: d.id, status: 'draft', version_no: 1, org_id: orgId }).select('id').single()
    if (r.error) setMsg(errMsg(r.error.message)); else load((r.data as { id: string }).id)
  }} onDelete={async () => { if (!confirm('Xoá bài giảng này?')) return; const r = await supabase.from('lesson_designs').delete().eq('id', d.id); if (r.error) setMsg(errMsg(r.error.message)); else { setOpen(null); load() } }} />

  const qq = norm(q)
  const base = list.filter(x => (tab === 'store' || x.org_id === orgId) && (!f.prog || progOf(x)?.id === f.prog) && (!f.grade || String(x.grade) === f.grade) && (!f.org || x.org_id === f.org)
    && (!qq || norm(`${x.title} ${x.objectives ?? ''} ${catName(cat, 'subject', x.subject)}`).includes(qq)))
  const shown = base.filter(x => status === 'all' || (status === 'published' ? x.status === 'published' : x.status !== 'published'))
  const acts = (x: Design) => x.sessions.reduce((a, s) => a + s.activities.length, 0)
  const renderDesigns = (shown: Design[]) => view === 'table' ? (
        <table className="p1-list"><thead><tr><th>Bài giảng</th><th>CT</th><th>Khối</th><th>Môn</th><th>Trạng thái</th><th>Buổi / hoạt động</th><th>Cập nhật</th><th></th></tr></thead>
          <tbody>{shown.map(x => { const p = progOf(x)
            return <tr key={x.id} onClick={() => setOpen(x.id)}>
              <td><div className="titlecell"><Thumb color={p?.color} code={p?.code} /><div><b>{x.title}</b><small>{x.material_lesson_id ? `Học liệu: ${mlOf(x)?.title ?? '—'} PB ${mlOf(x)?.version_no ?? '?'} · bài giảng PB ${verOf(x)}` : srcOf(x)} · {orgs.find(o => o.id === x.org_id)?.name}</small>
                {newerFor(x) && <Pill tone="info">Có phiên bản học liệu mới (PB {newerFor(x)!.version_no})</Pill>}</div></div></td>
              <td><CtBadge color={p?.color} code={p?.code} /></td><td>{x.grade != null ? gradeLabel(x.grade) : '—'}</td><td>{catName(cat, 'subject', x.subject) || '—'}</td>
              <td><Pill tone={STATUS[x.status]?.[1]}>{STATUS[x.status]?.[0]}</Pill></td>
              <td><b>{x.sessions.length}</b> buổi / {acts(x)} hoạt động</td><td>{timeAgo(x.updated_at)}</td>
              <td><div className="p1-iconbtns"><button type="button" title="Xem nhanh" onClick={e => { e.stopPropagation(); setPeek(x.id) }}>👁</button>
                <button type="button" title="Soạn" onClick={e => { e.stopPropagation(); setOpen(x.id) }}>✎</button></div></td>
            </tr> })}</tbody></table>
      ) : <div className="p1-grid">{shown.map(x => { const p = progOf(x)
        return <VCard key={x.id} color={p?.color} code={p?.code} subject={x.subject} icon="✏️" status={<Pill tone={STATUS[x.status]?.[1]}>{STATUS[x.status]?.[0]}</Pill>} title={x.title}
          subtitle={`${catName(cat, 'subject', x.subject)}${x.grade != null ? ' · ' + gradeLabel(x.grade) : ''}`} desc={srcOf(x)}
          chips={[`${x.sessions.length} buổi`, `${acts(x)} hoạt động`, `PB ${verOf(x)}`, newerFor(x) ? `Học liệu có PB ${newerFor(x)!.version_no}` : '']} foot={<small>{timeAgo(x.updated_at)}</small>} onClick={() => setPeek(x.id)} /> })}</div>
  // Kho hoạt động: gom theo học liệu, mỗi học liệu liệt kê các phiên bản bài giảng
  const famOf = (x: Design) => mlOf(x)?.family_id ?? '_'
  const renderStore = (items: Design[]) => { const ids = Array.from(new Set(items.map(famOf)))
    return <>{ids.map(id => { const ds = items.filter(x => famOf(x) === id).sort((a, b) => a.created_at.localeCompare(b.created_at)); const ml = id === '_' ? undefined : inUseOf(mlessons, id, chosen) ?? undefined
      return <div key={id} className="p1-objsub" style={{ marginBottom: 12 }}>
        <div className="head"><span className="p1-objtag">Học liệu</span><b>{ml?.title ?? 'Chưa gắn học liệu (chờ xem lại)'}</b><small>{ds.length} phiên bản bài giảng</small>
          {ml && <button type="button" style={{ marginLeft: 'auto' }} onClick={() => createFrom(ml.id)}>+ Phiên bản mới</button>}</div>
        <table className="p1-table"><thead><tr><th style={{ width: 80 }}>Phiên bản</th><th>Bài giảng</th><th>Đơn vị</th><th>Trạng thái</th><th>Cập nhật</th></tr></thead>
          <tbody>{ds.map(x => <tr key={x.id} onClick={() => setPeek(x.id)} style={{ cursor: 'pointer' }}><td>PB {verOf(x)}</td><td><b>{x.title}</b><br /><small className="sub">từ học liệu PB {mlOf(x)?.version_no ?? '?'}</small></td>
            <td>{orgs.find(o => o.id === x.org_id)?.name}</td><td><Pill tone={STATUS[x.status]?.[1]}>{STATUS[x.status]?.[0]}</Pill></td><td>{timeAgo(x.updated_at)}</td></tr>)}</tbody></table>
      </div> })}</> }
  const pd = list.find(x => x.id === peek)
  return (
    <>
      {msg && <p className="msg">{msg}</p>}
      <FlowSteps steps={[['store', 'Kho hoạt động', `${list.length} bài giảng · gom theo học liệu`], ['compose', 'Soạn bài giảng', `${list.filter(x => x.org_id === orgId && x.status !== 'published').length} đang soạn · từ học liệu, xuất bản`]] as ['compose' | 'store', string, string][]}
        value={tab} onChange={t => { setTab(t); setStatus('all') }} />
      <div className="bar"><span /><button type="button" className="primary" onClick={() => setPicking(true)}>+ Soạn bài giảng</button></div>
      <p className="sub" style={{ margin: '0 0 10px' }}>{tab === 'compose' ? 'Bài giảng của đơn vị: chọn học liệu rồi chỉnh theo lớp — học liệu gốc không bị thay đổi.' : 'Tất cả bài giảng, theo học liệu; một học liệu có thể có nhiều phiên bản bài giảng.'}</p>
      <StatusTabs items={[['all', 'Tất cả', base.length], ['published', 'Đã xuất bản', base.filter(x => x.status === 'published').length],
        ['draft', 'Nháp', base.filter(x => x.status !== 'published').length]]} value={status} onChange={setStatus} />
      <Toolbar q={q} onQ={setQ} placeholder="Tìm theo tên bài, môn học, mục tiêu…" values={f} onFilter={(k, v) => setF({ ...f, [k]: v })} view={view} onView={setView} filters={[
        { key: 'prog', label: 'Tất cả chương trình', options: progs.map(p => ({ value: p.id, label: `${p.code} · ${p.name}` })) },
        { key: 'grade', label: 'Tất cả khối', options: Array.from(new Set(list.map(x => x.grade).filter(g => g != null))).sort((a, b) => a! - b!).map(g => ({ value: String(g), label: gradeLabel(g!) })) },
        { key: 'org', label: 'Mọi đơn vị', options: Array.from(new Set(list.map(x => x.org_id))).map(o => ({ value: o, label: orgs.find(z => z.id === o)?.name ?? o })) },
      ]} />
      {shown.length === 0 ? <Empty>Chưa có bài giảng{status !== 'all' ? ' ở trạng thái này' : ''}. Bấm “+ Soạn bài giảng” để chọn học liệu.</Empty>
        : (q || Object.values(f).some(Boolean)) ? (tab === 'store' ? renderStore(shown) : renderDesigns(shown))
        : <Drill items={shown} keyOf={x => ({ prog: progOf(x)?.id ?? null, grade: x.grade, subject: x.subject })} progs={progs} cat={cat} path={path} setPath={setPath}
            unit="bài giảng" icon="✏️" renderItems={tab === 'store' ? renderStore : renderDesigns} />}

      {pd && <Drawer color={progOf(pd)?.color} title={pd.title} onClose={() => setPeek(null)}
        badges={[progOf(pd)?.code, STATUS[pd.status]?.[0], `${catName(cat, 'subject', pd.subject)}${pd.grade != null ? ' · ' + gradeLabel(pd.grade) : ''}`, `${pd.sessions.reduce((a, s) => a + s.activities.reduce((x, y) => x + (y.minutes ?? 0), 0), 0)} phút`]}
        footer={<><span className="note">{srcOf(pd)}</span><button type="button" className="primary" onClick={() => { setOpen(pd.id); setPeek(null) }}>Mở rộng để soạn ⤢</button></>}>
        {pd.objectives && <div className="p1-box goal"><h4>🎯 Mục tiêu</h4><p className="p1-text">{pd.objectives}</p></div>}
        <Mini items={[['Buổi', pd.sessions.length], ['Hoạt động', acts(pd)], ['Vật tư', pd.norms.length], ['Tiêu chí', pd.criteria.length]]} />
        <div className="p1-box"><h4>🪜 Tiến trình</h4>{pd.sessions.map((s, i) => <div key={i}><div className="p1-session">{s.title}</div>
          <ol className="p1-steps">{s.activities.map((a, k) => <li key={k}><span className="no">{k + 1}</span><div><b>{a.title}</b><div className="meta"><span>⏱ {a.minutes ?? 0} phút</span></div></div></li>)}</ol></div>)}</div>
        {pd.notes && <div className="p1-box"><h4>📝 Điều chỉnh theo lớp</h4><p className="p1-text">{pd.notes}</p></div>}
      </Drawer>}

      {picking && <Drawer title="Chọn học liệu để soạn bài giảng" badges={['Học liệu', `${heads.length} bài`]} onClose={() => setPicking(false)} wide
        footer={<span className="note">Bài giảng gán vào học liệu đã chọn và là một phiên bản mới — chỉnh thoải mái, học liệu gốc giữ nguyên.</span>}>
        <LessonPicker sets={sets} progs={progs} lessons={heads} cat={cat} onPick={id => createFrom(id)} />
      </Drawer>}
    </>
  )
}

function LessonPicker({ sets, progs, lessons, cat, onPick }: { sets: MSetLite[]; progs: Curriculum[]; lessons: ML[]
  cat: ReturnType<typeof effectiveCatalog>; onPick: (id: string) => void }) {
  const [q, setQ] = useState(''); const [f, setF] = useState<Record<string, string>>({})
  const qq = norm(q)
  const shown = lessons.filter(l => { const s = sets.find(x => x.id === l.set_id); return (!f.prog || s?.curriculum_id === f.prog) && (!f.set || l.set_id === f.set) && (!qq || norm(l.title).includes(qq)) })
  return (<>
    <Toolbar q={q} onQ={setQ} placeholder="Tìm bài…" values={f} onFilter={(k, v) => setF({ ...f, [k]: v })} filters={[
      { key: 'prog', label: 'Tất cả chương trình', options: progs.filter(p => sets.some(s => s.curriculum_id === p.id)).map(p => ({ value: p.id, label: `${p.code} · ${p.name}` })) },
      { key: 'set', label: 'Mọi bộ học liệu', options: sets.map(s => ({ value: s.id, label: s.name })) }]} />
    <div className="p1-grid">{shown.map(l => { const s = sets.find(x => x.id === l.set_id); const p = progs.find(x => x.id === s?.curriculum_id)
      return <VCard key={l.id} color={p?.color} code={p?.code} subject={s?.subject} icon="📚" title={l.title} subtitle={`${catName(cat, 'subject', s?.subject)}${s?.grade != null ? ' · ' + gradeLabel(s.grade) : ''}`}
        desc={l.objectives} chips={[`${l.periods} tiết`, `PB ${l.version_no}`, l.status === 'published' ? '' : 'nháp']} foot={<small>{s?.name}</small>} onClick={() => onPick(l.id)} more="Soạn từ học liệu này ›" /> })}</div>
    {!shown.length && <Empty>Không có bài phù hợp.</Empty>}
  </>)
}

type T = 'flow' | 'norms' | 'files' | 'criteria'
function DesignEditor({ d, prog, source, cat, orgs, newer, onUpdate, back, reload, onCopy, onDelete }: { d: Design; prog: Curriculum | null; source: string; cat: ReturnType<typeof effectiveCatalog>; orgs: { id: string; name: string }[]
  newer: ML | null; onUpdate: () => void; back: () => void; reload: () => void; onCopy: () => void; onDelete: () => void }) {
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
      <button type="button" className="p1-back" onClick={back}>← Tất cả bài giảng</button>
      <div className="p1-head">{prog && <CtBadge color={prog.color} code={prog.code} />}<h2>{d.title}</h2><Pill tone={STATUS[d.status]?.[1]}>{STATUS[d.status]?.[0]}</Pill><Pill>PB {d.version_no}</Pill>
        <button type="button" onClick={onCopy}>Sao chép</button><button type="button" className="danger" onClick={onDelete}>Xoá</button>
        <p className="p1-sub">{orgs.find(o => o.id === d.org_id)?.name} · {catName(cat, 'subject', d.subject)}{d.grade != null ? ' ' + gradeLabel(d.grade) : ''} · {total} phút · cập nhật {fmtDY(d.updated_at.slice(0, 10))}
          {' · ' + source}</p></div>
      {msg && <p className="msg">{msg}</p>}
      {newer && <div className="p1-alert info"><span>Có phiên bản học liệu mới (PB {newer.version_no}). Bài giảng này giữ nguyên theo bản cũ.</span>
        <button type="button" onClick={onUpdate}>Cập nhật theo bản mới</button></div>}
      <Section title="Thông tin" actions={<>
        {d.status !== 'published' && <button type="button" className="primary" onClick={() => upd({ status: 'published' })}>Xuất bản</button>}
        {d.status === 'published' && <button type="button" onClick={() => upd({ status: 'draft', version_no: d.version_no + 1 })}>Sửa (tạo phiên bản {d.version_no + 1})</button>}</>}>
        <div className="p1-form">
          <label style={{ gridColumn: 'span 2' }}><span>Tên bài giảng</span><input defaultValue={d.title} onBlur={e => e.target.value && e.target.value !== d.title && upd({ title: e.target.value })} /></label>
          <label className="wide"><span>Mục tiêu</span><textarea rows={2} defaultValue={d.objectives ?? ''} onBlur={e => upd({ objectives: e.target.value || null })} /></label>
          <label className="wide"><span>Ghi chú điều chỉnh theo lớp</span><textarea rows={2} defaultValue={d.notes ?? ''} onBlur={e => upd({ notes: e.target.value || null })} /></label>
        </div>
        <details className="p1-adv"><summary>Thiết lập nâng cao</summary><div className="p1-form">
          <label><span>Khối</span><input type="number" min={0} max={12} defaultValue={d.grade ?? ''} onBlur={e => upd({ grade: e.target.value === '' ? null : Number(e.target.value) })} /></label>
        </div></details>
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
