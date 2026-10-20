import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { Tabs } from '../../../pages/teacher/common'
import { Code, Empty, Pill, Progress, Section, Stat, errMsg, fmtD, today, useOrgList } from '../ui'
import { catName, effectiveCatalog, gradeLabel, useCatalog, useOrgs, type Curriculum } from '../curriculum/api'
import { isLate, type Item, type Plan } from '../ppct/PpctPage'

type App = { id: string; package_id: string; org_id: string; school_year: string; grades: number[]; status: string; program_packages: { name: string; tier: string | null } | null }
type G = 'school' | 'program' | 'subject' | 'package'

// 1.1.5 Theo dõi triển khai chương trình (CT1–CTn): chương trình / gói đang áp dụng, tiến độ kế hoạch so với thực tế,
// trạng thái, kết quả (mức đạt yêu cầu, minh chứng), cảnh báo. Hai chỉ số tách biệt: hoàn thành kế hoạch ≠ đạt chuẩn đầu ra.
export function TrackingPage({ orgId }: { orgId: string | null }) {
  const [plans, setPlans] = useState<Plan[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [progs, setProgs] = useState<Curriculum[]>([])
  const [apps, setApps] = useState<App[]>([])
  const [group, setGroup] = useState<G>('school')
  const [msg, setMsg] = useState('')
  const orgs = useOrgList()
  const { all, hidden } = useCatalog()
  const { below } = useOrgs(orgId)
  const cat = effectiveCatalog(all, hidden, below)
  useEffect(() => {
    Promise.all([
      supabase.from('ppct_plans').select('*').neq('status', 'archived'),
      supabase.from('ppct_items').select('*'),
      supabase.from('curricula').select('*').order('code'),
      supabase.from('program_package_schools').select('*, program_packages(name, tier)'),
    ]).then(([p, i, c, a]) => {
      if (p.error) return setMsg(errMsg(p.error.message))
      setPlans((p.data as Plan[]) ?? []); setItems((i.data as Item[]) ?? []); setProgs((c.data as Curriculum[]) ?? []); setApps((a.data as App[]) ?? [])
    })
  }, [orgId])

  const t = today()
  const due = items.filter(i => i.planned_date && i.planned_date <= t && i.status !== 'skipped')
  const done = items.filter(i => i.status === 'done')
  const ach = done.filter(i => i.achieved_pct != null)
  const late = items.filter(isLate)
  const noEvidence = done.filter(i => !i.evidence_url && !i.evidence_note)
  const pct = (a: number, b: number) => (b ? Math.round(a * 100 / b) : 0)
  const planOf = (i: Item) => plans.find(p => p.id === i.plan_id)
  const prog = (id: string | null) => progs.find(c => c.id === id)
  const tone = (v: number) => (v >= 90 ? 'good' : v >= 70 ? 'warn' : 'bad')

  // Gom theo trường / chương trình / môn / gói
  const keyOf = (p: Plan) => group === 'school' ? p.org_id : group === 'program' ? p.curriculum_id ?? '_' : group === 'subject' ? `${p.subject}|${p.grade}`
    : apps.find(a => a.id === p.package_school_id)?.package_id ?? '_'
  const labelOf = (k: string) => {
    if (group === 'school') return <b>{orgs.find(o => o.id === k)?.name ?? '—'}</b>
    if (group === 'program') { const c = prog(k); return c ? <><Code color={c.color}>{c.code}</Code> {c.name}</> : '—' }
    if (group === 'subject') { const [s, g] = k.split('|'); return <b>{catName(cat, 'subject', s)} {g !== 'null' ? gradeLabel(Number(g)) : ''}</b> }
    return <b>{apps.find(a => a.package_id === k)?.program_packages?.name ?? '—'}</b>
  }
  const rows = Array.from(new Set(plans.map(keyOf))).map(k => {
    const ps = plans.filter(p => keyOf(p) === k); const ids = new Set(ps.map(p => p.id))
    const its = items.filter(i => ids.has(i.plan_id)); const d = its.filter(i => i.planned_date && i.planned_date <= t && i.status !== 'skipped')
    const dn = its.filter(i => i.status === 'done'); const a = dn.filter(i => i.achieved_pct != null)
    return { k, plans: ps.length, total: its.length, due: d.length, done: dn.length, late: its.filter(isLate).length,
      ach: a.length ? Math.round(a.reduce((x, i) => x + Number(i.achieved_pct), 0) / a.length) : null, ev: dn.filter(i => i.evidence_url || i.evidence_note).length }
  })

  return (
    <>
      {msg && <p className="msg">{msg}</p>}
      <div className="p1-stats">
        <Stat label="Trường áp dụng gói" value={new Set(apps.filter(a => a.status === 'active').map(a => a.org_id)).size} sub={`${apps.filter(a => a.status === 'proposed').length} đề xuất`} />
        <Stat label="Kế hoạch phân phối" value={plans.length} sub={`${plans.filter(p => p.status === 'published').length} đã công bố`} />
        <Stat label="Hoàn thành kế hoạch" value={`${pct(done.length, due.length)}%`} sub={`${done.length}/${due.length} mục đến hạn`} tone={tone(pct(done.length, due.length))} />
        <Stat label="Mức đạt yêu cầu cần đạt" value={ach.length ? `${Math.round(ach.reduce((a, i) => a + Number(i.achieved_pct), 0) / ach.length)}%` : '—'} sub={`${ach.length} mục có đánh giá`} />
        <Stat label="Chậm tiến độ" value={late.length} tone={late.length ? 'bad' : ''} sub="quá ngày dự kiến chưa dạy" />
      </div>
      <div className="p1-alert info">Hoàn thành đủ tiết theo kế hoạch không mặc nhiên là học sinh đạt chuẩn đầu ra: hai chỉ số được theo dõi riêng.</div>

      <Section title="Tiến độ theo nhóm" actions={<Tabs items={[['school', 'Trường'], ['program', 'Chương trình'], ['subject', 'Môn · khối'], ['package', 'Gói']] as [G, string][]} value={group} onChange={setGroup} />}>
        {rows.length === 0 ? <Empty>Chưa có kế hoạch phân phối.</Empty> : (
          <table className="p1-table">
            <thead><tr><th>{({ school: 'Trường', program: 'Chương trình', subject: 'Môn · khối', package: 'Gói' } as Record<G, string>)[group]}</th><th>Kế hoạch</th><th>Hoàn thành kế hoạch</th><th>Mức đạt yêu cầu</th><th>Minh chứng</th><th>Trạng thái</th></tr></thead>
            <tbody>{rows.map(r => { const v = pct(r.done, r.due)
              return <tr key={r.k}><td>{labelOf(r.k)}</td><td>{r.plans} kế hoạch · {r.total} mục</td>
                <td style={{ minWidth: 170 }}><Progress value={v} tone={tone(v)} /><small className="sub">{r.done}/{r.due} mục đến hạn</small></td>
                <td style={{ minWidth: 150 }}>{r.ach == null ? <span className="sub">Chưa đánh giá</span> : <Progress value={r.ach} tone={r.ach >= 70 ? 'good' : 'warn'} />}</td>
                <td>{r.ev}/{r.done}</td>
                <td>{r.late ? <Pill tone="bad">{r.late} chậm</Pill> : r.due === 0 ? <Pill>Chưa bắt đầu</Pill> : r.done >= r.total ? <Pill tone="good">Hoàn thành</Pill> : <Pill tone="info">Đang thực hiện</Pill>}</td></tr> })}</tbody>
          </table>)}
      </Section>

      <Section title={`Cảnh báo · ${late.length + noEvidence.length}`}>
        {late.length + noEvidence.length === 0 ? <Empty>Không có cảnh báo.</Empty> : (
          <table className="p1-table"><thead><tr><th>Loại</th><th>Trường</th><th>Kế hoạch</th><th>Bài</th><th>Ngày dự kiến</th></tr></thead>
            <tbody>
              {late.slice(0, 40).map(i => { const p = planOf(i); return <tr key={i.id}><td><Pill tone="bad">Chậm tiến độ</Pill></td><td>{orgs.find(o => o.id === p?.org_id)?.name}</td><td>{p?.title}</td><td>{i.title}</td><td>{fmtD(i.planned_date)}</td></tr> })}
              {noEvidence.slice(0, 20).map(i => { const p = planOf(i); return <tr key={i.id}><td><Pill tone="warn">Thiếu minh chứng</Pill></td><td>{orgs.find(o => o.id === p?.org_id)?.name}</td><td>{p?.title}</td><td>{i.title}</td><td>{fmtD(i.planned_date)}</td></tr> })}
            </tbody></table>)}
      </Section>

      <Section title="Chương trình & gói đang áp dụng tại trường">
        {apps.length === 0 ? <Empty>Chưa có trường áp dụng gói.</Empty> : (
          <table className="p1-table"><thead><tr><th>Trường</th><th>Gói</th><th>Năm học</th><th>Khối</th><th>Trạng thái</th><th>Kế hoạch đã lập</th></tr></thead>
            <tbody>{apps.map(a => <tr key={a.id}><td><b>{orgs.find(o => o.id === a.org_id)?.name}</b></td><td>{a.program_packages?.name}</td><td>{a.school_year}</td>
              <td>{a.grades.length ? a.grades.join(', ') : 'Mọi khối'}</td><td><Pill tone={a.status === 'active' ? 'good' : a.status === 'proposed' ? 'warn' : ''}>{({ active: 'Đang áp dụng', proposed: 'Đề xuất', ended: 'Kết thúc' } as Record<string, string>)[a.status]}</Pill></td>
              <td>{plans.filter(p => p.package_school_id === a.id).length || <span className="sub">Chưa lập</span>}</td></tr>)}</tbody></table>)}
      </Section>
    </>
  )
}
