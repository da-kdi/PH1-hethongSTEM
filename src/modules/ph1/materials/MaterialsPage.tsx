import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { Tabs } from '../../../pages/teacher/common'
import {
  CtBadge, Drawer, Empty, Mini, Pill, Section, Stat, StatusTabs, Thumb, Toolbar, VCard, errMsg, norm, timeAgo, useRpcBool, useViewMode,
} from '../ui'
import { Drill, useDrill } from '../drill'
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
const FILE_KIND: Record<string, [string, string]> = { giao_an: ['Giáo án / KHBD', '📘'], huong_dan: ['Hướng dẫn giáo viên', '🧭'], phieu_hoc_tap: ['Phiếu học tập', '📝'],
  hinh_anh: ['Hình ảnh', '🖼️'], video: ['Video', '🎬'], tham_khao: ['Tài liệu tham khảo', '📎'] }
export const SET_STATUS: Record<string, [string, '' | 'good' | 'warn' | 'info']> = { draft: ['Bản nháp', ''], review: ['Đang thẩm định', 'warn'], published: ['Đã phát hành', 'good'], archived: ['Ngừng dùng', ''] }

export const needQty = (n: Pick<Norm, 'qty' | 'basis'>, students: number, groups: number, products: number) =>
  n.qty * (n.basis === 'per_product' ? products : n.basis === 'per_group' ? groups : n.basis === 'per_student' ? students : 1)
// Tách mục tiêu thành từng ý để hiển thị dạng danh sách
const points = (s: string | null) => (s ?? '').split(/;\s*|\n+|(?<=\.)\s+(?=[A-ZÀ-Ỹ])/).map(x => x.trim()).filter(Boolean)

type Full = { kind: 'lesson' | 'set'; id: string } | null

