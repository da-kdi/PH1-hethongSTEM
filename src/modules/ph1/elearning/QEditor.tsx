// Trình soạn câu hỏi (bản mẫu v315 · C5 qEditor): tạo câu hỏi mới hoặc nhập file câu hỏi có sẵn (Word / Excel, có file mẫu), lưu vào ngân hàng câu hỏi (question_bank).
// Chi tiết đề luyện: câu hỏi theo nội dung đã thiết lập hiện ra để thêm / bớt; phần câu hỏi tách riêng bên dưới, thu gọn theo mức độ.
import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { errMsg } from '../ui'
import { catName, type CatItem } from '../curriculum/api'
import { Back, Confirm, Empty, Ic, Panel, StatusPill } from '../mau/kit'
import { LV, fileToQText, qParse, qTemplate, type Lv, type PQ } from './qimport'

type BQ = { id: string; subject: string; grade: number | null; topic: string | null; level: Lv; kind: string; stem: string; options: string[]; answer: number[]; status: string }
export type Exam = { id: string; org_id: string; title: string; subject: string | null; grade: number | null; mode: string; question_ids: string[]; criteria: { count?: number; topics?: string[]; levels?: Partial<Record<Lv, number>> } | null; status: string; closes_at?: string | null; updated_at?: string }
const LVS = Object.keys(LV) as Lv[]

