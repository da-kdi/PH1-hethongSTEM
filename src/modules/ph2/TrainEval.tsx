import { Fragment, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../../lib/supabase'
import { Empty, Flow, Ic, Mau, PageHead, Panel, Seg, Sel, StatCard, cssVar } from '../ph1/mau/kit'
import { CoverDeco } from '../ph1/designs/blocks'
import { ATTK, COMP, FBG, IKIND, LV, LVC, LVP, PAGE, SUBMIT, SUPK, SURVEY, addD, fmt1, goto, resPill, shortTitle, takeIntent, uid, vn, vnS, type Item, type K, type Plan, type Q } from './api'
import { useP2, type P2 } from './use'

// 2.1d Đánh giá kết quả — dựng theo bản mẫu: chọn đợt → Điểm danh → Chấm bài (điểm số / rubric) → Kết quả (kết thúc đợt, chốt, giao bổ sung)
// → Chứng nhận (cấp trực tiếp, số hiệu tự sinh) → Phản hồi khoá (thiết lập phiếu, gửi, tổng hợp) · Hồ sơ & thống kê dùng chung mọi đợt.
type Tab = 'att' | 'grade' | 'result' | 'cert' | 'fb' | 'hist'
const avg = (v: number[]) => v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
const MARK: Record<string, string> = { p: '✓', l: 'M', e: 'P', a: '✕' }

export function TrainEval({ orgId, go }: { orgId: string | null; go?: (p: string) => void }) {
  const P = useP2(orgId)
  const [tab, setTab] = useState<Tab>('att')
  const [plan, setPlan] = useState<string | null>(null)
  const [item, setItem] = useState<string | null>(null)
  const [cert, setCert] = useState<string | null>(null)
  const [hist, setHist] = useState<string | null>(null)
  useEffect(() => { const x = takeIntent(PAGE.dg); if (x?.plan) { setPlan(x.plan); if (x.tab) setTab(x.tab); if (x.item) setItem(x.item) } }, [])
  const { k, db } = P
  const msg = P.msg ? <p className={P.msg.startsWith('✓') ? 'okmsg' : 'msg'} role="status" onClick={() => P.setMsg('')}>{P.msg}</p> : null
  if (!k || !db) return <Mau>{msg}<p className="sub">Đang tải…</p></Mau>
  const head = <><PageHead icon="award" title="Đánh giá kết quả" sub="Điểm danh, chấm bài theo khung đánh giá → kết quả → chứng nhận → phản hồi khoá → hồ sơ năng lực" />
    <Flow steps={[['att', 'Điểm danh', 'theo từng buổi'], ['grade', 'Chấm bài', 'theo khung đánh giá'], ['result', 'Kết quả', 'sổ điểm · kết thúc đợt'], ['cert', 'Chứng nhận', 'cấp cho học viên đạt'],
      ['fb', 'Phản hồi khoá', 'khảo sát học viên'], ['hist', 'Hồ sơ & thống kê', 'năng lực, báo cáo']]} value={tab} onChange={t => { setTab(t); setCert(null); setHist(null) }} /></>
  const histM = hist ? <HistModal k={k} tid={hist} onClose={() => setHist(null)} /> : null
  if (tab === 'hist') return <Mau>{msg}{head}<DgHist P={P} k={k} onHist={setHist} />{histM}</Mau>
  const p = k.plan(plan)
  if (!p) return <Mau>{msg}{head}<PlanList P={P} k={k} tab={tab} onOpen={id => { setPlan(id); scrollTo(0, 0) }} /></Mau>
  const pr = k.prog(p.program_id)!; const tr = k.traineesOf(p.id); const rows = tr.map(t => k.evalOf(p, t)); const ss = k.sessOfPlan(p.id)
  const sc = rows.map(r => r.score).filter((x): x is number => x != null); const at = rows.map(r => r.att).filter((x): x is number => x != null); const [sl, scl] = k.planSt(p)
  const body = tab === 'att' ? <DgAtt P={P} k={k} p={p} /> : tab === 'grade' ? <DgGrade P={P} k={k} p={p} item={item} setItem={setItem} />
    : tab === 'result' ? <DgResult P={P} k={k} p={p} onCert={setCert} onHist={setHist} toAssess={() => goto(go, PAGE.tp, { open: pr.id, tab: 'assess' })} />
    : tab === 'cert' ? <DgCert P={P} k={k} p={p} onCert={setCert} /> : <DgFeedback P={P} k={k} p={p} orgId={orgId} />
  return <Mau>{msg}{head}
    <button type="button" className="btn sm ghost" onClick={() => { setPlan(null); setCert(null) }}><Ic n="back" /> Tất cả đợt tập huấn</button>
    <div className="dhead"><span className="code" style={cssVar(k.groupOf(pr.group_code).color)}>{pr.code}</span><div><h1>{p.title}</h1><span className="crumb">{pr.name} · {p.unit} · {k.planRange(p)}</span></div><span className={`pill ${scl} plain`}>{sl}</span></div>
    <div className="stats"><StatCard c="c-blue" icon="users" label="Học viên" value={tr.length} sub={`${ss.filter(k.sessEnd).length}/${ss.length} buổi đã diễn ra`} />
      <StatCard c="c-green" icon="check" label="Chuyên cần TB" value={Math.round(avg(at) ?? 0) + '%'} sub="trên các buổi đã diễn ra" />
      <StatCard c="c-violet" icon="target" label="Điểm TB" value={fmt1(avg(sc))} sub="thang 10, theo trọng số đầu điểm" />
      <StatCard c="c-amber" icon="award" label="Hoàn thành" value={<>{rows.filter(r => r.result === 'Hoàn thành').length}<small>/{rows.length}</small></>} sub={tr.filter(t => k.certOf(p, t)).length + ' đã cấp chứng nhận'} /></div>
    {p.confirmed && (tab === 'att' || tab === 'grade') && <div className="note warnnote"><Ic n="lock" /> Đợt đã kết thúc, kết quả chốt {p.confirmed.date}. Muốn sửa, vào bước Kết quả bấm “Mở lại” hoặc giao bổ sung cho từng học viên.</div>}
    {body}
    {cert && k.certOf(p, cert) && <CertModal k={k} p={p} tid={cert} onClose={() => setCert(null)} setMsg={P.setMsg} />}{histM}
  </Mau>
}

const lockedT = (k: K, p: Plan, t: string) => !!p.confirmed && !k.trainee(p.id, t)?.supp

// ---------- Danh sách đợt theo chương trình ----------
function PlanList({ P, k, tab, onOpen }: { P: P2; k: K; tab: Tab; onOpen: (id: string) => void }) {
  const db = P.db!
  const [view, setView] = useState<'table' | 'grid'>('grid')
  const [prog, setProg] = useState('')
  const [shut, setShut] = useState<Set<string>>(new Set())
  const mt = (p: Plan) => { const tr = k.traineesOf(p.id); const rs = tr.map(t => k.evalOf(p, t)); const at = rs.map(r => r.att).filter((x): x is number => x != null); const sc = rs.map(r => r.score).filter((x): x is number => x != null)
    const its = k.planItems(p).filter(i => k.itemOpen(p, i)); const gd = its.reduce((a, i) => a + tr.filter(t => k.itemScore(p, i, t) != null).length, 0)
    return { n: rs.length, past: k.sessOfPlan(p.id).filter(k.sessEnd).length, att: at.length ? Math.round(avg(at)!) : null, sc: sc.length ? fmt1(avg(sc)) : null, gd, gt: its.length * tr.length,
      done: rs.filter(r => r.result === 'Hoàn thành').length, iss: tr.filter(t => k.certOf(p, t)).length, fr: k.fbOf(p.id).length, fa: k.fbAvg(p) } }
  const key = (p: Plan, m: ReturnType<typeof mt>) => tab === 'att' ? `Chuyên cần TB ${m.att == null ? '—' : m.att + '%'} · ${m.past}/${k.sessOfPlan(p.id).length} buổi` : tab === 'grade' ? (m.gt ? `Đã chấm ${m.gd}/${m.gt} lượt` : 'Chưa có đầu điểm mở')
    : tab === 'result' ? `Hoàn thành ${m.done}/${m.n}${p.confirmed ? ' · đã chốt' : ''}` : tab === 'cert' ? `Đã cấp ${m.iss}/${m.done} đạt` : p.survey?.sent ? `Phản hồi ${m.fr}/${m.n}${m.fa != null ? ' · ' + m.fa.toFixed(1) + '/5' : ''}` : 'Chưa gửi phiếu'
  const pub = (pid: string) => k.plansOf(pid).filter(p => p.status === 'published')
  const progs = db.progs.filter(pr => pub(pr.id).length && (!prog || pr.id === prog))
  const what: Record<string, string> = { att: 'bảng điểm danh', grade: 'phần chấm bài', result: 'sổ điểm', cert: 'chứng nhận', fb: 'phản hồi khoá' }
  return <>
    <div className="toolbar"><Sel label="Tất cả chương trình" value={prog} onChange={setProg} options={db.progs.filter(pr => k.plansOf(pr.id).length).map(pr => [pr.id, `${pr.code} · ${pr.name}`])} />
      <Seg label="Kiểu xem" items={[['table', 'Bảng'], ['grid', 'Thẻ']]} value={view} onChange={setView} /><small className="sub" style={{ marginLeft: 'auto' }}>Chọn một đợt để mở {what[tab]}</small></div>
    {progs.map(pr => { const g = k.groupOf(pr.group_code); const ps = pub(pr.id)
      return <details key={pr.id} className="kprog mprog" open={!shut.has(pr.id)} onToggle={e => { const o = (e.currentTarget as HTMLDetailsElement).open; setShut(x => { const n = new Set(x); if (o) n.delete(pr.id); else n.add(pr.id); return n }) }}>
        <summary className="phead" style={cssVar(g.color)}><span className="chev"><Ic n="chev" /></span><span className="code sm">{pr.code}</span><b>{pr.name}</b><small>{ps.length} đợt · {new Set(ps.flatMap(p => k.traineesOf(p.id))).size} học viên</small></summary>
        {view === 'grid' ? <div className="grid dgrid kgrid">{ps.map(p => { const m = mt(p); const [sl, sc] = k.planSt(p)
          return <article key={p.id} className="pcard dcard kcard" style={cssVar(g.color)} tabIndex={0} onClick={() => onOpen(p.id)} onKeyDown={e => e.key === 'Enter' && onOpen(p.id)}>
            <div className="cover"><CoverDeco s={k.planSubjs(p)[0]} /><span>{pr.code} · {m.n} học viên</span><b>{shortTitle(p.title)}</b></div>
            <h3>{p.title}</h3><small className="sub">{p.unit} · {k.planRange(p)}</small>
            <div className="chips"><span className="chip">{m.past}/{k.sessOfPlan(p.id).length} buổi</span><span className="chip">CC {m.att == null ? '—' : m.att + '%'}</span><span className="chip">Điểm {m.sc ?? '—'}</span><span className="chip">HT {m.done}/{m.n}</span></div>
            <div className="foot"><span><b>{key(p, m)}</b></span><span className={`pill ${sc} plain`}>{sl}</span></div></article> })}</div>
          : <div className="tblwrap"><table><thead><tr><th>Đợt tập huấn</th><th>Thời gian</th><th className="c">Học viên</th><th className="c">Buổi đã học</th><th className="c">Chuyên cần TB</th><th className="c">Đã chấm</th><th className="c">Điểm TB</th><th className="c">Hoàn thành</th><th className="c">Chứng nhận</th><th>Trạng thái</th></tr></thead><tbody>
            {ps.map(p => { const m = mt(p); const [sl, sc] = k.planSt(p); return <tr key={p.id} className="rowlink" tabIndex={0} onClick={() => onOpen(p.id)}><td><b>{p.title}</b><br /><small className="sub">{p.unit}</small></td><td>{k.planRange(p)}</td><td className="c">{m.n}</td>
              <td className="c">{m.past}/{k.sessOfPlan(p.id).length}</td><td className="c">{m.att == null ? '—' : m.att + '%'}</td><td className="c">{m.gd}/{m.gt}</td><td className="c">{m.sc ?? '—'}</td><td className="c">{m.done}/{m.n}</td><td className="c">{m.iss}</td><td><span className={`pill ${sc} plain`}>{sl}</span></td></tr> })}</tbody></table></div>}</details> })}
    {!progs.length && <Empty>Chưa có đợt tập huấn nào đã phát hành.</Empty>}
  </>
}

// ---------- Điểm danh ----------
function DgAtt({ P, k, p }: { P: P2; k: K; p: Plan }) {
  const ss = k.sessOfPlan(p.id); const past = ss.filter(k.sessEnd); const tr = k.traineesOf(p.id); const C = k.prog(p.program_id)!.criteria
  const lock = () => P.setMsg('Kết quả đã chốt — giao bổ sung hoặc mở lại để sửa')
  const cyc: Record<string, string> = { '': 'p', p: 'l', l: 'e', e: 'a', a: 'p' }
  const set = (sid: string, t: string) => { if (lockedT(k, p, t)) return lock(); P.run(supabase.from('ph2_attendance').upsert({ session_id: sid, teacher_id: t, mark: cyc[k.mark(ss.find(s => s.id === sid)!, t) ?? ''] })) }
  const all = (sid: string) => { if (p.confirmed) return lock(); P.run(supabase.from('ph2_attendance').upsert(tr.map(t => ({ session_id: sid, teacher_id: t, mark: 'p' }))), '✓ Đã điểm danh có mặt tất cả') }
  return <>
    <div className="toolbar"><div className="legend">{Object.entries(ATTK).map(([x, [n]]) => <span key={x}><i className={'am ' + x}>{MARK[x]}</i>{n}</span>)}</div><small className="sub" style={{ marginLeft: 'auto' }}>Bấm ô để đổi trạng thái · buổi trực tuyến lấy điểm danh tự động từ lớp học ảo</small></div>
    {past.length ? <div className="panel" style={{ padding: 0 }}><div className="tblwrap"><table className="atttbl"><thead><tr><th>Học viên</th>{past.map(s => <th key={s.id} className="c"><span>{vnS(s.date)}</span><small>{s.mode === 'on' && <Ic n="video" />}</small>
      {P.canManage && <button type="button" className="btn sm ghost" title="Có mặt tất cả" onClick={() => all(s.id)}>✓ tất cả</button>}</th>)}<th className="c">Số buổi có mặt</th><th className="c">Chuyên cần</th></tr></thead><tbody>
      {tr.map(t => { const T = k.teacher(t); const e = k.evalOf(p, t)
        return <tr key={t}><td><b>{T.full_name}</b><br /><small className="sub">{T.school}</small></td>{past.map(s => { const v = k.mark(s, t)
          return <td key={s.id} className="c"><button type="button" className={'am ' + (v ?? 'x')} disabled={!P.canManage} aria-label={v ? ATTK[v][0] : 'Chưa điểm danh'} onClick={() => set(s.id, t)}>{v ? MARK[v] : '·'}</button></td> })}
          <td className="c"><b title="Số buổi có mặt / tổng số buổi của đợt">{past.filter(s => ['p', 'l'].includes(k.mark(s, t) ?? '')).length}/{ss.length}</b></td>
          <td className="c"><b className={e.att != null && e.att < C.att ? 'badtxt' : ''}>{e.att ?? '—'}%</b></td></tr> })}</tbody>
      <tfoot><tr><td>Có mặt</td>{past.map(s => <td key={s.id} className="c">{tr.filter(t => ['p', 'l'].includes(k.mark(s, t) ?? '')).length}/{tr.length}</td>)}<td className="c">{past.length}/{ss.length} buổi đã diễn ra</td><td /></tr></tfoot></table></div></div>
      : <Empty>Chưa có buổi nào diễn ra.</Empty>}
    {ss.some(s => !k.sessEnd(s)) && <p className="note">{ss.filter(s => !k.sessEnd(s)).length} buổi sắp tới sẽ hiện thêm cột khi đến ngày.</p>}
  </>
}

// ---------- Chấm bài ----------
function DgGrade({ P, k, p, item, setItem }: { P: P2; k: K; p: Plan; item: string | null; setItem: (id: string) => void }) {
  const [gopen, setGopen] = useState<string | null>(null)
  const its = k.planItems(p)
  if (!its.length) return <Empty>Chương trình chưa có khung đánh giá — thiết lập ở Chương trình tập huấn › Khung đánh giá.</Empty>
  const i = its.find(x => x.id === item) ?? its[0]; const open = k.itemOpen(p, i); const sub = SUBMIT(i.kind); const tr = k.traineesOf(p.id); const n = tr.length; const C = k.prog(p.program_id)!.criteria
  const gd = tr.filter(t => k.itemScore(p, i, t) != null).length; const sb = tr.filter(t => k.grOf(p, i, t)?.sub).length
  const vals = tr.map(t => k.itemScore(p, i, t)).filter((x): x is number => x != null)
  const lock = () => P.setMsg('Kết quả đã chốt — giao bổ sung hoặc mở lại để sửa')
  const save = (t: string, x: Record<string, unknown>, ok?: string) => P.run(supabase.from('ph2_grades').upsert({ plan_id: p.id, item_id: i.id, teacher_id: t, ...x, updated_at: new Date().toISOString() }, { onConflict: 'plan_id,item_id,teacher_id' }), ok)
  const lvChips = (t: string) => i.rubric.map(c => { const x = k.grOf(p, i, t)?.lv?.[c.id]; return <span key={c.id} className={'lvdot' + (x == null ? '' : ' l' + x)} title={`${c.name}: ${x == null ? 'chưa chấm' : LV[x]}`}>{x == null ? '·' : LV[x][0]}</span> })
  const row = (t: string) => { const T = k.teacher(t); const g = k.grOf(p, i, t); const sv = g?.sub; const v = k.itemScore(p, i, t); const fl = k.reqFails(p, i, t); const can = !sub || sv; const op = gopen === t
    return <Fragment key={t}><tr className={op ? 'cur' : ''}><td><b>{T.full_name}</b><br /><small className="sub">{T.school}</small></td>
      {sub && <td>{sv ? <><a href="#" onClick={e => e.preventDefault()}><Ic n="file" /> {sv.file}</a><br /><small className="sub">{sv.at}{sv.late && <> · <b className="badtxt">muộn</b></>}</small></>
        : <><span className="sub">Chưa nộp</span> {P.canManage && <button type="button" className="btn sm ghost" onClick={() => save(t, { sub: { at: vnS(k.T), file: `bai-nop-${slugName(T.full_name)}.pdf`, late: k.T > k.itemDue(p, i) } }, '✓ Đã ghi nhận bài nộp')}>Ghi nhận nộp</button>}</>}</td>}
      {i.mode === 'score' ? <td className="c"><input className="scin" type="number" min={0} max={i.max} step=".25" defaultValue={g?.score ?? ''} key={'s' + t + (g?.score ?? '')} aria-label={'Điểm ' + T.full_name} disabled={!P.canManage}
          onBlur={e => { const raw = e.target.value; if (String(g?.score ?? '') === raw) return; if (lockedT(k, p, t)) { e.target.value = String(g?.score ?? ''); return lock() } save(t, { score: raw === '' ? null : Math.max(0, Math.min(i.max, +raw)) }) }} /> <small className="sub">/{i.max}</small></td>
        : <td><span className="lvrow">{lvChips(t)}</span>{fl.length > 0 && <><br /><small className="badtxt">Chưa đạt tiêu chí bắt buộc</small></>}</td>}
      <td className="c"><b className={v != null && v < C.score ? 'badtxt' : ''}>{fmt1(v)}</b></td>
      <td>{i.mode === 'score' ? <input className="noteinp" defaultValue={g?.note ?? ''} key={'n' + t + (g?.note ?? '')} placeholder="Nhận xét…" aria-label="Nhận xét" disabled={!P.canManage} onBlur={e => e.target.value !== (g?.note ?? '') && save(t, { note: e.target.value })} /> : <small className="sub">{g?.note || ''}</small>}</td>
      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{i.mode === 'rubric' && (can ? <button type="button" className={'btn sm' + (v == null && !op ? ' primary' : '')} onClick={() => setGopen(op ? null : t)}>{op ? 'Thu gọn' : v == null ? 'Chấm' : 'Sửa'}</button> : <span className="sub">chờ nộp</span>)}</td></tr>
      {op && i.mode === 'rubric' && <tr className="gpanel"><td colSpan={sub ? 6 : 5}><GradePanel P={P} k={k} p={p} i={i} t={t} save={save} lock={lock}
        onNext={() => { const idx = tr.indexOf(t); const nx = tr.slice(idx + 1).find(x => !sub || k.grOf(p, i, x)?.sub); setGopen(nx ?? null); P.setMsg('✓ Đã lưu') }} last={tr.indexOf(t) >= tr.length - 1} onDone={() => setGopen(null)} /></td></tr>}</Fragment> }
  return <>
    <div className="itchips">{its.map(x => { const o = k.itemOpen(p, x); const g = tr.filter(t => k.itemScore(p, x, t) != null).length
      return <button type="button" key={x.id} className={'itchip' + (x.id === i.id ? ' on' : '')} onClick={() => { setItem(x.id); setGopen(null) }}><span className="ikic"><Ic n={IKIND[x.kind]?.[1] ?? 'file'} /></span>
        <span><b>{x.name}</b><small>{IKIND[x.kind]?.[0]} · {x.w}% · {o ? `chấm ${g}/${n}` : 'chưa mở'}</small></span>{o && <i className="ring" style={{ ['--v' as string]: n ? g / n * 100 : 0 }} />}</button> })}</div>
    <section className="panel"><header><h2><span className="hi"><Ic n={IKIND[i.kind]?.[1] ?? 'file'} /></span>{i.name} <small className="sub">{IKIND[i.kind]?.[0]} · {i.mode === 'rubric' ? `rubric ${i.rubric.length} tiêu chí` : 'thang ' + i.max} · {i.w}% điểm tổng · {i.mod ? k.mod(i.mod)?.title ?? '' : 'cả chương trình'}</small></h2>
      <span className="act">{open && <small className="sub">Hạn {vn(k.itemDue(p, i))}</small>}{open && sub && sb < n && <button type="button" className="btn sm" onClick={() => P.setMsg('✓ Đã gửi nhắc nộp bài cho học viên chưa nộp')}><Ic n="send" /> Nhắc {n - sb} người chưa nộp</button>}</span></header>
      {i.task && <p className="prtask">{i.task}</p>}
      {!open ? <Empty>Đầu điểm mở sau buổi {vn(k.itemFrom(p, i))} — khi đó học viên {sub ? 'nộp bài và ' : ''}giảng viên chấm tại đây.</Empty> : <>
        <div className="gstat"><span><b>{gd}/{n}</b> đã chấm</span>{sub && <span><b>{sb}/{n}</b> đã nộp</span>}<span>Trung bình <b>{fmt1(avg(vals))}</b>/10</span><span>Dưới ngưỡng <b>{vals.filter(v => v < C.score).length}</b></span></div>
        <div className="tblwrap"><table className="grtbl"><thead><tr><th>Học viên</th>{sub && <th>Bài nộp</th>}<th className={i.mode === 'score' ? 'c' : ''}>{i.mode === 'score' ? 'Điểm' : 'Mức theo tiêu chí'}</th><th className="c">Quy đổi /10</th><th>Nhận xét</th><th /></tr></thead>
          <tbody>{tr.map(row)}</tbody></table></div></>}</section>
  </>
}
const slugName = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
function GradePanel({ P, k, p, i, t, save, lock, onNext, last, onDone }: { P: P2; k: K; p: Plan; i: Item; t: string; save: (t: string, x: Record<string, unknown>) => Promise<boolean>; lock: () => void; onNext: () => void; last: boolean; onDone: () => void }) {
  const g = k.grOf(p, i, t); const lv = g?.lv ?? {}
  return <div className="gpbody"><div className="rbgrid">{i.rubric.map(c => <div key={c.id} className="rbr"><div className="rbn"><b>{c.name}</b><small>{c.pts} điểm{c.req && <> · <b className="badtxt">bắt buộc</b></>} · {COMP[c.comp] ?? ''}</small></div>
    {LV.map((l, x) => <button type="button" key={x} className={`lvbtn l${x}${lv[c.id] === x ? ' on' : ''}`} disabled={!P.canManage} onClick={() => { if (lockedT(k, p, t)) return lock(); save(t, { lv: { ...lv, [c.id]: x } }) }}>
      <b>{l} <small>{+(c.pts * LVP[x]).toFixed(2)}đ</small></b><span>{c.desc?.[x] || ''}</span></button>)}</div>)}</div>
    <div className="gpfoot"><label className="fld" style={{ flex: 1 }}><span>Nhận xét cho học viên</span><textarea rows={2} defaultValue={g?.note ?? ''} key={t + (g?.note ?? '')} placeholder="Điểm mạnh, điều cần cải thiện…" disabled={!P.canManage} onBlur={e => e.target.value !== (g?.note ?? '') && save(t, { note: e.target.value })} /></label>
      <div className="gptot"><small className="sub">Điểm đầu điểm</small><b>{fmt1(k.itemScore(p, i, t))}</b><small className="sub">/10</small></div>
      <div className="gpbtn">{!last && <button type="button" className="btn primary sm" onClick={onNext}>Lưu & người tiếp theo ›</button>}<button type="button" className="btn sm" onClick={onDone}>Xong</button></div></div></div>
}

// ---------- Kết quả: sổ điểm → kết thúc đợt → cấp chứng nhận / giao bổ sung ----------
function DgResult({ P, k, p, onCert, onHist, toAssess }: { P: P2; k: K; p: Plan; onCert: (t: string) => void; onHist: (t: string) => void; toAssess: () => void }) {
  const pr = k.prog(p.program_id)!; const K2 = pr.criteria; const its = k.planItems(p); const cf = p.confirmed; const ss = k.sessOfPlan(p.id)
  const [sk, setSk] = useState<Record<string, string>>({})
  const rows = k.traineesOf(p.id).map(t => ({ t: k.teacher(t), e: k.evalOf(p, t) })); const ok = rows.filter(r => r.e.result === 'Hoàn thành'); const notOk = rows.filter(r => r.e.result !== 'Hoàn thành')
  const ended = ss.length > 0 && !ss.some(s => !k.sessEnd(s)); const miss = rows.filter(r => r.e.graded < r.e.total).length; const toIssue = ok.filter(r => !k.certOf(p, r.t.id))
  const suggest = (e: ReturnType<K['evalOf']>) => e.att != null && e.att < K2.att ? 'makeup' : e.graded < e.total || e.fails.length ? 'resubmit' : 'retest'
  const issue = async (ids: string[]) => { const { data, error } = await supabase.rpc('ph2_issue_certs', { p_plan: p.id, p_teachers: ids }); if (error) return P.setMsg(error.message); await P.reload(); P.setMsg(`✓ Đã cấp ${data} chứng nhận và lưu vào hồ sơ học viên`); if (ids.length === 1) onCert(ids[0]) }
  const by = P.db!.orgs.find(o => o.id === p.org_id)?.name ?? 'KDI Education'
  return <>
    <div className="note critnote"><Ic n="award" /> Điều kiện hoàn thành <b>{pr.code}</b>: chuyên cần ≥ {K2.att}% · điểm tổng ≥ {K2.score}/10{K2.req && ' · không tiêu chí bắt buộc nào ở mức Chưa đạt'}.<button type="button" className="btn sm ghost" onClick={toAssess}>Khung đánh giá ›</button></div>
    <div className="steps8"><div className={'s8 ' + (ended && !miss ? 'done' : 'cur')}><span>1</span><div><b>Tổng hợp sổ điểm</b><small>{ended ? (miss ? `${miss} học viên còn thiếu điểm — chấm ở bước Chấm bài` : 'Đủ điểm danh và điểm các đầu điểm') : 'Đợt đang diễn ra'}</small></div></div>
      <div className={'s8 ' + (cf ? 'done' : ended ? 'cur' : '')}><span>2</span><div><b>Kết thúc đợt & chốt kết quả</b><small>{cf ? `Đã chốt ${cf.date} · ${cf.by}` : ended ? 'Khoá sổ điểm, chuyển trạng thái “Đã kết thúc”' : 'Chờ học xong các buổi'}</small></div>
        {P.canManage && (cf ? <button type="button" className="btn sm ghost" onClick={() => P.run(supabase.from('ph2_plans').update({ confirmed: null }).eq('id', p.id), '✓ Đã mở lại — chỉnh dữ liệu rồi kết thúc đợt lại')}>Mở lại</button>
          : <button type="button" className="btn sm primary" disabled={!ended} onClick={() => P.run(supabase.from('ph2_plans').update({ confirmed: { date: vn(k.T), by } }).eq('id', p.id), '✓ Đã kết thúc đợt và chốt kết quả')}><Ic n="check" /> Kết thúc đợt</button>)}</div>
      <div className={'s8 ' + (cf && !toIssue.length ? 'done' : cf ? 'cur' : '')}><span>3</span><div><b>Cấp chứng nhận / giao bổ sung</b><small>{ok.length} đạt · {notOk.length} chưa đạt</small></div>
        {cf && P.canManage && <button type="button" className="btn sm primary" disabled={!toIssue.length} onClick={() => issue(toIssue.map(r => r.t.id))}><Ic n="award" /> Cấp {toIssue.length} chứng nhận</button>}</div></div>
    <div className="panel" style={{ padding: 0 }}><div className="tblwrap"><table className="sotbl"><thead><tr><th>Học viên</th><th className="c">Chuyên cần</th>{its.map(i => <th key={i.id} className="c" title={i.name}>{i.name.length > 22 ? i.name.slice(0, 20) + '…' : i.name}<small>{i.w}%</small></th>)}
      <th className="c">Điểm tổng</th><th className="c">Kết quả</th><th>Hướng xử lý</th><th /></tr></thead><tbody>
      {rows.map(({ t, e }) => { const c = k.certOf(p, t.id); const sp = k.trainee(p.id, t.id)?.supp
        const action: ReactNode = e.result === 'Hoàn thành' ? (c ? <><span className="pill good plain">Đã cấp</span> <button type="button" className="btn sm ghost" onClick={() => onCert(t.id)}>{c.no}</button></>
            : cf ? (P.canManage ? <button type="button" className="btn sm" onClick={() => issue([t.id])}><Ic n="award" /> Cấp chứng nhận</button> : <span className="sub">Chờ cấp</span>) : <span className="sub">Chờ kết thúc đợt</span>)
          : sp ? <><span className="pill warn plain">Đang bổ sung</span> <small className="sub">{SUPK[sp.kind]} · hạn {sp.due}</small> {P.canManage && <button type="button" className="btn sm" onClick={async () => {
              if (await P.run(supabase.from('ph2_trainees').update({ supp: null }).eq('plan_id', p.id).eq('teacher_id', t.id))) P.setMsg(k.evalOf(p, t.id).result === 'Hoàn thành' ? '✓ Đánh giá lại: đủ điều kiện — có thể cấp chứng nhận' : 'Đánh giá lại: vẫn chưa đủ điều kiện') }}><Ic n="refresh" /> Đánh giá lại</button>}</>
          : cf && P.canManage ? <span className="supp"><select value={sk[t.id] ?? suggest(e)} aria-label="Hoạt động bổ sung" onChange={x => setSk({ ...sk, [t.id]: x.target.value })}>{Object.entries(SUPK).map(([kk, n]) => <option key={kk} value={kk}>{n}</option>)}</select>
              <button type="button" className="btn sm" onClick={() => P.run(supabase.from('ph2_trainees').update({ supp: { kind: sk[t.id] ?? suggest(e), due: vn(addD(k.T, 14)) } }).eq('plan_id', p.id).eq('teacher_id', t.id), '✓ Đã giao hoạt động bổ sung và thông báo cho học viên')}>Giao bổ sung</button></span>
          : e.result === 'Thiếu điểm' ? <span className="sub">Chấm nốt ở bước Chấm bài</span> : <span className="sub">Chờ kết thúc đợt</span>
        return <tr key={t.id}><td><b>{t.full_name}</b><br /><small className="sub">{t.code} · {t.school}</small></td><td className={'c' + (e.att != null && e.att < K2.att ? ' badtxt' : '')}>{e.att ?? '—'}%</td>
          {e.items.map(({ i, v }) => { const fl = k.reqFails(p, i, t.id).length; return <td key={i.id} className={'c' + (fl || (v != null && v < K2.score) ? ' badtxt' : '')} title={fl ? 'Chưa đạt tiêu chí bắt buộc' : ''}>{v == null ? <span className="sub">—</span> : fmt1(v)}{fl ? ' *' : ''}</td> })}
          <td className="c"><b className={e.score != null && e.score < K2.score ? 'badtxt' : ''}>{fmt1(e.score)}</b></td><td className="c"><span className={`pill ${resPill(e.result)} plain`}>{e.result}</span></td><td>{action}</td>
          <td style={{ textAlign: 'right' }}><button type="button" className="btn sm ghost" aria-label="Hồ sơ" onClick={() => onHist(t.id)}><Ic n="history" /></button></td></tr> })}</tbody>
      <tfoot><tr><td>Trung bình lớp</td><td className="c">{(v => v.length ? Math.round(avg(v)!) + '%' : '—')(rows.map(r => r.e.att).filter((x): x is number => x != null))}</td>
        {its.map(i => <td key={i.id} className="c">{fmt1(avg(rows.map(r => k.itemScore(p, i, r.t.id)).filter((x): x is number => x != null)))}</td>)}
        <td className="c">{fmt1(avg(rows.map(r => r.e.score).filter((x): x is number => x != null)))}</td><td className="c">{ok.length}/{rows.length}</td><td colSpan={2} /></tr></tfoot></table></div></div>
    <p className="note">* chưa đạt tiêu chí bắt buộc. Chưa đạt → giao bổ sung (học bù, làm lại bài, nộp lại sản phẩm); cập nhật điểm danh / chấm lại xong thì bấm “Đánh giá lại”.</p>
  </>
}

// ---------- Chứng nhận ----------
function DgCert({ P, k, p, onCert }: { P: P2; k: K; p: Plan; onCert: (t: string) => void }) {
  const cf = p.confirmed; const rows = k.traineesOf(p.id).map(t => ({ t: k.teacher(t), e: k.evalOf(p, t), c: k.certOf(p, t) }))
  const ok = rows.filter(r => r.e.result === 'Hoàn thành'); const iss = ok.filter(r => r.c); const wait = ok.filter(r => !r.c)
  const issue = async (ids: string[]) => { const { data, error } = await supabase.rpc('ph2_issue_certs', { p_plan: p.id, p_teachers: ids }); if (error) return P.setMsg(error.message); await P.reload(); P.setMsg(`✓ Đã cấp ${data} chứng nhận`); if (ids.length === 1) onCert(ids[0]) }
  return <>
    <div className="cflow"><div className="cf ok"><span>{ok.length}</span><b>Đủ điều kiện</b><small>Theo khung đánh giá</small></div><i>›</i><div className="cf issued"><span>{iss.length}</span><b>Đã cấp</b><small>Có số hiệu, lưu hồ sơ</small></div><i>·</i>
      <div className="cf no"><span>{rows.length - ok.length}</span><b>Chưa đủ điều kiện</b><small>Giao bổ sung ở bước Kết quả</small></div></div>
    {!cf && <p className="note"><Ic n="lock" /> Kết thúc đợt & chốt kết quả ở bước <b>Kết quả</b> trước khi cấp chứng nhận.</p>}
    <div className="toolbar"><span className="sub">Học viên đủ điều kiện được cấp chứng nhận trực tiếp — không qua bước duyệt.</span>{P.canManage && <span style={{ marginLeft: 'auto' }}><button type="button" className="btn sm primary" disabled={!cf || !wait.length} onClick={() => issue(wait.map(r => r.t.id))}><Ic n="award" /> Cấp tất cả ({wait.length})</button></span>}</div>
    {ok.length ? <div className="panel" style={{ padding: 0 }}><div className="tblwrap"><table><thead><tr><th>Học viên</th><th className="c">Điểm tổng</th><th>Số chứng nhận</th><th>Ngày cấp</th><th /></tr></thead><tbody>
      {ok.map(({ t, e, c }) => <tr key={t.id}><td><b>{t.full_name}</b><br /><small className="sub">{t.school}</small></td><td className="c">{fmt1(e.score)}</td><td>{c ? <code>{c.no}</code> : '—'}</td><td>{c ? vn(c.issued_on) : <span className="pill warn plain">Chưa cấp</span>}</td>
        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{c ? <button type="button" className="btn sm" onClick={() => onCert(t.id)}><Ic n="eye" /> Xem</button> : P.canManage && <button type="button" className="btn sm primary" disabled={!cf} onClick={() => issue([t.id])}><Ic n="award" /> Cấp</button>}</td></tr>)}</tbody></table></div></div>
      : <Empty>Chưa có học viên đủ điều kiện.</Empty>}
  </>
}
function useEsc(onClose: () => void) { useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }; addEventListener('keydown', h); return () => removeEventListener('keydown', h) }, []) }
function CertModal({ k, p, tid, onClose, setMsg }: { k: K; p: Plan; tid: string; onClose: () => void; setMsg: (m: string) => void }) {
  useEsc(onClose)
  const t = k.teacher(tid); const c = k.certOf(p, tid)!; const pr = k.prog(p.program_id)!
  return <><div className="amask" onClick={onClose} /><div className="amodal certm" role="dialog" aria-modal="true" aria-label="Chứng nhận" style={{ ['--kc' as string]: '#b7791f' }}><div className="abodyw">
    <div className="cert"><div className="cert-in"><small>{(p.unit ?? '').toUpperCase()}</small><h2>CHỨNG NHẬN</h2><p>Chứng nhận nhà giáo</p><h3>{t.full_name}</h3><p>{t.school}{t.subj && <> · giáo viên {k.SUBJ(t.subj)}</>}</p>
      <p>Đã hoàn thành chương trình tập huấn<br /><b>“{pr.name}”</b><br />({k.progH(pr)} giờ, {k.sessOfPlan(p.id).length} buổi · {k.planRange(p)})</p>
      <div className="cert-f"><span>Số: <b>{c.no}</b></span><span>Ngày cấp: {vn(c.issued_on)}</span></div><span className="seal"><Ic n="award" /></span></div></div></div>
    <div className="afoot"><button type="button" className="btn big" onClick={onClose}>Đóng</button><button type="button" className="btn primary big" onClick={() => { setMsg(''); print() }}><Ic n="file" /> In / tải PDF</button></div></div></>
}

