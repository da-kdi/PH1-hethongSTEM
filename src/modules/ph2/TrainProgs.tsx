import { useEffect, useRef, useState, type ReactNode } from 'react'
import { supabase } from '../../lib/supabase'
import { norm } from '../ph1/ui'
import { catOf } from '../ph1/curriculum/api'
import { Confirm, Empty, Flow, Ic, Mau, PageHead, Panel, Search, Seg, Sel, StatCard, StatusPill, cssVar } from '../ph1/mau/kit'
import { SGLYPH } from '../ph1/mau/icons'
import { CoverDeco } from '../ph1/designs/blocks'
import { COMP, CXN, IKIND, LV, LVLS, LVP, PAGE, TFORMAT, fmtM, goto, lines, sessOf, slug, takeIntent, uid, vn, type Crit, type Format, type Item, type K, type Prog } from './api'
import { useP2, type P2 } from './use'

// 2.1a Chương trình tập huấn — dựng theo bản mẫu giao diện: Danh mục (nhóm, môn, hình thức, đơn vị, giảng viên) › Chương trình (môn học › mô-đun; không chia cấp, khối, lớp)
// Chi tiết: Tổng quan · Thiết lập · Khung đánh giá (đầu điểm, rubric, điều kiện hoàn thành & chứng nhận — mọi đợt tập huấn kế thừa).
export function TrainProgs({ orgId, go }: { orgId: string | null; go?: (p: string) => void }) {
  const P = useP2(orgId)
  const [page, setPage] = useState<'cat' | 'list'>('list')
  const [open, setOpen] = useState<string | null>(null)
  const [tab, setTab] = useState<'overview' | 'setup' | 'assess'>('overview')
  const [creating, setCreating] = useState(false)
  const [itemSel, setItemSel] = useState<string | null>(null)
  useEffect(() => { const x = takeIntent(PAGE.tp); if (x?.open) { setOpen(x.open); setTab(x.tab ?? 'overview'); setItemSel(x.item ?? null) } }, [])
  const { k, db } = P
  const msg = P.msg ? <p className={P.msg.startsWith('✓') ? 'okmsg' : 'msg'} role="status" onClick={() => P.setMsg('')}>{P.msg}</p> : null
  if (!k || !db) return <Mau>{msg}<p className="sub">Đang tải…</p></Mau>
  const p = db.progs.find(x => x.id === open)
  if (creating) return <Mau>{msg}<button type="button" className="btn sm ghost" onClick={() => setCreating(false)}><Ic n="back" /> Danh sách chương trình</button>
    <TpForm P={P} k={k} p={null} orgId={orgId} onDone={id => { setCreating(false); if (id) { setOpen(id); setTab('overview') } }} /></Mau>
  if (p) return <Mau>{msg}<TpDetail P={P} k={k} p={p} tab={tab} setTab={setTab} itemSel={itemSel} setItemSel={setItemSel} orgId={orgId}
    onBack={() => { setOpen(null); setTab('overview') }} openMat={mid => goto(go, PAGE.bt, { open: mid })} /></Mau>
  const head = <><PageHead icon="book" title="Chương trình tập huấn" sub="Khung chương trình bồi dưỡng nhà giáo theo môn học › mô-đun; không chia cấp, khối, lớp">
    {P.canManage && <button type="button" className="btn primary" onClick={() => setCreating(true)}><Ic n="plus" /> Chương trình mới</button>}</PageHead>
    <Flow steps={[['cat', 'Danh mục', 'Nhóm, môn, đơn vị, giảng viên'], ['list', 'Chương trình', `${db.progs.length} chương trình · nội dung & khung đánh giá`]]} value={page} onChange={setPage} /></>
  return <Mau>{msg}{head}{page === 'cat' ? <TpCatalog P={P} k={k} orgId={orgId} /> : <TpList k={k} progs={db.progs} onOpen={id => { setOpen(id); setTab('overview'); scrollTo(0, 0) }} />}</Mau>
}

// ---------- Thẻ chương trình ----------
function TpCard({ k, p, onOpen, preview }: { k: K; p: Prog & { _subj?: string[]; _mods?: number; _h?: number }; onOpen?: () => void; preview?: boolean }) {
  const g = k.groupOf(p.group_code); const subj = p._subj ?? k.subjectsOf(p); const main = subj[0]
  const body = <><div className="cover"><CoverDeco s={main} /><span>{g.code === 'CXN' ? 'Chưa xếp nhóm' : g.code + ' · ' + g.name}</span><b>{p.code || 'MÃ'}</b></div>
    <h3>{p.name}</h3><p className="desc" style={{ margin: 0 }}>{p.summary}</p>
    <div className="chips">{subj.map(s => <span key={s} className="chip k" style={cssVar(g.color)}>{k.SUBJ(s)}</span>)}{!subj.length && <span className="chip">Chưa chọn môn</span>}<span className="chip">{TFORMAT[p.format]}</span></div>
    <div className="foot"><span>{subj.length} môn · {p._mods ?? k.allMods(p).length} mô-đun · {p._h ?? k.progH(p)} giờ</span><StatusPill s={p.status} /></div></>
  return preview ? <div className="pcard dcard tfprev" style={cssVar(g.color)}>{body}</div> : <button type="button" className="pcard dcard" style={cssVar(g.color)} onClick={onOpen}>{body}</button>
}

function TpList({ k, progs, onOpen }: { k: K; progs: Prog[]; onOpen: (id: string) => void }) {
  const [f, setF] = useState({ q: '', subj: '', grp: '', status: '' })
  const [mode, setMode] = useState<'grid' | 'table'>('grid')
  const ms = progs.flatMap(k.allMods); const qq = norm(f.q)
  const shown = progs.filter(p => (!qq || norm(`${p.code} ${p.name} ${p.summary ?? ''}`).includes(qq)) && (!f.subj || k.subjectsOf(p).includes(f.subj)) && (!f.grp || (p.group_code ?? 'CXN') === f.grp) && (!f.status || p.status === f.status))
  const subjs = Array.from(new Set(progs.flatMap(k.subjectsOf)))
  return <>
    <div className="stats"><StatCard c="c-blue" icon="book" label="Chương trình" value={progs.length} sub={progs.filter(p => p.status === 'draft').length + ' đang nháp'} />
      <StatCard c="c-green" icon="send" label="Đã phát hành" value={progs.filter(p => p.status === 'published').length} sub="dùng được để lập kế hoạch" />
      <StatCard c="c-violet" icon="list" label="Mô-đun" value={ms.length} sub={progs.reduce((a, p) => a + k.progH(p), 0) + ' giờ tập huấn'} />
      <StatCard c="c-amber" icon="file" label="Học liệu đủ" value={<>{ms.filter(x => k.matSt(x.m).s === 'ok').length}<small>/{ms.length}</small></>} sub="mô-đun có học liệu đã phát hành" /></div>
    <div className="toolbar"><Search value={f.q} onChange={q => setF({ ...f, q })} placeholder="Tìm theo mã, tên chương trình tập huấn…" />
      <Sel label="Tất cả môn học" value={f.subj} onChange={v => setF({ ...f, subj: v })} options={subjs.map(s => [s, k.SUBJ(s)])} />
      <Sel label="Tất cả nhóm" value={f.grp} onChange={v => setF({ ...f, grp: v })} options={[...k.groups().map(g => [g.code ?? '', g.name] as [string, string]), [CXN.code, CXN.name]]} />
      <Sel label="Mọi trạng thái" value={f.status} onChange={v => setF({ ...f, status: v })} options={[['draft', 'Nháp'], ['published', 'Đã phát hành'], ['archived', 'Ngừng dùng']]} />
      <Seg label="Kiểu xem" items={[['grid', 'Thẻ'], ['table', 'Danh sách']]} value={mode} onChange={setMode} /></div>
    {!shown.length ? <Empty>Không có chương trình phù hợp.</Empty> : mode === 'grid' ? <div className="grid">{shown.map(p => <TpCard key={p.id} k={k} p={p} onOpen={() => onOpen(p.id)} />)}</div>
      : <div className="panel" style={{ padding: 0 }}><div className="tblwrap"><table><thead><tr><th>Mã</th><th>Chương trình</th><th>Nhóm</th><th>Môn học</th><th>Mô-đun</th><th>Hình thức</th><th>Trạng thái</th></tr></thead><tbody>
        {shown.map(p => <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => onOpen(p.id)}><td><code>{p.code}</code></td><td><b>{p.name}</b></td><td>{k.groupOf(p.group_code).name}</td><td>{k.subjectsOf(p).map(k.SUBJ).join(', ')}</td>
          <td>{k.allMods(p).length}</td><td>{TFORMAT[p.format]}</td><td><StatusPill s={p.status} /></td></tr>)}</tbody></table></div></div>}
  </>
}

