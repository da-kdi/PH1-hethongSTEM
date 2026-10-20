import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { Pill, Section, Empty } from '../ui'
import { Cell } from './Structure'
import { GRADES, catName, catOf, errText, gradeLabel, type CatItem, type Content, type Subject } from './api'

// Môn học thuộc chương trình: môn × khối × thời lượng quy định. Một môn dùng được ở nhiều chương trình, quy định riêng từng chương trình.
// Đối chiếu tổng tiết quy định với tổng tiết các chủ đề đã soạn cho môn / khối đó.
export function SubjectsEditor({ versionId, content, cat, editable, reload, setMsg, onOpen }: {
  versionId: string; content: Content; cat: CatItem[]; editable: boolean; reload: () => void; setMsg: (m: string) => void
  onOpen?: (subject: string, grade: number) => void
}) {
  const [subject, setSubject] = useState(''); const [grade, setGrade] = useState(6)
  const subjects = catOf(cat, 'subject')
  const run = async (p: PromiseLike<{ error: { message: string } | null }>) => { const { error } = await p; if (error) setMsg(errText(error.message)); else { setMsg(''); reload() } }
  const upd = (s: Subject, patch: Partial<Subject>) => run(supabase.from('curriculum_subjects').update(patch).eq('id', s.id))
  const actual = (s: Subject) => content.units.filter(u => u.subject_main === s.subject && u.grade === s.grade).reduce((a, u) => a + u.periods, 0)
  const units = (s: Subject) => content.units.filter(u => u.subject_main === s.subject && u.grade === s.grade).length
  async function add() {
    if (!subject) return setMsg('Chọn môn học.')
    await run(supabase.from('curriculum_subjects').insert({ version_id: versionId, subject, grade, seq: content.subjects.length + 1, periods_total: 0, periods_per_week: 1 }))
  }
  // Môn / khối có chủ đề nhưng chưa khai báo thời lượng
  const undeclared = Array.from(new Set(content.units.filter(u => u.subject_main && u.grade != null
    && !content.subjects.some(s => s.subject === u.subject_main && s.grade === u.grade)).map(u => `${u.subject_main}|${u.grade}`)))
  const total = content.subjects.reduce((a, s) => a + s.periods_total, 0)

  return (
    <Section title={`Môn học & thời lượng · ${content.subjects.length} môn – khối · ${total} tiết`}>
      {undeclared.length > 0 && <div className="p1-alert warn">Có chủ đề thuộc môn / khối chưa khai báo thời lượng: {undeclared.map(k => { const [s, g] = k.split('|'); return `${catName(cat, 'subject', s)} ${gradeLabel(Number(g))}` }).join(', ')}.</div>}
      {content.subjects.length === 0 ? <Empty>Chưa khai báo môn học nào cho chương trình này.</Empty> : (
        <table className="p1-table">
          <thead><tr><th>Môn học</th><th>Khối</th><th>Tổng tiết / năm</th><th>Tiết / tuần</th><th>Loại</th><th>Đã soạn theo chủ đề</th>{editable && <th></th>}</tr></thead>
          <tbody>
            {content.subjects.map(s => {
              const a = actual(s), d = a - s.periods_total
              return (
                <tr key={s.id}>
                  <td><b>{catName(cat, 'subject', s.subject)}</b></td>
                  <td>{gradeLabel(s.grade)}</td>
                  <td style={{ width: 120 }}><Cell label="Tổng tiết" type="number" value={s.periods_total} disabled={!editable} onSave={v => upd(s, { periods_total: Math.max(0, Number(v) || 0) })} /></td>
                  <td style={{ width: 110 }}><Cell label="Tiết mỗi tuần" type="number" value={s.periods_per_week} disabled={!editable} onSave={v => upd(s, { periods_per_week: v === '' ? null : Number(v) })} /></td>
                  <td>{editable ? <select value={s.is_required ? '1' : '0'} onChange={e => upd(s, { is_required: e.target.value === '1' })} aria-label="Loại">
                    <option value="1">Bắt buộc</option><option value="0">Tự chọn</option></select> : s.is_required ? 'Bắt buộc' : 'Tự chọn'}</td>
                  <td>
                    <button type="button" className="linkbtn" onClick={() => onOpen?.(s.subject, s.grade)}>{units(s)} chủ đề · {a} tiết</button>{' '}
                    {s.periods_total > 0 && (d === 0 ? <Pill tone="good">Khớp</Pill> : d < 0 ? <Pill tone="warn">Thiếu {-d} tiết</Pill> : <Pill tone="bad">Thừa {d} tiết</Pill>)}
                  </td>
                  {editable && <td><button type="button" className="danger" aria-label="Xoá môn" onClick={() => confirm('Bỏ môn / khối này khỏi chương trình? Chủ đề vẫn giữ.') && run(supabase.from('curriculum_subjects').delete().eq('id', s.id))}>×</button></td>}
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      {editable && <div className="p1-actions" style={{ marginTop: 12 }}>
        <select value={subject} onChange={e => setSubject(e.target.value)} aria-label="Môn"><option value="">+ Thêm môn học…</option>{subjects.map(s => <option key={s.id} value={s.code}>{s.name}</option>)}</select>
        <select value={grade} onChange={e => setGrade(Number(e.target.value))} aria-label="Khối">{GRADES.map(g => <option key={g} value={g}>{gradeLabel(g)}</option>)}</select>
        <button type="button" className="primary" onClick={add}>Thêm</button>
      </div>}
    </Section>
  )
}
