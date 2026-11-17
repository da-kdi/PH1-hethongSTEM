import { useEffect, useRef, useState, type ReactNode } from 'react'
import { supabase } from '../../lib/supabase'
import { errMsg, norm } from '../ph1/ui'
import { catOf } from '../ph1/curriculum/api'
import { AsideWrap, CtHead, FRow, Back, Confirm, Empty, Flow, Ic, Mau, PageHead, Panel, Search, Seg, Sel, StatusPill, cssVar, TblWrap } from '../ph1/mau/kit'
import { DataTable } from '../ph1/mau/DataTable'
import { SGLYPH } from '../ph1/mau/icons'
import { CoverDeco } from '../ph1/designs/blocks'
import { COMP, CXN, IKIND, LV, LVLS, LVP, PAGE, TFORMAT, fmtM, goto, lines, sessOf, slug, takeIntent, uid, vn, type Crit, type Format, type Item, type K, type Prog } from './api'
import { useP2, type P2 } from './use'
import { DEF_FRAME, TpCatalog, type Frame } from './TpCatalog'

// 2.1a Chương trình đào tạo — dựng theo bản mẫu giao diện: Danh mục (nhóm, học phần, hình thức, đơn vị, giảng viên) › Chương trình (học phần › chuyên đề; không chia cấp, khối, lớp)
// Chi tiết: Tổng quan · Thiết lập · Khung đánh giá (đầu điểm, rubric, điều kiện hoàn thành & chứng nhận — mọi đợt đào tạo kế thừa).
export function TrainProgs({ orgId, go }: { orgId: string | null; go?: (p: string) => void }) {
  const P = useP2(orgId)
  const [page, setPage] = useState<'cat' | 'list'>('list')
  const [open, setOpen] = useState<string | null>(null)
  const [tab, setTab] = useState<TpTab>('overview')
  const [creating, setCreating] = useState(false)
  const [itemSel, setItemSel] = useState<string | null>(null)
  useEffect(() => { const x = takeIntent(PAGE.tp); if (x?.open) { setOpen(x.open); setTab(x.tab ?? 'overview'); setItemSel(x.item ?? null) } }, [])
  const { k, db } = P
  const msg = P.msg ? <p className={P.msg.startsWith('✓') ? 'okmsg' : 'msg'} role="status" onClick={() => P.setMsg('')}>{P.msg}</p> : null
  if (!k || !db) return <Mau>{msg}<p className="sub">Đang tải…</p></Mau>
  const p = db.progs.find(x => x.id === open)
  if (creating) return <Mau>{msg}<Back onClick={() => setCreating(false)} title="Chương trình mới">Danh sách chương trình</Back>
    <TpForm P={P} k={k} p={null} orgId={orgId} onDone={id => { setCreating(false); if (id) { setOpen(id); setTab('overview') } }} /></Mau>
  if (p) return <Mau>{msg}<TpDetail P={P} k={k} p={p} tab={tab} setTab={setTab} itemSel={itemSel} setItemSel={setItemSel} orgId={orgId}
    onBack={() => { setOpen(null); setTab('overview') }} openMat={mid => goto(go, PAGE.bt, { open: mid })} openPlan={id => goto(go, PAGE.kh, id ? { open: id } : { prog: p.id })} /></Mau>
  const head = <><PageHead icon="book" title="Chương trình đào tạo" sub="Khung chương trình bồi dưỡng nhà giáo theo học phần › chuyên đề; không chia cấp, khối, lớp">
    {P.canManage && <button type="button" className="btn primary" onClick={() => setCreating(true)}><Ic n="plus" /> Chương trình mới</button>}</PageHead>
    <Flow steps={[['cat', 'Danh mục', 'Nhóm, học phần, đơn vị, giảng viên'], ['list', 'Chương trình', `${db.progs.length} chương trình · nội dung & khung đánh giá`]]} value={page} onChange={setPage} /></>
  return <Mau>{msg}{head}{page === 'cat' ? <TpCatalog P={P} k={k} orgId={orgId} /> : <TpList P={P} k={k} progs={db.progs} orgId={orgId} onOpen={id => { setOpen(id); setTab('overview'); scrollTo(0, 0) }} />}</Mau>
}

// ---------- Thẻ chương trình ----------
function TpCard({ k, p, onOpen, preview }: { k: K; p: Prog & { _subj?: string[]; _mods?: number; _h?: number }; onOpen?: () => void; preview?: boolean }) {
  const g = k.groupOf(p.group_code); const subj = p._subj ?? k.subjectsOf(p); const main = subj[0]
  const body = <><div className="cover"><CoverDeco s={main} /><span>{g.code === 'CXN' ? 'Chưa xếp nhóm' : g.code + ' · ' + g.name}</span><b>{p.code || 'MÃ'}</b></div>
    <h3>{p.name}</h3><p className="desc" style={{ margin: 0 }}>{p.summary}</p>
    <div className="chips">{subj.map(s => <span key={s} className="chip k" style={cssVar(g.color)}>{k.SUBJ(s)}</span>)}{!subj.length && <span className="chip">Chưa chọn học phần</span>}<span className="chip">{TFORMAT[p.format]}</span></div>
    <div className="foot"><span>{subj.length} học phần · {p._mods ?? k.allMods(p).length} chuyên đề · {p._h ?? k.progH(p)} giờ</span><StatusPill s={p.status} /></div></>
  return preview ? <div className="pcard dcard tfprev" style={cssVar(g.color)}>{body}</div> : <button type="button" className="pcard dcard" style={cssVar(g.color)} onClick={onOpen}>{body}</button>
}