// ---------- Danh mục ----------
type CK = 'group' | 'subject' | 'format' | 'unit' | 'trainer'
function TpCatalog({ P, k, orgId }: { P: P2; k: K; orgId: string | null }) {
  const db = P.db!
  const [kind, setKind] = useState<CK>('group')
  const [edit, setEdit] = useState<string | null>(null)
  const [ask, setAsk] = useState<string | null>(null)
  const [nw, setNw] = useState<Record<string, string>>({ color: '#e08a0b' })
  const [ev, setEv] = useState<Record<string, string>>({})
  const progsOf = (f: (p: Prog) => boolean) => db.progs.filter(f).length
  const inp = (n: string, val: string, set: (v: string) => void, ph = '', type = 'text') => <input className="cin" type={type} value={val} placeholder={ph} aria-label={ph || n} onChange={e => set(e.target.value)} />
  const rowsOf = (kd: 'group' | 'unit' | 'trainer') => db.cat.filter(c => c.kind === kd)
  const startEdit = (id: string, v: Record<string, string>) => { setEdit(id); setEv(v) }
  const act = (id: string, sys?: boolean, onSave?: () => void) => sys ? <span className="pill draft plain">Hệ thống</span> : edit === id
    ? <><button type="button" className="btn sm primary" onClick={onSave}><Ic n="check" /> Lưu</button><button type="button" className="btn sm ghost" onClick={() => setEdit(null)}>Huỷ</button></>
    : <><button type="button" className="btn sm ghost" aria-label="Sửa" onClick={() => { const c = db.cat.find(x => x.id === id); const s = catOf(P.cat, 'subject').find(x => x.id === id)
      startEdit(id, c ? { name: c.name, color: c.color ?? '', type: c.info.type ?? '', org: c.info.org ?? '', field: c.info.field ?? '' } : { name: s?.name ?? '' }) }}><Ic n="edit" /></button>
      <button type="button" className="btn sm ghost" aria-label="Xoá" onClick={() => { if (kind === 'subject') { const s = catOf(P.cat, 'subject').find(x => x.id === id); const n = db.progs.filter(p => k.subjectsOf(p).includes(s?.code ?? '')).length
        if (n) return P.setMsg(`Môn đang dùng trong ${n} chương trình — gỡ khỏi chương trình trước khi xoá`); if (!s?.owner_org_id) return P.setMsg('Môn trong danh mục chung của hệ thống — không xoá ở đây') } setAsk(id) }}><Ic n="trash" /></button></>
  type Row = { key: string; cells: ReactNode[]; act: ReactNode }
  const R = (key: string, cells: ReactNode[], a: ReactNode): Row => ({ key, cells, act: a })
  let head: string[] = [], rows: Row[] = [], add: ReactNode = null
  if (kind === 'group') { head = ['Mã', 'Tên nhóm', 'Màu', 'Đang dùng']
    rows = [...rowsOf('group').map(g => { const ed = edit === g.id
      return R(g.id, [<code>{g.code}</code>, ed ? inp('name', ev.name, v => setEv({ ...ev, name: v })) : <><span className="dotc" style={cssVar(g.color)} /><b>{g.name}</b></>, ed ? inp('color', ev.color, v => setEv({ ...ev, color: v }), '', 'color') : <code>{g.color}</code>,
        `${progsOf(p => p.group_code === g.code)} chương trình`], act(g.id, false, () => P.run(supabase.from('ph2_catalog').update({ name: ev.name, color: ev.color }).eq('id', g.id), '✓ Đã lưu').then(() => setEdit(null)))) }),
      R('CXN', [<code>CXN</code>, <><span className="dotc" style={cssVar(CXN.color)} /><b>{CXN.name}</b></>, <code>{CXN.color}</code>, `${progsOf(p => !p.group_code || !k.groups().some(g => g.code === p.group_code))} chương trình`], act('CXN', true))]
    add = <>{inp('code', nw.code ?? '', v => setNw({ ...nw, code: v }), 'Mã, VD: STEM-AI')}{inp('name', nw.name ?? '', v => setNw({ ...nw, name: v }), 'Tên nhóm chương trình')}{inp('color', nw.color ?? '#e08a0b', v => setNw({ ...nw, color: v }), '', 'color')}</> }
  if (kind === 'subject') { head = ['Mã', 'Môn học', 'Chương trình tập huấn', 'Học viên theo môn']
    rows = catOf(P.cat, 'subject').map(s => { const ed = edit === s.id
      return R(s.id, [<code>{s.code}</code>, ed ? inp('name', ev.name, v => setEv({ ...ev, name: v })) : <><span className="sglyph"><svg viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: SGLYPH[s.code] ?? SGLYPH.khtn }} /></span><b>{s.name}</b></>,
        `${progsOf(p => k.subjectsOf(p).includes(s.code))}`, `${db.teachers.filter(t => t.subj === s.code).length}`],
        s.owner_org_id ? act(s.id, false, () => P.run(supabase.from('curriculum_catalog').update({ name: ev.name }).eq('id', s.id), '✓ Đã lưu').then(() => { setEdit(null); P.reloadCat() })) : <span className="pill draft plain">Dùng chung</span>) })
    add = <>{inp('code', nw.code ?? '', v => setNw({ ...nw, code: v }), 'Mã, VD: my_thuat')}{inp('name', nw.name ?? '', v => setNw({ ...nw, name: v }), 'Tên môn học')}</> }
  if (kind === 'format') { head = ['Mã', 'Hình thức', 'Ghi chú', 'Đang dùng']
    rows = (Object.entries(TFORMAT) as [Format, string][]).map(([c, n]) => R(c, [<code>{c}</code>, <b>{n}</b>, { off: 'Học tại hội trường, điểm danh tại chỗ', on: 'Qua lớp học ảo, điểm danh tự động', mix: 'Xen kẽ trực tiếp và trực tuyến' }[c], `${progsOf(p => p.format === c)} chương trình`], act(c, true))) }
  if (kind === 'unit') { head = ['', 'Đơn vị', 'Loại', 'Đang dùng']
    rows = rowsOf('unit').map((u, i) => { const ed = edit === u.id; const n = progsOf(p => p.issuer === u.name) + db.plans.filter(x => x.unit === u.name).length
      return R(u.id, [i + 1, ed ? inp('name', ev.name, v => setEv({ ...ev, name: v })) : <b>{u.name}</b>, ed ? inp('type', ev.type, v => setEv({ ...ev, type: v })) : u.info.type, `${n} chương trình/kế hoạch`],
        act(u.id, false, () => P.run(supabase.from('ph2_catalog').update({ name: ev.name, info: { type: ev.type } }).eq('id', u.id), '✓ Đã lưu').then(() => setEdit(null)))) })
    add = <>{inp('name', nw.name ?? '', v => setNw({ ...nw, name: v }), 'Tên đơn vị')}{inp('type', nw.type ?? '', v => setNw({ ...nw, type: v }), 'Loại, VD: Trường THCS')}</> }
  if (kind === 'trainer') { head = ['', 'Giảng viên', 'Đơn vị', 'Chuyên môn', 'Buổi phụ trách']
    rows = rowsOf('trainer').map((r, i) => { const ed = edit === r.id; const n = db.sess.filter(s => s.trainer === r.name).length
      return R(r.id, [i + 1, ed ? inp('name', ev.name, v => setEv({ ...ev, name: v })) : <b>{r.name}</b>, ed ? inp('org', ev.org, v => setEv({ ...ev, org: v })) : r.info.org, ed ? inp('field', ev.field, v => setEv({ ...ev, field: v })) : r.info.field, `${n}`],
        act(r.id, false, () => P.run(supabase.from('ph2_catalog').update({ name: ev.name, info: { org: ev.org, field: ev.field } }).eq('id', r.id), '✓ Đã lưu').then(() => setEdit(null)))) })
    add = <>{inp('name', nw.name ?? '', v => setNw({ ...nw, name: v }), 'Họ tên, học hàm/học vị')}{inp('org', nw.org ?? '', v => setNw({ ...nw, org: v }), 'Đơn vị công tác')}{inp('field', nw.field ?? '', v => setNw({ ...nw, field: v }), 'Chuyên môn')}</> }
  async function doAdd() {
    const nm = (nw.name ?? '').trim(); if (!nm) return P.setMsg('Nhập tên'); if (!orgId) return
    if (kind === 'group') { const code = (nw.code ?? '').trim().toUpperCase(); if (!code || code === 'CXN' || k.groups().some(g => g.code === code)) return P.setMsg('Mã trống hoặc đã có')
      await P.run(supabase.from('ph2_catalog').insert({ owner_org_id: orgId, kind: 'group', code, name: nm, color: nw.color, sort: k.groups().length + 1 }), '✓ Đã thêm vào danh mục') }
    if (kind === 'subject') { const code = slug(nw.code || nm); if (!code || catOf(P.cat, 'subject').some(s => s.code === code)) return P.setMsg('Mã trống hoặc đã có')
      if (await P.run(supabase.from('curriculum_catalog').insert({ owner_org_id: orgId, kind: 'subject', code, name: nm, sort: 900 }), '✓ Đã thêm vào danh mục')) P.reloadCat() }
    if (kind === 'unit') await P.run(supabase.from('ph2_catalog').insert({ owner_org_id: orgId, kind: 'unit', name: nm, info: { type: nw.type || 'Đơn vị' } }), '✓ Đã thêm vào danh mục')
    if (kind === 'trainer') await P.run(supabase.from('ph2_catalog').insert({ owner_org_id: orgId, kind: 'trainer', name: nm, info: { org: nw.org ?? '', field: nw.field ?? '' } }), '✓ Đã thêm vào danh mục')
    setNw({ color: '#e08a0b' })
  }
  async function doDel(id: string) {
    if (kind === 'subject') { if (await P.run(supabase.from('curriculum_catalog').delete().eq('id', id), '✓ Đã xoá')) P.reloadCat() }
    else { const c = db.cat.find(x => x.id === id); if (kind === 'group' && c) await supabase.from('ph2_programs').update({ group_code: null }).eq('group_code', c.code!)
      await P.run(supabase.from('ph2_catalog').delete().eq('id', id), '✓ Đã xoá') }
    setAsk(null)
  }
  const askText = ask ? (kind === 'group' ? `Xoá nhóm “${db.cat.find(x => x.id === ask)?.name}”? ${progsOf(p => p.group_code === db.cat.find(x => x.id === ask)?.code)} chương trình sẽ chuyển về “Chưa xếp nhóm”.`
    : kind === 'subject' ? `Xoá môn “${catOf(P.cat, 'subject').find(x => x.id === ask)?.name}”?` : kind === 'unit' ? 'Xoá đơn vị này?' : 'Xoá giảng viên này? Các buổi đã phân công vẫn giữ tên.') : ''
  return <>
    <div className="toolbar"><Seg label="Loại danh mục" items={[['group', 'Nhóm chương trình'], ['subject', 'Môn học'], ['format', 'Hình thức'], ['unit', 'Đơn vị đào tạo'], ['trainer', 'Giảng viên']]} value={kind} onChange={v => { setKind(v); setEdit(null); setAsk(null); setNw({ color: '#e08a0b' }) }} />
      <span className="sub">Danh mục dùng chung cho chương trình, kế hoạch tập huấn và đánh giá.</span></div>
    {ask && <Confirm danger text={askText} yes="Xoá" onYes={() => doDel(ask)} onNo={() => setAsk(null)} />}
    <div className="panel" style={{ padding: 0 }}><div className="tblwrap"><table className="cattbl"><thead><tr>{head.map(h => <th key={h}>{h}</th>)}<th /></tr></thead><tbody>
      {rows.map(r => <tr key={r.key} className={edit === r.key ? 'editing' : ''}>{r.cells.map((c, i) => <td key={i} className={i === 0 ? 'n' : ''}>{c}</td>)}
        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{P.canManage ? r.act : null}</td></tr>)}</tbody></table></div>
      {add && P.canManage ? <div className="catadd"><Ic n="plus" />{add}<button type="button" className="btn sm primary" onClick={doAdd}>Thêm</button></div>
        : kind === 'format' ? <p className="note" style={{ margin: 12 }}>Hình thức là danh mục hệ thống, gắn với cách điểm danh và lớp học ảo — chỉ đổi được khi nâng cấp hệ thống.</p> : null}</div>
  </>
}

