import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { Tabs } from '../../../pages/teacher/common'
import { Code, Empty, Pill, Section, Stat, Tree, errMsg, useRpcBool, type TreeNode } from '../ui'
import { catName, catOf, effectiveCatalog, gradeLabel, useCatalog, useOrgs, type CatItem, type Curriculum } from '../curriculum/api'

type MSet = { id: string; owner_org_id: string; code: string | null; name: string; curriculum_id: string | null; version_id: string | null; subject: string | null
  grade: number | null; description: string | null; status: string; version_no: number; updated_at: string }
export type MLesson = { id: string; set_id: string; curriculum_lesson_id: string | null; seq: number; code: string | null; title: string; periods: number; sessions: number
  objectives: string | null; subject_main: string | null; subjects_integrated: string[]; product_requirements: string | null
  steps: Step[]; criteria: { name: string; levels: string[] }[]; notes: string | null }
export type Step = { session?: number; title: string; minutes?: number; teacher?: string; student?: string; product?: string }
export type Norm = { id: string; lesson_id: string; seq: number; category: string; name: string; spec: string | null; unit: string; qty: number; basis: string; consumable: boolean; substitute: string | null }
type File = { id: string; lesson_id: string; seq: number; kind: string; title: string; url: string | null }

export const BASIS: Record<string, string> = { per_product: 'mỗi sản phẩm', per_group: 'mỗi nhóm', per_student: 'mỗi học sinh', per_class: 'mỗi lớp' }
export const NORM_CAT: Record<string, string> = { vat_tu: 'Nguyên vật liệu', dung_cu: 'Dụng cụ', thiet_bi: 'Thiết bị dùng chung' }
const FILE_KIND: Record<string, string> = { giao_an: 'Giáo án / KHBD', huong_dan: 'Hướng dẫn giáo viên', phieu_hoc_tap: 'Phiếu học tập', hinh_anh: 'Hình ảnh', video: 'Video', tham_khao: 'Tài liệu tham khảo' }
const SET_STATUS: Record<string, [string, '' | 'good' | 'warn' | 'info']> = { draft: ['Bản nháp', ''], review: ['Đang thẩm định', 'warn'], published: ['Đã phát hành', 'good'], archived: ['Ngừng dùng', ''] }

// Số lượng cần cho một lớp: theo sản phẩm (= số sản phẩm), theo nhóm, theo học sinh, theo lớp
export const needQty = (n: Pick<Norm, 'qty' | 'basis'>, students: number, groups: number, products: number) =>
  n.qty * (n.basis === 'per_product' ? products : n.basis === 'per_group' ? groups : n.basis === 'per_student' ? students : 1)

