import { Fragment, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../../lib/supabase'
import { norm } from '../ph1/ui'
import { Empty, Flow, Ic, Mau, PageHead, Panel, Search, Seg, Sel, StatCard, StatusPill, cssVar } from '../ph1/mau/kit'
import { SGLYPH } from '../ph1/mau/icons'
import { CoverDeco } from '../ph1/designs/blocks'
import { PAGE, TFORMAT, addD, fmtM, goto, monOf, platformOf, shortTitle, takeIntent, vn, vnS, wd, wdFull, type K, type Plan, type Prog, type Sess } from './api'
import { useP2, type P2 } from './use'

// 2.1b Kế hoạch & lịch tập huấn — dựng theo bản mẫu giao diện: Kế hoạch tập huấn (theo chương trình đã phát hành: chưa lập / đang lập dở / đã lập)
// › Đăng ký tham gia (học viên tự đăng ký, tiến độ hoàn thành chương trình qua nhiều đợt) › Lịch & lớp học trực tuyến (lịch tháng, lớp ảo, chi tiết buổi).
type Hol = { name: string; short_name: string | null; starts_on: string; ends_on: string; org_id: string }
const COLS = ['#2e6fd9', '#7b5cd6', '#0e8fa8', '#e08a0b']

export function TrainPlans({ orgId, go }: { orgId: string | null; go?: (p: string) => void }) {
  const P = useP2(orgId)
  const [tab, setTab] = useState<'plans' | 'reg' | 'cal'>('plans')
  const [open, setOpen] = useState<string | null>(null)
  const [creating, setCreating] = useState<string | null | false>(false)
  const [sess, setSess] = useState<string | null>(null)
  const [sedit, setSedit] = useState<string | null>(null)
  const [hols, setHols] = useState<Hol[]>([])
  useEffect(() => { supabase.from('school_holidays').select('name, short_name, starts_on, ends_on, org_id').then(({ data }) => setHols((data as Hol[]) ?? [])) }, [])
  useEffect(() => { const x = takeIntent(PAGE.kh); if (x?.open) { setOpen(x.open); if (x.sedit) setSedit(x.sedit) } }, [])
  const { k, db } = P
  const msg = P.msg ? <p className={P.msg.startsWith('✓') ? 'okmsg' : 'msg'} role="status" onClick={() => P.setMsg('')}>{P.msg}</p> : null
  if (!k || !db) return <Mau>{msg}<p className="sub">Đang tải…</p></Mau>
  const provHols = hols.filter(h => db.orgs.find(o => o.id === h.org_id)?.type !== 'school')
  const holOn = (iso: string) => provHols.filter(h => iso >= h.starts_on && iso <= h.ends_on)
  const S = sess ? db.sess.find(x => x.id === sess) ?? null : null
  const modal = S ? <SessModal P={P} k={k} s={S} onClose={() => setSess(null)} go={go} onEdit={() => { setSess(null); setCreating(false); setOpen(S.plan_id); setSedit(S.id); scrollTo(0, 0) }} /> : null
  if (creating !== false) return <Mau>{msg}<KhForm P={P} k={k} orgId={orgId} preProg={creating} holOn={holOn} onDone={id => { setCreating(false); if (id) setOpen(id) }} /></Mau>
  const p = k.plan(open)
  if (p) return <Mau>{msg}<KhDetail P={P} k={k} p={p} holOn={holOn} sedit={sedit} setSedit={setSedit} onSess={setSess} onBack={() => setOpen(null)}
    toEval={tabX => goto(go, PAGE.dg, { plan: p.id, tab: tabX })} />{modal}</Mau>
  const allS = db.sess
  return <Mau>{msg}
    <PageHead icon="calendar" title="Kế hoạch tập huấn" sub="Theo dõi từng chương trình đã phát hành: chưa lập kế hoạch, đang lập dở hay đã lập; buổi, học viên, tiến độ">
      {P.canManage && <button type="button" className="btn primary" onClick={() => setCreating(null)}><Ic n="plus" /> Lập kế hoạch</button>}</PageHead>
    <Flow steps={[['plans', 'Kế hoạch tập huấn', `${db.plans.length} đợt · chọn môn, thời gian`], ['reg', 'Đăng ký tham gia', `${db.plans.filter(x => k.regSt(x)[2] === 'open').length} đợt đang mở · học viên tự đăng ký`],
      ['cal', 'Lịch & lớp học trực tuyến', `${allS.length} buổi · ${allS.filter(s => s.mode === 'on' && !k.sessEnd(s)).length} buổi online sắp tới`]]} value={tab} onChange={setTab} />
    {tab === 'plans' ? <KhList P={P} k={k} onOpen={id => { setOpen(id); scrollTo(0, 0) }} onPlan={pid => { setCreating(pid); scrollTo(0, 0) }} />
      : tab === 'reg' ? <KhReg P={P} k={k} orgId={orgId} /> : <KhCal P={P} D={db} k={k} onSess={setSess} />}
    {modal}</Mau>
}

// ---------- Danh sách theo chương trình ----------
function KhList({ P, k, onOpen, onPlan }: { P: P2; k: K; onOpen: (id: string) => void; onPlan: (pid: string) => void }) {
  const db = P.db!
  const [f, setF] = useState({ q: '', prog: '', status: '', sch: '', subj: '' })
  const [view, setView] = useState<'table' | 'grid'>('table')
  const [shut, setShut] = useState<Set<string>>(new Set())
  const pubs = db.progs.filter(p => p.status === 'published'); const drafts = db.progs.filter(p => p.status === 'draft')
  const cnt = (x: string) => pubs.filter(p => k.progPlanSt(p)[0] === x).length
  const qq = norm(f.q); const order: Record<string, number> = { none: 0, doing: 1, done: 2 }
  const pOk = (p: Plan) => (!f.sch || !p.schools?.length || p.schools.includes(f.sch)) && (!f.subj || k.planSubjs(p).includes(f.subj))
  const shown = pubs.filter(pr => (!f.prog || pr.id === f.prog) && (!f.status || k.progPlanSt(pr)[0] === f.status) && (!qq || norm(`${pr.code} ${pr.name} ${k.plansOf(pr.id).map(p => p.title).join(' ')}`).includes(qq)))
    .filter(pr => !(f.sch || f.subj) || k.plansOf(pr.id).some(pOk) || (!k.plansOf(pr.id).length && (!f.subj || k.subjectsOf(pr).includes(f.subj))))
    .sort((a, b) => order[k.progPlanSt(a)[0]] - order[k.progPlanSt(b)[0]])
  const schools = Array.from(new Set(db.teachers.map(t => t.org_id))).map(id => [id, k.orgName(id)] as [string, string]).filter(x => x[1]).sort((a, b) => a[1].localeCompare(b[1]))
  const planCard = (p: Plan) => { const pr = k.prog(p.program_id)!; const g = k.groupOf(pr.group_code); const ss = k.sessOfPlan(p.id); const done = ss.filter(k.sessEnd).length; const [sl, sc] = k.planSt(p)
    return <article key={p.id} className="pcard dcard kcard" style={cssVar(g.color)} tabIndex={0} onClick={() => onOpen(p.id)}><div className="cover"><CoverDeco s={k.planSubjs(p)[0]} /><span>{pr.code} · {ss.length} buổi</span><b>{shortTitle(p.title)}</b></div>
      <h3>{p.title}</h3><small className="sub">{p.unit} · {k.planRange(p)}</small>
      <div className="chips">{k.planSubjs(p).map(s => <span key={s} className="chip k" style={cssVar(g.color)}>{k.SUBJ(s)}</span>)}<span className="chip">{p.schools?.length ? p.schools.length + ' trường' : 'Mọi trường'}</span></div>
      <div className="bar"><i style={{ width: `${ss.length ? done / ss.length * 100 : 0}%` }} /></div>
      <div className="foot"><span>{done}/{ss.length} buổi đã học · {k.traineesOf(p.id).length}/{p.cap} đăng ký</span><span className={`pill ${sc} plain`}>{sl}</span></div></article> }
  const planRow = (p: Plan) => { const ss = k.sessOfPlan(p.id); const done = ss.filter(k.sessEnd).length; const [sl, sc] = k.planSt(p)
    return <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => onOpen(p.id)}><td><b>{p.title}</b><br /><small className="sub">{p.unit} · {(p.schools ?? []).length || 'mọi'} trường</small></td><td>{k.planSubjs(p).map(k.SUBJ).join(', ')}</td><td>{k.planRange(p)}</td>
      <td className="c">{ss.length}</td><td className="c">{k.traineesOf(p.id).length}/{p.cap}</td><td><div className="bar sm"><i style={{ width: `${ss.length ? done / ss.length * 100 : 0}%` }} /></div><small className="sub">{done}/{ss.length} buổi</small></td>
      <td><span className={`pill ${sc} plain`}>{sl}</span></td></tr> }
  return <>
    <div className="stats"><StatCard c="c-blue" icon="book" label="Chương trình đã phát hành" value={pubs.length} sub={drafts.length ? drafts.length + ' chương trình còn nháp' : 'sẵn sàng lập kế hoạch'} />
      <StatCard c="c-red" icon="alert" label="Chưa lập kế hoạch" value={cnt('none')} sub="chương trình cần lập" />
      <StatCard c="c-amber" icon="edit" label="Đang lập dở" value={cnt('doing')} sub={db.plans.filter(p => p.status === 'draft').length + ' kế hoạch nháp'} />
      <StatCard c="c-green" icon="calendar" label="Đã lập kế hoạch" value={cnt('done')} sub={`${db.plans.length} kế hoạch · ${db.sess.length} buổi`} /></div>
    <div className="toolbar"><Search value={f.q} onChange={q => setF({ ...f, q })} placeholder="Tìm chương trình hoặc kế hoạch…" />
      <Sel label="Tất cả chương trình" value={f.prog} onChange={v => setF({ ...f, prog: v })} options={pubs.map(p => [p.id, `${p.code} · ${p.name}`])} />
      <Sel label="Mọi tình trạng lập kế hoạch" value={f.status} onChange={v => setF({ ...f, status: v })} options={[['none', 'Chưa lập kế hoạch'], ['doing', 'Đang lập dở'], ['done', 'Đã lập kế hoạch']]} />
      <Sel label="Tất cả trường" value={f.sch} onChange={v => setF({ ...f, sch: v })} options={schools} />
      <Sel label="Tất cả môn học" value={f.subj} onChange={v => setF({ ...f, subj: v })} options={Array.from(new Set(pubs.flatMap(k.subjectsOf))).map(s => [s, k.SUBJ(s)])} />
      <Seg label="Kiểu xem" items={[['table', 'Bảng'], ['grid', 'Thẻ']]} value={view} onChange={setView} />
      {Object.values(f).some(Boolean) && <button type="button" className="btn sm ghost" onClick={() => setF({ q: '', prog: '', status: '', sch: '', subj: '' })}>Xoá lọc</button>}</div>
    {shown.map(pr => { const g = k.groupOf(pr.group_code); const ps = k.plansOf(pr.id).filter(pOk); const [, sl, sc] = k.progPlanSt(pr); const tv = new Set(ps.flatMap(p => k.traineesOf(p.id))).size
      const head = <>{ps.length > 0 && <span className="chev"><Ic n="chev" /></span>}<span className="code sm">{pr.code}</span><b>{pr.name}</b>
        <small>{k.progH(pr)} giờ · {ps.length} đợt · đã lên kế hoạch {k.progCover(pr)}/{k.subjectsOf(pr).length} môn · {tv} học viên</small><span className={`pill ${sc} plain`}>{sl}</span>
        {P.canManage && <span className="act"><button type="button" className={'btn sm' + (ps.length ? '' : ' primary')} onClick={e => { e.preventDefault(); e.stopPropagation(); onPlan(pr.id) }}><Ic n="plus" /> Lập kế hoạch</button></span>}</>
      return ps.length ? <details key={pr.id} className="panel kprog" style={{ padding: 0, gap: 0 }} open={!shut.has(pr.id)} onToggle={e => { const o = (e.currentTarget as HTMLDetailsElement).open; setShut(x => { const n = new Set(x); if (o) n.delete(pr.id); else n.add(pr.id); return n }) }}>
        <summary className="phead" style={cssVar(g.color)}>{head}</summary>
        {view === 'grid' ? <div className="prgrid kgrid">{ps.map(planCard)}</div> : <div className="tblwrap"><table><thead><tr><th>Đợt tập huấn</th><th>Môn trong đợt</th><th>Thời gian</th><th className="c">Buổi</th><th className="c">Đăng ký</th><th>Tiến độ</th><th>Trạng thái</th></tr></thead><tbody>{ps.map(planRow)}</tbody></table></div>}</details>
        : <div key={pr.id} className="panel kprog noplan" style={{ padding: 0, gap: 0 }}><div className="phead" style={cssVar(g.color)}>{head}</div></div> })}
    {!shown.length && <Empty>Không có chương trình phù hợp.</Empty>}
    {drafts.length > 0 && <p className="note">{drafts.length} chương trình đang nháp ({drafts.map(p => p.code).join(', ')}) chưa lập kế hoạch được — phát hành ở mục Chương trình tập huấn trước.</p>}
  </>
}