export function QEditor({ orgId, subject, grade, subjects, onClose, onSaved }: { orgId: string; subject: string; grade: number | null; subjects: [string, string][]
  onClose: () => void; onSaved: (ids: string[]) => void }) {
  const [mode, setMode] = useState<'paste' | 'form'>('paste')
  const [meta, setMeta] = useState({ subject, grade: grade ? String(grade) : '', topic: '', lv: 'thong_hieu' as Lv })
  const [text, setText] = useState('')
  const [added, setAdded] = useState<PQ[]>([])
  const [f, setF] = useState({ type: 'single' as PQ['type'], text: '', opts: ['', '', '', ''], ans: [] as number[], expl: '', lv: 'thong_hieu' as Lv })
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  const parsed = useMemo(() => [...qParse(text, meta.lv), ...added], [text, meta.lv, added])
  const ok = parsed.filter(q => !q.err)
  async function load(fl: File) { try { const t = await fileToQText(fl); setText(x => (x.trim() ? x.trim() + '\n\n' : '') + t); setMode('paste'); setMsg(`Đã đọc file “${fl.name}” — kiểm tra phần xem trước rồi lưu.`) } catch (e) { setMsg((e as Error).message) } }
  function addForm() {
    const opts = f.type === 'truefalse' ? ['Đúng', 'Sai'] : f.opts.map(o => o.trim()).filter(Boolean)
    const q: PQ = { text: f.text.trim(), opts, ans: f.ans.filter(i => i < opts.length), key: '', expl: f.expl.trim(), lv: f.lv, type: f.type === 'single' && f.ans.length > 1 ? 'multi' : f.type, err: '' }
    q.err = !q.text ? 'Thiếu nội dung câu hỏi' : opts.length < 2 ? 'Cần ít nhất 2 phương án' : !q.ans.length ? 'Chọn đáp án đúng' : ''
    if (q.err) return setMsg(q.err)
    setAdded(a => [...a, q]); setF({ ...f, text: '', opts: ['', '', '', ''], ans: [], expl: '' }); setMsg('Đã thêm câu vào danh sách bên dưới.')
  }
  async function save() {
    if (!ok.length) return setMsg('Chưa có câu hợp lệ để lưu.')
    if (!meta.subject.trim()) return setMsg('Chọn môn học cho câu hỏi.')
    const g = Number(meta.grade); setBusy(true)
    const { data, error } = await supabase.from('question_bank').insert(ok.map(q => ({ org_id: orgId, subject: meta.subject, grade: g >= 1 && g <= 12 ? g : null, topic: meta.topic.trim() || null, level: q.lv,
      kind: q.type, stem: q.text, options: q.opts, answer: q.ans, explain: q.expl || null, source: added.includes(q) ? 'manual' : 'import', status: 'ready' }))).select('id')
    setBusy(false)
    if (error) return setMsg(errMsg(error.message))
    onSaved(((data as { id: string }[]) ?? []).map(x => x.id))
  }
  return <Panel icon="edit" title="Thêm câu hỏi" act={<button type="button" className="btn sm ghost" onClick={onClose}>Đóng</button>} className="qeditor">
    <div className="form qemeta">
      <label className="fld"><span>Môn học</span><select value={meta.subject} onChange={e => setMeta({ ...meta, subject: e.target.value })}><option value="">Chọn môn…</option>{subjects.map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select></label>
      <label className="fld"><span>Khối</span><select value={meta.grade} onChange={e => setMeta({ ...meta, grade: e.target.value })}><option value="">—</option>{Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>Khối {i + 1}</option>)}</select></label>
      <label className="fld"><span>Chủ đề</span><input value={meta.topic} onChange={e => setMeta({ ...meta, topic: e.target.value })} placeholder="Tuỳ chọn" /></label>
      <label className="fld"><span>Mức độ mặc định</span><select value={meta.lv} onChange={e => setMeta({ ...meta, lv: e.target.value as Lv })}>{LVS.map(l => <option key={l} value={l}>{LV[l]}</option>)}</select></label>
    </div>
    <div className="tabs" role="tablist"><button type="button" role="tab" className={mode === 'paste' ? 'on' : ''} onClick={() => setMode('paste')}>Dán / nhập file</button>
      <button type="button" role="tab" className={mode === 'form' ? 'on' : ''} onClick={() => setMode('form')}>Soạn từng câu</button>
      <span className="tabact" style={{ display: 'flex', gap: 6 }}><button type="button" className="btn sm" onClick={() => qTemplate('docx')}><Ic n="file" /> File mẫu Word</button><button type="button" className="btn sm" onClick={() => qTemplate('xlsx')}><Ic n="file" /> File mẫu Excel</button></span></div>
    {mode === 'paste' ? <div className="qein">
      <div className="toolbar"><button type="button" className="btn sm primary" onClick={() => file.current?.click()}><Ic n="upload" /> Nhập file Word / Excel</button>
        <input ref={file} type="file" hidden accept=".docx,.xlsx,.csv,.txt" onChange={e => { const fl = e.target.files?.[0]; if (fl) load(fl); e.target.value = '' }} />
        <small className="sub">Mỗi câu bắt đầu “Câu 1:”, phương án A. B. C. D., đáp án đúng đánh * phía trước (Word: gạch chân hoặc tô đỏ) hoặc dòng “Đáp án: B”.</small></div>
      <textarea className="qetext" value={text} onChange={e => setText(e.target.value)} placeholder={'Câu 1: Nước sôi ở bao nhiêu độ C?\nA. 90\n*B. 100\nC. 110\nMức độ: Nhận biết'} aria-label="Nội dung câu hỏi" />
    </div> : <div className="qein form">
      <label className="fld"><span>Loại câu</span><select value={f.type} onChange={e => setF({ ...f, type: e.target.value as PQ['type'], ans: [] })}><option value="single">Một đáp án</option><option value="multi">Nhiều đáp án</option><option value="truefalse">Đúng / Sai</option></select></label>
      <label className="fld"><span>Mức độ</span><select value={f.lv} onChange={e => setF({ ...f, lv: e.target.value as Lv })}>{LVS.map(l => <option key={l} value={l}>{LV[l]}</option>)}</select></label>
      <label className="fld wide"><span>Nội dung câu hỏi</span><textarea value={f.text} onChange={e => setF({ ...f, text: e.target.value })} /></label>
      {(f.type === 'truefalse' ? ['Đúng', 'Sai'] : f.opts).map((o, i) => <label key={i} className="fld qeopt"><span>{String.fromCharCode(65 + i)}</span>
        <input type={f.type === 'multi' ? 'checkbox' : 'radio'} name="qeans" checked={f.ans.includes(i)} aria-label="Đáp án đúng" onChange={() => setF({ ...f, ans: f.type === 'multi' ? (f.ans.includes(i) ? f.ans.filter(x => x !== i) : [...f.ans, i]) : [i] })} />
        {f.type === 'truefalse' ? <b>{o}</b> : <input value={o} onChange={e => setF({ ...f, opts: f.opts.map((x, k) => k === i ? e.target.value : x) })} placeholder={'Phương án ' + String.fromCharCode(65 + i)} />}</label>)}
      {f.type !== 'truefalse' && f.opts.length < 8 && <button type="button" className="btn sm ghost" onClick={() => setF({ ...f, opts: [...f.opts, ''] })}><Ic n="plus" /> Phương án</button>}
      <label className="fld wide"><span>Giải thích</span><input value={f.expl} onChange={e => setF({ ...f, expl: e.target.value })} /></label>
      <div className="formact"><button type="button" className="btn" onClick={addForm}><Ic n="plus" /> Thêm câu</button></div>
    </div>}
    {msg && <p className="okmsg" role="status">{msg}</p>}
    <div className="qeout"><div className="qeouth"><b>Xem trước</b><small className="sub">{ok.length}/{parsed.length} câu hợp lệ</small>
      <button type="button" className="btn sm primary" style={{ marginLeft: 'auto' }} disabled={busy || !ok.length} onClick={save}><Ic n="check" /> Lưu {ok.length} câu vào ngân hàng</button></div>
      {!parsed.length ? <Empty>Dán nội dung, nhập file hoặc soạn từng câu — câu hỏi hiện ở đây.</Empty>
        : <ol className="qelist">{parsed.map((q, i) => <li key={i} className={q.err ? 'bad' : ''}><b>{q.text}</b> <span className="pill plain">{LV[q.lv]}</span>
          {q.opts.length > 0 && <ul>{q.opts.map((o, k) => <li key={k} className={q.ans.includes(k) ? 'ok' : ''}>{String.fromCharCode(65 + k)}. {o}</li>)}</ul>}
          {q.err && <small className="qeerr"><Ic n="alert" /> {q.err}</small>}
          {added.includes(q) && <button type="button" className="btn sm ghost" onClick={() => setAdded(a => a.filter(x => x !== q))}>Bỏ</button>}</li>)}</ol>}
    </div>
  </Panel>
}

