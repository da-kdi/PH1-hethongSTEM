import { lazy, Suspense, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { errMsg } from '../ui'
import { catName, effectiveCatalog, useCatalog, useOrgs, type Curriculum } from '../curriculum/api'
import { gradesText } from '../curriculum/CurriculumPage'
import { Empty, Flow, Ic, Mau, PageHead, StatCard, cssVar } from '../mau/kit'
import { SGLYPH } from '../mau/icons'

const ElearningManage = lazy(() => import('../../../pages/elearning/Manage'))

// 1.1.6 E-learning & luyện thi — dựng theo bản mẫu giao diện (ph1-chuong-trinh-mau.html):
//   Khoá học: mỗi chương trình đã phát hành có một khoá tự học dựng từ bài học + học liệu đã phát hành (tạo nhanh nếu chưa có);
//   Đề luyện: đề của ngân hàng câu hỏi với số câu, lượt làm, điểm trung bình. Chi tiết khoá / đề / ngân hàng câu hỏi giữ màn quản lý sẵn có (053).
type Course = { id: string; org_id: string; title: string; status: string; curriculum_id: string | null; course_lessons: { id: string }[] }
type Exam = { id: string; title: string; subject: string | null; grade: number | null; mode: string; question_ids: string[]; criteria: { count?: number } | null; status: string }
type Att = { exam_id: string; score: number | null; status: string }
type Prog = { id: string; lessons: number; ok: number }

export function ElearningMau(props: { orgId: string | null; teacherId?: string | null }) {
  const { orgId } = props
  const [tab, setTab] = useState<'course' | 'test'>('course')
  const [manage, setManage] = useState(false)
  const [progs, setProgs] = useState<Curriculum[]>([])
  const [stat, setStat] = useState<Map<string, Prog>>(new Map())
  const [courses, setCourses] = useState<Course[]>([])
  const [prog, setProg] = useState<{ lesson_id: string; student_id: string }[]>([])
  const [exams, setExams] = useState<Exam[]>([])
  const [atts, setAtts] = useState<Att[]>([])
  const [msg, setMsg] = useState('')
  const { all, hidden } = useCatalog()
  const { below } = useOrgs(orgId)
  const cat = effectiveCatalog(all, hidden, below)

  async function load() {
    const [c, co, e, a, pr] = await Promise.all([
      supabase.from('curricula').select('*').eq('status', 'published').order('code'),
      supabase.from('courses').select('id, org_id, title, status, curriculum_id, course_lessons(id)').order('created_at'),
      supabase.from('practice_exams').select('id, title, subject, grade, mode, question_ids, criteria, status').order('title'),
      supabase.from('exam_attempts').select('exam_id, score, status'),
      supabase.from('course_progress').select('lesson_id, student_id'),
    ])
    if (c.error) return setMsg(errMsg(c.error.message))
    const ps = (c.data as Curriculum[]) ?? []; setProgs(ps); setCourses((co.data as Course[]) ?? []); setExams((e.data as Exam[]) ?? []); setAtts((a.data as Att[]) ?? [])
    setProg((pr.data as { lesson_id: string; student_id: string }[]) ?? [])
    const vids = ps.map(p => p.current_version_id).filter(Boolean) as string[]
    const [cl, ml] = await Promise.all([
      vids.length ? supabase.from('curriculum_lessons').select('id, version_id').in('version_id', vids) : Promise.resolve({ data: [] }),
      supabase.from('material_lessons').select('curriculum_lesson_id, status').eq('status', 'published'),
    ])
    const okSet = new Set(((ml.data as { curriculum_lesson_id: string | null }[]) ?? []).map(x => x.curriculum_lesson_id))
    const m = new Map<string, Prog>()
    for (const l of (cl.data as { id: string; version_id: string }[]) ?? []) { const p = ps.find(x => x.current_version_id === l.version_id); if (!p) continue
      const s = m.get(p.id) ?? { id: p.id, lessons: 0, ok: 0 }; s.lessons++; if (okSet.has(l.id)) s.ok++; m.set(p.id, s) }
    setStat(m)
  }
  useEffect(() => { load() }, [orgId])

  const courseOf = (p: Curriculum) => courses.find(c => c.curriculum_id === p.id && c.status !== 'archived') ?? null
  const learnersOf = (c: Course | null) => { if (!c) return { n: 0, done: 0 }; const ids = new Set(c.course_lessons.map(l => l.id)); const by = new Map<string, number>()
    prog.filter(x => ids.has(x.lesson_id)).forEach(x => by.set(x.student_id, (by.get(x.student_id) ?? 0) + 1))
    const n = by.size; const done = n ? Math.round([...by.values()].filter(v => v >= ids.size).length * 100 / n) : 0; return { n, done } }
  const mainSubj = (p: Curriculum) => (p as Curriculum & { subjects?: string[] }).subjects?.[0] ?? null
  const qOf = (e: Exam) => e.mode === 'fixed' ? e.question_ids.length : Number(e.criteria?.count ?? e.question_ids.length) || 0
  const sub = atts.filter(a => a.status === 'submitted' && a.score != null)
  const avg = sub.length ? (sub.reduce((x, a) => x + Number(a.score), 0) / sub.length).toFixed(1) : '—'
  const learners = new Set(prog.map(x => x.student_id)).size

  // Tạo khoá tự học từ bài học của chương trình (mỗi bài một bài đọc; bổ sung video, đề luyện ở màn quản lý)
  async function create(p: Curriculum) {
    if (!orgId || !p.current_version_id) return
    const { data, error } = await supabase.from('courses').insert({ org_id: orgId, title: `Khoá tự học: ${p.name}`, description: 'Dựng từ bài học và học liệu đã phát hành của chương trình.',
      grade: p.grades.find(g => g > 0) ?? null, status: 'draft', curriculum_id: p.id }).select('id').single()
    if (error) return setMsg(errMsg(error.message))
    const ls = await supabase.from('curriculum_lessons').select('seq, title, periods, curriculum_units(seq)').eq('version_id', p.current_version_id)
    type R = { seq: number; title: string; periods: number; curriculum_units: { seq: number } | null }
    const rows = ((ls.data as unknown as R[]) ?? []).sort((a, b) => (a.curriculum_units?.seq ?? 0) - (b.curriculum_units?.seq ?? 0) || a.seq - b.seq)
      .map((l, i) => ({ course_id: (data as { id: string }).id, position: i + 1, title: l.title.slice(0, 200), kind: 'reading', body: l.title, duration_min: Math.min(600, Math.max(1, (l.periods || 1) * 15)) }))
    if (rows.length) { const r = await supabase.from('course_lessons').insert(rows); if (r.error) return setMsg(errMsg(r.error.message)) }
    setMsg(`Đã tạo khoá tự học cho ${p.code} với ${rows.length} bài (bản nháp) — bổ sung video, đề luyện ở “Quản lý chi tiết”.`); load()
  }

  if (manage) return <Mau><button type="button" className="btn sm ghost" onClick={() => { setManage(false); load() }}><Ic n="back" /> Quay lại</button>
    <Suspense fallback={<p className="sub">Đang tải…</p>}><div style={{ fontSize: 14 }}><ElearningManage {...props} /></div></Suspense></Mau>
  const noCourse = progs.filter(p => !courseOf(p))
  return <Mau>
    {msg && <p className="msg" role="status" onClick={() => setMsg('')}>{msg}</p>}
    <PageHead icon="cap" title="E-learning & luyện thi" sub="Khoá tự học và đề luyện dựng từ bài học, học liệu đã phát hành của chương trình">
      <button type="button" className="btn primary" onClick={() => noCourse[0] ? create(noCourse[0]) : setManage(true)} title={noCourse[0] ? `Tạo khoá tự học cho ${noCourse[0].code}` : 'Mở quản lý khoá học'}><Ic n="plus" /> Khoá học</button></PageHead>
    <Flow steps={[['course', 'Khoá học', `${progs.length} khoá tự học`], ['test', 'Đề luyện', `${exams.length} đề · ${exams.reduce((a, e) => a + qOf(e), 0)} câu hỏi`]]} value={tab} onChange={setTab} />
    <div className="stats">
      <StatCard c="c-blue" icon="cap" label="Khoá học" value={courses.filter(c => c.curriculum_id && progs.some(p => p.id === c.curriculum_id)).length} sub="theo chương trình đã phát hành" />
      <StatCard c="c-green" icon="user" label="Học viên" value={learners.toLocaleString('vi-VN')} sub="đang học" />
      <StatCard c="c-violet" icon="list" label="Đề luyện" value={exams.length} sub={exams.reduce((a, e) => a + qOf(e), 0) + ' câu hỏi'} />
      <StatCard c="c-amber" icon="target" label="Điểm TB" value={avg} sub="trên thang 10" /></div>
    {tab === 'course' ? (progs.length ? <div className="grid">{progs.map(p => { const c = courseOf(p); const s = stat.get(p.id) ?? { lessons: 0, ok: 0 }; const L = learnersOf(c)
      return <article key={p.id} className="pcard dcard" style={cssVar(p.color)}>
        <div className="cover"><i className="cg"><svg viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: SGLYPH[mainSubj(p) ?? ''] ?? SGLYPH.khtn }} /></i><span>{gradesText(cat, p.grades)}</span><b>{p.code}</b></div>
        <h3>Khoá tự học: {p.name}</h3>
        <div className="bar"><i style={{ width: L.done + '%' }} /></div>
        <small style={{ color: 'var(--muted)' }}>{c ? `${L.done}% học viên hoàn thành · ` : 'Chưa tạo khoá học · '}{s.ok}/{s.lessons} bài có học liệu</small>
        <div className="foot"><span>{c ? `${L.n} học viên · ${c.course_lessons.length} bài` : '—'}</span>
          {c ? <button type="button" className="btn sm" onClick={() => setManage(true)}>Mở ›</button> : <button type="button" className="btn sm primary" disabled={!orgId} onClick={() => create(p)}><Ic n="plus" /> Tạo khoá học</button>}</div></article> })}</div>
      : <Empty>Chưa có chương trình đã phát hành.</Empty>)
      : exams.length ? <div className="panel" style={{ padding: 0 }}><div className="tblwrap"><table><thead><tr><th>Đề luyện</th><th>Môn · khối</th><th>Số câu</th><th>Lượt làm</th><th>Điểm TB</th></tr></thead><tbody>
        {exams.map(e => { const as = atts.filter(a => a.exam_id === e.id && a.status === 'submitted'); const sc = as.filter(a => a.score != null)
          return <tr key={e.id} style={{ cursor: 'pointer' }} onClick={() => setManage(true)}><td><b>{e.title}</b></td><td>{catName(cat, 'subject', e.subject) || e.subject || '—'}{e.grade ? ` · Khối ${e.grade}` : ''}</td><td>{qOf(e)}</td><td>{as.length}</td>
            <td><b>{sc.length ? (sc.reduce((x, a) => x + Number(a.score), 0) / sc.length).toFixed(1) : '—'}</b></td></tr> })}</tbody></table></div></div>
      : <Empty>Chưa có đề luyện — tạo ở “Quản lý chi tiết”.</Empty>}
    <p className="note">Chi tiết khoá học, đề luyện và ngân hàng câu hỏi: <button type="button" className="linkbtn" onClick={() => setManage(true)}>Quản lý chi tiết ›</button></p>
  </Mau>
}