// ---------- Đăng ký tham gia ----------
function KhReg({ P, k, orgId }: { P: P2; k: K; orgId: string | null }) {
  const db = P.db!
  const [F, setF] = useState({ school: '', subj: '', st: '', q: '' })
  const [openReg, setOpenReg] = useState<string | null>(null)
  const [rshut, setRshut] = useState<Set<string>>(new Set())
  const [asT, setAsT] = useState<string>('')
  const order: Record<string, number> = { open: 0, draft: 1, closed: 2 }
  const open = db.plans.filter(p => k.regSt(p)[2] === 'open')
  const T = db.teachers.find(t => t.id === asT) ?? db.teachers.find(t => db.trainees.some(x => x.teacher_id === t.id)) ?? db.teachers[0]
  const reg = (p: Plan, t: string) => P.run(supabase.from('ph2_trainees').insert({ plan_id: p.id, teacher_id: t, reg_at: k.T }), `✓ ${k.teacher(t).full_name} đã đăng ký “${p.title}”`)
  const unreg = (p: Plan, t: string) => P.run(supabase.from('ph2_trainees').delete().eq('plan_id', p.id).eq('teacher_id', t), '✓ Đã huỷ đăng ký')
  const card = (p: Plan) => { const pr = k.prog(p.program_id)!; const [sl, sc, kk] = k.regSt(p); const tr = db.trainees.filter(x => x.plan_id === p.id); const n = tr.length; const cap = p.cap ?? n; const op = openReg === p.id; const g = k.groupOf(pr.group_code)
    return <article key={p.id} className={'pcard dcard rcard' + (op ? ' open' : '')} style={cssVar(g.color)}><div className="cover"><CoverDeco s={k.planSubjs(p)[0]} /><span>{pr.code} · {kk === 'open' ? 'hạn ĐK ' + vn(p.reg_due) : k.planRange(p)}</span><b>{shortTitle(p.title)}</b></div>
      <h3>{p.title}</h3><small className="sub">{p.unit} · {k.planRange(p)}</small>
      <div className="chips">{k.planSubjs(p).map(s => <span key={s} className="chip k" style={cssVar(g.color)}>{k.SUBJ(s)}</span>)}<span className="chip">{p.schools?.length ? p.schools.length + ' trường' : 'Mọi trường'}</span><span className={`pill ${sc} plain`}>{sl}</span></div>
      <div className="bar"><i style={{ width: `${Math.min(100, n / (cap || 1) * 100)}%` }} /></div>
      <div className="foot"><span>{n}/{cap} đã đăng ký</span><span className="cbtns">{kk === 'draft' ? (P.canManage && <button type="button" className="btn sm primary" onClick={() => publish(P, k, p, true, true)}><Ic n="send" /> Phát hành & mở đăng ký</button>)
        : <button type="button" className="btn sm" onClick={() => setOpenReg(op ? null : p.id)}>{op ? 'Thu gọn' : 'Danh sách đăng ký'}</button>}</span></div>
      {op && <div className="tblwrap"><table><thead><tr><th>Học viên</th><th>Môn dạy</th><th>Ngày đăng ký</th><th>Các đợt trước cùng chương trình</th><th /></tr></thead><tbody>
        {tr.map(x => { const tt = k.teacher(x.teacher_id); const prev = k.plansOf(p.program_id).filter(y => y.id !== p.id && k.traineesOf(y.id).includes(x.teacher_id))
          return <tr key={x.teacher_id}><td><b>{tt.full_name}</b><br /><small className="sub">{tt.school}</small></td><td>{k.SUBJ(tt.subj) || tt.subject}</td><td>{vn(x.reg_at)}</td>
            <td>{prev.map(y => <span key={y.id} className="chip">{shortTitle(y.title)} · {k.evalOf(y, x.teacher_id).result}</span>)}{!prev.length && <span className="sub">Lần đầu</span>}</td>
            <td style={{ textAlign: 'right' }}>{kk === 'open' && P.canManage && <button type="button" className="btn sm ghost" onClick={() => unreg(p, x.teacher_id)}>Huỷ đăng ký</button>}</td></tr> })}
        {!tr.length && <tr><td colSpan={5} className="sub">Chưa có học viên đăng ký.</td></tr>}</tbody></table></div>}</article> }
  const progRows = db.progs.filter(pr => pr.status !== 'draft').flatMap(pr => db.teachers.map(t => ({ t, pr, g: k.progProgress(t.id, pr) })).filter(x => x.g.ps.length))
  const ok = (p: Plan) => (!F.school || !p.schools?.length || p.schools.includes(F.school)) && (!F.subj || k.planSubjs(p).includes(F.subj)) && (!F.st || k.regSt(p)[2] === F.st) && (!F.q || norm(p.title + ' ' + k.prog(p.program_id)?.name).includes(norm(F.q)))
  const progs = db.progs.filter(pr => db.plans.some(p => p.program_id === pr.id && ok(p)))
  const schools = Array.from(new Set(db.teachers.map(t => t.org_id))).map(id => [id, k.orgName(id)] as [string, string]).filter(x => x[1])
  return <>
    <div className="stats"><StatCard c="c-green" icon="users" label="Đang mở đăng ký" value={open.length} sub={open.reduce((a, p) => a + Math.max(0, p.cap - k.traineesOf(p.id).length), 0) + ' chỗ còn trống'} />
      <StatCard c="c-blue" icon="list" label="Lượt đăng ký" value={db.trainees.length} sub={new Set(db.trainees.map(x => x.teacher_id)).size + ' học viên'} />
      <StatCard c="c-violet" icon="book" label="Đang học dở chương trình" value={progRows.filter(x => x.g.done.size < x.g.all.length).length} sub="cần thêm đợt để đủ môn" />
      <StatCard c="c-amber" icon="award" label="Hoàn thành cả chương trình" value={progRows.filter(x => x.g.done.size === x.g.all.length).length} sub="đủ tất cả môn" /></div>
    <Panel icon="calendar" title="Đợt tập huấn & đăng ký" act={<small className="sub">Theo chương trình · học viên tự đăng ký ở cổng học viên</small>}>
      <div className="toolbar"><Search value={F.q} onChange={q => setF({ ...F, q })} placeholder="Tìm chương trình, đợt…" /><Sel label="Tất cả trường" value={F.school} onChange={v => setF({ ...F, school: v })} options={schools} />
        <Sel label="Tất cả môn học" value={F.subj} onChange={v => setF({ ...F, subj: v })} options={Array.from(new Set(db.plans.flatMap(k.planSubjs))).map(s => [s, k.SUBJ(s)])} />
        <Sel label="Mọi trạng thái đợt" value={F.st} onChange={v => setF({ ...F, st: v })} options={[['open', 'Đang mở đăng ký'], ['draft', 'Chưa mở đăng ký'], ['closed', 'Quá hạn đăng ký']]} />
        {(F.school || F.subj || F.st || F.q) && <button type="button" className="btn sm ghost" onClick={() => setF({ school: '', subj: '', st: '', q: '' })}>Xoá lọc</button>}</div>
      {progs.map(pr => { const g = k.groupOf(pr.group_code); const ps = db.plans.filter(p => p.program_id === pr.id && ok(p)).sort((a, b) => order[k.regSt(a)[2]] - order[k.regSt(b)[2]]); const nOpen = ps.filter(p => k.regSt(p)[2] === 'open').length
        return <details key={pr.id} className="kprog rprog" open={!rshut.has(pr.id)} onToggle={e => { const o = (e.currentTarget as HTMLDetailsElement).open; setRshut(x => { const n = new Set(x); if (o) n.delete(pr.id); else n.add(pr.id); return n }) }}>
          <summary className="phead" style={cssVar(g.color)}><span className="chev"><Ic n="chev" /></span><span className="code sm">{pr.code}</span><b>{pr.name}</b><small>{ps.length} đợt · {ps.reduce((a, p) => a + k.traineesOf(p.id).length, 0)} lượt đăng ký</small>{nOpen > 0 && <span className="pill good plain">{nOpen} đang mở</span>}</summary>
          <div className="prgrid">{ps.map(card)}</div></details> })}
      {!progs.length && <Empty>Không có đợt phù hợp bộ lọc.</Empty>}</Panel>
    <Panel icon="users" title="Tiến độ hoàn thành chương trình theo học viên"><div className="tblwrap"><table><thead><tr><th>Học viên</th><th>Chương trình</th><th>Môn đã hoàn thành</th><th>Đang học / còn thiếu</th><th>Trạng thái</th></tr></thead><tbody>
      {progRows.map(({ t, pr, g }) => <tr key={t.id + pr.id}><td><b>{t.full_name}</b><br /><small className="sub">{t.school}</small></td><td>{pr.code}<br /><small className="sub">{g.ps.length} đợt</small></td>
        <td>{[...g.done].map(s => <span key={s} className="chip k" style={cssVar('var(--good)')}>{k.SUBJ(s)}</span>)}{!g.done.size && '—'}</td>
        <td>{[...g.pend].map(s => <span key={s} className="chip k" style={cssVar('var(--info)')}>{k.SUBJ(s)}</span>)} {g.left.map(s => <span key={s} className="chip">{k.SUBJ(s)}</span>)}</td>
        <td>{g.done.size === g.all.length ? <span className="pill good plain">Hoàn thành chương trình</span> : <span className="pill warn plain">{g.done.size}/{g.all.length} môn</span>}</td></tr>)}
      {!progRows.length && <tr><td colSpan={5} className="sub">Chưa có học viên.</td></tr>}</tbody></table></div></Panel>
    {T && <Panel className="portal" icon="user" title={<>Cổng học viên <small className="sub">xem trước</small></>} act={<select value={T.id} onChange={e => setAsT(e.target.value)} aria-label="Chọn học viên">{db.teachers.slice(0, 400).map(x => <option key={x.id} value={x.id}>{x.full_name} · {x.school}</option>)}</select>}>
      <small className="sub">Học viên thấy các đợt đang mở và tự đăng ký; một chương trình có thể hoàn thành qua nhiều đợt.</small>
      {open.map(p => { const pr = k.prog(p.program_id)!; const on = k.traineesOf(p.id).includes(T.id); const why = on ? '' : k.canReg(p, T.id); const g = k.progProgress(T.id, pr)
        return <div key={p.id} className="pcardx"><div><b>{p.title}</b><small className="sub">{k.planSubjs(p).map(k.SUBJ).join(', ')} · {k.planRange(p)} · còn {p.cap - k.traineesOf(p.id).length} chỗ</small>{g.ps.length > 0 && <small className="sub">Bạn đã có {g.done.size}/{g.all.length} môn của {pr.code}</small>}</div>
          {on ? <button type="button" className="btn sm" onClick={() => unreg(p, T.id)}>✓ Đã đăng ký · Huỷ</button> : why ? <small className="badtxt">{why}</small> : <button type="button" className="btn sm primary" onClick={() => reg(p, T.id)}><Ic n="plus" /> Đăng ký</button>}</div> })}
      {!open.length && <Empty>Hiện chưa có đợt nào mở đăng ký.</Empty>}</Panel>}
    {!orgId && null}
  </>
}
async function publish(P: P2, k: K, p: Plan, hv: boolean, bgh: boolean) {
  const n = k.eligibleOf(p).length
  const row: Record<string, unknown> = { status: 'published' }
  if (!p.reg_due || p.reg_due < k.T) row.reg_due = addD(k.T, 10)
  if (hv || bgh) row.notice = { date: vn(k.T), n: hv ? n : 0, bgh }
  return P.run(supabase.from('ph2_plans').update(row).eq('id', p.id), hv || bgh ? `✓ Đã phát hành và gửi thông báo${hv ? ' tới ' + n + ' học viên' : ''}${bgh ? (hv ? ' + ' : ' tới ') + 'BGH các trường' : ''}` : '✓ Đã phát hành kế hoạch')
}

