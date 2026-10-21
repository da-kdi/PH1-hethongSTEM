import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { Drawer, Pill, addD, errMsg, fmtD, fmtDY, today } from '../ui'
import { gradeLabel, type Curriculum } from '../curriculum/api'
import { ITEM_STATUS, isLate, type Item, type Plan } from './PpctPage'

// Lịch phân phối nhiều kế hoạch: Kế hoạch năm (hàng = kế hoạch, cột = tuần theo tháng) và TKB tuần (cột = thứ trong tuần)

const WD = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7']
// Tuần 1 của năm học = tuần chứa ngày 1/9 của năm bắt đầu
export const yearStart = (schoolYear: string) => { const y = Number(schoolYear.slice(0, 4)) || new Date().getFullYear(); const d = new Date(y, 8, 1); const k = (d.getDay() + 6) % 7; d.setDate(d.getDate() - k)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
export const weekOfYear = (start: string, date: string) => Math.floor((new Date(date + 'T00:00:00').getTime() - new Date(start + 'T00:00:00').getTime()) / (7 * 864e5)) + 1
const tint = (c: string) => c + '1c'

function Chip({ it, color, onClick, compact }: { it: Item; color: string; onClick: () => void; compact?: boolean }) {
  const late = isLate(it)
  return (
    <button type="button" className={'p1-cal-item' + (it.status === 'done' ? ' done' : '') + (late ? ' late' : '') + (it.status === 'moved' ? ' moved' : '')}
      style={{ background: tint(color), borderLeftColor: color }} onClick={onClick}
      title={`${it.title}${it.part > 1 ? ` (phần ${it.part})` : ''} · ${it.periods} tiết · ${late ? 'Chậm' : ITEM_STATUS[it.status][0]}`}>
      <b>{it.title}{it.part > 1 ? ` (${it.part})` : ''}</b>
      {!compact && <small>{it.periods} tiết · <span className={late ? 'bad' : it.status === 'done' ? 'good' : ''}>{late ? 'Chậm' : ITEM_STATUS[it.status][0]}</span></small>}
    </button>
  )
}

export function YearGrid({ plans, items, progs, orgName, range, onPlan, onItem }: {
  plans: Plan[]; items: Item[]; progs: Curriculum[]; orgName: (id: string) => string; range: { from: number; to: number }
  onPlan: (id: string) => void; onItem: (id: string) => void
}) {
  if (!plans.length) return null
  const start = yearStart(plans[0].school_year)
  const weeks = Array.from({ length: range.to - range.from + 1 }, (_, k) => range.from + k)
  const ws = (w: number) => addD(start, (w - 1) * 7)
  const cur = weekOfYear(start, today())
  const months: { m: string; n: number }[] = []
  weeks.forEach(w => { const m = ws(w).slice(0, 7); const last = months[months.length - 1]; if (last?.m === m) last.n++; else months.push({ m, n: 1 }) })
  const color = (p: Plan) => progs.find(c => c.id === p.curriculum_id)?.color ?? '#64748b'
  return (
    <div className="p1-yearwrap">
      <table className="p1-year">
        <thead>
          <tr><th className="sticky" rowSpan={2}>Bản kế hoạch</th>{months.map(m => <th key={m.m} colSpan={m.n} className="month">Tháng {Number(m.m.slice(5))}</th>)}</tr>
          <tr>{weeks.map(w => <th key={w} className={w === cur ? 'now' : ''}><b>Tuần {w}</b><small>{fmtD(ws(w))}–{fmtD(addD(ws(w), 5))}</small></th>)}</tr>
        </thead>
        <tbody>{plans.map(p => { const its = items.filter(i => i.plan_id === p.id); const c = progs.find(x => x.id === p.curriculum_id)
          return (
            <tr key={p.id}>
              <th className="sticky"><button type="button" className="p1-planhead" onClick={() => onPlan(p.id)}>
                <span className="code" style={{ background: color(p) }}>{c?.code ?? '—'}</span>
                <b>{p.title}</b><small>{orgName(p.org_id)}{p.grade != null ? ` · ${gradeLabel(p.grade)}` : ''}</small>
                <small>{its.length} dòng · {its.reduce((a, i) => a + Number(i.periods), 0)} tiết</small>
                <Pill tone={p.status === 'published' ? 'good' : ''}>{p.status === 'published' ? 'Đang áp dụng' : 'Bản nháp'}</Pill>
              </button></th>
              {weeks.map(w => { const cell = its.filter(i => i.planned_date && weekOfYear(start, i.planned_date) === w)
                return <td key={w} className={w === cur ? 'now' : ''}>{cell.map(i => <Chip key={i.id} it={i} color={color(p)} onClick={() => onItem(i.id)} />)}</td> })}
            </tr>)
        })}</tbody>
      </table>
    </div>
  )
}

export function WeekGrid({ plans, items, progs, monday, onItem, onPlan }: {
  plans: Plan[]; items: Item[]; progs: Curriculum[]; monday: string; onItem: (id: string) => void; onPlan: (id: string) => void
}) {
  const days = WD.map((_, k) => addD(monday, k))
  const t = today()
  const color = (p: Plan) => progs.find(c => c.id === p.curriculum_id)?.color ?? '#64748b'
  const rows = plans.filter(p => items.some(i => i.plan_id === p.id && i.planned_date && i.planned_date >= monday && i.planned_date <= days[5]))
  return (
    <div className="p1-yearwrap">
      <table className="p1-weekgrid">
        <thead><tr><th className="sticky">Kế hoạch</th>{days.map((d, k) => <th key={d} className={d === t ? 'now' : ''}><small>{WD[k]}</small><b className={d === t ? 'today' : ''}>{Number(d.slice(8))}</b></th>)}</tr></thead>
        <tbody>
          {rows.map(p => { const c = progs.find(x => x.id === p.curriculum_id)
            return <tr key={p.id}><th className="sticky"><button type="button" className="p1-planhead" onClick={() => onPlan(p.id)}>
              <span className="code" style={{ background: color(p) }}>{c?.code ?? '—'}</span><b>{p.title}</b><small>{p.grade != null ? gradeLabel(p.grade) : ''} · {p.class_ids.length} lớp</small></button></th>
              {days.map(d => <td key={d} className={d === t ? 'now' : ''}>{items.filter(i => i.plan_id === p.id && i.planned_date === d).map(i => <Chip key={i.id} it={i} color={color(p)} onClick={() => onItem(i.id)} />)}</td>)}
            </tr> })}
          {!rows.length && <tr><td colSpan={7} className="sub" style={{ textAlign: 'center', padding: 28 }}>Tuần này không có tiết nào theo kế hoạch.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

// Xem nhanh một mục kế hoạch + ghi nhận tiến độ
export function ItemDrawer({ item, plan, prog, orgName, canEdit, onClose, onOpenPlan, onChanged }: {
  item: Item; plan: Plan; prog: Curriculum | null; orgName: string; canEdit: boolean; onClose: () => void; onOpenPlan: () => void; onChanged: () => void
}) {
  const [msg, setMsg] = useState('')
  const upd = async (p: Partial<Item>) => { const { error } = await supabase.from('ppct_items').update(p).eq('id', item.id); if (error) setMsg(errMsg(error.message)); else onChanged() }
  const late = isLate(item)
  return (
    <Drawer color={prog?.color} title={`${item.title}${item.part > 1 ? ` (phần ${item.part})` : ''}`} onClose={onClose}
      badges={[prog?.code, plan.title, `Tuần ${item.week_no}`, `${item.periods} tiết`]}
      footer={<><span className="note">{orgName}</span>
        {canEdit && item.status !== 'done' && <button type="button" onClick={() => upd({ week_no: item.week_no + 1, planned_date: item.planned_date ? addD(item.planned_date, 7) : null })}>Dời sang tuần sau</button>}
        {canEdit && item.status !== 'done' && <button type="button" className="primary" onClick={() => upd({ status: 'done', done_on: today() })}>✓ Ghi nhận đã dạy</button>}
        <button type="button" onClick={onOpenPlan}>Mở kế hoạch ⤢</button></>}>
      {msg && <p className="msg">{msg}</p>}
      <div className="p1-mini">
        <div><span>Ngày dự kiến</span><b style={{ fontSize: 16 }}>{fmtDY(item.planned_date)}</b></div>
        <div><span>Trạng thái</span><b style={{ fontSize: 16 }}><Pill tone={late ? 'bad' : ITEM_STATUS[item.status][1]}>{late ? 'Chậm tiến độ' : ITEM_STATUS[item.status][0]}</Pill></b></div>
        <div><span>Ngày dạy</span><b style={{ fontSize: 16 }}>{fmtDY(item.done_on)}</b></div>
        <div><span>Mức đạt YCCĐ</span><b style={{ fontSize: 16 }}>{item.achieved_pct != null ? `${item.achieved_pct}%` : '—'}</b></div>
      </div>
      {(item.evidence_url || item.evidence_note) && <div className="p1-box"><h4>📎 Minh chứng</h4>{item.evidence_url && <p style={{ margin: 0 }}><a href={item.evidence_url} target="_blank" rel="noreferrer">Mở minh chứng</a></p>}
        {item.evidence_note && <p className="p1-text">{item.evidence_note}</p>}</div>}
      {item.note && <div className="p1-box"><h4>📝 Ghi chú</h4><p className="p1-text">{item.note}</p></div>}
    </Drawer>
  )
}
