import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { supabase } from '../../../lib/supabase'
import { errMsg, norm, useRpcBool } from '../ui'
import { catName, effectiveCatalog, inUseOf, newerOf, useCatalog, useOrgs, type Curriculum, type MStatus } from '../curriculum/api'
import { planOf, stepsOf, type MLesson, type Norm } from '../materials/MaterialsPage'
import { Confirm, Empty, Flow, Ic, Mau, PageHead, Panel, Search, Seg, Sel, cssVar } from '../mau/kit'
import { SGLYPH } from '../mau/icons'
import { ACTS, clone, setActToast, setActUses } from './acts'
import { ActStore, BLOCK_KIND, BlockEdit, BlockView, CoverDeco, newBlock, type Block } from './blocks'

// 1.1.4 Soạn bài giảng & Kho hoạt động — dựng theo bản mẫu giao diện (ph1-chuong-trinh-mau.html):
//   Bước 1 · Kho hoạt động: iGame (đua xe, lật thẻ, phân loại, ghép cặp, vòng quay) và nội dung tương tác (mô phỏng 2D, giáo cụ ảo) — chơi thử, GV tùy chỉnh cấu hình,
//            thêm vào bài giảng đang soạn hoặc tạo bài giảng mới với hoạt động đó.
//   Bước 2 · Soạn bài giảng: thẻ bài giảng của đơn vị (Tất cả / Đã xuất bản / Nháp); trình soạn Dàn ý › Hoạt động › Nội dung trình chiếu (khối văn bản, hình, video,
//            trắc nghiệm, câu hỏi ngắn, liên kết, hoạt động từ kho); View học sinh; xuất bản; sửa bài đã xuất bản qua bản nháp (draft_of, migration 066).

type DAct = { title: string; minutes?: number; teacher?: string; student?: string; product?: string; blocks?: Block[] }
type DSess = { title: string; minutes?: number; activities: DAct[] }
type Design = { id: string; org_id: string; teacher_id: string | null; material_lesson_id: string | null; curriculum_lesson_id: string | null; based_on_id: string | null; draft_of: string | null
  title: string; description: string | null; subject: string | null; grade: number | null; status: string; sessions: DSess[]; norms: unknown[]; files: unknown[]; criteria: unknown[]
  objectives: string | null; notes: string | null; created_at: string; updated_at: string }
type ML = MLesson & { family_id: string; version_no: number; status: MStatus }
type MSet = { id: string; curriculum_id: string | null; subject: string | null; grade: number | null }
type Target = { design: string; act: number }
const OPEN_DESIGN_KEY = 'ph1:open-design'
const today = () => new Date().toLocaleDateString('vi-VN')
const actsOf = (d: Design) => d.sessions.flatMap((s, si) => s.activities.map((a, ai) => ({ a, si, ai })))
function DStatus({ d }: { d: Design; }) {
  return d.draft_of ? <span className="pill warn">Nháp của bài đã xuất bản</span> : d.status === 'published' ? <span className="pill good">Đã xuất bản</span> : <span className="pill draft">Nháp</span>
}

