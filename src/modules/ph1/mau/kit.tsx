import { Fragment, createContext, useContext, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'
import { I, SGLYPH } from './icons'
import './mau.css'
import './app.css'
import './v315.css'
import { createPortal } from 'react-dom'
import { useDetailCrumb } from '../../../lib/crumb'

// Bộ thành phần dựng theo bản mẫu giao diện PH1 (ph1-chuong-trinh-mau.html): cùng tên lớp CSS với bản mẫu, đặt trong khung .mau
export const cssVar = (c?: string | null): CSSProperties => ({ ['--c' as string]: c ?? '#64748b' })
export function Ic({ n, cls = 'i' }: { n: string; cls?: string }) {
  return <svg className={cls} viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: I[n] ?? '' }} />
}
// Khung gốc: biến màu, phông chữ, kiểu bìa thẻ của bản mẫu
// Bản mẫu v315: đầu trang chỉ còn tiêu đề; nút hành động của trang nằm bên phải thanh bước (.flowsec .tabact) — PageHead chuyển nút sang đó khi trang có Flow
// Bảng nằm cạnh cây Cấp học › Khối thì thanh công cụ gọn (.tbtight) như bản mẫu
export const InTree = createContext(false)
const HeadSlot = createContext<{ slot: HTMLElement | null; setSlot: (e: HTMLElement | null) => void }>({ slot: null, setSlot: () => {} })
export function Mau({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  return <HeadSlot.Provider value={{ slot, setSlot }}><div className="mau mau-wrap" data-cover="icon">{children}</div></HeadSlot.Provider>
}
export function PageHead({ title, sub, children }: { icon?: string; title: ReactNode; sub?: ReactNode; children?: ReactNode }) {
  const { slot } = useContext(HeadSlot)
  return <><div className="pagehead"><div className="grow"><h1 title={typeof sub === 'string' ? sub : undefined}>{title}</h1></div>{!slot && children}</div>{slot && children ? createPortal(children, slot) : null}</>
}
function FlowAct() { const { setSlot } = useContext(HeadSlot); return <div className="tabact" ref={setSlot} /> }
// Chuỗi bước của một mục (thay thanh tab)
export function Flow<T extends string>({ steps, value, onChange }: { steps: [T, string, ReactNode?][]; value: T | ''; onChange: (v: T) => void }) {
  const ci = steps.findIndex(s => s[0] === value)
  return <nav className="flowsec" aria-label="Các bước">{steps.map(([k, l, d], i) => <Fragment key={k}>
    {i > 0 && <i aria-hidden="true"><Ic n="chev" /></i>}
    <button type="button" className={k === value ? 'on' : ci >= 0 && i < ci ? 'past' : ''} aria-current={k === value ? 'step' : 'false'} onClick={() => onChange(k)}>
      <b>{i + 1}</b><span>{l}{d != null && <small>{d}</small>}</span></button></Fragment>)}<FlowAct /></nav>
}
export type Tone = 'c-blue' | 'c-green' | 'c-violet' | 'c-amber' | 'c-red'
// Bản mẫu v315: số tổng hiện thành chip nhỏ (.sumchip) trong dải .stats (= .sumline), chi tiết phụ hiện khi rê chuột
export function StatCard({ c, label, value, sub }: { c: Tone; icon?: string; label: string; value: ReactNode; sub?: ReactNode }) {
  return <div className={'sumchip ' + c} data-tip={typeof sub === 'string' && sub ? label + ': ' + sub : undefined}><b>{value}</b> {label}</div>
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
// Bản mẫu v315 · đầu trang chi tiết (.cthead): mã, tên, nhãn trạng thái; dòng phụ; nút bên phải
export function CtHead({ code, color, title, pills, sub, act }: { code?: ReactNode; color?: string | null; title: ReactNode; pills?: ReactNode; sub?: ReactNode; act?: ReactNode }) {
  return <div className="cthead"><div className="cttitle"><div className="ctname">{code != null && <span className="code" style={cssVar(color)}>{code}</span>}<h1>{title}</h1>{pills}</div>{sub && <small className="sub">{sub}</small>}</div>{act && <div className="act">{act}</div>}</div>
}
// Bản mẫu v315: bảng thường (ma trận điểm danh, sổ điểm…) cũng có thanh nhỏ Xuất · Mở rộng như bảng dùng chung
export function TblWrap({ children, name = 'bang' }: { children: ReactNode; name?: string }) {
  const [wide, setWide] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const exp = () => {
    const t = box.current?.querySelector('table'); if (!t) return
    const q = (v: string) => /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v
    const csv = '﻿' + Array.from(t.querySelectorAll('tr')).map(tr => Array.from(tr.querySelectorAll('th,td')).map(c => q(((c as HTMLElement).innerText || '').replace(/\s*\n\s*/g, ' · ').trim())).join(',')).join('\r\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = name + '.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }
  return <><div className="tbtools"><div className="dsbar btngrp"><button type="button" className="btn sm" title="Tải bảng ra file Excel (.csv)" onClick={exp}><Ic n="download" /> Xuất</button></div>
    <div className="btngrp tools"><button type="button" className={'btn sm' + (wide ? ' on' : '')} aria-pressed={wide} onClick={() => setWide(!wide)}><span aria-hidden="true">↔</span> {wide ? 'Thu gọn' : 'Mở rộng'}</button></div></div>
    <div ref={box} className={'tblwrap' + (wide ? ' xscroll' : '')}>{children}</div></>
}
// Một dòng trong bảng Lọc của thanh công cụ (.fpanel .frow1)
export function FRow({ label, children }: { label: string; children: ReactNode }) { return <label className="frow1"><span>{label}</span>{children}</label> }
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

// ===== Khung chung theo bản mẫu v315 (docs/mockup/THAY-DOI-UI.md · A) =====
// A2 · Nút quay lại của trang chi tiết: báo tên bản ghi lên đường dẫn trên cùng; khi đường dẫn hiện thì nút này ẩn (body.hascrumb).
export function Back({ onClick, title, children }: { onClick: () => void; title?: string | null; children: ReactNode }) {
  useDetailCrumb(title, onClick)
  return <button type="button" className="btn sm ghost backbtn" onClick={onClick}><Ic n="back" /> {children}</button>
}
// A4 · Ghi chú cạnh tên (ổ khoá khi chỉ xem, ⓘ khi cần lưu ý): nội dung trong tooltip thay cho đoạn văn lặp.
export function HNote({ tip, lock }: { tip: string; lock?: boolean }) {
  return <span className="hnote" tabIndex={0} data-tip={tip} aria-label={tip}><Ic n={lock ? 'lock' : 'info'} /></span>
}
// A5 · Khung thông tin bên phải: kéo mép trái để rộng/hẹp (bấm đúp về mặc định), nút ‹ › thu gọn; nhớ theo trình duyệt (stem-aside).
type AsideMem = Record<string, number | boolean>
const asideLoad = (): AsideMem => { try { return JSON.parse(localStorage.getItem('stem-aside') || '{}') } catch { return {} } }
const asideSave = (m: AsideMem) => { try { localStorage.setItem('stem-aside', JSON.stringify(m)) } catch { /* bỏ qua */ } }
export function AsideWrap({ kind = 'det', aside, children, className = '' }: { kind?: 'det' | 'reg'; aside: ReactNode; children: ReactNode; className?: string }) {
  const [mem, setMem] = useState<AsideMem>(asideLoad)
  const box = useRef<HTMLDivElement>(null)
  const def = kind === 'reg' ? 340 : 300
  const w = (mem[kind + 'W'] as number | undefined) ?? def, off = !!mem[kind + 'Off']
  const put = (m: AsideMem) => { setMem(m); asideSave(m) }
  const drag = (e: ReactMouseEvent) => {
    e.preventDefault()
    const x0 = e.clientX, w0 = w, max = Math.max(320, (box.current?.getBoundingClientRect().width ?? 1000) * .6)
    let last = mem
    document.body.classList.add('rzing')
    const mv = (ev: MouseEvent) => { last = { ...asideLoad(), [kind + 'W']: Math.round(Math.min(max, Math.max(240, w0 + (x0 - ev.clientX)))) }; setMem(last) }
    const up = () => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); document.body.classList.remove('rzing'); asideSave(last) }
    document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up)
  }
  return <div ref={box} className={'ctw' + (kind === 'reg' ? ' regw' : '') + (off ? ' asoff' : '') + (className ? ' ' + className : '')} style={{ ['--asw' as string]: w + 'px' }}>
    <div className="ctmain">{children}</div>
    <aside className="ctside">
      <div className="asbar">
        <button type="button" className="astog" data-tip={off ? 'Hiện khung thông tin' : 'Thu gọn khung thông tin'} aria-label={off ? 'Hiện khung thông tin' : 'Thu gọn khung thông tin'}
          onClick={() => put({ ...mem, [kind + 'Off']: !off })}><Ic n="chev" /></button>
        <span className="asrz" data-tip="Kéo để rộng/hẹp · bấm đúp để về mặc định" onMouseDown={drag} onDoubleClick={() => { const m = { ...mem }; delete m[kind + 'W']; put(m) }} />
      </div>
      {aside}
    </aside>
  </div>
}

