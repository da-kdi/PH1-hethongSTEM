import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '../../../lib/supabase'
import { errMsg, norm, timeAgo, useRpcBool } from '../ui'
import { OPEN_LESSON_KEY, catName, catOf, effectiveCatalog, gradeLabel, inUseOf, newerOf, useCatalog, useOrgs, type CatItem, type Curriculum, type MStatus } from '../curriculum/api'
import { gradesText, groupOfCur } from '../curriculum/CurriculumPage'
import { Confirm, Cover, Empty, Flow, Ic, Mau, PageHead, Search, Seg, Sel, StatCard, StatusPill, cssVar } from '../mau/kit'

// 1.1.2 Học liệu — dựng theo bản mẫu giao diện (ph1-chuong-trinh-mau.html, 28/10/2026):
//   Danh sách: mỗi bài học của chương trình có một học liệu; gom theo Nhóm chương trình › Chương trình; Bảng | Thẻ; chuỗi bước
//   Tạo học liệu → Soạn & chốt 4 nhóm → Phát hành phiên bản (bấm để lọc theo trạng thái).
//   Chi tiết: thanh phiên bản (chọn PB, dùng PB này, phát hành khi đủ 4 nhóm đã chốt, tạo PB mới, ngừng dùng, xoá PB) và 4 nhóm theo mẫu giáo án KDI:
//   Thông tin bài học · Nội dung bài học (Buổi › Hoạt động › Mục › ý) · Link học liệu · Định mức vật tư · Bài giảng soạn từ học liệu. Cột mới: migration 064.

export type Step = { session?: number; title: string; minutes?: number; teacher?: string; student?: string; product?: string }
type Part = { title: string; items: string[] }
type Act = { title: string; minutes: number; parts: Part[] }
type Sess = { title: string; note: string; acts: Act[] }
type Integ = { main: string[]; others: { subject: string; items: string[] }[] }
type Doc = { written: [string, string][]; reviewed: [string, string][]; edited: [string, string][] }
type G4 = 'info' | 'content' | 'links' | 'norms'
export type MLesson = { id: string; set_id: string; curriculum_lesson_id: string | null; seq: number; code: string | null; title: string; periods: number; sessions: number
  objectives: string | null; subject_main: string | null; subjects_integrated: string[]; product_requirements: string | null
  steps: Step[]; criteria: { name: string; levels: string[] }[]; notes: string | null
  family_id: string; version_no: number; status: MStatus; change_note: string | null; published_at: string | null
  description?: string | null; integration?: Integ; doc_info?: Doc; plan?: Sess[]; groups?: Partial<Record<G4, string>> }
export type Norm = { id: string; lesson_id: string; seq: number; category: string; name: string; spec: string | null; unit: string; qty: number; basis: string; consumable: boolean; substitute: string | null }
type File = { id: string; lesson_id: string; seq: number; kind: string; title: string; url: string | null }
type MSet = { id: string; owner_org_id: string; curriculum_id: string | null; subject: string | null; grade: number | null }
type CL = { id: string; title: string; periods: number; sessions: number; version_id: string; subject: string | null; useq: number; seq: number }

export const BASIS: Record<string, string> = { per_product: 'mỗi sản phẩm', per_group: 'mỗi nhóm', per_student: 'mỗi học sinh', per_class: 'mỗi lớp' }
export const NORM_CAT: Record<string, string> = { vat_tu: 'Nguyên vật liệu', dung_cu: 'Dụng cụ', thiet_bi: 'Thiết bị dùng chung' }
const FILE_KIND: Record<string, string> = { bai_giang: 'Bài giảng', phieu_hoc_tap: 'Phiếu học tập', video: 'Video', tham_khao: 'Tài liệu tham khảo', giao_an: 'Giáo án / KHBD', huong_dan: 'Hướng dẫn giáo viên', hinh_anh: 'Hình ảnh' }
export const needQty = (n: Pick<Norm, 'qty' | 'basis'>, students: number, groups: number, products: number) =>
  n.qty * (n.basis === 'per_product' ? products : n.basis === 'per_group' ? groups : n.basis === 'per_student' ? students : 1)
const G4: [G4, string][] = [['info', 'Thông tin bài học'], ['content', 'Nội dung bài học'], ['links', 'Link học liệu'], ['norms', 'Định mức vật tư']]
const lines = (s: string | null | undefined) => (s ?? '').split('\n').map(x => x.trim()).filter(Boolean)
const MS: Record<string, [string, string]> = { draft: ['Nháp', 'draft'], published: ['Đã phát hành', 'good'], archived: ['Ngừng dùng', 'warn'] }
type Mat = 'none' | 'draft' | 'ok'
const matOf = (v: MLesson | null): Mat => !v ? 'none' : v.status === 'published' ? 'ok' : 'draft'
function MatPill({ v }: { v: MLesson | null }) { const m = matOf(v)
  return m === 'ok' ? <span className="pill good plain" title={`Phiên bản đang dùng: PB ${v!.version_no}`}>Đủ</span> : m === 'draft' ? <span className="pill warn plain" title={`Phiên bản đang dùng: PB ${v!.version_no}`}>Đang soạn</span> : <span className="pill draft plain">Chưa có</span> }
function GDots({ v }: { v: MLesson }) { return <span className="gdots">{G4.map(([k, n]) => <i key={k} className={v.groups?.[k] === 'ok' ? 'ok' : ''} title={`${n}: ${v.groups?.[k] === 'ok' ? 'Đã chốt' : 'Cần kiểm tra'}`} />)}</span> }
// Nội dung bài học: dùng plan; học liệu cũ chỉ có steps thì dựng tạm Buổi › Hoạt động từ steps
const planOf = (l: MLesson): Sess[] => l.plan?.length ? l.plan : Array.from(new Set(l.steps.map(s => s.session ?? 1))).sort((a, b) => a - b).map(k => ({ title: `Buổi ${k}`, note: '',
  acts: l.steps.filter(s => (s.session ?? 1) === k).map(s => ({ title: s.title, minutes: s.minutes ?? 0, parts: [{ title: '', items: [...(s.teacher ? ['GV: ' + s.teacher] : []), ...(s.student ? ['HS: ' + s.student] : [])] }] })) }))