export function DesignsMau({ orgId, teacherId }: { orgId: string | null; teacherId?: string | null; go?: (p: string) => void }) {
  const [list, setList] = useState<Design[]>([])
  const [mls, setMls] = useState<ML[]>([])
  const [sets, setSets] = useState<MSet[]>([])
  const [progs, setProgs] = useState<Curriculum[]>([])
  const [chosen, setChosen] = useState<Map<string, string>>(new Map())
  const [tab, setTab] = useState<'store' | 'compose'>('compose')
  const [fs, setFs] = useState<'all' | 'published' | 'draft'>('all')
  const [open, setOpen] = useState<string | null>(null)
  const [act, setAct] = useState(0)
  const [student, setStudent] = useState(false)
  const [picking, setPicking] = useState(false)
  const [ask, setAsk] = useState<string | null>(null)
  const [target, setTarget] = useState<Target | null>(null)
  const [msg, setMsg] = useState('')
  const canManage = useRpcBool('curriculum_can_manage')
  const { all, hidden } = useCatalog()
  const { orgs, below } = useOrgs(orgId)
  const cat = effectiveCatalog(all, hidden, below)
  useEffect(() => { setActToast(m => setMsg(m)) }, [])

  async function load(pick?: string) {
    const [d, l, s, c, u] = await Promise.all([
      supabase.from('lesson_designs').select('*').order('created_at'),
      supabase.from('material_lessons').select('*').order('seq'),
      supabase.from('material_sets').select('id, curriculum_id, subject, grade'),
      supabase.from('curricula').select('*').order('code'),
      orgId ? supabase.from('material_in_use').select('family_id, lesson_id').eq('org_id', orgId) : Promise.resolve({ data: [] }),
    ])
    if (d.error) return setMsg(errMsg(d.error.message))
    setList((d.data as Design[]) ?? []); setMls((l.data as ML[]) ?? []); setSets((s.data as MSet[]) ?? []); setProgs((c.data as Curriculum[]) ?? [])
    setChosen(new Map(((u.data as { family_id: string; lesson_id: string }[]) ?? []).map(x => [x.family_id, x.lesson_id])))
    if (pick) { setOpen(pick); setAct(0); setStudent(false) }
  }
  useEffect(() => { load().then(() => { try { const id = sessionStorage.getItem(OPEN_DESIGN_KEY); if (id) { sessionStorage.removeItem(OPEN_DESIGN_KEY); setOpen(id) } } catch { /* bỏ qua */ } }) }, [orgId])
  useEffect(() => { setActUses(id => list.reduce((n, d) => n + d.sessions.flatMap(s => s.activities).flatMap(a => a.blocks ?? []).filter(b => b.type === 'activity' && b.act === id).length, 0)) }, [list])

  const code = useMemo(() => { const m = new Map<string, string>(); list.forEach((d, i) => m.set(d.id, 'BG-' + String(i + 1).padStart(3, '0'))); return m }, [list])
  const ctxOf = (d: Design) => { const ml = mls.find(x => x.id === d.material_lesson_id) ?? null; const st = sets.find(x => x.id === ml?.set_id); const p = progs.find(x => x.id === st?.curriculum_id) ?? null
    const s = d.subject ?? st?.subject ?? ml?.subject_main ?? null
    return { ml, p, s, sn: catName(cat, 'subject', s) || s || '', color: p?.color ?? '#64748b', newer: ml ? newerOf(mls.filter(x => x.family_id === ml.family_id), ml) as ML | null : null } }
  const orgName = (id: string) => orgs.find(o => o.id === id)?.name ?? ''
  // Học liệu để soạn: mỗi học liệu một dòng — phiên bản đơn vị đang dùng
  const heads = useMemo(() => Array.from(new Set(mls.map(m => m.family_id))).map(f => inUseOf(mls.filter(m => m.status !== 'archived'), f, chosen) as ML | null).filter(Boolean) as ML[], [mls, chosen])
  const progOfMl = (ml: ML) => progs.find(p => p.id === sets.find(s => s.id === ml.set_id)?.curriculum_id) ?? null
  const subjOfMl = (ml: ML) => sets.find(s => s.id === ml.set_id)?.subject ?? ml.subject_main ?? null

  async function save(d: Design, p: Partial<Design>) {
    setList(ls => ls.map(x => x.id === d.id ? { ...x, ...p, updated_at: new Date().toISOString() } : x))
    const { error } = await supabase.from('lesson_designs').update(p).eq('id', d.id); if (error) setMsg(errMsg(error.message))
  }
  async function newDesign(mlId: string, base?: Design, firstBlock?: Block): Promise<Design | null> {
    if (!orgId) return null
    const ml = mls.find(x => x.id === mlId); if (!ml) return null
    const [n, fl] = await Promise.all([supabase.from('material_norms').select('*').eq('lesson_id', ml.id).order('seq'), supabase.from('material_files').select('title, url').eq('lesson_id', ml.id).order('seq')])
    const st = sets.find(s => s.id === ml.set_id)
    const sessions: DSess[] = planOf(ml).map(se => ({ title: se.title, minutes: se.acts.reduce((a, x) => a + (x.minutes || 0), 0),
      activities: stepsOf([se]).map(s => ({ title: s.title, minutes: s.minutes, teacher: s.teacher || 'Đặt câu hỏi gợi mở, hướng dẫn nhóm.', student: s.student || 'Thảo luận nhóm, ghi phiếu học tập.', product: '' })) }))
    if (!sessions.length) sessions.push({ title: 'Buổi 1', minutes: 45, activities: [] })
    if (firstBlock) { if (!sessions[0].activities.length) sessions[0].activities.push({ title: 'Hoạt động 1', minutes: 10, teacher: '', student: '', product: '' }); sessions[0].activities[0].blocks = [firstBlock] }
    const row = { org_id: orgId, teacher_id: teacherId ?? null, title: base?.title ?? ml.title, description: base?.description ?? 'Bài giảng điều chỉnh theo điều kiện lớp học.', subject: st?.subject ?? ml.subject_main,
      grade: st?.grade ?? progOfMl(ml)?.grades[0] ?? null, objectives: ml.objectives, material_lesson_id: ml.id, curriculum_lesson_id: ml.curriculum_lesson_id, based_on_id: base?.id ?? null, status: 'draft',
      criteria: ml.criteria ?? [], sessions, norms: ((n.data as Norm[]) ?? []).map(x => ({ name: x.name, spec: x.spec, unit: x.unit, qty: Number(x.qty), basis: x.basis, category: x.category })),
      files: ((fl.data as { title: string; url: string | null }[]) ?? []).map(x => ({ title: x.title, url: x.url ?? undefined })) }
    const { data, error } = await supabase.from('lesson_designs').insert(row).select('*').single()
    if (error) { setMsg(errMsg(error.message)); return null }
    setMsg(`Đã tạo bài giảng (nháp) từ học liệu PB ${ml.version_no}`); await load((data as Design).id); return data as Design
  }
  // Thêm hoạt động từ kho; bài đã xuất bản → tạo bản nháp để sửa
  async function addActivity(d0: Design, flat: number, a: any, cfg: any) {
    let d = d0
    if (d0.status === 'published' && !d0.draft_of) {
      const { id: _i, created_at: _c, updated_at: _u, ...rest } = d0
      const r = await supabase.from('lesson_designs').insert({ ...rest, status: 'draft', draft_of: d0.id }).select('*').single()
      if (r.error) return setMsg(errMsg(r.error.message)); d = r.data as Design
    }
    const acts = actsOf(d); const at = acts[flat] ?? acts[0]; if (!at) return setMsg('Bài giảng chưa có hoạt động')
    const sessions = d.sessions.map((s, si) => si !== at.si ? s : { ...s, activities: s.activities.map((x, ai) => ai !== at.ai ? x : { ...x, blocks: [...(x.blocks ?? []), { type: 'activity', act: a.id, cfg: clone(cfg) }] }) })
    const { error } = await supabase.from('lesson_designs').update({ sessions }).eq('id', d.id); if (error) return setMsg(errMsg(error.message))
    setMsg(d !== d0 ? `Đã thêm vào bản nháp của ${code.get(d0.id)}` : `Đã thêm “${a.title}” vào ${code.get(d.id)}`)
    setTarget(null); setTab('compose'); await load(d.id); setAct(flat)
  }

  const mine = list.filter(d => d.org_id === orgId)
  const d = list.find(x => x.id === open)
  if (d) return <Mau>{msg && <p className="msg" role="status" onClick={() => setMsg('')}>{msg}</p>}
    <Editor d={d} code={code.get(d.id) ?? ''} ctx={ctxOf(d)} orgName={orgName(d.org_id)} act={act} setAct={setAct} student={student} setStudent={setStudent} canEdit={canManage || d.org_id === orgId}
      hasDraft={list.some(x => x.draft_of === d.id)} save={p => save(d, p)} setMsg={setMsg}
      onBack={() => { setOpen(null); setStudent(false); load() }}
      onAddActivity={() => { setTarget({ design: d.id, act }); setOpen(null); setTab('store'); scrollTo(0, 0) }}
      onDelete={async () => { const { error } = await supabase.from('lesson_designs').delete().eq('id', d.id); if (error) return setMsg(errMsg(error.message)); setMsg(`Đã xoá ${code.get(d.id)}`); setOpen(null); load() }}
      onPublish={() => { save(d, { status: 'published' }); setMsg('Đã xuất bản — học sinh xem được bài giảng') }}
      onDraft={async () => { const { id: _i, created_at: _c, updated_at: _u, ...rest } = d; const r = await supabase.from('lesson_designs').insert({ ...rest, status: 'draft', draft_of: d.id }).select('id').single()
        if (r.error) return setMsg(errMsg(r.error.message)); setMsg(`Đã tạo bản nháp của ${code.get(d.id)} — học sinh vẫn xem bản cũ`); load((r.data as { id: string }).id) }}
      onDrop={async () => { const orig = d.draft_of; const { error } = await supabase.from('lesson_designs').delete().eq('id', d.id); if (error) return setMsg(errMsg(error.message)); setMsg('Đã bỏ bản nháp'); load(orig ?? undefined) }}
      onReplace={async () => { const o = list.find(x => x.id === d.draft_of); if (!o) return
        const { error } = await supabase.from('lesson_designs').update({ title: d.title, description: d.description, sessions: d.sessions, material_lesson_id: d.material_lesson_id, status: 'published' }).eq('id', o.id)
        if (error) return setMsg(errMsg(error.message)); await supabase.from('lesson_designs').delete().eq('id', d.id); setMsg(`Đã xuất bản thay ${code.get(o.id)}`); load(o.id) }}
      onUpdate={async () => { const n = ctxOf(d).newer; if (n) await newDesign(n.id, d) }} /></Mau>

  const shown = mine.filter(x => fs === 'all' || (fs === 'published' ? x.status === 'published' && !x.draft_of : x.status !== 'published' || x.draft_of))
  const tgt = target ? list.find(x => x.id === target.design) ?? null : null
  return <Mau>
    {msg && <p className="msg" role="status" onClick={() => setMsg('')}>{msg}</p>}
    <PageHead icon="edit" title="Soạn bài giảng & kho hoạt động" sub="Bài giảng soạn từ một phiên bản học liệu; kho hoạt động gồm trò chơi, mô phỏng, giáo cụ ảo tùy chỉnh được để thêm vào bài giảng">
      {orgId && <button type="button" className="btn primary" onClick={() => setPicking(true)}><Ic n="plus" /> Soạn bài giảng</button>}</PageHead>
    <Flow steps={[['store', 'Kho hoạt động', `${ACTS.length} dạng bài tùy chỉnh`], ['compose', 'Soạn bài giảng', `${mine.length} bài giảng · từ học liệu, xuất bản`]]} value={tab} onChange={setTab} />
    {picking && <Panel icon="file" title="Chọn học liệu để soạn bài giảng" act={<button type="button" className="btn sm ghost" onClick={() => setPicking(false)}>Đóng</button>}>
      {heads.length ? <div className="grid">{heads.map(l => { const p = progOfMl(l); const s = subjOfMl(l)
        return <button type="button" key={l.id} className="pcard mini" style={cssVar(p?.color)} onClick={async () => { setPicking(false); await newDesign(l.id) }}>
          <div className="top"><span className="code sm">{p?.code ?? '—'}</span><div style={{ minWidth: 0 }}><h3>{l.title}</h3><small style={{ color: 'var(--muted)' }}>{catName(cat, 'subject', s) || s} · PB {l.version_no} {l.status === 'published' ? '' : '(nháp)'}</small></div></div></button> })}</div>
        : <Empty>Chưa có học liệu — tạo ở mục Học liệu trước.</Empty>}</Panel>}
    {tab === 'store' ? <ActStore target={tgt ? { label: `${code.get(tgt.id) ?? ''} · ${tgt.title}`, onCancel: () => { const t = target!; setTarget(null); setOpen(t.design); setAct(t.act) }, onAdd: (a, cfg) => addActivity(tgt, target!.act, a, cfg) } : null}
      addTo={{ title: 'Thêm vào bài giảng của tôi', docLabel: 'Bài giảng', partLabel: 'Đặt vào hoạt động', button: 'Thêm vào bài giảng của tôi',
        docs: mine.map(x => [x.id, `${code.get(x.id)} · ${x.title}${x.status === 'published' && !x.draft_of ? ' (đã xuất bản → tạo nháp)' : ''}`] as [string, string]),
        partsOf: id => { const dd = mine.find(x => x.id === id); return dd ? actsOf(dd).map((x, i) => [String(i), `${dd.sessions[x.si].title} › ${x.ai + 1}. ${x.a.title}`] as [string, string]) : [] },
        onAdd: (id, flat, a, cfg) => { const dd = mine.find(x => x.id === id); if (dd) addActivity(dd, flat, a, cfg) } }}
      newFrom={{ title: 'Tạo bài giảng mới với hoạt động này', label: 'Soạn từ học liệu của bài', hint: 'Bài giảng mới lấy khung từ phiên bản học liệu đang dùng; hoạt động này được đặt vào hoạt động đầu tiên.', button: 'Tạo bài giảng', footBtn: 'Tạo bài giảng mới với hoạt động này',
        options: heads.map(l => [l.id, `${progOfMl(l)?.code ?? '—'} · ${catName(cat, 'subject', subjOfMl(l)) || subjOfMl(l) || ''} · ${l.title}`] as [string, string]),
        onNew: async (mlId, a, cfg) => { const n = await newDesign(mlId, undefined, { type: 'activity', act: a.id, cfg: clone(cfg) }); if (n) { setTab('compose'); setAct(0) } } }} />
      : <>
        <div className="toolbar"><Seg label="Trạng thái" items={[['all', 'Tất cả'], ['published', 'Đã xuất bản'], ['draft', 'Nháp']]} value={fs} onChange={setFs} />
          <span style={{ color: 'var(--muted)', fontSize: 12.5 }}>Bài giảng của {orgName(orgId ?? '') || 'đơn vị'}</span></div>
        {!shown.length ? <Empty>Chưa có bài giảng ở trạng thái này.</Empty> : <div className="grid dgrid">{shown.map(x => { const c = ctxOf(x)
          return <article key={x.id} className="pcard dcard" style={cssVar(c.color)}>
            <div className="cover"><CoverDeco s={c.s} /><span>{c.p?.code ?? '—'} · {c.sn}</span><b>{code.get(x.id)}</b></div>
            <div className="top"><div style={{ minWidth: 0 }}><h3>{x.title}</h3><small style={{ color: 'var(--muted)' }}>{c.sn} · học liệu PB {c.ml?.version_no ?? '?'} · {orgName(x.org_id)}</small></div></div>
            <div className="chips"><DStatus d={x} />{c.newer && <span className="pill info plain">Học liệu có PB {c.newer.version_no}</span>}</div>
            <div className="foot"><span>cập nhật {new Date(x.updated_at).toLocaleDateString('vi-VN')}</span><span className="cbtns">
              <button type="button" className="btn sm" onClick={() => { setOpen(x.id); setAct(0); setStudent(false); scrollTo(0, 0) }}><Ic n="edit" /> Soạn</button>
              <button type="button" className="btn sm ghost" aria-label="View học sinh" onClick={() => { setOpen(x.id); setAct(0); setStudent(true); scrollTo(0, 0) }}><Ic n="eye" /></button>
              <button type="button" className="btn sm ghost" aria-label="Nhân bản" onClick={async () => { const { id: _i, created_at: _c, updated_at: _u, ...rest } = x
                const r = await supabase.from('lesson_designs').insert({ ...rest, title: x.title + ' (bản sao)', status: 'draft', draft_of: null, based_on_id: x.id }).select('id').single(); if (r.error) setMsg(errMsg(r.error.message)); else { setMsg('Đã nhân bản'); load() } }}><Ic n="copy" /></button>
              <button type="button" className="btn sm ghost" aria-label="Xoá" onClick={() => setAsk(x.id)}><Ic n="trash" /></button></span></div>
            {ask === x.id && <div className="confirm sm">Xoá {code.get(x.id)}? <button type="button" className="btn sm danger" onClick={async () => { const { error } = await supabase.from('lesson_designs').delete().eq('id', x.id); setAsk(null); if (error) setMsg(errMsg(error.message)); else { setMsg(`Đã xoá ${code.get(x.id)}`); load() } }}>Xoá</button>
              <button type="button" className="btn sm ghost" onClick={() => setAsk(null)}>Thôi</button></div>}
          </article> })}</div>}
      </>}
  </Mau>
}