// 1.1.2 Học liệu: kho bài học & bộ học liệu theo chương trình / môn / khối; mỗi bài có hoạt động, sản phẩm mẫu, tiêu chí, tài liệu, định mức vật tư
export function MaterialsPage({ orgId, go }: { orgId: string | null; go?: (p: string) => void }) {
  const [sets, setSets] = useState<MSet[]>([])
  const [progs, setProgs] = useState<Curriculum[]>([])
  const [lessons, setLessons] = useState<MLesson[]>([])
  const [counts, setCounts] = useState<{ norms: Map<string, number>; files: Map<string, number> }>({ norms: new Map(), files: new Map() })
  const [tab, setTab] = useState<'lessons' | 'sets'>('lessons')
  const [q, setQ] = useState('')
  const [f, setF] = useState<Record<string, string>>({})
  const [view, setView] = useViewMode('materials')
  const [path, setPath] = useDrill()
  const [preview, setPreview] = useState<string | null>(null)
  const [full, setFull] = useState<Full>(null)
  const [msg, setMsg] = useState(''); const [note, setNote] = useState('')
  const canManage = useRpcBool('curriculum_can_manage')
  const { all, hidden } = useCatalog()
  const { below } = useOrgs(orgId)
  const cat = effectiveCatalog(all, hidden, below)

  async function load() {
    const [s, c, l, n, fl] = await Promise.all([
      supabase.from('material_sets').select('*').order('name'),
      supabase.from('curricula').select('*').order('code'),
      supabase.from('material_lessons').select('*').order('seq'),
      supabase.from('material_norms').select('lesson_id'),
      supabase.from('material_files').select('lesson_id'),
    ])
    if (s.error) return setMsg(errMsg(s.error.message))
    setSets((s.data as MSet[]) ?? []); setProgs((c.data as Curriculum[]) ?? []); setLessons((l.data as MLesson[]) ?? [])
    const cnt = (rows: { lesson_id: string }[] | null) => { const m = new Map<string, number>(); (rows ?? []).forEach(r => m.set(r.lesson_id, (m.get(r.lesson_id) ?? 0) + 1)); return m }
    setCounts({ norms: cnt(n.data as any), files: cnt(fl.data as any) })
  }
  useEffect(() => { load() }, [orgId])

  const setOf = (l: MLesson) => sets.find(s => s.id === l.set_id)
  const progOf = (s?: MSet) => progs.find(p => p.id === s?.curriculum_id)
  async function newSet() {
    const name = prompt('Tên bộ học liệu mới:'); if (!name || !orgId) return
    const { data, error } = await supabase.from('material_sets').insert({ owner_org_id: orgId, name, status: 'draft' }).select('id').single()
    if (error) return setMsg(errMsg(error.message))
    await load(); setFull({ kind: 'set', id: (data as { id: string }).id })
  }
  async function toDesign(l: MLesson) {
    if (!orgId) return
    const [n, fl] = await Promise.all([supabase.from('material_norms').select('*').eq('lesson_id', l.id).order('seq'), supabase.from('material_files').select('title, url').eq('lesson_id', l.id).order('seq')])
    const st = setOf(l); const ss = Array.from(new Set(l.steps.map(s => s.session ?? 1))).sort((a, b) => a - b)
    const { error } = await supabase.from('lesson_designs').insert({ org_id: orgId, title: l.title, subject: st?.subject ?? l.subject_main, grade: st?.grade ?? null, objectives: l.objectives,
      material_lesson_id: l.id, curriculum_lesson_id: l.curriculum_lesson_id, status: 'draft', criteria: l.criteria,
      sessions: (ss.length ? ss : [1]).map(k => ({ title: `Buổi ${k}`, minutes: l.steps.filter(s => (s.session ?? 1) === k).reduce((x, s) => x + (s.minutes ?? 0), 0),
        activities: l.steps.filter(s => (s.session ?? 1) === k).map(s => ({ title: s.title, minutes: s.minutes, teacher: s.teacher, student: s.student, product: '' })) })),
      norms: ((n.data as Norm[]) ?? []).map(x => ({ name: x.name, spec: x.spec, unit: x.unit, qty: Number(x.qty), basis: x.basis, category: x.category })),
      files: ((fl.data as any[]) ?? []).map(x => ({ title: x.title, url: x.url ?? undefined })) })
    if (error) return setMsg(errMsg(error.message))
    setPreview(null); setNote(`Đã tạo giáo án “${l.title}” — xem ở Soạn bài giảng & kho hoạt động.`)
  }

  // ===== Trang đầy đủ =====
  if (full?.kind === 'lesson') { const l = lessons.find(x => x.id === full.id); const s = l && setOf(l)
    if (l && s) return <LessonDetail key={l.id} lessonId={l.id} set={s} prog={progOf(s) ?? null} cat={cat} canEdit={canManage && s.owner_org_id === orgId}
      back={() => { setFull(s ? { kind: 'set', id: s.id } : null); load() }} backLabel={`← ${s.name}`} onAll={() => { setFull(null); load() }} reload={load} /> }
  if (full?.kind === 'set') { const s = sets.find(x => x.id === full.id)
    if (s) return <SetDetail key={s.id} set={s} progs={progs} cat={cat} editable={canManage && s.owner_org_id === orgId} lessons={lessons.filter(l => l.set_id === s.id)}
      counts={counts} onPreview={setPreview} onOpen={id => setFull({ kind: 'lesson', id })} back={() => { setFull(null); load() }} reload={load}
      drawer={preview && <LessonPreview key={preview} lesson={lessons.find(l => l.id === preview)!} set={s} prog={progOf(s) ?? null} cat={cat}
        onClose={() => setPreview(null)} onExpand={() => { setFull({ kind: 'lesson', id: preview }); setPreview(null) }} onDesign={toDesign} />} /> }

  // ===== Lọc =====
  const sOk = (s?: MSet) => !!s && (!f.prog || s.curriculum_id === f.prog) && (!f.grade || String(s.grade) === f.grade) && (!f.subject || s.subject === f.subject)
  const qq = norm(q)
  const lShown = lessons.filter(l => { const s = setOf(l); return sOk(s) && (!f.set || l.set_id === f.set) && (!qq || norm(`${l.title} ${l.objectives ?? ''} ${s?.name ?? ''}`).includes(qq)) })
  const sShown = sets.filter(s => sOk(s) && (!f.status || s.status === f.status) && (!qq || norm(`${s.name} ${s.description ?? ''}`).includes(qq)))
  const grades = Array.from(new Set(sets.map(s => s.grade).filter(g => g != null))) as number[]
  const subjects = Array.from(new Set(sets.map(s => s.subject).filter(Boolean))) as string[]
  const filters = [
    { key: 'prog', label: 'Tất cả chương trình', options: progs.filter(p => sets.some(s => s.curriculum_id === p.id)).map(p => ({ value: p.id, label: `${p.code} · ${p.name}` })) },
    { key: 'grade', label: 'Tất cả khối', options: grades.sort((a, b) => a - b).map(g => ({ value: String(g), label: gradeLabel(g) })) },
    { key: 'subject', label: 'Tất cả môn', options: subjects.map(s => ({ value: s, label: catName(cat, 'subject', s) })) },
    tab === 'lessons' ? { key: 'set', label: 'Mọi bộ học liệu', options: sets.filter(sOk).map(s => ({ value: s.id, label: s.name })) }
      : { key: 'status', label: 'Mọi trạng thái', options: Object.entries(SET_STATUS).map(([k, [l]]) => ({ value: k, label: l })) },
  ]
  // Vẽ danh sách bài (Thẻ / Bảng); nhiều bộ học liệu thì tách theo bộ
  const renderLessons = (list: MLesson[]) => {
    const one = (lShown: MLesson[]) => view === 'grid' ? (
        <div className="p1-grid">{lShown.map(l => { const s = setOf(l); const p = progOf(s)
            return <VCard key={l.id} color={p?.color} code={p?.code} icon="📚" status={<Pill tone={SET_STATUS[s?.status ?? '']?.[1]}>{SET_STATUS[s?.status ?? '']?.[0]}</Pill>}
              title={l.title} subtitle={`${catName(cat, 'subject', s?.subject)}${s?.grade != null ? ' · ' + gradeLabel(s.grade) : ''}`} desc={l.objectives}
              chips={[`${l.periods} tiết`, `${l.sessions} buổi`, counts.norms.get(l.id) ? `${counts.norms.get(l.id)} vật tư` : '', counts.files.get(l.id) ? `${counts.files.get(l.id)} tài liệu` : '']}
              foot={<small>{s?.name}</small>} onClick={() => setPreview(l.id)} /> })}</div>
      ) : (
        <table className="p1-list"><thead><tr><th>Bài học</th><th>CT</th><th>Khối</th><th>Môn</th><th>Thời lượng</th><th>Vật tư</th><th>Tài liệu</th><th>Trạng thái</th><th></th></tr></thead>
            <tbody>{lShown.map(l => { const s = setOf(l); const p = progOf(s)
              return <tr key={l.id} onClick={() => setPreview(l.id)}>
                <td><div className="titlecell"><Thumb color={p?.color} code={p?.code} /><div><b>{l.title}</b><small>{s?.name}</small></div></div></td>
                <td><CtBadge color={p?.color} code={p?.code} /></td><td>{s?.grade != null ? gradeLabel(s.grade) : '—'}</td><td>{catName(cat, 'subject', s?.subject) || '—'}</td>
                <td>{l.periods} tiết · {l.sessions} buổi</td><td>{counts.norms.get(l.id) ?? 0}</td><td>{counts.files.get(l.id) ?? 0}</td>
                <td><Pill tone={SET_STATUS[s?.status ?? '']?.[1]}>{SET_STATUS[s?.status ?? '']?.[0]}</Pill></td>
                <td><div className="p1-iconbtns"><button type="button" title="Xem nhanh" onClick={e => { e.stopPropagation(); setPreview(l.id) }}>👁</button>
                  <button type="button" title="Mở đầy đủ" onClick={e => { e.stopPropagation(); setFull({ kind: 'lesson', id: l.id }) }}>✎</button></div></td>
              </tr> })}</tbody></table>)
    const ids = Array.from(new Set(list.map(l => l.set_id)))
    if (ids.length < 2) return one(list)
    return <>{ids.map(id => { const st = sets.find(x => x.id === id); const ls = list.filter(l => l.set_id === id)
      return <div key={id}><div className="p1-groupband"><h3>{st?.name}</h3><Pill tone={SET_STATUS[st?.status ?? '']?.[1]}>{SET_STATUS[st?.status ?? '']?.[0]}</Pill><small>{ls.length} bài · {ls.reduce((x, l) => x + l.periods, 0)} tiết</small>
        <button type="button" className="linkbtn" onClick={() => setFull({ kind: 'set', id })}>Mở bộ học liệu ›</button></div>{one(ls)}</div> })}</>
  }
  const flat = !!q || Object.values(f).some(Boolean)
  const pl = preview ? lessons.find(l => l.id === preview) : null

  return (
    <>
      <div className="p1-stats">
        <Stat label="Bộ học liệu" value={sets.length} sub={`${sets.filter(s => s.status === 'published').length} đã phát hành`} />
        <Stat label="Bài học" value={lessons.length} sub={`${lessons.reduce((a, l) => a + l.periods, 0)} tiết`} />
        <Stat label="Bài có định mức vật tư" value={lessons.filter(l => counts.norms.get(l.id)).length} />
        <Stat label="Chương trình có học liệu" value={new Set(sets.map(s => s.curriculum_id).filter(Boolean)).size} />
      </div>
      {msg && <p className="msg">{msg}</p>}
      {note && <div className="p1-alert good">{note}{go && <button type="button" onClick={() => go('Soạn bài giảng & kho hoạt động')}>Mở Soạn bài giảng</button>}</div>}
      <div className="bar">
        <StatusTabs items={[['lessons', 'Kho bài học', lessons.length], ['sets', 'Bộ học liệu', sets.length]]} value={tab} onChange={t => { setTab(t); setF({ ...f, set: '', status: '' }) }} />
        {canManage && <button type="button" className="primary" onClick={newSet}>+ Bộ học liệu</button>}
      </div>
      <Toolbar q={q} onQ={setQ} placeholder={tab === 'lessons' ? 'Tìm theo tên bài, mục tiêu, bộ học liệu…' : 'Tìm bộ học liệu…'} filters={filters} values={f}
        onFilter={(k, v) => setF({ ...f, [k]: v })} view={view} onView={setView} />

      {tab === 'lessons' && (flat ? (lShown.length === 0 ? <Empty>Không có bài học phù hợp bộ lọc.</Empty> : renderLessons(lShown))
        : <Drill items={lessons} keyOf={l => { const st = setOf(l); return { prog: st?.curriculum_id ?? null, grade: st?.grade ?? null, subject: st?.subject ?? null } }}
            progs={progs} cat={cat} path={path} setPath={setPath} unit="bài" weight={l => l.periods} weightUnit="tiết" icon="📚" renderItems={renderLessons} />)}

      {tab === 'sets' && (sShown.length === 0 ? <Empty>Không có bộ học liệu phù hợp.</Empty> : view === 'grid' ? (
        <div className="p1-grid">{sShown.map(s => { const p = progOf(s); const ls = lessons.filter(l => l.set_id === s.id)
          return <VCard key={s.id} color={p?.color} code={p?.code} icon="🗂️" status={<Pill tone={SET_STATUS[s.status]?.[1]}>{SET_STATUS[s.status]?.[0]}</Pill>}
            title={s.name} subtitle={`${catName(cat, 'subject', s.subject)}${s.grade != null ? ' · ' + gradeLabel(s.grade) : ''}`} desc={s.description}
            chips={[`${ls.length} bài`, `${ls.reduce((a, l) => a + l.periods, 0)} tiết`, `PB ${s.version_no}`]} foot={<small>cập nhật {timeAgo(s.updated_at)}</small>}
            onClick={() => setFull({ kind: 'set', id: s.id })} /> })}</div>
      ) : (
        <table className="p1-list"><thead><tr><th>Bộ học liệu</th><th>CT</th><th>Khối</th><th>Môn</th><th>Bài</th><th>Trạng thái</th><th>Cập nhật</th></tr></thead>
          <tbody>{sShown.map(s => { const p = progOf(s); const ls = lessons.filter(l => l.set_id === s.id)
            return <tr key={s.id} onClick={() => setFull({ kind: 'set', id: s.id })}>
              <td><div className="titlecell"><Thumb color={p?.color} code={p?.code} /><div><b>{s.name}</b><small>{p ? p.name : 'Chưa gắn chương trình'}</small></div></div></td>
              <td><CtBadge color={p?.color} code={p?.code} /></td><td>{s.grade != null ? gradeLabel(s.grade) : '—'}</td><td>{catName(cat, 'subject', s.subject) || '—'}</td>
              <td>{ls.length} bài · {ls.reduce((a, l) => a + l.periods, 0)} tiết</td><td><Pill tone={SET_STATUS[s.status]?.[1]}>{SET_STATUS[s.status]?.[0]}</Pill></td><td>{timeAgo(s.updated_at)}</td>
            </tr> })}</tbody></table>))}

      {pl && <LessonPreview key={pl.id} lesson={pl} set={setOf(pl)!} prog={progOf(setOf(pl)) ?? null} cat={cat} onClose={() => setPreview(null)}
        onExpand={() => { setFull({ kind: 'lesson', id: pl.id }); setPreview(null) }} onDesign={toDesign} />}
    </>
  )
}