// Cây Cấp học › Khối bên trái danh sách (bản mẫu v315 · TREECFG): bấm cấp/khối để lọc; ẩn/hiện sơ đồ (nhớ stem-tree)
export type TreeLevel = { code: string; name: string; n: number; grades: { g: number; label: string; n: number }[] }
export function LevelTree({ id, levels, total, level, grade, onPick, children, unit, noCount }: {
  id: string; levels: TreeLevel[]; total: number; level: string; grade: string; onPick: (level: string, grade: string) => void; children: ReactNode; unit?: string; noCount?: boolean
}) {
  const [ui, setUi] = useState<Record<string, unknown>>(() => { try { return JSON.parse(localStorage.getItem('stem-tree') || '{}') } catch { return {} } })
  const put = (k: string, v: unknown) => { const n = { ...ui, [k]: v }; setUi(n); try { localStorage.setItem('stem-tree', JSON.stringify(n)) } catch { /* bỏ qua */ } }
  const hide = !!ui[id + ':hide'], open = (ui[id + ':open'] ?? {}) as Record<string, boolean>
  const act = level || levels.find(l => l.grades.some(x => String(x.g) === grade))?.code || ''
  const lv = levels.filter(l => l.n > 0)
  const row = (cls: string, label: ReactNode, n: number, on: boolean, click: () => void, chev?: ReactNode) =>
    <button type="button" className={'tn ' + cls + (on ? ' on' : '')} onClick={click} aria-pressed={on}>{chev}<span className="tl">{label}</span>{!noCount && <span className="tc">{n}</span>}</button>
  return <div className={'treewrap' + (hide ? ' thide' : '')}>
    <aside className="treepane" aria-label="Sơ đồ cấp học và khối">
      <div className="trh"><b>Cấp học › Khối</b><button type="button" className="ib" title="Ẩn sơ đồ" aria-label="Ẩn sơ đồ" onClick={() => put(id + ':hide', true)}>«</button></div>
      {row('all', 'Tất cả', total, !level && !grade, () => onPick('', ''))}
      {lv.map(l => { const op = open[l.code] ?? (act === l.code || !act)
        return <div key={l.code} className="tgrp">
          {row('lv', l.name, l.n, act === l.code && !grade, () => onPick(l.code, ''),
            <span className={'tchev' + (op ? ' op' : '')} role="button" aria-label={op ? 'Thu gọn' : 'Mở'} onClick={e => { e.stopPropagation(); put(id + ':open', { ...open, [l.code]: !op }) }}>{l.grades.length ? '▸' : ''}</span>)}
          {op && l.grades.length > 0 && <div className="tkids">{l.grades.filter(x => x.n > 0).map(x => <Fragment key={x.g}>{row('gr', x.label, x.n, String(x.g) === grade, () => onPick(l.code, String(x.g)))}</Fragment>)}</div>}
        </div> })}
      {!lv.length && <small className="sub" style={{ padding: 8 }}>Chưa có {unit ?? 'dữ liệu'}.</small>}
    </aside>
    <div className="treemain"><InTree.Provider value={true}>
      {hide && <button type="button" className="btn sm tshow" title="Hiện sơ đồ Cấp học › Khối" onClick={() => put(id + ':hide', false)}><Ic n="list" /> Sơ đồ</button>}
      {children}</InTree.Provider>
    </div>
  </div>
}