// Bản mẫu v315 · C6: danh sách dạng bảng dùng chung (mặc định; còn Thẻ), bỏ thẻ số tổng; thao tác hàng loạt Phát hành · Nhân bản · Xoá
function TpList({ P, k, progs, orgId, onOpen }: { P: P2; orgId: string | null; k: K; progs: Prog[]; onOpen: (id: string) => void }) {
  const [f, setF] = useState({ q: '', subj: '', grp: '', status: '' })
  const [mode, setMode] = useState<'grid' | 'table'>(() => { try { return (localStorage.getItem('ph2.tp.mode') as 'grid' | 'table') || 'table' } catch { return 'table' } })
  const qq = norm(f.q)
  const shown = progs.filter(p => (!qq || norm(`${p.code} ${p.name} ${p.summary ?? ''}`).includes(qq)) && (!f.subj || k.subjectsOf(p).includes(f.subj)) && (!f.grp || (p.group_code ?? 'CXN') === f.grp) && (!f.status || p.status === f.status))
  const subjs = Array.from(new Set(progs.flatMap(k.subjectsOf)))
  const can = P.canManage
  return <>
    <DataTable id="tp" rows={shown}
        search={{ value: f.q, onChange: q => setF({ ...f, q }), placeholder: 'Tìm theo mã, tên chương trình…' }}
        filterBox={<><FRow label="Học phần"><Sel label="Tất cả học phần" value={f.subj} onChange={v => setF({ ...f, subj: v })} options={subjs.map(s => [s, k.SUBJ(s)])} /></FRow>
          <FRow label="Nhóm"><Sel label="Tất cả nhóm" value={f.grp} onChange={v => setF({ ...f, grp: v })} options={[...k.groups().map(g => [g.code ?? '', g.name] as [string, string]), [CXN.code, CXN.name]]} /></FRow>
          <FRow label="Trạng thái"><Sel label="Mọi trạng thái" value={f.status} onChange={v => setF({ ...f, status: v })} options={[['draft', 'Nháp'], ['published', 'Đã phát hành'], ['archived', 'Ngừng dùng']]} /></FRow></>}
        fcount={[f.subj, f.grp, f.status].filter(Boolean).length} onClearFilters={() => setF({ ...f, subj: '', grp: '', status: '' })}
        filters={f} onFilters={x => setF({ q: x.q ?? '', subj: x.subj ?? '', grp: x.grp ?? '', status: x.status ?? '' })}
        view={<Seg label="Kiểu xem" items={[['table', 'Danh sách'], ['grid', 'Thẻ']]} value={mode} onChange={v => { setMode(v); try { localStorage.setItem('ph2.tp.mode', v) } catch { /* bỏ qua */ } }} />}
        grid={mode === 'grid' ? (shown.length ? <div className="grid">{shown.map(p => <TpCard key={p.id} k={k} p={p} onOpen={() => onOpen(p.id)} />)}</div> : <Empty>Không có chương trình phù hợp.</Empty>) : undefined} rowKey={p => p.id} noun="chương trình" onOpen={p => onOpen(p.id)} empty={<Empty>Không có chương trình phù hợp.</Empty>}
        bulk={can ? [{ label: 'Phát hành', run: async rs => { const ds = rs.filter(p => p.status !== 'published' && k.allMods(p).length + k.subjectsOf(p).length > 0)
            for (const p of ds) { const { error } = await supabase.from('ph2_programs').update({ status: 'published', releases: relNext(k, p) }).eq('id', p.id); if (error) return errMsg(error.message) }
            await P.reload(); return `Đã phát hành ${ds.length} chương trình${rs.length - ds.length ? ` · bỏ qua ${rs.length - ds.length} (đã phát hành hoặc chưa có học phần)` : ''}` } },
          { label: 'Nhân bản', run: async rs => { let n = 0
            for (const p of rs) { const { id: _i, created_at: _c, updated_at: _u, ...rest } = p
              const { data, error } = await supabase.from('ph2_programs').insert({ ...rest, owner_org_id: orgId ?? rest.owner_org_id, code: p.code ? p.code + '-BS' : null, name: p.name + ' (bản sao)', status: 'draft', releases: [] }).select('id').single()
              if (error || !data) continue
              const ms = k.modsOf(p.id).map(({ id: _m, program_id: _p, mat_use: _u2, ...m }) => ({ ...m, program_id: (data as { id: string }).id }))
              if (ms.length) await supabase.from('ph2_modules').insert(ms); n++ }
            await P.reload(); return `Đã nhân bản ${n} chương trình (nháp, chưa gắn học liệu)` } }] : []}
        onDelete={can ? async rs => { const used = rs.filter(p => k.plansOf(p.id).length)
          if (used.length) return P.setMsg(`Không xoá: ${used.map(p => p.code || p.name).join(', ')} đang có kế hoạch đào tạo`)
          await P.run(supabase.from('ph2_programs').delete().in('id', rs.map(p => p.id)), `✓ Đã xoá ${rs.length} chương trình`) } : undefined}
        cols={[
          { key: 'name', label: 'Chương trình', name: true, sort: p => p.name, cell: p => <><b>{p.name}</b><small>{p.code}</small></> },
          { key: 'grp', label: 'Nhóm', sort: p => k.groupOf(p.group_code).name, cell: p => { const g = k.groupOf(p.group_code); return g.code === 'CXN' ? 'Chưa xếp nhóm' : g.name } },
          { key: 'subj', label: 'Học phần', sort: p => k.subjectsOf(p).map(k.SUBJ).join(', '), cell: p => k.subjectsOf(p).map(k.SUBJ).join(', ') || '—' },
          { key: 'mods', label: 'Số chuyên đề', sum: 'sum', sort: p => k.allMods(p).length, cell: p => k.allMods(p).length },
          { key: 'hours', label: 'Số giờ', sum: 'sum', sort: p => k.progH(p), cell: p => k.progH(p) },
          { key: 'date', label: 'Phát hành gần nhất', date: true, sort: p => p.releases[0]?.date ?? null, cell: p => p.releases[0]?.date ?? 'Chưa phát hành' },
          { key: 'status', label: 'Trạng thái', sum: 'status', sort: p => p.status, cell: p => <StatusPill s={p.status} /> },
        ]} />
  </>
}
const relNext = (k: K, p: Prog) => [{ no: (p.releases[0]?.no ?? 0) + 1, date: vn(k.T), by: 'KDI Education', note: p.releases.length ? 'Phát hành lại' : 'Bản đầu tiên', mods: k.allMods(p).length }, ...p.releases]