// 1.1.2 Học liệu: bộ tài liệu theo chương trình / môn / khối → bài học (hoạt động, sản phẩm mẫu, tiêu chí) + tài liệu + định mức vật tư
export function MaterialsPage({ orgId }: { orgId: string | null }) {
  const [sets, setSets] = useState<MSet[]>([])
  const [progs, setProgs] = useState<Curriculum[]>([])
  const [lessons, setLessons] = useState<MLesson[]>([])
  const [sel, setSel] = useState<string | null>(null)       // 'set:<id>' | 'lesson:<id>'
  const [msg, setMsg] = useState('')
  const canManage = useRpcBool('curriculum_can_manage')
  const { all, hidden } = useCatalog()
  const { below } = useOrgs(orgId)
  const cat = effectiveCatalog(all, hidden, below)

  async function load() {
    const [s, c, l] = await Promise.all([
      supabase.from('material_sets').select('*').order('name'),
      supabase.from('curricula').select('*').order('code'),
      supabase.from('material_lessons').select('id, set_id, seq, title, periods, curriculum_lesson_id').order('seq'),
    ])
    if (s.error) return setMsg(errMsg(s.error.message))
    setSets((s.data as MSet[]) ?? []); setProgs((c.data as Curriculum[]) ?? []); setLessons((l.data as MLesson[]) ?? [])
    if (!sel && s.data?.length) setSel('set:' + (s.data[0] as MSet).id)
  }
  useEffect(() => { load() }, [orgId])

  // Cây: chương trình → môn · khối → bộ học liệu → bài
  const tree: TreeNode[] = useMemo(() => {
    const groups = new Map<string, MSet[]>()
    sets.forEach(s => groups.set(s.curriculum_id ?? '_', [...(groups.get(s.curriculum_id ?? '_') ?? []), s]))
    const nodes: TreeNode[] = []
    for (const [cid, ss] of groups) {
      const c = progs.find(p => p.id === cid)
      const bySg = new Map<string, MSet[]>()
      ss.forEach(s => bySg.set(`${s.subject ?? ''}|${s.grade ?? ''}`, [...(bySg.get(`${s.subject ?? ''}|${s.grade ?? ''}`) ?? []), s]))
      nodes.push({ id: 'prog:' + cid, color: c?.color ?? '#94a3b8', label: c ? <><b>{c.code}</b> · {c.name}</> : 'Chưa gắn chương trình', meta: `${ss.length} bộ học liệu`,
        children: [...bySg.entries()].map(([k, list]) => {
          const [sub, g] = k.split('|')
          return { id: 'sg:' + cid + k, label: `${catName(cat, 'subject', sub) || 'Môn khác'} · ${g ? gradeLabel(Number(g)) : 'mọi khối'}`,
            children: list.map(s => ({ id: 'set:' + s.id, label: s.name, meta: `${lessons.filter(l => l.set_id === s.id).length} bài · ${SET_STATUS[s.status]?.[0] ?? s.status}`,
              children: lessons.filter(l => l.set_id === s.id).map(l => ({ id: 'lesson:' + l.id, label: l.title, meta: `${l.periods} tiết` })) })) }
        }) })
    }
    return nodes
  }, [sets, progs, lessons, cat])

  async function newSet() {
    const name = prompt('Tên bộ học liệu mới:'); if (!name || !orgId) return
    const { data, error } = await supabase.from('material_sets').insert({ owner_org_id: orgId, name, status: 'draft' }).select('id').single()
    if (error) return setMsg(errMsg(error.message))
    await load(); setSel('set:' + (data as { id: string }).id)
  }
  const [kind, id] = (sel ?? ':').split(':')
  const set = kind === 'set' ? sets.find(s => s.id === id) : kind === 'lesson' ? sets.find(s => s.id === lessons.find(l => l.id === id)?.set_id) : undefined

  return (
    <>
      <div className="p1-stats">
        <Stat label="Bộ học liệu" value={sets.length} sub={`${sets.filter(s => s.status === 'published').length} đã phát hành`} />
        <Stat label="Bài học" value={lessons.length} />
        <Stat label="Chương trình có học liệu" value={new Set(sets.map(s => s.curriculum_id).filter(Boolean)).size} />
      </div>
      {msg && <p className="msg">{msg}</p>}
      <div className="p1-layout">
        <aside className="p1-aside">
          <div className="bar small"><h4>Bộ học liệu</h4>{canManage && <button type="button" className="linkbtn" onClick={newSet}>+ Bộ mới</button>}</div>
          {tree.length ? <Tree nodes={tree} selected={sel} onSelect={setSel} defaultOpen={2} /> : <Empty>Chưa có học liệu.</Empty>}
        </aside>
        <div>
          {!set ? <Empty>Chọn một bộ học liệu hoặc bài học ở cây bên trái.</Empty>
            : kind === 'set' ? <SetDetail key={set.id} set={set} progs={progs} cat={cat} editable={canManage && set.owner_org_id === orgId} lessons={lessons.filter(l => l.set_id === set.id)}
              onOpen={lid => setSel('lesson:' + lid)} reload={load} />
            : <LessonDetail key={id} lessonId={id} set={set} cat={cat} editable={canManage && set.owner_org_id === orgId} reload={load} />}
        </div>
      </div>
    </>
  )
}

