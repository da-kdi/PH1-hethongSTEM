import { lazy, Suspense, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { norm } from '../ui'
import { errMsg } from '../ui'
import { catName, catOf, effectiveCatalog, useCatalog, useOrgs, type Curriculum } from '../curriculum/api'
import { gradesText } from '../curriculum/CurriculumPage'
import { Back, Confirm, Empty, Flow, Ic, Mau, PageHead, Seg, StatusPill, cssVar } from '../mau/kit'
import { DataTable } from '../mau/DataTable'
import { ExamDetail, QEditor, type Exam } from './QEditor'
import { SGLYPH } from '../mau/icons'

const ElearningManage = lazy(() => import('../../../pages/elearning/Manage'))

// 1.1.6 E-learning & luyện thi — dựng theo bản mẫu giao diện (ph1-chuong-trinh-mau.html):
//   Khoá học: mỗi chương trình đã phát hành có một khoá tự học dựng từ bài học + học liệu đã phát hành (tạo nhanh nếu chưa có);
//   Đề luyện: đề của ngân hàng câu hỏi với số câu, lượt làm, điểm trung bình. Chi tiết khoá / đề / ngân hàng câu hỏi giữ màn quản lý sẵn có (053).
type Course = { id: string; org_id: string; title: string; status: string; curriculum_id: string | null; course_lessons: { id: string }[] }
type Att = { exam_id: string; score: number | null; status: string }
type Prog = { id: string; lessons: number; ok: number }

export function ElearningMau(props: { orgId: string | null; teacherId?: string | null }) {
  const { orgId } = props
  const [tab, setTab] = useState<'course' | 'test'>('test')
  const [eq, setEq] = useState('')
  const [manage, setManage] = useState(false)
  const [progs, setProgs] = useState<Curriculum[]>([])
  const [stat, setStat] = useState<Map<string, Prog>>(new Map())
  const [courses, setCourses] = useState<Course[]>([])
  const [prog, setProg] = useState<{ lesson_id: string; student_id: string }[]>([])
  const [exams, setExams] = useState<Exam[]>([])
  const [atts, setAtts] = useState<Att[]>([])
  const [msg, setMsg] = useState('')
  // Bản mẫu v315 · C5: danh sách dạng bảng; đề luyện mở chi tiết (câu hỏi theo mức độ, thêm/bớt); trình soạn / nhập file câu hỏi
  const [cview, setCview] = useState<'table' | 'grid'>(() => { try { return (localStorage.getItem('ph1.el.mode') as 'table' | 'grid') || 'table' } catch { return 'table' } })
  const [openExam, setOpenExam] = useState<string | null>(null)
  const [qe, setQe] = useState(false)
  const [askC, setAskC] = useState<Curriculum | null>(null)   // bấm dòng chưa có khoá học → hỏi trước khi tạo
  const { all, hidden } = useCatalog()
  const { below } = useOrgs(orgId)
  const cat = effectiveCatalog(all, hidden, below)

  async function load() {
    const [c, co, e, a, pr] = await Promise.all([
      supabase.from('curricula').select('*').eq('status', 'published').order('code'),
      supabase.from('courses').select('id, org_id, title, status, curriculum_id, course_lessons(id)').order('created_at'),
      supabase.from('practice_exams').select('id, org_id, title, subject, grade, mode, question_ids, criteria, status, closes_at, updated_at').order('title'),
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

  if (manage) return <Mau><Back onClick={() => { setManage(false); load() }} title={'Quản lý chi tiết'}>Quay lại</Back>
    <Suspense fallback={<p className="sub">Đang tải…</p>}><div style={{ fontSize: 14 }}><ElearningManage {...props} /></div></Suspense></Mau>
  const noCourse = progs.filter(p => !courseOf(p))
  const subjects = catOf(cat, 'subject').map(s => [s.code, s.name] as [string, string])
  const openE = exams.find(e => e.id === openExam)
  if (openE && orgId) return <Mau>{msg && <p className="msg" role="status" onClick={() => setMsg('')}>{msg}</p>}
    <ExamDetail e={openE} orgId={orgId} cat={cat} canEdit={openE.org_id === orgId} subjects={subjects} onBack={() => setOpenExam(null)} reload={load} /></Mau>
  const setSt = (table: 'courses' | 'practice_exams', status: string, label: string) => async (rs: { id: string }[]) => {
    const { error } = await supabase.from(table).update({ status }).in('id', rs.map(r => r.id)); if (error) return errMsg(error.message); await load(); return `${label} ${rs.length} ${table === 'courses' ? 'khoá học' : 'đề luyện'}` }
  type CRow = { p: Curriculum; c: Course | null }
  const crows: CRow[] = progs.map(p => ({ p, c: courseOf(p) }))
  return <Mau>
    {msg && <p className="msg" role="status" onClick={() => setMsg('')}>{msg}</p>}
    <PageHead icon="cap" title="E-learning & luyện thi" sub="Khoá tự học và đề luyện dựng từ bài học, học liệu đã phát hành của chương trình">
      {tab === 'test' ? orgId && <button type="button" className="btn primary" onClick={() => setQe(true)}><Ic n="plus" /> Câu hỏi mới / nhập file</button>
        : <button type="button" className="btn primary" onClick={() => noCourse[0] ? create(noCourse[0]) : setManage(true)} title={noCourse[0] ? `Tạo khoá tự học cho ${noCourse[0].code}` : 'Mở quản lý khoá học'}><Ic n="plus" /> Khoá học</button>}</PageHead>
    <Flow steps={[['test', 'Đề luyện', `${exams.length} đề · ${exams.reduce((a, e) => a + qOf(e), 0)} câu · điểm TB ${avg}`], ['course', 'Khoá học', `${progs.length} khoá tự học · ${learners.toLocaleString('vi-VN')} học viên`]]} value={tab} onChange={setTab} />
    {qe && orgId && <QEditor orgId={orgId} subject="" grade={null} subjects={subjects} onClose={() => setQe(false)} onSaved={ids => { setQe(false); setMsg(`Đã lưu ${ids.length} câu vào ngân hàng câu hỏi — mở một đề để thêm câu vào đề.`) }} />}
    {tab === 'course' ? <>
      {askC && <Confirm text={`Tạo khoá tự học cho chương trình “${askC.name}”?`} yes="Tạo khoá học" onNo={() => setAskC(null)} onYes={() => { const p = askC; setAskC(null); create(p) }} />}
      {!progs.length ? <Empty>Chưa có chương trình đã phát hành.</Empty>
        : <DataTable id="el-course" rows={crows}
          view={<Seg label="Kiểu xem" items={[['table', 'Danh sách'], ['grid', 'Thẻ']]} value={cview} onChange={v => { setCview(v); try { localStorage.setItem('ph1.el.mode', v) } catch { /* bỏ qua */ } }} />}
          grid={cview === 'grid' ? (<div className="grid">{progs.map(p => { const c = courseOf(p); const s = stat.get(p.id) ?? { lessons: 0, ok: 0 }; const L = learnersOf(c)
          return <article key={p.id} className="pcard dcard" style={cssVar(p.color)}>
            <div className="cover"><i className="cg"><svg viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: SGLYPH[mainSubj(p) ?? ''] ?? SGLYPH.khtn }} /></i><span>{gradesText(cat, p.grades)}</span><b>{p.code}</b></div>
            <h3>Khoá tự học: {p.name}</h3>
            <small style={{ color: 'var(--muted)' }}>{c ? `${L.done}% học viên hoàn thành · ` : 'Chưa tạo khoá học · '}{s.ok}/{s.lessons} bài có học liệu</small>
            <div className="foot"><span>{c ? `${L.n} học viên · ${c.course_lessons.length} bài` : '—'}</span>
              {c ? <button type="button" className="btn sm" onClick={() => setManage(true)}>Mở ›</button> : <button type="button" className="btn sm primary" disabled={!orgId} onClick={() => create(p)}><Ic n="plus" /> Tạo khoá học</button>}</div></article> })}</div>) : undefined} rowKey={r => r.p.id} noun="khoá học" onOpen={r => r.c ? setManage(true) : orgId ? setAskC(r.p) : undefined}
          bulk={[{ label: 'Phát hành', run: rs => setSt('courses', 'published', 'Đã phát hành')(rs.filter(r => r.c).map(r => r.c!)) }, { label: 'Đóng', run: rs => setSt('courses', 'archived', 'Đã đóng')(rs.filter(r => r.c).map(r => r.c!)) }]}
          cols={[
            { key: 'title', label: 'Khoá học', name: true, sort: r => r.p.name, cell: r => <><b>Khoá tự học: {r.p.name}</b><small>{r.c ? r.c.title : 'Chưa tạo khoá học'}</small></> },
            { key: 'prog', label: 'Chương trình', sort: r => r.p.code, cell: r => r.p.code ?? '—' },
            { key: 'grade', label: 'Cấp học · Khối', cell: r => gradesText(cat, r.p.grades) },
            { key: 'lessons', label: 'Số bài', sum: 'sum', sort: r => r.c?.course_lessons.length ?? 0, cell: r => r.c?.course_lessons.length ?? 0 },
            { key: 'mat', label: 'Bài có học liệu', sum: 'frac', sort: r => (stat.get(r.p.id)?.ok ?? 0), cell: r => { const s = stat.get(r.p.id) ?? { ok: 0, lessons: 0 }; return `${s.ok}/${s.lessons}` } },
            { key: 'learn', label: 'Học viên', sum: 'sum', sort: r => learnersOf(r.c).n, cell: r => learnersOf(r.c).n },
            { key: 'done', label: '% hoàn thành', sort: r => learnersOf(r.c).done, cell: r => r.c ? learnersOf(r.c).done + '%' : '—' },
            { key: 'status', label: 'Trạng thái', sum: 'status', sort: r => r.c?.status ?? 'none', cell: r => r.c ? <StatusPill s={r.c.status} /> : <span className="pill draft plain">Chưa tạo</span> },
          ]} />
    }</>
      : <DataTable id="el-test" rows={exams.filter(e => !eq || norm(e.title).includes(norm(eq)))} search={{ value: eq, onChange: setEq, placeholder: 'Tìm…' }} rowKey={e => e.id} noun="đề luyện" onOpen={e => setOpenExam(e.id)}
        empty={<Empty>Chưa có đề luyện — tạo ở “Quản lý chi tiết”.</Empty>}
        bulk={[{ label: 'Phát hành', run: setSt('practice_exams', 'published', 'Đã phát hành') }, { label: 'Đóng', run: setSt('practice_exams', 'closed', 'Đã đóng') }]}
        cols={[
          { key: 'title', label: 'Đề luyện', name: true, sort: e => e.title, cell: e => <b>{e.title}</b> },
          { key: 'subj', label: 'Môn', sort: e => catName(cat, 'subject', e.subject) || e.subject, cell: e => catName(cat, 'subject', e.subject) || e.subject || '—' },
          { key: 'kind', label: 'Loại', sort: e => e.mode, cell: e => e.mode === 'fixed' ? 'Đề cố định' : 'Đề ngẫu nhiên' },
          { key: 'q', label: 'Số câu · thời gian', sort: e => qOf(e), cell: e => `${qOf(e)} câu` }, // TODO: practice_exams chưa có thời gian làm bài
          { key: 'att', label: 'Lượt làm', sum: 'sum', sort: e => atts.filter(a => a.exam_id === e.id && a.status === 'submitted').length, cell: e => atts.filter(a => a.exam_id === e.id && a.status === 'submitted').length },
          { key: 'avg', label: 'Điểm TB', sum: false, sort: e => { const sc = atts.filter(a => a.exam_id === e.id && a.status === 'submitted' && a.score != null); return sc.length ? sc.reduce((x, a) => x + Number(a.score), 0) / sc.length : null },
            cell: e => { const sc = atts.filter(a => a.exam_id === e.id && a.status === 'submitted' && a.score != null); return sc.length ? (sc.reduce((x, a) => x + Number(a.score), 0) / sc.length).toFixed(1) : '—' } },
          { key: 'date', label: 'Hạn làm', date: true, sort: e => e.closes_at ? new Date(e.closes_at).toLocaleDateString('vi-VN') : null, cell: e => e.closes_at ? new Date(e.closes_at).toLocaleDateString('vi-VN') : 'Không hạn' },
          { key: 'status', label: 'Trạng thái', sum: 'status', sort: e => e.status, cell: e => e.status === 'closed' ? <span className="pill warn">Đã đóng</span> : <StatusPill s={e.status} /> },
        ]} />}
    <p className="note">Chi tiết khoá học, cấu hình đề và ngân hàng câu hỏi: <button type="button" className="linkbtn" onClick={() => setManage(true)}>Quản lý chi tiết ›</button></p>
  </Mau>
}