// ---------- Chi tiết ----------
// Bản mẫu v315 · C6: thanh tab Chương trình | Khung đánh giá | Kế hoạch đào tạo + dòng số liệu; học phần bên trái, bảng chuyên đề (STT đánh lại theo học phần), khung Thông tin chung bên phải kéo rộng/thu gọn
type TpTab = 'overview' | 'setup' | 'assess' | 'plans'
function TpDetail({ P, k, p, tab, setTab, itemSel, setItemSel, orgId, onBack, openMat, openPlan }: { P: P2; k: K; p: Prog; tab: TpTab; setTab: (t: TpTab) => void
  itemSel: string | null; setItemSel: (v: string | null) => void; orgId: string | null; onBack: () => void; openMat: (mid: string) => void; openPlan: (id: string | null) => void }) {
  const [ask, setAsk] = useState(false)
  const [sub, setSub] = useState('all')
  const g = k.groupOf(p.group_code); const ms = k.allMods(p); const plans = k.plansOf(p.id); const subj = k.subjectsOf(p)
  const can = P.canManage
  const ok = ms.filter(x => k.matSt(x.m).s === 'ok').length
  const cur = sub !== 'all' && subj.includes(sub) ? sub : 'all'
  // Bản mẫu v315 (tpMods): đánh số liên tục trong danh sách đang xem — chọn một học phần thì đánh lại từ 1
  const [mq, setMq] = useState('')
  const all = (cur === 'all' ? subj : [cur]).flatMap(s => k.subjMods(p, s))
  const stt = new Map(all.map((m, i) => [m.id, i + 1] as [string, number]))
  const rows = all.filter(m => !mq || norm(m.title).includes(norm(mq)))
  // CT giáo dục liên quan: chọn tay (p.edu) hoặc tự khớp theo năng lực (curricula.comps)
  const [curs, setCurs] = useState<{ id: string; code: string | null; name: string; comps: string[] | null }[]>([])
  useEffect(() => { supabase.from('curricula').select('id, code, name, comps').then(({ data }) => setCurs((data as typeof curs) ?? [])) }, [])
  const eduCodes = (p.edu?.length ? curs.filter(c => p.edu!.includes(c.id)) : curs.filter(c => (c.comps ?? []).some(x => (p.comps ?? []).includes(x)))).map(c => (c.code ?? c.name) + (p.edu?.length ? '' : ' (tự khớp)'))
  const sb = (key: string, name: string, n: number, h: number) => <button type="button" key={key} className={'ctsb' + (cur === key ? ' on' : '')} onClick={() => setSub(key)}><b>{name}</b><small>{n} chuyên đề · {h} giờ</small></button>
  return <>
    <Back onClick={onBack} title={p.name}>Danh sách chương trình</Back>
    <CtHead code={p.code} color={g.color} title={p.name} pills={<><StatusPill s={p.status} />{p.releases[0] && <span className="pill plain">Bản {p.releases[0].no}</span>}</>} sub={<>{g.code === 'CXN' ? 'Chưa xếp nhóm' : g.name} · {TFORMAT[p.format]} · {k.progH(p)} giờ · {p.issuer}</>}

            act={can && <><button type="button" className="btn" onClick={() => setTab('setup')}><Ic n="edit" /> Sửa thông tin</button>
        {p.status !== 'published' ? <button type="button" className="btn primary" onClick={() => { if (!ms.length && !subj.length) return P.setMsg('Chưa có học phần / chuyên đề nào')
          P.run(supabase.from('ph2_programs').update({ status: 'published', releases: relNext(k, p) }).eq('id', p.id), '✓ Đã phát hành — dùng được để lập kế hoạch đào tạo') }}><Ic n="send" /> Phát hành</button>
        : <button type="button" className="btn" onClick={() => P.run(supabase.from('ph2_programs').update({ status: 'archived' }).eq('id', p.id), '✓ Đã chuyển sang Ngừng dùng')}><Ic n="archive" /> Ngừng dùng</button>}
        <button type="button" className="btn danger" aria-label="Xoá chương trình" data-tip="Xoá chương trình" onClick={() => setAsk(true)}><Ic n="trash" /></button></>} />
    {ask && <Confirm danger text={`Xoá chương trình “${p.name}”?${plans.length ? ` Đang có ${plans.length} kế hoạch đào tạo dùng chương trình này — sẽ bị xoá cùng.` : ''}`} yes="Xoá"
      onYes={async () => { if (await P.run(supabase.from('ph2_programs').delete().eq('id', p.id), '✓ Đã xoá chương trình')) onBack() }} onNo={() => setAsk(false)} />}
    {tab === 'setup' ? <TpForm P={P} k={k} p={p} orgId={orgId} onDone={() => setTab('overview')} /> : <>
    <div className="ctbar"><div className="seg" role="tablist">
      <button type="button" role="tab" className={tab === 'overview' ? 'on' : ''} onClick={() => setTab('overview')}>Chương trình</button>
      <button type="button" role="tab" className={tab === 'assess' ? 'on' : ''} onClick={() => setTab('assess')}>Khung đánh giá <small>{p.items.length}</small></button>
      <button type="button" role="tab" className={tab === 'plans' ? 'on' : ''} onClick={() => setTab('plans')}>Kế hoạch đào tạo <small>{plans.length}</small></button></div>
      <div className="ctstats"><span><b>{subj.length}</b>học phần</span><span><b>{ms.length}</b>chuyên đề</span><span><b>{k.progH(p)}</b>giờ · {fmtM(p.mpp)}/buổi</span><span><b>{ok}/{ms.length}</b>đủ học liệu</span>
        <span><b>{plans.reduce((a, x) => a + k.traineesOf(x.id).length, 0)}</b>học viên · {plans.length} đợt</span></div></div>
    {tab === 'assess' ? <TpAssess P={P} k={k} p={p} sel={itemSel} setSel={setItemSel} />
      : tab === 'plans' ? <Panel icon="calendar" title="Đợt đào tạo dùng chương trình này" act={can && p.status === 'published' && <button type="button" className="btn sm" onClick={() => openPlan(null)}><Ic n="plus" /> Lập đợt đào tạo</button>}>
        <DataTable id="tp-plans" rows={plans} rowKey={x => x.id} noun="đợt" onOpen={x => openPlan(x.id)}
          empty={<Empty>Chưa có đợt đào tạo nào{p.status === 'published' ? ' — bấm “Lập đợt đào tạo”.' : ' — phát hành chương trình rồi lập đợt đào tạo.'}</Empty>}
          cols={[
            { key: 'title', label: 'Đợt đào tạo', name: true, sort: x => x.title, cell: x => <b>{x.title}</b> },
            { key: 'unit', label: 'Đơn vị tổ chức', sort: x => x.unit, cell: x => x.unit || '—' },
            { key: 'date', label: 'Thời gian', date: true, sort: x => k.sessOfPlan(x.id)[0]?.date ?? null, cell: x => k.planRange(x) },
            { key: 'sess', label: 'Số buổi', sum: 'sum', sort: x => k.sessOfPlan(x.id).length, cell: x => k.sessOfPlan(x.id).length },
            { key: 'tr', label: 'Học viên', sum: 'frac', sort: x => k.traineesOf(x.id).length, cell: x => `${k.traineesOf(x.id).length}/${x.cap}` },
            { key: 'status', label: 'Trạng thái', sum: 'status', sort: x => k.planSt(x)[0], cell: x => { const [l, c] = k.planSt(x); return <span className={`pill ${c} plain`}>{l}</span> } },
          ]} /></Panel>
      : <AsideWrap aside={<>
        <Panel title="Thông tin chung">
          <dl className="ctkv">
            <div><dt>Nhóm</dt><dd>{g.code === 'CXN' ? 'Chưa xếp nhóm' : g.name}</dd></div><div><dt>Hình thức</dt><dd>{TFORMAT[p.format]}</dd></div>
            <div><dt>Thời lượng</dt><dd>{k.progH(p)} giờ · {fmtM(p.mpp)}/buổi</dd></div>
            <div><dt>Đối tượng</dt><dd>{p.audience?.levels?.map(l => LVLS.find(x => x[0] === l)?.[1] ?? l).join(', ') || '—'}{p.audience?.note && <><br /><small className="sub">{p.audience.note}</small></>}</dd></div>
            <div><dt>Năng lực</dt><dd className="clamp">{(p.comps ?? []).map(c => COMP[c] ?? P.db!.cat.find(x => x.kind === 'comp' && x.code === c)?.name ?? c).join(', ') || '—'}</dd></div>
            <div><dt>CT giáo dục</dt><dd>{eduCodes.length ? eduCodes.join(', ') : 'Độc lập'}</dd></div>
            <div><dt>Đơn vị</dt><dd>{p.issuer || '—'}</dd></div>
            {p.goal && <div><dt>Mục tiêu</dt><dd className="clamp" data-tip={p.goal}>{p.goal}</dd></div>}</dl></Panel>
        <Panel title="Học viên làm được gì">{p.outcomes ? <ul className="ctul">{lines(p.outcomes).map((x, i) => <li key={i}>{x}</li>)}</ul> : <span className="sub">Chưa nhập — bấm Sửa thông tin</span>}</Panel>
        <Panel title="Khung đánh giá" act={<button type="button" className="btn sm ghost" onClick={() => setTab('assess')}>Chi tiết ›</button>}>
          <dl className="ctkv"><div><dt>Đầu điểm</dt><dd>{p.items.length ? p.items.map(i => <div key={i.id}>{i.name} <span className="sub">{i.w}%</span></div>) : '—'}</dd></div>
            <div><dt>Hoàn thành</dt><dd>Chuyên cần ≥ {p.criteria.att}% · điểm ≥ {p.criteria.score}/10{p.criteria.req ? ' · đạt tiêu chí bắt buộc' : ''}</dd></div>
            <div><dt>Chứng nhận</dt><dd className="clamp">{p.cert || '—'}</dd></div></dl></Panel>
        <Panel title="Phiên bản">{p.releases.length ? p.releases.slice(0, 3).map((r, i) => <div key={r.no} className="ctver"><b>Bản {r.no}</b><small className="sub">{r.date} · {r.mods} chuyên đề</small>{i === 0 && p.status === 'published' && <span className="pill good plain">Đang dùng</span>}</div>)
          : <span className="sub">Chưa phát hành lần nào</span>}</Panel></>}>
        <Panel icon="list" title="Học phần & chuyên đề" className="ctmain">
          {!subj.length ? <Empty>Chưa có học phần — bấm “Sửa thông tin” để thêm học phần và chuyên đề.</Empty> : <div className="ctgrid">
            <nav className="ctnav" aria-label="Lọc theo học phần">{sb('all', 'Tất cả', ms.length, k.progH(p))}{subj.map(s => sb(s, k.SUBJ(s), k.subjMods(p, s).length, k.subjH(p, s)))}</nav>
            <div className="ctbody"><DataTable id="tp-mods" plain rows={rows} rowKey={m => m.id} noun="chuyên đề" search={{ value: mq, onChange: setMq, placeholder: 'Tìm chuyên đề trong mọi học phần…' }}
              empty={<Empty>Chưa có chuyên đề.</Empty>}
              cols={[
                { key: 'stt', label: '#', width: '56px', sum: false, sort: m => stt.get(m.id), cell: m => stt.get(m.id) },
                { key: 'title', label: 'Chuyên đề', name: true, sort: m => m.title, cell: m => <><b>{m.title}</b>{cur === 'all' && <small>{k.SUBJ(m.subject)}</small>}</> },
                { key: 'hours', label: 'Số giờ', sum: 'sum', sort: m => Number(m.hours), cell: m => Number(m.hours) },
                { key: 'sess', label: 'Số buổi', sum: 'sum', sort: m => sessOf(Number(m.hours), p.mpp), cell: m => sessOf(Number(m.hours), p.mpp) },
                { key: 'mat', label: 'Học liệu', raw: true, sum: 'status', sort: m => k.matSt(m).s, cell: m => <button type="button" className="matbtn" title="Mở học liệu chuyên đề" onClick={e => { e.stopPropagation(); openMat(m.id) }}><MatPill k={k} m={m} /></button> },
              ]} /></div></div>}
        </Panel>
      </AsideWrap>}</>}
  </>
}