// ===== Bản thu gọn (ngăn bên phải) =====
function LessonPreview({ lesson: l, set, prog, cat, onClose, onExpand, onDesign }: {
  lesson: MLesson; set: MSet; prog: Curriculum | null; cat: CatItem[]; onClose: () => void; onExpand: () => void; onDesign: (l: MLesson) => void
}) {
  const [norms, setNorms] = useState<Norm[]>([]); const [files, setFiles] = useState<File[]>([])
  useEffect(() => {
    supabase.from('material_norms').select('*').eq('lesson_id', l.id).order('seq').then(({ data }) => setNorms((data as Norm[]) ?? []))
    supabase.from('material_files').select('*').eq('lesson_id', l.id).order('seq').then(({ data }) => setFiles((data as File[]) ?? []))
  }, [l.id])
  const sessions = Array.from(new Set(l.steps.map(s => s.session ?? 1))).sort((a, b) => a - b)
  return (
    <Drawer color={prog?.color} onClose={onClose} title={l.title}
      badges={[prog?.code, `${catName(cat, 'subject', set.subject)}${set.grade != null ? ' · ' + gradeLabel(set.grade) : ''}`, `${l.periods} tiết`, `${l.sessions} buổi`]}
      footer={<><span className="note">{set.name}</span><button type="button" onClick={() => onDesign(l)}>Tạo giáo án từ bài này</button><button type="button" className="primary" onClick={onExpand}>Mở rộng ⤢</button></>}>
      {l.objectives && <div className="p1-box goal"><h4>🎯 Mục tiêu bài học</h4><ul className="p1-checks">{points(l.objectives).map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
      <Mini items={[['Thời lượng', `${l.periods} tiết`], ['Hoạt động', l.steps.length], ['Vật tư', norms.length], ['Tài liệu', files.length]]} />
      {l.product_requirements && <div className="p1-box"><h4>🧩 Yêu cầu sản phẩm</h4><p className="p1-text">{l.product_requirements}</p></div>}
      {l.steps.length > 0 && <div className="p1-box"><h4>🪜 Tiến trình</h4>{sessions.map(ss => <div key={ss}>
        <div className="p1-session">Buổi {ss} · {l.steps.filter(s => (s.session ?? 1) === ss).reduce((a, s) => a + (s.minutes ?? 0), 0)} phút</div>
        <ol className="p1-steps">{l.steps.filter(s => (s.session ?? 1) === ss).map((s, i) => <li key={i}><span className="no">{i + 1}</span><div><b>{s.title}</b>
          <div className="meta"><span>⏱ {s.minutes ?? 0} phút</span></div></div></li>)}</ol></div>)}</div>}
      {norms.length > 0 && <div className="p1-box"><h4>🧰 Định mức vật tư</h4>
        <table className="p1-table"><thead><tr><th>Vật tư</th><th>Định mức</th><th>Tính theo</th></tr></thead>
          <tbody>{norms.map(n => <tr key={n.id}><td><b>{n.name}</b>{n.spec && <><br /><small className="sub">{n.spec}</small></>}</td><td>{+n.qty} {n.unit}</td><td>{BASIS[n.basis]}</td></tr>)}</tbody></table></div>}
      {files.length > 0 && <div className="p1-box"><h4>📂 Tài liệu</h4><ul className="p1-checks" style={{ listStyle: 'none' }}>
        {files.map(f => <li key={f.id} style={{ alignItems: 'center' }}>{FILE_KIND[f.kind]?.[1]} {f.url ? <a href={f.url} target="_blank" rel="noreferrer">{f.title}</a> : f.title} <small className="sub">· {FILE_KIND[f.kind]?.[0]}</small></li>)}</ul></div>}
      {l.criteria.length > 0 && <div className="p1-box"><h4>📏 Tiêu chí đánh giá</h4><ul className="p1-checks">{l.criteria.map((c, i) => <li key={i}><span><b>{c.name}</b> — mức cao nhất: {c.levels?.[3] || '—'}</span></li>)}</ul></div>}
    </Drawer>
  )
}

// ===== Trang bộ học liệu =====
function SetDetail({ set, progs, cat, editable, lessons, counts, onPreview, onOpen, back, reload, drawer }: {
  set: MSet; progs: Curriculum[]; cat: CatItem[]; editable: boolean; lessons: MLesson[]; counts: { norms: Map<string, number>; files: Map<string, number> }
  onPreview: (id: string) => void; onOpen: (id: string) => void; back: () => void; reload: () => void; drawer: React.ReactNode
}) {
  const [msg, setMsg] = useState('')
  const [editing, setEditing] = useState(false)
  const [std, setStd] = useState<{ id: string; title: string; periods: number }[]>([])
  const c = progs.find(p => p.id === set.curriculum_id)
  useEffect(() => {
    if (!c?.current_version_id) return
    supabase.from('curriculum_lessons').select('id, title, periods, seq, curriculum_units!inner(subject_main, grade, seq)').eq('version_id', c.current_version_id)
      .then(({ data }) => setStd(((data as any[]) ?? []).filter(x => (!set.subject || x.curriculum_units.subject_main === set.subject) && (set.grade == null || x.curriculum_units.grade === set.grade))
        .sort((a, b) => a.curriculum_units.seq - b.curriculum_units.seq || a.seq - b.seq)))
  }, [c?.current_version_id, set.subject, set.grade])
  const run = async (q: PromiseLike<{ error: { message: string } | null }>) => { const { error } = await q; if (error) setMsg(errMsg(error.message)); else { setMsg(''); reload() } }
  const upd = (p: Partial<MSet>) => run(supabase.from('material_sets').update(p).eq('id', set.id))
  const missing = std.filter(s => !lessons.some(l => l.curriculum_lesson_id === s.id))
  const ed = editable && editing
  return (
    <>
      <button type="button" className="p1-back" onClick={back}>← Tất cả học liệu</button>
      <div className="p1-head">{c && <CtBadge color={c.color} code={c.code} />}<h2>{set.name}</h2><Pill tone={SET_STATUS[set.status]?.[1]}>{SET_STATUS[set.status]?.[0]}</Pill>
        {editable && <button type="button" className={editing ? 'primary' : ''} onClick={() => setEditing(!editing)}>{editing ? 'Xong' : '✎ Sửa'}</button>}
        <p className="p1-sub">{[c && `${c.code} · ${c.name}`, catName(cat, 'subject', set.subject), set.grade != null ? gradeLabel(set.grade) : '', `phiên bản ${set.version_no}`, `cập nhật ${timeAgo(set.updated_at)}`].filter(Boolean).join(' · ')}</p></div>
      {msg && <p className="msg">{msg}</p>}
      <Section title="Thông tin bộ học liệu">
        {!ed ? <dl className="p1-kv">
          <div><dt>Chương trình đáp ứng</dt><dd>{c ? `${c.code} · ${c.name}` : '—'}</dd></div><div><dt>Môn · khối</dt><dd>{catName(cat, 'subject', set.subject) || '—'} · {set.grade != null ? gradeLabel(set.grade) : '—'}</dd></div>
          <div><dt>Trạng thái phát hành</dt><dd>{SET_STATUS[set.status]?.[0]}</dd></div><div><dt>Quy mô</dt><dd>{lessons.length} bài · {lessons.reduce((a, l) => a + l.periods, 0)} tiết</dd></div>
          {set.description && <div className="wide"><dt>Mô tả</dt><dd>{set.description}</dd></div>}
        </dl> : <div className="p1-form">
          <label><span>Tên</span><input defaultValue={set.name} onBlur={e => e.target.value !== set.name && upd({ name: e.target.value })} /></label>
          <label><span>Chương trình đáp ứng</span><select value={set.curriculum_id ?? ''} onChange={e => upd({ curriculum_id: e.target.value || null, version_id: progs.find(p => p.id === e.target.value)?.current_version_id ?? null })}>
            <option value="">—</option>{progs.map(p => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}</select></label>
          <label><span>Môn</span><select value={set.subject ?? ''} onChange={e => upd({ subject: e.target.value || null })}>
            <option value="">—</option>{catOf(cat, 'subject').map(s => <option key={s.id} value={s.code}>{s.name}</option>)}</select></label>
          <label><span>Khối</span><input type="number" min={0} max={12} defaultValue={set.grade ?? ''} onBlur={e => upd({ grade: e.target.value === '' ? null : Number(e.target.value) })} /></label>
          <label><span>Trạng thái phát hành</span><select value={set.status} onChange={e => upd({ status: e.target.value })}>
            {Object.entries(SET_STATUS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label className="wide"><span>Mô tả</span><textarea rows={2} defaultValue={set.description ?? ''} onBlur={e => upd({ description: e.target.value || null })} /></label>
        </div>}
      </Section>
      {missing.length > 0 && <div className="p1-alert warn"><span>Bài trong chương trình chưa có học liệu: {missing.map(m => m.title).join(', ')}.</span>
        {editable && <button type="button" onClick={() => run(supabase.from('material_lessons').insert(missing.map((m, i) => ({ set_id: set.id, curriculum_lesson_id: m.id, seq: lessons.length + i + 1, title: m.title, periods: m.periods }))))}>Tạo bài học liệu</button>}</div>}
      <div className="bar"><h3 style={{ margin: 0 }}>Bài học · {lessons.length}</h3>
        {editable && <button type="button" onClick={() => run(supabase.from('material_lessons').insert({ set_id: set.id, seq: lessons.length + 1, title: 'Bài mới', periods: 1 }))}>+ Bài học</button>}</div>
      {lessons.length === 0 ? <Empty>Bộ học liệu chưa có bài.</Empty> : <div className="p1-grid">{lessons.map(l =>
        <VCard key={l.id} color={c?.color} code={c?.code} icon={`${l.seq}`} title={l.title} subtitle={l.curriculum_lesson_id ? 'Liên kết bài chuẩn trong chương trình' : 'Chưa liên kết chương trình'}
          desc={l.objectives} chips={[`${l.periods} tiết`, `${l.sessions} buổi`, counts.norms.get(l.id) ? `${counts.norms.get(l.id)} vật tư` : '']} onClick={() => onPreview(l.id)}
          foot={<button type="button" className="linkbtn" onClick={e => { e.stopPropagation(); onOpen(l.id) }}>Mở đầy đủ</button>} />)}</div>}
      {drawer}
    </>
  )
}

// ===== Trang đầy đủ của một bài: mặc định chỉ xem, bấm "Sửa" mới chỉnh =====
type LTab = 'info' | 'steps' | 'norms' | 'files' | 'criteria'
export function LessonDetail({ lessonId, set, prog, cat, canEdit, back, backLabel, onAll, reload }: {
  lessonId: string; set: MSet; prog: Curriculum | null; cat: CatItem[]; canEdit: boolean; back: () => void; backLabel: string; onAll: () => void; reload: () => void
}) {
  const [l, setL] = useState<MLesson | null>(null)
  const [norms, setNorms] = useState<Norm[]>([])
  const [files, setFiles] = useState<File[]>([])
  const [tab, setTab] = useState<LTab>('info')
  const [editing, setEditing] = useState(false)
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
  const editable = canEdit && editing
  const grouped = useMemo(() => Object.keys(NORM_CAT).filter(k => norms.some(n => n.category === k)), [norms])
  if (!l) return <p className="sub">Đang tải…</p>
  const sessions = Array.from(new Set(l.steps.map(s => s.session ?? 1))).sort((a, b) => a - b)
  const setStep = (i: number, p: Partial<Step>) => upd({ steps: l.steps.map((s, j) => j === i ? { ...s, ...p } : s) })

  return (
    <>
      <div className="p1-actions"><button type="button" className="p1-back" onClick={back}>{backLabel}</button><span className="sub">·</span><button type="button" className="p1-back" onClick={onAll}>Tất cả học liệu</button></div>
      <div className="p1-head">{prog && <CtBadge color={prog.color} code={prog.code} />}<h2>{l.title}</h2><Pill>{l.periods} tiết · {l.sessions} buổi</Pill>
        {canEdit && <button type="button" className={editing ? 'primary' : ''} onClick={() => setEditing(!editing)}>{editing ? '✓ Xong' : '✎ Sửa'}</button>}
        <p className="p1-sub">{set.name}{l.subjects_integrated.length ? ' · tích hợp ' + l.subjects_integrated.map(s => catName(cat, 'subject', s)).join(', ') : ''}</p></div>
      {msg && <p className="msg">{msg}</p>}
      <div className="bar"><Tabs items={[['info', 'Thông tin bài'], ['steps', 'Hoạt động', l.steps.length], ['norms', 'Định mức vật tư', norms.length], ['files', 'Tài liệu', files.length], ['criteria', 'Tiêu chí', l.criteria.length]] as [LTab, string, number?][]} value={tab} onChange={setTab} /></div>

      {tab === 'info' && (!editable ? <>
        {l.objectives && <div className="p1-box goal" style={{ marginBottom: 16 }}><h4>🎯 Mục tiêu / yêu cầu cần đạt</h4><ul className="p1-checks">{points(l.objectives).map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
        <Section title="Thông tin bài học"><dl className="p1-kv">
          <div><dt>Mã bài</dt><dd>{l.code ?? '—'}</dd></div><div><dt>Thời lượng</dt><dd>{l.periods} tiết · {l.sessions} buổi</dd></div>
          <div><dt>Môn chủ đạo</dt><dd>{catName(cat, 'subject', l.subject_main) || '—'}</dd></div>
          <div><dt>Môn tích hợp</dt><dd>{l.subjects_integrated.map(s => catName(cat, 'subject', s)).join(', ') || '—'}</dd></div>
          {l.product_requirements && <div className="wide"><dt>Yêu cầu sản phẩm</dt><dd className="p1-text">{l.product_requirements}</dd></div>}
        </dl></Section></> : <Section title="Thông tin bài học"><div className="p1-form">
        <label style={{ gridColumn: 'span 2' }}><span>Tên bài</span><input defaultValue={l.title} onBlur={e => e.target.value && e.target.value !== l.title && upd({ title: e.target.value })} /></label>
        <label><span>Thời lượng (tiết)</span><input type="number" min={0} defaultValue={l.periods} onBlur={e => upd({ periods: Number(e.target.value) || 0 })} /></label>
        <label className="wide"><span>Mục tiêu / yêu cầu cần đạt (mỗi ý một dòng)</span><textarea rows={4} defaultValue={l.objectives ?? ''} onBlur={e => upd({ objectives: e.target.value || null })} /></label>
        <label className="wide"><span>Yêu cầu sản phẩm</span><textarea rows={3} defaultValue={l.product_requirements ?? ''} onBlur={e => upd({ product_requirements: e.target.value || null })} /></label>
      </div>
      <details className="p1-adv"><summary>Thiết lập nâng cao (mã bài, số buổi, môn chủ đạo / tích hợp)</summary><div className="p1-form">
        <label><span>Mã bài</span><input defaultValue={l.code ?? ''} onBlur={e => upd({ code: e.target.value || null })} /></label>
        <label><span>Số buổi</span><input type="number" min={1} defaultValue={l.sessions} onBlur={e => upd({ sessions: Math.max(1, Number(e.target.value) || 1) })} /></label>
        <label><span>Môn chủ đạo</span><select value={l.subject_main ?? ''} onChange={e => upd({ subject_main: e.target.value || null })}><option value="">—</option>
          {catOf(cat, 'subject').map(s => <option key={s.id} value={s.code}>{s.name}</option>)}</select></label>
        <div className="wide"><span className="sub">Môn tích hợp</span><div className="p1-chiprow">{catOf(cat, 'subject').filter(s => s.code !== l.subject_main).map(s => { const on = l.subjects_integrated.includes(s.code)
          return <button type="button" key={s.id} className={on ? 'on' : ''} onClick={() => upd({ subjects_integrated: on ? l.subjects_integrated.filter(x => x !== s.code) : [...l.subjects_integrated, s.code] })}>{s.name}</button> })}</div></div>
      </div></details></Section>)}

      {tab === 'steps' && <Section title="Hoạt động & các bước thực hiện" actions={editable && <button type="button" onClick={() => upd({ steps: [...l.steps, { session: sessions[sessions.length - 1] ?? 1, title: 'Hoạt động mới', minutes: 10, teacher: '', student: '' }] })}>+ Hoạt động</button>}>
        {l.steps.length === 0 ? <Empty>Chưa có hoạt động.</Empty> : sessions.map(ss => (<div key={ss}>
          <div className="p1-session">Buổi {ss} · {l.steps.filter(s => (s.session ?? 1) === ss).reduce((a, s) => a + (s.minutes ?? 0), 0)} phút</div>
          <ol className="p1-steps">{l.steps.map((s, i) => (s.session ?? 1) !== ss ? null : (
            <li key={i}><span className="no">{l.steps.slice(0, i + 1).filter(x => (x.session ?? 1) === ss).length}</span>
              <div>{editable ? <input className="p1-in" defaultValue={s.title} onBlur={e => setStep(i, { title: e.target.value })} aria-label="Tên hoạt động" style={{ width: '100%' }} /> : <b>{s.title}</b>}
                <div className="meta">{editable ? <>
                  <label>Buổi <input type="number" min={1} style={{ width: 60 }} defaultValue={s.session ?? 1} onBlur={e => setStep(i, { session: Math.max(1, Number(e.target.value) || 1) })} /></label>
                  <label>Phút <input type="number" min={0} style={{ width: 70 }} defaultValue={s.minutes ?? ''} onBlur={e => setStep(i, { minutes: Number(e.target.value) || 0 })} /></label>
                  <button type="button" className="danger" onClick={() => upd({ steps: l.steps.filter((_, j) => j !== i) })}>Xoá</button></> : <span>⏱ {s.minutes ?? 0} phút</span>}</div>
                {editable ? <div className="p1-form" style={{ marginTop: 8 }}>
                  <label><span>Giáo viên</span><textarea rows={2} defaultValue={s.teacher ?? ''} onBlur={e => setStep(i, { teacher: e.target.value })} /></label>
                  <label><span>Học sinh</span><textarea rows={2} defaultValue={s.student ?? ''} onBlur={e => setStep(i, { student: e.target.value })} /></label>
                </div> : (s.teacher || s.student) && <div className="who">{s.teacher && <div><b>Giáo viên</b>{s.teacher}</div>}{s.student && <div><b>Học sinh</b>{s.student}</div>}</div>}
              </div></li>))}</ol></div>))}
      </Section>}

      {tab === 'norms' && <>
        <Section title="Tính nhu cầu vật tư cho một lớp">
          <div className="p1-form" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
            <label><span>Số học sinh</span><input type="number" min={1} value={calc.students} onChange={e => setCalc({ ...calc, students: Number(e.target.value) || 0 })} /></label>
            <label><span>Số nhóm</span><input type="number" min={1} value={calc.groups} onChange={e => setCalc({ ...calc, groups: Number(e.target.value) || 0, products: Number(e.target.value) || 0 })} /></label>
            <label><span>Số sản phẩm</span><input type="number" min={1} value={calc.products} onChange={e => setCalc({ ...calc, products: Number(e.target.value) || 0 })} /></label>
          </div>
          <p className="sub" style={{ margin: '8px 0 0' }}>Mặc định mỗi nhóm làm một sản phẩm; đổi số sản phẩm nếu mỗi học sinh làm một sản phẩm.</p>
        </Section>
        <Section title="Định mức vật tư" actions={editable && <button type="button" onClick={() => run(supabase.from('material_norms').insert({ lesson_id: lessonId, seq: norms.length + 1, name: 'Vật tư mới', unit: 'cái', qty: 1 }))}>+ Dòng vật tư</button>}>
          {norms.length === 0 ? <Empty>Chưa có định mức.</Empty> : grouped.map(k => (
            <div key={k} style={{ marginBottom: 14 }}><div className="p1-session">{NORM_CAT[k]}</div>
              {!editable ? <table className="p1-table"><thead><tr><th>Vật tư</th><th>Quy cách</th><th>Định mức</th><th>Tính theo</th><th>Thay thế</th><th style={{ textAlign: 'right' }}>Cần cho lớp</th></tr></thead>
                <tbody>{norms.filter(n => n.category === k).map(n => <tr key={n.id}><td><b>{n.name}</b></td><td>{n.spec ?? '—'}</td><td>{+n.qty} {n.unit}</td>
                  <td>{BASIS[n.basis]}</td><td>{n.substitute ?? '—'}</td><td style={{ textAlign: 'right' }}><b>{+needQty(n, calc.students, calc.groups, calc.products).toFixed(2)}</b> {n.unit}</td></tr>)}</tbody></table>
              : <table className="p1-table"><thead><tr><th>Vật tư</th><th>Quy cách</th><th>Đơn vị</th><th>Định mức</th><th>Tính theo</th><th>Loại</th><th>Thay thế</th><th></th></tr></thead>
                <tbody>{norms.filter(n => n.category === k).map(n => { const u = (p: Partial<Norm>) => run(supabase.from('material_norms').update(p).eq('id', n.id))
                  return <tr key={n.id}>
                    <td style={{ minWidth: 160 }}><input defaultValue={n.name} onBlur={e => u({ name: e.target.value })} aria-label="Tên" /></td>
                    <td style={{ minWidth: 150 }}><input defaultValue={n.spec ?? ''} onBlur={e => u({ spec: e.target.value || null })} aria-label="Quy cách" /></td>
                    <td className="num"><input defaultValue={n.unit} onBlur={e => u({ unit: e.target.value })} aria-label="Đơn vị" /></td>
                    <td className="num"><input type="number" min={0} step="any" defaultValue={n.qty} onBlur={e => u({ qty: Number(e.target.value) || 0 })} aria-label="Số lượng" /></td>
                    <td><select value={n.basis} onChange={e => u({ basis: e.target.value })} aria-label="Tính theo">{Object.entries(BASIS).map(([b, t]) => <option key={b} value={b}>{t}</option>)}</select></td>
                    <td><select value={n.category} onChange={e => u({ category: e.target.value })} aria-label="Loại">{Object.entries(NORM_CAT).map(([c, t]) => <option key={c} value={c}>{t}</option>)}</select></td>
                    <td style={{ minWidth: 140 }}><input defaultValue={n.substitute ?? ''} onBlur={e => u({ substitute: e.target.value || null })} aria-label="Thay thế" /></td>
                    <td><button type="button" className="danger" onClick={() => run(supabase.from('material_norms').delete().eq('id', n.id))}>Xoá</button></td>
                  </tr> })}</tbody></table>}</div>))}
        </Section>
      </>}

      {tab === 'files' && <Section title="Tài liệu bài dạy" actions={editable && <button type="button" onClick={() => run(supabase.from('material_files').insert({ lesson_id: lessonId, seq: files.length + 1, kind: 'tham_khao', title: 'Tài liệu mới' }))}>+ Tài liệu</button>}>
        {files.length === 0 ? <Empty>Chưa có tài liệu.</Empty> : !editable ? <ul className="p1-checks" style={{ gap: 10 }}>{files.map(f => <li key={f.id} style={{ alignItems: 'center' }}>
          <span>{FILE_KIND[f.kind]?.[1]} {f.url ? <a href={f.url} target="_blank" rel="noreferrer">{f.title}</a> : <b>{f.title}</b>} <small className="sub">· {FILE_KIND[f.kind]?.[0]}{!f.url ? ' · chưa có đường dẫn' : ''}</small></span></li>)}</ul>
          : <table className="p1-table"><thead><tr><th>Loại</th><th>Tên</th><th>Đường dẫn</th><th></th></tr></thead>
            <tbody>{files.map(f => { const u = (p: Partial<File>) => run(supabase.from('material_files').update(p).eq('id', f.id))
              return <tr key={f.id}><td><select value={f.kind} onChange={e => u({ kind: e.target.value })} aria-label="Loại">{Object.entries(FILE_KIND).map(([k, [t]]) => <option key={k} value={k}>{t}</option>)}</select></td>
                <td><input defaultValue={f.title} onBlur={e => u({ title: e.target.value })} aria-label="Tên" /></td>
                <td><input defaultValue={f.url ?? ''} placeholder="https://…" onBlur={e => u({ url: e.target.value || null })} aria-label="Đường dẫn" /></td>
                <td><button type="button" className="danger" onClick={() => run(supabase.from('material_files').delete().eq('id', f.id))}>Xoá</button></td></tr> })}</tbody></table>}
      </Section>}

      {tab === 'criteria' && <Section title="Tiêu chí đánh giá sản phẩm" actions={editable && <button type="button" onClick={() => upd({ criteria: [...l.criteria, { name: 'Tiêu chí mới', levels: ['', '', '', ''] }] })}>+ Tiêu chí</button>}>
        {l.criteria.length === 0 ? <Empty>Chưa có tiêu chí.</Empty> : <table className="p1-table"><thead><tr><th>Tiêu chí</th><th>Mức 1</th><th>Mức 2</th><th>Mức 3</th><th>Mức 4</th>{editable && <th></th>}</tr></thead>
          <tbody>{l.criteria.map((c, i) => <tr key={i}>
            <td>{editable ? <input defaultValue={c.name} onBlur={e => upd({ criteria: l.criteria.map((x, j) => j === i ? { ...x, name: e.target.value } : x) })} aria-label="Tiêu chí" /> : <b>{c.name}</b>}</td>
            {[0, 1, 2, 3].map(m => <td key={m}>{editable ? <input defaultValue={c.levels?.[m] ?? ''} aria-label={`Mức ${m + 1}`}
              onBlur={e => upd({ criteria: l.criteria.map((x, j) => j === i ? { ...x, levels: [0, 1, 2, 3].map(z => z === m ? e.target.value : x.levels?.[z] ?? '') } : x) })} /> : c.levels?.[m] || '—'}</td>)}
            {editable && <td><button type="button" className="danger" onClick={() => upd({ criteria: l.criteria.filter((_, j) => j !== i) })}>Xoá</button></td>}
          </tr>)}</tbody></table>}
      </Section>}
    </>
  )
}