const stepsOf = (plan: Sess[]): Step[] => plan.flatMap((se, si) => se.acts.map(a => { const its = a.parts.flatMap(p => p.items).filter(t => !t.startsWith('[Hình]'))
  return { session: si + 1, title: a.title, minutes: a.minutes, teacher: its.filter(t => /^(GV|Giáo viên)/.test(t)).join('\n'), student: its.filter(t => /^(HS|Học sinh)/.test(t)).join('\n') } }))

export function MaterialsPage({ orgId, go }: { orgId: string | null; go?: (p: string) => void }) {
  const [progs, setProgs] = useState<Curriculum[]>([])
  const [sets, setSets] = useState<MSet[]>([])
  const [allL, setAllL] = useState<MLesson[]>([])
  const [chosen, setChosen] = useState<Map<string, string>>(new Map())
  const [cls, setCls] = useState<CL[]>([])
  const [open, setOpen] = useState<string | null>(null)       // id phiên bản học liệu đang mở
  const [q, setQ] = useState('')
  const [f, setF] = useState({ grp: '', prog: '', subj: '', grade: '', fs: '' })
  const [mode, setMode] = useState<'table' | 'grid'>(() => { try { return (localStorage.getItem('ph1.hl.mode') as 'table' | 'grid') || 'table' } catch { return 'table' } })
  const [shut, setShut] = useState<Set<string>>(new Set())
  const [msg, setMsg] = useState('')
  const canManage = useRpcBool('curriculum_can_manage')
  const { all, hidden } = useCatalog()
  const { below } = useOrgs(orgId)
  const cat = effectiveCatalog(all, hidden, below)

  async function load() {
    const [c, s, l, u] = await Promise.all([
      supabase.from('curricula').select('*').order('code'),
      supabase.from('material_sets').select('id, owner_org_id, curriculum_id, subject, grade'),
      supabase.from('material_lessons').select('*').order('seq'),
      orgId ? supabase.from('material_in_use').select('family_id, lesson_id').eq('org_id', orgId) : Promise.resolve({ data: [] }),
    ])
    if (c.error) return setMsg(errMsg(c.error.message))
    const ps = ((c.data as Curriculum[]) ?? []).filter(p => p.status !== 'archived')
    setProgs(ps); setSets((s.data as MSet[]) ?? []); setAllL((l.data as MLesson[]) ?? [])
    setChosen(new Map(((u.data as { family_id: string; lesson_id: string }[]) ?? []).map(x => [x.family_id, x.lesson_id])))
    const vids = ps.map(p => p.current_version_id).filter(Boolean) as string[]
    if (!vids.length) return setCls([])
    const r = await supabase.from('curriculum_lessons').select('id, title, periods, sessions, version_id, seq, subject, curriculum_units(seq)').in('version_id', vids)
    setCls(((r.data as any[]) ?? []).map(x => ({ id: x.id, title: x.title, periods: x.periods, sessions: x.sessions ?? 1, version_id: x.version_id, subject: x.subject, useq: x.curriculum_units?.seq ?? 1e6, seq: x.seq }))
      .sort((a, b) => a.useq - b.useq || a.seq - b.seq))
  }
  useEffect(() => { load() }, [orgId])
  // Học liệu (phiên bản đơn vị đang dùng) của một bài học
  const famOfCl = useMemo(() => { const m = new Map<string, string>(); allL.forEach(l => l.curriculum_lesson_id && m.set(l.curriculum_lesson_id, l.family_id)); return m }, [allL])
  const useOf = (clId: string) => { const fam = famOfCl.get(clId); return fam ? inUseOf(allL, fam, chosen) as MLesson | null : null }
  // Mở từ Chương trình giáo dục
  useEffect(() => {
    let id: string | null = null; try { id = sessionStorage.getItem(OPEN_LESSON_KEY) } catch { /* bỏ qua */ }
    if (!id || !cls.length) return
    const cl = cls.find(x => x.id === id); if (!cl) return
    try { sessionStorage.removeItem(OPEN_LESSON_KEY) } catch { /* bỏ qua */ }
    const v = useOf(cl.id); if (v) setOpen(v.id); else if (canManage) createFor(cl); else setMsg(`Bài “${cl.title}” chưa có học liệu.`)
  }, [cls.length, allL.length, canManage])

  const progOfCl = (cl: CL) => progs.find(p => p.current_version_id === cl.version_id)!
  async function createFor(cl: CL) {
    if (!orgId) return
    const p = progOfCl(cl); const grade = p.grades[0] ?? null
    let set = sets.find(s => s.owner_org_id === orgId && s.curriculum_id === p.id && s.subject === cl.subject)
    if (!set) {
      const { data, error } = await supabase.from('material_sets').insert({ owner_org_id: orgId, name: `Học liệu ${p.code ?? ''} · ${catName(cat, 'subject', cl.subject)}`,
        curriculum_id: p.id, version_id: cl.version_id, subject: cl.subject, grade, status: 'draft' }).select('id, owner_org_id, curriculum_id, subject, grade').single()
      if (error) return setMsg(errMsg(error.message)); set = data as MSet
    }
    const { data, error } = await supabase.from('material_lessons').insert({ set_id: set.id, curriculum_lesson_id: cl.id, seq: cl.seq, title: cl.title, periods: cl.periods,
      sessions: Math.min(20, cl.sessions), subject_main: cl.subject, groups: { info: 'check', content: 'check', links: 'check', norms: 'check' } }).select('id').single()
    if (error) return setMsg(errMsg(error.message))
    await load(); setOpen((data as { id: string }).id)
  }

  const ov = open ? allL.find(x => x.id === open) : null
  if (ov) { const cl = cls.find(c => c.id === ov.curriculum_lesson_id) ?? null; const p = cl ? progOfCl(cl) : progs.find(x => sets.find(s => s.id === ov.set_id)?.curriculum_id === x.id) ?? null
    const set = sets.find(s => s.id === ov.set_id)
    return <Mau><MaterialDetail key={ov.family_id} lesson={ov} versions={allL.filter(x => x.family_id === ov.family_id)} inUseId={inUseOf(allL, ov.family_id, chosen)?.id ?? null}
      cl={cl} prog={p} cat={cat} orgId={orgId} canOwn={canManage && set?.owner_org_id === orgId} go={go}
      onSwitch={setOpen} back={() => { setOpen(null); load() }} reload={load} /></Mau> }

  // ===== Danh sách =====
  type Row = { p: Curriculum; cl: CL; v: MLesson | null }
  const rows: Row[] = progs.flatMap(p => cls.filter(c => c.version_id === p.current_version_id).map(cl => ({ p, cl, v: useOf(cl.id) })))
  const qq = norm(q)
  const grpCode = (p: Curriculum) => groupOfCur(cat, p)?.code ?? ''
  const shown = rows.filter(r => (!qq || norm(r.cl.title).includes(qq)) && (!f.grp || grpCode(r.p) === f.grp) && (!f.prog || r.p.id === f.prog) && (!f.subj || r.cl.subject === f.subj)
    && (!f.grade || r.p.grades.includes(Number(f.grade))) && (!f.fs || matOf(r.v) === f.fs))
  const fam = rows.filter(r => r.v); const wait = rows.length - fam.length
  const nNew = fam.filter(r => newerOf(allL, r.v)).length
  const groups = [...catOf(cat, 'category').filter(g => progs.some(p => grpCode(p) === g.code)), ...(progs.some(p => !grpCode(p)) ? [{ code: '', name: 'Chưa xếp nhóm', color: '#94a3b8' } as CatItem] : [])]
  const byGrp = groups.map(g => ({ g, ps: progs.filter(p => grpCode(p) === g.code).map(p => ({ p, rs: shown.filter(r => r.p === p) })).filter(x => x.rs.length) })).filter(x => x.ps.length)
  const allKeys = byGrp.flatMap(x => ['g:' + x.g.code, ...x.ps.map(y => 'p:' + y.p.id)])
  const tog = (k: string, o: boolean) => setShut(s => { const n = new Set(s); o ? n.delete(k) : n.add(k); return n })
  const action = (r: Row) => r.v ? <button type="button" className="btn sm" onClick={() => setOpen(r.v!.id)}>Mở ›</button>
    : canManage ? <button type="button" className="btn sm primary" onClick={() => createFor(r.cl)}><Ic n="plus" /> Tạo học liệu</button> : <span className="sub">Bài chờ</span>
  const tableOf = (rs: Row[]) => <div className="tblwrap"><table><thead><tr><th>STT</th><th>Bài học</th><th>Môn</th><th>Tiết</th><th>Học liệu (PB đang dùng)</th><th>4 nhóm</th><th></th></tr></thead><tbody>
    {rs.map((r, i) => { const nw = newerOf(allL, r.v)
      return <tr key={r.cl.id}><td className="n">{i + 1}</td><td><b>{r.cl.title}</b></td><td>{catName(cat, 'subject', r.cl.subject)}</td><td>{r.cl.periods}</td>
        <td><MatPill v={r.v} />{nw && <> <span className="pill info plain">có PB {nw.version_no}</span></>}</td><td>{r.v ? <GDots v={r.v} /> : '—'}</td><td style={{ textAlign: 'right' }}>{action(r)}</td></tr> })}</tbody></table></div>
  const cardsOf = (rs: Row[], color: string) => <div className="grid hlgrid">{rs.map((r, i) => { const nw = newerOf(allL, r.v)
    return <article key={r.cl.id} className="pcard dcard hlcard" style={cssVar(color)}><Cover subject={r.cl.subject} label={`${catName(cat, 'subject', r.cl.subject)} · ${r.cl.periods} tiết`} code={`Bài ${i + 1}`} /><h3>{r.cl.title}</h3>
      <div className="chips"><MatPill v={r.v} />{nw && <span className="pill info plain">có PB {nw.version_no}</span>}</div>
      <div className="foot"><span>{r.v ? <GDots v={r.v} /> : <span style={{ color: 'var(--faint)' }}>Bài chờ</span>}</span>{action(r)}</div></article> })}</div>
  const n = (k: Mat) => rows.filter(r => matOf(r.v) === k).length

  return <Mau>
    <PageHead icon="file" title="Học liệu" sub="Mỗi bài học có một học liệu, nhiều phiên bản: thông tin, nội dung, link học liệu, định mức vật tư" />
    <Flow steps={[['none', 'Tạo học liệu', `${n('none')} bài chờ học liệu`], ['draft', 'Soạn & chốt 4 nhóm', `${n('draft')} học liệu đang soạn`], ['ok', 'Phát hành phiên bản', `${n('ok')} đã phát hành · bấm lại để bỏ lọc`]] as [Mat, string, string][]}
      value={f.fs as Mat | ''} onChange={k => setF({ ...f, fs: f.fs === k ? '' : k })} />
    {msg && <p className="msg">{msg}</p>}
    <div className="stats">
      <StatCard c="c-blue" icon="file" label="Học liệu" value={fam.length} sub={`trên ${rows.length} bài học`} />
      <StatCard c="c-red" icon="alert" label="Bài chờ" value={wait} sub="chưa có học liệu" />
      <StatCard c="c-green" icon="check" label="Đã phát hành" value={n('ok')} sub="phiên bản đang dùng đã phát hành" />
      <StatCard c="c-amber" icon="history" label="Có bản mới" value={nNew} sub="đơn vị chưa chuyển sang" />
    </div>
    <div className="toolbar">
      <Search value={q} onChange={setQ} placeholder="Tìm bài học…" />
      <Sel label="Tất cả nhóm chương trình" value={f.grp} onChange={v => setF({ ...f, grp: v, prog: '' })} options={groups.filter(g => g.code).map(g => [g.code, `${g.code} · ${g.name}`])} />
      <Sel label="Tất cả chương trình" value={f.prog} onChange={v => setF({ ...f, prog: v })} options={progs.filter(p => !f.grp || grpCode(p) === f.grp).map(p => [p.id, `${p.code ?? ''} · ${p.name}`])} />
      <Sel label="Tất cả môn học" value={f.subj} onChange={v => setF({ ...f, subj: v })} options={Array.from(new Set(cls.map(c => c.subject).filter(Boolean) as string[])).map(s => [s, catName(cat, 'subject', s)])} />
      <Sel label="Tất cả khối" value={f.grade} onChange={v => setF({ ...f, grade: v })} options={Array.from(new Set(progs.flatMap(p => p.grades))).sort((a, b) => a - b).map(g => [String(g), gradeLabel(g)])} />
      <Sel label="Mọi trạng thái" value={f.fs} onChange={v => setF({ ...f, fs: v })} options={[['none', 'Bài chờ'], ['draft', 'Đang soạn'], ['ok', 'Đã phát hành']]} />
      <Seg label="Kiểu xem" items={[['table', 'Bảng'], ['grid', 'Thẻ']]} value={mode} onChange={v => { setMode(v); try { localStorage.setItem('ph1.hl.mode', v) } catch { /* bỏ qua */ } }} />
      <button type="button" className="btn sm ghost" onClick={() => setShut(allKeys.every(k => shut.has(k)) ? new Set() : new Set(allKeys))}>{allKeys.length && allKeys.every(k => shut.has(k)) ? 'Mở tất cả' : 'Thu gọn tất cả'}</button>
    </div>
    {!byGrp.length ? <Empty>Không có bài học phù hợp.</Empty> : byGrp.map(({ g, ps }) => { const k = 'g:' + g.code
      return <details key={k} className="grpbox" open={!shut.has(k)} onToggle={e => tog(k, (e.currentTarget as HTMLDetailsElement).open)} style={cssVar(g.color)}>
        <summary className="grphead"><span className="chev"><Ic n="chev" /></span><span className="dotc" style={cssVar(g.color)} /><b>{g.code ? `${g.code} · ${g.name}` : g.name}</b><small>{ps.length} chương trình · {ps.reduce((a, x) => a + x.rs.length, 0)} bài</small></summary>
        {ps.map(({ p, rs }) => { const kp = 'p:' + p.id; const col = p.color ?? g.color ?? '#64748b'
          return <details key={kp} className="panel dsub" style={{ padding: 0, gap: 0 }} open={!shut.has(kp)} onToggle={e => tog(kp, (e.currentTarget as HTMLDetailsElement).open)}>
            <summary className="phead" style={cssVar(col)}><span className="chev"><Ic n="chev" /></span><span className="code sm">{p.code}</span><b>{p.name}</b><small>{gradesText(cat, p.grades)}</small><span className="act">{rs.filter(r => r.v).length}/{rs.length} bài có học liệu</span></summary>
            {mode === 'grid' ? <div style={{ padding: 12 }}>{cardsOf(rs, col)}</div> : tableOf(rs)}</details> })}
      </details> })}
  </Mau>
}

