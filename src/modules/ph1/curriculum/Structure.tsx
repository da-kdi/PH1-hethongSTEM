import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { GRADES, ROOM_KIND, catName, catOf, errText, gradeLabel, type CatItem, type Content, type Labels, type Lesson, type PeriodRow, type Unit } from './api'

// Ô sửa tại chỗ: lưu khi rời ô (nếu đổi)
export function Cell({ value, onSave, type = 'text', placeholder, label, multiline, disabled, width }: {
  value: string | number | null; onSave: (v: string) => void; type?: 'text' | 'number'; placeholder?: string; label: string
  multiline?: boolean; disabled?: boolean; width?: number
}) {
  const [v, setV] = useState(value == null ? '' : String(value))
  useEffect(() => { setV(value == null ? '' : String(value)) }, [value])
  const done = () => { if (v !== (value == null ? '' : String(value))) onSave(v) }
  if (disabled) return <span className="cur-ro">{v || <span className="sub">—</span>}</span>
  return multiline
    ? <textarea rows={2} value={v} placeholder={placeholder} aria-label={label} onChange={e => setV(e.target.value)} onBlur={done} />
    : <input type={type} value={v} placeholder={placeholder} aria-label={label} style={width ? { width } : undefined} min={type === 'number' ? 0 : undefined}
        onChange={e => setV(e.target.value)} onBlur={done} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
}

export function MultiPick({ items, value, onChange, disabled, label }: { items: CatItem[]; value: string[]; onChange: (v: string[]) => void; disabled?: boolean; label: string }) {
  if (disabled) return <span className="cur-ro">{value.map(c => items.find(i => i.code === c)?.name ?? c).join(', ') || <span className="sub">—</span>}</span>
  return (
    <div className="cur-chips" role="group" aria-label={label}>
      {items.map(i => {
        const on = value.includes(i.code)
        return <button type="button" key={i.id} className={'chip' + (on ? ' on' : '')} aria-pressed={on}
          onClick={() => onChange(on ? value.filter(x => x !== i.code) : [...value, i.code])}>{i.name}</button>
      })}
      {value.filter(c => !items.some(i => i.code === c)).map(c => <span className="chip on" key={c} title="Mã không còn trong danh mục">{c}</span>)}
    </div>
  )
}

type Lib = { id: string; title: string; kind: string }

