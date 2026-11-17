import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { errMsg, norm } from '../ui'
import { catName, type CatItem, type Curriculum } from '../curriculum/api'
import { DataTable } from '../mau/DataTable'
import { Confirm, Empty, FRow, Ic, Panel, Sel, StatusPill } from '../mau/kit'
import { LV, type Lv } from './qimport'

// Bản mẫu v315 · E-learning: tab “Nội dung cần ôn” (bảng review_topics, 069) và “Ngân hàng câu hỏi” (question_bank)
type RT = { id: string; org_id: string; curriculum_id: string | null; lesson_id: string | null; subject: string | null; grade: number | null; title: string; points: string[]; status: string; updated_at: string }
type CL = { id: string; version_id: string; subject: string | null; title: string; seq: number }
export type BQ = { id: string; org_id: string; subject: string; grade: number | null; topic: string | null; level: Lv; kind: string; stem: string; status: string; created_at: string }
const KIND: Record<string, string> = { single: 'Một đáp án', multi: 'Nhiều đáp án', truefalse: 'Đúng / Sai', short: 'Điền khuyết', essay: 'Tự luận' }
const QST: Record<string, string> = { ready: 'Đã duyệt', draft: 'Chờ duyệt', retired: 'Ngừng dùng' }
const vnd = (s: string) => new Date(s).toLocaleDateString('vi-VN')

