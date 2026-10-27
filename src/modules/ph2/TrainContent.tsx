import { Fragment, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../../lib/supabase'
import { norm } from '../ph1/ui'
import { Empty, Flow, Ic, Mau, PageHead, Panel, Search, Seg, Sel, StatusPill, cssVar } from '../ph1/mau/kit'
import { SGLYPH } from '../ph1/mau/icons'
import { ActStore, BLOCK_KIND, BlockEdit, BlockView, CoverDeco, newBlock, type Block } from '../ph1/designs/blocks'
import { ACTS, clone, setActToast } from '../ph1/designs/acts'
import { IKIND, PAGE, SUBMIT, TBASIS, TG4, TLINK, fmtM, goto, lines, shortTitle, takeIntent, vn, vnS, type K, type Lect, type Mat, type MatContent, type Mod, type Part } from './api'
import { MatPill } from './TrainProgs'
import { useP2, type P2 } from './use'

// 2.1c Nội dung tập huấn — dựng theo bản mẫu giao diện: Học liệu (mỗi mô-đun một học liệu, nhiều phiên bản, 4 nhóm chốt) › Bài giảng (soạn từ phiên bản học liệu,
// khối trình chiếu, kho hoạt động) › Hoạt động thực hành (đề bài lấy từ đầu điểm của Khung đánh giá). Buổi học & lớp trực tuyến ở Kế hoạch tập huấn › Lịch.
export function TrainContent({ orgId, go }: { orgId: string | null; go?: (p: string) => void }) {
  const P = useP2(orgId)
  const [tab, setTab] = useState<'mat' | 'lect' | 'prac'>('mat')
  const [open, setOpen] = useState<string | null>(null)
  const [lect, setLect] = useState<string | null>(null)
  const [learner, setLearner] = useState(false)
  const [part, setPart] = useState(0)
  useEffect(() => { setActToast(m => P.setMsg(m)); const x = takeIntent(PAGE.bt); if (x?.open) { setTab('mat'); setOpen(x.open) } if (x?.lect) { setTab('lect'); setLect(x.lect) } }, [])
  const { k, db } = P
  const msg = P.msg ? <p className={P.msg.startsWith('✓') ? 'okmsg' : 'msg'} role="status" onClick={() => P.setMsg('')}>{P.msg}</p> : null
  if (!k || !db) return <Mau>{msg}<p className="sub">Đang tải…</p></Mau>
  async function newLect(mid: string, firstBlock?: Block) {
    const m = k!.mod(mid); if (!m || !orgId) return
    const st = k!.matSt(m); const mat = k!.matsOf(mid).find(x => x.version_no === st.v)
    const parts: Part[] = (mat?.content?.acts?.length ? mat.content.acts.map(a => ({ title: a.title, minutes: a.minutes })) : ['Khởi động', 'Nội dung chính', 'Thực hành', 'Tổng kết'].map(t => ({ title: t, minutes: 20 })))
      .map(x => ({ ...x, note: '', blocks: [] }))
    if (firstBlock) parts[0].blocks = [firstBlock]
    const { data, error } = await supabase.from('ph2_lectures').insert({ org_id: orgId, module_id: mid, mat_version: st.v || null, title: m.title, author: k!.orgName(orgId) || 'KDI Education', status: 'draft', parts }).select('id').single()
    if (error) return P.setMsg(error.message)
    await P.reload(); P.setMsg(`✓ Đã tạo bài giảng từ học liệu PB ${st.v || 1}`); setTab('lect'); setOpen(null); setLect((data as { id: string }).id); setPart(0); setLearner(false); scrollTo(0, 0)
  }
  if (tab === 'mat' && open && k.mod(open)) return <Mau>{msg}<MatDetail P={P} k={k} mid={open} onBack={() => setOpen(null)} onNewLect={() => newLect(open)} onLect={id => { setTab('lect'); setOpen(null); setLect(id); setPart(0) }} /></Mau>
  const L = db.lects.find(x => x.id === lect)
  if (tab === 'lect' && L) return <Mau>{msg}<LectEditor P={P} k={k} L={L} part={part} setPart={setPart} learner={learner} setLearner={setLearner} onBack={() => { setLect(null); setLearner(false) }}
    onStore={() => { setTarget({ lect: L.id, part }); setLect(null) }} /></Mau>
  return <Mau>{msg}
    <PageHead icon="video" title="Nội dung tập huấn" sub="Học liệu theo mô-đun (nhiều phiên bản), bài giảng và đề bài thực hành — buổi học & lớp học trực tuyến ở Kế hoạch tập huấn › Lịch" />
    <Flow steps={[['mat', 'Học liệu', `${db.mods.filter(m => k.matSt(m).s !== 'none').length} học liệu mô-đun`], ['lect', 'Bài giảng', `${db.lects.length} bài giảng`],
      ['prac', 'Hoạt động thực hành', `${db.progs.flatMap(p => p.items).filter(i => i.kind !== 'quiz').length} đề bài · gắn khung đánh giá`]]} value={tab} onChange={t => { setTab(t); setOpen(null); setLect(null) }} />
    {tab === 'mat' ? <MatList P={P} k={k} onOpen={setOpen} />
      : tab === 'lect' ? <LectList P={P} k={k} newLect={newLect} onOpen={(id, l) => { setLect(id); setPart(0); setLearner(l); scrollTo(0, 0) }} />
      : <Practice P={P} k={k} go={go} />}
  </Mau>
  function setTarget(t: { lect: string; part: number }) { TARGET = t; setTab('lect') }
}
let TARGET: { lect: string; part: number } | null = null

// ---------- Học liệu: danh sách ----------
function MatList({ P, k, onOpen }: { P: P2; k: K; onOpen: (mid: string) => void }) {
  const db = P.db!
  const [F, setF] = useState({ q: '', subj: '', st: '', prog: '' })
  const [view, setView] = useState<'table' | 'grid'>('table')
  const [shut, setShut] = useState<Set<string>>(new Set())
  const qq = norm(F.q)
  const okM = (s: string, m: Mod) => (!qq || norm(m.title).includes(qq)) && (!F.subj || s === F.subj) && (!F.st || k.matSt(m).s === F.st)
  const create = async (m: Mod) => { const { error } = await supabase.rpc('ph2_material_new', { p_module: m.id }); if (error) return P.setMsg(error.message); await P.reload(); P.setMsg('✓ Đã tạo học liệu PB 1 (nháp)'); onOpen(m.id) }
  const act = (m: Mod) => k.matSt(m).s === 'none' ? (P.canManage ? <button type="button" className="btn sm primary" onClick={() => create(m)}><Ic n="plus" /> Tạo học liệu</button> : <span className="sub">Chưa có</span>)
    : <button type="button" className="btn sm" onClick={() => onOpen(m.id)}>Mở ›</button>
  const allS = Array.from(new Set(db.progs.flatMap(k.subjectsOf)))
  const progs = db.progs.filter(p => !F.prog || p.id === F.prog)
  return <>
    <div className="toolbar"><Search value={F.q} onChange={q => setF({ ...F, q })} placeholder="Tìm mô-đun…" /><Sel label="Tất cả chương trình" value={F.prog} onChange={v => setF({ ...F, prog: v })} options={db.progs.map(p => [p.id, `${p.code} · ${p.name}`])} />
      <Sel label="Tất cả môn học" value={F.subj} onChange={v => setF({ ...F, subj: v })} options={allS.map(s => [s, k.SUBJ(s)])} />
      <Sel label="Mọi tình trạng học liệu" value={F.st} onChange={v => setF({ ...F, st: v })} options={[['ok', 'Đủ'], ['draft', 'Đang soạn'], ['none', 'Chưa có']]} />
      <Seg label="Kiểu xem" items={[['table', 'Bảng'], ['grid', 'Thẻ']]} value={view} onChange={setView} />
      <button type="button" className="btn sm ghost" onClick={() => setShut(progs.every(p => shut.has(p.id)) ? new Set() : new Set(progs.map(p => p.id)))}>{progs.every(p => shut.has(p.id)) ? 'Mở tất cả' : 'Thu gọn tất cả'}</button></div>
    {progs.map(p => { const g = k.groupOf(p.group_code); const subs = k.subjectsOf(p).map(s => [s, k.subjMods(p, s).filter(m => okM(s, m))] as const).filter(([, ms]) => ms.length); if (!subs.length) return null
      const all = subs.flatMap(([, ms]) => ms); const ok = all.filter(m => k.matSt(m).s === 'ok').length
      return <details key={p.id} className="kprog mprog" open={!shut.has(p.id)} onToggle={e => { const o = (e.currentTarget as HTMLDetailsElement).open; setShut(x => { const n = new Set(x); if (o) n.delete(p.id); else n.add(p.id); return n }) }}>
        <summary className="phead" style={cssVar(g.color)}><span className="chev"><Ic n="chev" /></span><span className="code sm">{p.code}</span><b>{p.name}</b><small>{subs.length} môn · {all.length} mô-đun · {ok}/{all.length} đủ học liệu</small></summary>
        {view === 'table' ? <div className="tblwrap"><table><thead><tr><th>STT</th><th>Mô-đun</th><th>Thời lượng</th><th>Học liệu (PB đang dùng)</th><th>Bài giảng</th><th /></tr></thead><tbody>
          {subs.map(([s, ms]) => <Fragment key={s}><tr className="band"><td colSpan={6}><span className="tag">Môn học</span> {k.SUBJ(s)} <small className="sub">· {ms.length} mô-đun · {ms.filter(m => k.matSt(m).s === 'ok').length} đủ học liệu</small></td></tr>
            {ms.map((m, i) => <tr key={m.id}><td className="n">{i + 1}</td><td><b>{m.title}</b></td><td>{Number(m.hours)} giờ</td><td><MatPill k={k} m={m} />{k.matSt(m).s !== 'none' && <> <small className="sub">PB {k.matSt(m).v}</small></>}</td>
              <td>{db.lects.filter(l => l.module_id === m.id).length}</td><td style={{ textAlign: 'right' }}>{act(m)}</td></tr>)}</Fragment>)}</tbody></table></div>
          : subs.map(([s, ms]) => <div key={s} className="msub"><div className="msubh"><svg viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: SGLYPH[s] ?? SGLYPH.khtn }} /><b>{k.SUBJ(s)}</b><small>{ms.length} mô-đun</small></div>
            <div className="grid hlgrid">{ms.map((m, i) => <article key={m.id} className="pcard dcard hlcard" style={cssVar(g.color)}><div className="cover"><CoverDeco s={s} /><span>{k.SUBJ(s)} · {Number(m.hours)} giờ</span><b>Mô-đun {i + 1}</b></div><h3>{m.title}</h3>
              <div className="chips"><MatPill k={k} m={m} />{k.matSt(m).s !== 'none' && <span className="chip">PB {k.matSt(m).v}</span>}<span className="chip">{db.lects.filter(l => l.module_id === m.id).length} bài giảng</span></div><div className="foot"><span />{act(m)}</div></article>)}</div></div>)}</details> })}
    {!progs.some(p => k.subjectsOf(p).some(s => k.subjMods(p, s).some(m => okM(s, m)))) && <Empty>Không có mô-đun phù hợp.</Empty>}
  </>
}