type Ctx = { ml: ML | null; p: Curriculum | null; s: string | null; sn: string; color: string; newer: ML | null }
function Editor({ d, code, ctx, orgName, act, setAct, student, setStudent, canEdit, hasDraft, save, setMsg, onBack, onAddActivity, onDelete, onPublish, onDraft, onDrop, onReplace, onUpdate }: {
  d: Design; code: string; ctx: Ctx; orgName: string; act: number; setAct: (n: number) => void; student: boolean; setStudent: (v: boolean) => void; canEdit: boolean; hasDraft: boolean
  save: (p: Partial<Design>) => void; setMsg: (m: string) => void; onBack: () => void; onAddActivity: () => void; onDelete: () => void; onPublish: () => void; onDraft: () => void; onDrop: () => void; onReplace: () => void; onUpdate: () => void
}) {
  const [ask, setAsk] = useState(false)
  const heroRef = useRef<HTMLElement>(null)
  const ro = !canEdit || (d.status === 'published' && !d.draft_of)
  const acts = actsOf(d); const cur = acts[act] ?? acts[0]
  const total = acts.reduce((x, y) => x + (y.a.minutes ?? 0), 0)
  const setSessions = (sessions: DSess[]) => save({ sessions })
  const patchAct = (p: Partial<DAct>) => { if (!cur) return; setSessions(d.sessions.map((s, si) => si !== cur.si ? s : { ...s, activities: s.activities.map((x, ai) => ai !== cur.ai ? x : { ...x, ...p }) })) }
  const blocks = cur?.a.blocks ?? []
  const setBlocks = (bs: Block[]) => patchAct({ blocks: bs })
  const present = () => { const el = heroRef.current; if (el?.requestFullscreen) el.requestFullscreen().catch(() => setMsg('Trình duyệt không cho mở toàn màn hình')) }
  if (student) return <>
    <div className="edbar"><button type="button" className="btn sm ghost" onClick={onBack}><Ic n="back" /> Danh sách</button><b>{d.title}</b><span className="pill info plain">View học sinh</span>
      <span className="act"><button type="button" className="btn sm" onClick={present}>Trình chiếu</button><button type="button" className="btn sm" onClick={() => setStudent(false)}>Thoát view học sinh</button></span></div>
    <section className="hero" ref={heroRef} style={{ ...cssVar(ctx.color), overflow: 'auto' }}><h2 style={{ margin: 0 }}>{d.title}</h2><p style={{ margin: 0, color: 'var(--muted)' }}>{d.description}</p>
      {d.sessions.map((s, si) => <div key={si} className="sessbox"><div className="sesshead">{s.title}</div><div className="svacts">{s.activities.map((a, i) => { const k = d.sessions.slice(0, si).reduce((x, y) => x + y.activities.length, 0) + i
        return <div key={i} className="svact"><div className="svh"><span className="sno">{i + 1}</span><b>{a.title}</b><span className="sm">{a.minutes ?? 0} phút</span></div><p className="sub" style={{ margin: 0 }}>Nhiệm vụ: {a.student}</p>
          {(a.blocks ?? []).map((b, bi) => <div key={bi} className="bk"><BlockView b={b} k={`${d.id}.${k}.${bi}`} student /></div>)}</div> })}</div></div>)}</section></>
  return <>
    <div className="edbar"><button type="button" className="btn sm ghost" onClick={onBack}><Ic n="back" /> Danh sách</button><span className="code sm" style={cssVar(ctx.color)}>{ctx.p?.code ?? '—'}</span><b>{code}</b><DStatus d={d} />
      <small style={{ color: 'var(--muted)' }}>{ro ? 'Đã xuất bản — chỉ xem' : 'Tự động lưu · ' + new Date(d.updated_at).toLocaleDateString('vi-VN')}</small>
      <span className="act"><button type="button" className="btn sm" onClick={() => setStudent(true)}><Ic n="eye" /> View học sinh</button><button type="button" className="btn sm" onClick={() => { setStudent(true); setTimeout(present, 50) }}>Trình chiếu</button>
        {canEdit && (d.status === 'published' && !d.draft_of ? <button type="button" className="btn sm primary" disabled={hasDraft} title={hasDraft ? 'Đã có bản nháp đang sửa' : undefined} onClick={onDraft}><Ic n="edit" /> Sửa (tạo bản nháp)</button>
          : d.draft_of ? <><button type="button" className="btn sm" onClick={onDrop}>Bỏ bản nháp</button><button type="button" className="btn sm primary" onClick={onReplace}>Xuất bản thay bản cũ</button></>
          : <button type="button" className="btn sm primary" onClick={onPublish}><Ic n="send" /> Xuất bản</button>)}
        {canEdit && <button type="button" className="btn sm danger" aria-label="Xoá bài giảng" onClick={() => setAsk(true)}><Ic n="trash" /> Xoá</button>}</span></div>
    {ask && <Confirm danger text={`Xoá bài giảng ${code} “${d.title}”?${d.status === 'published' && !d.draft_of ? ' Học sinh sẽ không còn xem được bài này.' : ''}${hasDraft ? ' Bản nháp đi kèm cũng bị xoá.' : ''} Không hoàn tác được.`} yes="Xoá bài giảng" onYes={onDelete} onNo={() => setAsk(false)} />}
    {ctx.newer && <div className="note warnnote"><Ic n="history" /> Học liệu “{ctx.ml?.title}” có phiên bản mới (PB {ctx.newer.version_no}). Bài giảng này giữ nguyên theo PB {ctx.ml?.version_no}. {canEdit && <button type="button" className="btn sm" onClick={onUpdate}>Cập nhật theo bản mới</button>}</div>}
    <div className="editor">
      <aside className="outline"><div className="olhead">Dàn ý · {total} phút</div>{d.sessions.map((s, si) => <Fragment key={si}><div className="olsess">{s.title}</div>{s.activities.map((a, ai) => { const k = acts.findIndex(x => x.si === si && x.ai === ai)
        return <button type="button" key={ai} className={k === act ? 'on' : ''} onClick={() => setAct(k)}><span>{ai + 1}. {a.title}</span><small>{a.minutes ?? 0}′</small></button> })}</Fragment>)}
        {!ro && <button type="button" className="addact" onClick={() => { const last = d.sessions.length - 1; const ss = d.sessions.length ? d.sessions : [{ title: 'Buổi 1', activities: [] }]
          setSessions(ss.map((s, si) => si !== Math.max(0, last) ? s : { ...s, activities: [...s.activities, { title: 'Hoạt động mới', minutes: 5, teacher: '', student: '', product: '' }] })); setAct(acts.length) }}><Ic n="plus" /> Hoạt động</button>}</aside>
      <section className="canvas">{cur ? <Fragment key={act}>
        <div className="blockhead"><span className="tag">Hoạt động {cur.ai + 1}</span>{ro ? <h2>{cur.a.title}</h2> : <input className="ttl" defaultValue={cur.a.title} aria-label="Tên hoạt động" onBlur={e => e.target.value !== cur.a.title && patchAct({ title: e.target.value })} />}
          <label className="minutes">{ro ? cur.a.minutes ?? 0 : <input type="number" min={0} defaultValue={cur.a.minutes ?? 0} aria-label="Số phút" onBlur={e => patchAct({ minutes: Number(e.target.value) || 0 })} />} phút</label></div>
        {([['teacher', 'Hướng dẫn giáo viên'], ['student', 'Nhiệm vụ học sinh'], ['product', 'Sản phẩm đầu ra']] as const).map(([k, n]) => <label key={k} className="fld"><span>{n}</span>
          {ro ? <p className="outcomes">{cur.a[k] || '—'}</p> : <textarea placeholder={n + '…'} defaultValue={cur.a[k] ?? ''} onBlur={e => e.target.value !== (cur.a[k] ?? '') && patchAct({ [k]: e.target.value })} />}</label>)}
        <div className="bkwrap"><div className="bkhead"><b>Nội dung trình chiếu cho học sinh</b><small className="sub">{blocks.length} khối</small></div>
          {blocks.length ? blocks.map((b, bi) => ro ? <div key={bi} className="bk"><BlockView b={b} k={`${d.id}.${act}.${bi}`} student={false} /></div>
            : <BlockEdit key={bi + ':' + b.type} b={b} bi={bi} n={blocks.length} k={`ed-${d.id}-${act}-${bi}`} setMsg={setMsg} set={p => setBlocks(blocks.map((x, j) => j === bi ? { ...x, ...p } : x))}
              move={dd => { const j = bi + dd; if (j < 0 || j >= blocks.length) return; const x = [...blocks]; [x[bi], x[j]] = [x[j], x[bi]]; setBlocks(x) }} del={() => setBlocks(blocks.filter((_, j) => j !== bi))} />)
            : <Empty>Chưa có nội dung — thêm hình ảnh, video, câu hỏi trắc nghiệm… bằng các nút bên dưới.</Empty>}
          {!ro && <div className="bkadd">{Object.entries(BLOCK_KIND).map(([t, [n, icn]]) => <button type="button" key={t} className="btn sm" onClick={() => t === 'activity' ? onAddActivity() : setBlocks([...blocks, newBlock(t)])}><Ic n={icn} /> {n}</button>)}</div>}</div>
        {!ro && <div className="formact"><button type="button" className="btn sm danger" onClick={() => { setSessions(d.sessions.map((s, si) => si !== cur.si ? s : { ...s, activities: s.activities.filter((_, ai) => ai !== cur.ai) })); setAct(0) }}><Ic n="trash" /> Xoá hoạt động</button></div>}
      </Fragment> : <Empty>Chưa có hoạt động.</Empty>}</section>
      <aside className="infop"><div className="covbig" style={cssVar(ctx.color)}><CoverDeco s={ctx.s} /><span>{ctx.p?.code ?? '—'} · {ctx.sn}</span><b>{d.title}</b></div>
        <label className="fld"><span>Tên bài giảng</span>{ro ? <b>{d.title}</b> : <input defaultValue={d.title} key={d.id + 't'} onBlur={e => e.target.value.trim() && e.target.value !== d.title && save({ title: e.target.value.trim() })} />}</label>
        <label className="fld"><span>Mô tả</span>{ro ? <p className="outcomes">{d.description}</p> : <textarea defaultValue={d.description ?? ''} key={d.id + 'd'} onBlur={e => e.target.value !== (d.description ?? '') && save({ description: e.target.value })} />}</label>
        <dl className="kv one"><div><dt>Chương trình</dt><dd>{ctx.p ? `${ctx.p.code} · ${ctx.p.name}` : '—'}</dd></div><div><dt>Môn · bài</dt><dd>{ctx.sn} · {ctx.ml?.title ?? '—'}</dd></div>
          <div><dt>Học liệu gốc</dt><dd>PB {ctx.ml?.version_no ?? '?'}</dd></div><div><dt>Đơn vị</dt><dd>{orgName}</dd></div></dl></aside>
    </div></>
}
