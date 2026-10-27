import { Fragment, useEffect, useState, type ReactNode } from 'react'
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
export const fmtD = (d: string | null | undefined) => (d ? `${Number(d.slice(8, 10))}/${Number(d.slice(5, 7))}` : '—')
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

// ===== Danh sách kiểu "kho": thanh lọc, Thẻ / Bảng, ngăn xem nhanh =====
export type ViewMode = 'grid' | 'table'
export function useViewMode(key: string, def: ViewMode = 'grid'): [ViewMode, (v: ViewMode) => void] {
  const [v, setV] = useState<ViewMode>(() => { try { return (localStorage.getItem('ph1.view.' + key) as ViewMode) || def } catch { return def } })
  return [v, (x: ViewMode) => { setV(x); try { localStorage.setItem('ph1.view.' + key, x) } catch { /* bỏ qua */ } }]
}
export type FilterDef = { key: string; label: string; options: { value: string; label: string }[] }
export function Toolbar({ q, onQ, placeholder, filters = [], values = {}, onFilter, view, onView, children }: {
  q: string; onQ: (v: string) => void; placeholder?: string; filters?: FilterDef[]; values?: Record<string, string>; onFilter?: (k: string, v: string) => void
  view?: ViewMode; onView?: (v: ViewMode) => void; children?: ReactNode
}) {
  return (
    <div className="p1-toolbar">
      <div className="p1-search"><input type="search" value={q} onChange={e => onQ(e.target.value)} placeholder={placeholder ?? 'Tìm kiếm…'} aria-label="Tìm kiếm" /></div>
      {filters.map(f => <select key={f.key} value={values[f.key] ?? ''} onChange={e => onFilter?.(f.key, e.target.value)} aria-label={f.label}>
        <option value="">{f.label}</option>{f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>)}
      {view && onView && <div className="p1-viewtoggle" role="group" aria-label="Kiểu hiển thị">
        <button type="button" className={view === 'grid' ? 'on' : ''} onClick={() => onView('grid')} aria-pressed={view === 'grid'} title="Thẻ">▦ Thẻ</button>
        <button type="button" className={view === 'table' ? 'on' : ''} onClick={() => onView('table')} aria-pressed={view === 'table'} title="Bảng">☰ Bảng</button>
      </div>}
      {children}
    </div>
  )
}
export function StatusTabs<T extends string>({ items, value, onChange }: { items: [T, string, number?][]; value: T; onChange: (v: T) => void }) {
  return <div className="p1-statustabs" role="tablist">{items.map(([k, l, n]) => <button type="button" role="tab" key={k} aria-selected={value === k} className={value === k ? 'on' : ''} onClick={() => onChange(k)}>{l}{n !== undefined && <small>{n}</small>}</button>)}</div>
}
// Ngăn xem nhanh bên phải (bản thu gọn) — chân ngăn có nút "Mở rộng" ra trang đầy đủ
export function Drawer({ color, badges, title, onClose, children, footer, wide }: {
  color?: string | null; badges?: ReactNode[]; title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean
}) {
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onClose])
  const c = color ?? '#1c63bb'
  return (<>
    <div className="p1-overlay" onClick={onClose} />
    <aside className={'p1-drawer' + (wide ? ' wide' : '')} role="dialog" aria-modal="true">
      <div className="p1-dhead" style={{ background: `linear-gradient(135deg, ${c}, ${shade(c, -35)})` }}>
        <button type="button" className="p1-dclose" onClick={onClose} aria-label="Đóng">✕</button>
        {badges && <div className="badges">{badges.filter(Boolean).map((b, i) => <span key={i}>{b}</span>)}</div>}
        <h3>{title}</h3>
      </div>
      <div className="p1-dbody">{children}</div>
      {footer && <div className="p1-dfoot">{footer}</div>}
    </aside>
  </>)
}
// Biểu tượng môn trên bìa thẻ (nét mảnh, theo màu chương trình) — mặc định là nguyên tử cho môn chưa có hình riêng
const GLYPH: Record<string, string> = {
  toan: '<path d="M4 7h16M7 7v11M15 7v9a2 2 0 0 0 2 2h1"/>',
  khoa_hoc: '<path d="M9 3h6M10 3v6L4.5 18a2 2 0 0 0 1.7 3h11.6a2 2 0 0 0 1.7-3L14 9V3"/><path d="M7 15h10"/>',
  khtn: '<circle cx="12" cy="12" r="1.6"/><ellipse cx="12" cy="12" rx="10" ry="4"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)"/>',
  cong_nghe: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  tin_hoc: '<path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14"/>',
  sang_che: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/>',
  robotics: '<rect x="5" y="8" width="14" height="11" rx="3"/><path d="M12 4v4M9 13h.01M15 13h.01M9 16h6"/><circle cx="12" cy="3.5" r="1"/>',
  hdtn: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
}
GLYPH.clb_robot = GLYPH.robotics; GLYPH.ai = GLYPH.tin_hoc; GLYPH.khkt = GLYPH.sang_che; GLYPH.vat_li = GLYPH.khtn; GLYPH.hoa_hoc = GLYPH.khoa_hoc; GLYPH.sinh_hoc = GLYPH.khoa_hoc; GLYPH.tnxh = GLYPH.hdtn
export function Glyph({ subject, className }: { subject?: string | null; className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: GLYPH[subject ?? ''] ?? GLYPH.khtn }} />
}

