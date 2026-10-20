import { useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../../lib/supabase'
import './ph1.css'

// Thành phần giao diện dùng chung cho mục 1.1 (Chương trình giáo dục, Học liệu, Phân phối, Giáo án, Theo dõi, E-learning)

export type TreeNode = { id: string; label: ReactNode; meta?: ReactNode; badge?: ReactNode; color?: string; children?: TreeNode[] }

// Cây phân cấp: thụt lề có đường dẫn, mở / đóng từng nhánh, chọn một nút
export function Tree({ nodes, selected, onSelect, defaultOpen = 1 }: { nodes: TreeNode[]; selected?: string | null; onSelect?: (id: string) => void; defaultOpen?: number }) {
  return <ul className="p1-tree" role="tree">{nodes.map(n => <TreeItem key={n.id} n={n} depth={0} selected={selected} onSelect={onSelect} defaultOpen={defaultOpen} />)}</ul>
}
function TreeItem({ n, depth, selected, onSelect, defaultOpen }: { n: TreeNode; depth: number; selected?: string | null; onSelect?: (id: string) => void; defaultOpen: number }) {
  const has = !!n.children?.length
  const [open, setOpen] = useState(depth < defaultOpen)
  return (
    <li role="treeitem" aria-expanded={has ? open : undefined} aria-selected={selected === n.id}>
      <div className={'p1-node' + (selected === n.id ? ' on' : '')}>
        {has ? <button type="button" className="p1-twisty" aria-label={open ? 'Thu gọn' : 'Mở rộng'} onClick={() => setOpen(!open)}>{open ? '▾' : '▸'}</button> : <span className="p1-twisty" />}
        {n.color && <i className="p1-dot" style={{ background: n.color }} aria-hidden="true" />}
        <button type="button" className="p1-nodebtn" onClick={() => { onSelect?.(n.id); if (has && !open) setOpen(true) }}>
          <span className="p1-nodelabel">{n.label}</span>{n.meta && <small>{n.meta}</small>}
        </button>
        {n.badge}
      </div>
      {has && open && <ul role="group">{n.children!.map(c => <TreeItem key={c.id} n={c} depth={depth + 1} selected={selected} onSelect={onSelect} defaultOpen={defaultOpen} />)}</ul>}
    </li>
  )
}

export function Pill({ tone = '', children }: { tone?: '' | 'good' | 'warn' | 'bad' | 'info'; children: ReactNode }) {
  return <span className={'p1-pill ' + tone}>{children}</span>
}
export function Code({ color, children }: { color?: string | null; children: ReactNode }) {
  return <span className="p1-code" style={{ background: color ?? '#475569' }}>{children}</span>
}
export function Empty({ children }: { children: ReactNode }) { return <div className="p1-empty">{children}</div> }
export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: string }) {
  return <div className={'p1-stat ' + (tone ?? '')}><span>{label}</span><b>{value}</b>{sub && <small>{sub}</small>}</div>
}
export function Progress({ value, tone }: { value: number; tone?: string }) {
  const v = Math.max(0, Math.min(100, Math.round(value)))
  return <div className={'p1-progress ' + (tone ?? '')} role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}><i style={{ width: v + '%' }} /><span>{v}%</span></div>
}
// Thanh điều hướng dọc trong một màn chi tiết
export function SideNav<T extends string>({ items, value, onChange }: { items: [T, string, ReactNode?][]; value: T; onChange: (v: T) => void }) {
  return <nav className="p1-sidenav">{items.map(([k, l, n]) => <button type="button" key={k} className={value === k ? 'on' : ''} onClick={() => onChange(k)}>{l}{n !== undefined && <small>{n}</small>}</button>)}</nav>
}
export function Section({ title, actions, children }: { title: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return <section className="p1-section"><header><h3>{title}</h3>{actions && <div className="p1-actions">{actions}</div>}</header>{children}</section>
}

// Đơn vị đọc được (để chọn trường, hiện tên) + cấp dưới của mình
export type Org = { id: string; name: string; type: string; parent_id: string | null; code: string | null }
export function useOrgList() {
  const [orgs, setOrgs] = useState<Org[]>([])
  useEffect(() => { supabase.from('organizations').select('id, name, type, parent_id, code').order('name').then(({ data }) => setOrgs((data as Org[]) ?? [])) }, [])
  return orgs
}
export function useRpcBool(fn: string) {
  const [v, setV] = useState(false)
  useEffect(() => { supabase.rpc(fn).then(({ data }) => setV(data === true)) }, [fn])
  return v
}

export const SCHOOL_YEAR = '2026-2027'
export const fmtD = (d: string | null | undefined) => (d ? new Date(d + (d.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) : '—')
export const fmtDY = (d: string | null | undefined) => (d ? new Date(d + (d.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('vi-VN') : '—')
export const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const addD = (d: string, n: number) => { const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() + n); return iso(x) }
export const today = () => iso(new Date())
export function errMsg(m: string) {
  if (/row-level security|permission denied/i.test(m)) return 'Bạn không có quyền thực hiện thao tác này.'
  if (/does not exist|schema cache/i.test(m)) return 'CSDL chưa có phần này — chạy migration 058_ph1_framework.sql.'
  if (/duplicate key/i.test(m)) return 'Đã có mục trùng.'
  return m
}