// Chi tiết đề luyện: câu hỏi tách riêng bên dưới, thu gọn theo mức độ; thêm/bớt câu theo nội dung đã thiết lập (môn, khối, chủ đề)
export function ExamDetail({ e, orgId, cat, canEdit, subjects, onBack, reload }: { e: Exam; orgId: string; cat: CatItem[]; canEdit: boolean; subjects: [string, string][]; onBack: () => void; reload: () => Promise<void> }) {
  const [bank, setBank] = useState<BQ[]>([])
  const [editing, setEditing] = useState(false)
  const [shut, setShut] = useState<Set<string>>(new Set(['pool']))
  const [msg, setMsg] = useState('')
  const [ask, setAsk] = useState(false)
  const loadBank = async () => { let q = supabase.from('question_bank').select('id, subject, grade, topic, level, kind, stem, options, answer, status').eq('status', 'ready').limit(2000)
    if (e.subject) q = q.eq('subject', e.subject); const { data } = await q; setBank(((data as BQ[]) ?? []).filter(x => !e.grade || !x.grade || x.grade === e.grade)) }
  useEffect(() => { loadBank() }, [e.id])
  const fixed = e.mode === 'fixed'
  const topics = e.criteria?.topics ?? []
  const fit = bank.filter(q => !topics.length || topics.includes(q.topic ?? ''))   // câu theo nội dung đã thiết lập
  const inExam = fixed ? e.question_ids.map(id => bank.find(q => q.id === id)).filter(Boolean) as BQ[] : fit
  const pool = fixed ? fit.filter(q => !e.question_ids.includes(q.id)) : []
  const setIds = async (ids: string[], note: string) => { const { error } = await supabase.from('practice_exams').update({ question_ids: ids }).eq('id', e.id); if (error) return setMsg(errMsg(error.message)); setMsg(note); await reload() }
  const tog = (k: string) => setShut(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n })
  const qRow = (q: BQ, i: number, act?: React.ReactNode) => <li key={q.id}><span className="qno">{i + 1}</span><div><b>{q.stem}</b>
    <small className="sub">{q.options.map((o, k) => (q.answer.includes(k) ? '✓ ' : '') + String.fromCharCode(65 + k) + '. ' + o).join('   ')}</small></div>{act}</li>
  const setStatus = async (status: string) => { const { error } = await supabase.from('practice_exams').update({ status }).eq('id', e.id); if (error) return setMsg(errMsg(error.message)); setMsg(status === 'published' ? 'Đã phát hành đề.' : 'Đã đóng đề.'); await reload() }
  return <>
    <Back onClick={onBack} title={e.title}>Tất cả đề luyện</Back>
    <div className="dhead"><span className="code" style={{ ['--c' as string]: 'var(--primary)' }}>Đề</span><div><h1>{e.title}</h1><span className="crumb">{catName(cat, 'subject', e.subject) || e.subject || '—'}{e.grade ? ` · Khối ${e.grade}` : ''} · {fixed ? 'Đề cố định' : `Đề ngẫu nhiên ${e.criteria?.count ?? inExam.length} câu`}</span></div><StatusPill s={e.status} />
      {canEdit && <div className="act">{e.status !== 'published' && <button type="button" className="btn primary" onClick={() => setStatus('published')}><Ic n="send" /> Phát hành</button>}
        {e.status === 'published' && <button type="button" className="btn" onClick={() => setAsk(true)}>Đóng đề</button>}
        <button type="button" className="btn" onClick={() => setEditing(true)}><Ic n="plus" /> Câu hỏi mới / nhập file</button></div>}</div>
    {ask && <Confirm text="Đóng đề? Học sinh không làm tiếp được." yes="Đóng đề" onNo={() => setAsk(false)} onYes={() => { setAsk(false); setStatus('closed') }} />}
    {msg && <p className="okmsg" role="status">{msg}</p>}
    {editing && <QEditor orgId={orgId} subject={e.subject ?? ''} grade={e.grade} subjects={subjects} onClose={() => setEditing(false)}
      onSaved={async ids => { setEditing(false); await loadBank(); if (fixed) await setIds([...e.question_ids, ...ids], `Đã lưu ${ids.length} câu vào ngân hàng và thêm vào đề.`); else setMsg(`Đã lưu ${ids.length} câu vào ngân hàng — đề ngẫu nhiên tự lấy theo nội dung đã thiết lập.`) }} />}
    <Panel icon="list" title={<>Câu hỏi trong đề <small className="sub">{inExam.length} câu</small></>} act={!fixed && <small className="sub">Đề ngẫu nhiên: mỗi lượt làm lấy {e.criteria?.count ?? '?'} câu từ các câu dưới đây{topics.length ? ` (chủ đề: ${topics.join(', ')})` : ''}</small>}>
      {!inExam.length ? <Empty>Chưa có câu hỏi. {canEdit && 'Bấm “Câu hỏi mới / nhập file” hoặc thêm từ ngân hàng bên dưới.'}</Empty>
        : LVS.filter(l => inExam.some(q => q.level === l)).map(l => { const qs = inExam.filter(q => q.level === l)
          return <details key={l} className="qpart" open={!shut.has(l)} onToggle={ev => { if ((ev.currentTarget as HTMLDetailsElement).open === shut.has(l)) tog(l) }}>
            <summary><span className="chev"><Ic n="chev" /></span><b>{LV[l]}</b><small className="sub">{qs.length} câu</small></summary>
            <ol className="qlist">{qs.map((q, i) => qRow(q, i, fixed && canEdit && <button type="button" className="btn sm ghost" onClick={() => setIds(e.question_ids.filter(x => x !== q.id), 'Đã bỏ câu khỏi đề.')}>Bỏ</button>))}</ol></details> })}
    </Panel>
    {fixed && <details className="panel qpart" open={!shut.has('pool')} onToggle={ev => { if ((ev.currentTarget as HTMLDetailsElement).open === shut.has('pool')) tog('pool') }}>
      <summary><span className="chev"><Ic n="chev" /></span><b>Thêm từ ngân hàng theo nội dung đã thiết lập</b><small className="sub">{pool.length} câu cùng môn{e.grade ? ', khối' : ''}{topics.length ? ', chủ đề' : ''}</small></summary>
      {!pool.length ? <Empty>Không còn câu phù hợp trong ngân hàng.</Empty> : <ol className="qlist">{pool.map((q, i) => qRow(q, i, canEdit && <button type="button" className="btn sm" onClick={() => setIds([...e.question_ids, q.id], 'Đã thêm câu vào đề.')}><Ic n="plus" /> Thêm</button>))}</ol>}
    </details>}
  </>
}