// ---------- Lịch tháng & lớp học trực tuyến ----------
function KhCal({ P, D, k, onSess }: { P: P2; D: NonNullable<P2['db']>; k: K; onSess: (id: string) => void }) {
  const [C, setC] = useState({ school: '', subj: '', prog: '' })
  const [month, setMonth] = useState(k.T.slice(0, 7))
  const [vpast, setVpast] = useState(false)
  const okPlan = (p: Plan) => (!C.prog || p.program_id === C.prog) && (!C.school || !p.schools?.length || p.schools.includes(C.school) || k.traineesOf(p.id).some(t => k.teacher(t).org_id === C.school))
  const sf = (s: Sess) => !C.subj || k.sessSubj(s) === C.subj
  const plans = D.plans.filter(okPlan); const n = plans.reduce((a, p) => a + k.sessOfPlan(p.id).filter(sf).length, 0)
  const [y, m] = month.split('-').map(Number); const first = `${month}-01`; const off = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7; const days = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const prev = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7), next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7); void first
  const color = (p: Plan) => COLS[D.plans.indexOf(p) % COLS.length]
  const all = plans.flatMap(p => k.sessOfPlan(p.id).filter(s => s.mode === 'on' && sf(s)).map(s => ({ p, s }))).sort((a, b) => (a.s.date + a.s.start_t).localeCompare(b.s.date + b.s.start_t))
  const kind = (s: Sess) => s.date < k.T ? 'ended' : s.date === k.T ? 'live' : 'soon'
  const SKN: Record<string, [string, string]> = { ended: ['Đã kết thúc', 'draft'], live: ['● Đang diễn ra', 'bad'], soon: ['Sắp diễn ra', 'info'] }
  const up = all.filter(x => kind(x.s) !== 'ended'), past = all.filter(x => kind(x.s) === 'ended')
  const schools = Array.from(new Set(D.teachers.map(t => t.org_id))).map(id => [id, k.orgName(id)] as [string, string]).filter(x => x[1])
  return <>
    <div className="toolbar"><Sel label="Tất cả trường" value={C.school} onChange={v => setC({ ...C, school: v })} options={schools} />
      <Sel label="Tất cả môn học" value={C.subj} onChange={v => setC({ ...C, subj: v })} options={Array.from(new Set(D.plans.flatMap(k.planSubjs))).map(s => [s, k.SUBJ(s)])} />
      <Sel label="Tất cả chương trình" value={C.prog} onChange={v => setC({ ...C, prog: v })} options={D.progs.filter(p => p.status !== 'draft').map(p => [p.id, `${p.code} · ${p.name}`])} />
      {(C.school || C.subj || C.prog) && <button type="button" className="btn sm ghost" onClick={() => setC({ school: '', subj: '', prog: '' })}>Xoá lọc</button>}
      <small className="sub" style={{ marginLeft: 'auto' }}>{n} buổi · {plans.filter(p => k.sessOfPlan(p.id).some(sf)).length} đợt{C.school ? ' · đợt mở cho trường hoặc có học viên của trường' : ''}</small></div>
    <Panel icon="calendar" title={`Tháng ${m}/${y}`} act={<><button type="button" className="btn sm" onClick={() => setMonth(prev)}>‹ Tháng trước</button><button type="button" className="btn sm" onClick={() => setMonth(k.T.slice(0, 7))}>Hôm nay</button><button type="button" className="btn sm" onClick={() => setMonth(next)}>Tháng sau ›</button></>}>
      <div className="mcal">{['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(x => <div key={x} className="mh">{x}</div>)}
        {Array.from({ length: off }, (_, i) => <div key={'o' + i} className="cd out" />)}
        {Array.from({ length: days }, (_, i) => { const date = `${month}-${String(i + 1).padStart(2, '0')}`
          const ss = plans.flatMap(p => k.sessOfPlan(p.id).filter(s => s.date === date && sf(s)).map(s => ({ p, s })))
          return <div key={date} className={'cd' + (date === k.T ? ' today' : '')}><span className="dn">{i + 1}</span>{ss.map(({ p, s }) => <button type="button" key={s.id} className={'cev ' + s.mode} style={cssVar(color(p))} title={`${p.title} · ${k.sessTitle(s)}`} onClick={() => onSess(s.id)}>
            <b>{s.start_t}</b> {k.sessTitle(s)}{s.mode === 'on' && <> <Ic n="video" /></>}</button>)}</div> })}</div>
      <div className="legend">{plans.filter(p => k.sessOfPlan(p.id).some(sf)).map(p => <span key={p.id}><i style={{ background: color(p) }} />{p.title}</span>)}<span><Ic n="video" /> trực tuyến</span></div></Panel>
    <Panel icon="video" title={<>Lớp học trực tuyến <small className="sub">{up.length} sắp tới · {all.filter(x => !x.s.link).length} chưa có link</small></>} act={past.length > 0 && <button type="button" className="btn sm ghost" onClick={() => setVpast(!vpast)}>{vpast ? 'Ẩn' : 'Xem'} {past.length} buổi đã kết thúc</button>}>
      {all.length ? <div className="vgrid">{[...up, ...(vpast ? past : [])].map(({ p, s }) => { const kd = kind(s)
        return <article key={s.id} className={'vcard ' + kd}><div className="vtop"><span className={`pill ${SKN[kd][1]} plain`}>{SKN[kd][0]}</span><small>{s.link ? platformOf(s.link) : 'chưa có link'}</small></div>
          <button type="button" className="linkbtn2 vtitle" onClick={() => onSess(s.id)}><b>{k.sessTitle(s)}</b></button><small className="sub">{p.title}</small>
          <div className="vmeta"><span><Ic n="calendar" /> {wd(s.date)}, {vn(s.date)}</span><span><Ic n="clock" /> {s.start_t}–{s.end_t}</span><span><Ic n="user" /> {s.trainer}</span><span><Ic n="users" /> {k.traineesOf(p.id).length} học viên</span></div>
          <div className="formact"><VirtBtns P={P} k={k} s={s} onSess={onSess} /></div></article> })}{!up.length && !vpast && <Empty>Không có buổi trực tuyến sắp tới.</Empty>}</div>
        : <Empty>Không có buổi trực tuyến trong bộ lọc.</Empty>}
      <small className="sub">Lớp ảo tạo từ buổi “Trực tuyến” của kế hoạch; hệ thống kết nối Google Meet/Zoom/MS Teams để tạo link, ghi hình và điểm danh theo thời gian tham gia.</small></Panel>
  </>
}
function VirtBtns({ k, s, onSess, P }: { k: K; s: Sess; onSess: (id: string) => void; P?: P2 }) {
  const kd = s.date < k.T ? 'ended' : 'soon'
  if (!s.link) return P?.canManage ? <button type="button" className="btn sm primary" onClick={() => P.run(supabase.from('ph2_sessions').update({ link: 'https://meet.google.com/kdi-' + Math.random().toString(36).slice(2, 5) + '-' + Math.random().toString(36).slice(2, 6) }).eq('id', s.id), '✓ Đã tạo lớp học ảo (Google Meet) và gửi link cho học viên')}><Ic n="plus" /> Tạo lớp học ảo</button>
    : <button type="button" className="btn sm" onClick={() => onSess(s.id)}>Chi tiết buổi</button>
  if (kd === 'ended') return <>{s.rec ? <a className="btn sm" href={s.rec} target="_blank" rel="noreferrer"><Ic n="play" /> Xem ghi hình</a> : <span className="sub">Không có ghi hình</span>}</>
  return <><a className="btn sm primary" href={s.link} target="_blank" rel="noreferrer"><Ic n="video" /> Vào lớp</a><button type="button" className="btn sm ghost" onClick={() => { try { navigator.clipboard?.writeText(s.link!) } catch { /* bỏ qua */ } }}><Ic n="copy" /> Sao chép link</button></>
}

// ---------- Chi tiết buổi ----------
function SessModal({ P, k, s, onClose, onEdit, go }: { P: P2; k: K; s: Sess; onClose: () => void; onEdit: () => void; go?: (p: string) => void }) {
  const p = k.plan(s.plan_id)!; const pr = k.prog(p.program_id)!; const md = k.mod(s.module_id); const ss = k.sessOfPlan(p.id); const n = ss.findIndex(x => x.id === s.id) + 1
  const kd = s.date < k.T ? 'ended' : s.date === k.T ? 'live' : 'soon'; const SKN: Record<string, [string, string]> = { ended: ['Đã kết thúc', 'draft'], live: ['● Đang diễn ra', 'bad'], soon: ['Sắp diễn ra', 'info'] }
  const tr = k.traineesOf(p.id); const pres = tr.filter(t => ['p', 'l'].includes(k.mark(s, t) ?? '')).length
  const ls = P.db!.lects.filter(l => l.module_id === s.module_id); const its = k.planItems(p).filter(i => i.mod && i.mod === s.module_id)
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }; addEventListener('keydown', h); return () => removeEventListener('keydown', h) }, [])
  const toAtt = () => goto(go, PAGE.dg, { plan: p.id, tab: 'att' })
  return <><div className="amask" onClick={onClose} /><div className="amodal certm" role="dialog" aria-modal="true" aria-label="Chi tiết buổi tập huấn" style={{ ['--kc' as string]: k.groupOf(pr.group_code).color }}>
    <div className="ahero"><span className="avatar">{n}</span><div><h2>{k.sessTitle(s) || 'Buổi tập huấn'}</h2><small>{p.title} · {wdFull(s.date)}, {vn(s.date)} · {s.start_t}–{s.end_t}</small></div><button type="button" className="btn sm ghost aclose" aria-label="Đóng" onClick={onClose}>✕</button></div>
    <div className="abodyw"><dl className="kv"><div><dt>Hình thức</dt><dd>{TFORMAT[s.mode]} <span className={`pill ${SKN[kd][1]} plain`}>{SKN[kd][0]}</span></dd></div><div><dt>Giảng viên</dt><dd>{s.trainer || 'Chưa phân công'}</dd></div>
      <div><dt>Trợ giảng</dt><dd>{p.assist?.join(', ') || '—'}</dd></div><div><dt>{s.mode === 'on' ? 'Nền tảng' : 'Địa điểm'}</dt><dd>{s.mode === 'on' ? platformOf(s.link) : s.place || '—'}</dd></div></dl>
      {s.mode === 'on' && <section className="sbox"><header><b><Ic n="video" /> Lớp học ảo</b></header>{s.link ? <div className="lnk"><Ic n="link" /><a href={s.link} target="_blank" rel="noreferrer">{s.link}</a></div> : <small className="sub">Chưa tạo lớp ảo cho buổi này — tạo xong hệ thống gửi link cho học viên.</small>}
        <div className="formact" style={{ justifyContent: 'flex-start' }}><VirtBtns P={P} k={k} s={s} onSess={() => undefined} />{kd === 'ended' && <button type="button" className="btn sm ghost" onClick={toAtt}><Ic n="check" /> Điểm danh</button>}</div></section>}
      <section className="sbox"><header><b><Ic n="book" /> Bài giảng & học liệu của mô-đun</b>{md && <button type="button" className="matbtn" onClick={() => goto(go, PAGE.bt, { open: md.id })}>{(() => { const st = k.matSt(md); return st.s === 'ok' ? <span className="pill good plain">Đủ</span> : st.s === 'draft' ? <span className="pill warn plain">Đang soạn</span> : <span className="pill draft plain">Chưa có</span> })()}</button>}</header>
        {ls.length ? ls.map(l => <div key={l.id} className="lnk"><Ic n="edit" /><span style={{ flex: 1, minWidth: 0 }}><b>{l.title}</b> <small className="sub">{l.status === 'published' ? 'đã xuất bản' : 'nháp'}</small></span><button type="button" className="btn sm" onClick={() => goto(go, PAGE.bt, { lect: l.id })}><Ic n="play" /> Mở</button></div>)
          : <small className="sub">Chưa có bài giảng cho mô-đun này.</small>}
        {its.length > 0 && <small className="sub">Sau buổi: {its.map((i, j) => <Fragment key={i.id}>{j > 0 && ', '}<b>{i.name}</b> (hạn {vn(k.itemDue(p, i))})</Fragment>)}</small>}</section>
      <section className="sbox"><header><b><Ic n="check" /> Điểm danh buổi</b>{k.sessEnd(s) && <button type="button" className="btn sm" onClick={toAtt}>Mở bảng điểm danh</button>}</header>
        {k.sessEnd(s) ? <><div className="sbar"><span>Có mặt</span><div className="hbar"><i style={{ width: `${tr.length ? pres / tr.length * 100 : 0}%` }} /></div><b>{pres}/{tr.length}</b></div><small className="sub">{s.mode === 'on' ? 'Lấy tự động theo thời gian tham gia lớp ảo, có thể chỉnh tay.' : 'Giảng viên/trợ giảng điểm danh tại lớp.'}</small></>
          : <small className="sub">Mở sau khi buổi diễn ra · {tr.length} học viên đăng ký.</small>}</section></div>
    <div className="afoot"><button type="button" className="btn big" onClick={onClose}>Đóng</button>{P.canManage && <button type="button" className="btn primary big" onClick={onEdit}><Ic n="edit" /> Sửa buổi / phân công</button>}</div></div></>
}

