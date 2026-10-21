import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { Tabs } from '../../../pages/teacher/common'
import { Code, CtBadge, Drawer, Empty, Mini, Pill, Progress, Section, Stat, StatusTabs, Thumb, Toolbar, VCard, SCHOOL_YEAR, addD, errMsg, fmtD, fmtDY, norm, today, useOrgList, useRpcBool, useViewMode } from '../ui'
import { catName, effectiveCatalog, gradeLabel, useCatalog, useOrgs, type Curriculum } from '../curriculum/api'
import { BASIS, needQty, type Norm } from '../materials/MaterialsPage'
import { ItemDrawer, WeekGrid, YearGrid, weekOfYear, yearStart } from './Calendar'

export type Plan = { id: string; org_id: string; package_school_id: string | null; curriculum_id: string | null; version_id: string | null; material_set_id: string | null
  title: string; subject: string | null; grade: number | null; class_ids: string[]; school_year: string; start_date: string; periods_per_week: number; teach_weekday: number
  status: string; version_no: number; notes: string | null; updated_at: string }
export type Item = { id: string; plan_id: string; seq: number; week_no: number; planned_date: string | null; curriculum_unit_id: string | null; curriculum_lesson_id: string | null
  material_lesson_id: string | null; title: string; periods: number; part: number; status: string; done_on: string | null; teacher_id: string | null; room_kind: string | null
  evidence_url: string | null; evidence_note: string | null; achieved_pct: number | null; note: string | null }
type Hol = { org_id: string; name: string; starts_on: string; ends_on: string }
type Cls = { id: string; name: string; grade: number; org_id: string }
type App = { id: string; package_id: string; org_id: string; school_year: string; grades: number[]; status: string }
type PItem = { package_id: string; curriculum_id: string; subject: string | null; grades: number[] }
type MSet = { id: string; name: string; curriculum_id: string | null; subject: string | null; grade: number | null }

const PALETTE = ['#2a78d6', '#7c3aed', '#0f766e', '#ca8a04', '#dc2626', '#0891b2', '#16a34a', '#c026d3', '#ea580c', '#475569']
const tint = (hex: string) => hex + '1f'
export const ITEM_STATUS: Record<string, [string, '' | 'good' | 'warn' | 'bad' | 'info']> = {
  planned: ['Kế hoạch', ''], done: ['Đã dạy', 'good'], moved: ['Dời lịch', 'warn'], skipped: ['Bỏ', 'bad'],
}
const WD = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ nhật']
export const isLate = (i: Item) => i.status === 'planned' && !!i.planned_date && i.planned_date < today()
const mondayOf = (d: string) => { const x = new Date(d + 'T00:00:00'); const k = (x.getDay() + 6) % 7; return addD(d, -k) }