// ---------- Học liệu: chi tiết theo phiên bản ----------
function MatDetail({ P, k, mid, onBack, onNewLect, onLect }: { P: P2; k: K; mid: string; onBack: () => void; onNewLect: () => void; onLect: (id: string) => void }) {
  const m = k.mod(mid)!; const p = k.prog(m.program_id)!; const g = k.groupOf(p.group_code); const vs = k.matsOf(mid)
  const [ver, setVer] = useState<number | null>(null)
  const [tab, setTab] = useState<string>('info')
  const [calc, setCalc] = useState({ students: 30, groups: 6 })
  const v: Mat | undefined = vs.find(x => x.version_no === (ver ?? m.mat_use ?? vs[vs.length - 1]?.version_no)) ?? vs[vs.length - 1]
  if (!v) return <><button type="button" className="btn sm ghost" onClick={onBack}><Ic n="back" /> Học liệu tập huấn</button><Empty>Mô-đun chưa có học liệu.</Empty></>
  const ro = v.status !== 'draft' || !P.canManage; const C = v.content
  const saveC = (x: Partial<MatContent>) => P.run(supabase.from('ph2_materials').update({ content: { ...C, ...x } }).eq('id', v.id))
  const toggleG = (key: string) => P.run(supabase.from('ph2_materials').update({ groups: { ...v.groups, [key]: v.groups[key] === 'ok' ? '' : 'ok' } }).eq('id', v.id))
  const allOk = TG4.every(([key]) => v.groups[key] === 'ok')
  const Lst = (path: (string[]) | undefined, set: (x: string[]) => void, ph = 'Mỗi ý một dòng') => ro ? ((path ?? []).length ? <ul className="galist">{path!.map((t, i) => t.startsWith('[Hình]')
    ? <li key={i} className="img"><Ic n="img" /><span>{t.slice(6).trim() || 'Hình ảnh'}</span></li> : <li key={i} className={t.startsWith('– ') ? 'sub' : ''}>{t.replace(/^– /, '')}</li>)}</ul> : <p className="sub">—</p>)
    : <textarea className="galines" rows={Math.max(2, (path ?? []).length + 1)} placeholder={ph} defaultValue={(path ?? []).join('\n')} key={v.id + (path ?? []).join('|')} onBlur={e => e.target.value !== (path ?? []).join('\n') && set(lines(e.target.value))} />
  const gT = (key: string) => ro ? <span className={'pill ' + (v.groups[key] === 'ok' ? 'good' : 'warn')}>{v.groups[key] === 'ok' ? 'Đã chốt' : 'Cần kiểm tra'}</span>
    : <button type="button" className={'btn sm' + (v.groups[key] === 'ok' ? '' : ' primary')} onClick={() => toggleG(key)}>{v.groups[key] === 'ok' ? 'Đã chốt · bỏ chốt' : <><Ic n="check" /> Chốt nhóm này</>}</button>
  let body: ReactNode = null
  if (tab === 'info') body = <Panel icon="info" title="Thông tin bài học" act={gT('info')}>
    <div className="gahead" style={cssVar(g.color)}><b>{m.title.toUpperCase()}</b><span>Môn: <b>{k.SUBJ(m.subject)}</b></span><span>Thời lượng: <b>{Number(m.hours)} giờ</b> ({fmtM(p.mpp)}/buổi)</span><span>Chương trình: <b>{p.code}</b></span></div>
    <div className="gasec"><h3>Mô tả</h3>{ro ? <p className="outcomes">{C.desc}</p> : <textarea rows={3} defaultValue={C.desc} key={v.id + 'd'} onBlur={e => e.target.value !== C.desc && saveC({ desc: e.target.value })} />}</div>
    <div className="gasec"><h3>I. Yêu cầu cần đạt</h3>{Lst(C.outcomes, x => saveC({ outcomes: x }))}</div>
    <div className="gasec"><h3>Yêu cầu sản phẩm của học viên</h3>{Lst(C.product, x => saveC({ product: x }))}</div>
    <div className="gasec"><h3>II. Học liệu & thiết bị</h3><p className="sub" style={{ margin: 0 }}>Vật tư, thiết bị: tab <button type="button" className="linkbtn2" onClick={() => setTab('norms')}>Định mức vật tư</button> ({C.norms?.length ?? 0} mục) · Slide, video, phiếu: tab <button type="button" className="linkbtn2" onClick={() => setTab('links')}>Link tài liệu</button> ({C.links?.length ?? 0} mục).</p></div>
    <div className="gasec"><h3>Thông tin tài liệu</h3><div className="tblwrap"><table className="docinfo"><tbody>{(([['written', 'Được soạn ngày'], ['reviewed', 'Được review ngày'], ['edited', 'Được hiệu chỉnh ngày']]) as const).map(([key, n]) => { const arr = C.doc?.[key] ?? []
      return <tr key={key}><th>{n}</th><td>{ro ? (arr.length ? arr.map(([d, b], i) => <div key={i}>{d} · <b>{b}</b></div>) : <span className="sub">—</span>)
        : <textarea rows={Math.max(1, arr.length)} placeholder="dd/mm/yyyy · Họ tên" defaultValue={arr.map(([d, b]) => d + ' · ' + b).join('\n')} key={v.id + key + arr.length} onBlur={e => saveC({ doc: { ...C.doc, [key]: lines(e.target.value).map(x => x.split('·').map(y => y.trim())) } })} />}</td></tr> })}</tbody></table></div></div></Panel>
  if (tab === 'content') { const tot = (C.acts ?? []).reduce((a, x) => a + (+x.minutes || 0), 0); const acts = C.acts ?? []
    body = <Panel icon="list" title="III. Tiến trình tập huấn" act={<><small className="sub">{acts.length} hoạt động · {tot} phút ({fmtM(tot)})</small>{!ro && <button type="button" className="btn sm" onClick={() => saveC({ acts: [...acts, { title: 'Hoạt động mới', minutes: 15, items: [] }] })}><Ic n="plus" /> Hoạt động</button>}{gT('content')}</>}>
      {acts.map((x, ai) => <div key={ai} className="gaact"><div className="gaacth"><span className="sno">{ai + 1}</span>{ro ? <><b>{x.title}</b><span className="mins">{x.minutes}′</span></>
        : <><input defaultValue={x.title} key={v.id + ai + x.title} aria-label="Tên hoạt động" onBlur={e => e.target.value !== x.title && saveC({ acts: acts.map((y, j) => j === ai ? { ...y, title: e.target.value } : y) })} />
          <label className="mins"><input type="number" min={0} defaultValue={x.minutes} key={v.id + ai + 'm' + x.minutes} aria-label="Số phút" onBlur={e => saveC({ acts: acts.map((y, j) => j === ai ? { ...y, minutes: +e.target.value || 0 } : y) })} /> phút</label>
          <button type="button" className="btn sm ghost" aria-label="Xoá hoạt động" onClick={() => saveC({ acts: acts.filter((_, j) => j !== ai) })}><Ic n="trash" /></button></>}</div>
        <div className="gapart">{Lst(x.items, it => saveC({ acts: acts.map((y, j) => j === ai ? { ...y, items: it } : y) }), 'Mỗi ý một dòng · "– " ý con · "[Hình] mô tả" chỗ đặt hình')}</div></div>)}
      <div className="gasec"><h3>Nhiệm vụ thực hành sau buổi</h3>{ro ? <p className="outcomes">{C.practice}</p> : <textarea rows={2} defaultValue={C.practice} key={v.id + 'pr'} onBlur={e => e.target.value !== C.practice && saveC({ practice: e.target.value })} />}<small className="sub">Dùng cho bước “Hoạt động thực hành”.</small></div></Panel> }
  if (tab === 'links') { const ls = C.links ?? []
    body = <Panel icon="link" title="Link tài liệu" act={<>{!ro && Object.entries(TLINK).map(([kk, n]) => <button type="button" key={kk} className="btn sm" onClick={() => saveC({ links: [...ls, { kind: kk, title: n + ' mới', url: '' }] })}><Ic n="plus" /> {n}</button>)}{gT('links')}</>}>
      <div className="tblwrap"><table><thead><tr><th>Loại</th><th>Tên</th><th>Đường dẫn</th>{!ro && <th />}</tr></thead><tbody>{ls.map((x, i) => <tr key={i}><td>{TLINK[x.kind]}</td>{ro
        ? <><td><b>{x.title}</b></td><td>{x.url ? <a href={x.url} target="_blank" rel="noreferrer">{x.url}</a> : <span className="sub">chưa có đường dẫn</span>}</td></>
        : <><td><input defaultValue={x.title} key={v.id + i + x.title} aria-label="Tên" onBlur={e => saveC({ links: ls.map((y, j) => j === i ? { ...y, title: e.target.value } : y) })} /></td>
          <td><input defaultValue={x.url} key={v.id + i + x.url} placeholder="https://…" aria-label="Đường dẫn" onBlur={e => saveC({ links: ls.map((y, j) => j === i ? { ...y, url: e.target.value } : y) })} /></td>
          <td><button type="button" className="btn sm ghost" aria-label="Xoá" onClick={() => saveC({ links: ls.filter((_, j) => j !== i) })}><Ic n="trash" /></button></td></>}</tr>)}
        {!ls.length && <tr><td colSpan={4} className="sub">Chưa có tài liệu.</td></tr>}</tbody></table></div></Panel> }
  if (tab === 'norms') { const ns = C.norms ?? []; const need = (n: typeof ns[0]) => +(n.qty * (n.basis === 'group' ? calc.groups : n.basis === 'student' ? calc.students : 1)).toFixed(2)
    const part = (cat: string, title: string, hint: string) => { const list = ns.map((n, i) => ({ n, i })).filter(x => x.n.cat === cat)
      return <div className="nmpart"><div className="nmhead"><span className="tag">{cat === 'vl' ? 'Danh mục 1' : 'Danh mục 2'}</span><b>{title}</b><small>{hint} · {list.length} mục</small>{!ro && <button type="button" className="btn sm" onClick={() => saveC({ norms: [...ns, { name: '', unit: 'cái', qty: 1, basis: cat === 'vl' ? 'group' : 'cls', cat }] })}><Ic n="plus" /> Thêm</button>}</div>
        <div className="tblwrap"><table className="nmtbl"><thead><tr><th>STT</th><th>Tên</th><th>Đơn vị</th><th style={{ textAlign: 'right' }}>Số lượng</th><th>Tính theo</th><th style={{ textAlign: 'right' }}>Cần cho lớp</th>{!ro && <th />}</tr></thead><tbody>
          {list.map(({ n, i }, kk) => { const up = (x: Partial<typeof n>) => saveC({ norms: ns.map((y, j) => j === i ? { ...y, ...x } : y) })
            return ro ? <tr key={i}><td className="n">{kk + 1}</td><td><b>{n.name}</b></td><td>{n.unit}</td><td style={{ textAlign: 'right' }}>{n.qty}</td><td>{TBASIS[n.basis]}</td><td style={{ textAlign: 'right' }}><b>{need(n)}</b> {n.unit}</td></tr>
              : <tr key={i}><td className="n">{kk + 1}</td><td><input defaultValue={n.name} key={v.id + i + n.name} aria-label="Tên" onBlur={e => e.target.value !== n.name && up({ name: e.target.value })} /></td>
                <td><input defaultValue={n.unit} key={v.id + i + n.unit} aria-label="Đơn vị" style={{ width: 80 }} onBlur={e => e.target.value !== n.unit && up({ unit: e.target.value })} /></td>
                <td style={{ textAlign: 'right' }}><input type="number" min={0} step="any" defaultValue={n.qty} key={v.id + i + 'q' + n.qty} aria-label="Số lượng" style={{ width: 80, textAlign: 'right' }} onBlur={e => +e.target.value !== n.qty && up({ qty: +e.target.value || 0 })} /></td>
                <td><select value={n.basis} aria-label="Tính theo" onChange={e => up({ basis: e.target.value })}>{Object.entries(TBASIS).map(([b, t]) => <option key={b} value={b}>{t}</option>)}</select></td>
                <td style={{ textAlign: 'right' }}><b>{need(n)}</b> {n.unit}</td><td><button type="button" className="btn sm ghost" aria-label="Xoá" onClick={() => saveC({ norms: ns.filter((_, j) => j !== i) })}><Ic n="trash" /></button></td></tr> })}
          {!list.length && <tr><td colSpan={7} className="sub">Chưa có mục nào.</td></tr>}</tbody></table></div></div> }
    body = <Panel icon="box" title="Định mức vật tư" act={gT('norms')}>
      <div className="calc"><label>Số học viên <input type="number" min={1} value={calc.students} onChange={e => setCalc({ ...calc, students: +e.target.value || 1 })} /></label><label>Số nhóm <input type="number" min={1} value={calc.groups} onChange={e => setCalc({ ...calc, groups: +e.target.value || 1 })} /></label><span>→ nhu cầu cho một lớp tập huấn ở cột cuối</span></div>
      {part('vl', 'Nguyên vật liệu', 'tiêu hao, tính theo học viên / nhóm')}{part('cc', 'Công cụ & thiết bị', 'dùng lại, tính theo nhóm / lớp')}</Panel> }
  const ls = P.db!.lects.filter(l => l.module_id === mid)
  if (tab === 'lects') body = <Panel icon="edit" title="Kho bài giảng của mô-đun" act={<button type="button" className="btn sm primary" onClick={onNewLect}><Ic n="plus" /> Soạn bài giảng từ PB {k.matSt(m).v || v.version_no}</button>}>
    {ls.length ? <div className="tblwrap"><table><thead><tr><th>Bài giảng</th><th>Từ phiên bản</th><th>Người soạn</th><th>Trạng thái</th><th>Cập nhật</th></tr></thead><tbody>{ls.map(l => <tr key={l.id} className="rowlink" tabIndex={0} onClick={() => onLect(l.id)}>
      <td><b>{l.title}</b></td><td>PB {l.mat_version ?? '?'}</td><td>{l.author}</td><td>{l.status === 'published' ? <span className="pill good plain">Đã xuất bản</span> : <span className="pill draft plain">Nháp</span>}</td><td>{vn(l.updated_at)}</td></tr>)}</tbody></table></div>
      : <Empty>Chưa có bài giảng nào soạn từ học liệu này.</Empty>}</Panel>
  return <>
    <button type="button" className="btn sm ghost" onClick={onBack}><Ic n="back" /> Học liệu tập huấn</button>
    <div className="dhead"><span className="code" style={cssVar(g.color)}>{p.code}</span><div><h1>{m.title}</h1><span className="crumb">{p.name} › {k.SUBJ(m.subject)} · {Number(m.hours)} giờ</span></div></div>
    <div className="verbar"><span className="tag">Phiên bản</span><select value={v.version_no} aria-label="Phiên bản" onChange={e => setVer(+e.target.value)}>{[...vs].reverse().map(x => <option key={x.id} value={x.version_no}>PB {x.version_no} · {x.status === 'published' ? 'Đã phát hành' : 'Nháp'}{x.version_no === m.mat_use ? ' · đang dùng' : ''}</option>)}</select>
      <StatusPill s={v.status} /> {v.version_no === m.mat_use ? <span className="pill good plain">Đang dùng</span> : v.status === 'published' && P.canManage ? <button type="button" className="btn sm" onClick={() => P.run(supabase.from('ph2_modules').update({ mat_use: v.version_no }).eq('id', mid), `✓ Đang dùng PB ${v.version_no}`)}>Dùng phiên bản này</button> : null}
      <small className="sub">Cập nhật {vn(v.updated_at)}</small>
      {P.canManage && <span className="act">{v.status === 'draft' && <button type="button" className="btn sm primary" onClick={async () => { if (!allOk) return P.setMsg('Chốt đủ 4 nhóm trước khi phát hành')
        if (await P.run(supabase.from('ph2_materials').update({ status: 'published', published_at: new Date().toISOString() }).eq('id', v.id))) await P.run(supabase.from('ph2_modules').update({ mat_use: v.version_no }).eq('id', mid), `✓ Đã phát hành PB ${v.version_no} — đơn vị đang dùng bản cũ nhận thông báo`) }}><Ic n="send" /> Phát hành phiên bản</button>}
        <button type="button" className="btn sm" onClick={async () => { const { data, error } = await supabase.rpc('ph2_material_new_version', { p_material: v.id }); if (error) return P.setMsg(error.message); await P.reload(); const n = k.matsOf(mid).length + 1; setVer(n); P.setMsg(`✓ Đã tạo PB ${n} (nháp) từ PB ${v.version_no}`); void data }}><Ic n="copy" /> Tạo phiên bản mới</button></span>}</div>
    {v.status !== 'draft' ? <p className="note">Phiên bản đã phát hành được giữ nguyên — bấm “Tạo phiên bản mới” để sửa.</p> : !allOk && <p className="note">Chốt đủ 4 nhóm (chấm xanh trên các tab) để phát hành phiên bản.</p>}
    <div className="tabs">{TG4.map(([key, n]) => <button type="button" key={key} className={tab === key ? 'on' : ''} onClick={() => setTab(key)}>{n} <i className={'gst' + (v.groups[key] === 'ok' ? ' ok' : '')} /></button>)}
      <button type="button" className={tab === 'lects' ? 'on' : ''} onClick={() => setTab('lects')}>Kho bài giảng <small>{ls.length}</small></button></div>{body}
  </>
}