// ---------- Lịch dải tuần ----------
function TrainCal({ k, sessions, holOn }: { k: K; sessions: { date: string; start_t: string; end_t: string; module_id: string | null; subject: string | null; mode: string; place: string | null; trainer: string | null }[]; holOn: (iso: string) => Hol[] }) {
  if (!sessions.length) return <Empty>Chưa có buổi nào.</Empty>
  const ss = [...sessions].sort((a, b) => (a.date + a.start_t).localeCompare(b.date + b.start_t))
  const w0 = monOf(ss[0].date), w1 = monOf(ss[ss.length - 1].date); const ws: string[] = []; for (let d = w0; d <= w1; d = addD(d, 7)) ws.push(d)
  while (ws.length < 6) ws.push(addD(ws[ws.length - 1], 7))
  const col = new Map(ws.map((w, i) => [w, i + 2])); const gcols = { gridTemplateColumns: `var(--lab) repeat(${ws.length},var(--cw))` }
  const months: { k: string; c: number; n: number }[] = []; ws.forEach((w, i) => { const kk = w.slice(0, 7); const m = months[months.length - 1]; if (m && m.k === kk) m.n++; else months.push({ k: kk, c: i + 2, n: 1 }) })
  const wHol = (w: string) => { const hs = new Set<string>(); for (let i = 0; i < 7; i++) holOn(addD(w, i)).forEach(h => hs.add(h.short_name || h.name)); return [...hs] }
  const subj = (s: typeof ss[0]) => s.subject ?? k.mod(s.module_id)?.subject ?? ''
  const subs = Array.from(new Set(ss.map(subj).filter(Boolean)))
  const conf = ss.filter(s => holOn(s.date).length)
  return <div className="tcal"><div className="tblwrap"><div className="cal">
    <div className="crow chead" style={gcols}><span className="clab">Tháng</span>{months.map(m => <div key={m.k} className="cmonth" style={{ gridColumn: `${m.c}/span ${m.n}` }} title={`Tháng ${+m.k.slice(5)}/${m.k.slice(0, 4)}`}>{m.n > 1 ? 'Tháng ' : 'T'}{+m.k.slice(5)}/{m.n > 1 ? m.k.slice(0, 4) : m.k.slice(2, 4)}</div>)}</div>
    <div className="crow chead" style={gcols}><span className="clab">Tuần tập huấn</span>{ws.map((w, i) => <div key={w} className={'cweek' + (w <= k.T && addD(w, 6) >= k.T ? ' now' : '')} style={{ gridColumn: col.get(w) }}>{i + 1}</div>)}</div>
    <div className="crow chead" style={gcols}><span className="clab">Ngày (T2–CN)</span>{ws.map(w => <div key={w} className="cday" style={{ gridColumn: col.get(w) }}>{w.slice(8)}<small>–{addD(w, 6).slice(8)}</small></div>)}</div>
    {ws.some(w => wHol(w).length) && <div className="crow chead" style={gcols}><span className="clab">Nghỉ lễ</span>{ws.filter(w => wHol(w).length).map(w => <div key={w} className="chol part" style={{ gridColumn: col.get(w) }} title={wHol(w).join(', ')}>{wHol(w)[0]}</div>)}</div>}
    {subs.map((sj, ri) => { const mine = ss.filter(s => subj(s) === sj); const lanes = new Map<string, number>(); const lane = mine.map(s => { const w = monOf(s.date); const n = lanes.get(w) ?? 0; lanes.set(w, n + 1); return n }); const L = Math.max(1, ...lanes.values())
      return <div key={sj} className="crow cbody" style={{ ...gcols, gridTemplateRows: `repeat(${L},30px)` }}><span className="clab"><b>{k.SUBJ(sj)}</b><small>{mine.length} buổi</small></span>
        {ws.map(w => <div key={w} className={'ccell' + (wHol(w).length ? ' hol' : '')} style={{ gridColumn: col.get(w), gridRow: `1/span ${L}` }} />)}
        {mine.map((s, i) => { const n = ss.indexOf(s) + 1; const hol = holOn(s.date)
          return <div key={i} className={`clesson c${ri % 4}${hol.length ? ' conf' : ''}${k.sessEnd(s as Sess) ? ' past' : ''}${s.mode === 'on' ? ' online' : ''}`} style={{ gridColumn: col.get(monOf(s.date)), gridRow: lane[i] + 1 }} tabIndex={0}
            title={`Buổi ${n}: ${k.mod(s.module_id)?.title ?? k.SUBJ(s.subject)}\n${wd(s.date)}, ${vn(s.date)} · ${s.start_t}–${s.end_t}\n${TFORMAT[s.mode]}${s.mode === 'on' ? '' : ' · ' + (s.place || 'chưa có địa điểm')}\nGiảng viên: ${s.trainer || 'chưa phân công'}${hol.length ? '\n⚠ Trùng ngày nghỉ: ' + hol.map(h => h.name).join(', ') : ''}`}
            aria-label={`Buổi ${n}, ${vn(s.date)}`}><span>{hol.length ? '⚠' : ''}{wd(s.date)} {s.date.slice(8)}</span></div> })}</div> })}</div></div>
    <div className="legend"><span><i style={{ background: '#2563eb' }} />Buổi trực tiếp</span><span><i style={{ background: 'repeating-linear-gradient(135deg,#2563eb 0 4px,#60a5fa 4px 8px)' }} />Buổi trực tuyến</span><span><i className="hdot" />Tuần có ngày nghỉ lễ</span>
      {conf.length > 0 && <span className="badtxt">⚠ {conf.length} buổi trùng ngày nghỉ — đổi ngày ở bảng lịch buổi</span>}<span>Rê chuột vào ô để xem chi tiết buổi</span></div></div>
}