// ---------- Chi tiết ----------
function TpDetail({ P, k, p, tab, setTab, itemSel, setItemSel, orgId, onBack, openMat }: { P: P2; k: K; p: Prog; tab: 'overview' | 'setup' | 'assess'; setTab: (t: 'overview' | 'setup' | 'assess') => void
  itemSel: string | null; setItemSel: (v: string | null) => void; orgId: string | null; onBack: () => void; openMat: (mid: string) => void }) {
  const [ask, setAsk] = useState(false)
  const [shut, setShut] = useState<Set<string>>(new Set())
  const g = k.groupOf(p.group_code); const ms = k.allMods(p); const plans = k.plansOf(p.id); const subj = k.subjectsOf(p)
  const can = P.canManage
  return <>
    <button type="button" className="btn sm ghost" onClick={onBack}><Ic n="back" /> Danh sách chương trình</button>
    <div className="dhead"><span className="code" style={cssVar(g.color)}>{p.code}</span><div><h1>{p.name}</h1><span className="crumb">{g.name} · {TFORMAT[p.format]} · {fmtM(p.mpp)}/buổi · {p.issuer}</span></div><StatusPill s={p.status} />
      {can && <div className="act">{p.status !== 'published' ? <button type="button" className="btn primary" onClick={() => { if (!ms.length && !subj.length) return P.setMsg('Chưa có môn học / mô-đun nào')
        P.run(supabase.from('ph2_programs').update({ status: 'published', releases: [{ no: (p.releases[0]?.no ?? 0) + 1, date: vn(k.T), by: 'KDI Education', note: p.releases.length ? 'Phát hành lại' : 'Bản đầu tiên', mods: ms.length }, ...p.releases] }).eq('id', p.id), '✓ Đã phát hành — dùng được để lập kế hoạch tập huấn') }}><Ic n="send" /> Phát hành</button>
        : <button type="button" className="btn" onClick={() => P.run(supabase.from('ph2_programs').update({ status: 'archived' }).eq('id', p.id), '✓ Đã chuyển sang Ngừng dùng')}>Ngừng dùng</button>}
        <button type="button" className="btn danger" onClick={() => setAsk(true)}><Ic n="trash" /> Xoá</button></div>}</div>
    {ask && <Confirm danger text={`Xoá chương trình “${p.name}”?${plans.length ? ` Đang có ${plans.length} kế hoạch tập huấn dùng chương trình này — sẽ bị xoá cùng.` : ''}`} yes="Xoá"
      onYes={async () => { if (await P.run(supabase.from('ph2_programs').delete().eq('id', p.id), '✓ Đã xoá chương trình')) onBack() }} onNo={() => setAsk(false)} />}
    <div className="tabs"><button type="button" className={tab === 'overview' ? 'on' : ''} onClick={() => setTab('overview')}>Tổng quan</button>{can && <button type="button" className={tab === 'setup' ? 'on' : ''} onClick={() => setTab('setup')}>Thiết lập</button>}
      <button type="button" className={tab === 'assess' ? 'on' : ''} onClick={() => setTab('assess')}>Khung đánh giá <small>{p.items.length}</small></button></div>
    {tab === 'setup' ? <TpForm P={P} k={k} p={p} orgId={orgId} onDone={() => setTab('overview')} />
      : tab === 'assess' ? <TpAssess P={P} k={k} p={p} sel={itemSel} setSel={setItemSel} />
      : <>
        <div className="stats"><StatCard c="c-blue" icon="book" label="Môn học" value={subj.length} sub={subj.map(k.SUBJ).join(', ') || '—'} />
          <StatCard c="c-violet" icon="list" label="Mô-đun" value={ms.length} sub={k.progS(p) + ' buổi (theo tổng thời lượng)'} />
          <StatCard c="c-green" icon="clock" label="Thời lượng" value={k.progH(p) + ' giờ'} sub={fmtM(p.mpp) + ' mỗi buổi'} />
          <StatCard c="c-amber" icon="calendar" label="Kế hoạch" value={plans.length} sub={plans.reduce((a, x) => a + k.traineesOf(x.id).length, 0) + ' lượt học viên'} /></div>
        <div className="ovgrid"><Panel icon="info" title="Thông tin chương trình">
          <dl className="kv"><div><dt>Nhóm chương trình</dt><dd>{g.code === 'CXN' ? <span className="pill draft plain">Chưa xếp nhóm</span> : g.name}</dd></div><div><dt>Hình thức</dt><dd>{TFORMAT[p.format]}</dd></div>
            <div><dt>Thời lượng buổi</dt><dd>{fmtM(p.mpp)}</dd></div><div><dt>Đơn vị đào tạo</dt><dd>{p.issuer || '—'}</dd></div>
            <div><dt>Đối tượng</dt><dd>{p.audience?.levels?.map(l => <span key={l} className="chip">{LVLS.find(x => x[0] === l)?.[1] ?? l}</span>)}{!p.audience?.levels?.length && '—'}{p.audience?.note && <><br /><small className="sub">{p.audience.note}</small></>}</dd></div>
            <div className="wide"><dt>Môn học</dt><dd><div className="subjinfo">{subj.map(s => <span key={s} className="sji"><svg viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: SGLYPH[s] ?? SGLYPH.khtn }} /><b>{k.SUBJ(s)}</b>
              <small>{k.subjH(p, s)} giờ · {k.subjMods(p, s).length ? k.subjMods(p, s).length + ' mô-đun' : 'chưa chia mô-đun'} · {sessOf(k.subjH(p, s), p.mpp)} buổi</small></span>)}{!subj.length && <span className="sub">Chưa chọn môn</span>}</div>
              <small className="sub">Tổng {subj.length} môn · {k.progH(p)} giờ · {k.progS(p)} buổi ({fmtM(p.mpp)}/buổi)</small></dd></div>
            <div className="wide"><dt>Mục tiêu</dt><dd>{p.goal || '—'}</dd></div></dl>
          <p className="outcomes" style={{ margin: 0 }}>{p.summary}</p></Panel>
          <Panel icon="award" title="Khung đánh giá" act={<button type="button" className="btn sm ghost" onClick={() => setTab('assess')}>Chi tiết ›</button>}>
            {p.items.length ? <ul className="itlist">{p.items.map(i => <li key={i.id}><span className="ikic"><Ic n={IKIND[i.kind]?.[1] ?? 'file'} /></span><span><b>{i.name}</b>
              <small>{IKIND[i.kind]?.[0]} · {i.mode === 'rubric' ? 'rubric ' + i.rubric.length + ' tiêu chí' : 'điểm số'} · {i.mod ? k.mod(i.mod)?.title ?? '' : 'cả chương trình'}</small></span><em>{i.w}%</em></li>)}</ul> : <Empty>Chưa có đầu điểm.</Empty>}
            <ul className="crit"><li>Chuyên cần ≥ <b>{p.criteria.att}%</b> số buổi</li><li>Điểm tổng ≥ <b>{p.criteria.score}</b>/10</li><li>{p.criteria.req ? <>Không tiêu chí <b>bắt buộc</b> nào ở mức Chưa đạt</> : 'Không xét tiêu chí bắt buộc'}</li></ul>
            <small className="sub">Đủ điều kiện → cấp “{p.cert}”.</small></Panel></div>
        <Panel icon="list" title={<>Danh sách mô-đun <small className="sub">Môn học › Mô-đun</small></>} act={<button type="button" className="btn sm ghost" onClick={() => setShut(subj.every(s => shut.has(s)) ? new Set() : new Set(subj))}>{subj.every(s => shut.has(s)) ? 'Mở tất cả' : 'Thu gọn tất cả'}</button>}>
          {subj.length ? subj.map(s => { const sm = k.subjMods(p, s)
            return <details key={s} className="subjblock" open={!shut.has(s)} onToggle={e => { const o = (e.currentTarget as HTMLDetailsElement).open; setShut(x => { const n = new Set(x); if (o) n.delete(s); else n.add(s); return n }) }}>
              <summary className="subjhead"><span className="chev"><Ic n="chev" /></span><b>{k.SUBJ(s)}</b><small>{k.subjH(p, s)} giờ · {sm.length} mô-đun · {sm.filter(m => k.matSt(m).s === 'ok').length} đủ học liệu</small></summary>
              <div className="tblwrap"><table><thead><tr><th>STT</th><th>Mô-đun</th><th>Số buổi</th><th>Số giờ</th><th>Học liệu chính</th></tr></thead><tbody>
                {sm.map((m, i) => <tr key={m.id}><td className="n">{i + 1}</td><td><b>{m.title}</b></td><td>{m.sessions}</td><td>{Number(m.hours)}</td><td><button type="button" className="matbtn" title="Mở học liệu mô-đun" onClick={() => openMat(m.id)}><MatPill k={k} m={m} /></button></td></tr>)}
                {!sm.length && <tr><td colSpan={5} className="sub">Chưa có mô-đun.</td></tr>}</tbody></table></div></details> }) : <Empty>Chưa chọn môn học — vào Thiết lập để chọn môn.</Empty>}</Panel>
        <Panel icon="target" title="Yêu cầu cần đạt">{p.outcomes ? <ol className="olist">{lines(p.outcomes).map((x, i) => <li key={i}>{x}</li>)}</ol> : <Empty>Chưa nhập — vào Thiết lập.</Empty>}</Panel>
        <Panel icon="history" title="Phiên bản phát hành">{p.releases.length ? <div className="tblwrap"><table><thead><tr><th>Bản</th><th>Ngày</th><th>Người phát hành</th><th>Ghi chú</th><th>Mô-đun</th></tr></thead>
          <tbody>{p.releases.map(r => <tr key={r.no}><td><b>Bản {r.no}</b></td><td>{r.date}</td><td>{r.by}</td><td>{r.note}</td><td>{r.mods}</td></tr>)}</tbody></table></div> : <Empty>Chưa phát hành lần nào.</Empty>}</Panel>
      </>}
  </>
}
export function MatPill({ k, m }: { k: K; m: Parameters<K['matSt']>[0] }) {
  const s = k.matSt(m)
  return s.s === 'ok' ? <span className="pill good plain" title={`PB ${s.v}`}>Đủ</span> : s.s === 'draft' ? <span className="pill warn plain" title={`PB ${s.v}`}>Đang soạn</span> : <span className="pill draft plain">Chưa có</span>
}