// Chuỗi bước quy trình của một mục (thay thanh tab): số bước · tên · mô tả ngắn; bước trước bước đang chọn tô nhạt
export function FlowSteps<T extends string>({ steps, value, onChange }: { steps: [T, string, ReactNode?][]; value: T | ''; onChange: (v: T) => void }) {
  const ci = steps.findIndex(s => s[0] === value)
  return <nav className="p1-flow" aria-label="Các bước">{steps.map(([k, l, d], i) => <Fragment key={k}>
    {i > 0 && <i aria-hidden="true">›</i>}
    <button type="button" className={k === value ? 'on' : ci >= 0 && i < ci ? 'past' : ''} aria-current={k === value ? 'step' : undefined} onClick={() => onChange(k)}>
      <b>{i + 1}</b><span>{l}{d != null && d !== '' && <small>{d}</small>}</span></button></Fragment>)}</nav>
}

// Thẻ có bìa nhạt theo màu chương trình + biểu tượng môn (đồng bộ với bản mẫu giao diện)
export function VCard({ color, code, status, title, subtitle, desc, chips, foot, onClick, subject, more = 'Xem chi tiết ›' }: {
  color?: string | null; code?: string | null; icon?: ReactNode; status?: ReactNode; title: ReactNode; subtitle?: ReactNode; desc?: ReactNode
  chips?: ReactNode[]; foot?: ReactNode; onClick: () => void; more?: string; subject?: string | null
}) {
  const c = color ?? '#475569'
  return (
    <button type="button" className="p1-card" onClick={onClick} style={{ ['--c' as string]: c }}>
      <div className="p1-banner">
        {code && <span className="tag">{code}</span>}{status && <span className="tag2">{status}</span>}
        <Glyph subject={subject} className="glyph" />
      </div>
      <div className="p1-cardbody">
        <h4>{title}</h4>{subtitle && <span className="subj">{subtitle}</span>}{desc && <p>{desc}</p>}
        {chips && chips.length > 0 && <div className="chips">{chips.filter(Boolean).map((x, i) => <span key={i} className="p1-chip-s">{x}</span>)}</div>}
      </div>
      <div className="p1-cardfoot">{foot}<span className="more">{more}</span></div>
    </button>
  )
}
export function Thumb({ color, code }: { color?: string | null; code?: string | null }) {
  const c = color ?? '#475569'
  return <span className="p1-thumb" style={{ background: `linear-gradient(135deg, ${c}, ${shade(c, -30)})` }}>{code ?? ''}</span>
}
export function CtBadge({ color, code }: { color?: string | null; code?: string | null }) {
  if (!code) return <span className="sub">—</span>
  const c = color ?? '#475569'
  return <span className="p1-ct" style={{ color: c, borderColor: c + '55', background: c + '14' }}>{code}</span>
}
export function Mini({ items }: { items: [string, ReactNode][] }) {
  return <div className="p1-mini">{items.map(([l, v]) => <div key={l}><span>{l}</span><b>{v}</b></div>)}</div>
}
// Làm tối / sáng một màu #rrggbb
export function shade(hex: string, pct: number) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex); if (!m) return hex
  const n = parseInt(m[1], 16); const f = (x: number) => Math.max(0, Math.min(255, Math.round(x + (pct / 100) * (pct < 0 ? x : 255 - x))))
  return '#' + [f(n >> 16), f((n >> 8) & 255), f(n & 255)].map(x => x.toString(16).padStart(2, '0')).join('')
}
export function timeAgo(ts: string | null | undefined) {
  if (!ts) return '—'
  const s = (Date.now() - new Date(ts).getTime()) / 1000
  if (s < 90) return 'vừa xong'; if (s < 3600) return `${Math.round(s / 60)} phút trước`; if (s < 86400) return `${Math.round(s / 3600)} giờ trước`
  if (s < 86400 * 30) return `${Math.round(s / 86400)} ngày trước`; return new Date(ts).toLocaleDateString('vi-VN')
}
export const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()