// ---------- Chi tiết kế hoạch ----------
function KhDetail({ P, k, p, holOn, sedit, setSedit, onSess, onBack, toEval }: { P: P2; k: K; p: Plan; holOn: (iso: string) => Hol[]; sedit: string | null; setSedit: (v: string | null) => void
  onSess: (id: string) => void; onBack: () => void; toEval: (tab: string) => void }) {
  const pr = k.prog(p.program_id)!; const ss = k.sessOfPlan(p.id); const done = ss.filter(k.sessEnd).length
  const [sub, setSub] = useState<'sched' | 'people'>('sched'); const [view, setView] = useState<'table' | 'cal'>('table')
  const [addS, setAddS] = useState(false); const [pubAsk, setPubAsk] = useState(false); const [hv, setHv] = useState(true); const [bgh, setBgh] = useState(true)
  const can = P.canManage; const trs = k.traineesOf(p.id); const mods = k.allMods(pr)
  const trainers = P.db!.cat.filter(c => c.kind === 'trainer')
  const [ns, setNs] = useState({ date: addD(ss[ss.length - 1]?.date ?? k.T, 7), from: ss[0]?.start_t ?? '08:00', to: ss[0]?.end_t ?? '11:00', mod: mods[0]?.m.id ?? '', mode: 'off', place: ss[0]?.place ?? '', tr: ss[0]?.trainer ?? '' })
  const [es, setEs] = useState<Record<string, string>>({})
  useEffect(() => { const s = ss.find(x => x.id === sedit); if (s) setEs({ date: s.date, start: s.start_t, end: s.end_t, module: s.module_id ?? '', mode: s.mode, where: (s.mode === 'on' ? s.link : s.place) ?? '', trainer: s.trainer ?? '' }) }, [sedit])
  const dl = <datalist id="p2-trainers">{trainers.map(r => <option key={r.id} value={r.name}>{r.info.org}</option>)}</datalist>
  const row = (s: Sess, i: number) => { const md = k.mod(s.module_id)
    if (sedit === s.id) return <tr key={s.id} className="editing"><td className="n">{i + 1}</td><td>{wdFull(es.date ?? s.date)}</td><td><input type="date" value={es.date ?? ''} onChange={e => setEs({ ...es, date: e.target.value })} /></td>
      <td><input type="time" value={es.start ?? ''} onChange={e => setEs({ ...es, start: e.target.value })} /> – <input type="time" value={es.end ?? ''} onChange={e => setEs({ ...es, end: e.target.value })} /></td>
      <td><select value={es.module} onChange={e => setEs({ ...es, module: e.target.value })}>{!s.module_id && <option value="">{k.SUBJ(s.subject)}</option>}{mods.map(({ m }) => <option key={m.id} value={m.id}>{m.title}</option>)}</select></td>
      <td><select value={es.mode} onChange={e => setEs({ ...es, mode: e.target.value })}><option value="off">Trực tiếp</option><option value="on">Trực tuyến</option></select></td>
      <td><input value={es.where ?? ''} onChange={e => setEs({ ...es, where: e.target.value })} placeholder={es.mode === 'on' ? 'Link lớp ảo (để trống: tạo sau)' : 'Địa điểm'} /></td>
      <td>{dl}<input list="p2-trainers" value={es.trainer ?? ''} onChange={e => setEs({ ...es, trainer: e.target.value })} /></td>
      <td colSpan={2} style={{ whiteSpace: 'nowrap' }}><button type="button" className="btn sm primary" onClick={async () => { const m = k.mod(es.module || null)
        if (await P.run(supabase.from('ph2_sessions').update({ date: es.date, start_t: es.start, end_t: es.end, module_id: es.module || null, subject: m?.subject ?? s.subject, mode: es.mode, trainer: es.trainer, ...(es.mode === 'on' ? { link: es.where || null, place: null } : { place: es.where, link: null }) }).eq('id', s.id), '✓ Đã cập nhật buổi và phân công')) setSedit(null) }}><Ic n="check" /> Lưu</button>
        <button type="button" className="btn sm ghost" onClick={() => setSedit(null)}>Huỷ</button></td></tr>
    return <tr key={s.id}><td className="n">{i + 1}</td><td>{wdFull(s.date)}</td><td><b>{vn(s.date)}</b></td><td>{s.start_t}–{s.end_t}</td><td>{md?.title ?? k.SUBJ(s.subject)}<br /><small className="sub">{md ? k.SUBJ(md.subject) : ''}</small></td>
      <td><span className={`pill ${s.mode === 'on' ? 'info' : 'draft'} plain`}>{TFORMAT[s.mode]}</span></td><td>{s.mode === 'on' ? (s.link ? <a href={s.link} target="_blank" rel="noreferrer">{platformOf(s.link)}</a> : <span className="sub">chưa tạo lớp ảo</span>) : s.place}</td>
      <td>{s.trainer}</td><td>{k.sessEnd(s) ? <span className="pill good plain">Đã diễn ra</span> : <span className="pill info plain">Sắp tới</span>}</td>
      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}><button type="button" className="btn sm ghost" aria-label="Chi tiết buổi" onClick={() => onSess(s.id)}><Ic n="eye" /></button>
        {can && <><button type="button" className="btn sm ghost" aria-label="Sửa buổi / phân công" onClick={() => setSedit(s.id)}><Ic n="edit" /></button><button type="button" className="btn sm ghost" aria-label="Xoá buổi" onClick={() => P.run(supabase.from('ph2_sessions').delete().eq('id', s.id), '✓ Đã xoá buổi')}><Ic n="trash" /></button></>}</td></tr> }
  const reg = k.regSt(p)
  return <>
    <button type="button" className="btn sm ghost" onClick={onBack}><Ic n="back" /> Danh sách kế hoạch</button>
    <div className="dhead"><span className="code" style={cssVar(k.groupOf(pr.group_code).color)}>{pr.code}</span><div><h1>{p.title}</h1><span className="crumb">{pr.name} · {p.unit} · {k.planRange(p)} · {p.schools?.length ? p.schools.length + ' trường tham gia' : 'mở cho mọi trường'}</span></div><StatusPill s={p.status} />
      <div className="act">{can && (p.status !== 'published' ? <button type="button" className="btn primary" onClick={() => setPubAsk(true)}><Ic n="send" /> Phát hành kế hoạch</button>
        : !ss.some(s => !k.sessEnd(s)) && !p.confirmed ? <button type="button" className="btn primary" onClick={() => toEval('result')}><Ic n="check" /> Kết thúc đợt & chốt kết quả</button>
        : reg[2] === 'open' ? <button type="button" className="btn" onClick={() => { const n = k.eligibleOf(p).filter(t => !trs.includes(t.id)).length; P.run(supabase.from('ph2_plans').update({ notice: { ...(p.notice ?? { bgh: false }), date: vn(k.T), n } }).eq('id', p.id), `✓ Đã gửi nhắc đăng ký tới ${n} học viên chưa đăng ký`) }}><Ic n="send" /> Gửi thông báo nhắc</button> : null)}
        <button type="button" className="btn" onClick={() => toEval('att')}><Ic n="award" /> Đánh giá kết quả</button></div></div>
    {pubAsk && <Panel className="pubask" icon="send" title="Phát hành & gửi thông báo">
      <label className="chk"><input type="checkbox" checked={hv} onChange={e => setHv(e.target.checked)} /> Gửi thông báo mở đăng ký tới <b>{k.eligibleOf(p).length} học viên</b> đủ điều kiện (ứng dụng + email)</label>
      <label className="chk"><input type="checkbox" checked={bgh} onChange={e => setBgh(e.target.checked)} /> Gửi tới Ban giám hiệu {p.schools?.length ? p.schools.length + ' trường được mời' : 'tất cả các trường'}</label>
      <small className="sub">Nội dung: tên đợt, môn học, {k.planRange(p)}, hạn đăng ký {vn(p.reg_due)}{k.condText(p).length ? ', điều kiện tham gia' : ''}.</small>
      <div className="formact"><button type="button" className="btn ghost" onClick={() => setPubAsk(false)}>Huỷ</button><button type="button" className="btn primary" onClick={async () => { if (await publish(P, k, p, hv, bgh)) setPubAsk(false) }}><Ic n="send" /> Phát hành</button></div></Panel>}
    <section className="panel kinfo"><dl className="kv"><div><dt>Đơn vị tổ chức</dt><dd>{p.unit}</dd></div><div><dt>Giảng viên</dt><dd>{Array.from(new Set(ss.map(s => s.trainer).filter(Boolean))).join(', ') || 'Chưa phân công'}</dd></div><div><dt>Trợ giảng</dt><dd>{p.assist?.join(', ') || '—'}</dd></div>
      <div><dt>Đăng ký</dt><dd>{trs.length}/{p.cap} · hạn {vn(p.reg_due)}</dd></div><div><dt>Điều kiện tham gia</dt><dd>{k.condText(p).map((x, i) => <Fragment key={i}>{i > 0 && <br />}{x}</Fragment>)}{!k.condText(p).length && 'Không giới hạn'}{p.schools?.length > 0 && <><br /><small className="sub">{p.schools.length} trường được mời</small></>}</dd></div>
      <div><dt>Thông báo</dt><dd>{p.notice ? `Đã gửi ${p.notice.date} · ${p.notice.n} học viên${p.notice.bgh ? ' + BGH' : ''}` : <span className="sub">Chưa gửi</span>}</dd></div></dl></section>
    <div className="stats"><StatCard c="c-blue" icon="list" label="Buổi tập huấn" value={ss.length} sub={`${done} đã diễn ra · ${ss.length - done} sắp tới`} />
      <StatCard c="c-violet" icon="video" label="Trực tuyến" value={ss.filter(s => s.mode === 'on').length} sub="buổi học qua lớp ảo" />
      <StatCard c="c-green" icon="clock" label="Tổng giờ" value={k.planSubjs(p).reduce((a, s) => a + k.subjH(pr, s), 0)} sub={fmtM(pr.mpp) + '/buổi'} />
      <StatCard c="c-amber" icon="users" label="Học viên đăng ký" value={trs.length} sub="người" /></div>
    <div className="tabs"><button type="button" className={sub === 'sched' ? 'on' : ''} onClick={() => setSub('sched')}>Lịch buổi <small>{ss.length}</small></button><button type="button" className={sub === 'people' ? 'on' : ''} onClick={() => setSub('people')}>Học viên đăng ký <small>{trs.length}/{p.cap}</small></button></div>
    {sub === 'people' ? <KhPeople P={P} k={k} p={p} pr={pr} /> : <>
      <div className="toolbar"><Seg label="Kiểu xem" items={[['table', 'Bảng'], ['cal', 'Lịch']]} value={view} onChange={setView} />{can && <button type="button" className="btn sm" onClick={() => setAddS(!addS)}><Ic n="plus" /> Thêm buổi</button>}</div>
      {addS && <Panel icon="plus" title="Thêm buổi tập huấn"><div className="form3">
        <label className="fld"><span>Ngày</span><input type="date" value={ns.date} onChange={e => setNs({ ...ns, date: e.target.value })} /></label><label className="fld"><span>Bắt đầu</span><input type="time" value={ns.from} onChange={e => setNs({ ...ns, from: e.target.value })} /></label>
        <label className="fld"><span>Kết thúc</span><input type="time" value={ns.to} onChange={e => setNs({ ...ns, to: e.target.value })} /></label>
        <label className="fld"><span>Mô-đun</span><select value={ns.mod} onChange={e => setNs({ ...ns, mod: e.target.value })}>{mods.map(({ s, m }) => <option key={m.id} value={m.id}>{k.SUBJ(s)} · {m.title}</option>)}</select></label>
        <label className="fld"><span>Hình thức</span><select value={ns.mode} onChange={e => setNs({ ...ns, mode: e.target.value })}><option value="off">Trực tiếp</option><option value="on">Trực tuyến</option></select></label>
        <label className="fld"><span>Địa điểm (nếu trực tiếp)</span><input value={ns.place ?? ''} onChange={e => setNs({ ...ns, place: e.target.value })} /></label>
        <label className="fld"><span>Giảng viên</span>{dl}<input list="p2-trainers" value={ns.tr ?? ''} onChange={e => setNs({ ...ns, tr: e.target.value })} /></label></div>
        <div className="formact"><button type="button" className="btn ghost" onClick={() => setAddS(false)}>Huỷ</button><button type="button" className="btn primary" onClick={async () => { const m = k.mod(ns.mod)
          if (await P.run(supabase.from('ph2_sessions').insert({ plan_id: p.id, date: ns.date, start_t: ns.from, end_t: ns.to, module_id: ns.mod || null, subject: m?.subject ?? null, mode: ns.mode, place: ns.mode === 'on' ? null : ns.place, trainer: ns.tr }), '✓ Đã thêm buổi tập huấn')) setAddS(false) }}><Ic n="check" /> Thêm buổi</button></div></Panel>}
      {view === 'cal' ? <section className="panel"><TrainCal k={k} sessions={ss} holOn={holOn} /></section>
        : <div className="panel" style={{ padding: 0 }}><div className="tblwrap"><table><thead><tr><th>STT</th><th>Thứ</th><th>Ngày</th><th>Giờ</th><th>Mô-đun</th><th>Hình thức</th><th>Địa điểm / lớp ảo</th><th>Giảng viên</th><th>Trạng thái</th><th /></tr></thead><tbody>{ss.map(row)}</tbody>
          <tfoot><tr><td className="n">{ss.length}</td><td /><td colSpan={2}>Tổng {ss.length} buổi</td><td>{new Set(ss.map(s => s.module_id ?? s.subject)).size} mô-đun</td><td>{ss.filter(s => s.mode === 'on').length} trực tuyến</td><td colSpan={2} /><td>{done} đã diễn ra</td><td /></tr></tfoot></table></div></div>}</>}
  </>
}
function KhPeople({ P, k, p, pr }: { P: P2; k: K; p: Plan; pr: Prog }) {
  const [pick, setPick] = useState(false); const [q, setQ] = useState('')
  const subs = k.subjectsOf(pr); const trs = k.traineesOf(p.id)
  const cand = P.db!.teachers.filter(t => !trs.includes(t.id) && (!q || norm(t.full_name + ' ' + t.school).includes(norm(q)))).sort((a, b) => Number(subs.includes(b.subj)) - Number(subs.includes(a.subj))).slice(0, 60)
  return <>
    <div className="toolbar"><span className="sub">Gợi ý học viên dạy {subs.map(k.SUBJ).join(', ')}.</span>{P.canManage && <button type="button" className="btn sm" style={{ marginLeft: 'auto' }} onClick={() => setPick(!pick)}><Ic n="plus" /> {pick ? 'Đóng chọn học viên' : 'Thêm học viên'}</button>}</div>
    {pick && <section className="panel"><Search value={q} onChange={setQ} placeholder="Tìm giáo viên, trường…" /><div className="pickgrid">{cand.map(t => <label key={t.id} className={'pick' + (subs.includes(t.subj) ? ' sug' : '')}>
      <input type="checkbox" onChange={() => P.run(supabase.from('ph2_trainees').insert({ plan_id: p.id, teacher_id: t.id, reg_at: k.T }))} /><span><b>{t.full_name}</b><small>{t.school} · {k.SUBJ(t.subj) || t.subject}{subs.includes(t.subj) ? ' · đúng môn' : ''}</small></span></label>)}
      {!cand.length && <span className="sub">Không còn giáo viên phù hợp.</span>}</div></section>}
    <div className="panel" style={{ padding: 0 }}><div className="tblwrap"><table><thead><tr><th>STT</th><th>Mã HV</th><th>Họ tên</th><th>Đơn vị</th><th>Môn dạy</th><th /></tr></thead><tbody>
      {trs.map((id, i) => { const t = k.teacher(id); return <tr key={id}><td className="n">{i + 1}</td><td><code>{t.code}</code></td><td><b>{t.full_name}</b></td><td>{t.school}</td><td>{k.SUBJ(t.subj) || t.subject}</td>
        <td style={{ textAlign: 'right' }}>{P.canManage && <button type="button" className="btn sm ghost" aria-label="Bỏ học viên" onClick={() => P.run(supabase.from('ph2_trainees').delete().eq('plan_id', p.id).eq('teacher_id', id))}><Ic n="trash" /></button>}</td></tr> })}
      {!trs.length && <tr><td colSpan={6} className="sub">Chưa có học viên.</td></tr>}</tbody></table></div></div>
  </>
}

