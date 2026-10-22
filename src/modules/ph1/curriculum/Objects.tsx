import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { Empty, Pill } from '../ui'
import { catName, catOf, errText, gradeLabel, gradesOfLevel, levelOfGrade, type CatItem, type Content, type Lesson, type Unit } from './api'

// Đối tượng của chương trình: Cấp học › Khối › Môn học › Bài học (tên bài, số buổi, số tiết).
// Môn của một khối = dòng curriculum_subjects (môn × khối); bài học nằm trong chủ đề cùng môn · khối
// (chủ đề tạo tự động khi thêm bài, chỉnh chi tiết ở "Nội dung chi tiết").
type Node = { subject: string; grade: number; periods_total: number | null; subjectId: string | null; units: Unit[]; lessons: Lesson[] }

export function ObjectsEditor({ versionId, content, cat, editable, reload, setMsg }: {
  versionId: string; content: Content; cat: CatItem[]; editable: boolean; reload: () => void; setMsg: (m: string) => void
}) {
  const [extra, setExtra] = useState<number[]>([])                 // khối vừa thêm, chưa có môn
  const [addLv, setAddLv] = useState(''); const [addG, setAddG] = useState('')
  const [addSub, setAddSub] = useState<Record<number, string>>({})
  const [draft, setDraft] = useState<Record<string, { title: string; sessions: number; periods: number }>>({})
  const run = async (p: PromiseLike<{ error: { message: string } | null }>) => { const { error } = await p; if (error) { setMsg(errText(error.message)); return false } setMsg(''); reload(); return true }

  // Gom môn × khối từ khai báo môn và từ chủ đề đã có
  const nodes = new Map<string, Node>()
  const key = (s: string, g: number) => `${g}|${s}`
  content.subjects.forEach(s => nodes.set(key(s.subject, s.grade), { subject: s.subject, grade: s.grade, periods_total: s.periods_total, subjectId: s.id, units: [], lessons: [] }))
  content.units.filter(u => u.subject_main && u.grade != null).forEach(u => {
    const k = key(u.subject_main!, u.grade!); const n = nodes.get(k) ?? { subject: u.subject_main!, grade: u.grade!, periods_total: null, subjectId: null, units: [], lessons: [] }
    n.units.push(u); n.lessons.push(...content.lessons.filter(l => l.unit_id === u.id)); nodes.set(k, n)
  })
  const loose = content.units.filter(u => !u.subject_main || u.grade == null)
  const grades = Array.from(new Set([...[...nodes.values()].map(n => n.grade), ...extra])).sort((a, b) => a - b)
  const levels = Array.from(new Set(grades.map(g => levelOfGrade(cat, g))))
  const levelOrder = catOf(cat, 'level').map(l => l.code)
  levels.sort((a, b) => levelOrder.indexOf(a) - levelOrder.indexOf(b))

  async function addSubject(g: number) {
    const s = addSub[g]; if (!s) return setMsg('Chọn môn học.')
    if (nodes.has(key(s, g))) return setMsg('Môn này đã có ở khối này.')
    if (await run(supabase.from('curriculum_subjects').insert({ version_id: versionId, subject: s, grade: g, seq: content.subjects.length + 1, periods_total: 0, periods_per_week: 1 })))
      setAddSub({ ...addSub, [g]: '' })
  }
  async function addLesson(n: Node) {
    const k = key(n.subject, n.grade); const d = draft[k]; if (!d?.title.trim()) return setMsg('Nhập tên bài.')
    let unitId = n.units[n.units.length - 1]?.id
    if (!unitId) {
      const { data, error } = await supabase.from('curriculum_units').insert({ version_id: versionId, seq: content.units.length + 1,
        title: `${catName(cat, 'subject', n.subject)} ${gradeLabel(n.grade)}`, subject_main: n.subject, grade: n.grade, periods: 0 }).select('id').single()
      if (error) return setMsg(errText(error.message))
      unitId = (data as { id: string }).id
    }
    const seq = Math.max(0, ...content.lessons.filter(l => l.unit_id === unitId).map(l => l.seq)) + 1
    if (await run(supabase.from('curriculum_lessons').insert({ version_id: versionId, unit_id: unitId, seq, title: d.title.trim(), sessions: d.sessions, periods: d.periods })))
      setDraft({ ...draft, [k]: { title: '', sessions: 1, periods: 2 } })
  }
  const updLesson = (l: Lesson, p: Partial<Lesson>) => run(supabase.from('curriculum_lessons').update(p).eq('id', l.id))
  async function removeSubject(n: Node) {
    if (!confirm(`Bỏ môn ${catName(cat, 'subject', n.subject)} khỏi ${gradeLabel(n.grade)} cùng ${n.lessons.length} bài học?`)) return
    if (n.subjectId) { const r = await supabase.from('curriculum_subjects').delete().eq('id', n.subjectId); if (r.error) return setMsg(errText(r.error.message)) }
    if (n.units.length) await run(supabase.from('curriculum_units').delete().in('id', n.units.map(u => u.id))); else reload()
  }

  const lvGrades = addLv ? gradesOfLevel(cat, addLv).filter(g => !grades.includes(g)) : []
  return (
    <div className="p1-obj">
      {editable && <div className="p1-objadd">
        <b>Thêm khối</b>
        <select value={addLv} onChange={e => { setAddLv(e.target.value); setAddG('') }} aria-label="Cấp học"><option value="">Cấp học…</option>
          {catOf(cat, 'level').map(l => <option key={l.code} value={l.code}>{l.name}</option>)}</select>
        <select value={addG} disabled={!addLv} onChange={e => setAddG(e.target.value)} aria-label="Khối"><option value="">Khối…</option>
          {lvGrades.map(g => <option key={g} value={g}>{gradeLabel(g)}</option>)}</select>
        <button type="button" disabled={!addG} onClick={() => { setExtra([...extra, Number(addG)]); setAddG('') }}>+ Thêm</button>
        <small className="sub">Khối chỉ chọn trong cấp học (Danh mục › Khối).</small>
      </div>}
      {!grades.length && <Empty>Chương trình chưa có khối nào{editable ? ' — chọn Cấp học › Khối ở trên để bắt đầu.' : '.'}</Empty>}
      {levels.map(lv => <section key={lv} className="p1-objlv">
        <h3><span className="p1-objtag">Cấp học</span>{catName(cat, 'level', lv) || lv}</h3>
        {grades.filter(g => levelOfGrade(cat, g) === lv).map(g => { const ns = [...nodes.values()].filter(n => n.grade === g)
          const used = new Set(ns.map(n => n.subject))
          return <div key={g} className="p1-objgrade">
            <h4><span className="p1-objtag">Khối</span>{gradeLabel(g)}
              <small>{ns.length} môn · {ns.reduce((a, n) => a + n.lessons.length, 0)} bài · {ns.reduce((a, n) => a + n.lessons.reduce((x, l) => x + l.sessions, 0), 0)} buổi · {ns.reduce((a, n) => a + n.lessons.reduce((x, l) => x + l.periods, 0), 0)} tiết</small></h4>
            {ns.map(n => { const k = key(n.subject, n.grade); const d = draft[k] ?? { title: '', sessions: 1, periods: 2 }
              const p = n.lessons.reduce((a, l) => a + l.periods, 0)
              return <div key={k} className="p1-objsub">
                <div className="head"><span className="p1-objtag">Môn</span><b>{catName(cat, 'subject', n.subject)}</b>
                  <small>{n.lessons.length} bài · {n.lessons.reduce((a, l) => a + l.sessions, 0)} buổi · {p} tiết</small>
                  {n.periods_total ? <Pill tone={p === n.periods_total ? 'good' : 'warn'}>quy định {n.periods_total} tiết</Pill> : null}
                  {editable && <button type="button" className="danger" onClick={() => removeSubject(n)}>Bỏ môn</button>}</div>
                <table className="p1-table">
                  <thead><tr><th style={{ width: 44 }}>#</th><th>Tên bài</th><th style={{ width: 110 }}>Số buổi</th><th style={{ width: 110 }}>Số tiết</th>{editable && <th style={{ width: 70 }}></th>}</tr></thead>
                  <tbody>
                    {n.lessons.map((l, i) => <tr key={l.id}><td className="sub">{i + 1}</td>
                      {editable ? <>
                        <td><input defaultValue={l.title} aria-label="Tên bài" onBlur={e => e.target.value.trim() && e.target.value !== l.title && updLesson(l, { title: e.target.value.trim() })} /></td>
                        <td><input type="number" min={1} defaultValue={l.sessions} aria-label="Số buổi" onBlur={e => Number(e.target.value) !== l.sessions && updLesson(l, { sessions: Math.max(1, Number(e.target.value) || 1) })} /></td>
                        <td><input type="number" min={0} defaultValue={l.periods} aria-label="Số tiết" onBlur={e => Number(e.target.value) !== l.periods && updLesson(l, { periods: Math.max(0, Number(e.target.value) || 0) })} /></td>
                        <td><button type="button" className="danger" aria-label="Xoá bài" onClick={() => confirm(`Xoá bài “${l.title}”?`) && run(supabase.from('curriculum_lessons').delete().eq('id', l.id))}>Xoá</button></td>
                      </> : <><td>{l.title}</td><td>{l.sessions}</td><td>{l.periods}</td></>}
                    </tr>)}
                    {!n.lessons.length && <tr><td colSpan={5} className="sub">Chưa có bài học.</td></tr>}
                    {editable && <tr className="p1-objnew"><td className="sub">+</td>
                      <td><input value={d.title} placeholder="Tên bài mới" onChange={e => setDraft({ ...draft, [k]: { ...d, title: e.target.value } })} onKeyDown={e => e.key === 'Enter' && addLesson(n)} /></td>
                      <td><input type="number" min={1} value={d.sessions} aria-label="Số buổi" onChange={e => setDraft({ ...draft, [k]: { ...d, sessions: Number(e.target.value) || 1 } })} /></td>
                      <td><input type="number" min={0} value={d.periods} aria-label="Số tiết" onChange={e => setDraft({ ...draft, [k]: { ...d, periods: Number(e.target.value) || 0 } })} /></td>
                      <td><button type="button" className="primary" onClick={() => addLesson(n)}>Thêm</button></td></tr>}
                  </tbody>
                </table>
              </div> })}
            {!ns.length && <p className="sub">Khối chưa có môn.</p>}
            {editable && <div className="p1-objadd">
              <select value={addSub[g] ?? ''} onChange={e => setAddSub({ ...addSub, [g]: e.target.value })} aria-label="Môn học"><option value="">Môn học…</option>
                {catOf(cat, 'subject').filter(s => !used.has(s.code)).map(s => <option key={s.id} value={s.code}>{s.name}</option>)}</select>
              <button type="button" onClick={() => addSubject(g)}>+ Thêm môn vào {gradeLabel(g)}</button>
            </div>}
          </div> })}
      </section>)}
      {loose.length > 0 && <div className="p1-alert warn">Có {loose.length} chủ đề chưa gắn môn / khối — mở “Nội dung chi tiết” để gắn.</div>}
    </div>
  )
}
