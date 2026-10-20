import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { CAT_KIND, errText, type CatItem, type CatKind, type Org } from './api'

// Danh mục dùng cho chương trình đào tạo: mục hệ thống (KDI quản lý) + mục của cấp trên được kế thừa + mục riêng của đơn vị.
// Đơn vị thêm / sửa / xoá mục riêng; ẩn mục kế thừa không dùng (ẩn cho cả đơn vị trực thuộc).
export function CatalogPanel({ orgId, all, hidden, orgs, below, canManage, isPlatform, onChange }: {
  orgId: string; all: CatItem[]; hidden: { org_id: string; item_id: string }[]; orgs: Org[]; below: Set<string>
  canManage: boolean; isPlatform: boolean; onChange: () => void
}) {
  const [kind, setKind] = useState<CatKind>('category')
  const [form, setForm] = useState<Partial<CatItem> | null>(null)
  const [msg, setMsg] = useState('')
  const items = all.filter(i => i.kind === kind && (i.owner_org_id === null || !below.has(i.owner_org_id)))
  const myHidden = new Set(hidden.filter(h => h.org_id === orgId).map(h => h.item_id))
  const upHidden = new Set(hidden.filter(h => h.org_id !== orgId && !below.has(h.org_id)).map(h => h.item_id))
  const ownerName = (id: string | null) => (id === null ? 'Hệ thống' : id === orgId ? 'Đơn vị mình' : orgs.find(o => o.id === id)?.name ?? 'Cấp trên')
  const editable = (i: Pick<CatItem, 'owner_org_id'>) => canManage && (i.owner_org_id === orgId || (i.owner_org_id === null && isPlatform))

  async function save(e: React.FormEvent) {
    e.preventDefault(); if (!form) return
    const row = { kind, code: (form.code ?? '').trim(), name: (form.name ?? '').trim(), description: form.description?.trim() || null,
      color: form.color || null, sort: Number(form.sort ?? 0) }
    const { error } = form.id
      ? await supabase.from('curriculum_catalog').update(row).eq('id', form.id)
      : await supabase.from('curriculum_catalog').insert({ ...row, owner_org_id: form.owner_org_id === null ? null : orgId })
    if (error) return setMsg(errText(error.message))
    setForm(null); setMsg(''); onChange()
  }
  async function remove(i: CatItem) {
    if (!confirm(`Xoá “${i.name}” khỏi danh mục? Chương trình đang dùng mã ${i.code} vẫn giữ mã này.`)) return
    const { error } = await supabase.from('curriculum_catalog').delete().eq('id', i.id)
    if (error) setMsg(errText(error.message)); else onChange()
  }
  async function toggleHide(i: CatItem) {
    const { error } = myHidden.has(i.id)
      ? await supabase.from('curriculum_catalog_hidden').delete().eq('org_id', orgId).eq('item_id', i.id)
      : await supabase.from('curriculum_catalog_hidden').insert({ org_id: orgId, item_id: i.id })
    if (error) setMsg(errText(error.message)); else onChange()
  }

  return (
    <div className="cur-catalog">
      <div className="bar">
        <div className="segmented" role="tablist">
          {(Object.keys(CAT_KIND) as CatKind[]).map(k => (
            <button type="button" key={k} role="tab" aria-selected={kind === k} className={kind === k ? 'on' : ''} onClick={() => { setKind(k); setForm(null) }}>{CAT_KIND[k][0]}</button>
          ))}
        </div>
        {canManage && <div className="actions">
          <button type="button" className="primary" onClick={() => setForm({ owner_org_id: orgId, sort: items.length + 1 })}>+ Thêm mục riêng</button>
          {isPlatform && <button type="button" onClick={() => setForm({ owner_org_id: null, sort: items.length + 1 })}>+ Thêm mục hệ thống</button>}
        </div>}
      </div>
      <p className="sub">{CAT_KIND[kind][1] ? CAT_KIND[kind][1] + '. ' : ''}Mục hệ thống và của cấp trên được kế thừa; đơn vị thêm mục riêng hoặc ẩn mục không dùng (ẩn cho cả đơn vị trực thuộc). Mã đã gán cho chương trình không đổi khi đổi tên.</p>
      {msg && <p className="msg">{msg}</p>}
      {form && (
        <form className="panel formgrid" onSubmit={save}>
          <label className="field"><span>Mã *</span><input required value={form.code ?? ''} onChange={e => setForm({ ...form, code: e.target.value })} disabled={!!form.id} placeholder="VD: CT6, robot_co_ban" /></label>
          <label className="field"><span>Tên *</span><input required value={form.name ?? ''} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
          <label className="field"><span>Thứ tự</span><input type="number" value={form.sort ?? 0} onChange={e => setForm({ ...form, sort: Number(e.target.value) })} /></label>
          {kind === 'category' && <label className="field"><span>Màu</span><input type="color" value={form.color ?? '#2a78d6'} onChange={e => setForm({ ...form, color: e.target.value })} /></label>}
          <label className="field" style={{ gridColumn: '1 / -1' }}><span>Mô tả</span><input value={form.description ?? ''} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
          <div className="formactions"><button className="primary" type="submit">Lưu</button> <button type="button" onClick={() => setForm(null)}>Huỷ</button></div>
        </form>
      )}
      <div className="wrap">
        <table>
          <thead><tr><th>Mã</th><th>Tên</th><th>Nguồn</th><th>Trạng thái</th><th></th></tr></thead>
          <tbody>
            {items.map(i => {
              const off = myHidden.has(i.id) || upHidden.has(i.id)
              return (
                <tr key={i.id} className={off ? 'cur-muted' : ''}>
                  <td><code>{i.code}</code></td>
                  <td>{i.color && <span className="cur-dot" style={{ background: i.color }} aria-hidden="true" />}<b>{i.name}</b>{i.description && <><br /><small className="sub">{i.description}</small></>}</td>
                  <td>{ownerName(i.owner_org_id)}</td>
                  <td>{upHidden.has(i.id) ? 'Cấp trên đã ẩn' : myHidden.has(i.id) ? 'Đã ẩn' : 'Đang dùng'}</td>
                  <td className="actions">
                    {editable(i) && <><button type="button" onClick={() => setForm(i)}>Sửa</button><button type="button" className="danger" onClick={() => remove(i)}>Xoá</button></>}
                    {canManage && i.owner_org_id !== orgId && !upHidden.has(i.id) && <button type="button" onClick={() => toggleHide(i)}>{myHidden.has(i.id) ? 'Dùng lại' : 'Ẩn'}</button>}
                  </td>
                </tr>
              )
            })}
            {items.length === 0 && <tr><td colSpan={5}>Chưa có mục nào.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