// ---------- Lập kế hoạch ----------
type KF = { prog: string; subjs: string[] | null; title: string; unit: string; start: string; step: number | 'custom'; days: number[]; every: number; from: string; to: string; mode: 'off' | 'on'; place: string; trainer: string; assist: string
  schools: string[]; cap: number; regDue: string; subjOnly: boolean; prereq: string; cond: string }
function KhForm({ P, k, orgId, preProg, holOn, onDone }: { P: P2; k: K; orgId: string | null; preProg: string | null; holOn: (iso: string) => Hol[]; onDone: (id?: string) => void }) {
  const db = P.db!
  const pubs = db.progs.filter(p => p.status === 'published')
  const [v, setV] = useState<KF>(() => ({ prog: preProg ?? pubs[0]?.id ?? '', subjs: null, title: '', unit: k.orgName(orgId) || 'Sở GD&ĐT', start: addD(k.T, 10), step: 7, days: [6], every: 1, from: '08:00', to: '11:00', mode: 'off', place: '', trainer: '', assist: '',
    schools: [], cap: 40, regDue: addD(k.T, 6), subjOnly: false, prereq: '', cond: '' }))
  const [sq, setSq] = useState(''); const [busy, setBusy] = useState(false)
  const pr = k.prog(v.prog); const subs = pr ? k.subjectsOf(pr) : []
  const others = pr ? k.plansOf(pr.id) : []
  const subjs = v.subjs && pr && v.subjs.every(s => subs.includes(s)) ? v.subjs : (() => { const done = new Set(others.flatMap(k.planSubjs)); const x = subs.filter(s => !done.has(s)); return x.length ? x : [...subs] })()
  const set = (x: Partial<KF>) => setV({ ...v, ...x })
  const prevS = pr && subjs.length ? k.genSessions(pr, v.start, v.step === 'custom' ? { days: v.days, every: v.every } : v.step, v.from, v.to, v.mode, v.place, v.trainer, subjs) : []
  const miss = [!pr && 'chương trình', pr && !subjs.length && 'môn học của đợt'].filter(Boolean)
  const units = db.cat.filter(c => c.kind === 'unit'); const trainers = db.cat.filter(c => c.kind === 'trainer')
  const allSch = Array.from(new Set(db.teachers.map(t => t.org_id))).filter(id => k.orgName(id)).sort((a, b) => k.orgName(a).localeCompare(k.orgName(b)))
  const sec = (icon: string, n: number, title: string, hint: string, body: ReactNode) => <section className="fsec"><header><span className="fsi"><Ic n={icon} /></span><div><b>{n}. {title}</b><small>{hint}</small></div></header>{body}</section>
  async function save() {
    if (!pr) return P.setMsg('Chưa có chương trình đã phát hành'); if (!subjs.length) return P.setMsg('Chọn ít nhất một môn cho đợt này'); if (!orgId) return
    setBusy(true)
    const { data, error } = await supabase.from('ph2_plans').insert({ org_id: orgId, program_id: pr.id, title: v.title.trim() || `Tập huấn ${pr.name} – đợt ${others.length + 1}`, unit: v.unit, status: 'draft', subjs, cap: v.cap, reg_due: v.regDue,
      schools: v.schools, assist: v.assist.split(',').map(x => x.trim()).filter(Boolean), cond: v.cond.trim() || null, prereq: v.prereq || null, subj_only: v.subjOnly }).select('id').single()
    if (error) { setBusy(false); return P.setMsg(error.message) }
    const id = (data as { id: string }).id
    if (prevS.length) { const r = await supabase.from('ph2_sessions').insert(prevS.map(s => ({ ...s, plan_id: id, trainer: s.trainer || 'Chưa phân công', place: s.place || null, link: null }))); if (r.error) P.setMsg(r.error.message) }
    setBusy(false); await P.reload(); P.setMsg(`✓ Đã tạo đợt tập huấn (nháp) với ${prevS.length} buổi — phát hành để mở đăng ký`); onDone(id)
  }
  return <>
    <button type="button" className="btn sm ghost" onClick={() => onDone()}><Ic n="back" /> Danh sách kế hoạch</button>
    <div className="tfwrap"><div className="tfmain">
      {sec('book', 1, 'Chương trình & môn học của đợt', 'Một chương trình có thể chia nhiều đợt tập huấn; mỗi đợt chọn một số môn', <>
        <div className="ppick">{pubs.map(p => { const g = k.groupOf(p.group_code)
          return <button type="button" key={p.id} className={'popt' + (v.prog === p.id ? ' on' : '')} style={cssVar(g.color)} onClick={() => set({ prog: p.id, subjs: null })}><span className="code sm">{p.code}</span>
            <span><b>{p.name}</b><small>{k.subjectsOf(p).map(k.SUBJ).join(', ')} · {k.progH(p)} giờ · {k.plansOf(p.id).length} đợt đã lập</small></span></button> })}</div>
        {!pubs.length && <Empty>Chưa có chương trình đã phát hành — phát hành ở mục Chương trình tập huấn trước.</Empty>}
        {pr && <div className="fld"><span>Môn học trong đợt này</span><div className="slist">{subs.map(s => { const inO = others.filter(p => k.planSubjs(p).includes(s)); const on = subjs.includes(s)
          return <label key={s} className={'ksub' + (on ? ' on' : '')}><input type="checkbox" checked={on} onChange={e => set({ subjs: e.target.checked ? [...subjs, s] : subjs.filter(x => x !== s) })} /><svg viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: SGLYPH[s] ?? SGLYPH.khtn }} />
            <b>{k.SUBJ(s)}</b><small>{k.subjH(pr, s)} giờ · {k.subjMods(pr, s).length ? k.subjMods(pr, s).length + ' mô-đun' : 'chưa chia mô-đun'}</small>{inO.length ? <em>đã có ở {inO.map(p => shortTitle(p.title)).join(', ')}</em> : <em className="new">chưa có đợt nào</em>}</label> })}</div></div>}
        <input className="bigin" value={v.title} onChange={e => set({ title: e.target.value })} placeholder={`Tên đợt, VD: Tập huấn ${pr?.name ?? ''} – đợt ${others.length + 1}`} aria-label="Tên đợt tập huấn" />
        <div className="frow"><label className="fld"><span>Đơn vị tổ chức</span><input list="p2-units2" value={v.unit} onChange={e => set({ unit: e.target.value })} /><datalist id="p2-units2">{units.map(u => <option key={u.id} value={u.name} />)}</datalist></label></div></>)}
      {sec('users', 2, 'Mở đăng ký tham gia', 'Học viên tự đăng ký ở cổng học viên sau khi kế hoạch được phát hành — theo dõi ở bước Đăng ký tham gia', <>
        <div className="frow"><label className="fld"><span>Sĩ số tối đa</span><input type="number" min={1} value={v.cap} onChange={e => set({ cap: +e.target.value || 1 })} /></label><label className="fld"><span>Hạn đăng ký</span><input type="date" value={v.regDue} onChange={e => set({ regDue: e.target.value })} /></label></div>
        <div className="fld"><span>Trường được đăng ký <em className="sub">— bỏ trống: mở cho tất cả</em></span><div className="sclist"><div className="sclh"><Ic n="search" /><input value={sq} onChange={e => setSq(e.target.value)} placeholder="Tìm trường…" aria-label="Tìm trường" />
          <small>{v.schools.length ? <>Đã chọn <b>{v.schools.length}</b>/{allSch.length} trường</> : <><b>Mở cho tất cả</b> trường</>}</small><button type="button" className="btn sm ghost" onClick={() => set({ schools: v.schools.length === allSch.length ? [] : allSch })}>{v.schools.length === allSch.length ? 'Bỏ chọn' : 'Chọn tất cả'}</button></div>
          <div className="sclb">{allSch.filter(id => !sq || norm(k.orgName(id)).includes(norm(sq))).map(id => <label key={id} className={'scrow' + (v.schools.includes(id) ? ' on' : '')}><input type="checkbox" checked={v.schools.includes(id)} onChange={e => set({ schools: e.target.checked ? [...v.schools, id] : v.schools.filter(x => x !== id) })} />
            <span>{k.orgName(id)}</span><small>{db.teachers.filter(t => t.org_id === id).length} học viên</small></label>)}</div></div></div>
        <div className="fld"><span>Điều kiện tham gia</span><div className="condg">
          <label className="chk"><input type="checkbox" checked={v.subjOnly} onChange={e => set({ subjOnly: e.target.checked })} /> Chỉ học viên dạy đúng môn của đợt{pr && subjs.length > 0 && <> <small className="sub">({subjs.map(k.SUBJ).join(', ')})</small></>}</label>
          <label className="fld inline"><span>Đã hoàn thành</span><Sel label="Không yêu cầu" value={v.prereq} onChange={x => set({ prereq: x })} options={pubs.filter(x => x.id !== v.prog).map(x => [x.id, `${x.code} · ${x.name}`])} /></label>
          <input value={v.cond} onChange={e => set({ cond: e.target.value })} placeholder="Điều kiện khác (nếu có), VD: có ít nhất 2 năm giảng dạy" aria-label="Điều kiện khác" /></div></div></>)}
      {sec('calendar', 3, 'Thời gian & lịch tập huấn', 'Hệ thống tạo sẵn các buổi theo môn/mô-đun của đợt — chỉnh từng buổi, phân công giảng viên sau khi tạo', <>
        <div className="frow"><label className="fld"><span>Ngày buổi đầu</span><input type="date" value={v.start} onChange={e => e.target.value && set({ start: e.target.value })} /></label>
          <label className="fld"><span>Giờ học</span><span className="trange"><input type="time" value={v.from} onChange={e => set({ from: e.target.value })} /><em>–</em><input type="time" value={v.to} onChange={e => set({ to: e.target.value })} /></span></label></div>
        <div className="fld"><span>Nhịp tổ chức</span><div className="mpick">{([[7, 'Mỗi tuần 1 buổi'], [3, '2 buổi/tuần'], [1, 'Liên tục mỗi ngày'], [14, '2 tuần 1 buổi'], ['custom', 'Tùy chỉnh…']] as const).map(([kk, n]) =>
          <button type="button" key={kk} className={'chipbtn' + (String(v.step) === String(kk) ? ' on' : '')} onClick={() => set({ step: kk })}>{n}</button>)}</div>
          {v.step === 'custom' && <div className="cusrep"><span className="sub">Học vào các thứ</span><div className="wdpick">{([[1, 'T2'], [2, 'T3'], [3, 'T4'], [4, 'T5'], [5, 'T6'], [6, 'T7'], [0, 'CN']] as const).map(([d, n]) =>
            <label key={d} className={'wd' + (v.days.includes(d) ? ' on' : '')}><input type="checkbox" className="vh" checked={v.days.includes(d)} onChange={e => { const nx = e.target.checked ? [...v.days, d] : v.days.filter(x => x !== d); if (nx.length) set({ days: nx }) }} />{n}</label>)}</div>
            <span className="sub">lặp lại mỗi</span><label className="unit"><input type="number" min={1} max={8} value={v.every} aria-label="Số tuần lặp" onChange={e => set({ every: Math.max(1, +e.target.value || 1) })} /><em>tuần</em></label><small className="sub">{v.days.length} buổi/{v.every > 1 ? v.every + ' tuần' : 'tuần'}</small></div>}</div>
        <div className="fld"><span>Hình thức</span><div className="fpick two">{([['off', 'users', 'Trực tiếp', 'Tại hội trường/phòng học'], ['on', 'video', 'Trực tuyến', 'Tạo lớp học ảo cho từng buổi']] as const).map(([kk, i, n, d]) =>
          <button type="button" key={kk} className={'fopt' + (v.mode === kk ? ' on' : '')} onClick={() => set({ mode: kk })}><Ic n={i} /><b>{n}</b><small>{d}</small></button>)}</div></div>
        <div className="frow">{v.mode === 'off' && <label className="fld"><span>Địa điểm</span><input value={v.place} onChange={e => set({ place: e.target.value })} placeholder="Hội trường / phòng học" /></label>}
          <label className="fld"><span>Giảng viên mặc định</span><input list="p2-tr2" value={v.trainer} onChange={e => set({ trainer: e.target.value })} placeholder="Chọn từ danh mục hoặc nhập tên" /><datalist id="p2-tr2">{trainers.map(r => <option key={r.id} value={r.name}>{r.info.org}</option>)}</datalist></label>
          <label className="fld"><span>Trợ giảng <em className="sub">— cách nhau bằng dấu phẩy</em></span><input value={v.assist} onChange={e => set({ assist: e.target.value })} placeholder="VD: Nguyễn Văn Phúc, Lê Thu Trang" /></label></div>
        <div className="fld"><span>Lịch dự kiến <em className="sub">— {prevS.length} buổi{prevS.length ? `, ${vn(prevS[0].date)} → ${vn(prevS[prevS.length - 1].date)}` : ''}</em></span><TrainCal k={k} sessions={prevS} holOn={holOn} /></div></>)}
    </div>
    <aside className="tfside"><div className="tfstick"><div className="ksum"><b>Tóm tắt đợt tập huấn</b>
      <dl><div><dt>Chương trình</dt><dd>{pr?.code ?? '—'}</dd></div><div><dt>Môn trong đợt</dt><dd>{subjs.length}<small className="sub">/{subs.length}</small></dd></div><div><dt>Sĩ số tối đa</dt><dd>{v.cap}</dd></div><div><dt>Số buổi</dt><dd>{prevS.length}</dd></div></dl>
      <small className="sub">Hạn đăng ký {vn(v.regDue)}{v.schools.length ? ' · ' + v.schools.length + ' trường' : ' · mở cho tất cả'}{v.subjOnly || v.prereq || v.cond ? ' · có điều kiện tham gia' : ''}</small>
      {prevS.length > 0 && <><small className="sub">{vn(prevS[0].date)} → {vn(prevS[prevS.length - 1].date)} · {v.from}–{v.to}</small><ol className="kprev">{prevS.map((s, i) => <li key={i}><span>{wd(s.date)} {vnS(s.date)}</span>{k.mod(s.module_id)?.title ?? k.SUBJ(s.subject)}</li>)}</ol></>}</div>
      <div className={'tfcheck' + (miss.length ? ' warn' : '')}>{miss.length ? <><Ic n="alert" /><span>Còn thiếu: <b>{miss.join(', ')}</b></span></> : <><Ic n="check" /><span>Sẵn sàng tạo kế hoạch</span></>}</div>
      <div className="tfact"><button type="button" className="btn primary" disabled={busy || !!miss.length} onClick={save}><Ic n="check" /> Tạo kế hoạch (nháp)</button><button type="button" className="btn ghost" onClick={() => onDone()}>Huỷ</button></div></div></aside></div>
  </>
}
