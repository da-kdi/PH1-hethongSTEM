import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { Empty, Pill } from '../ui'
import { MSTATUS, catName, catOf, errText, inUseOf, newerOf, type CatItem, type Content, type Lesson, type MVer, type Unit } from './api'

// Bài học của chương trình (062): Môn học › (Chủ đề/Chương — không bắt buộc) › Bài học.
// Mỗi bài: tên, số buổi, số tiết, học liệu chính (phiên bản đơn vị đang dùng). Không phân cấp học / khối — khối nằm ở Thông tin chương trình.
type Draft = { title: string; sessions: number; periods: number; unit: string }
const NEW: Draft = { title: '', sessions: 1, periods: 2, unit: '' }

export function LessonsEditor({ orgId, versionId, content, cat, grade, editable, reload, setMsg, onOpenMaterial }: {
  orgId: string; versionId: string; content: Content; cat: CatItem[]; grade: number | null; editable: boolean
  reload: () => void; setMsg: (m: string) => void; onOpenMaterial?: (lessonId: string) => void
}) {
  const [addSub, setAddSub] = useState('')
  const [draft, setDraft] = useState<Record<string, Draft>>({})
  const [vers, setVers] = useState<MVer[]>([])
  const [chosen, setChosen] = useState<Map<string, string>>(new Map())
  const run = async (p: PromiseLike<{ error: { message: string } | null }>) => { const { error } = await p; if (error) { setMsg(errText(error.message)); return false } setMsg(''); reload(); return true }

  // Học liệu của các bài (mọi phiên bản) + phiên bản đơn vị đang dùng
  const ids = content.lessons.map(l => l.id)
  useEffect(() => {
    if (!ids.length) { setVers([]); return }
    Promise.all([
      supabase.from('material_lessons').select('id, family_id, version_no, status, curriculum_lesson_id, set_id, title').in('curriculum_lesson_id', ids),
      supabase.from('material_in_use').select('family_id, lesson_id').eq('org_id', orgId),
    ]).then(([m, u]) => {
      setVers((m.data as MVer[]) ?? [])
      setChosen(new Map(((u.data as { family_id: string; lesson_id: string }[]) ?? []).map(x => [x.family_id, x.lesson_id])))
    })
  }, [ids.join(','), orgId])

  // Môn của chương trình: khai báo môn + môn có bài / chủ đề
  const subjects = Array.from(new Set([...content.subjects.map(s => s.subject), ...content.lessons.map(l => l.subject), ...content.units.map(u => u.subject_main)]
    .filter(Boolean) as string[]))
  const loose = content.lessons.filter(l => !l.subject)
  const unitsOf = (s: string) => content.units.filter(u => u.subject_main === s).sort((a, b) => a.seq - b.seq)
  // Thứ tự hiển thị trong môn: theo chủ đề rồi đến bài không thuộc chủ đề
  const ordered = (s: string) => {
    const us = unitsOf(s); const ls = content.lessons.filter(l => l.subject === s).sort((a, b) => a.seq - b.seq)
    return [...us.flatMap(u => ls.filter(l => l.unit_id === u.id)), ...ls.filter(l => !l.unit_id || !us.some(u => u.id === l.unit_id))]
  }

  async function addSubject() {
    if (!addSub) return setMsg('Chọn môn học.')
    if (subjects.includes(addSub)) return setMsg('Môn này đã có trong chương trình.')
    if (await run(supabase.from('curriculum_subjects').insert({ version_id: versionId, subject: addSub, grade: grade ?? 0, seq: content.subjects.length + 1, periods_total: 0, periods_per_week: 1 })))
      setAddSub('')
  }
  async function removeSubject(s: string) {
    const ls = content.lessons.filter(l => l.subject === s)
    if (!confirm(`Bỏ môn ${catName(cat, 'subject', s)} cùng ${ls.length} bài học và các chủ đề của môn?`)) return
    const a = await supabase.from('curriculum_lessons').delete().eq('version_id', versionId).eq('subject', s); if (a.error) return setMsg(errText(a.error.message))
    const b = await supabase.from('curriculum_units').delete().eq('version_id', versionId).eq('subject_main', s); if (b.error) return setMsg(errText(b.error.message))
    run(supabase.from('curriculum_subjects').delete().eq('version_id', versionId).eq('subject', s))
  }
  async function addUnit(s: string) {
    const title = prompt(`Tên chủ đề/chương mới của môn ${catName(cat, 'subject', s)}:`); if (!title?.trim()) return
    run(supabase.from('curriculum_units').insert({ version_id: versionId, seq: Math.max(0, ...content.units.map(u => u.seq)) + 1, title: title.trim(), subject_main: s, grade, periods: 0 }))
  }
  async function removeUnit(u: Unit) {
    if (!confirm(`Xoá chủ đề/chương “${u.title}”? Bài học trong chủ đề được giữ lại, nằm thẳng dưới môn.`)) return
    run(supabase.from('curriculum_units').delete().eq('id', u.id))
  }
  async function addLesson(s: string) {
    const d = draft[s] ?? NEW; if (!d.title.trim()) return setMsg('Nhập tên bài.')
    const seq = Math.max(0, ...content.lessons.filter(l => l.subject === s).map(l => l.seq)) + 1
    if (await run(supabase.from('curriculum_lessons').insert({ version_id: versionId, subject: s, unit_id: d.unit || null, seq, title: d.title.trim(), sessions: Math.max(1, d.sessions), periods: Math.max(0, d.periods) })))
      setDraft({ ...draft, [s]: { ...NEW, unit: d.unit } })
  }
  const upd = (l: Lesson, p: Partial<Lesson>) => run(supabase.from('curriculum_lessons').update(p).eq('id', l.id))
  // Đổi chỗ với bài liền kề trong cùng nhóm (cùng chủ đề hoặc cùng "không thuộc chủ đề")
  async function move(l: Lesson, list: Lesson[], d: -1 | 1) {
    const grp = list.filter(x => (x.unit_id ?? '') === (l.unit_id ?? '')); const k = grp.findIndex(x => x.id === l.id); const o = grp[k + d]
    if (!o) return
    const a = await supabase.from('curriculum_lessons').update({ seq: o.seq }).eq('id', l.id); if (a.error) return setMsg(errText(a.error.message))
    run(supabase.from('curriculum_lessons').update({ seq: l.seq === o.seq ? l.seq + d : l.seq }).eq('id', o.id))
  }

  // Ô "Học liệu chính": phiên bản đơn vị đang dùng
  const material = (l: Lesson) => {
    const fam = vers.find(v => v.curriculum_lesson_id === l.id)?.family_id
    const cur = fam ? inUseOf(vers, fam, chosen) : null
    const newer = newerOf(vers, cur)
    const pill = !cur ? <Pill>Chưa có{editable || onOpenMaterial ? ' · + Tạo' : ''}</Pill>
      : cur.status === 'published' ? <Pill tone="good">Đủ · PB {cur.version_no}</Pill>
      : <Pill tone={MSTATUS[cur.status][1] || 'warn'}>{cur.status === 'draft' ? 'Đang soạn' : MSTATUS[cur.status][0]} · PB {cur.version_no}</Pill>
    return <>{onOpenMaterial ? <button type="button" className="linkbtn" onClick={() => onOpenMaterial(l.id)} title="Mở học liệu của bài">{pill}</button> : pill}
      {newer && <> <Pill tone="info">có PB {newer.version_no}</Pill></>}</>
  }

  const table = (s: string) => {
    const list = ordered(s); const us = unitsOf(s); const d = draft[s] ?? NEW
    let n = 0
    const row = (l: Lesson) => { n++; return <tr key={l.id}>
      <td className="sub">{n}</td>
      {editable ? <>
        <td><input defaultValue={l.title} aria-label="Tên bài" onBlur={e => e.target.value.trim() && e.target.value !== l.title && upd(l, { title: e.target.value.trim() })} /></td>
        <td><input type="number" min={1} defaultValue={l.sessions} aria-label="Số buổi" onBlur={e => Number(e.target.value) !== l.sessions && upd(l, { sessions: Math.max(1, Number(e.target.value) || 1) })} /></td>
        <td><input type="number" min={0} defaultValue={l.periods} aria-label="Số tiết" onBlur={e => Number(e.target.value) !== l.periods && upd(l, { periods: Math.max(0, Number(e.target.value) || 0) })} /></td>
        {us.length > 0 && <td><select value={l.unit_id ?? ''} aria-label="Chủ đề/Chương" onChange={e => upd(l, { unit_id: e.target.value || null })}>
          <option value="">— không —</option>{us.map(u => <option key={u.id} value={u.id}>{u.title}</option>)}</select></td>}
      </> : <><td>{l.title}</td><td>{l.sessions}</td><td>{l.periods}</td></>}
      <td>{material(l)}</td>
      {editable && <td><span className="p1-rowact">
        <button type="button" aria-label="Lên" onClick={() => move(l, list, -1)}>↑</button><button type="button" aria-label="Xuống" onClick={() => move(l, list, 1)}>↓</button>
        <button type="button" className="danger" aria-label="Xoá bài" onClick={() => confirm(`Xoá bài “${l.title}”?`) && run(supabase.from('curriculum_lessons').delete().eq('id', l.id))}>Xoá</button></span></td>}
    </tr> }
    const cols = 5 + (editable ? 1 : 0) + (editable && us.length ? 1 : 0)
    const band = (key: string, label: React.ReactNode) => <tr key={key} className="p1-band"><td colSpan={cols}>{label}</td></tr>
    const inUnit = (u: Unit) => list.filter(l => l.unit_id === u.id)
    const free = list.filter(l => !l.unit_id || !us.some(u => u.id === l.unit_id))
    return <table className="p1-table">
      <thead><tr><th style={{ width: 40 }}>#</th><th>Tên bài</th><th style={{ width: 90 }}>Số buổi</th><th style={{ width: 90 }}>Số tiết</th>
        {editable && us.length > 0 && <th style={{ width: 170 }}>Chủ đề/Chương</th>}<th style={{ width: 190 }}>Học liệu chính</th>{editable && <th style={{ width: 150 }}></th>}</tr></thead>
      <tbody>
        {us.map(u => [band(u.id, <span className="p1-bandrow"><span className="p1-objtag">Chủ đề/Chương</span>
            {editable ? <input defaultValue={u.title} aria-label="Tên chủ đề" onBlur={e => e.target.value.trim() && e.target.value !== u.title && run(supabase.from('curriculum_units').update({ title: e.target.value.trim() }).eq('id', u.id))} />
              : <b>{u.title}</b>}
            <small className="sub">{inUnit(u).length} bài</small>
            {editable && <button type="button" className="danger" onClick={() => removeUnit(u)}>Xoá chủ đề</button>}</span>),
          ...inUnit(u).map(row)])}
        {us.length > 0 && free.length > 0 && band('_free', <span className="sub">Không thuộc chủ đề</span>)}
        {free.map(row)}
        {!list.length && <tr><td colSpan={cols} className="sub">Chưa có bài học.</td></tr>}
        {editable && <tr className="p1-objnew"><td className="sub">+</td>
          <td><input value={d.title} placeholder="Tên bài mới" onChange={e => setDraft({ ...draft, [s]: { ...d, title: e.target.value } })} onKeyDown={e => e.key === 'Enter' && addLesson(s)} /></td>
          <td><input type="number" min={1} value={d.sessions} aria-label="Số buổi" onChange={e => setDraft({ ...draft, [s]: { ...d, sessions: Number(e.target.value) || 1 } })} /></td>
          <td><input type="number" min={0} value={d.periods} aria-label="Số tiết" onChange={e => setDraft({ ...draft, [s]: { ...d, periods: Number(e.target.value) || 0 } })} /></td>
          {us.length > 0 && <td><select value={d.unit} aria-label="Chủ đề/Chương" onChange={e => setDraft({ ...draft, [s]: { ...d, unit: e.target.value } })}>
            <option value="">— không —</option>{us.map(u => <option key={u.id} value={u.id}>{u.title}</option>)}</select></td>}
          <td></td>
          <td><button type="button" className="primary" onClick={() => addLesson(s)}>Thêm bài</button></td></tr>}
      </tbody>
    </table>
  }

  return (
    <div className="p1-obj">
      {!subjects.length && <Empty>Chương trình chưa có môn học{editable ? ' — chọn môn ở dưới để bắt đầu.' : '.'}</Empty>}
      {subjects.map(s => { const ls = content.lessons.filter(l => l.subject === s)
        return <div key={s} className="p1-objsub">
          <div className="head"><span className="p1-objtag">Môn</span><b>{catName(cat, 'subject', s)}</b>
            <small>{ls.length} bài · {ls.reduce((a, l) => a + l.sessions, 0)} buổi · {ls.reduce((a, l) => a + l.periods, 0)} tiết</small>
            {editable && <span className="p1-rowact" style={{ marginLeft: 'auto' }}>
              <button type="button" onClick={() => addUnit(s)}>+ Chủ đề/Chương</button>
              <button type="button" className="danger" onClick={() => removeSubject(s)}>Bỏ môn</button></span>}</div>
          {table(s)}
        </div> })}
      {loose.length > 0 && <div className="p1-alert warn">Có {loose.length} bài chưa gắn môn: {loose.map(l => l.title).join(', ')}.</div>}
      {editable && <div className="p1-objadd">
        <select value={addSub} onChange={e => setAddSub(e.target.value)} aria-label="Môn học"><option value="">Môn học…</option>
          {catOf(cat, 'subject').filter(s => !subjects.includes(s.code)).map(s => <option key={s.id} value={s.code}>{s.name}</option>)}</select>
        <button type="button" onClick={addSubject}>+ Thêm môn</button>
        <small className="sub">Cùng một môn mà khác khối thì tạo chương trình riêng.</small>
      </div>}
    </div>
  )
}