// ---------- Phản hồi khoá ----------
function DgFeedback({ P, k, p, orgId }: { P: P2; k: K; p: Plan; orgId: string | null }) {
  const [view, setView] = useState(false)
  const [nq, setNq] = useState({ q: '', g: FBG[0], type: 'scale' as 'scale' | 'text' })
  const S = p.survey ?? {}; const qs = k.fbQs(p); const n = k.traineesOf(p.id).length; const rs = k.fbOf(p.id)
  const saveS = (x: Partial<NonNullable<Plan['survey']>>, ok?: string) => P.run(supabase.from('ph2_plans').update({ survey: { ...S, form: S.form?.length ? S.form : qs, ...x } }).eq('id', p.id), ok)
  const setQs = (f: Q[]) => saveS({ form: f })
  const due = S.due ?? addD(k.T, 7)
  if (!S.sent) return <>
    <Panel icon="edit" title={<>Thiết lập phiếu khảo sát <small className="sub">{qs.length} câu · chưa gửi</small></>} act={P.canManage && <><button type="button" className="btn sm ghost" onClick={() => saveS({ form: P.db!.survey ?? SURVEY }, '✓ Đã lấy lại mẫu chung')}><Ic n="refresh" /> Lấy lại mẫu chung</button>
      <button type="button" className="btn sm" disabled={!orgId} onClick={() => P.run(supabase.from('ph2_settings').upsert({ org_id: orgId, survey: qs }), '✓ Đã lưu làm mẫu phiếu chung cho các đợt sau')}><Ic n="copy" /> Lưu làm mẫu chung</button></>}>
      <div className="form3"><label className="fld"><span>Hạn trả lời</span><input type="date" value={due} disabled={!P.canManage} onChange={e => saveS({ due: e.target.value })} /></label>
        <div className="fld"><span>Hình thức</span><label className="chk"><input type="checkbox" checked={S.anon !== false} disabled={!P.canManage} onChange={e => saveS({ anon: e.target.checked })} /> Ẩn danh học viên</label>
          <label className="chk"><input type="checkbox" checked={!!S.req} disabled={!P.canManage} onChange={e => saveS({ req: e.target.checked })} /> Bắt buộc trả lời trước khi nhận chứng nhận</label></div></div>
      <div className="tblwrap"><table className="fbtbl"><thead><tr><th>STT</th><th>Câu hỏi</th><th>Nhóm</th><th>Kiểu trả lời</th><th /></tr></thead><tbody>
        {qs.map((q, j) => { const up = (x: Partial<Q>) => setQs(qs.map(y => y.id === q.id ? { ...y, ...x } : y))
          return <tr key={q.id}><td className="n">{j + 1}</td><td><input defaultValue={q.q} key={q.id + q.q} aria-label="Câu hỏi" disabled={!P.canManage} onBlur={e => e.target.value.trim() && e.target.value !== q.q && up({ q: e.target.value.trim() })} /></td>
            <td><select value={q.g} aria-label="Nhóm" disabled={!P.canManage} onChange={e => up({ g: e.target.value })}>{FBG.map(g => <option key={g}>{g}</option>)}</select></td>
            <td><select value={q.type === 'text' ? 'text' : 'scale'} aria-label="Kiểu trả lời" disabled={!P.canManage} onChange={e => up({ type: e.target.value as 'scale' | 'text' })}><option value="scale">Thang 1–5</option><option value="text">Trả lời tự do</option></select></td>
            <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{P.canManage && <><button type="button" className="btn sm ghost" aria-label="Lên" disabled={!j} onClick={() => { const a = [...qs]; [a[j - 1], a[j]] = [a[j], a[j - 1]]; setQs(a) }}>↑</button>
              <button type="button" className="btn sm ghost" aria-label="Xuống" disabled={j >= qs.length - 1} onClick={() => { const a = [...qs]; [a[j + 1], a[j]] = [a[j], a[j + 1]]; setQs(a) }}>↓</button>
              <button type="button" className="btn sm ghost" aria-label="Xoá câu" onClick={() => setQs(qs.filter(y => y.id !== q.id))}><Ic n="trash" /></button></>}</td></tr> })}
        {!qs.length && <tr><td colSpan={5} className="sub">Chưa có câu hỏi.</td></tr>}</tbody></table></div>
      {P.canManage && <div className="catadd"><Ic n="plus" /><input className="cin" value={nq.q} placeholder="Câu hỏi mới, VD: Thời lượng mỗi buổi hợp lý" onChange={e => setNq({ ...nq, q: e.target.value })} />
        <select className="cin" style={{ flex: 'none', width: 'auto' }} value={nq.g} onChange={e => setNq({ ...nq, g: e.target.value })}>{FBG.map(g => <option key={g}>{g}</option>)}</select>
        <select className="cin" style={{ flex: 'none', width: 'auto' }} value={nq.type} onChange={e => setNq({ ...nq, type: e.target.value as 'scale' | 'text' })}><option value="scale">Thang 1–5</option><option value="text">Trả lời tự do</option></select>
        <button type="button" className="btn sm primary" onClick={() => { if (!nq.q.trim()) return P.setMsg('Nhập câu hỏi'); setQs([...qs, { id: uid('q'), g: nq.g, q: nq.q.trim(), type: nq.type }]); setNq({ ...nq, q: '' }) }}>Thêm câu</button></div>}</Panel>
    <Panel icon="eye" title="Xem trước phiếu học viên nhận" act={P.canManage && <button type="button" className="btn sm primary" disabled={!n || !qs.length} onClick={() => saveS({ sent: vn(k.T), due }, `✓ Đã gửi phiếu khảo sát ${qs.length} câu cho ${n} học viên`)}><Ic n="send" /> Gửi phiếu cho {n} học viên</button>}>
      <small className="sub">Gửi qua cổng học viên + email{S.anon !== false ? ' · ẩn danh' : ''} · hạn {vn(due)}. Nên gửi sau buổi cuối của đợt.</small><FbForm qs={qs} /></Panel></>
  const sq = qs.filter(q => q.type !== 'text'); const tq = qs.filter(q => q.type === 'text'); const groups = Array.from(new Set(sq.map(q => q.g)))
  const a = k.fbAvg(p); const ga = groups.map(g => [g, k.fbAvg(p, q => q.g === g)] as [string, number | null]).filter((x): x is [string, number] => x[1] != null)
  const texts = rs.flatMap(r => [r.answers.txt, ...tq.map(q => r.answers[q.id])]).filter((x): x is string => typeof x === 'string' && !!x.trim())
  return <>
    <div className="stats"><StatCard c="c-blue" icon="users" label="Đã phản hồi" value={<>{rs.length}<small>/{n}</small></>} sub={'gửi phiếu ' + S.sent + (S.due ? ' · hạn ' + vn(S.due) : '')} />
      <StatCard c="c-green" icon="target" label="Hài lòng chung" value={a == null ? '—' : <>{a.toFixed(1)}<small>/5</small></>} sub="trung bình các câu thang 1–5" />
      <StatCard c="c-violet" icon="award" label="Cao nhất" value={[...ga].sort((x, y) => y[1] - x[1])[0]?.[0] ?? '—'} /><StatCard c="c-amber" icon="alert" label="Cần cải thiện" value={[...ga].sort((x, y) => x[1] - y[1])[0]?.[0] ?? '—'} /></div>
    <div className="ovgrid"><Panel icon="list" title="Kết quả theo câu hỏi" act={<>{rs.length < n && <button type="button" className="btn sm" onClick={() => P.setMsg('✓ Đã nhắc học viên chưa trả lời phiếu')}><Ic n="send" /> Nhắc {n - rs.length} người</button>}
      <button type="button" className="btn sm ghost" onClick={() => setView(!view)}><Ic n="eye" /> {view ? 'Ẩn phiếu' : 'Xem phiếu đã gửi'}</button></>}>
      {view && <FbForm qs={qs} />}
      {groups.map(g => <div key={g} className="fbg"><b>{g}</b>{sq.filter(q => q.g === g).map(q => { const v = rs.map(r => r.answers[q.id]).filter((x): x is number => typeof x === 'number'); const m = avg(v)
        return <div key={q.id} className="fbq"><span>{q.q}</span><div className="fbbar">{[1, 2, 3, 4, 5].map(x => <i key={x} className={'s' + x} style={{ flex: v.filter(y => y === x).length || 0 }} title={`${x} điểm: ${v.filter(y => y === x).length}`} />)}</div><b>{m == null ? '—' : m.toFixed(1)}</b></div> })}</div>)}
      <div className="legend">{[1, 2, 3, 4, 5].map(x => <span key={x}><i className={'s' + x} />{x}{x === 5 ? ' điểm' : ''}</span>)}</div></Panel>
      <Panel icon="edit" title="Góp ý của học viên">{texts.length ? texts.map((x, j) => <blockquote key={j} className="fbtx">“{x}”</blockquote>) : <Empty>Chưa có góp ý.</Empty>}
        <small className="sub">{S.anon !== false ? 'Ẩn danh · ' : ''}dùng để cải tiến chương trình, học liệu và chọn giảng viên cho đợt sau.</small></Panel></div>
  </>
}
const FbForm = ({ qs }: { qs: Q[] }) => <ol className="fbform">{qs.map(q => <li key={q.id}><span>{q.q} <small className="sub">· {q.g}</small></span>{q.type === 'text' ? <span className="fbtxt">Trả lời tự do…</span> : <span className="stars">{[1, 2, 3, 4, 5].map(x => <i key={x}>{x}</i>)}</span>}</li>)}</ol>