// ---------- Bài giảng ----------
function LectList({ P, k, newLect, onOpen }: { P: P2; k: K; newLect: (mid: string, b?: Block) => void; onOpen: (id: string, learner: boolean) => void }) {
  const db = P.db!
  const [sub, setSub] = useState<'compose' | 'store'>(TARGET ? 'store' : 'compose')
  const [pick, setPick] = useState(false)
  const [, force] = useState(0)
  const mods = db.progs.flatMap(p => k.allMods(p).filter(x => k.matSt(x.m).s !== 'none').map(x => ({ p, ...x })))
  const sum = (ps: Part[]) => ps.reduce((a, x) => a + (+x.minutes || 0), 0)
  const addBlock = async (L: Lect, part: number, b: Block) => { const parts = L.parts.map((x, i) => i === part ? { ...x, blocks: [...x.blocks, b] } : x)
    const pub = L.status === 'published'; if (await P.run(supabase.from('ph2_lectures').update({ parts, ...(pub ? { status: 'draft' } : {}) }).eq('id', L.id), pub ? `✓ Đã thêm — ${L.title} chuyển về nháp, xuất bản lại khi xong` : `✓ Đã thêm hoạt động vào ${L.title}`)) { TARGET = null; onOpen(L.id, false) } }
  const tl = TARGET ? db.lects.find(l => l.id === TARGET!.lect) : null
  return <>
    <div className="tabs"><button type="button" className={sub === 'compose' ? 'on' : ''} onClick={() => setSub('compose')}>Soạn bài giảng <small>{db.lects.length}</small></button><button type="button" className={sub === 'store' ? 'on' : ''} onClick={() => setSub('store')}>Kho hoạt động <small>{ACTS.length}</small></button></div>
    {sub === 'store' ? <ActStore target={tl ? { label: tl.title, onCancel: () => { const t = TARGET!; TARGET = null; onOpen(t.lect, false) }, onAdd: (a, cfg) => addBlock(tl, TARGET!.part, { type: 'activity', act: a.id, cfg: clone(cfg) }) } : null}
      addTo={{ title: 'Thêm vào bài giảng của tôi', docLabel: 'Bài giảng', partLabel: 'Đặt vào phần', button: 'Thêm vào bài giảng của tôi', docs: db.lects.map(l => [l.id, `${l.title}${l.status === 'published' ? ' (đã xuất bản → chuyển về nháp)' : ''}`] as [string, string]),
        partsOf: id => (db.lects.find(l => l.id === id)?.parts ?? []).map((x, i) => [String(i), `Phần ${i + 1}. ${x.title}`] as [string, string]),
        onAdd: (id, part, a, cfg) => { const L = db.lects.find(l => l.id === id); if (L) addBlock(L, part, { type: 'activity', act: a.id, cfg: clone(cfg) }) } }}
      newFrom={{ title: 'Tạo bài giảng mới với hoạt động này', label: 'Soạn từ học liệu của mô-đun', hint: 'Bài giảng mới lấy khung từ phiên bản học liệu đang dùng; hoạt động này được đặt vào phần đầu tiên.', button: 'Tạo bài giảng', footBtn: 'Tạo bài giảng mới với hoạt động này',
        options: mods.map(({ p, s, m }) => [m.id, `${p.code} · ${k.SUBJ(s)} · ${m.title}`] as [string, string]), onNew: (mid, a, cfg) => newLect(mid, { type: 'activity', act: a.id, cfg: clone(cfg) }) }} />
    : <>
      <div className="toolbar"><span className="sub">Bài giảng soạn từ một phiên bản học liệu mô-đun; trình chiếu trong buổi trực tiếp hoặc lớp học ảo.</span><span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}><button type="button" className="btn primary sm" onClick={() => setPick(true)}><Ic n="plus" /> Soạn bài giảng</button></span></div>
      {pick && <Panel icon="file" title="Chọn mô-đun có học liệu" act={<button type="button" className="btn sm ghost" onClick={() => setPick(false)}>Đóng</button>}><div className="grid">{mods.map(({ p, s, m }) =>
        <button type="button" key={m.id} className="pcard mini" style={cssVar(k.groupOf(p.group_code).color)} onClick={() => newLect(m.id)}><div className="top"><span className="code sm">{p.code}</span><div style={{ minWidth: 0 }}><h3>{m.title}</h3><small style={{ color: 'var(--muted)' }}>{k.SUBJ(s)} · PB {k.matSt(m).v}</small></div></div></button>)}
        {!mods.length && <Empty>Chưa có mô-đun nào có học liệu.</Empty>}</div></Panel>}
      <div className="grid dgrid">{db.lects.map(l => { const m = k.mod(l.module_id); const p = m ? k.prog(m.program_id) : null; const g = k.groupOf(p?.group_code ?? null)
        return <article key={l.id} className="pcard dcard" style={cssVar(g.color)}><div className="cover"><CoverDeco s={m?.subject} /><span>{p?.code} · {k.SUBJ(m?.subject)}</span><b>{shortTitle(l.title).slice(0, 26)}</b></div><h3>{l.title}</h3>
          <small className="sub">{m?.title} · học liệu PB {l.mat_version ?? '?'} · {l.author}</small>
          <div className="chips">{l.status === 'published' ? <span className="pill good">Đã xuất bản</span> : <span className="pill draft">Nháp</span>}<span className="chip">{l.parts.length} phần · {sum(l.parts)} phút</span></div>
          <div className="foot"><span>cập nhật {vn(l.updated_at)}</span><span className="cbtns"><button type="button" className="btn sm" onClick={() => onOpen(l.id, false)}><Ic n="edit" /> Soạn</button><button type="button" className="btn sm ghost" aria-label="View học viên" onClick={() => onOpen(l.id, true)}><Ic n="eye" /></button>
            <button type="button" className="btn sm ghost" aria-label="Xoá" onClick={() => P.run(supabase.from('ph2_lectures').delete().eq('id', l.id), '✓ Đã xoá bài giảng').then(() => force(x => x + 1))}><Ic n="trash" /></button></span></div></article> })}
        {!db.lects.length && <Empty>Chưa có bài giảng.</Empty>}</div></>}
  </>
}
function LectEditor({ P, k, L, part, setPart, learner, setLearner, onBack, onStore }: { P: P2; k: K; L: Lect; part: number; setPart: (n: number) => void; learner: boolean; setLearner: (v: boolean) => void; onBack: () => void; onStore: () => void }) {
  const m = k.mod(L.module_id); const p = m ? k.prog(m.program_id) : null; const g = k.groupOf(p?.group_code ?? null)
  const cur = L.parts[part] ?? L.parts[0]; const ro = L.status === 'published' || !P.canManage
  const save = (parts: Part[]) => P.run(supabase.from('ph2_lectures').update({ parts }).eq('id', L.id))
  const patch = (x: Partial<Part>) => save(L.parts.map((y, i) => i === part ? { ...y, ...x } : y))
  const total = L.parts.reduce((a, x) => a + (+x.minutes || 0), 0)
  if (learner) return <>
    <div className="edbar"><button type="button" className="btn sm ghost" onClick={onBack}><Ic n="back" /> Danh sách</button><b>{L.title}</b><span className="pill info plain">View học viên</span><span className="act"><button type="button" className="btn sm" onClick={() => setLearner(false)}>Thoát view học viên</button></span></div>
    <section className="hero" style={cssVar(g.color)}><h2 style={{ margin: 0 }}>{L.title}</h2><p style={{ margin: 0, color: 'var(--muted)' }}>{m?.title} · {k.SUBJ(m?.subject)}</p>
      <div className="svacts">{L.parts.map((x, i) => <div key={i} className="svact"><div className="svh"><span className="sno">{i + 1}</span><b>{x.title}</b><span className="sm">{x.minutes} phút</span></div>{x.blocks.map((b, bi) => <div key={bi} className="bk"><BlockView b={b} k={`${L.id}.${i}.${bi}`} student /></div>)}</div>)}</div></section></>
  return <>
    <div className="edbar"><button type="button" className="btn sm ghost" onClick={onBack}><Ic n="back" /> Danh sách</button><span className="code sm" style={cssVar(g.color)}>{p?.code}</span><b>{L.title}</b>{L.status === 'published' ? <span className="pill good">Đã xuất bản</span> : <span className="pill draft">Nháp</span>}
      <span className="act"><button type="button" className="btn sm" onClick={() => setLearner(true)}><Ic n="eye" /> View học viên</button>{P.canManage && (L.status === 'published' ? <button type="button" className="btn sm" onClick={() => P.run(supabase.from('ph2_lectures').update({ status: 'draft' }).eq('id', L.id))}>Chuyển về nháp để sửa</button>
        : <button type="button" className="btn sm primary" onClick={() => P.run(supabase.from('ph2_lectures').update({ status: 'published' }).eq('id', L.id), '✓ Đã xuất bản bài giảng')}><Ic n="send" /> Xuất bản</button>)}</span></div>
    <div className="editor"><aside className="outline"><div className="olhead">Dàn ý · {total} phút</div>{L.parts.map((x, i) => <button type="button" key={i} className={i === part ? 'on' : ''} onClick={() => setPart(i)}><span>{i + 1}. {x.title}</span><small>{x.minutes}′</small></button>)}
      {!ro && <button type="button" className="addact" onClick={() => { save([...L.parts, { title: 'Phần mới', minutes: 15, note: '', blocks: [] }]); setPart(L.parts.length) }}><Ic n="plus" /> Phần</button>}</aside>
      <section className="canvas">{cur ? <Fragment key={part}><div className="blockhead"><span className="tag">Phần {part + 1}</span>{ro ? <h2>{cur.title}</h2> : <input className="ttl" defaultValue={cur.title} aria-label="Tên phần" onBlur={e => e.target.value !== cur.title && patch({ title: e.target.value })} />}
        <label className="minutes">{ro ? cur.minutes : <input type="number" min={0} defaultValue={cur.minutes} aria-label="Số phút" onBlur={e => patch({ minutes: +e.target.value || 0 })} />} phút</label></div>
        <label className="fld"><span>Ghi chú cho giảng viên</span>{ro ? <p className="outcomes">{cur.note || '—'}</p> : <textarea defaultValue={cur.note} placeholder="Gợi ý dẫn dắt, câu hỏi thảo luận…" onBlur={e => e.target.value !== cur.note && patch({ note: e.target.value })} />}</label>
        <div className="bkwrap"><div className="bkhead"><b>Nội dung trình chiếu</b><small className="sub">{cur.blocks.length} khối</small></div>
          {cur.blocks.length ? cur.blocks.map((b, bi) => ro ? <div key={bi} className="bk"><BlockView b={b} k={`${L.id}.${part}.${bi}`} student={false} /></div>
            : <BlockEdit key={bi + ':' + b.type} b={b} bi={bi} n={cur.blocks.length} k={`lt-${L.id}-${part}-${bi}`} setMsg={P.setMsg} set={x => patch({ blocks: cur.blocks.map((y, j) => j === bi ? { ...y, ...x } : y) })}
              move={d => { const j = bi + d; if (j < 0 || j >= cur.blocks.length) return; const a = [...cur.blocks]; [a[bi], a[j]] = [a[j], a[bi]]; patch({ blocks: a }) }} del={() => patch({ blocks: cur.blocks.filter((_, j) => j !== bi) })} />)
            : <Empty>Chưa có nội dung.</Empty>}
          {!ro && <div className="bkadd">{Object.entries(BLOCK_KIND).map(([t, [n, icn]]) => <button type="button" key={t} className="btn sm" onClick={() => t === 'activity' ? onStore() : patch({ blocks: [...cur.blocks, newBlock(t)] })}><Ic n={icn} /> {n}</button>)}</div>}</div></Fragment> : <Empty>Chưa có phần nào.</Empty>}</section>
      <aside className="infop"><div className="covbig" style={cssVar(g.color)}><CoverDeco s={m?.subject} /><span>{p?.code} · {k.SUBJ(m?.subject)}</span><b>{L.title}</b></div>
        <label className="fld"><span>Tên bài giảng</span>{ro ? <b>{L.title}</b> : <input defaultValue={L.title} onBlur={e => e.target.value.trim() && e.target.value !== L.title && P.run(supabase.from('ph2_lectures').update({ title: e.target.value.trim() }).eq('id', L.id))} />}</label>
        <dl className="kv one"><div><dt>Mô-đun</dt><dd>{m?.title}</dd></div><div><dt>Học liệu gốc</dt><dd>PB {L.mat_version ?? '?'}</dd></div><div><dt>Người soạn</dt><dd>{L.author}</dd></div></dl></aside></div>
  </>
}