export function ReviewTab({ orgId, cat, progs, bank, creating, onCreated }: { orgId: string | null; cat: CatItem[]; progs: Curriculum[]; bank: BQ[]; creating: boolean; onCreated: () => void }) {
  const [rows, setRows] = useState<RT[]>([])
  const [cls, setCls] = useState<CL[]>([])
  const [q, setQ] = useState(''); const [fp, setFp] = useState(''); const [fs, setFs] = useState('')
  const [edit, setEdit] = useState<Partial<RT> | null>(null)
  const [msg, setMsg] = useState('')
  const [ask, setAsk] = useState<RT[] | null>(null)
  const load = async () => {
    const { data, error } = await supabase.from('review_topics').select('*').order('title'); if (error) return setMsg(errMsg(error.message))
    setRows((data as RT[]) ?? [])
    const vids = progs.map(p => p.current_version_id).filter(Boolean) as string[]
    if (vids.length) { const r = await supabase.from('curriculum_lessons').select('id, version_id, subject, title, seq').in('version_id', vids).order('seq'); setCls((r.data as CL[]) ?? []) }
  }
  useEffect(() => { load() }, [orgId, progs.length])
  useEffect(() => { if (creating) setEdit({ title: '', points: [], status: 'draft' }) }, [creating])
  const progOf = (r: RT) => progs.find(p => p.id === r.curriculum_id) ?? null
  const lessonOf = (r: RT) => cls.find(l => l.id === r.lesson_id) ?? null
  const qn = (r: RT) => bank.filter(b => norm(b.topic ?? '') === norm(r.title)).length
  const shown = rows.filter(r => (!q || norm(r.title).includes(norm(q))) && (!fp || r.curriculum_id === fp) && (!fs || r.status === fs))
  const setSt = (status: string, label: string) => async (rs: RT[]) => { const { error } = await supabase.from('review_topics').update({ status }).in('id', rs.map(r => r.id)); if (error) return errMsg(error.message); await load(); return `${label} ${rs.length} nội dung ôn` }
  async function save() {
    if (!edit) return; const e = edit; if (!e.title?.trim()) return setMsg('Nhập tên nội dung ôn')
    const l = cls.find(x => x.id === e.lesson_id); const p = l ? progs.find(x => x.current_version_id === l.version_id) : progs.find(x => x.id === e.curriculum_id)
    const row = { title: e.title.trim(), lesson_id: l?.id ?? null, curriculum_id: p?.id ?? e.curriculum_id ?? null, subject: l?.subject ?? e.subject ?? null, grade: p?.grades[0] ?? null, points: (e.points ?? []).filter(Boolean), status: e.status ?? 'draft' }
    const r = e.id ? await supabase.from('review_topics').update(row).eq('id', e.id) : await supabase.from('review_topics').insert({ ...row, org_id: orgId })
    if (r.error) return setMsg(errMsg(r.error.message)); setEdit(null); onCreated(); setMsg('Đã lưu nội dung ôn.'); load()
  }
  const lessonOpts = progs.flatMap(p => cls.filter(l => l.version_id === p.current_version_id).map(l => [l.id, `${p.code ?? ''} · ${catName(cat, 'subject', l.subject ?? '')} · ${l.title}`] as [string, string]))
  return <>
    {msg && <p className="okmsg" role="status" onClick={() => setMsg('')}>{msg}</p>}
    {ask && <Confirm danger text={`Xoá ${ask.length} nội dung ôn? Câu hỏi trong ngân hàng được giữ lại.`} yes="Xoá" onNo={() => setAsk(null)} onYes={async () => { const ids = ask.map(r => r.id); setAsk(null); const { error } = await supabase.from('review_topics').delete().in('id', ids); setMsg(error ? errMsg(error.message) : `Đã xoá ${ids.length} nội dung ôn`); load() }} />}
    {edit && <Panel icon="edit" title={edit.id ? 'Sửa nội dung ôn' : 'Nội dung ôn mới'} act={<button type="button" className="btn sm ghost" onClick={() => { setEdit(null); onCreated() }}>Đóng</button>}>
      <div className="form">
        <label className="fld"><span>Bài học liên quan</span><select value={edit.lesson_id ?? ''} onChange={e => { const l = cls.find(x => x.id === e.target.value); setEdit({ ...edit, lesson_id: e.target.value || null, title: edit.title || (l ? 'Ôn tập: ' + l.title : '') }) }}>
          <option value="">Chọn bài học…</option>{lessonOpts.map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select></label>
        <label className="fld"><span>Tên nội dung ôn</span><input value={edit.title ?? ''} onChange={e => setEdit({ ...edit, title: e.target.value })} placeholder="VD: Ôn tập: Thước đo tự chế" /></label>
        <label className="fld wide"><span>Ý chính <small className="sub">mỗi ý một dòng</small></span><textarea rows={4} value={(edit.points ?? []).join('\n')} onChange={e => setEdit({ ...edit, points: e.target.value.split('\n') })} /></label>
        <small className="sub">Câu hỏi trong Ngân hàng câu hỏi có “Chủ đề” trùng tên nội dung ôn sẽ được tính vào nội dung này.</small>
      </div>
      <div className="formact"><button type="button" className="btn ghost" onClick={() => { setEdit(null); onCreated() }}>Huỷ</button><button type="button" className="btn primary" onClick={save}><Ic n="check" /> Lưu</button></div></Panel>}
    <DataTable id="el-review" rows={shown} rowKey={r => r.id} noun="nội dung ôn" onOpen={r => setEdit(r)} fold
      search={{ value: q, onChange: setQ, placeholder: 'Tìm nội dung ôn…' }}
      filterBox={<><FRow label="Chương trình"><Sel label="Tất cả chương trình" value={fp} onChange={setFp} options={progs.map(p => [p.id, `${p.code ?? ''} · ${p.name}`])} /></FRow>
        <FRow label="Trạng thái"><Sel label="Mọi trạng thái" value={fs} onChange={setFs} options={[['draft', 'Nháp'], ['published', 'Đã phát hành'], ['archived', 'Ngừng dùng']]} /></FRow></>}
      fcount={[fp, fs].filter(Boolean).length} onClearFilters={() => { setFp(''); setFs('') }}
      groupBy={r => { const p = progOf(r); const rs = shown.filter(x => x.curriculum_id === r.curriculum_id)
        return [r.curriculum_id ?? '_', p ? <><span className="pcd">{p.code}</span><div className="ptit"><b>{p.name}</b></div><small className="pmeta">{rs.length} nội dung ôn · {rs.reduce((a, x) => a + qn(x), 0)} câu hỏi</small></> : <div className="ptit"><b>Chưa gắn chương trình</b></div>, p?.color ?? null] }}
      subBy={r => [r.subject ?? '', <><span className="tag">Môn</span> <b className="hpname">{catName(cat, 'subject', r.subject ?? '') || '—'}</b></>]}
      bulk={[{ label: 'Phát hành', run: setSt('published', 'Đã phát hành') }, { label: 'Ngừng dùng', run: setSt('archived', 'Đã ngừng dùng') }]} onDelete={rs => setAsk(rs)}
      empty={<Empty>Chưa có nội dung ôn — bấm “Nội dung ôn” để tạo theo bài học.</Empty>}
      cols={[
        { key: 'title', label: 'Nội dung cần ôn', name: true, sort: r => r.title, cell: r => <b>{r.title}</b> },
        { key: 'lesson', label: 'Bài học liên quan', sort: r => lessonOf(r)?.title ?? null, cell: r => lessonOf(r)?.title ?? '—' },
        { key: 'pts', label: 'Ý chính', sum: 'sum', sort: r => r.points.length, cell: r => r.points.length },
        { key: 'qs', label: 'Câu hỏi', sum: 'sum', sort: qn, cell: qn },
        { key: 'date', label: 'Cập nhật', date: true, sort: r => vnd(r.updated_at), cell: r => vnd(r.updated_at) },
        { key: 'status', label: 'Trạng thái', sum: 'status', sort: r => r.status, cell: r => <StatusPill s={r.status} /> },
      ]} />
  </>
}

export function BankTab({ cat, bank, reload, onNew }: { cat: CatItem[]; bank: BQ[]; reload: () => void; onNew: () => void }) {
  const [q, setQ] = useState(''); const [f, setF] = useState({ subj: '', lv: '', kind: '', st: '' })
  const [ask, setAsk] = useState<BQ[] | null>(null); const [msg, setMsg] = useState('')
  const code = new Map([...bank].sort((a, b) => a.created_at.localeCompare(b.created_at)).map((b, i) => [b.id, 'Q' + String(i + 1).padStart(4, '0')]))
  const shown = bank.filter(b => (!q || norm(b.stem + ' ' + (b.topic ?? '')).includes(norm(q))) && (!f.subj || b.subject === f.subj) && (!f.lv || b.level === f.lv) && (!f.kind || b.kind === f.kind) && (!f.st || b.status === f.st))
  const setSt = (status: string, label: string) => async (rs: BQ[]) => { const { error } = await supabase.from('question_bank').update({ status }).in('id', rs.map(r => r.id)); if (error) return errMsg(error.message); reload(); return `${label} ${rs.length} câu` }
  return <>
    {msg && <p className="okmsg" role="status">{msg}</p>}
    {ask && <Confirm danger text={`Xoá ${ask.length} câu hỏi khỏi ngân hàng? Đề cố định đang dùng câu này sẽ bỏ câu đó.`} yes="Xoá" onNo={() => setAsk(null)} onYes={async () => { const ids = ask.map(r => r.id); setAsk(null); const { error } = await supabase.from('question_bank').delete().in('id', ids); setMsg(error ? errMsg(error.message) : `Đã xoá ${ids.length} câu`); reload() }} />}
    <DataTable id="el-bank" rows={shown} rowKey={b => b.id} noun="câu hỏi" onOpen={onNew}
      search={{ value: q, onChange: setQ, placeholder: 'Tìm câu hỏi, nội dung ôn…' }}
      filterBox={<><FRow label="Môn"><Sel label="Tất cả môn" value={f.subj} onChange={v => setF({ ...f, subj: v })} options={[...new Set(bank.map(b => b.subject))].map(s => [s, catName(cat, 'subject', s) || s])} /></FRow>
        <FRow label="Mức độ"><Sel label="Mọi mức độ" value={f.lv} onChange={v => setF({ ...f, lv: v })} options={Object.entries(LV)} /></FRow>
        <FRow label="Dạng"><Sel label="Mọi dạng" value={f.kind} onChange={v => setF({ ...f, kind: v })} options={Object.entries(KIND)} /></FRow>
        <FRow label="Trạng thái"><Sel label="Mọi trạng thái" value={f.st} onChange={v => setF({ ...f, st: v })} options={Object.entries(QST)} /></FRow></>}
      fcount={Object.values(f).filter(Boolean).length} onClearFilters={() => setF({ subj: '', lv: '', kind: '', st: '' })}
      filters={{ q, ...f }} onFilters={x => { setQ(x.q ?? ''); setF({ subj: x.subj ?? '', lv: x.lv ?? '', kind: x.kind ?? '', st: x.st ?? '' }) }}
      bulk={[{ label: 'Duyệt', run: setSt('ready', 'Đã duyệt') }, { label: 'Ngừng dùng', run: setSt('retired', 'Đã ngừng dùng') }]} onDelete={rs => setAsk(rs)}
      empty={<Empty>Chưa có câu hỏi — bấm “Thêm câu hỏi”.</Empty>}
      cols={[
        { key: 'code', label: 'Mã', width: '84px', sort: b => code.get(b.id), cell: b => code.get(b.id) },
        { key: 'stem', label: 'Câu hỏi', name: true, sort: b => b.stem, cell: b => <b>{b.stem}</b> },
        { key: 'kind', label: 'Dạng', sort: b => KIND[b.kind] ?? b.kind, cell: b => KIND[b.kind] ?? b.kind },
        { key: 'lv', label: 'Mức độ', sort: b => LV[b.level], cell: b => LV[b.level] },
        { key: 'topic', label: 'Nội dung ôn', sort: b => b.topic ?? null, cell: b => b.topic || '—' },
        { key: 'date', label: 'Ngày tạo', date: true, sort: b => vnd(b.created_at), cell: b => vnd(b.created_at) },
        { key: 'status', label: 'Trạng thái', sum: 'status', sort: b => QST[b.status] ?? b.status, cell: b => <span className={'pill plain ' + (b.status === 'ready' ? 'good' : b.status === 'draft' ? 'warn' : 'draft')}>{QST[b.status] ?? b.status}</span> },
      ]} />
  </>
}