export function MatPill({ k, m }: { k: K; m: Parameters<K['matSt']>[0] }) {
  const s = k.matSt(m)
  return s.s === 'ok' ? <span className="pill good plain" title={`PB ${s.v}`}>Đủ</span> : s.s === 'draft' ? <span className="pill warn plain" title={`PB ${s.v}`}>Đang soạn</span> : <span className="pill draft plain">Chưa có</span>
}

// ---------- Thiết lập (tạo mới / sửa) ----------
type MV = { id?: string; title: string; hours: number }
type V = { name: string; code: string; group: string; subj: string[]; mods: Record<string, MV[]>; hours: Record<string, number>; format: Format; mpp: number; summary: string; outcomes: string; goal: string; levels: string[]; aud: string; issuer: string; comps: string[]; edu: string[] }
function TpForm({ P, k, p, orgId, onDone }: { P: P2; k: K; p: Prog | null; orgId: string | null; onDone: (id?: string) => void }) {
  const [v, setV] = useState<V>(() => p ? { name: p.name, code: p.code ?? '', group: p.group_code ?? 'CXN', subj: k.subjectsOf(p), mods: Object.fromEntries(k.subjectsOf(p).map(s => [s, k.subjMods(p, s).map(m => ({ id: m.id, title: m.title, hours: Number(m.hours) }))])),
    hours: Object.fromEntries(k.subjectsOf(p).map(s => [s, k.subjH(p, s)])), format: p.format, mpp: p.mpp, summary: p.summary ?? '', outcomes: p.outcomes ?? '', goal: p.goal ?? '', levels: [...(p.audience?.levels ?? [])], aud: p.audience?.note ?? '', comps: [...(p.comps ?? [])], edu: [...(p.edu ?? [])], issuer: p.issuer ?? '' }
    : { name: '', code: '', group: 'CXN', subj: [], mods: {}, hours: {}, format: 'off', mpp: 180, summary: '', outcomes: '', goal: '', levels: [], aud: '', issuer: k.orgName(orgId) || 'KDI Education', comps: [], edu: [] })
  const [mdOpen, setMdOpen] = useState<Set<string>>(new Set())
  const [sq, setSq] = useState(''); const [sdd, setSdd] = useState(false)
  const [nm, setNm] = useState<Record<string, { t: string; h: number }>>({})
  const [busy, setBusy] = useState(false)
  const [curs, setCurs] = useState<{ id: string; code: string | null; name: string; comps: string[] | null }[]>([])
  const [frame, setFrame] = useState<Frame>(DEF_FRAME)
  useEffect(() => { supabase.from('curricula').select('id, code, name, comps').order('code').then(({ data }) => setCurs((data as typeof curs) ?? []))
    if (orgId) supabase.from('ph2_settings').select('frame').eq('org_id', orgId).then(({ data }) => { const fr = ((data as { frame: Frame | null }[]) ?? [])[0]?.frame; if (fr) setFrame(fr) }) }, [orgId])
  const compList: [string, string][] = [...Object.entries(COMP), ...P.db!.cat.filter(c => c.kind === 'comp').map(c => [c.code ?? c.id, c.name] as [string, string])]
  const sqRef = useRef<HTMLInputElement>(null)
  const set = (x: Partial<V>) => setV({ ...v, ...x })
  const groups = k.groups(); const units = P.db!.cat.filter(c => c.kind === 'unit')
  const subjCat = catOf(P.cat, 'subject')
  const tot = v.subj.reduce((a, s) => a + (+v.hours[s] || 0), 0)
  const miss = [!v.name.trim() && 'tên chương trình', !v.subj.length && 'học phần'].filter(Boolean)
  const prev = { ...(p ?? {}), id: '_', code: v.code || 'MÃ', name: v.name || 'Tên chương trình…', summary: v.summary || 'Mô tả ngắn sẽ hiện ở đây.', format: v.format, group_code: v.group === 'CXN' ? null : v.group, status: p?.status ?? 'draft',
    _subj: v.subj, _mods: v.subj.reduce((a, s) => a + (v.mods[s] ?? []).filter(x => x.title.trim()).length, 0), _h: tot } as Prog & { _subj: string[]; _mods: number; _h: number }
  const t = norm(sq); const hits = subjCat.filter(s => !v.subj.includes(s.code) && (!t || norm(s.name).includes(t))).slice(0, 8); const exact = subjCat.some(s => norm(s.name) === t)
  async function addSubj(code: string | null, name?: string) {
    let c = code
    if (!c && name) { c = slug(name) || 'mon_' + Date.now(); if (!subjCat.some(s => s.code === c) && orgId) { const { error } = await supabase.from('curriculum_catalog').insert({ owner_org_id: orgId, kind: 'subject', code: c, name, sort: 900 })
      if (error) return P.setMsg('Không tạo được học phần mới: ' + error.message); P.reloadCat(); P.setMsg(`✓ Đã tạo học phần “${name}” và thêm vào danh mục`) } }
    if (c && !v.subj.includes(c)) set({ subj: [...v.subj, c], hours: { ...v.hours, [c]: v.hours[c] ?? 3 }, mods: { ...v.mods, [c]: v.mods[c] ?? [] } })
    setSq(''); sqRef.current?.focus()
  }
  async function save() {
    if (!v.name.trim()) return P.setMsg('Nhập tên chương trình'); if (!v.subj.length) return P.setMsg('Chọn ít nhất một học phần'); if (!orgId) return
    setBusy(true)
    const row = { name: v.name.trim(), code: v.code || null, group_code: v.group === 'CXN' ? null : v.group, format: v.format, mpp: v.mpp || 180, issuer: v.issuer, summary: v.summary, outcomes: v.outcomes, goal: v.goal,
      audience: { levels: v.levels, note: v.aud }, comps: v.comps, edu: v.edu, subjects: v.subj, subj_hours: Object.fromEntries(v.subj.map(s => [s, +v.hours[s] || 0])) }
    let pid = p?.id
    if (p) { const { error } = await supabase.from('ph2_programs').update(row).eq('id', p.id); if (error) { setBusy(false); return P.setMsg(error.message) } }
    else { const { data, error } = await supabase.from('ph2_programs').insert({ ...row, owner_org_id: orgId, status: 'draft', cert: `Chứng nhận hoàn thành “${v.name.trim()}”`, criteria: { att: frame.att, score: frame.score, req: frame.crit.some(c => c.req) } }).select('id').single()
      if (error) { setBusy(false); return P.setMsg(error.message) } pid = (data as { id: string }).id }
    // Chuyên đề: giữ theo id, thêm mới, bỏ chuyên đề đã xoá
    const keep = new Set<string>(); const ins: object[] = []
    for (const s of v.subj) for (const [i, x] of (v.mods[s] ?? []).filter(x => x.title.trim()).entries()) {
      const r = { subject: s, seq: i + 1, title: x.title.trim(), hours: +x.hours || 1, sessions: sessOf(+x.hours || 1, v.mpp) }
      if (x.id) { keep.add(x.id); await supabase.from('ph2_modules').update(r).eq('id', x.id) } else ins.push({ ...r, program_id: pid })
    }
    if (p) { const del = k.modsOf(p.id).filter(m => !keep.has(m.id)).map(m => m.id); if (del.length) await supabase.from('ph2_modules').delete().in('id', del) }
    if (ins.length) await supabase.from('ph2_modules').insert(ins)
    setBusy(false); await P.reload(); P.setMsg(p ? '✓ Đã lưu chương trình' : `✓ Đã tạo chương trình nháp với ${ins.length} chuyên đề`); onDone(pid)
  }
  const sec = (icon: string, title: string, hint: string, body: ReactNode) => <section className="fsec"><header><span className="fsi"><Ic n={icon} /></span><div><b>{title}</b><small>{hint}</small></div></header>{body}</section>
  const fIc: Record<string, string> = { off: 'users', on: 'video', mix: 'refresh' }; const fSub: Record<string, string> = { off: 'Học tại hội trường', on: 'Qua lớp học ảo', mix: 'Xen kẽ hai hình thức' }
  return <div className="tfwrap"><div className="tfmain">
    {sec('info', 'Thông tin chung', 'Tên, mã và cách tổ chức đào tạo', <>
      <input className="bigin" value={v.name} onChange={e => set({ name: e.target.value })} placeholder="Tên chương trình, VD: Dạy học STEM cơ bản" aria-label="Tên chương trình" />
      <div className="frow"><label className="fld"><span>Mã chương trình</span><input value={v.code} onChange={e => set({ code: e.target.value })} placeholder="VD: STEM-CB1" /></label>
        <label className="fld"><span>Đơn vị đào tạo</span><input list="p2-units" value={v.issuer} onChange={e => set({ issuer: e.target.value })} /><datalist id="p2-units">{units.map(u => <option key={u.id} value={u.name} />)}</datalist></label></div>
      <div className="fld"><span>Nhóm chương trình</span><div className="gpick">{[...groups.map(x => ({ code: x.code!, name: x.name, color: x.color ?? '#64748b' })), CXN].map(x =>
        <button type="button" key={x.code} className={'gopt' + (v.group === x.code ? ' on' : '')} style={cssVar(x.color)} onClick={() => set({ group: x.code })}><i />{x.name}</button>)}</div></div>
      <div className="fld"><span>Hình thức tổ chức</span><div className="fpick">{(Object.entries(TFORMAT) as [Format, string][]).map(([kk, n]) =>
        <button type="button" key={kk} className={'fopt' + (v.format === kk ? ' on' : '')} onClick={() => set({ format: kk })}><Ic n={fIc[kk]} /><b>{n}</b><small>{fSub[kk]}</small></button>)}</div></div>
      <div className="fld"><span>Thời lượng mỗi buổi</span><div className="mpick"><label className="unit"><input type="number" min={0} max={12} value={Math.floor(v.mpp / 60)} aria-label="Số giờ mỗi buổi" onChange={e => set({ mpp: (+e.target.value || 0) * 60 + v.mpp % 60 || 180 })} /><em>giờ</em></label>
        <label className="unit"><input type="number" min={0} max={59} step={5} value={v.mpp % 60} aria-label="Số phút mỗi buổi" onChange={e => set({ mpp: Math.floor(v.mpp / 60) * 60 + (+e.target.value || 0) || 180 })} /><em>phút</em></label></div></div></>)}
    {sec('book', 'Học phần & thời lượng', 'Học viên đào tạo theo học phần — không chia cấp, khối, lớp. Chuyên đề có thể bổ sung sau', <>
      <div className="scombo"><span className="scq"><Ic n="search" /><input ref={sqRef} value={sq} autoComplete="off" placeholder="Tìm học phần để thêm, hoặc gõ tên học phần mới…" aria-label="Thêm học phần" role="combobox" aria-expanded={sdd}
        onFocus={() => setSdd(true)} onBlur={() => setTimeout(() => setSdd(false), 150)} onChange={e => { setSq(e.target.value); setSdd(true) }}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (hits[0]) addSubj(hits[0].code); else if (sq.trim() && !exact) addSubj(null, sq.trim()) } if (e.key === 'Escape') (e.target as HTMLInputElement).blur() }} /></span>
        {sdd && <div className="sdd">{hits.map(s => <button type="button" key={s.code} onMouseDown={e => { e.preventDefault(); addSubj(s.code) }}><svg viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: SGLYPH[s.code] ?? SGLYPH.khtn }} />{s.name}</button>)}
          {sq.trim() && !exact && <button type="button" className="new" onMouseDown={e => { e.preventDefault(); addSubj(null, sq.trim()) }}><Ic n="plus" /> Tạo học phần mới “{sq.trim()}”</button>}
          {!hits.length && !sq.trim() && <small className="sub">Đã chọn hết học phần trong danh mục — gõ tên để tạo học phần mới.</small>}</div>}</div>
      {v.subj.length ? <div className="slist"><div className="slh"><span>Học phần</span><span>Thời lượng</span><span>Chuyên đề</span><span /></div>
        {v.subj.map(s => { const ms = v.mods[s] ?? []; const h = v.hours[s] ?? 3; const mh = ms.reduce((a, x) => a + (+x.hours || 0), 0); const op = mdOpen.has(s)
          const setMods = (x: MV[]) => set({ mods: { ...v.mods, [s]: x } }); const nn = nm[s] ?? { t: '', h: Math.max(0.5, h - mh) || 3 }
          const addMod = () => { if (!nn.t.trim()) return P.setMsg('Nhập tên chuyên đề'); setMods([...ms, { title: nn.t.trim(), hours: nn.h || 3 }]); setNm({ ...nm, [s]: { t: '', h: 3 } }) }
          return <div key={s} className={'sli' + (op ? ' open' : '')}><div className="slr"><span className="sn"><svg viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: SGLYPH[s] ?? SGLYPH.khtn }} /><b>{k.SUBJ(s)}</b></span>
            <span className="sh"><label className="unit"><input type="number" min={0.5} step={0.5} value={h} aria-label={`Thời lượng ${k.SUBJ(s)}`} onChange={e => set({ hours: { ...v.hours, [s]: +e.target.value || 0 } })} /><em>giờ</em></label></span>
            <button type="button" className="mdtog" aria-expanded={op} onClick={() => setMdOpen(x => { const n = new Set(x); if (op) n.delete(s); else n.add(s); return n })}>
              {ms.length ? <>{ms.length} chuyên đề{mh !== +h && <> <i className={mh > h ? 'over' : ''}>{mh}/{h} giờ</i></>}</> : <span className="sub">+ Thêm chuyên đề</span>}<Ic n="chev" /></button>
            <button type="button" className="btn sm ghost" aria-label={`Bỏ học phần ${k.SUBJ(s)}`} onClick={() => set({ subj: v.subj.filter(x => x !== s) })}>✕</button></div>
            {op && <div className="mdin">{ms.map((x, i) => <div key={i} className="mdrow"><span className="n">{i + 1}</span><input value={x.title} placeholder="Tên chuyên đề" aria-label="Tên chuyên đề" onChange={e => setMods(ms.map((y, j) => j === i ? { ...y, title: e.target.value } : y))} />
              <label className="unit"><input type="number" min={0.5} step={0.5} value={x.hours} aria-label="Số giờ" onChange={e => setMods(ms.map((y, j) => j === i ? { ...y, hours: +e.target.value || 0 } : y))} /><em>giờ</em></label>
              <button type="button" className="btn sm ghost" aria-label="Xoá chuyên đề" onClick={() => setMods(ms.filter((_, j) => j !== i))}><Ic n="trash" /></button></div>)}
              <div className="mdrow add"><span className="n"><Ic n="plus" /></span><input value={nn.t} placeholder={`Thêm chuyên đề cho ${k.SUBJ(s)}…`} aria-label="Tên chuyên đề mới" onChange={e => setNm({ ...nm, [s]: { ...nn, t: e.target.value } })} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addMod() } }} />
                <label className="unit"><input type="number" min={0.5} step={0.5} value={nn.h} aria-label="Số giờ" onChange={e => setNm({ ...nm, [s]: { ...nn, h: +e.target.value || 0 } })} /><em>giờ</em></label><button type="button" className="btn sm" onClick={addMod}>Thêm</button></div></div>}</div> })}
        <div className="slf"><span>{v.subj.length} học phần</span><b>Tổng {tot} giờ ÷ {fmtM(v.mpp)} = {sessOf(tot, v.mpp)} buổi</b></div></div>
        : <Empty>Chưa có học phần nào — tìm và thêm học phần ở ô phía trên.</Empty>}</>)}
    {sec('award', 'Năng lực & chương trình giáo dục liên quan', 'Năng lực hướng tới — hệ thống tự khớp với chương trình giáo dục yêu cầu cùng năng lực', <>
      <div className="chips">{compList.map(([c, n]) => <button type="button" key={c} className={'chip' + (v.comps.includes(c) ? ' k on' : '')} aria-pressed={v.comps.includes(c)} onClick={() => set({ comps: v.comps.includes(c) ? v.comps.filter(x => x !== c) : [...v.comps, c] })}>{v.comps.includes(c) && '✓ '}{n}</button>)}</div>
      <label className="fld"><span>Chương trình giáo dục liên quan <small className="sub">để trống: tự khớp theo năng lực</small></span>
        <select multiple value={v.edu} onChange={e => set({ edu: Array.from(e.target.selectedOptions).map(o => o.value) })} style={{ minHeight: 96 }}>{curs.map(c => <option key={c.id} value={c.id}>{c.code ? c.code + ' · ' : ''}{c.name}</option>)}</select></label></>)}
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
    <p className="note"><Ic n="info" /> Khung đánh giá định nghĩa một lần cho chương trình; mọi đợt đào tạo tự kế thừa. Giảng viên chấm ở <b>Đánh giá kết quả › Chấm bài</b>.</p>
    {used.length > 0 && <p className="note warnnote"><Ic n="alert" /> {used.length} đợt đã có điểm theo khung này ({used.map(x => x.title.split('–').pop()!.trim()).join(', ')}). Thêm tiêu chí hoặc đầu điểm mới sẽ cần chấm bổ sung cho các đợt đó.</p>}
    <Panel icon="list" title="1. Đầu điểm đánh giá" act={<small className={tw === 100 ? 'sub' : 'badtxt'}>Tổng trọng số <b>{tw}%</b>{tw === 100 ? '' : ' — cần bằng 100%'}</small>}>
      <TblWrap><table className="ittbl"><thead><tr><th>STT</th><th>Đầu điểm</th><th>Loại</th><th>Gắn với chuyên đề</th><th>Cách chấm</th><th className="c">Trọng số</th><th /></tr></thead><tbody>
        {its.map((i, n) => <tr key={i.id} className={it?.id === i.id ? 'cur' : ''}><td className="n">{n + 1}</td>
          <td><input defaultValue={i.name} key={i.name} disabled={ro} aria-label="Tên đầu điểm" onBlur={e => e.target.value !== i.name && patch(i.id, { name: e.target.value })} /></td>
          <td><select value={i.kind} disabled={ro} aria-label="Loại đầu điểm" onChange={e => patch(i.id, { kind: e.target.value, ...(e.target.value === 'demo' ? { mode: 'rubric' as const } : {}) })}>{Object.entries(IKIND).map(([kk, [n2]]) => <option key={kk} value={kk}>{n2}</option>)}</select></td>
          <td><select value={i.mod} disabled={ro} aria-label="Gắn với chuyên đề" onChange={e => patch(i.id, { mod: e.target.value })}><option value="">Cả chương trình (cuối khoá)</option>{mods.map(({ s, m }) => <option key={m.id} value={m.id}>{k.SUBJ(s)} · {m.title}</option>)}</select></td>
          <td><div className="seg sm" role="group" aria-label="Cách chấm">{([['score', 'Điểm số'], ['rubric', 'Rubric']] as const).map(([m, n2]) => <button type="button" key={m} disabled={ro} className={i.mode === m ? 'on' : ''}
            onClick={() => { setSel(i.id); patch(i.id, { mode: m, ...(m === 'rubric' && !i.rubric.length ? { rubric: [newC('Tiêu chí 1', 4)] } : {}) }) }}>{n2}</button>)}</div></td>
          <td className="c"><label className="unit"><input type="number" min={0} max={100} defaultValue={i.w} key={i.w} disabled={ro} aria-label="Trọng số" onBlur={e => +e.target.value !== i.w && patch(i.id, { w: Math.max(0, +e.target.value || 0) })} /><em>%</em></label></td>
          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}><button type="button" className={'btn sm' + (it?.id === i.id ? ' primary' : '')} onClick={() => setSel(i.id)}>{i.mode === 'rubric' ? `Rubric · ${i.rubric.length} tiêu chí` : 'Chi tiết'}</button>
            {!ro && <button type="button" className="btn sm ghost" aria-label="Xoá đầu điểm" onClick={() => { saveItems(its.filter(x => x.id !== i.id)); P.setMsg('✓ Đã xoá đầu điểm') }}><Ic n="trash" /></button>}</td></tr>)}
        {!its.length && <tr><td colSpan={7} className="sub">Chưa có đầu điểm — thêm ở dòng dưới.</td></tr>}</tbody></table></TblWrap>
      {!ro && <div className="catadd"><Ic n="plus" /><input className="cin" value={nn} onChange={e => setNn(e.target.value)} placeholder="Tên đầu điểm, VD: Kiểm tra cuối khoá" />
        <select className="cin" style={{ flex: 'none', width: 'auto' }} value={nk} onChange={e => setNk(e.target.value)} aria-label="Loại đầu điểm">{Object.entries(IKIND).map(([kk, [n2]]) => <option key={kk} value={kk}>{n2}</option>)}</select>
        <button type="button" className="btn sm primary" onClick={() => { if (!nn.trim()) return P.setMsg('Nhập tên đầu điểm'); const mode = nk === 'quiz' || nk === 'essay' ? 'score' : 'rubric'
          const i: Item = { id: uid('it'), name: nn.trim(), kind: nk, mod: '', mode, w: 0, max: 10, task: '', rubric: mode === 'rubric' ? [newC('Tiêu chí 1', 4)] : [] }; saveItems([...its, i]); setSel(i.id); setNn(''); P.setMsg('✓ Đã thêm đầu điểm — nhớ chỉnh trọng số') }}>Thêm đầu điểm</button></div>}</Panel>
    {it && <Panel icon={IKIND[it.kind]?.[1] ?? 'file'} title={<>2. {it.name} <small className="sub">{IKIND[it.kind]?.[0]} · {it.w}% · {it.mod ? k.mod(it.mod)?.title ?? '' : 'cả chương trình'}</small></>}>
      <label className="fld"><span>Đề bài / yêu cầu cho học viên</span><textarea rows={2} defaultValue={it.task} key={it.id + 't'} disabled={ro} placeholder="Học viên cần làm gì, nộp gì, hạn nộp…" onBlur={e => e.target.value !== it.task && patch(it.id, { task: e.target.value })} /></label>
      {it.mode === 'score' ? <div className="fld"><span>Thang điểm</span><label className="unit"><input type="number" min={1} defaultValue={it.max} key={it.id + 'm'} disabled={ro} aria-label="Thang điểm" onBlur={e => patch(it.id, { max: Math.max(1, +e.target.value || 10) })} /><em>điểm</em></label><small className="sub">Quy về thang 10 khi tính điểm tổng.</small></div>
        : <><div className="rbhead"><b>Rubric chấm</b><small className="sub">{it.rubric.length} tiêu chí · {it.rubric.reduce((a, c) => a + (+c.pts || 0), 0)} điểm · Điểm đầu điểm = Σ điểm theo mức ÷ {it.rubric.reduce((a, c) => a + (+c.pts || 0), 0) || '…'} × 10</small></div>
          <TblWrap><table className="rbtbl"><thead><tr><th>Tiêu chí</th>{LV.map((l, kk) => <th key={l} className={'lv' + kk}>{l}<small>{LVP[kk] * 100}% điểm</small></th>)}<th /></tr></thead><tbody>
            {it.rubric.map(c => <tr key={c.id}><td className="rbc"><input defaultValue={c.name} key={c.name} disabled={ro} aria-label="Tên tiêu chí" onBlur={e => e.target.value !== c.name && patchC(c.id, { name: e.target.value })} />
              <div className="rbmeta"><label className="unit"><input type="number" min={1} defaultValue={c.pts} key={c.pts} disabled={ro} aria-label="Điểm tối đa" onBlur={e => patchC(c.id, { pts: Math.max(1, +e.target.value || 1) })} /><em>điểm</em></label>
                <select value={c.comp} disabled={ro} aria-label="Năng lực" onChange={e => patchC(c.id, { comp: e.target.value })}>{Object.entries(COMP).map(([kk, n2]) => <option key={kk} value={kk}>{n2}</option>)}</select>
                <label className="rbreq"><input type="checkbox" checked={c.req} disabled={ro} onChange={e => patchC(c.id, { req: e.target.checked })} /> Bắt buộc đạt</label></div></td>
              {LV.map((l, kk) => <td key={l} className={'lv' + kk}><textarea rows={3} defaultValue={c.desc[kk] ?? ''} key={c.id + kk + (c.desc[kk] ?? '')} disabled={ro} aria-label={`Mô tả mức ${l}`} placeholder={`Mô tả mức ${l.toLowerCase()}…`}
                onBlur={e => e.target.value !== (c.desc[kk] ?? '') && patchC(c.id, { desc: c.desc.map((d, j) => j === kk ? e.target.value : d) })} /><small>{+(c.pts * LVP[kk]).toFixed(2)} điểm</small></td>)}
              <td>{!ro && <button type="button" className="btn sm ghost" aria-label="Xoá tiêu chí" onClick={() => patch(it.id, { rubric: it.rubric.filter(x => x.id !== c.id) })}><Ic n="trash" /></button>}</td></tr>)}
            {!it.rubric.length && <tr><td colSpan={6} className="sub">Chưa có tiêu chí.</td></tr>}</tbody></table></TblWrap>
          <div className="formact" style={{ justifyContent: 'flex-start' }}>{!ro && <button type="button" className="btn sm" onClick={() => patch(it.id, { rubric: [...it.rubric, newC('Tiêu chí mới', 3)] })}><Ic n="plus" /> Thêm tiêu chí</button>}
            <small className="sub">Tiêu chí “Bắt buộc đạt” ở mức Chưa đạt → học viên chưa hoàn thành chương trình. Mỗi tiêu chí gắn một năng lực để cập nhật hồ sơ năng lực nhà giáo.</small></div></>}</Panel>}
    <Panel icon="award" title="3. Điều kiện hoàn thành & chứng nhận"><div className="crgrid">
      <label className="crt"><span className="crh"><Ic n="check" /> Chuyên cần tối thiểu</span><span className="crv"><input type="number" min={0} max={100} defaultValue={C.att} key={'a' + C.att} disabled={ro} aria-label="Chuyên cần tối thiểu" onBlur={e => saveC({ ...C, att: Math.min(100, Math.max(0, +e.target.value || 0)) })} /><em>%</em></span><small>số buổi có mặt / tổng số buổi</small></label>
      <label className="crt"><span className="crh"><Ic n="target" /> Điểm tổng tối thiểu</span><span className="crv"><input type="number" min={0} max={10} step={0.5} defaultValue={C.score} key={'s' + C.score} disabled={ro} aria-label="Điểm tổng tối thiểu" onBlur={e => saveC({ ...C, score: Math.min(10, Math.max(0, +e.target.value || 0)) })} /><em>/10</em></span><small>trung bình các đầu điểm theo trọng số</small></label>
      <label className="crt"><span className="crh"><Ic n="alert" /> Tiêu chí bắt buộc</span><span className="crv sw"><input type="checkbox" checked={C.req} disabled={ro} onChange={e => saveC({ ...C, req: e.target.checked })} /><i /><b>{C.req ? 'Phải đạt' : 'Không xét'}</b></span><small>{its.flatMap(i => i.rubric).filter(c => c.req).length} tiêu chí rubric đánh dấu “bắt buộc”</small></label></div>
      <label className="fld"><span>Tên chứng nhận</span><span className="certin"><Ic n="award" /><input value={cert} disabled={ro} onChange={e => setCert(e.target.value)} onBlur={() => cert !== p.cert && P.run(supabase.from('ph2_programs').update({ cert }).eq('id', p.id))} /></span></label></Panel>
  </>
}