// 1.1.3 Phân phối chương trình: gói đã chọn → kế hoạch theo trường / khối / lớp / tuần / số tiết
export function PpctPage({ orgId }: { orgId: string | null }) {
  const [plans, setPlans] = useState<Plan[]>([])
  const [progs, setProgs] = useState<Curriculum[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [open, setOpen] = useState<string | null>(null)
  const [peek, setPeek] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [status, setStatus] = useState<'all' | 'published' | 'draft' | 'late'>('all')
  const [q, setQ] = useState(''); const [f, setF] = useState<Record<string, string>>({})
  const [view, setView] = useViewMode('ppct', 'table')
  const [msg, setMsg] = useState('')
  const [mode, setMode] = useState<'year' | 'week' | 'list'>('year')
  const [range, setRange] = useState('all')
  const [monday, setMonday] = useState(() => { const t = today(); const d = new Date(t + 'T00:00:00'); return addD(t, -((d.getDay() + 6) % 7)) })
  const [itemPeek, setItemPeek] = useState<string | null>(null)
  const canManage = useRpcBool('curriculum_can_manage')
  const orgs = useOrgList()
  const { all, hidden } = useCatalog()
  const { below } = useOrgs(orgId)
  const cat = effectiveCatalog(all, hidden, below)

  async function load(pick?: string) {
    const [p, c, i] = await Promise.all([
      supabase.from('ppct_plans').select('*').order('grade').order('title'),
      supabase.from('curricula').select('*').order('code'),
      supabase.from('ppct_items').select('*').order('week_no').order('seq'),
    ])
    if (p.error) return setMsg(errMsg(p.error.message))
    const ps = (p.data as Plan[]) ?? []
    setPlans(ps); setProgs((c.data as Curriculum[]) ?? []); setItems((i.data as Item[]) ?? [])
    setF(x => x.org || !ps.length ? x : { ...x, org: (ps.find(z => z.org_id === orgId) ?? ps[0]).org_id })
    if (pick) setOpen(pick)
  }
  useEffect(() => { load() }, [orgId])

  if (creating) return <><button type="button" className="p1-back" onClick={() => setCreating(false)}>← Tất cả kế hoạch</button>
    <CreatePlan orgId={orgId} orgs={orgs} progs={progs} cat={cat} onDone={id => { setCreating(false); load(id) }} onCancel={() => setCreating(false)} /></>
  const plan = plans.find(p => p.id === open)
  if (plan) return <><button type="button" className="p1-back" onClick={() => { setOpen(null); load() }}>← Tất cả kế hoạch</button>
    <PlanDetail key={plan.id} plan={plan} prog={progs.find(c => c.id === plan.curriculum_id) ?? null} orgName={orgs.find(o => o.id === plan.org_id)?.name ?? ''}
      cat={cat} canManage={canManage} reload={() => load(plan.id)} onDeleted={() => { setOpen(null); load() }} /></>

  const stat = (p: Plan) => { const its = items.filter(i => i.plan_id === p.id); const done = its.filter(i => i.status === 'done').length
    const due = its.filter(i => i.planned_date && i.planned_date <= today() && i.status !== 'skipped').length
    return { total: its.length, done, due, late: its.filter(isLate).length, periods: its.filter(i => i.status !== 'skipped').reduce((a, i) => a + Number(i.periods), 0) } }
  const qq = norm(q)
  const base = plans.filter(p => (!f.org || p.org_id === f.org) && (!f.prog || p.curriculum_id === f.prog) && (!f.grade || String(p.grade) === f.grade)
    && (!qq || norm(`${p.title} ${orgs.find(o => o.id === p.org_id)?.name ?? ''}`).includes(qq)))
  const shown = base.filter(p => status === 'all' || (status === 'late' ? stat(p).late > 0 : p.status === status))
  const prog = (p: Plan) => progs.find(c => c.id === p.curriculum_id)
  const WDS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
  const pp = plans.find(p => p.id === peek)
  const ystart = yearStart(plans[0]?.school_year ?? SCHOOL_YEAR)
  const shownIds = new Set(shown.map(p => p.id))
  const wk = (i: Item) => (i.planned_date ? weekOfYear(ystart, i.planned_date) : i.week_no)
  const maxWeek = Math.max(35, ...items.filter(i => shownIds.has(i.plan_id)).map(wk))
  const periodsIn = (a: number, b: number) => items.filter(i => shownIds.has(i.plan_id) && wk(i) >= a && wk(i) <= b && i.status !== 'skipped').reduce((x, i) => x + Number(i.periods), 0)
  const months = Array.from(new Set(Array.from({ length: maxWeek }, (_, k) => addD(ystart, k * 7).slice(0, 7))))
  const yr = range === 'hk1' ? { from: 1, to: 18 } : range === 'hk2' ? { from: 19, to: maxWeek } : range.startsWith('m:')
    ? (() => { const ws = Array.from({ length: maxWeek }, (_, k) => k + 1).filter(w => addD(ystart, (w - 1) * 7).slice(0, 7) === range.slice(2)); return { from: ws[0] ?? 1, to: ws[ws.length - 1] ?? 1 } })()
    : { from: 1, to: maxWeek }
  return (
    <>
      {msg && <p className="msg">{msg}</p>}
      <div className="p1-stats">
        <Stat label="Kế hoạch" value={plans.length} sub={`${new Set(plans.map(p => p.org_id)).size} trường`} />
        <Stat label="Đã công bố" value={plans.filter(p => p.status === 'published').length} tone="good" />
        <Stat label="Mục đến hạn đã dạy" value={`${Math.round(items.filter(i => i.status === 'done').length * 100 / Math.max(1, items.filter(i => i.planned_date && i.planned_date <= today() && i.status !== 'skipped').length))}%`} />
        <Stat label="Chậm tiến độ" value={items.filter(isLate).length} tone={items.some(isLate) ? 'bad' : ''} sub="mục quá ngày chưa dạy" />
      </div>
      <div className="p1-calbar">
        <div className="segmented" role="tablist">{([['year', 'Kế hoạch năm'], ['week', 'TKB tuần'], ['list', 'Danh sách kế hoạch']] as const).map(([k, l]) =>
          <button type="button" key={k} className={mode === k ? 'on' : ''} onClick={() => setMode(k)}>{l}</button>)}</div>
        {mode === 'year' && <><div className="p1-statustabs" style={{ border: 0, margin: 0 }}>{([['all', 'Cả năm', 1, maxWeek], ['hk1', 'Học kỳ I', 1, 18], ['hk2', 'Học kỳ II', 19, Math.max(35, maxWeek)]] as const).map(([k, l, a, b]) =>
          <button type="button" key={k} className={range === k ? 'on' : ''} onClick={() => setRange(k)}>{l} <small>({periodsIn(a, b)} tiết)</small></button>)}</div>
          <select value={range.startsWith('m:') ? range : ''} onChange={e => setRange(e.target.value || 'all')} aria-label="Chọn tháng"><option value="">Chọn tháng…</option>
            {months.map(m => <option key={m} value={'m:' + m}>Tháng {Number(m.slice(5))}/{m.slice(0, 4)}</option>)}</select></>}
        {mode === 'week' && <div className="p1-weeknav"><button type="button" onClick={() => { const t = today(); setMonday(addD(t, -((new Date(t + 'T00:00:00').getDay() + 6) % 7))) }}>Hôm nay</button>
          <button type="button" aria-label="Tuần trước" onClick={() => setMonday(addD(monday, -7))}>‹</button><button type="button" aria-label="Tuần sau" onClick={() => setMonday(addD(monday, 7))}>›</button>
          <div><b>Tháng {Number(monday.slice(5, 7))}, {monday.slice(0, 4)}</b><small>Tuần {weekOfYear(ystart, monday)} · {fmtD(monday)} – {fmtD(addD(monday, 5))}</small></div></div>}
        {canManage && <button type="button" className="primary" style={{ marginLeft: 'auto' }} onClick={() => setCreating(true)}>+ Kế hoạch mới</button>}
      </div>
      <Toolbar q={q} onQ={setQ} placeholder="Tìm kế hoạch, trường…" values={f} onFilter={(k, v) => setF({ ...f, [k]: v })} view={mode === 'list' ? view : undefined} onView={setView} filters={[
        { key: 'org', label: 'Tất cả trường', options: Array.from(new Set(plans.map(p => p.org_id))).map(o => ({ value: o, label: orgs.find(z => z.id === o)?.name ?? o })) },
        { key: 'prog', label: 'Tất cả chương trình', options: progs.filter(c => plans.some(p => p.curriculum_id === c.id)).map(c => ({ value: c.id, label: `${c.code} · ${c.name}` })) },
        { key: 'grade', label: 'Tất cả khối', options: Array.from(new Set(plans.map(p => p.grade).filter(g => g != null))).sort((a, b) => a! - b!).map(g => ({ value: String(g), label: gradeLabel(g!) })) },
      ]} />
      {mode === 'year' && (shown.length ? <YearGrid plans={shown} items={items} progs={progs} orgName={id => orgs.find(o => o.id === id)?.name ?? ''} range={yr}
        onPlan={setOpen} onItem={setItemPeek} /> : <Empty>Không có kế hoạch phù hợp bộ lọc.</Empty>)}
      {mode === 'week' && <WeekGrid plans={shown} items={items} progs={progs} monday={monday} onItem={setItemPeek} onPlan={setOpen} />}
      {mode === 'list' && <>
      <StatusTabs items={[['all', 'Tất cả', base.length], ['published', 'Đã công bố', base.filter(p => p.status === 'published').length],
        ['draft', 'Bản nháp', base.filter(p => p.status === 'draft').length], ['late', 'Có mục chậm', base.filter(p => stat(p).late > 0).length]]} value={status} onChange={setStatus} />
      {shown.length === 0 ? <Empty>Không có kế hoạch phù hợp.</Empty> : view === 'table' ? (
        <table className="p1-list"><thead><tr><th>Kế hoạch</th><th>CT</th><th>Khối · lớp</th><th>Nhịp độ</th><th>Tiến độ (đã dạy / đến hạn)</th><th>Trạng thái</th><th></th></tr></thead>
          <tbody>{shown.map(p => { const s = stat(p); const c = prog(p); const v = s.due ? Math.round(s.done * 100 / s.due) : 0
            return <tr key={p.id} onClick={() => setOpen(p.id)}>
              <td><div className="titlecell"><Thumb color={c?.color} code={c?.code} /><div><b>{p.title}</b><small>{orgs.find(o => o.id === p.org_id)?.name} · {p.school_year}</small></div></div></td>
              <td><CtBadge color={c?.color} code={c?.code} /></td>
              <td>{p.grade != null ? gradeLabel(p.grade) : '—'} · {p.class_ids.length} lớp</td>
              <td>{p.periods_per_week} tiết/tuần · {WDS[p.teach_weekday - 1]}<br /><small className="sub">{s.periods} tiết · từ {fmtD(p.start_date)}</small></td>
              <td style={{ minWidth: 180 }}><Progress value={v} tone={v >= 90 ? 'good' : v >= 70 ? 'warn' : 'bad'} /><small className="sub">{s.done}/{s.due} mục{s.late ? ` · ${s.late} chậm` : ''}</small></td>
              <td><Pill tone={p.status === 'published' ? 'good' : ''}>{p.status === 'published' ? 'Đã công bố' : 'Bản nháp'}</Pill></td>
              <td><div className="p1-iconbtns"><button type="button" title="Xem nhanh" onClick={e => { e.stopPropagation(); setPeek(p.id) }}>👁</button>
                <button type="button" title="Mở lịch" onClick={e => { e.stopPropagation(); setOpen(p.id) }}>📅</button></div></td>
            </tr> })}</tbody></table>
      ) : <div className="p1-grid">{shown.map(p => { const s = stat(p); const c = prog(p)
        return <VCard key={p.id} color={c?.color} code={c?.code} icon="📅" status={<Pill tone={p.status === 'published' ? 'good' : ''}>{p.status === 'published' ? 'Đã công bố' : 'Bản nháp'}</Pill>}
          title={p.title} subtitle={orgs.find(o => o.id === p.org_id)?.name} chips={[`${p.periods_per_week} tiết/tuần`, `${p.class_ids.length} lớp`, `${s.done}/${s.total} đã dạy`, s.late ? `${s.late} chậm` : '']}
          foot={<Progress value={s.due ? s.done * 100 / s.due : 0} />} onClick={() => setPeek(p.id)} /> })}</div>}
      </>}
      {itemPeek && (() => { const it = items.find(i => i.id === itemPeek); const p = it && plans.find(x => x.id === it.plan_id); if (!it || !p) return null
        return <ItemDrawer key={it.id} item={it} plan={p} prog={prog(p) ?? null} orgName={orgs.find(o => o.id === p.org_id)?.name ?? ''} canEdit={canManage}
          onClose={() => setItemPeek(null)} onOpenPlan={() => { setOpen(p.id); setItemPeek(null) }} onChanged={() => load()} /> })()}

      {pp && (() => { const s = stat(pp); const c = prog(pp); const its = items.filter(i => i.plan_id === pp.id).sort((a, b) => a.week_no - b.week_no || a.seq - b.seq)
        const next = its.filter(i => i.status !== 'done' && (i.planned_date ?? '') >= today()).slice(0, 6); const late = its.filter(isLate)
        return <Drawer color={c?.color} title={pp.title} onClose={() => setPeek(null)}
          badges={[c?.code, orgs.find(o => o.id === pp.org_id)?.name, pp.grade != null ? gradeLabel(pp.grade) : '', `${pp.periods_per_week} tiết/tuần`]}
          footer={<><span className="note">Bắt đầu {fmtDY(pp.start_date)} · {pp.school_year}</span><button type="button" className="primary" onClick={() => { setOpen(pp.id); setPeek(null) }}>Mở lịch đầy đủ ⤢</button></>}>
          <Mini items={[['Tổng tiết', s.periods], ['Số tuần', Math.max(0, ...its.map(i => i.week_no))], ['Đã dạy', `${s.done}/${s.due}`], ['Chậm', s.late]]} />
          {late.length > 0 && <div className="p1-alert bad">{late.length} mục chậm tiến độ: {late.slice(0, 3).map(i => i.title).join(', ')}{late.length > 3 ? '…' : ''}</div>}
          <div className="p1-box"><h4>📅 Sắp tới</h4>{next.length === 0 ? <p className="sub" style={{ margin: 0 }}>Không còn mục nào sắp tới.</p> :
            <div className="p1-strip">{next.map(i => <div key={i.id}><small>Tuần {i.week_no} · {fmtD(i.planned_date)}</small><span><b>{i.title}</b>{i.part > 1 ? ` (phần ${i.part})` : ''} · {i.periods} tiết</span></div>)}</div>}</div>
          {pp.notes && <div className="p1-box"><h4>📝 Ghi chú</h4><p className="p1-text">{pp.notes}</p></div>}
        </Drawer> })()}
    </>
  )
}

function CreatePlan({ orgId, orgs, progs, cat, onDone, onCancel }: {
  orgId: string | null; orgs: { id: string; name: string; type: string }[]; progs: Curriculum[]; cat: ReturnType<typeof effectiveCatalog>
  onDone: (id: string) => void; onCancel: () => void
}) {
  const [apps, setApps] = useState<(App & { program_packages: { name: string } | null })[]>([])
  const [pitems, setPitems] = useState<PItem[]>([])
  const [sets, setSets] = useState<MSet[]>([])
  const [classes, setClasses] = useState<Cls[]>([])
  const [f, setF] = useState({ app: '', line: '', grade: '', set: '', ppw: 1, start: '2026-09-07', weekday: 2, classes: [] as string[], title: '' })
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  useEffect(() => {
    Promise.all([
      supabase.from('program_package_schools').select('*, program_packages(name)').order('school_year', { ascending: false }),
      supabase.from('program_package_items').select('package_id, curriculum_id, subject, grades'),
      supabase.from('material_sets').select('id, name, curriculum_id, subject, grade'),
    ]).then(([a, i, s]) => { setApps((a.data as any[]) ?? []); setPitems((i.data as PItem[]) ?? []); setSets((s.data as MSet[]) ?? []) })
  }, [])
  const app = apps.find(a => a.id === f.app)
  useEffect(() => { if (app) supabase.from('classes').select('id, name, grade, org_id').eq('org_id', app.org_id).order('name').then(({ data }) => setClasses((data as Cls[]) ?? [])) }, [app?.org_id])
  const lines = app ? pitems.filter(i => i.package_id === app.package_id) : []
  const line = lines[Number(f.line)]
  const prog = progs.find(c => c.id === line?.curriculum_id)
  const grades = line ? (line.grades.length ? line.grades : prog?.grades ?? []).filter(g => !app!.grades.length || app!.grades.includes(g)) : []
  const g = Number(f.grade)
  const setOpts = sets.filter(s => s.curriculum_id === line?.curriculum_id && (!line?.subject || s.subject === line.subject) && (s.grade == null || s.grade === g))
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (!app || !line || !f.grade) return setErr('Chọn gói áp dụng, chương trình / môn và khối.')
    setBusy(true)
    const title = f.title.trim() || `${catName(cat, 'subject', line.subject) || prog?.name} ${g} (${f.ppw} tiết/tuần)`
    const { data, error } = await supabase.from('ppct_plans').insert({ org_id: app.org_id, package_school_id: app.id, curriculum_id: line.curriculum_id, material_set_id: f.set || null,
      title, subject: line.subject, grade: g, class_ids: f.classes, school_year: app.school_year, start_date: f.start, periods_per_week: f.ppw, teach_weekday: f.weekday, status: 'draft' }).select('id').single()
    if (error) { setBusy(false); return setErr(errMsg(error.message)) }
    const id = (data as { id: string }).id
    const r = await supabase.rpc('ppct_generate', { p_plan: id })
    setBusy(false); if (r.error) return setErr(errMsg(r.error.message))
    onDone(id)
  }
  return (
    <form className="p1-section" onSubmit={save}>
      <header><h3>Kế hoạch phân phối mới</h3></header>
      <p className="sub">Chọn gói đã áp dụng cho trường → chương trình / môn trong gói → khối, lớp, nhịp độ. Hệ thống xếp bài theo tuần, bỏ tuần nghỉ, chia bài dài sang tuần sau.</p>
      <div className="p1-form">
        <label className="wide"><span>Gói đã áp dụng cho trường</span><select value={f.app} onChange={e => setF({ ...f, app: e.target.value, line: '', grade: '', set: '', classes: [] })}>
          <option value="">— Chọn —</option>{apps.map(a => <option key={a.id} value={a.id}>{orgs.find(o => o.id === a.org_id)?.name} · {a.program_packages?.name} · {a.school_year}{a.status !== 'active' ? ' (đề xuất)' : ''}</option>)}</select></label>
        {app && <label className="wide"><span>Chương trình / môn trong gói</span><select value={f.line} onChange={e => setF({ ...f, line: e.target.value, grade: '', set: '' })}>
          <option value="">— Chọn —</option>{lines.map((l, i) => { const c = progs.find(x => x.id === l.curriculum_id); return <option key={i} value={i}>{c?.code} · {c?.name}{l.subject ? ' · ' + catName(cat, 'subject', l.subject) : ''}</option> })}</select></label>}
        {line && <label><span>Khối</span><select value={f.grade} onChange={e => setF({ ...f, grade: e.target.value, set: '', classes: [] })}><option value="">—</option>{grades.map(x => <option key={x} value={x}>{gradeLabel(x)}</option>)}</select></label>}
        {line && <label><span>Bộ học liệu</span><select value={f.set} onChange={e => setF({ ...f, set: e.target.value })}><option value="">— Không gắn —</option>{setOpts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
        <label><span>Số tiết / tuần</span><input type="number" min={0.5} step={0.5} value={f.ppw} onChange={e => setF({ ...f, ppw: Number(e.target.value) || 1 })} /></label>
        <label><span>Ngày bắt đầu</span><input type="date" value={f.start} onChange={e => setF({ ...f, start: e.target.value })} /></label>
        <label><span>Thứ dạy</span><select value={f.weekday} onChange={e => setF({ ...f, weekday: Number(e.target.value) })}>{WD.map((w, i) => <option key={i} value={i + 1}>{w}</option>)}</select></label>
        <label className="wide"><span>Tên kế hoạch (để trống để tự đặt)</span><input value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /></label>
        {f.grade && <div className="wide"><span className="sub">Lớp áp dụng</span><div className="p1-chiprow">{classes.filter(c => c.grade === g).map(c => { const on = f.classes.includes(c.id)
          return <button type="button" key={c.id} className={on ? 'on' : ''} onClick={() => setF({ ...f, classes: on ? f.classes.filter(x => x !== c.id) : [...f.classes, c.id] })}>{c.name}</button> })}
          {classes.filter(c => c.grade === g).length === 0 && <span className="sub">Trường chưa có lớp khối này.</span>}</div></div>}
      </div>
      {err && <p className="msg">{err}</p>}
      <div className="formactions"><button className="primary" type="submit" disabled={busy}>Tạo và xếp lịch</button><button type="button" onClick={onCancel}>Huỷ</button></div>
    </form>
  )
}

type View = 'weeks' | 'month' | 'list' | 'resources'
function PlanDetail({ plan, prog, orgName, cat, canManage, reload, onDeleted }: {
  plan: Plan; prog: Curriculum | null; orgName: string; cat: ReturnType<typeof effectiveCatalog>; canManage: boolean; reload: () => void; onDeleted: () => void
}) {
  const [items, setItems] = useState<Item[]>([])
  const [units, setUnits] = useState<{ id: string; title: string; seq: number }[]>([])
  const [stdLessons, setStdLessons] = useState<{ id: string; title: string; periods: number }[]>([])
  const [required, setRequired] = useState<number | null>(null)
  const [hols, setHols] = useState<Hol[]>([])
  const [classes, setClasses] = useState<Cls[]>([])
  const [norms, setNorms] = useState<Norm[]>([])
  const [view, setView] = useState<View>('weeks')
  const [pick, setPick] = useState<string | null>(null)
  const [month, setMonth] = useState(() => (today() > plan.start_date ? today() : plan.start_date).slice(0, 7))
  const [msg, setMsg] = useState('')
  const editable = canManage
  async function load() {
    const ver = plan.version_id ?? prog?.current_version_id
    const [i, h, c] = await Promise.all([
      supabase.from('ppct_items').select('*').eq('plan_id', plan.id).order('week_no').order('seq'),
      supabase.from('school_holidays').select('org_id, name, starts_on, ends_on'),
      supabase.from('classes').select('id, name, grade, org_id').in('id', plan.class_ids.length ? plan.class_ids : ['00000000-0000-0000-0000-000000000000']),
    ])
    const its = (i.data as Item[]) ?? []; setItems(its); setHols((h.data as Hol[]) ?? []); setClasses((c.data as Cls[]) ?? [])
    if (ver) {
      const [u, l, s] = await Promise.all([
        supabase.from('curriculum_units').select('id, title, seq, subject_main, grade').eq('version_id', ver).order('seq'),
        supabase.from('curriculum_lessons').select('id, title, periods, unit_id').eq('version_id', ver),
        supabase.from('curriculum_subjects').select('periods_total').eq('version_id', ver).eq('subject', plan.subject ?? '').eq('grade', plan.grade ?? -1),
      ])
      const us = ((u.data as any[]) ?? []).filter(x => (!plan.subject || x.subject_main === plan.subject) && (plan.grade == null || x.grade === plan.grade))
      setUnits(us); setStdLessons(((l.data as any[]) ?? []).filter(x => us.some(y => y.id === x.unit_id)))
      setRequired(((s.data as any[]) ?? [])[0]?.periods_total ?? null)
    }
    const mids = Array.from(new Set(its.map(x => x.material_lesson_id).filter(Boolean))) as string[]
    if (mids.length) { const n = await supabase.from('material_norms').select('*').in('lesson_id', mids); setNorms((n.data as Norm[]) ?? []) } else setNorms([])
  }
  useEffect(() => { load() }, [plan.id])
  const run = async (q: PromiseLike<{ error: { message: string } | null }>, also = false) => { const { error } = await q; if (error) setMsg(errMsg(error.message)); else { setMsg(''); load(); if (also) reload() } }
  const updItem = (i: Item, p: Partial<Item>) => run(supabase.from('ppct_items').update(p).eq('id', i.id), 'status' in p)

  const color = (unit: string | null) => PALETTE[Math.max(0, units.findIndex(u => u.id === unit)) % PALETTE.length]
  const monday0 = mondayOf(plan.start_date)
  const weekStart = (w: number) => addD(monday0, (w - 1) * 7)
  const maxWeek = Math.max(0, ...items.map(i => i.week_no))
  const offWeek = (w: number) => { const m = weekStart(w); return hols.find(h => h.starts_on <= addD(m, 4) && h.ends_on >= m && (new Date(h.ends_on).getTime() - new Date(h.starts_on).getTime()) / 864e5 >= 2) }
  const planned = items.filter(i => i.status !== 'skipped').reduce((a, i) => a + Number(i.periods), 0)
  const done = items.filter(i => i.status === 'done')
  const late = items.filter(isLate)
  const unplaced = stdLessons.filter(s => !items.some(i => i.curriculum_lesson_id === s.id))
  const noMaterial = plan.material_set_id ? items.filter(i => !i.material_lesson_id) : []
  const overWeeks = Array.from({ length: maxWeek }, (_, k) => k + 1).filter(w => items.filter(i => i.week_no === w).reduce((a, i) => a + Number(i.periods), 0) > plan.periods_per_week)
  const curWeek = Math.floor((new Date(today()).getTime() - new Date(monday0).getTime()) / (7 * 864e5)) + 1
  const ach = done.filter(i => i.achieved_pct != null)

  async function regenerate() {
    if (!confirm('Xếp lại toàn bộ lịch theo chương trình? Tiến độ, minh chứng đã ghi sẽ bị xoá.')) return
    const r = await supabase.rpc('ppct_generate', { p_plan: plan.id }); if (r.error) setMsg(errMsg(r.error.message)); else { load(); reload() }
  }
  async function remove() {
    if (!confirm(`Xoá kế hoạch “${plan.title}”?`)) return
    const r = await supabase.from('ppct_plans').delete().eq('id', plan.id); if (r.error) setMsg(errMsg(r.error.message)); else onDeleted()
  }
  const chip = (i: Item, compact = false) => (
    <button type="button" key={i.id} className={'p1-chip ' + (i.status === 'done' ? 'done' : '') + (i.status === 'moved' ? ' moved' : '') + (isLate(i) ? ' late' : '')}
      style={{ background: tint(color(i.curriculum_unit_id)), borderColor: color(i.curriculum_unit_id), color: '#0f172a' }} onClick={() => setPick(i.id)}
      title={`${i.title}${i.part > 1 ? ` (phần ${i.part})` : ''} · ${i.periods} tiết · ${ITEM_STATUS[i.status][0]}${isLate(i) ? ' · chậm' : ''}`}>
      <span className="t">{i.title}{i.part > 1 ? ` (${i.part})` : ''}</span>{!compact && <span className="n">{i.periods} tiết</span>}
    </button>)
  const sel = items.find(i => i.id === pick)

  // Lịch tháng
  const monthDays = (() => {
    const first = month + '-01'; const start = mondayOf(first)
    return Array.from({ length: 42 }, (_, k) => addD(start, k))
  })()

  return (
    <>
      <div className="p1-head">
        {prog && <Code color={prog.color}>{prog.code}</Code>}<h2>{plan.title}</h2>
        <Pill tone={plan.status === 'published' ? 'good' : ''}>{plan.status === 'published' ? 'Đã công bố' : plan.status === 'archived' ? 'Lưu trữ' : 'Bản nháp'}</Pill>
        {editable && <>
          <button type="button" onClick={() => run(supabase.from('ppct_plans').update({ status: plan.status === 'published' ? 'draft' : 'published', version_no: plan.status === 'published' ? plan.version_no : plan.version_no + 1 }).eq('id', plan.id), true)}>
            {plan.status === 'published' ? 'Mở lại để sửa' : 'Công bố kế hoạch'}</button>
          <button type="button" onClick={regenerate}>Xếp lại lịch</button>
          <button type="button" className="danger" onClick={remove}>Xoá</button></>}
        <p className="p1-sub">{orgName} · {prog?.name} · {catName(cat, 'subject', plan.subject)} {plan.grade != null ? gradeLabel(plan.grade) : ''} · {plan.school_year} · {plan.periods_per_week} tiết/tuần, {WD[plan.teach_weekday - 1]} · bắt đầu {fmtDY(plan.start_date)}
          {classes.length ? ' · Lớp ' + classes.map(c => c.name.replace(/^Lớp\s*/, '')).join(', ') : ''}{plan.notes ? ' · ' + plan.notes : ''}</p>
      </div>
      {msg && <p className="msg">{msg}</p>}
      <div className="p1-stats">
        <Stat label="Thời lượng kế hoạch" value={`${planned} tiết`} sub={required != null ? `quy định ${required} tiết` : 'chưa khai báo quy định'} tone={required != null && planned !== required ? 'warn' : ''} />
        <Stat label="Số tuần" value={maxWeek} sub={`tuần hiện tại: ${curWeek > 0 && curWeek <= maxWeek ? curWeek : '—'}`} />
        <Stat label="Hoàn thành kế hoạch" value={`${items.length ? Math.round(done.length * 100 / items.length) : 0}%`} sub={`${done.length}/${items.length} mục`} tone="good" />
        <Stat label="Mức đạt yêu cầu" value={ach.length ? `${Math.round(ach.reduce((a, i) => a + Number(i.achieved_pct), 0) / ach.length)}%` : '—'} sub="trung bình các mục đã đánh giá" />
        <Stat label="Chậm tiến độ" value={late.length} tone={late.length ? 'bad' : ''} sub="quá ngày dự kiến, chưa ghi nhận" />
      </div>
      {required != null && planned !== required && <div className="p1-alert warn">Tổng tiết kế hoạch ({planned}) {planned < required ? 'thiếu' : 'thừa'} {Math.abs(planned - required)} tiết so với quy định của chương trình ({required}).</div>}
      {unplaced.length > 0 && <div className="p1-alert warn">Bài chưa được bố trí: {unplaced.map(u => u.title).join(', ')}.</div>}
      {noMaterial.length > 0 && <div className="p1-alert info">{noMaterial.length} mục chưa có học liệu tương ứng trong bộ học liệu đã chọn.</div>}
      {overWeeks.length > 0 && <div className="p1-alert bad">Tuần vượt số tiết/tuần: {overWeeks.join(', ')}.</div>}

      <div className="bar"><Tabs items={[['weeks', 'Theo tuần'], ['month', 'Lịch tháng'], ['list', 'Danh sách', items.length], ['resources', 'Nguồn lực']] as [View, string, number?][]} value={view} onChange={setView} />
        <div className="p1-cal-legend">{units.map(u => <span key={u.id}><i className="p1-dot" style={{ background: color(u.id) }} />{u.title}</span>)}</div></div>

      {view === 'weeks' && <div className="p1-weeks">
        {Array.from({ length: maxWeek }, (_, k) => k + 1).map(w => {
          const its = items.filter(i => i.week_no === w); const off = offWeek(w); const load = its.reduce((a, i) => a + Number(i.periods), 0)
          return (
            <div key={w} className={'p1-week' + (w === curWeek ? ' now' : '') + (off && !its.length ? ' off' : '')}>
              <div className="wk"><b>Tuần {w}</b><small>{fmtD(weekStart(w))} – {fmtD(addD(weekStart(w), 4))}</small></div>
              <div className="p1-chips">{its.length ? its.map(i => chip(i)) : <small className="sub">{off ? `Nghỉ: ${off.name}` : 'Không có tiết'}</small>}</div>
              <div className={'load' + (load > plan.periods_per_week ? ' over' : '')}>{load}/{plan.periods_per_week} tiết</div>
            </div>)
        })}
        {!items.length && <Empty>Kế hoạch chưa có mục nào{editable ? ' — bấm “Xếp lại lịch”.' : '.'}</Empty>}
      </div>}

      {view === 'month' && <>
        <div className="p1-monthbar">
          <button type="button" onClick={() => setMonth(addD(month + '-01', -1).slice(0, 7))} aria-label="Tháng trước">‹</button>
          <b>Tháng {Number(month.slice(5))}/{month.slice(0, 4)}</b>
          <button type="button" onClick={() => setMonth(addD(month + '-28', 7).slice(0, 7))} aria-label="Tháng sau">›</button>
          <button type="button" onClick={() => setMonth(today().slice(0, 7))}>Hôm nay</button>
        </div>
        <div className="p1-month">
          {WD.map(d => <div key={d} className="dow">{d}</div>)}
          {monthDays.map(d => { const its = items.filter(i => i.planned_date === d); const off = hols.find(h => h.starts_on <= d && h.ends_on >= d)
            return <div key={d} className={'day' + (d.slice(0, 7) !== month ? ' out' : '') + (d === today() ? ' today' : '') + (off ? ' off' : '')} title={off?.name}>
              <small>{Number(d.slice(8))}</small>{its.map(i => chip(i, true))}</div> })}
        </div>
      </>}

      {view === 'list' && <table className="p1-table">
        <thead><tr><th>Tuần</th><th>Ngày</th><th>Bài / nội dung</th><th>Tiết</th><th>Trạng thái</th><th>Ngày dạy</th><th>Minh chứng</th></tr></thead>
        <tbody>{items.map(i => <tr key={i.id} className={isLate(i) ? 'cur-late' : ''}>
          <td>{i.week_no}</td><td>{fmtD(i.planned_date)}</td>
          <td><i className="p1-dot" style={{ background: color(i.curriculum_unit_id), display: 'inline-block', marginRight: 6 }} /><button type="button" className="linkbtn" onClick={() => setPick(i.id)}>{i.title}{i.part > 1 ? ` (phần ${i.part})` : ''}</button></td>
          <td>{i.periods}</td>
          <td><Pill tone={isLate(i) ? 'bad' : ITEM_STATUS[i.status][1]}>{isLate(i) ? 'Chậm' : ITEM_STATUS[i.status][0]}</Pill></td>
          <td>{fmtD(i.done_on)}</td><td>{i.evidence_url ? <a href={i.evidence_url} target="_blank" rel="noreferrer">Mở</a> : i.evidence_note ?? '—'}</td>
        </tr>)}</tbody></table>}

      {view === 'resources' && <Resources items={items} norms={norms} classes={classes} weekStart={weekStart} curWeek={curWeek} />}

      {sel && <Section title={`${sel.title}${sel.part > 1 ? ` (phần ${sel.part})` : ''} · tuần ${sel.week_no}`} actions={<button type="button" onClick={() => setPick(null)}>Đóng</button>}>
        <div className="p1-form">
          <label><span>Trạng thái</span><select disabled={!editable} value={sel.status} onChange={e => updItem(sel, { status: e.target.value, done_on: e.target.value === 'done' ? sel.done_on ?? today() : sel.done_on })}>
            {Object.entries(ITEM_STATUS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label><span>Tuần</span><input type="number" min={1} max={60} disabled={!editable} defaultValue={sel.week_no} key={'w' + sel.id + sel.week_no}
            onBlur={e => { const w = Math.max(1, Number(e.target.value) || 1); if (w !== sel.week_no) updItem(sel, { week_no: w, planned_date: addD(weekStart(w), plan.teach_weekday - 1), status: sel.status === 'planned' ? 'planned' : sel.status }) }} /></label>
          <label><span>Ngày dự kiến</span><input type="date" disabled={!editable} defaultValue={sel.planned_date ?? ''} key={'d' + sel.id + sel.planned_date} onBlur={e => updItem(sel, { planned_date: e.target.value || null })} /></label>
          <label><span>Ngày dạy thực tế</span><input type="date" disabled={!editable} defaultValue={sel.done_on ?? ''} key={'x' + sel.id} onBlur={e => updItem(sel, { done_on: e.target.value || null })} /></label>
          <label><span>Mức đạt yêu cầu cần đạt (%)</span><input type="number" min={0} max={100} disabled={!editable} defaultValue={sel.achieved_pct ?? ''} key={'a' + sel.id} onBlur={e => updItem(sel, { achieved_pct: e.target.value === '' ? null : Math.min(100, Number(e.target.value)) })} /></label>
          <label><span>Minh chứng (đường dẫn)</span><input disabled={!editable} defaultValue={sel.evidence_url ?? ''} key={'u' + sel.id} placeholder="https://…" onBlur={e => updItem(sel, { evidence_url: e.target.value || null })} /></label>
          <label className="wide"><span>Ghi chú minh chứng / điều chỉnh</span><input disabled={!editable} defaultValue={sel.evidence_note ?? sel.note ?? ''} key={'n' + sel.id} onBlur={e => updItem(sel, { evidence_note: e.target.value || null })} /></label>
        </div>
        {editable && <div className="p1-actions" style={{ marginTop: 10 }}>
          <button type="button" onClick={() => updItem(sel, { week_no: Math.max(1, sel.week_no - 1), planned_date: addD(weekStart(Math.max(1, sel.week_no - 1)), plan.teach_weekday - 1) })}>← Lùi một tuần</button>
          <button type="button" onClick={() => updItem(sel, { week_no: sel.week_no + 1, planned_date: addD(weekStart(sel.week_no + 1), plan.teach_weekday - 1), status: sel.status === 'planned' ? 'planned' : sel.status })}>Dời sang tuần sau →</button>
          <button type="button" className="primary" onClick={() => updItem(sel, { status: 'done', done_on: sel.done_on ?? today() })}>Ghi nhận đã dạy</button>
        </div>}
      </Section>}
    </>
  )
}

// Nguồn lực dự kiến: vật tư theo định mức học liệu × số lớp (mỗi lớp 7 nhóm / 7 sản phẩm, 35 HS) — 4 tuần tới và cả kế hoạch
function Resources({ items, norms, classes, weekStart, curWeek }: { items: Item[]; norms: Norm[]; classes: Cls[]; weekStart: (w: number) => string; curWeek: number }) {
  const [range, setRange] = useState<'next' | 'all'>('next')
  const nClass = Math.max(1, classes.length)
  const scope = items.filter(i => i.status !== 'skipped' && (range === 'all' || (i.week_no >= curWeek && i.week_no < curWeek + 4)))
  const agg = new Map<string, { name: string; unit: string; category: string; qty: number; basis: string }>()
  scope.forEach(i => norms.filter(n => n.lesson_id === i.material_lesson_id).forEach(n => {
    const k = `${n.name}|${n.unit}|${n.category}`
    const q = n.consumable ? needQty(n, 35, 7, 7) * nClass : needQty(n, 35, 7, 7)
    const cur = agg.get(k); if (cur) cur.qty = n.consumable ? cur.qty + q : Math.max(cur.qty, q); else agg.set(k, { name: n.name, unit: n.unit, category: n.category, qty: q, basis: n.basis })
  }))
  return (
    <Section title="Dự kiến nguồn lực" actions={<Tabs items={[['next', '4 tuần tới'], ['all', 'Cả kế hoạch']] as ['next' | 'all', string][]} value={range} onChange={setRange} />}>
      <p className="sub">{scope.length} mục kế hoạch · {nClass} lớp · tính 35 HS, 7 nhóm (7 sản phẩm) mỗi lớp. Vật tư tiêu hao cộng dồn; dụng cụ, thiết bị dùng lại lấy số lớn nhất.
        {range === 'next' && curWeek > 0 ? ` Từ tuần ${curWeek} (${fmtD(weekStart(curWeek))}).` : ''}</p>
      {agg.size === 0 ? <Empty>Chưa có định mức vật tư (kế hoạch chưa gắn bộ học liệu hoặc học liệu chưa có định mức).</Empty> : (
        <table className="p1-table"><thead><tr><th>Vật tư / thiết bị</th><th>Loại</th><th>Định mức tính theo</th><th>Cần chuẩn bị</th></tr></thead>
          <tbody>{[...agg.values()].sort((a, b) => a.category.localeCompare(b.category)).map(r => <tr key={r.name + r.unit}>
            <td><b>{r.name}</b></td><td>{({ vat_tu: 'Nguyên vật liệu', dung_cu: 'Dụng cụ', thiet_bi: 'Thiết bị' } as Record<string, string>)[r.category]}</td><td>{BASIS[r.basis]}</td>
            <td><b>{+r.qty.toFixed(2)}</b> {r.unit}</td></tr>)}</tbody></table>)}
    </Section>
  )
}
