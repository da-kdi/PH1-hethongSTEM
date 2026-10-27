import { Fragment, type CSSProperties, type ReactNode } from 'react'
import { I, SGLYPH } from './icons'
import './mau.css'
import './app.css'

// Bộ thành phần dựng theo bản mẫu giao diện PH1 (ph1-chuong-trinh-mau.html): cùng tên lớp CSS với bản mẫu, đặt trong khung .mau
export const cssVar = (c?: string | null): CSSProperties => ({ ['--c' as string]: c ?? '#64748b' })
export function Ic({ n, cls = 'i' }: { n: string; cls?: string }) {
  return <svg className={cls} viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: I[n] ?? '' }} />
}
// Khung gốc: biến màu, phông chữ, kiểu bìa thẻ của bản mẫu
export function Mau({ children }: { children: ReactNode }) { return <div className="mau mau-wrap" data-cover="icon">{children}</div> }
export function PageHead({ icon, title, sub, children }: { icon: string; title: ReactNode; sub?: ReactNode; children?: ReactNode }) {
  return <div className="pagehead"><div className="tile"><Ic n={icon} /></div><div className="grow"><h1>{title}</h1>{sub && <p>{sub}</p>}</div>{children}</div>
}
// Chuỗi bước của một mục (thay thanh tab)
export function Flow<T extends string>({ steps, value, onChange }: { steps: [T, string, ReactNode?][]; value: T | ''; onChange: (v: T) => void }) {
  const ci = steps.findIndex(s => s[0] === value)
  return <nav className="flowsec" aria-label="Các bước">{steps.map(([k, l, d], i) => <Fragment key={k}>
    {i > 0 && <i aria-hidden="true"><Ic n="chev" /></i>}
    <button type="button" className={k === value ? 'on' : ci >= 0 && i < ci ? 'past' : ''} aria-current={k === value ? 'step' : 'false'} onClick={() => onChange(k)}>
      <b>{i + 1}</b><span>{l}{d != null && <small>{d}</small>}</span></button></Fragment>)}</nav>
}
export type Tone = 'c-blue' | 'c-green' | 'c-violet' | 'c-amber' | 'c-red'
export function StatCard({ c, icon, label, value, sub }: { c: Tone; icon: string; label: string; value: ReactNode; sub?: ReactNode }) {
  return <div className={'stat ' + c}><span className="tr"><Ic n="trend" /></span><div className="ico"><Ic n={icon} /></div><div className="lbl">{label}</div><div className="val">{value}</div><div className="sub">{sub}</div></div>
}
export function Panel({ icon, title, act, children, className = '', style }: { icon?: string; title?: ReactNode; act?: ReactNode; children?: ReactNode; className?: string; style?: CSSProperties }) {
  return <section className={'panel ' + className} style={style}>{title != null && <header><h2>{icon && <span className="hi"><Ic n={icon} /></span>}{title}</h2>{act && <span className="act">{act}</span>}</header>}{children}</section>
}
export const STATUS3: Record<string, [string, string]> = { draft: ['Nháp', 'draft'], published: ['Đã phát hành', 'good'], archived: ['Ngừng dùng', 'warn'] }
export function StatusPill({ s }: { s: string }) { const x = STATUS3[s] ?? [s, 'draft']; return <span className={'pill ' + x[1]}>{x[0]}</span> }
// Bìa thẻ: biểu tượng môn chính + dòng nhóm + mã lớn
export function Cover({ subject, label, code }: { subject?: string | null; label?: ReactNode; code?: ReactNode }) {
  return <div className="cover"><i className="cg"><svg viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: SGLYPH[subject ?? ''] ?? SGLYPH.khtn }} /></i>
    <span>{label}</span><b>{code}</b></div>
}
export function Empty({ children }: { children: ReactNode }) { return <div className="empty">{children}</div> }
export function Group({ title, n }: { title: ReactNode; n?: number }) { return <div className="group">{title}{n != null && <small>{n}</small>}</div> }
export function Seg<T extends string>({ items, value, onChange, label }: { items: [T, string][]; value: T; onChange: (v: T) => void; label?: string }) {
  return <div className="seg" role="group" aria-label={label}>{items.map(([k, n]) => <button type="button" key={k} className={value === k ? 'on' : ''} onClick={() => onChange(k)}>{n}</button>)}</div>
}
export function Search({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return <label className="search"><Ic n="search" /><input type="search" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} /></label>
}
export function Sel({ value, onChange, label, options }: { value: string; onChange: (v: string) => void; label: string; options: [string, string][] }) {
  return <select value={value} onChange={e => onChange(e.target.value)} aria-label={label}><option value="">{label}</option>{options.map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select>
}
// Hộp xác nhận trong trang (thay confirm())
export function Confirm({ text, yes, onYes, onNo, danger }: { text: ReactNode; yes: string; onYes: () => void; onNo: () => void; danger?: boolean }) {
  return <div className="confirm"><Ic n="info" /><span>{text}</span><span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}><button type="button" className={'btn sm' + (danger ? ' danger' : '')} onClick={onYes}>{yes}</button><button type="button" className="btn sm ghost" onClick={onNo}>Thôi</button></span></div>
}