// ---------- Hoạt động thực hành ----------
function Practice({ P, k, go }: { P: P2; k: K; go?: (p: string) => void }) {
  const db = P.db!
  const [prog, setProg] = useState(''); const [shut, setShut] = useState<Set<string>>(new Set())
  const pk = (i: { kind: string }) => i.kind !== 'quiz'
  const progs = db.progs.filter(p => p.items.some(pk) && (!prog || p.id === prog))
  return <>
    <div className="toolbar"><Sel label="Tất cả chương trình" value={prog} onChange={setProg} options={db.progs.filter(p => p.items.some(pk)).map(p => [p.id, `${p.code} · ${p.name}`])} />
      <span className="sub">Đề bài gắn với đầu điểm trong <b>Khung đánh giá</b> của chương trình — học viên nộp sau buổi học, giảng viên chấm theo rubric ở <b>Đánh giá kết quả › Chấm bài</b>.</span></div>
    {progs.map(pr => { const g = k.groupOf(pr.group_code); const its = pr.items.filter(pk); const plans = k.plansOf(pr.id).filter(p => p.status === 'published')
      return <details key={pr.id} className="kprog mprog" open={!shut.has(pr.id)} onToggle={e => { const o = (e.currentTarget as HTMLDetailsElement).open; setShut(x => { const n = new Set(x); if (o) n.delete(pr.id); else n.add(pr.id); return n }) }}>
        <summary className="phead" style={cssVar(g.color)}><span className="chev"><Ic n="chev" /></span><span className="code sm">{pr.code}</span><b>{pr.name}</b><small>{its.length} đề bài · {plans.length} đợt đang dùng</small>
          <span className="act"><button type="button" className="btn sm ghost" onClick={e => { e.preventDefault(); goto(go, PAGE.tp, { open: pr.id, tab: 'assess' }) }}><Ic n="edit" /> Khung đánh giá</button></span></summary>
        <div className="prgrid">{its.map(i => { const md = i.mod ? k.mod(i.mod) : null; const ps = plans.filter(p => k.planItems(p).some(x => x.id === i.id))
          return <article key={i.id} className="prcard"><div className="prh"><span className="pill info plain"><Ic n={IKIND[i.kind]?.[1] ?? 'file'} /> {IKIND[i.kind]?.[0]}</span><small>{i.w}% điểm tổng</small></div>
            <b>{i.name}</b><small className="sub">{md ? `${k.SUBJ(md.subject)} · ${md.title}` : 'Cả chương trình (cuối khoá)'}</small><p className="prtask">{i.task || 'Chưa có đề bài.'}</p>
            {i.mode === 'rubric' ? <div className="chips">{i.rubric.map(c => <span key={c.id} className="chip">{c.name}{c.req ? ' *' : ''}</span>)}</div> : <small className="sub">Chấm điểm số, thang {i.max}</small>}
            <div className="prplans">{ps.map(p => { const open = k.itemOpen(p, i); const tr = k.traineesOf(p.id); const n = tr.length; const sb = tr.filter(t => k.grOf(p, i, t)?.sub).length; const gd = tr.filter(t => k.itemScore(p, i, t) != null).length
              return <button type="button" key={p.id} className="prpl" onClick={() => goto(go, PAGE.dg, { plan: p.id, tab: 'grade', item: i.id })}><span><b>{shortTitle(p.title)}</b>
                <small>{open ? `${SUBMIT(i.kind) ? `nộp ${sb}/${n} · ` : ''}chấm ${gd}/${n} · hạn ${vnS(k.itemDue(p, i))}` : 'mở sau buổi ' + vnS(k.itemFrom(p, i))}</small></span>
                {open ? <div className="hbar"><i style={{ width: `${n ? gd / n * 100 : 0}%` }} /></div> : <span className="pill draft plain">Chưa mở</span>}</button> })}
              {!ps.length && <small className="sub">Chưa có đợt đã phát hành dùng đề này.</small>}</div>
            <div className="prfoot"><span /><span><button type="button" className="btn sm ghost" onClick={() => goto(go, PAGE.tp, { open: pr.id, tab: 'assess', item: i.id })}><Ic n="edit" /> Sửa đề & rubric</button></span></div></article> })}</div></details> })}
    {!progs.length && <Empty>Chưa có đề bài thực hành — thêm đầu điểm ở Khung đánh giá của chương trình.</Empty>}
  </>
}