// ===== Chi tiết học liệu =====
type Tab = G4 | 'designs'
type Ask = { text: string; yes: string; run: () => void }
function MaterialDetail({ lesson, versions, inUseId, cl, prog, cat, orgId, canOwn, go, onSwitch, back, reload }: {
  lesson: MLesson; versions: MLesson[]; inUseId: string | null; cl: CL | null; prog: Curriculum | null; cat: CatItem[]; orgId: string | null; canOwn: boolean
  go?: (p: string) => void; onSwitch: (id: string) => void; back: () => void; reload: () => Promise<void> | void
}) {
  const [l, setL] = useState<MLesson>(lesson)
  const [norms, setNorms] = useState<Norm[]>([]); const [files, setFiles] = useState<File[]>([])
  const [designs, setDesigns] = useState<{ id: string; title: string; status: string; updated_at: string; material_lesson_id: string; org_name?: string }[]>([])
  const [tab, setTab] = useState<Tab>('info')
  const [calc, setCalc] = useState({ students: 35, groups: 7 })
  const [ask, setAsk] = useState<Ask | null>(null)
  const [msg, setMsg] = useState(''); const [note, setNote] = useState('')
  useEffect(() => { setL(lesson) }, [lesson])
  async function loadParts() {
    const [n, fl, d] = await Promise.all([
      supabase.from('material_norms').select('*').eq('lesson_id', l.id).order('seq'),
      supabase.from('material_files').select('*').eq('lesson_id', l.id).order('seq'),
      supabase.from('lesson_designs').select('id, title, status, updated_at, material_lesson_id').in('material_lesson_id', versions.map(v => v.id)).order('created_at'),
    ])
    setNorms((n.data as Norm[]) ?? []); setFiles((fl.data as File[]) ?? []); setDesigns((d.data as any[]) ?? [])
  }
  useEffect(() => { loadParts() }, [l.id])
  const ro = !(canOwn && l.status === 'draft')
  const g = l.groups ?? {}
  const allOk = G4.every(([k]) => g[k] === 'ok')
  const vs = [...versions].sort((a, b) => b.version_no - a.version_no)
  const use = versions.find(v => v.id === inUseId) ?? null
  const nw = newerOf(versions, use)
  const color = prog?.color ?? groupOfCur(cat, prog ?? { category: null, code: null })?.color ?? '#64748b'
  const subj = cl?.subject ?? l.subject_main
  const fail = (e: { message: string } | null) => { if (e) { setMsg(errMsg(e.message)); return true } setMsg(''); return false }
  // Ghi một phần của phiên bản đang soạn (cập nhật tại chỗ, không tải lại cả trang)
  async function upd(p: Partial<MLesson>) { setL(x => ({ ...x, ...p })); const { error } = await supabase.from('material_lessons').update(p).eq('id', l.id); fail(error) }
  const plan = planOf(l)
  const savePlan = (pl: Sess[]) => upd({ plan: pl, steps: stepsOf(pl), sessions: Math.max(1, Math.min(20, pl.length)) })
  const integ: Integ = { main: l.integration?.main ?? [], others: l.integration?.others ?? [] }
  const doc: Doc = { written: l.doc_info?.written ?? [], reviewed: l.doc_info?.reviewed ?? [], edited: l.doc_info?.edited ?? [] }

  const ListView = ({ items }: { items: string[] }) => items.length ? <ul className="galist">{items.map((t, i) => t.startsWith('[Hình]') ? <li key={i} className="img"><Ic n="grid" /><span>{t.slice(6).trim() || 'Hình ảnh'}</span></li>
    : <li key={i} className={t.startsWith('– ') ? 'sub' : ''}>{t.replace(/^– /, '')}</li>)}</ul> : <p className="sub" style={{ margin: 0 }}>—</p>
  const L = (items: string[], save: (v: string[]) => void, ph = 'Mỗi ý một dòng') => ro ? <ListView items={items} />
    : <textarea key={items.join('\n')} className="galines" rows={Math.max(2, items.length + 1)} placeholder={ph} defaultValue={items.join('\n')} onBlur={e => { const v = lines(e.target.value); if (v.join('\n') !== items.join('\n')) save(v) }} />
  const gToggle = (k: G4) => ro ? <span className={'pill ' + (g[k] === 'ok' ? 'good' : 'warn')}>{g[k] === 'ok' ? 'Đã chốt' : 'Cần kiểm tra'}</span>
    : <button type="button" className={'btn sm' + (g[k] === 'ok' ? '' : ' primary')} onClick={() => upd({ groups: { ...g, [k]: g[k] === 'ok' ? 'check' : 'ok' } })}>{g[k] === 'ok' ? 'Đã chốt · bỏ chốt' : <><Ic n="check" /> Chốt nhóm này</>}</button>
  const Head = ({ icon, title, act }: { icon: string; title: string; act?: ReactNode }) => <header><h2><span className="hi"><Ic n={icon} /></span>{title}</h2><span className="act">{act}</span></header>

  async function verAct(fn: () => PromiseLike<{ data?: unknown; error: { message: string } | null }>, ok?: (d: unknown) => void) {
    const r = await fn(); if (fail(r.error)) return; await reload(); ok?.(r.data)
  }
  async function toDesign() {
    if (!orgId) return
    const base = use ?? l
    const [n, fl] = await Promise.all([supabase.from('material_norms').select('*').eq('lesson_id', base.id).order('seq'), supabase.from('material_files').select('title, url').eq('lesson_id', base.id).order('seq')])
    const pl = planOf(base)
    const { error } = await supabase.from('lesson_designs').insert({ org_id: orgId, title: base.title, subject: subj, grade: prog?.grades[0] ?? null, objectives: base.objectives,
      material_lesson_id: base.id, curriculum_lesson_id: base.curriculum_lesson_id, status: 'draft', criteria: base.criteria,
      sessions: pl.map(se => ({ title: se.title, minutes: se.acts.reduce((a, x) => a + x.minutes, 0), activities: stepsOf([se]).map(s => ({ title: s.title, minutes: s.minutes, teacher: s.teacher, student: s.student, product: '' })) })),
      norms: ((n.data as Norm[]) ?? []).map(x => ({ name: x.name, spec: x.spec, unit: x.unit, qty: Number(x.qty), basis: x.basis, category: x.category })),
      files: ((fl.data as any[]) ?? []).map(x => ({ title: x.title, url: x.url ?? undefined })) })
    if (fail(error)) return
    setNote(`Đã tạo bài giảng “${base.title}” từ PB ${base.version_no} — xem ở Soạn bài giảng & kho hoạt động.`); loadParts()
  }

  let body: ReactNode = null
  if (tab === 'info') body = <section className="panel"><Head icon="info" title="Thông tin bài học" act={gToggle('info')} />
    <div className="gahead" style={cssVar(color)}><b>{l.title.toUpperCase()}</b><span>Môn: <b>{catName(cat, 'subject', subj) || '—'}</b></span><span>Khối: <b>{prog?.grades.join(', ') || '—'}</b></span>
      <span>Thời lượng: <b>{l.periods} tiết</b> ({(prog as any)?.minutes_per_period ?? 35} phút/tiết)</span><span>Chương trình: <b>{prog?.code ?? '—'}</b></span></div>
    <div className="gasec"><h3>Mô tả bài học</h3>{ro ? <p className="outcomes">{l.description || '—'}</p> : <textarea rows={3} defaultValue={l.description ?? ''} onBlur={e => e.target.value !== (l.description ?? '') && upd({ description: e.target.value || null })} />}</div>
    <div className="gasec"><h3>Nội dung tích hợp trong bài học</h3>
      <div className="gaint"><div className="gasubj main"><div className="gasubjh"><span className="tag">Môn học chủ đạo</span><b>{catName(cat, 'subject', subj) || '—'}</b></div>{L(integ.main, v => upd({ integration: { ...integ, main: v } }))}</div>
        {integ.others.map((m, i) => <div key={i} className="gasubj"><div className="gasubjh"><span className="tag">Môn học tích hợp</span>{ro ? <b>{m.subject}</b> : <>
          <input defaultValue={m.subject} aria-label="Môn tích hợp" onBlur={e => e.target.value !== m.subject && upd({ integration: { ...integ, others: integ.others.map((x, j) => j === i ? { ...x, subject: e.target.value } : x) } })} />
          <button type="button" className="btn sm ghost" aria-label="Bỏ môn" onClick={() => upd({ integration: { ...integ, others: integ.others.filter((_, j) => j !== i) } })}><Ic n="trash" /></button></>}</div>
          {L(m.items, v => upd({ integration: { ...integ, others: integ.others.map((x, j) => j === i ? { ...x, items: v } : x) } }))}</div>)}
        {!ro && <button type="button" className="btn sm" onClick={() => upd({ integration: { ...integ, others: [...integ.others, { subject: 'Môn tích hợp', items: [] }] } })}><Ic n="plus" /> Môn tích hợp</button>}</div></div>
    <div className="gasec"><h3>I. Yêu cầu cần đạt</h3>{L(lines(l.objectives), v => upd({ objectives: v.join('\n') || null }))}</div>
    <div className="gasec"><h3>Yêu cầu sản phẩm</h3>{L(lines(l.product_requirements), v => upd({ product_requirements: v.join('\n') || null }))}</div>
    <div className="gasec"><h3>II. Đồ dùng dạy học</h3><p className="sub" style={{ margin: 0 }}>Nguyên vật liệu cho một sản phẩm, công cụ & thiết bị cho một nhóm: xem tab <button type="button" className="linkbtn2" onClick={() => setTab('norms')}>Định mức vật tư</button> ({norms.length} mục). Tài liệu, phiếu học tập: tab <button type="button" className="linkbtn2" onClick={() => setTab('links')}>Link học liệu</button> ({files.length}).</p></div>
    <div className="gasec"><h3>Thông tin tài liệu</h3><div className="tblwrap"><table className="docinfo"><tbody>{([['written', 'Được soạn ngày'], ['reviewed', 'Được review ngày'], ['edited', 'Được hiệu chỉnh ngày']] as [keyof Doc, string][]).map(([k, n]) =>
      <tr key={k}><th>{n}</th><td>{ro ? (doc[k].length ? doc[k].map(([d, b], i) => <div key={i}>{d} · <b>{b}</b></div>) : <span className="sub">—</span>)
        : <textarea rows={Math.max(1, doc[k].length)} placeholder="dd/mm/yyyy · Họ tên (mỗi lần một dòng)" defaultValue={doc[k].map(([d, b]) => d + ' · ' + b).join('\n')}
          onBlur={e => upd({ doc_info: { ...doc, [k]: lines(e.target.value).map(t => { const [d, ...b] = t.split('·'); return [d.trim(), b.join('·').trim()] }) } })} />}</td></tr>)}</tbody></table></div></div>
  </section>

  if (tab === 'content') { const tot = plan.reduce((a, se) => a + se.acts.reduce((b, x) => b + x.minutes, 0), 0)
    const set = (fn: (p: Sess[]) => void) => { const p = JSON.parse(JSON.stringify(plan)) as Sess[]; fn(p); savePlan(p) }
    body = <section className="panel"><Head icon="list" title="III. Các hoạt động dạy học chủ yếu" act={<><small className="sub">{plan.length} buổi · {tot} phút</small>
      {!ro && <button type="button" className="btn sm" onClick={() => set(p => p.push({ title: `Buổi ${p.length + 1}`, note: '', acts: [] }))}><Ic n="plus" /> Buổi</button>}{gToggle('content')}</>} />
      {!plan.length && <Empty>Chưa có hoạt động.</Empty>}
      {plan.map((se, si) => <details key={si + se.title} className="sessbox ga" open><summary className="sesshead"><span className="chev"><Ic n="chev" /></span>
        {ro ? <b>{se.title}</b> : <input defaultValue={se.title} aria-label="Tên buổi" onClick={e => e.preventDefault()} onBlur={e => e.target.value !== se.title && set(p => { p[si].title = e.target.value })} />}
        <small>{se.acts.length} hoạt động · {se.acts.reduce((a, x) => a + x.minutes, 0)} phút</small>
        {!ro && <span className="act"><button type="button" className="btn sm" onClick={e => { e.preventDefault(); set(p => p[si].acts.push({ title: `Hoạt động ${p[si].acts.length + 1}`, minutes: 5, parts: [{ title: '', items: [] }] })) }}><Ic n="plus" /> Hoạt động</button>
          {plan.length > 1 && <button type="button" className="btn sm ghost" aria-label="Xoá buổi" onClick={e => { e.preventDefault(); set(p => { p.splice(si, 1) }) }}><Ic n="trash" /></button>}</span>}</summary>
        {(se.note || !ro) && <div className="sesnote">{ro ? '* ' + se.note : <input defaultValue={se.note} placeholder="Ghi chú đầu buổi (vd: HS ổn định, nhắc lại văn hoá lớp học STEM)" aria-label="Ghi chú buổi" onBlur={e => e.target.value !== se.note && set(p => { p[si].note = e.target.value })} />}</div>}
        {se.acts.map((x, ai) => <div key={ai + x.title} className="gaact"><div className="gaacth"><span className="sno">{ai + 1}</span>{ro ? <><b>{x.title}</b><span className="mins">{x.minutes}′</span></> : <>
          <input defaultValue={x.title} aria-label="Tên hoạt động" onBlur={e => e.target.value !== x.title && set(p => { p[si].acts[ai].title = e.target.value })} />
          <label className="mins"><input type="number" min={0} defaultValue={x.minutes} aria-label="Số phút" onBlur={e => Number(e.target.value) !== x.minutes && set(p => { p[si].acts[ai].minutes = Number(e.target.value) || 0 })} /> phút</label>
          <button type="button" className="btn sm ghost" aria-label="Xoá hoạt động" onClick={() => set(p => { p[si].acts.splice(ai, 1) })}><Ic n="trash" /></button></>}</div>
          {x.parts.map((pt, pi) => <div key={pi} className="gapart">{ro ? (pt.title ? <h4>{pt.title}</h4> : null) : <div className="gaparth">
            <input defaultValue={pt.title} placeholder="Tên mục (vd 1.1. Khởi động) — để trống nếu không có" aria-label="Tên mục" onBlur={e => e.target.value !== pt.title && set(p => { p[si].acts[ai].parts[pi].title = e.target.value })} />
            <button type="button" className="btn sm ghost" aria-label="Xoá mục" onClick={() => set(p => { p[si].acts[ai].parts.splice(pi, 1) })}><Ic n="trash" /></button></div>}
            {L(pt.items, v => set(p => { p[si].acts[ai].parts[pi].items = v }), 'Mỗi ý một dòng · "– " ở đầu dòng là ý con · "[Hình] mô tả" là chỗ đặt hình')}</div>)}
          {!ro && <button type="button" className="btn sm ghost" onClick={() => set(p => { const a = p[si].acts[ai]; a.parts.push({ title: `${ai + 1}.${a.parts.length + 1}. Mục mới`, items: [] }) })}><Ic n="plus" /> Mục</button>}</div>)}
      </details>)}</section> }

  if (tab === 'links') { const run = async (q: PromiseLike<{ error: { message: string } | null }>) => { const { error } = await q; if (!fail(error)) loadParts() }
    body = <section className="panel"><Head icon="link" title="Link học liệu" act={<>{!ro && <><button type="button" className="btn sm" onClick={() => run(supabase.from('material_files').insert({ lesson_id: l.id, seq: files.length + 1, kind: 'bai_giang', title: 'Bài giảng' }))}><Ic n="plus" /> Bài giảng</button>
      <button type="button" className="btn sm" onClick={() => run(supabase.from('material_files').insert({ lesson_id: l.id, seq: files.length + 1, kind: 'phieu_hoc_tap', title: 'Phiếu học tập' }))}><Ic n="plus" /> Phiếu học tập</button></>}{gToggle('links')}</>} />
      <div className="tblwrap"><table><thead><tr><th>Loại</th><th>Tên</th><th>Đường dẫn</th>{!ro && <th></th>}</tr></thead><tbody>
        {files.map(k => { const u = (p: Partial<File>) => run(supabase.from('material_files').update(p).eq('id', k.id))
          return <tr key={k.id}><td>{ro ? FILE_KIND[k.kind] ?? k.kind : <select value={k.kind} onChange={e => u({ kind: e.target.value })} aria-label="Loại">{Object.entries(FILE_KIND).map(([a, b]) => <option key={a} value={a}>{b}</option>)}</select>}</td>
            {ro ? <><td><b>{k.title}</b></td><td>{k.url ? <a href={k.url} target="_blank" rel="noreferrer">{k.url}</a> : <span style={{ color: 'var(--muted)' }}>chưa có đường dẫn</span>}</td></>
              : <><td><input defaultValue={k.title} aria-label="Tên" onBlur={e => e.target.value !== k.title && u({ title: e.target.value })} /></td><td><input defaultValue={k.url ?? ''} placeholder="https://…" aria-label="Đường dẫn" onBlur={e => e.target.value !== (k.url ?? '') && u({ url: e.target.value || null })} /></td>
                <td><button type="button" className="btn sm ghost" aria-label="Xoá" onClick={() => run(supabase.from('material_files').delete().eq('id', k.id))}><Ic n="trash" /></button></td></>}</tr> })}
        {!files.length && <tr><td colSpan={4} style={{ color: 'var(--muted)' }}>Chưa có tài liệu.</td></tr>}</tbody></table></div></section> }

  if (tab === 'norms') { const run = async (q: PromiseLike<{ error: { message: string } | null }>) => { const { error } = await q; if (!fail(error)) loadParts() }
    const catOfN = (n: Norm) => n.category === 'vat_tu' ? 'vl' : 'cc'
    const need = (n: Norm) => +needQty(n, calc.students, calc.groups, calc.groups).toFixed(2)
    const part = (c: 'vl' | 'cc', title: string, hint: string) => { const list = norms.filter(n => catOfN(n) === c)
      return <div className="nmpart"><div className="nmhead"><span className="tag">{c === 'vl' ? 'Danh mục 1' : 'Danh mục 2'}</span><b>{title}</b><small>{hint} · {list.length} mục</small>
        {!ro && <button type="button" className="btn sm" onClick={() => run(supabase.from('material_norms').insert({ lesson_id: l.id, seq: norms.length + 1, category: c === 'vl' ? 'vat_tu' : 'dung_cu', name: c === 'vl' ? 'Vật liệu mới' : 'Dụng cụ mới', unit: 'cái', qty: 1, basis: c === 'vl' ? 'per_product' : 'per_group' }))}><Ic n="plus" /> Thêm</button>}</div>
        <div className="tblwrap"><table className="nmtbl"><thead><tr><th>STT</th><th>Tên</th><th>Quy cách</th><th>Đơn vị</th><th style={{ textAlign: 'right' }}>Số lượng</th><th>Tính theo</th><th style={{ textAlign: 'right' }}>Cần cho lớp</th>{!ro && <th></th>}</tr></thead><tbody>
          {list.map((x, k) => { const u = (p: Partial<Norm>) => run(supabase.from('material_norms').update(p).eq('id', x.id))
            return ro ? <tr key={x.id}><td className="n">{k + 1}</td><td><b>{x.name}</b></td><td>{x.spec || '—'}</td><td>{x.unit}</td><td style={{ textAlign: 'right' }}>{+x.qty}</td><td>{BASIS[x.basis]}</td><td style={{ textAlign: 'right' }}><b>{need(x)}</b> {x.unit}</td></tr>
              : <tr key={x.id}><td className="n">{k + 1}</td><td><input defaultValue={x.name} aria-label="Tên" onBlur={e => e.target.value !== x.name && u({ name: e.target.value })} /></td>
                <td><input defaultValue={x.spec ?? ''} aria-label="Quy cách" onBlur={e => e.target.value !== (x.spec ?? '') && u({ spec: e.target.value || null })} /></td>
                <td><input defaultValue={x.unit} aria-label="Đơn vị" style={{ width: 80 }} onBlur={e => e.target.value !== x.unit && u({ unit: e.target.value })} /></td>
                <td style={{ textAlign: 'right' }}><input type="number" min={0} step="any" defaultValue={x.qty} aria-label="Số lượng" style={{ width: 80, textAlign: 'right' }} onBlur={e => Number(e.target.value) !== Number(x.qty) && u({ qty: Number(e.target.value) || 0 })} /></td>
                <td><select value={x.basis} aria-label="Tính theo" onChange={e => u({ basis: e.target.value })}>{Object.entries(BASIS).map(([a, b]) => <option key={a} value={a}>{b}</option>)}</select></td>
                <td style={{ textAlign: 'right' }}><b>{need(x)}</b> {x.unit}</td>
                <td style={{ whiteSpace: 'nowrap' }}><button type="button" className="btn sm ghost" title={`Chuyển sang ${c === 'vl' ? 'Công cụ & thiết bị' : 'Nguyên vật liệu'}`} onClick={() => u({ category: c === 'vl' ? 'dung_cu' : 'vat_tu' })}>{c === 'vl' ? '→ CC' : '→ VL'}</button>
                  <button type="button" className="btn sm ghost" aria-label="Xoá" onClick={() => run(supabase.from('material_norms').delete().eq('id', x.id))}><Ic n="trash" /></button></td></tr> })}
          {!list.length && <tr><td colSpan={ro ? 7 : 8} style={{ color: 'var(--muted)' }}>Chưa có mục nào.</td></tr>}</tbody></table></div></div> }
    body = <section className="panel"><Head icon="box" title="Định mức vật tư" act={gToggle('norms')} />
      <div className="calc"><label>Số học sinh <input type="number" min={1} value={calc.students} onChange={e => setCalc({ ...calc, students: Number(e.target.value) || 1 })} /></label>
        <label>Số nhóm (= số sản phẩm) <input type="number" min={1} value={calc.groups} onChange={e => setCalc({ ...calc, groups: Number(e.target.value) || 1 })} /></label><span>→ nhu cầu cho một lớp ở cột cuối</span></div>
      {part('vl', 'Nguyên vật liệu', 'tiêu hao, thường tính theo sản phẩm / học sinh')}{part('cc', 'Công cụ & thiết bị', 'dùng lại, thường tính theo nhóm / lớp')}</section> }

  if (tab === 'designs') body = <section className="panel"><Head icon="edit" title="Bài giảng soạn từ học liệu này" act={orgId && <button type="button" className="btn sm primary" onClick={toDesign}><Ic n="plus" /> Soạn bài giảng từ PB {(use ?? l).version_no}</button>} />
    {designs.length ? <div className="tblwrap"><table><thead><tr><th>Bài giảng</th><th>Từ phiên bản học liệu</th><th>Trạng thái</th><th>Cập nhật</th><th></th></tr></thead><tbody>
      {designs.map(d => { const fv = versions.find(v => v.id === d.material_lesson_id)
        return <tr key={d.id} className="rowlink" onClick={() => go?.('Soạn bài giảng & kho hoạt động')}><td><b>{d.title}</b></td><td>PB {fv?.version_no ?? '?'}{fv && newerOf(versions, fv) && <> <span className="pill info plain">có bản mới</span></>}</td>
          <td>{d.status === 'published' ? <span className="pill good">Đã xuất bản</span> : <span className="pill draft">Nháp</span>}</td><td>{timeAgo(d.updated_at)}</td><td style={{ textAlign: 'right' }}><span className="btn sm">Xem ›</span></td></tr> })}</tbody></table></div>
      : <Empty>Chưa có bài giảng.</Empty>}</section>

  return <>
    <button type="button" className="btn sm ghost" onClick={back} style={{ justifySelf: 'start' }}><Ic n="back" /> Tất cả học liệu</button>
    <div className="dhead"><span className="code" style={cssVar(color)}>{prog?.code ?? '—'}</span><div><h1>{l.title}</h1><span className="crumb">{prog?.name ?? 'Chưa gắn chương trình'} › {catName(cat, 'subject', subj) || '—'} · {l.periods} tiết</span></div>
      {canOwn && <div className="act"><button type="button" className="btn danger" onClick={() => setAsk({ text: `Xoá học liệu “${l.title}” cùng mọi phiên bản, định mức, tài liệu?`, yes: 'Xoá học liệu',
        run: async () => { const { error } = await supabase.from('material_lessons').delete().eq('family_id', l.family_id); if (!fail(error)) { await reload(); back() } } })}><Ic n="trash" /> Xoá học liệu</button></div>}</div>
    {ask && <Confirm danger text={ask.text} yes={ask.yes} onNo={() => setAsk(null)} onYes={() => { ask.run(); setAsk(null) }} />}
    {msg && <p className="msg">{msg}</p>}{note && <p className="okmsg">{note}</p>}
    <div className="verbar"><span className="tag">Phiên bản</span>
      <select value={l.id} aria-label="Phiên bản" onChange={e => onSwitch(e.target.value)}>{vs.map(x => <option key={x.id} value={x.id}>PB {x.version_no} · {MS[x.status]?.[0]}{x.id === inUseId ? ' · đang dùng' : ''}</option>)}</select>
      <StatusPill s={l.status} />{' '}{l.id === inUseId ? <span className="pill good plain">Đơn vị đang dùng</span> : orgId && l.status === 'published' && <button type="button" className="btn sm" onClick={() => verAct(() => supabase.from('material_in_use').upsert({ org_id: orgId, family_id: l.family_id, lesson_id: l.id }))}>Dùng phiên bản này</button>}
      {nw && l.id === inUseId && <span className="pill info plain">Có PB {nw.version_no} mới hơn</span>}
      <small style={{ color: 'var(--muted)' }}>{l.published_at ? 'Phát hành ' + new Date(l.published_at).toLocaleDateString('vi-VN') + ' · ' : ''}{l.change_note ?? ''}</small>
      {canOwn && <span className="act">
        {l.status === 'draft' && <button type="button" className="btn sm primary" onClick={() => allOk ? verAct(() => supabase.rpc('material_publish', { p_lesson: l.id }), () => setNote(`Đã phát hành PB ${l.version_no} — đã báo đơn vị và người soạn bài giảng từ bản cũ.`)) : setMsg('Còn nhóm “Cần kiểm tra” — chốt đủ 4 nhóm trước khi phát hành.')}><Ic n="send" /> Phát hành phiên bản</button>}
        <button type="button" className="btn sm" onClick={() => verAct(() => supabase.rpc('material_new_version', { p_lesson: l.id, p_note: 'Bản sửa từ PB ' + l.version_no }), id => onSwitch(id as string))}><Ic n="copy" /> Tạo phiên bản mới</button>
        {l.status === 'published' && <button type="button" className="btn sm" onClick={() => verAct(() => supabase.from('material_lessons').update({ status: 'archived' }).eq('id', l.id))}>Ngừng dùng</button>}
        {l.status === 'archived' && <button type="button" className="btn sm" onClick={() => verAct(() => supabase.from('material_lessons').update({ status: 'published' }).eq('id', l.id))}>Dùng lại</button>}
        {vs.length > 1 && <button type="button" className="btn sm danger" onClick={() => setAsk({ text: `Xoá phiên bản ${l.version_no}? Bài giảng soạn từ phiên bản này giữ lại nhưng bỏ liên kết.`, yes: 'Xoá phiên bản',
          run: () => verAct(() => supabase.from('material_lessons').delete().eq('id', l.id), () => onSwitch(vs.find(v => v.id !== l.id)!.id)) })}>Xoá PB {l.version_no}</button>}</span>}
    </div>
    {canOwn && (ro ? <p className="note">{l.status === 'published' ? 'Phiên bản đã phát hành được giữ nguyên — bấm “Tạo phiên bản mới” để sửa.' : 'Phiên bản đã ngừng dùng — chỉ xem.'}</p> : !allOk && <p className="note">Chốt đủ 4 nhóm (chấm xanh trên các tab) để phát hành phiên bản này.</p>)}
    <div className="tabs">{G4.map(([k, n]) => <button type="button" key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{n} <i className={'gst' + (g[k] === 'ok' ? ' ok' : '')} /></button>)}
      <button type="button" className={tab === 'designs' ? 'on' : ''} onClick={() => setTab('designs')}>Bài giảng <small>{designs.length}</small></button></div>
    {body}
  </>
}