// ---------- Hồ sơ & thống kê ----------
const compCell = (o: { k: number; n: number; src: Set<string> } | undefined) => o ? <span className={`pill ${LVC[o.k]} plain`} title={`${o.n} lượt đánh giá · ${[...o.src].join(', ')}`}>{LV[o.k]}</span> : <span className="sub">—</span>
function DgHist({ P, k, onHist }: { P: P2; k: K; onHist: (t: string) => void }) {
  const db = P.db!; const [school, setSchool] = useState('')
  const pubs = db.plans.filter(p => p.status === 'published')
  const plansR = pubs.map(p => { const pr = k.prog(p.program_id)!; const tr = k.traineesOf(p.id); const rs = tr.map(t => k.evalOf(p, t)); const at = rs.map(r => r.att).filter((x): x is number => x != null); const sc = rs.map(r => r.score).filter((x): x is number => x != null)
    return { p, pr, n: rs.length, att: at.length ? Math.round(avg(at)!) : null, sc: avg(sc), done: rs.filter(r => r.result === 'Hoàn thành').length, cn: tr.filter(t => k.certOf(p, t)).length, fb: k.fbAvg(p) } })
  const tids = Array.from(new Set(pubs.flatMap(p => k.traineesOf(p.id)))); const people = tids.map(k.teacher).sort((a, b) => a.school.localeCompare(b.school) || a.full_name.localeCompare(b.full_name))
  const schoolsL = Array.from(new Set(people.map(t => t.school).filter(Boolean)))
  const schools = schoolsL.map(s => { const rec = pubs.flatMap(p => k.traineesOf(p.id).filter(t => k.teacher(t).school === s).map(t => k.evalOf(p, t))); return { s, n: rec.length, done: rec.filter(r => r.result === 'Hoàn thành').length } })
  const issued = [...db.certs.values()].map(c => { const p = k.plan(c.plan_id); return [c.no, k.teacher(c.teacher_id).full_name, p ? k.prog(p.program_id)?.name ?? '' : '', vn(c.issued_on)] })
  const lt = plansR.reduce((a, r) => a + r.n, 0), ld = plansR.reduce((a, r) => a + r.done, 0); const fbs = plansR.map(r => r.fb).filter((x): x is number => x != null)
  const compK = Object.keys(COMP)
  return <>
    <div className="stats"><StatCard c="c-blue" icon="users" label="Lượt tham gia" value={lt} sub={tids.length + ' học viên'} /><StatCard c="c-green" icon="check" label="Tỉ lệ hoàn thành" value={(lt ? Math.round(ld / lt * 100) : 0) + '%'} sub={`${ld}/${lt} lượt`} />
      <StatCard c="c-violet" icon="award" label="Chứng nhận" value={issued.length} sub="đã cấp" /><StatCard c="c-amber" icon="target" label="Hài lòng TB" value={fbs.length ? <>{avg(fbs)!.toFixed(1)}<small>/5</small></> : '—'} sub="từ phiếu phản hồi khoá" /></div>
    <Panel icon="list" title="Kết quả từng đợt" act={<button type="button" className="btn sm" onClick={() => exportCsv(plansR.map(r => [r.p.title, r.pr.code ?? '', r.n, r.att ?? '', fmt1(r.sc), `${r.done}/${r.n}`, r.cn, r.fb == null ? '' : r.fb.toFixed(1)]))}><Ic n="file" /> Xuất báo cáo</button>}>
      <div className="tblwrap"><table><thead><tr><th>Đợt tập huấn</th><th>Chương trình</th><th className="c">Học viên</th><th className="c">Chuyên cần TB</th><th className="c">Điểm TB</th><th>Tỉ lệ hoàn thành</th><th className="c">Chứng nhận</th><th className="c">Hài lòng</th></tr></thead><tbody>
        {plansR.map(r => <tr key={r.p.id}><td><b>{r.p.title}</b><br /><small className="sub">{r.p.unit} · {k.planRange(r.p)}</small></td><td>{r.pr.code}</td><td className="c">{r.n}</td><td className="c">{r.att ?? '—'}%</td><td className="c">{fmt1(r.sc)}</td>
          <td><div className="hbar"><i style={{ width: `${r.n ? r.done / r.n * 100 : 0}%` }} /></div><small className="sub">{r.done}/{r.n} · {r.n ? Math.round(r.done / r.n * 100) : 0}%</small></td><td className="c">{r.cn}</td><td className="c">{r.fb == null ? '—' : r.fb.toFixed(1) + '/5'}</td></tr>)}
        {!plansR.length && <tr><td colSpan={8} className="sub">Chưa có đợt đã phát hành.</td></tr>}</tbody></table></div></Panel>
    <Panel icon="target" title={<>Hồ sơ năng lực nhà giáo <small className="sub">mức cao nhất đạt được theo tiêu chí rubric đã chấm</small></>} act={<Sel label="Tất cả trường" value={school} onChange={setSchool} options={schoolsL.map(x => [x, x])} />}>
      <div className="tblwrap"><table><thead><tr><th>Học viên</th>{compK.map(c => <th key={c} className="c">{COMP[c]}</th>)}<th className="c">Khoá</th><th className="c">Hoàn thành</th><th className="c">Chứng nhận</th><th /></tr></thead><tbody>
        {people.filter(t => !school || t.school === school).map(t => { const cur = pubs.filter(p => k.traineesOf(p.id).includes(t.id)); const cp = k.compOf(t.id)
          return <tr key={t.id}><td><b>{t.full_name}</b><br /><small className="sub">{t.school}{t.subj && ' · ' + k.SUBJ(t.subj)}</small></td>{compK.map(c => <td key={c} className="c">{compCell(cp[c])}</td>)}<td className="c">{cur.length}</td>
            <td className="c">{cur.filter(p => k.evalOf(p, t.id).result === 'Hoàn thành').length}</td><td className="c">{cur.filter(p => k.certOf(p, t.id)).length}</td><td style={{ textAlign: 'right' }}><button type="button" className="btn sm ghost" onClick={() => onHist(t.id)}><Ic n="history" /> Hồ sơ</button></td></tr> })}</tbody></table></div></Panel>
    <div className="ovgrid hgrid"><Panel icon="users" title="Theo dõi theo trường">{schools.map(x => <div key={x.s} className="sbar"><span>{x.s}</span><div className="hbar"><i style={{ width: `${x.n ? x.done / x.n * 100 : 0}%` }} /></div><b>{x.done}/{x.n}</b></div>)}<small className="sub">Số lượt học viên hoàn thành / lượt tham gia</small></Panel>
      <Panel icon="award" title={<>Chứng nhận đã cấp <small className="sub">{issued.length}</small></>}><div className="tblwrap"><table><thead><tr><th>Số</th><th>Học viên</th><th>Chương trình</th><th>Ngày</th></tr></thead><tbody>
        {issued.map(r => <tr key={r[0]}><td><code>{r[0]}</code></td><td>{r[1]}</td><td>{r[2]}</td><td>{r[3]}</td></tr>)}{!issued.length && <tr><td colSpan={4} className="sub">Chưa có.</td></tr>}</tbody></table></div></Panel></div>
  </>
}
function exportCsv(rows: (string | number)[][]) {
  const head = ['Đợt tập huấn', 'Chương trình', 'Học viên', 'Chuyên cần TB (%)', 'Điểm TB', 'Hoàn thành', 'Chứng nhận', 'Hài lòng (/5)']
  const csv = '﻿' + [head, ...rows].map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n')
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'bao-cao-tap-huan.csv'; a.click(); URL.revokeObjectURL(a.href)
}
function HistModal({ k, tid, onClose }: { k: K; tid: string; onClose: () => void }) {
  useEsc(onClose)
  const t = k.teacher(tid); const cp = k.compOf(tid)
  const all = k.plansOfTeacher(tid).map(p => { const pr = k.prog(p.program_id)!; const e = k.evalOf(p, tid); const c = k.certOf(p, tid); return { id: p.id, code: pr.code ?? '', name: pr.name, unit: p.unit ?? '', time: k.planRange(p), res: e.result, cn: c?.no ?? '', sc: e.score } })
  return <><div className="amask" onClick={onClose} /><div className="amodal certm" role="dialog" aria-modal="true" aria-label="Hồ sơ năng lực" style={{ ['--kc' as string]: '#2e6fd9' }}>
    <div className="ahero"><span className="avatar">{(t.full_name.split(' ').pop() ?? '?')[0]}</span><div><h2>{t.full_name}</h2><small>{t.code} · {t.school}{t.subj && ' · ' + k.SUBJ(t.subj)}</small></div><button type="button" className="btn sm ghost aclose" aria-label="Đóng" onClick={onClose}>✕</button></div>
    <div className="abodyw"><div className="stats"><StatCard c="c-blue" icon="book" label="Khoá đã tham gia" value={all.length} /><StatCard c="c-green" icon="award" label="Chứng nhận" value={all.filter(x => x.cn).length} /></div>
      <section className="sbox"><header><b><Ic n="target" /> Mức năng lực hiện tại</b><small className="sub">từ rubric đã chấm</small></header>
        {Object.entries(COMP).map(([c, n]) => { const o = cp[c]; return <div key={c} className="cpr"><span>{n}</span><div className="cpbar">{[3, 2, 1, 0].map(x => <i key={x} className={o && o.k <= x ? 'on l' + o.k : ''} />)}</div>{compCell(o)}</div> })}</section>
      <ol className="timeline">{all.map(x => <li key={x.id}><span className={'tdot' + (x.res === 'Hoàn thành' ? ' ok' : x.res === 'Chưa hoàn thành' ? ' no' : '')} /><div><b>{x.name}</b> <code>{x.code}</code><small className="sub">{x.unit} · {x.time}{x.sc != null && ' · điểm ' + fmt1(x.sc)}</small>
        <div className="chips"><span className={`pill ${resPill(x.res)} plain`}>{x.res}</span>{x.cn && <span className="chip"><Ic n="award" /> {x.cn}</span>}</div></div></li>)}</ol></div></div></>
}
