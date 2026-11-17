import { useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../../lib/supabase'
import { catOf } from '../ph1/curriculum/api'
import { DataTable } from '../ph1/mau/DataTable'
import { Confirm, Empty, HNote, Ic, Panel, Seg, cssVar } from '../ph1/mau/kit'
import { SGLYPH } from '../ph1/mau/icons'
import { COMP, CXN, TFORMAT, slug, uid, type Format, type K, type Prog } from './api'
import type { P2 } from './use'

// Danh mục PH2 theo bản mẫu v315: Khung đánh giá chung · Năng lực · Nhóm chương trình · Học phần · Hình thức · Đơn vị đào tạo · Giảng viên
type CK = 'frame' | 'comp' | 'group' | 'subject' | 'format' | 'unit' | 'trainer'
export type FCrit = { id: string; name: string; comp: string; req: boolean; desc: string }
export type Frame = { crit: FCrit[]; att: number; score: number }
export const DEF_FRAME: Frame = { att: 80, score: 5, crit: [
  { id: 'c1', name: 'Thiết kế được bài học STEM theo quy trình', comp: 'tk', req: true, desc: 'Kế hoạch bài dạy đủ các bước, có sản phẩm và tiêu chí đánh giá' },
  { id: 'c2', name: 'Tổ chức hoạt động nhóm, thực hành', comp: 'tc', req: true, desc: 'Học sinh làm việc nhóm, giáo viên hướng dẫn đúng vai trò' },
  { id: 'c3', name: 'Đánh giá sản phẩm theo rubric', comp: 'dg', req: false, desc: 'Xây dựng và dùng rubric đánh giá sản phẩm' },
  { id: 'c4', name: 'Sử dụng thiết bị, công cụ an toàn', comp: 'cn', req: true, desc: 'Vận hành thiết bị đúng quy trình an toàn' }] }
type Cur = { id: string; code: string | null; name: string; comps: string[] | null }

export function TpCatalog({ P, k, orgId }: { P: P2; k: K; orgId: string | null }) {
  const db = P.db!
  const [kind, setKind] = useState<CK>('frame')
  const [edit, setEdit] = useState<string | null>(null)
  const [ev, setEv] = useState<Record<string, string>>({})
  const [nw, setNw] = useState<Record<string, string>>({ color: '#e08a0b' })
  const [ask, setAsk] = useState<{ text: string; run: () => void } | null>(null)
  const [frame, setFrame] = useState<Frame | null>(null)
  const [curs, setCurs] = useState<Cur[]>([])
  useEffect(() => {
    if (orgId) supabase.from('ph2_settings').select('frame').eq('org_id', orgId).then(({ data }) => setFrame(((data as { frame: Frame | null }[]) ?? [])[0]?.frame ?? DEF_FRAME))
    supabase.from('curricula').select('id, code, name, comps').order('code').then(({ data }) => setCurs((data as Cur[]) ?? []))
  }, [orgId])
  const comps: [string, string][] = [...Object.entries(COMP), ...db.cat.filter(c => c.kind === 'comp').map(c => [c.code ?? c.id, c.name] as [string, string])]
  const progsOf = (f: (p: Prog) => boolean) => db.progs.filter(f).length
  const can = P.canManage
  const inp = (val: string, set: (v: string) => void, ph = '', type = 'text') => <input className="cin" type={type} value={val} placeholder={ph} aria-label={ph || 'Giá trị'} onChange={e => set(e.target.value)} />
  const icons = (onEdit?: () => void, onDel?: () => void) => can && <span style={{ whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
    {onEdit && <button type="button" className="btn sm ghost" aria-label="Sửa" onClick={onEdit}><Ic n="edit" /></button>}{onDel && <button type="button" className="btn sm ghost" aria-label="Xoá" onClick={onDel}><Ic n="trash" /></button>}</span>
  const saveBtns = (onSave: () => void) => <span style={{ whiteSpace: 'nowrap' }}><button type="button" className="btn sm primary" onClick={onSave}><Ic n="check" /> Lưu</button><button type="button" className="btn sm ghost" onClick={() => setEdit(null)}>Huỷ</button></span>
  const addBar = (fields: ReactNode, onAdd: () => void) => can && <div className="catadd"><Ic n="plus" />{fields}<button type="button" className="btn sm primary" onClick={onAdd}>Thêm</button></div>
  const done = (ok: unknown) => { if (ok) { setEdit(null); setNw({ color: '#e08a0b' }) } }
  const saveFrame = async (f: Frame) => { if (!orgId) return; setFrame(f); await P.run(supabase.from('ph2_settings').upsert({ org_id: orgId, frame: f }, { onConflict: 'org_id' }), '✓ Đã lưu khung đánh giá chung') }

  let body: ReactNode = null
  if (kind === 'frame') { const f = frame ?? DEF_FRAME
    body = <>
      <p className="note"><Ic n="info" /> Khung dùng chung cho mọi chương trình đào tạo: tiêu chí, mức đánh giá và điều kiện hoàn thành. Chương trình tạo mới nhận bản sao của khung này; chương trình nào cần khác thì sửa trên bản của mình.</p>
      <Panel icon="target" title={<>1. Tiêu chí đánh giá <small className="sub">{f.crit.length} tiêu chí · {f.crit.filter(c => c.req).length} bắt buộc</small></>}>
        <DataTable id="ph2-frame" plain rows={f.crit} rowKey={c => c.id} noun="tiêu chí" onOpen={c => can && setEdit(c.id)}
          cols={[
            { key: 'stt', label: 'STT', width: '56px', sum: false, cell: c => f.crit.indexOf(c) + 1 },
            { key: 'name', label: 'Tiêu chí', name: true, cell: c => edit === c.id ? inp(ev.name ?? c.name, v => setEv({ ...ev, name: v })) : <><b>{c.name}</b><small>{comps.find(x => x[0] === c.comp)?.[1] ?? ''}</small></> },
            { key: 'desc', label: 'Yêu cầu cần đạt', raw: edit != null, cell: c => edit === c.id ? inp(ev.desc ?? c.desc, v => setEv({ ...ev, desc: v })) : c.desc || '—' },
            { key: 'req', label: 'Bắt buộc', width: '96px', sum: false, raw: true, cell: c => <input type="checkbox" checked={c.req} disabled={!can} aria-label="Bắt buộc" onClick={e => e.stopPropagation()} onChange={() => saveFrame({ ...f, crit: f.crit.map(x => x.id === c.id ? { ...x, req: !x.req } : x) })} /> },
            { key: 'act', label: '', width: '150px', raw: true, sum: false, cell: c => edit === c.id ? saveBtns(() => { saveFrame({ ...f, crit: f.crit.map(x => x.id === c.id ? { ...x, name: (ev.name ?? x.name).trim() || x.name, desc: ev.desc ?? x.desc } : x) }); setEdit(null) })
              : icons(() => { setEdit(c.id); setEv({}) }, () => setAsk({ text: `Bỏ tiêu chí “${c.name}” khỏi khung chung?`, run: () => saveFrame({ ...f, crit: f.crit.filter(x => x.id !== c.id) }) })) },
          ]} />
        {addBar(<>{inp(nw.name ?? '', v => setNw({ ...nw, name: v }), 'Tên tiêu chí')}<select className="cin" value={nw.comp ?? 'tk'} onChange={e => setNw({ ...nw, comp: e.target.value })} aria-label="Năng lực">{comps.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</select>{inp(nw.desc ?? '', v => setNw({ ...nw, desc: v }), 'Yêu cầu cần đạt')}</>,
          () => { if (!nw.name?.trim()) return P.setMsg('Nhập tên tiêu chí'); saveFrame({ ...f, crit: [...f.crit, { id: uid('c'), name: nw.name.trim(), comp: nw.comp ?? 'tk', req: false, desc: nw.desc ?? '' }] }); setNw({ color: '#e08a0b' }) })}
      </Panel>
      <Panel icon="award" title="2. Mức yêu cầu đạt">
        <div className="form"><label className="fld"><span>Chuyên cần tối thiểu (%)</span><input type="number" min={0} max={100} defaultValue={f.att} disabled={!can} onBlur={e => +e.target.value !== f.att && saveFrame({ ...f, att: Math.round(+e.target.value) || 0 })} /></label>
          <label className="fld"><span>Điểm tổng tối thiểu (/10)</span><input type="number" min={0} max={10} step={0.5} defaultValue={f.score} disabled={!can} onBlur={e => +e.target.value !== f.score && saveFrame({ ...f, score: +e.target.value || 0 })} /></label></div>
        <small className="sub">Đạt khi chuyên cần ≥ {f.att}% và điểm ≥ {f.score}/10{f.crit.some(c => c.req) ? ', không tiêu chí bắt buộc nào ở mức Chưa đạt' : ''}.</small></Panel></> }
  if (kind === 'comp') { type CR = { code: string; name: string; sys: boolean; id?: string }
    const rows: CR[] = [...Object.entries(COMP).map(([c, n]) => ({ code: c, name: n, sys: true })), ...db.cat.filter(c => c.kind === 'comp').map(c => ({ code: c.code ?? c.id, name: c.name, sys: false, id: c.id }))]
    const tps = (c: string) => db.progs.filter(p => (p.comps ?? []).includes(c)); const cts = (c: string) => curs.filter(x => (x.comps ?? []).includes(c))
    body = <>
      <p className="note"><Ic n="info" /> Danh mục năng lực dùng chung cho cả hai phân hệ: chương trình đào tạo chọn năng lực hướng tới, chương trình giáo dục chọn năng lực giáo viên cần có — hệ thống tự khớp hai bên theo năng lực.</p>
      <DataTable id="ph2-comp" plain rows={rows} rowKey={r => r.code} noun="năng lực"
        cols={[
          { key: 'name', label: 'Năng lực', name: true, sort: r => r.name, cell: r => edit === r.code ? inp(ev.name ?? r.name, v => setEv({ ...ev, name: v })) : <><b>{r.name}</b>{r.sys && <small>Hệ thống</small>}</> },
          { key: 'tp', label: 'Chương trình đào tạo phát triển', sort: r => tps(r.code).length, cell: r => tps(r.code).map(p => p.code).join(', ') || '—' },
          { key: 'ct', label: 'Chương trình giáo dục yêu cầu', sort: r => cts(r.code).length, cell: r => cts(r.code).map(x => x.code ?? x.name).join(', ') || '—' },
          { key: 'act', label: '', width: '150px', raw: true, sum: false, cell: r => r.sys ? <span className="pill draft plain">Hệ thống</span> : edit === r.code ? saveBtns(() => P.run(supabase.from('ph2_catalog').update({ name: ev.name }).eq('id', r.id!), '✓ Đã lưu').then(done))
            : icons(() => { setEdit(r.code); setEv({ name: r.name }) }, () => setAsk({ text: `Xoá năng lực “${r.name}”?`, run: () => P.run(supabase.from('ph2_catalog').delete().eq('id', r.id!), '✓ Đã xoá') })) },
        ]} />
      {addBar(inp(nw.name ?? '', v => setNw({ ...nw, name: v }), 'Tên năng lực mới'), () => { const n = (nw.name ?? '').trim(); if (!n || !orgId) return P.setMsg('Nhập tên năng lực')
        P.run(supabase.from('ph2_catalog').insert({ owner_org_id: orgId, kind: 'comp', code: slug(n), name: n, sort: rows.length + 1 }), '✓ Đã thêm năng lực').then(done) })}</> }
  if (kind === 'group') { const gs = [...db.cat.filter(c => c.kind === 'group'), { id: 'CXN', code: CXN.code, name: CXN.name, color: CXN.color, sys: true } as never]
    body = <><DataTable id="ph2-group" plain rows={gs as { id: string; code: string; name: string; color: string; sys?: boolean }[]} rowKey={g => g.id} noun="nhóm"
      cols={[
        { key: 'code', label: 'Mã', width: '120px', sort: g => g.code, cell: g => g.code },
        { key: 'name', label: 'Tên nhóm', name: true, sort: g => g.name, cell: g => edit === g.id ? inp(ev.name, v => setEv({ ...ev, name: v })) : <><span className="dotc" style={cssVar(g.color)} /><b>{g.name}</b></> },
        { key: 'color', label: 'Màu', width: '110px', raw: true, cell: g => edit === g.id ? inp(ev.color, v => setEv({ ...ev, color: v }), '', 'color') : g.color },
        { key: 'use', label: 'Đang dùng', cell: g => `${g.sys ? progsOf(p => !p.group_code || !k.groups().some(x => x.code === p.group_code)) : progsOf(p => p.group_code === g.code)} chương trình` },
        { key: 'act', label: '', width: '150px', raw: true, sum: false, cell: g => g.sys ? <span className="pill draft plain">Hệ thống</span> : edit === g.id ? saveBtns(() => P.run(supabase.from('ph2_catalog').update({ name: ev.name, color: ev.color }).eq('id', g.id), '✓ Đã lưu').then(done))
          : icons(() => { setEdit(g.id); setEv({ name: g.name, color: g.color }) }, () => setAsk({ text: `Xoá nhóm “${g.name}”? ${progsOf(p => p.group_code === g.code)} chương trình sẽ chuyển về “Chưa xếp nhóm”.`, run: async () => { await supabase.from('ph2_programs').update({ group_code: null }).eq('group_code', g.code); await P.run(supabase.from('ph2_catalog').delete().eq('id', g.id), '✓ Đã xoá') } })) },
      ]} />
      {addBar(<>{inp(nw.code ?? '', v => setNw({ ...nw, code: v }), 'Mã, VD: STEM-AI')}{inp(nw.name ?? '', v => setNw({ ...nw, name: v }), 'Tên nhóm chương trình')}{inp(nw.color ?? '#e08a0b', v => setNw({ ...nw, color: v }), '', 'color')}</>, () => {
        const code = (nw.code ?? '').trim().toUpperCase(), n = (nw.name ?? '').trim(); if (!n || !code || code === 'CXN' || k.groups().some(g => g.code === code) || !orgId) return P.setMsg('Mã trống hoặc đã có')
        P.run(supabase.from('ph2_catalog').insert({ owner_org_id: orgId, kind: 'group', code, name: n, color: nw.color, sort: k.groups().length + 1 }), '✓ Đã thêm vào danh mục').then(done) })}</> }
  if (kind === 'subject') { const ss = catOf(P.cat, 'subject')
    body = <><DataTable id="ph2-subj" plain rows={ss} rowKey={s => s.id} noun="học phần"
      cols={[
        { key: 'code', label: 'Mã', width: '120px', sort: s => s.code, cell: s => s.code },
        { key: 'name', label: 'Học phần', name: true, sort: s => s.name, cell: s => edit === s.id ? inp(ev.name, v => setEv({ ...ev, name: v })) : <><span className="sglyph"><svg viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: SGLYPH[s.code] ?? SGLYPH.khtn }} /></span><b>{s.name}</b></> },
        { key: 'tp', label: 'Chương trình đào tạo', sum: 'sum', sort: s => progsOf(p => k.subjectsOf(p).includes(s.code)), cell: s => progsOf(p => k.subjectsOf(p).includes(s.code)) },
        { key: 'tv', label: 'Học viên theo học phần', sum: 'sum', sort: s => db.teachers.filter(t => t.subj === s.code).length, cell: s => db.teachers.filter(t => t.subj === s.code).length },
        { key: 'act', label: '', width: '150px', raw: true, sum: false, cell: s => !s.owner_org_id ? <span className="pill draft plain">Dùng chung</span> : edit === s.id ? saveBtns(() => P.run(supabase.from('curriculum_catalog').update({ name: ev.name }).eq('id', s.id), '✓ Đã lưu').then(x => { done(x); P.reloadCat() }))
          : icons(() => { setEdit(s.id); setEv({ name: s.name }) }, () => { const n = progsOf(p => k.subjectsOf(p).includes(s.code)); if (n) return P.setMsg(`Học phần đang dùng trong ${n} chương trình — gỡ khỏi chương trình trước khi xoá`)
            setAsk({ text: `Xoá học phần “${s.name}”?`, run: () => P.run(supabase.from('curriculum_catalog').delete().eq('id', s.id), '✓ Đã xoá').then(() => P.reloadCat()) }) }) },
      ]} />
      {addBar(<>{inp(nw.code ?? '', v => setNw({ ...nw, code: v }), 'Mã, VD: my_thuat')}{inp(nw.name ?? '', v => setNw({ ...nw, name: v }), 'Tên học phần')}</>, () => {
        const n = (nw.name ?? '').trim(); const code = slug(nw.code || n); if (!n || !code || ss.some(s => s.code === code) || !orgId) return P.setMsg('Mã trống hoặc đã có')
        P.run(supabase.from('curriculum_catalog').insert({ owner_org_id: orgId, kind: 'subject', code, name: n, sort: 900 }), '✓ Đã thêm vào danh mục').then(x => { done(x); P.reloadCat() }) })}</> }
  if (kind === 'format') body = <><DataTable id="ph2-format" plain rows={Object.entries(TFORMAT) as [Format, string][]} rowKey={r => r[0]} noun="hình thức"
      cols={[
        { key: 'code', label: 'Mã', width: '120px', cell: r => r[0] },
        { key: 'name', label: 'Hình thức', name: true, cell: r => <b>{r[1]}</b> },
        { key: 'note', label: 'Ghi chú', cell: r => ({ off: 'Học tại hội trường, điểm danh tại chỗ', on: 'Qua lớp học ảo, điểm danh tự động', mix: 'Xen kẽ trực tiếp và trực tuyến' }[r[0]]) },
        { key: 'use', label: 'Đang dùng', cell: r => `${progsOf(p => p.format === r[0])} chương trình` },
      ]} /><p className="note">Hình thức là danh mục hệ thống, gắn với cách điểm danh và lớp học ảo.</p></>
  if (kind === 'unit') { const us = db.cat.filter(c => c.kind === 'unit')
    body = <><DataTable id="ph2-unit" plain rows={us} rowKey={u => u.id} noun="đơn vị"
      cols={[
        { key: 'name', label: 'Đơn vị', name: true, sort: u => u.name, cell: u => edit === u.id ? inp(ev.name, v => setEv({ ...ev, name: v })) : <b>{u.name}</b> },
        { key: 'type', label: 'Loại', sort: u => u.info.type, cell: u => edit === u.id ? inp(ev.type, v => setEv({ ...ev, type: v })) : u.info.type },
        { key: 'use', label: 'Đang dùng', cell: u => `${progsOf(p => p.issuer === u.name) + db.plans.filter(x => x.unit === u.name).length} chương trình/kế hoạch` },
        { key: 'act', label: '', width: '150px', raw: true, sum: false, cell: u => edit === u.id ? saveBtns(() => P.run(supabase.from('ph2_catalog').update({ name: ev.name, info: { type: ev.type } }).eq('id', u.id), '✓ Đã lưu').then(done))
          : icons(() => { setEdit(u.id); setEv({ name: u.name, type: u.info.type ?? '' }) }, () => setAsk({ text: 'Xoá đơn vị này?', run: () => P.run(supabase.from('ph2_catalog').delete().eq('id', u.id), '✓ Đã xoá') })) },
      ]} />
      {addBar(<>{inp(nw.name ?? '', v => setNw({ ...nw, name: v }), 'Tên đơn vị')}{inp(nw.type ?? '', v => setNw({ ...nw, type: v }), 'Loại, VD: Trường THCS')}</>, () => { const n = (nw.name ?? '').trim(); if (!n || !orgId) return P.setMsg('Nhập tên')
        P.run(supabase.from('ph2_catalog').insert({ owner_org_id: orgId, kind: 'unit', name: n, info: { type: nw.type || 'Đơn vị' } }), '✓ Đã thêm vào danh mục').then(done) })}</> }
  if (kind === 'trainer') { const rs = db.cat.filter(c => c.kind === 'trainer')
    body = <><DataTable id="ph2-trainer" plain rows={rs} rowKey={r => r.id} noun="giảng viên"
      cols={[
        { key: 'name', label: 'Giảng viên', name: true, sort: r => r.name, cell: r => edit === r.id ? inp(ev.name, v => setEv({ ...ev, name: v })) : <b>{r.name}</b> },
        { key: 'org', label: 'Đơn vị', sort: r => r.info.org, cell: r => edit === r.id ? inp(ev.org, v => setEv({ ...ev, org: v })) : r.info.org },
        { key: 'field', label: 'Chuyên môn', sort: r => r.info.field, cell: r => edit === r.id ? inp(ev.field, v => setEv({ ...ev, field: v })) : r.info.field },
        { key: 'n', label: 'Buổi phụ trách', sum: 'sum', sort: r => db.sess.filter(s => s.trainer === r.name).length, cell: r => db.sess.filter(s => s.trainer === r.name).length },
        { key: 'act', label: '', width: '150px', raw: true, sum: false, cell: r => edit === r.id ? saveBtns(() => P.run(supabase.from('ph2_catalog').update({ name: ev.name, info: { org: ev.org, field: ev.field } }).eq('id', r.id), '✓ Đã lưu').then(done))
          : icons(() => { setEdit(r.id); setEv({ name: r.name, org: r.info.org ?? '', field: r.info.field ?? '' }) }, () => setAsk({ text: 'Xoá giảng viên này? Các buổi đã phân công vẫn giữ tên.', run: () => P.run(supabase.from('ph2_catalog').delete().eq('id', r.id), '✓ Đã xoá') })) },
      ]} />
      {addBar(<>{inp(nw.name ?? '', v => setNw({ ...nw, name: v }), 'Họ tên, học hàm/học vị')}{inp(nw.org ?? '', v => setNw({ ...nw, org: v }), 'Đơn vị công tác')}{inp(nw.field ?? '', v => setNw({ ...nw, field: v }), 'Chuyên môn')}</>, () => { const n = (nw.name ?? '').trim(); if (!n || !orgId) return P.setMsg('Nhập tên')
        P.run(supabase.from('ph2_catalog').insert({ owner_org_id: orgId, kind: 'trainer', name: n, info: { org: nw.org ?? '', field: nw.field ?? '' } }), '✓ Đã thêm vào danh mục').then(done) })}</> }
  return <>
    <div className="toolbar"><Seg label="Loại danh mục" items={[['frame', 'Khung đánh giá chung'], ['comp', 'Năng lực'], ['group', 'Nhóm chương trình'], ['subject', 'Học phần'], ['format', 'Hình thức'], ['unit', 'Đơn vị đào tạo'], ['trainer', 'Giảng viên']]} value={kind} onChange={v => { setKind(v); setEdit(null); setAsk(null); setNw({ color: '#e08a0b' }) }} />
      <HNote tip="Danh mục dùng chung cho chương trình, kế hoạch đào tạo và đánh giá." /></div>
    {ask && <Confirm danger text={ask.text} yes="Xoá" onNo={() => setAsk(null)} onYes={() => { ask.run(); setAsk(null) }} />}
    {body ?? <Empty>—</Empty>}
  </>
}