// ---------- Thiết lập (tạo mới / sửa) ----------
type MV = { id?: string; title: string; hours: number }
type V = { name: string; code: string; group: string; subj: string[]; mods: Record<string, MV[]>; hours: Record<string, number>; format: Format; mpp: number; summary: string; outcomes: string; goal: string; levels: string[]; aud: string; issuer: string }
function TpForm({ P, k, p, orgId, onDone }: { P: P2; k: K; p: Prog | null; orgId: string | null; onDone: (id?: string) => void }) {
  const [v, setV] = useState<V>(() => p ? { name: p.name, code: p.code ?? '', group: p.group_code ?? 'CXN', subj: k.subjectsOf(p), mods: Object.fromEntries(k.subjectsOf(p).map(s => [s, k.subjMods(p, s).map(m => ({ id: m.id, title: m.title, hours: Number(m.hours) }))])),
    hours: Object.fromEntries(k.subjectsOf(p).map(s => [s, k.subjH(p, s)])), format: p.format, mpp: p.mpp, summary: p.summary ?? '', outcomes: p.outcomes ?? '', goal: p.goal ?? '', levels: [...(p.audience?.levels ?? [])], aud: p.audience?.note ?? '', issuer: p.issuer ?? '' }
    : { name: '', code: '', group: 'CXN', subj: [], mods: {}, hours: {}, format: 'off', mpp: 180, summary: '', outcomes: '', goal: '', levels: [], aud: '', issuer: k.orgName(orgId) || 'KDI Education' })
  const [mdOpen, setMdOpen] = useState<Set<string>>(new Set())
  const [sq, setSq] = useState(''); const [sdd, setSdd] = useState(false)
  const [nm, setNm] = useState<Record<string, { t: string; h: number }>>({})
  const [busy, setBusy] = useState(false)
  const sqRef = useRef<HTMLInputElement>(null)
  const set = (x: Partial<V>) => setV({ ...v, ...x })
  const groups = k.groups(); const units = P.db!.cat.filter(c => c.kind === 'unit')
  const subjCat = catOf(P.cat, 'subject')
  const tot = v.subj.reduce((a, s) => a + (+v.hours[s] || 0), 0)
  const miss = [!v.name.trim() && 'tên chương trình', !v.subj.length && 'môn học'].filter(Boolean)
  const prev = { ...(p ?? {}), id: '_', code: v.code || 'MÃ', name: v.name || 'Tên chương trình…', summary: v.summary || 'Mô tả ngắn sẽ hiện ở đây.', format: v.format, group_code: v.group === 'CXN' ? null : v.group, status: p?.status ?? 'draft',
    _subj: v.subj, _mods: v.subj.reduce((a, s) => a + (v.mods[s] ?? []).filter(x => x.title.trim()).length, 0), _h: tot } as Prog & { _subj: string[]; _mods: number; _h: number }
  const t = norm(sq); const hits = subjCat.filter(s => !v.subj.includes(s.code) && (!t || norm(s.name).includes(t))).slice(0, 8); const exact = subjCat.some(s => norm(s.name) === t)
  async function addSubj(code: string | null, name?: string) {
    let c = code
    if (!c && name) { c = slug(name) || 'mon_' + Date.now(); if (!subjCat.some(s => s.code === c) && orgId) { const { error } = await supabase.from('curriculum_catalog').insert({ owner_org_id: orgId, kind: 'subject', code: c, name, sort: 900 })
      if (error) return P.setMsg('Không tạo được môn mới: ' + error.message); P.reloadCat(); P.setMsg(`✓ Đã tạo môn “${name}” và thêm vào danh mục`) } }
    if (c && !v.subj.includes(c)) set({ subj: [...v.subj, c], hours: { ...v.hours, [c]: v.hours[c] ?? 3 }, mods: { ...v.mods, [c]: v.mods[c] ?? [] } })
    setSq(''); sqRef.current?.focus()
  }
  async function save() {
    if (!v.name.trim()) return P.setMsg('Nhập tên chương trình'); if (!v.subj.length) return P.setMsg('Chọn ít nhất một môn học'); if (!orgId) return
    setBusy(true)
    const row = { name: v.name.trim(), code: v.code || null, group_code: v.group === 'CXN' ? null : v.group, format: v.format, mpp: v.mpp || 180, issuer: v.issuer, summary: v.summary, outcomes: v.outcomes, goal: v.goal,
      audience: { levels: v.levels, note: v.aud }, subjects: v.subj, subj_hours: Object.fromEntries(v.subj.map(s => [s, +v.hours[s] || 0])) }
    let pid = p?.id
    if (p) { const { error } = await supabase.from('ph2_programs').update(row).eq('id', p.id); if (error) { setBusy(false); return P.setMsg(error.message) } }
    else { const { data, error } = await supabase.from('ph2_programs').insert({ ...row, owner_org_id: orgId, status: 'draft', cert: `Chứng nhận hoàn thành “${v.name.trim()}”` }).select('id').single()
      if (error) { setBusy(false); return P.setMsg(error.message) } pid = (data as { id: string }).id }
    // Mô-đun: giữ theo id, thêm mới, bỏ mô-đun đã xoá
    const keep = new Set<string>(); const ins: object[] = []
    for (const s of v.subj) for (const [i, x] of (v.mods[s] ?? []).filter(x => x.title.trim()).entries()) {
      const r = { subject: s, seq: i + 1, title: x.title.trim(), hours: +x.hours || 1, sessions: sessOf(+x.hours || 1, v.mpp) }
      if (x.id) { keep.add(x.id); await supabase.from('ph2_modules').update(r).eq('id', x.id) } else ins.push({ ...r, program_id: pid })
    }
    if (p) { const del = k.modsOf(p.id).filter(m => !keep.has(m.id)).map(m => m.id); if (del.length) await supabase.from('ph2_modules').delete().in('id', del) }
    if (ins.length) await supabase.from('ph2_modules').insert(ins)
    setBusy(false); await P.reload(); P.setMsg(p ? '✓ Đã lưu chương trình' : `✓ Đã tạo chương trình nháp với ${ins.length} mô-đun`); onDone(pid)
  }
  const sec = (icon: string, title: string, hint: string, body: ReactNode) => <section className="fsec"><header><span className="fsi"><Ic n={icon} /></span><div><b>{title}</b><small>{hint}</small></div></header>{body}</section>
  const fIc: Record<string, string> = { off: 'users', on: 'video', mix: 'refresh' }; const fSub: Record<string, string> = { off: 'Học tại hội trường', on: 'Qua lớp học ảo', mix: 'Xen kẽ hai hình thức' }
  return <div className="tfwrap"><div className="tfmain">
    {sec('info', 'Thông tin chung', 'Tên, mã và cách tổ chức tập huấn', <>
      <input className="bigin" value={v.name} onChange={e => set({ name: e.target.value })} placeholder="Tên chương trình, VD: Dạy học STEM cơ bản" aria-label="Tên chương trình" />
      <div className="frow"><label className="fld"><span>Mã chương trình</span><input value={v.code} onChange={e => set({ code: e.target.value })} placeholder="VD: STEM-CB1" /></label>
        <label className="fld"><span>Đơn vị đào tạo</span><input list="p2-units" value={v.issuer} onChange={e => set({ issuer: e.target.value })} /><datalist id="p2-units">{units.map(u => <option key={u.id} value={u.name} />)}</datalist></label></div>
      <div className="fld"><span>Nhóm chương trình</span><div className="gpick">{[...groups.map(x => ({ code: x.code!, name: x.name, color: x.color ?? '#64748b' })), CXN].map(x =>
        <button type="button" key={x.code} className={'gopt' + (v.group === x.code ? ' on' : '')} style={cssVar(x.color)} onClick={() => set({ group: x.code })}><i />{x.name}</button>)}</div></div>
      <div className="fld"><span>Hình thức tổ chức</span><div className="fpick">{(Object.entries(TFORMAT) as [Format, string][]).map(([kk, n]) =>
        <button type="button" key={kk} className={'fopt' + (v.format === kk ? ' on' : '')} onClick={() => set({ format: kk })}><Ic n={fIc[kk]} /><b>{n}</b><small>{fSub[kk]}</small></button>)}</div></div>
      <div className="fld"><span>Thời lượng mỗi buổi</span><div className="mpick"><label className="unit"><input type="number" min={0} max={12} value={Math.floor(v.mpp / 60)} aria-label="Số giờ mỗi buổi" onChange={e => set({ mpp: (+e.target.value || 0) * 60 + v.mpp % 60 || 180 })} /><em>giờ</em></label>
        <label className="unit"><input type="number" min={0} max={59} step={5} value={v.mpp % 60} aria-label="Số phút mỗi buổi" onChange={e => set({ mpp: Math.floor(v.mpp / 60) * 60 + (+e.target.value || 0) || 180 })} /><em>phút</em></label></div></div></>)}
    {sec('book', 'Môn học & thời lượng', 'Học viên tập huấn theo môn — không chia cấp, khối, lớp. Mô-đun có thể bổ sung sau', <>
      <div className="scombo"><span className="scq"><Ic n="search" /><input ref={sqRef} value={sq} autoComplete="off" placeholder="Tìm môn để thêm, hoặc gõ tên môn mới…" aria-label="Thêm môn học" role="combobox" aria-expanded={sdd}
        onFocus={() => setSdd(true)} onBlur={() => setTimeout(() => setSdd(false), 150)} onChange={e => { setSq(e.target.value); setSdd(true) }}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (hits[0]) addSubj(hits[0].code); else if (sq.trim() && !exact) addSubj(null, sq.trim()) } if (e.key === 'Escape') (e.target as HTMLInputElement).blur() }} /></span>
        {sdd && <div className="sdd">{hits.map(s => <button type="button" key={s.code} onMouseDown={e => { e.preventDefault(); addSubj(s.code) }}><svg viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: SGLYPH[s.code] ?? SGLYPH.khtn }} />{s.name}</button>)}
          {sq.trim() && !exact && <button type="button" className="new" onMouseDown={e => { e.preventDefault(); addSubj(null, sq.trim()) }}><Ic n="plus" /> Tạo môn mới “{sq.trim()}”</button>}
          {!hits.length && !sq.trim() && <small className="sub">Đã chọn hết môn trong danh mục — gõ tên để tạo môn mới.</small>}</div>}</div>
      {v.subj.length ? <div className="slist"><div className="slh"><span>Môn học</span><span>Thời lượng</span><span>Mô-đun</span><span /></div>
        {v.subj.map(s => { const ms = v.mods[s] ?? []; const h = v.hours[s] ?? 3; const mh = ms.reduce((a, x) => a + (+x.hours || 0), 0); const op = mdOpen.has(s)
          const setMods = (x: MV[]) => set({ mods: { ...v.mods, [s]: x } }); const nn = nm[s] ?? { t: '', h: Math.max(0.5, h - mh) || 3 }
          const addMod = () => { if (!nn.t.trim()) return P.setMsg('Nhập tên mô-đun'); setMods([...ms, { title: nn.t.trim(), hours: nn.h || 3 }]); setNm({ ...nm, [s]: { t: '', h: 3 } }) }
          return <div key={s} className={'sli' + (op ? ' open' : '')}><div className="slr"><span className="sn"><svg viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: SGLYPH[s] ?? SGLYPH.khtn }} /><b>{k.SUBJ(s)}</b></span>
            <span className="sh"><label className="unit"><input type="number" min={0.5} step={0.5} value={h} aria-label={`Thời lượng ${k.SUBJ(s)}`} onChange={e => set({ hours: { ...v.hours, [s]: +e.target.value || 0 } })} /><em>giờ</em></label></span>
            <button type="button" className="mdtog" aria-expanded={op} onClick={() => setMdOpen(x => { const n = new Set(x); if (op) n.delete(s); else n.add(s); return n })}>
              {ms.length ? <>{ms.length} mô-đun{mh !== +h && <> <i className={mh > h ? 'over' : ''}>{mh}/{h} giờ</i></>}</> : <span className="sub">+ Thêm mô-đun</span>}<Ic n="chev" /></button>
            <button type="button" className="btn sm ghost" aria-label={`Bỏ môn ${k.SUBJ(s)}`} onClick={() => set({ subj: v.subj.filter(x => x !== s) })}>✕</button></div>
            {op && <div className="mdin">{ms.map((x, i) => <div key={i} className="mdrow"><span className="n">{i + 1}</span><input value={x.title} placeholder="Tên mô-đun" aria-label="Tên mô-đun" onChange={e => setMods(ms.map((y, j) => j === i ? { ...y, title: e.target.value } : y))} />
              <label className="unit"><input type="number" min={0.5} step={0.5} value={x.hours} aria-label="Số giờ" onChange={e => setMods(ms.map((y, j) => j === i ? { ...y, hours: +e.target.value || 0 } : y))} /><em>giờ</em></label>
              <button type="button" className="btn sm ghost" aria-label="Xoá mô-đun" onClick={() => setMods(ms.filter((_, j) => j !== i))}><Ic n="trash" /></button></div>)}
              <div className="mdrow add"><span className="n"><Ic n="plus" /></span><input value={nn.t} placeholder={`Thêm mô-đun cho ${k.SUBJ(s)}…`} aria-label="Tên mô-đun mới" onChange={e => setNm({ ...nm, [s]: { ...nn, t: e.target.value } })} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addMod() } }} />
                <label className="unit"><input type="number" min={0.5} step={0.5} value={nn.h} aria-label="Số giờ" onChange={e => setNm({ ...nm, [s]: { ...nn, h: +e.target.value || 0 } })} /><em>giờ</em></label><button type="button" className="btn sm" onClick={addMod}>Thêm</button></div></div>}</div> })}
        <div className="slf"><span>{v.subj.length} môn</span><b>Tổng {tot} giờ ÷ {fmtM(v.mpp)} = {sessOf(tot, v.mpp)} buổi</b></div></div>
        : <Empty>Chưa có môn nào — tìm và thêm môn ở ô phía trên.</Empty>}</>)}
    {sec('target', 'Mục tiêu, đối tượng & yêu cầu cần đạt', 'Hiện ở trang Tổng quan · khung đánh giá thiết lập ở tab Khung đánh giá', <>
      <label className="fld"><span>Mục tiêu</span><textarea rows={2} value={v.goal} onChange={e => set({ goal: e.target.value })} placeholder="Giáo viên thiết kế và tổ chức được…" /></label>
      <div className="fld"><span>Đối tượng</span><div className="mpick">{LVLS.map(([kk, n]) => <button type="button" key={kk} className={'chipbtn' + (v.levels.includes(kk) ? ' on' : '')} onClick={() => set({ levels: v.levels.includes(kk) ? v.levels.filter(x => x !== kk) : [...v.levels, kk] })}>{n}</button>)}</div>
        <input value={v.aud} onChange={e => set({ aud: e.target.value })} placeholder="VD: Giáo viên dạy KHTN, Toán, Công nghệ" aria-label="Mô tả đối tượng" /></div>
      <label className="fld"><span>Mô tả ngắn</span><textarea rows={2} value={v.summary} onChange={e => set({ summary: e.target.value })} placeholder="Chương trình giúp học viên…" /></label>
      <label className="fld"><span>Yêu cầu cần đạt <em className="sub">— mỗi dòng một yêu cầu</em></span><textarea rows={4} value={v.outcomes} onChange={e => set({ outcomes: e.target.value })} placeholder={'Trình bày được…\nThiết kế được…'} /></label></>)}
  </div>
  <aside className="tfside"><div className="tfstick"><small className="sub">Xem trước thẻ chương trình</small><TpCard k={k} p={prev} preview />
    <div className={'tfcheck' + (miss.length ? ' warn' : '')}>{miss.length ? <><Ic n="alert" /><span>Còn thiếu: <b>{miss.join(', ')}</b></span></> : <><Ic n="check" /><span>Đủ thông tin để lưu</span></>}</div>
    <div className="tfact"><button type="button" className="btn primary" disabled={busy} onClick={save}><Ic n="check" /> {p ? 'Lưu thay đổi' : 'Tạo chương trình (nháp)'}</button><button type="button" className="btn ghost" onClick={() => onDone()}>Huỷ</button></div></div></aside></div>
}

