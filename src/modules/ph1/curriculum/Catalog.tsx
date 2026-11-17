import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { CAT_KIND, MAIN_KINDS, errText, type CatItem, type CatKind, type Org } from './api'
import { Confirm, HNote, Ic, Panel, cssVar } from '../mau/kit'
import { DataTable } from '../mau/DataTable'

// Danh mục dùng chung của 1.1: Cấp học › Khối › Lớp (nối bằng parent_code), Nhóm chương trình, Môn học; các loại khác là danh mục phụ.
// Nguồn mục: mục hệ thống (KDI quản lý) + mục của cấp trên được kế thừa + mục riêng của đơn vị.
// Đơn vị thêm / sửa / xoá mục riêng; ẩn mục kế thừa không dùng (ẩn cho cả đơn vị trực thuộc).
export function CatalogPanel({ orgId, all, hidden, orgs, below, canManage, isPlatform, onChange, addSignal = 0 }: {
  orgId: string; all: CatItem[]; hidden: { org_id: string; item_id: string }[]; orgs: Org[]; below: Set<string>
  canManage: boolean; isPlatform: boolean; onChange: () => void
  /** bấm “Thêm mục” trên thanh bước (bản mẫu v315) */ addSignal?: number
}) {
  const [kind, setKind] = useState<CatKind>('level')
  const [form, setForm] = useState<Partial<CatItem> | null>(null)
  const [msg, setMsg] = useState('')
  const [ask, setAsk] = useState<CatItem | null>(null)
  const items = all.filter(i => i.kind === kind && (i.owner_org_id === null || !below.has(i.owner_org_id)))
  const parentKind: CatKind | null = kind === 'grade' ? 'level' : kind === 'class' ? 'grade' : null
  const parents = parentKind ? all.filter(i => i.kind === parentKind && (i.owner_org_id === null || !below.has(i.owner_org_id))) : []
  const parentName = (code: string | null) => (code ? parents.find(p => p.code === code)?.name ?? code : '—')
  const myHidden = new Set(hidden.filter(h => h.org_id === orgId).map(h => h.item_id))
  const upHidden = new Set(hidden.filter(h => h.org_id !== orgId && !below.has(h.org_id)).map(h => h.item_id))
  const ownerName = (id: string | null) => (id === null ? 'Hệ thống' : id === orgId ? 'Đơn vị mình' : orgs.find(o => o.id === id)?.name ?? 'Cấp trên')
  useEffect(() => { if (addSignal) setForm({ owner_org_id: orgId, sort: items.length + 1 }) }, [addSignal])
  const editable = (i: Pick<CatItem, 'owner_org_id'>) => canManage && (i.owner_org_id === orgId || (i.owner_org_id === null && isPlatform))

  async function save(e: React.FormEvent) {
    e.preventDefault(); if (!form) return
    const row = { kind, code: (form.code ?? '').trim(), name: (form.name ?? '').trim(), description: form.description?.trim() || null,
      color: form.color || null, sort: Number(form.sort ?? 0), parent_code: parentKind ? form.parent_code || null : null }
    if (parentKind && !row.parent_code) return setMsg(`Chọn ${CAT_KIND[parentKind][0].toLowerCase()} mà mục này thuộc về.`)
    const { error } = form.id
      ? await supabase.from('curriculum_catalog').update(row).eq('id', form.id)
      : await supabase.from('curriculum_catalog').insert({ ...row, owner_org_id: form.owner_org_id === null ? null : orgId })
    if (error) return setMsg(errText(error.message))
    setForm(null); setMsg(''); onChange()
  }
  async function remove(i: CatItem) {
    const { error } = await supabase.from('curriculum_catalog').delete().eq('id', i.id)
    if (error) setMsg(errText(error.message)); else onChange()
  }
  async function toggleHide(i: CatItem) {
    const { error } = myHidden.has(i.id)
      ? await supabase.from('curriculum_catalog_hidden').delete().eq('org_id', orgId).eq('item_id', i.id)
      : await supabase.from('curriculum_catalog_hidden').insert({ org_id: orgId, item_id: i.id })
    if (error) setMsg(errText(error.message)); else onChange()
  }

  return (<>
    <div className="toolbar">
      <div className="seg" role="group" aria-label="Loại danh mục">{MAIN_KINDS.map(k => <button type="button" key={k} className={kind === k ? 'on' : ''} onClick={() => { setKind(k); setForm(null) }}>{CAT_KIND[k][0]}</button>)}</div>
      <HNote tip={(CAT_KIND[kind][1] ? CAT_KIND[kind][1] + '. ' : '') + 'Mục hệ thống và của cấp trên được kế thừa; đơn vị thêm mục riêng hoặc ẩn mục không dùng (ẩn cho cả đơn vị trực thuộc). Mã đã gán cho chương trình không đổi khi đổi tên.'} />
      {isPlatform && canManage && <button type="button" className="btn sm" style={{ marginLeft: 'auto' }} onClick={() => setForm({ owner_org_id: null, sort: items.length + 1 })}><Ic n="plus" /> Thêm mục hệ thống</button>}
    </div>
    {msg && <p className="msg">{msg}</p>}
    {ask && <Confirm danger text={`Xoá “${ask.name}” khỏi danh mục? Chương trình đang dùng mã ${ask.code} vẫn giữ mã này.`} yes="Xoá" onNo={() => setAsk(null)} onYes={() => { remove(ask); setAsk(null) }} />}
    {form && <Panel icon={form.id ? 'edit' : 'plus'} title={form.id ? `Sửa ${CAT_KIND[kind][0].toLowerCase()}` : `Thêm ${CAT_KIND[kind][0].toLowerCase()}${form.owner_org_id === null ? ' (hệ thống)' : ''}`}>
      <form onSubmit={save} style={{ display: 'grid', gap: 14 }}>
        <div className="form">
          <label className="fld"><span>Mã *</span><input required value={form.code ?? ''} onChange={e => setForm({ ...form, code: e.target.value })} disabled={!!form.id} placeholder={kind === 'grade' ? 'Số khối, vd 6' : kind === 'class' ? 'VD: 6A1' : 'VD: CT6, robot_co_ban'} /></label>
          {parentKind && <label className="fld"><span>Thuộc {CAT_KIND[parentKind][0].toLowerCase()} *</span><select required value={form.parent_code ?? ''} onChange={e => setForm({ ...form, parent_code: e.target.value })}>
            <option value="">— chọn —</option>{parents.map(p => <option key={p.id} value={p.code}>{p.name}</option>)}</select></label>}
          <label className="fld"><span>Tên *</span><input required value={form.name ?? ''} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
          <label className="fld"><span>Thứ tự</span><input type="number" value={form.sort ?? 0} onChange={e => setForm({ ...form, sort: Number(e.target.value) })} /></label>
          {kind === 'category' && <label className="fld"><span>Màu</span><input type="color" value={form.color ?? '#2a78d6'} onChange={e => setForm({ ...form, color: e.target.value })} style={{ height: 40, padding: 4 }} /></label>}
          <label className="fld wide"><span>Mô tả</span><input value={form.description ?? ''} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
        </div>
        <div className="formact"><button className="btn primary" type="submit"><Ic n="check" /> Lưu</button><button className="btn" type="button" onClick={() => setForm(null)}>Huỷ</button></div>
      </form></Panel>}
    <DataTable id={'cat-' + kind} plain rows={items} rowKey={i => i.id} noun="mục" onOpen={i => editable(i) ? setForm(i) : undefined} empty={<p className="sub">Chưa có mục nào.</p>}
      cols={[
        { key: 'code', label: 'Mã', width: '120px', sort: i => i.code, cell: i => i.code },
        { key: 'name', label: 'Tên', name: true, sort: i => i.name, cell: i => <>{i.color && <span className="dotc" style={cssVar(i.color)} />}<b style={myHidden.has(i.id) || upHidden.has(i.id) ? { opacity: .55 } : undefined}>{i.name}</b></> },
        { key: 'parent', label: 'Thuộc', sort: i => parentName(i.parent_code), cell: i => parentKind ? parentName(i.parent_code) : '—' },
        { key: 'note', label: 'Ghi chú', sort: i => i.description ?? null, cell: i => <>{i.description || (i.owner_org_id === null ? '' : ownerName(i.owner_org_id))}{upHidden.has(i.id) ? ' · cấp trên đã ẩn' : myHidden.has(i.id) ? ' · đã ẩn' : ''}</> },
        { key: 'act', label: '', width: '120px', raw: true, sum: false, cell: i => <span style={{ whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
          {editable(i) && <><button type="button" className="btn sm ghost" title="Sửa" aria-label="Sửa" onClick={() => setForm(i)}><Ic n="edit" /></button><button type="button" className="btn sm ghost" title="Xoá" aria-label="Xoá" onClick={() => setAsk(i)}><Ic n="trash" /></button></>}
          {canManage && i.owner_org_id !== orgId && !upHidden.has(i.id) && <button type="button" className="btn sm ghost" onClick={() => toggleHide(i)}>{myHidden.has(i.id) ? 'Dùng lại' : 'Ẩn'}</button>}</span> },
      ]} />
  </>)
}
