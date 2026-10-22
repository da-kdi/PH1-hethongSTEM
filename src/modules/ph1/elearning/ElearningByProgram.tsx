import { lazy, Suspense, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { Tabs } from '../../../pages/teacher/common'
import { Code, Empty, Pill, Section, VCard, errMsg } from '../ui'
import type { Curriculum } from '../curriculum/api'

const ElearningManage = lazy(() => import('../../../pages/elearning/Manage'))

type Course = { id: string; org_id: string; title: string; description: string | null; subject: string | null; grade: number | null; status: string
  curriculum_id: string | null; package_id: string | null; material_set_id: string | null; course_lessons: { id: string }[] }
type MSet = { id: string; name: string; curriculum_id: string | null; grade: number | null; subject: string | null }

// 1.1.6 E-learning & luyện thi: khoá học trực tuyến theo chương trình / gói, tạo nhanh từ bộ học liệu (tái sử dụng học liệu);
// tab "Quản lý khoá học, đề, ngân hàng câu hỏi" là màn e-learning sẵn có (053).
export function ElearningByProgram(props: { orgId: string | null; teacherId?: string | null }) {
  const [tab, setTab] = useState<'program' | 'manage'>('program')
  return (<>
    <div className="bar"><Tabs items={[['program', 'Theo chương trình & gói'], ['manage', 'Khoá học, đề luyện, ngân hàng câu hỏi']] as ['program' | 'manage', string][]} value={tab} onChange={setTab} /></div>
    {tab === 'program' ? <ByProgram orgId={props.orgId} onManage={() => setTab('manage')} /> : <Suspense fallback={<p className="sub">Đang tải…</p>}><ElearningManage {...props} /></Suspense>}
  </>)
}

function ByProgram({ orgId, onManage }: { orgId: string | null; onManage: () => void }) {
  const setTab = (_: string) => onManage()
  const [courses, setCourses] = useState<Course[]>([])
  const [progs, setProgs] = useState<Curriculum[]>([])
  const [pkgs, setPkgs] = useState<{ id: string; name: string }[]>([])
  const [sets, setSets] = useState<MSet[]>([])
  const [pick, setPick] = useState('')
  const [msg, setMsg] = useState(''); const [note, setNote] = useState('')
  async function load() {
    const [c, p, k, s] = await Promise.all([
      supabase.from('courses').select('id, org_id, title, description, subject, grade, status, curriculum_id, package_id, material_set_id, course_lessons(id)').order('title'),
      supabase.from('curricula').select('*').order('code'),
      supabase.from('program_packages').select('id, name'),
      supabase.from('material_sets').select('id, name, curriculum_id, grade, subject').neq('status', 'archived'),
    ])
    if (c.error) return setMsg(errMsg(c.error.message))
    setCourses((c.data as Course[]) ?? []); setProgs((p.data as Curriculum[]) ?? []); setPkgs((k.data as any[]) ?? []); setSets((s.data as MSet[]) ?? [])
  }
  useEffect(() => { load() }, [orgId])
  async function fromSet() {
    const s = sets.find(x => x.id === pick); if (!s || !orgId) return
    const { data, error } = await supabase.from('courses').insert({ org_id: orgId, title: `Học trực tuyến – ${s.name}`, description: 'Tạo từ bộ học liệu; bổ sung video, bài đọc, đề luyện ở tab quản lý.',
      grade: s.grade && s.grade > 0 ? s.grade : null, status: 'draft', curriculum_id: s.curriculum_id, material_set_id: s.id }).select('id').single()
    if (error) return setMsg(errMsg(error.message))
    const ls = await supabase.from('material_lessons').select('seq, title, objectives').eq('set_id', s.id).order('seq')
    const rows = ((ls.data as any[]) ?? []).map(l => ({ course_id: (data as { id: string }).id, position: l.seq, title: l.title, kind: 'reading', body: l.objectives || l.title, duration_min: 15 }))
    if (rows.length) { const r = await supabase.from('course_lessons').insert(rows); if (r.error) return setMsg(errMsg(r.error.message)) }
    setNote(`Đã tạo khoá học từ “${s.name}” với ${rows.length} bài (bản nháp).`); setPick(''); load()
  }
  async function remove(x: Course) {
    if (!confirm(`Xoá khoá học “${x.title}” cùng ${x.course_lessons.length} bài?`)) return
    const { error } = await supabase.from('courses').delete().eq('id', x.id); if (error) return setMsg(errMsg(error.message)); setNote('Đã xoá khoá học.'); load()
  }
  const groups = [...progs.filter(c => courses.some(x => x.curriculum_id === c.id)).map(c => ({ key: c.id, c })), { key: '_', c: null as Curriculum | null }]
  return (
    <>
      {msg && <p className="msg">{msg}</p>}
      {note && <p className="sub"><b>{note}</b></p>}
      <Section title="Tạo khoá học từ bộ học liệu" actions={<>
        <select value={pick} onChange={e => setPick(e.target.value)} aria-label="Bộ học liệu"><option value="">— Chọn bộ học liệu —</option>{sets.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <button type="button" className="primary" disabled={!pick} onClick={fromSet}>Tạo khoá học</button></>}>
        <p className="sub" style={{ margin: 0 }}>Khoá học tái sử dụng bài học trong học liệu; không bắt buộc mọi bài trực tiếp đều có phiên bản trực tuyến.</p>
      </Section>
      {groups.map(({ key, c }) => { const cs = courses.filter(x => (x.curriculum_id ?? '_') === key); if (!cs.length) return null
        return <Section key={key} title={c ? <><Code color={c.color}>{c.code}</Code> {c.name}</> : 'Khoá học chưa gắn chương trình'}>
          <div className="p1-grid">{cs.map(x => <div key={x.id} className="p1-cardwrap"><VCard color={c?.color} code={c?.code} icon="🎓" status={<Pill tone={x.status === 'published' ? 'good' : ''}>{x.status === 'published' ? 'Đã phát hành' : x.status === 'archived' ? 'Lưu trữ' : 'Bản nháp'}</Pill>}
            title={x.title} subtitle={x.grade ? `Lớp ${x.grade}` : undefined} desc={x.description}
            chips={[`${x.course_lessons.length} bài`, x.package_id ? pkgs.find(p => p.id === x.package_id)?.name ?? '' : '', x.material_set_id ? `Từ ${sets.find(s => s.id === x.material_set_id)?.name ?? 'học liệu'}` : '']}
            onClick={() => setTab('manage')} more="Quản lý khoá học ›" />
            {x.org_id === orgId && <button type="button" className="danger p1-carddel" onClick={() => remove(x)}>Xoá</button>}</div>)}</div></Section> })}
      {courses.length === 0 && <Empty>Chưa có khoá học trực tuyến.</Empty>}
    </>
  )
}