export function StructureEditor({ versionId, content, cat, labels, editable, reload, setMsg }: {
  versionId: string; content: Content; cat: CatItem[]; labels: Labels; editable: boolean; reload: () => void; setMsg: (m: string) => void
}) {
  const [open, setOpen] = useState<Set<string>>(() => new Set(content.units.slice(0, 1).map(u => u.id)))
  const [lib, setLib] = useState<Lib[]>([])
  useEffect(() => {
    supabase.from('library_items').select('id, title, kind').neq('status', 'archived').order('title').limit(500).then(({ data }) => setLib((data as Lib[]) ?? []))
  }, [])
  const subjects = catOf(cat, 'subject')

  const run = async (p: PromiseLike<{ error: { message: string } | null }>) => { const { error } = await p; if (error) setMsg(errText(error.message)); else { setMsg(''); reload() } }
  const updUnit = (u: Unit, patch: Partial<Unit>) => run(supabase.from('curriculum_units').update(patch).eq('id', u.id))
  const updLesson = (l: Lesson, patch: Partial<Lesson>) => run(supabase.from('curriculum_lessons').update(patch).eq('id', l.id))
  const num = (s: string) => Math.max(0, Number(s) || 0)

  async function addUnit() {
    const seq = (content.units[content.units.length - 1]?.seq ?? 0) + 1
    const { data, error } = await supabase.from('curriculum_units').insert({ version_id: versionId, seq, title: `${labels.unit} ${seq}`, periods: 0 }).select('id').single()
    if (error) return setMsg(errText(error.message))
    setOpen(new Set([...open, (data as { id: string }).id])); reload()
  }
  const addLesson = (u: Unit) => {
    const mine = content.lessons.filter(l => l.unit_id === u.id)
    const seq = (mine[mine.length - 1]?.seq ?? 0) + 1
    return run(supabase.from('curriculum_lessons').insert({ version_id: versionId, unit_id: u.id, seq, title: `${labels.lesson} ${seq}`, periods: 1 }))
  }
  async function move<T extends { id: string; seq: number }>(table: string, list: T[], i: number, d: -1 | 1) {
    const a = list[i], b = list[i + d]; if (!a || !b) return
    const r1 = await supabase.from(table).update({ seq: b.seq }).eq('id', a.id)
    const r2 = await supabase.from(table).update({ seq: a.seq === b.seq ? a.seq + d : a.seq }).eq('id', b.id)
    if (r1.error || r2.error) setMsg(errText((r1.error ?? r2.error)!.message)); else reload()
  }
  const removeUnit = (u: Unit) => confirm(`Xoá ${labels.unit.toLowerCase()} “${u.title}” cùng các ${labels.lesson.toLowerCase()}, chuẩn đầu ra, tiêu chí bên trong?`)
    && run(supabase.from('curriculum_units').delete().eq('id', u.id))
  const removeLesson = (l: Lesson) => confirm(`Xoá ${labels.lesson.toLowerCase()} “${l.title}”?`) && run(supabase.from('curriculum_lessons').delete().eq('id', l.id))
  const setPlan = (l: Lesson, plan: PeriodRow[]) => updLesson(l, { period_plan: plan })

  const totalPeriods = content.units.reduce((s, u) => s + u.periods, 0)
  const lessonPeriods = content.lessons.reduce((s, l) => s + l.periods, 0)

  return (
    <div className="cur-structure">
      <p className="sub">{content.units.length} {labels.unit.toLowerCase()} · {content.lessons.length} {labels.lesson.toLowerCase()} · {totalPeriods} {labels.period.toLowerCase()} theo {labels.unit.toLowerCase()}
        {lessonPeriods !== totalPeriods && content.lessons.length > 0 && <> · <b className="cur-warn">tổng {labels.period.toLowerCase()} các {labels.lesson.toLowerCase()} = {lessonPeriods}</b></>}</p>
      {content.units.map((u, i) => {
        const lessons = content.lessons.filter(l => l.unit_id === u.id)
        const isOpen = open.has(u.id)
        return (
          <section className="panel cur-unit" key={u.id}>
            <header>
              <button type="button" className="linkbtn" aria-expanded={isOpen} onClick={() => { const n = new Set(open); isOpen ? n.delete(u.id) : n.add(u.id); setOpen(n) }}>{isOpen ? '▾' : '▸'}</button>
              <span className="cur-no">{labels.unit} {i + 1}</span>
              <Cell label={`Mã ${labels.unit}`} value={u.code} onSave={v => updUnit(u, { code: v.trim() || null })} placeholder="Mã" disabled={!editable} width={70} />
              <div className="cur-grow"><Cell label={`Tên ${labels.unit}`} value={u.title} onSave={v => v.trim() && updUnit(u, { title: v.trim() })} disabled={!editable} /></div>
              <small className="sub">{lessons.length} {labels.lesson.toLowerCase()} · {u.periods} {labels.period.toLowerCase()}</small>
              {editable && <span className="actions">
                <button type="button" onClick={() => move('curriculum_units', content.units, i, -1)} disabled={i === 0} aria-label="Lên">↑</button>
                <button type="button" onClick={() => move('curriculum_units', content.units, i, 1)} disabled={i === content.units.length - 1} aria-label="Xuống">↓</button>
                <button type="button" className="danger" onClick={() => removeUnit(u)} aria-label={`Xoá ${labels.unit}`}>×</button>
              </span>}
            </header>
            {isOpen && <>
              <div className="formgrid">
                <label className="field"><span>Khối</span>
                  {editable ? <select value={u.grade ?? ''} onChange={e => updUnit(u, { grade: e.target.value === '' ? null : Number(e.target.value) })}>
                    <option value="">—</option>{GRADES.map(g => <option key={g} value={g}>{gradeLabel(g)}</option>)}</select>
                    : <span className="cur-ro">{u.grade == null ? '—' : gradeLabel(u.grade)}</span>}</label>
                <label className="field"><span>Số {labels.period.toLowerCase()}</span><Cell label="Số tiết" type="number" value={u.periods} onSave={v => updUnit(u, { periods: num(v) })} disabled={!editable} /></label>
                <label className="field"><span>Môn chủ đạo</span>
                  {editable ? <select value={u.subject_main ?? ''} onChange={e => updUnit(u, { subject_main: e.target.value || null })}>
                    <option value="">—</option>{subjects.map(s => <option key={s.id} value={s.code}>{s.name}</option>)}</select>
                    : <span className="cur-ro">{catName(cat, 'subject', u.subject_main) || '—'}</span>}</label>
                <label className="field"><span>Yêu cầu phòng học</span>
                  {editable ? <select value={u.room_kind ?? ''} onChange={e => updUnit(u, { room_kind: e.target.value || null })}>
                    <option value="">—</option>{Object.entries(ROOM_KIND).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                    : <span className="cur-ro">{u.room_kind ? ROOM_KIND[u.room_kind] ?? u.room_kind : '—'}</span>}</label>
                <div className="field" style={{ gridColumn: '1 / -1' }}><span>Môn tích hợp</span>
                  <MultiPick label="Môn tích hợp" items={subjects.filter(s => s.code !== u.subject_main)} value={u.subjects_integrated} disabled={!editable}
                    onChange={v => updUnit(u, { subjects_integrated: v })} /></div>
                <label className="field" style={{ gridColumn: '1 / -1' }}><span>Mô tả / mục tiêu chung</span>
                  <Cell label="Mô tả chủ đề" multiline value={u.summary} onSave={v => updUnit(u, { summary: v.trim() || null })} disabled={!editable} /></label>
              </div>

              <table className="cur-lessons">
                <thead><tr><th>#</th><th>Mã</th><th>{labels.lesson}</th><th>Số {labels.period.toLowerCase()}</th><th>Phút/{labels.period.toLowerCase()}</th><th>Học liệu chính</th>{editable && <th></th>}</tr></thead>
                <tbody>
                  {lessons.map((l, j) => (
                    <LessonRow key={l.id} l={l} j={j} n={lessons.length} labels={labels} editable={editable} lib={lib}
                      upd={p => updLesson(l, p)} setPlan={p => setPlan(l, p)} remove={() => removeLesson(l)}
                      move={d => move('curriculum_lessons', lessons, j, d)} num={num} />
                  ))}
                  {lessons.length === 0 && <tr><td colSpan={7} className="sub">Chưa có {labels.lesson.toLowerCase()}.</td></tr>}
                </tbody>
              </table>
              {editable && <button type="button" className="linkbtn" onClick={() => addLesson(u)}>+ Thêm {labels.lesson.toLowerCase()}</button>}
            </>}
          </section>
        )
      })}
      {content.units.length === 0 && <p className="sub">Chưa có {labels.unit.toLowerCase()} nào.</p>}
      {editable && <button type="button" className="primary" onClick={addUnit}>+ Thêm {labels.unit.toLowerCase()}</button>}
    </div>
  )
}

function LessonRow({ l, j, n, labels, editable, lib, upd, setPlan, remove, move, num }: {
  l: Lesson; j: number; n: number; labels: Labels; editable: boolean; lib: Lib[]; upd: (p: Partial<Lesson>) => void
  setPlan: (p: PeriodRow[]) => void; remove: () => void; move: (d: -1 | 1) => void; num: (s: string) => number
}) {
  const [more, setMore] = useState(false)
  const plan = l.period_plan ?? []
  return (<>
    <tr>
      <td>{j + 1}</td>
      <td><Cell label="Mã bài" value={l.code} onSave={v => upd({ code: v.trim() || null })} disabled={!editable} width={60} /></td>
      <td><Cell label={`Tên ${labels.lesson}`} value={l.title} onSave={v => v.trim() && upd({ title: v.trim() })} disabled={!editable} />
        <button type="button" className="linkbtn" onClick={() => setMore(!more)}>{more ? 'Thu gọn' : `Chi tiết · kế hoạch ${labels.period.toLowerCase()}${plan.length ? ` (${plan.length})` : ''}`}</button></td>
      <td><Cell label="Số tiết" type="number" value={l.periods} onSave={v => upd({ periods: num(v) })} disabled={!editable} width={60} /></td>
      <td><Cell label="Phút mỗi tiết" type="number" value={l.minutes_per_period} onSave={v => upd({ minutes_per_period: Math.max(5, num(v)) })} disabled={!editable} width={60} /></td>
      <td>{editable ? <select value={l.library_item_id ?? ''} onChange={e => upd({ library_item_id: e.target.value || null })} aria-label="Học liệu chính">
        <option value="">—</option>{lib.map(x => <option key={x.id} value={x.id}>{x.title}</option>)}</select>
        : <span className="cur-ro">{lib.find(x => x.id === l.library_item_id)?.title ?? '—'}</span>}</td>
      {editable && <td className="actions">
        <button type="button" onClick={() => move(-1)} disabled={j === 0} aria-label="Lên">↑</button>
        <button type="button" onClick={() => move(1)} disabled={j === n - 1} aria-label="Xuống">↓</button>
        <button type="button" className="danger" onClick={remove} aria-label="Xoá bài">×</button></td>}
    </tr>
    {more && <tr className="cur-sub"><td></td><td colSpan={editable ? 6 : 5}>
      <label className="field"><span>Mô tả</span><Cell label="Mô tả bài" multiline value={l.summary} onSave={v => upd({ summary: v.trim() || null })} disabled={!editable} /></label>
      <b>Kế hoạch {labels.period.toLowerCase()}</b>
      <ol className="cur-plan">
        {plan.map((p, k) => (
          <li key={k}>
            <Cell label={`Nội dung ${labels.period} ${k + 1}`} value={p.title} disabled={!editable} onSave={v => setPlan(plan.map((x, y) => y === k ? { ...x, title: v } : x))} />
            <Cell label="Phút" type="number" value={p.minutes ?? null} width={60} disabled={!editable} onSave={v => setPlan(plan.map((x, y) => y === k ? { ...x, minutes: num(v) || undefined } : x))} />
            {editable && <button type="button" className="danger" aria-label="Xoá dòng" onClick={() => setPlan(plan.filter((_, y) => y !== k))}>×</button>}
          </li>
        ))}
      </ol>
      {editable && <button type="button" className="linkbtn" onClick={() => setPlan([...plan, { title: `${labels.period} ${plan.length + 1}`, minutes: l.minutes_per_period }])}>+ Thêm {labels.period.toLowerCase()}</button>}
      <label className="field"><span>Ghi chú</span><Cell label="Ghi chú" multiline value={l.notes} onSave={v => upd({ notes: v.trim() || null })} disabled={!editable} /></label>
    </td></tr>}
  </>)
}