function SetDetail({ set, progs, cat, editable, lessons, onOpen, reload }: { set: MSet; progs: Curriculum[]; cat: CatItem[]; editable: boolean; lessons: MLesson[]; onOpen: (id: string) => void; reload: () => void }) {
  const [msg, setMsg] = useState('')
  const [std, setStd] = useState<{ id: string; title: string; periods: number }[]>([])
  const c = progs.find(p => p.id === set.curriculum_id)
  useEffect(() => {
    if (!c?.current_version_id) return
    supabase.from('curriculum_lessons').select('id, title, periods, curriculum_units!inner(subject_main, grade, seq), seq').eq('version_id', c.current_version_id)
      .then(({ data }) => setStd(((data as any[]) ?? []).filter(x => (!set.subject || x.curriculum_units.subject_main === set.subject) && (set.grade == null || x.curriculum_units.grade === set.grade))
        .sort((a, b) => a.curriculum_units.seq - b.curriculum_units.seq || a.seq - b.seq)))
  }, [c?.current_version_id, set.subject, set.grade])
  const run = async (q: PromiseLike<{ error: { message: string } | null }>) => { const { error } = await q; if (error) setMsg(errMsg(error.message)); else { setMsg(''); reload() } }
  const upd = (p: Partial<MSet>) => run(supabase.from('material_sets').update(p).eq('id', set.id))
  const missing = std.filter(s => !lessons.some(l => l.curriculum_lesson_id === s.id))
  return (
    <>
      <div className="p1-head">{c && <Code color={c.color}>{c.code}</Code>}<h2>{set.name}</h2><Pill tone={SET_STATUS[set.status]?.[1]}>{SET_STATUS[set.status]?.[0]}</Pill>
        <p className="p1-sub">{[c?.name, catName(cat, 'subject', set.subject), set.grade != null ? gradeLabel(set.grade) : '', `phiên bản ${set.version_no}`].filter(Boolean).join(' · ')}</p></div>
      {msg && <p className="msg">{msg}</p>}
      <Section title="Thông tin bộ học liệu">
        <div className="p1-form">
          <label><span>Tên</span><input disabled={!editable} defaultValue={set.name} onBlur={e => e.target.value !== set.name && upd({ name: e.target.value })} /></label>
          <label><span>Chương trình đáp ứng</span><select disabled={!editable} value={set.curriculum_id ?? ''} onChange={e => upd({ curriculum_id: e.target.value || null, version_id: progs.find(p => p.id === e.target.value)?.current_version_id ?? null })}>
            <option value="">—</option>{progs.map(p => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}</select></label>
          <label><span>Môn</span><select disabled={!editable} value={set.subject ?? ''} onChange={e => upd({ subject: e.target.value || null })}>
            <option value="">—</option>{catOf(cat, 'subject').map(s => <option key={s.id} value={s.code}>{s.name}</option>)}</select></label>
          <label><span>Khối</span><input type="number" min={0} max={12} disabled={!editable} defaultValue={set.grade ?? ''} onBlur={e => upd({ grade: e.target.value === '' ? null : Number(e.target.value) })} /></label>
          <label><span>Trạng thái phát hành</span><select disabled={!editable} value={set.status} onChange={e => upd({ status: e.target.value })}>
            {Object.entries(SET_STATUS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label className="wide"><span>Mô tả</span><textarea rows={2} disabled={!editable} defaultValue={set.description ?? ''} onBlur={e => upd({ description: e.target.value || null })} /></label>
        </div>
      </Section>
      <Section title={`Bài học · ${lessons.length}`} actions={editable && <button type="button" onClick={() => run(supabase.from('material_lessons').insert({ set_id: set.id, seq: lessons.length + 1, title: 'Bài mới', periods: 1 }))}>+ Bài học</button>}>
        {lessons.length === 0 ? <Empty>Bộ học liệu chưa có bài.</Empty> : (
          <table className="p1-table"><thead><tr><th>#</th><th>Bài học</th><th>Số tiết</th><th>Bài chuẩn trong chương trình</th></tr></thead>
            <tbody>{lessons.map(l => <tr key={l.id}><td>{l.seq}</td><td><button type="button" className="linkbtn" onClick={() => onOpen(l.id)}>{l.title}</button></td><td>{l.periods}</td>
              <td>{l.curriculum_lesson_id ? <Pill tone="good">Đã liên kết</Pill> : <Pill tone="warn">Chưa liên kết</Pill>}</td></tr>)}</tbody></table>)}
        {missing.length > 0 && <div className="p1-alert warn" style={{ marginTop: 12 }}>
          <span>Bài trong chương trình chưa có học liệu: {missing.map(m => m.title).join(', ')}.</span>
          {editable && <button type="button" onClick={() => run(supabase.from('material_lessons').insert(missing.map((m, i) => ({ set_id: set.id, curriculum_lesson_id: m.id, seq: lessons.length + i + 1, title: m.title, periods: m.periods }))))}>Tạo bài học liệu</button>}
        </div>}
      </Section>
    </>
  )
}

type LTab = 'info' | 'steps' | 'norms' | 'files' | 'criteria'
export function LessonDetail({ lessonId, set, cat, editable, reload }: { lessonId: string; set: MSet; cat: CatItem[]; editable: boolean; reload: () => void }) {
  const [l, setL] = useState<MLesson | null>(null)
  const [norms, setNorms] = useState<Norm[]>([])
  const [files, setFiles] = useState<File[]>([])
  const [tab, setTab] = useState<LTab>('info')
  const [msg, setMsg] = useState('')
  const [calc, setCalc] = useState({ students: 35, groups: 7, products: 7 })
  async function load() {
    const [a, b, c] = await Promise.all([
      supabase.from('material_lessons').select('*').eq('id', lessonId).single(),
      supabase.from('material_norms').select('*').eq('lesson_id', lessonId).order('seq'),
      supabase.from('material_files').select('*').eq('lesson_id', lessonId).order('seq'),
    ])
    setL(a.data as MLesson); setNorms((b.data as Norm[]) ?? []); setFiles((c.data as File[]) ?? [])
  }
  useEffect(() => { load() }, [lessonId])
  const run = async (q: PromiseLike<{ error: { message: string } | null }>, all = false) => { const { error } = await q; if (error) setMsg(errMsg(error.message)); else { setMsg(''); load(); if (all) reload() } }
  const upd = (p: Partial<MLesson>) => run(supabase.from('material_lessons').update(p).eq('id', lessonId), 'title' in p || 'periods' in p)
  if (!l) return <p className="sub">Đang tải…</p>
  const sessions = Array.from(new Set(l.steps.map(s => s.session ?? 1))).sort((a, b) => a - b)
  const setStep = (i: number, p: Partial<Step>) => upd({ steps: l.steps.map((s, j) => j === i ? { ...s, ...p } : s) })

  return (
    <>
      <div className="p1-head"><h2>{l.title}</h2><Pill>{l.periods} tiết · {l.sessions} buổi</Pill><p className="p1-sub">{set.name}{l.subjects_integrated.length ? ' · tích hợp ' + l.subjects_integrated.map(s => catName(cat, 'subject', s)).join(', ') : ''}</p></div>
      {msg && <p className="msg">{msg}</p>}
      <div className="bar"><Tabs items={[['info', 'Thông tin bài'], ['steps', 'Hoạt động', l.steps.length], ['norms', 'Định mức vật tư', norms.length], ['files', 'Tài liệu', files.length], ['criteria', 'Tiêu chí', l.criteria.length]] as [LTab, string, number?][]} value={tab} onChange={setTab} /></div>
      {tab === 'info' && <Section title="Thông tin bài học"><div className="p1-form">
        <label><span>Mã bài</span><input disabled={!editable} defaultValue={l.code ?? ''} onBlur={e => upd({ code: e.target.value || null })} /></label>
        <label style={{ gridColumn: 'span 2' }}><span>Tên bài</span><input disabled={!editable} defaultValue={l.title} onBlur={e => e.target.value && e.target.value !== l.title && upd({ title: e.target.value })} /></label>
        <label><span>Thời lượng (tiết)</span><input type="number" min={0} disabled={!editable} defaultValue={l.periods} onBlur={e => upd({ periods: Number(e.target.value) || 0 })} /></label>
        <label><span>Số buổi</span><input type="number" min={1} disabled={!editable} defaultValue={l.sessions} onBlur={e => upd({ sessions: Math.max(1, Number(e.target.value) || 1) })} /></label>
        <label><span>Môn chủ đạo</span><select disabled={!editable} value={l.subject_main ?? ''} onChange={e => upd({ subject_main: e.target.value || null })}><option value="">—</option>
          {catOf(cat, 'subject').map(s => <option key={s.id} value={s.code}>{s.name}</option>)}</select></label>
        <div className="wide"><span className="sub">Môn tích hợp</span><div className="p1-chiprow">{catOf(cat, 'subject').filter(s => s.code !== l.subject_main).map(s => { const on = l.subjects_integrated.includes(s.code)
          return <button type="button" key={s.id} disabled={!editable} className={on ? 'on' : ''} onClick={() => upd({ subjects_integrated: on ? l.subjects_integrated.filter(x => x !== s.code) : [...l.subjects_integrated, s.code] })}>{s.name}</button> })}</div></div>
        <label className="wide"><span>Mục tiêu / yêu cầu cần đạt</span><textarea rows={3} disabled={!editable} defaultValue={l.objectives ?? ''} onBlur={e => upd({ objectives: e.target.value || null })} /></label>
        <label className="wide"><span>Yêu cầu sản phẩm</span><textarea rows={3} disabled={!editable} defaultValue={l.product_requirements ?? ''} onBlur={e => upd({ product_requirements: e.target.value || null })} /></label>
      </div></Section>}

      {tab === 'steps' && <Section title="Hoạt động & các bước thực hiện" actions={editable && <button type="button" onClick={() => upd({ steps: [...l.steps, { session: sessions[sessions.length - 1] ?? 1, title: 'Hoạt động mới', minutes: 10, teacher: '', student: '' }] })}>+ Hoạt động</button>}>
        {l.steps.length === 0 ? <Empty>Chưa có hoạt động.</Empty> : sessions.map(ss => (<div key={ss}>
          <div className="p1-session">Buổi {ss} · {l.steps.filter(s => (s.session ?? 1) === ss).reduce((a, s) => a + (s.minutes ?? 0), 0)} phút</div>
          <ol className="p1-steps">{l.steps.map((s, i) => (s.session ?? 1) !== ss ? null : (
            <li key={i}><span className="no">{l.steps.slice(0, i + 1).filter(x => (x.session ?? 1) === ss).length}</span>
              <div>{editable ? <input defaultValue={s.title} onBlur={e => setStep(i, { title: e.target.value })} aria-label="Tên hoạt động" /> : <b>{s.title}</b>}
                <div className="meta">
                  {editable ? <><label>Buổi <input type="number" min={1} style={{ width: 56 }} defaultValue={s.session ?? 1} onBlur={e => setStep(i, { session: Math.max(1, Number(e.target.value) || 1) })} /></label>
                    <label>Phút <input type="number" min={0} style={{ width: 64 }} defaultValue={s.minutes ?? ''} onBlur={e => setStep(i, { minutes: Number(e.target.value) || 0 })} /></label>
                    <button type="button" className="danger" onClick={() => upd({ steps: l.steps.filter((_, j) => j !== i) })} aria-label="Xoá">×</button></>
                    : <span>⏱ {s.minutes ?? 0} phút</span>}
                </div>
                <div className="p1-form" style={{ marginTop: 6 }}>
                  <label><span>Giáo viên</span>{editable ? <textarea rows={2} defaultValue={s.teacher ?? ''} onBlur={e => setStep(i, { teacher: e.target.value })} /> : <span>{s.teacher || '—'}</span>}</label>
                  <label><span>Học sinh</span>{editable ? <textarea rows={2} defaultValue={s.student ?? ''} onBlur={e => setStep(i, { student: e.target.value })} /> : <span>{s.student || '—'}</span>}</label>
                </div></div></li>))}</ol></div>))}
      </Section>}

      {tab === 'norms' && <>
        <Section title="Tính nhu cầu vật tư cho một lớp">
          <div className="p1-actions">
            <label>Số học sinh <input type="number" min={1} value={calc.students} onChange={e => setCalc({ ...calc, students: Number(e.target.value) || 0 })} style={{ width: 80 }} /></label>
            <label>Số nhóm <input type="number" min={1} value={calc.groups} onChange={e => setCalc({ ...calc, groups: Number(e.target.value) || 0, products: Number(e.target.value) || 0 })} style={{ width: 80 }} /></label>
            <label>Số sản phẩm <input type="number" min={1} value={calc.products} onChange={e => setCalc({ ...calc, products: Number(e.target.value) || 0 })} style={{ width: 80 }} /></label>
            <small className="sub">Mặc định mỗi nhóm làm một sản phẩm; đổi nếu mỗi học sinh làm một sản phẩm.</small>
          </div>
        </Section>
        <Section title="Định mức vật tư" actions={editable && <button type="button" onClick={() => run(supabase.from('material_norms').insert({ lesson_id: lessonId, seq: norms.length + 1, name: 'Vật tư mới', unit: 'cái', qty: 1 }))}>+ Dòng vật tư</button>}>
          {norms.length === 0 ? <Empty>Chưa có định mức.</Empty> : Object.keys(NORM_CAT).filter(k => norms.some(n => n.category === k)).map(k => (
            <div key={k} style={{ marginBottom: 12 }}><div className="p1-session">{NORM_CAT[k]}</div>
              <table className="p1-table"><thead><tr><th>Tên</th><th>Quy cách</th><th>Đơn vị</th><th>Định mức</th><th>Tính theo</th><th>Thay thế</th><th>Cần cho lớp</th>{editable && <th></th>}</tr></thead>
                <tbody>{norms.filter(n => n.category === k).map(n => {
                  const u = (p: Partial<Norm>) => run(supabase.from('material_norms').update(p).eq('id', n.id))
                  return <tr key={n.id}>
                    <td>{editable ? <input defaultValue={n.name} onBlur={e => u({ name: e.target.value })} aria-label="Tên" /> : <b>{n.name}</b>}</td>
                    <td>{editable ? <input defaultValue={n.spec ?? ''} onBlur={e => u({ spec: e.target.value || null })} aria-label="Quy cách" /> : n.spec ?? '—'}</td>
                    <td style={{ width: 80 }}>{editable ? <input defaultValue={n.unit} onBlur={e => u({ unit: e.target.value })} aria-label="Đơn vị" /> : n.unit}</td>
                    <td style={{ width: 90 }}>{editable ? <input type="number" min={0} step="any" defaultValue={n.qty} onBlur={e => u({ qty: Number(e.target.value) || 0 })} aria-label="Số lượng" /> : n.qty}</td>
                    <td>{editable ? <select value={n.basis} onChange={e => u({ basis: e.target.value })} aria-label="Tính theo">{Object.entries(BASIS).map(([b, t]) => <option key={b} value={b}>{t}</option>)}</select> : BASIS[n.basis]}</td>
                    <td>{editable ? <input defaultValue={n.substitute ?? ''} onBlur={e => u({ substitute: e.target.value || null })} aria-label="Thay thế" /> : n.substitute ?? '—'}</td>
                    <td><b>{+needQty(n, calc.students, calc.groups, calc.products).toFixed(2)}</b> {n.unit}</td>
                    {editable && <td><select value={n.category} onChange={e => u({ category: e.target.value })} aria-label="Loại">{Object.entries(NORM_CAT).map(([c, t]) => <option key={c} value={c}>{t}</option>)}</select>
                      <button type="button" className="danger" aria-label="Xoá" onClick={() => run(supabase.from('material_norms').delete().eq('id', n.id))}>×</button></td>}
                  </tr>
                })}</tbody></table></div>))}
        </Section>
      </>}

      {tab === 'files' && <Section title="Tài liệu bài dạy" actions={editable && <button type="button" onClick={() => run(supabase.from('material_files').insert({ lesson_id: lessonId, seq: files.length + 1, kind: 'tham_khao', title: 'Tài liệu mới' }))}>+ Tài liệu</button>}>
        {files.length === 0 ? <Empty>Chưa có tài liệu.</Empty> : <table className="p1-table"><thead><tr><th>Loại</th><th>Tên</th><th>Đường dẫn</th>{editable && <th></th>}</tr></thead>
          <tbody>{files.map(f => { const u = (p: Partial<File>) => run(supabase.from('material_files').update(p).eq('id', f.id))
            return <tr key={f.id}>
              <td>{editable ? <select value={f.kind} onChange={e => u({ kind: e.target.value })} aria-label="Loại">{Object.entries(FILE_KIND).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select> : FILE_KIND[f.kind]}</td>
              <td>{editable ? <input defaultValue={f.title} onBlur={e => u({ title: e.target.value })} aria-label="Tên" /> : f.title}</td>
              <td>{editable ? <input defaultValue={f.url ?? ''} placeholder="https://…" onBlur={e => u({ url: e.target.value || null })} aria-label="Đường dẫn" /> : f.url ? <a href={f.url} target="_blank" rel="noreferrer">Mở</a> : '—'}</td>
              {editable && <td><button type="button" className="danger" aria-label="Xoá" onClick={() => run(supabase.from('material_files').delete().eq('id', f.id))}>×</button></td>}
            </tr> })}</tbody></table>}
      </Section>}

      {tab === 'criteria' && <Section title="Tiêu chí đánh giá sản phẩm" actions={editable && <button type="button" onClick={() => upd({ criteria: [...l.criteria, { name: 'Tiêu chí mới', levels: ['', '', '', ''] }] })}>+ Tiêu chí</button>}>
        {l.criteria.length === 0 ? <Empty>Chưa có tiêu chí.</Empty> : <table className="p1-table"><thead><tr><th>Tiêu chí</th><th>Mức 1</th><th>Mức 2</th><th>Mức 3</th><th>Mức 4</th>{editable && <th></th>}</tr></thead>
          <tbody>{l.criteria.map((c, i) => <tr key={i}>
            <td>{editable ? <input defaultValue={c.name} onBlur={e => upd({ criteria: l.criteria.map((x, j) => j === i ? { ...x, name: e.target.value } : x) })} aria-label="Tiêu chí" /> : <b>{c.name}</b>}</td>
            {[0, 1, 2, 3].map(m => <td key={m}>{editable ? <input defaultValue={c.levels?.[m] ?? ''} aria-label={`Mức ${m + 1}`}
              onBlur={e => upd({ criteria: l.criteria.map((x, j) => j === i ? { ...x, levels: [0, 1, 2, 3].map(z => z === m ? e.target.value : x.levels?.[z] ?? '') } : x) })} /> : c.levels?.[m] ?? ''}</td>)}
            {editable && <td><button type="button" className="danger" aria-label="Xoá" onClick={() => upd({ criteria: l.criteria.filter((_, j) => j !== i) })}>×</button></td>}
          </tr>)}</tbody></table>}
      </Section>}
    </>
  )
}
