import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { Cell } from './Structure'
import { catName, catOf, errText, type Assessment, type CatItem, type Content, type Criterion, type Labels, type Outcome } from './api'

type Comp = { key: string; name: string; grp: string }
type Rubric = { id: string; title: string; criteria: { name?: string; title?: string; levels?: string[] }[] }
// Phạm vi: cả chương trình, một chủ đề, hoặc một bài học
type Where = { unit_id: string | null; lesson_id: string | null }
const whereKey = (w: Where) => `${w.unit_id ?? ''}/${w.lesson_id ?? ''}`

// Chuẩn đầu ra / yêu cầu cần đạt + tiêu chí đánh giá & minh chứng, theo từng cấp của chương trình
export function OutcomesEditor({ versionId, content, cat, labels, editable, reload, setMsg }: {
  versionId: string; content: Content; cat: CatItem[]; labels: Labels; editable: boolean; reload: () => void; setMsg: (m: string) => void
}) {
  const [comps, setComps] = useState<Comp[]>([])
  const [rubrics, setRubrics] = useState<Rubric[]>([])
  const [where, setWhere] = useState<Where>({ unit_id: null, lesson_id: null })
  useEffect(() => {
    supabase.from('competencies').select('key, name, grp').eq('audience', 'student').order('sort').then(({ data }) => setComps((data as Comp[]) ?? []))
    supabase.from('rubrics').select('id, title, criteria').order('title').then(({ data }) => setRubrics((data as Rubric[]) ?? []))
  }, [])
  const run = async (p: PromiseLike<{ error: { message: string } | null }>) => { const { error } = await p; if (error) setMsg(errText(error.message)); else { setMsg(''); reload() } }
  const same = (x: Where) => whereKey(x) === whereKey(where)
  const outcomes = content.outcomes.filter(o => same(o))
  const assessments = content.assessments.filter(a => same(a))
  const allOutcomes = content.outcomes
  const types = catOf(cat, 'outcome_type'), methods = catOf(cat, 'assessment_method'), subjects = catOf(cat, 'subject')
  const count = (w: Where) => content.outcomes.filter(o => whereKey(o) === whereKey(w)).length + content.assessments.filter(a => whereKey(a) === whereKey(w)).length
  const scopeName = (o: Where) => o.lesson_id ? content.lessons.find(l => l.id === o.lesson_id)?.title : o.unit_id ? content.units.find(u => u.id === o.unit_id)?.title : 'Cả chương trình'

  const addOutcome = () => run(supabase.from('curriculum_outcomes').insert({ version_id: versionId, ...where, seq: (outcomes[outcomes.length - 1]?.seq ?? 0) + 1,
    kind: types[0]?.code ?? null, description: 'Yêu cầu cần đạt mới' }))
  const updO = (o: Outcome, p: Partial<Outcome>) => run(supabase.from('curriculum_outcomes').update(p).eq('id', o.id))
  const addAssess = () => run(supabase.from('curriculum_assessments').insert({ version_id: versionId, ...where, seq: (assessments[assessments.length - 1]?.seq ?? 0) + 1,
    title: 'Tiêu chí đánh giá mới', method: methods[0]?.code ?? null }))
  const updA = (a: Assessment, p: Partial<Assessment>) => run(supabase.from('curriculum_assessments').update(p).eq('id', a.id))
  function applyRubric(a: Assessment, id: string) {
    const r = rubrics.find(x => x.id === id)
    const criteria: Criterion[] = (r?.criteria ?? []).map(c => ({ name: c.name ?? c.title ?? '', levels: [...(c.levels ?? []), '', '', '', ''].slice(0, 4) }))
    updA(a, { rubric_id: id || null, ...(r && a.criteria.length === 0 ? { criteria } : {}) })
  }

  return (
    <div className="cur-outcomes">
      <aside className="cur-scope" aria-label="Phạm vi">
        <button type="button" className={same({ unit_id: null, lesson_id: null }) ? 'on' : ''} onClick={() => setWhere({ unit_id: null, lesson_id: null })}>
          Cả chương trình <small>{count({ unit_id: null, lesson_id: null }) || ''}</small></button>
        {content.units.map((u, i) => (
          <div key={u.id}>
            <button type="button" className={same({ unit_id: u.id, lesson_id: null }) ? 'on' : ''} onClick={() => setWhere({ unit_id: u.id, lesson_id: null })}>
              {labels.unit} {i + 1}. {u.title} <small>{count({ unit_id: u.id, lesson_id: null }) || ''}</small></button>
            {content.lessons.filter(l => l.unit_id === u.id).map(l => (
              <button type="button" key={l.id} className={'cur-indent' + (same({ unit_id: u.id, lesson_id: l.id }) ? ' on' : '')} onClick={() => setWhere({ unit_id: u.id, lesson_id: l.id })}>
                {l.title} <small>{count({ unit_id: u.id, lesson_id: l.id }) || ''}</small></button>
            ))}
          </div>
        ))}
      </aside>
      <div className="cur-grow">
        <h3>Chuẩn đầu ra / yêu cầu cần đạt — {scopeName(where)}</h3>
        <table>
          <thead><tr><th>Loại</th><th>Môn</th><th>Mô tả</th><th>Năng lực (CT GDPT 2018)</th>{editable && <th></th>}</tr></thead>
          <tbody>
            {outcomes.map(o => (
              <tr key={o.id}>
                <td>{editable ? <select value={o.kind ?? ''} onChange={e => updO(o, { kind: e.target.value || null })} aria-label="Loại">
                  <option value="">—</option>{types.map(t => <option key={t.id} value={t.code}>{t.name}</option>)}</select> : catName(cat, 'outcome_type', o.kind) || '—'}</td>
                <td>{editable ? <select value={o.subject ?? ''} onChange={e => updO(o, { subject: e.target.value || null })} aria-label="Môn">
                  <option value="">—</option>{subjects.map(t => <option key={t.id} value={t.code}>{t.name}</option>)}</select> : catName(cat, 'subject', o.subject) || '—'}</td>
                <td className="cur-grow"><Cell label="Mô tả chuẩn đầu ra" multiline value={o.description} disabled={!editable} onSave={v => v.trim() && updO(o, { description: v.trim() })} /></td>
                <td>{editable ? <select value={o.competency_key ?? ''} onChange={e => updO(o, { competency_key: e.target.value || null })} aria-label="Năng lực">
                  <option value="">—</option>{comps.map(c => <option key={c.key} value={c.key}>{c.name}</option>)}</select> : comps.find(c => c.key === o.competency_key)?.name ?? '—'}</td>
                {editable && <td><button type="button" className="danger" aria-label="Xoá" onClick={() => confirm('Xoá chuẩn đầu ra này?') && run(supabase.from('curriculum_outcomes').delete().eq('id', o.id))}>×</button></td>}
              </tr>
            ))}
            {outcomes.length === 0 && <tr><td colSpan={5} className="sub">Chưa có chuẩn đầu ra ở cấp này.</td></tr>}
          </tbody>
        </table>
        {editable && <button type="button" className="linkbtn" onClick={addOutcome}>+ Thêm chuẩn đầu ra</button>}

        <h3>Tiêu chí đánh giá & minh chứng — {scopeName(where)}</h3>
        {assessments.map(a => (
          <div className="panel cur-assess" key={a.id}>
            <div className="formgrid">
              <label className="field" style={{ gridColumn: 'span 2' }}><span>Tên</span><Cell label="Tên tiêu chí" value={a.title} disabled={!editable} onSave={v => v.trim() && updA(a, { title: v.trim() })} /></label>
              <label className="field"><span>Hình thức</span>{editable ? <select value={a.method ?? ''} onChange={e => updA(a, { method: e.target.value || null })}>
                <option value="">—</option>{methods.map(t => <option key={t.id} value={t.code}>{t.name}</option>)}</select> : <span className="cur-ro">{catName(cat, 'assessment_method', a.method) || '—'}</span>}</label>
              <label className="field"><span>Trọng số (%)</span><Cell label="Trọng số" type="number" value={a.weight} disabled={!editable} onSave={v => updA(a, { weight: v === '' ? null : Math.min(100, Number(v)) })} /></label>
              <label className="field" style={{ gridColumn: 'span 2' }}><span>Mẫu tiêu chí (rubric)</span>{editable ? <select value={a.rubric_id ?? ''} onChange={e => applyRubric(a, e.target.value)}>
                <option value="">— Tự đặt tiêu chí —</option>{rubrics.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}</select>
                : <span className="cur-ro">{rubrics.find(r => r.id === a.rubric_id)?.title ?? 'Tự đặt'}</span>}</label>
              <label className="field" style={{ gridColumn: 'span 2' }}><span>Minh chứng cần thu</span><Cell label="Minh chứng" value={a.evidence} disabled={!editable} onSave={v => updA(a, { evidence: v.trim() || null })} /></label>
              <div className="field" style={{ gridColumn: '1 / -1' }}><span>Chuẩn đầu ra được đánh giá</span>
                <div className="cur-chips">
                  {allOutcomes.filter(o => !o.unit_id || o.unit_id === a.unit_id || !a.unit_id).map(o => {
                    const on = a.outcome_ids.includes(o.id)
                    return <button type="button" key={o.id} className={'chip' + (on ? ' on' : '')} aria-pressed={on} disabled={!editable}
                      onClick={() => updA(a, { outcome_ids: on ? a.outcome_ids.filter(x => x !== o.id) : [...a.outcome_ids, o.id] })}>{o.description.slice(0, 60)}</button>
                  })}
                  {allOutcomes.length === 0 && <span className="sub">Thêm chuẩn đầu ra trước.</span>}
                </div></div>
            </div>
            <table className="cur-criteria">
              <thead><tr><th>Tiêu chí</th><th>Mức 1</th><th>Mức 2</th><th>Mức 3</th><th>Mức 4</th>{editable && <th></th>}</tr></thead>
              <tbody>
                {a.criteria.map((c, k) => (
                  <tr key={k}>
                    <td><Cell label="Tên tiêu chí" value={c.name} disabled={!editable} onSave={v => updA(a, { criteria: a.criteria.map((x, y) => y === k ? { ...x, name: v } : x) })} /></td>
                    {[0, 1, 2, 3].map(m => <td key={m}><Cell label={`Mức ${m + 1}`} value={c.levels?.[m] ?? ''} disabled={!editable}
                      onSave={v => updA(a, { criteria: a.criteria.map((x, y) => y === k ? { ...x, levels: [0, 1, 2, 3].map(z => z === m ? v : x.levels?.[z] ?? '') } : x) })} /></td>)}
                    {editable && <td><button type="button" className="danger" aria-label="Xoá tiêu chí" onClick={() => updA(a, { criteria: a.criteria.filter((_, y) => y !== k) })}>×</button></td>}
                  </tr>
                ))}
              </tbody>
            </table>
            {editable && <div className="actions">
              <button type="button" className="linkbtn" onClick={() => updA(a, { criteria: [...a.criteria, { name: 'Tiêu chí mới', levels: ['', '', '', ''] }] })}>+ Thêm dòng tiêu chí</button>
              <button type="button" className="danger" onClick={() => confirm(`Xoá “${a.title}”?`) && run(supabase.from('curriculum_assessments').delete().eq('id', a.id))}>Xoá đánh giá</button>
            </div>}
          </div>
        ))}
        {assessments.length === 0 && <p className="sub">Chưa có tiêu chí đánh giá ở cấp này.</p>}
        {editable && <button type="button" className="linkbtn" onClick={addAssess}>+ Thêm tiêu chí đánh giá</button>}
      </div>
    </div>
  )
}