// ---------- Khung đánh giá ----------
function TpAssess({ P, k, p, sel, setSel }: { P: P2; k: K; p: Prog; sel: string | null; setSel: (v: string | null) => void }) {
  const [its, setIts] = useState<Item[]>(p.items)
  const [C, setC] = useState(p.criteria); const [cert, setCert] = useState(p.cert ?? '')
  const [nn, setNn] = useState(''); const [nk, setNk] = useState('quiz')
  useEffect(() => { setIts(p.items); setC(p.criteria); setCert(p.cert ?? '') }, [p.id, p.updated_at])
  const ro = !P.canManage
  const saveItems = (x: Item[]) => { setIts(x); P.run(supabase.from('ph2_programs').update({ items: x }).eq('id', p.id)) }
  const saveC = (x: typeof C) => { setC(x); P.run(supabase.from('ph2_programs').update({ criteria: x }).eq('id', p.id)) }
  const it = its.find(i => i.id === sel) ?? its[0]
  const patch = (id: string, x: Partial<Item>) => saveItems(its.map(i => i.id === id ? { ...i, ...x } : i))
  const patchC = (cid: string, x: Partial<Crit>) => it && patch(it.id, { rubric: it.rubric.map(c => c.id === cid ? { ...c, ...x } : c) })
  const tw = its.reduce((a, i) => a + (+i.w || 0), 0); const mods = k.allMods(p)
  const used = k.plansOf(p.id).filter(x => [...P.db!.grades.values()].some(g => g.plan_id === x.id))
  const newC = (n: string, pts: number): Crit => ({ id: uid('rc'), name: n, pts, comp: 'tk', req: false, desc: ['', '', '', ''] })
  return <>
    <p className="note"><Ic n="info" /> Khung đánh giá định nghĩa một lần cho chương trình; mọi đợt tập huấn tự kế thừa. Giảng viên chấm ở <b>Đánh giá kết quả › Chấm bài</b>.</p>
    {used.length > 0 && <p className="note warnnote"><Ic n="alert" /> {used.length} đợt đã có điểm theo khung này ({used.map(x => x.title.split('–').pop()!.trim()).join(', ')}). Thêm tiêu chí hoặc đầu điểm mới sẽ cần chấm bổ sung cho các đợt đó.</p>}
    <Panel icon="list" title="1. Đầu điểm đánh giá" act={<small className={tw === 100 ? 'sub' : 'badtxt'}>Tổng trọng số <b>{tw}%</b>{tw === 100 ? '' : ' — cần bằng 100%'}</small>}>
      <div className="tblwrap"><table className="ittbl"><thead><tr><th>STT</th><th>Đầu điểm</th><th>Loại</th><th>Gắn với mô-đun</th><th>Cách chấm</th><th className="c">Trọng số</th><th /></tr></thead><tbody>
        {its.map((i, n) => <tr key={i.id} className={it?.id === i.id ? 'cur' : ''}><td className="n">{n + 1}</td>
          <td><input defaultValue={i.name} key={i.name} disabled={ro} aria-label="Tên đầu điểm" onBlur={e => e.target.value !== i.name && patch(i.id, { name: e.target.value })} /></td>
          <td><select value={i.kind} disabled={ro} aria-label="Loại đầu điểm" onChange={e => patch(i.id, { kind: e.target.value, ...(e.target.value === 'demo' ? { mode: 'rubric' as const } : {}) })}>{Object.entries(IKIND).map(([kk, [n2]]) => <option key={kk} value={kk}>{n2}</option>)}</select></td>
          <td><select value={i.mod} disabled={ro} aria-label="Gắn với mô-đun" onChange={e => patch(i.id, { mod: e.target.value })}><option value="">Cả chương trình (cuối khoá)</option>{mods.map(({ s, m }) => <option key={m.id} value={m.id}>{k.SUBJ(s)} · {m.title}</option>)}</select></td>
          <td><div className="seg sm" role="group" aria-label="Cách chấm">{([['score', 'Điểm số'], ['rubric', 'Rubric']] as const).map(([m, n2]) => <button type="button" key={m} disabled={ro} className={i.mode === m ? 'on' : ''}
            onClick={() => { setSel(i.id); patch(i.id, { mode: m, ...(m === 'rubric' && !i.rubric.length ? { rubric: [newC('Tiêu chí 1', 4)] } : {}) }) }}>{n2}</button>)}</div></td>
          <td className="c"><label className="unit"><input type="number" min={0} max={100} defaultValue={i.w} key={i.w} disabled={ro} aria-label="Trọng số" onBlur={e => +e.target.value !== i.w && patch(i.id, { w: Math.max(0, +e.target.value || 0) })} /><em>%</em></label></td>
          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}><button type="button" className={'btn sm' + (it?.id === i.id ? ' primary' : '')} onClick={() => setSel(i.id)}>{i.mode === 'rubric' ? `Rubric · ${i.rubric.length} tiêu chí` : 'Chi tiết'}</button>
            {!ro && <button type="button" className="btn sm ghost" aria-label="Xoá đầu điểm" onClick={() => { saveItems(its.filter(x => x.id !== i.id)); P.setMsg('✓ Đã xoá đầu điểm') }}><Ic n="trash" /></button>}</td></tr>)}
        {!its.length && <tr><td colSpan={7} className="sub">Chưa có đầu điểm — thêm ở dòng dưới.</td></tr>}</tbody></table></div>
      {!ro && <div className="catadd"><Ic n="plus" /><input className="cin" value={nn} onChange={e => setNn(e.target.value)} placeholder="Tên đầu điểm, VD: Kiểm tra cuối khoá" />
        <select className="cin" style={{ flex: 'none', width: 'auto' }} value={nk} onChange={e => setNk(e.target.value)} aria-label="Loại đầu điểm">{Object.entries(IKIND).map(([kk, [n2]]) => <option key={kk} value={kk}>{n2}</option>)}</select>
        <button type="button" className="btn sm primary" onClick={() => { if (!nn.trim()) return P.setMsg('Nhập tên đầu điểm'); const mode = nk === 'quiz' || nk === 'essay' ? 'score' : 'rubric'
          const i: Item = { id: uid('it'), name: nn.trim(), kind: nk, mod: '', mode, w: 0, max: 10, task: '', rubric: mode === 'rubric' ? [newC('Tiêu chí 1', 4)] : [] }; saveItems([...its, i]); setSel(i.id); setNn(''); P.setMsg('✓ Đã thêm đầu điểm — nhớ chỉnh trọng số') }}>Thêm đầu điểm</button></div>}</Panel>
    {it && <Panel icon={IKIND[it.kind]?.[1] ?? 'file'} title={<>2. {it.name} <small className="sub">{IKIND[it.kind]?.[0]} · {it.w}% · {it.mod ? k.mod(it.mod)?.title ?? '' : 'cả chương trình'}</small></>}>
      <label className="fld"><span>Đề bài / yêu cầu cho học viên</span><textarea rows={2} defaultValue={it.task} key={it.id + 't'} disabled={ro} placeholder="Học viên cần làm gì, nộp gì, hạn nộp…" onBlur={e => e.target.value !== it.task && patch(it.id, { task: e.target.value })} /></label>
      {it.mode === 'score' ? <div className="fld"><span>Thang điểm</span><label className="unit"><input type="number" min={1} defaultValue={it.max} key={it.id + 'm'} disabled={ro} aria-label="Thang điểm" onBlur={e => patch(it.id, { max: Math.max(1, +e.target.value || 10) })} /><em>điểm</em></label><small className="sub">Quy về thang 10 khi tính điểm tổng.</small></div>
        : <><div className="rbhead"><b>Rubric chấm</b><small className="sub">{it.rubric.length} tiêu chí · {it.rubric.reduce((a, c) => a + (+c.pts || 0), 0)} điểm · Điểm đầu điểm = Σ điểm theo mức ÷ {it.rubric.reduce((a, c) => a + (+c.pts || 0), 0) || '…'} × 10</small></div>
          <div className="tblwrap"><table className="rbtbl"><thead><tr><th>Tiêu chí</th>{LV.map((l, kk) => <th key={l} className={'lv' + kk}>{l}<small>{LVP[kk] * 100}% điểm</small></th>)}<th /></tr></thead><tbody>
            {it.rubric.map(c => <tr key={c.id}><td className="rbc"><input defaultValue={c.name} key={c.name} disabled={ro} aria-label="Tên tiêu chí" onBlur={e => e.target.value !== c.name && patchC(c.id, { name: e.target.value })} />
              <div className="rbmeta"><label className="unit"><input type="number" min={1} defaultValue={c.pts} key={c.pts} disabled={ro} aria-label="Điểm tối đa" onBlur={e => patchC(c.id, { pts: Math.max(1, +e.target.value || 1) })} /><em>điểm</em></label>
                <select value={c.comp} disabled={ro} aria-label="Năng lực" onChange={e => patchC(c.id, { comp: e.target.value })}>{Object.entries(COMP).map(([kk, n2]) => <option key={kk} value={kk}>{n2}</option>)}</select>
                <label className="rbreq"><input type="checkbox" checked={c.req} disabled={ro} onChange={e => patchC(c.id, { req: e.target.checked })} /> Bắt buộc đạt</label></div></td>
              {LV.map((l, kk) => <td key={l} className={'lv' + kk}><textarea rows={3} defaultValue={c.desc[kk] ?? ''} key={c.id + kk + (c.desc[kk] ?? '')} disabled={ro} aria-label={`Mô tả mức ${l}`} placeholder={`Mô tả mức ${l.toLowerCase()}…`}
                onBlur={e => e.target.value !== (c.desc[kk] ?? '') && patchC(c.id, { desc: c.desc.map((d, j) => j === kk ? e.target.value : d) })} /><small>{+(c.pts * LVP[kk]).toFixed(2)} điểm</small></td>)}
              <td>{!ro && <button type="button" className="btn sm ghost" aria-label="Xoá tiêu chí" onClick={() => patch(it.id, { rubric: it.rubric.filter(x => x.id !== c.id) })}><Ic n="trash" /></button>}</td></tr>)}
            {!it.rubric.length && <tr><td colSpan={6} className="sub">Chưa có tiêu chí.</td></tr>}</tbody></table></div>
          <div className="formact" style={{ justifyContent: 'flex-start' }}>{!ro && <button type="button" className="btn sm" onClick={() => patch(it.id, { rubric: [...it.rubric, newC('Tiêu chí mới', 3)] })}><Ic n="plus" /> Thêm tiêu chí</button>}
            <small className="sub">Tiêu chí “Bắt buộc đạt” ở mức Chưa đạt → học viên chưa hoàn thành chương trình. Mỗi tiêu chí gắn một năng lực để cập nhật hồ sơ năng lực nhà giáo.</small></div></>}</Panel>}
    <Panel icon="award" title="3. Điều kiện hoàn thành & chứng nhận"><div className="crgrid">
      <label className="crt"><span className="crh"><Ic n="check" /> Chuyên cần tối thiểu</span><span className="crv"><input type="number" min={0} max={100} defaultValue={C.att} key={'a' + C.att} disabled={ro} aria-label="Chuyên cần tối thiểu" onBlur={e => saveC({ ...C, att: Math.min(100, Math.max(0, +e.target.value || 0)) })} /><em>%</em></span><small>số buổi có mặt / tổng số buổi</small></label>
      <label className="crt"><span className="crh"><Ic n="target" /> Điểm tổng tối thiểu</span><span className="crv"><input type="number" min={0} max={10} step={0.5} defaultValue={C.score} key={'s' + C.score} disabled={ro} aria-label="Điểm tổng tối thiểu" onBlur={e => saveC({ ...C, score: Math.min(10, Math.max(0, +e.target.value || 0)) })} /><em>/10</em></span><small>trung bình các đầu điểm theo trọng số</small></label>
      <label className="crt"><span className="crh"><Ic n="alert" /> Tiêu chí bắt buộc</span><span className="crv sw"><input type="checkbox" checked={C.req} disabled={ro} onChange={e => saveC({ ...C, req: e.target.checked })} /><i /><b>{C.req ? 'Phải đạt' : 'Không xét'}</b></span><small>{its.flatMap(i => i.rubric).filter(c => c.req).length} tiêu chí rubric đánh dấu “bắt buộc”</small></label></div>
      <label className="fld"><span>Tên chứng nhận</span><span className="certin"><Ic n="award" /><input value={cert} disabled={ro} onChange={e => setCert(e.target.value)} onBlur={() => cert !== p.cert && P.run(supabase.from('ph2_programs').update({ cert }).eq('id', p.id))} /></span></label></Panel>
  </>
}
