// Bảng dữ liệu dùng chung theo bản mẫu v315 (docs/mockup/THAY-DOI-UI.md · B1–B8). Dùng cho mọi danh sách PH1, PH2, PH4.
//   B1 ô chọn dòng + chọn tất cả → thanh thao tác dính trên bảng (Xuất file CSV · thao tác riêng của mục · Thao tác khác ▾ · Bỏ chọn)
//   B2 cùng cỡ chữ 14px, dòng cao 52px, ô 1 dòng + "…" (rê xem đủ), cột tên tối đa 2 dòng     B3 mọi cột căn trái
//   B4 bấm tiêu đề để sắp xếp tăng → giảm → bỏ (ô trống luôn cuối, sắp trong từng nhóm)
//   B5 dòng tổng ngay dưới tiêu đề (không cộng Điểm, Trọng số, Tuần, Tiết PPCT)          B6 cột ngày: khai báo col.date
//   B7 chọn cột (ẩn/hiện + kéo thả đổi thứ tự) và lưu bộ lọc                            B8 cột tên ≥ 26–30%, nút Mở rộng, kéo ngang khi ≥ 9 cột
import { Fragment, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Ic, InTree, cssVar } from './kit'
import { supabase } from '../../../lib/supabase'

export type Col<T> = {
  key: string
  label: string
  cell: (r: T) => ReactNode
  /** Giá trị để sắp xếp / tính tổng. Mặc định lấy chữ hiển thị trong ô. */
  sort?: (r: T) => string | number | null | undefined
  /** Dòng tổng: 'sum' cộng, 'avg' trung bình, 'status' đếm theo nhãn, 'frac' cộng a/b, false không tính. Mặc định tự nhận cột số / a/b. */
  sum?: 'sum' | 'avg' | 'status' | 'frac' | false
  /** Cột tên: in đậm, tối đa 2 dòng, rộng ≥ 26–30% */
  name?: boolean
  /** Cột ngày quan trọng nhất của mục (B6) */
  date?: boolean
  /** Ô có nút/ô nhập: không cắt 1 dòng, không gắn tooltip */
  raw?: boolean
  /** Ẩn mặc định (bật lại trong Chọn cột) */
  hidden?: boolean
  width?: string
}
export type BulkAct<T> = { label: string; run: (rows: T[]) => void | Promise<void> | string | Promise<string | void> }

const NO_SUM = /Điểm|Trọng số|^Tuần$|Tiết PPCT/i
const AVG = /TB|%|Tỷ lệ|Chuyên cần/i
const load = <V,>(k: string, d: V): V => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) as V : d } catch { return d } }
const save = (k: string, v: unknown) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)) } catch { /* bỏ qua */ } }
const vnCmp = (a: string | number, b: string | number) => typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), 'vi', { numeric: true, sensitivity: 'base' })
// Chữ trong ô → giá trị sắp xếp: ngày dd/mm/yyyy, số, chữ
export function sortVal(t: string | number | null | undefined): string | number | null {
  if (t == null) return null
  if (typeof t === 'number') return t
  const s = t.split('\n')[0].trim(); if (!s || s === '—' || s === '-') return null
  const d = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (d) return +(d[3] + d[2].padStart(2, '0') + d[1].padStart(2, '0'))
  const n = s.match(/^-?\d+(?:[.,]\d+)?/); if (n && /^-?\d/.test(s)) return parseFloat(n[0].replace(',', '.'))
  return s.toLowerCase()
}
const fmt = (n: number) => (Math.round(n * 10) / 10).toLocaleString('vi-VN')

export function DataTable<T>({ id, rows: rows0, cols, rowKey, onOpen, noun = 'dòng', bulk = [], onDelete, onArchive, groupBy, tools, filters, onFilters, empty, search, filterBox, fcount, onClearFilters, dataTools, view, grid, fold, subBy, plain }: {
  /** khoá lưu cấu hình cột / bộ lọc (vd 'ct', 'pp') */
  id: string
  rows: T[]; cols: Col<T>[]; rowKey: (r: T) => string
  onOpen?: (r: T) => void
  noun?: string
  /** thao tác hàng loạt riêng của mục (bảng C0) */
  bulk?: BulkAct<T>[]
  onDelete?: (rows: T[]) => void | Promise<void>
  onArchive?: (rows: T[]) => void | Promise<void>
  /** gom nhóm: trả [khoá, nhãn, màu?] */
  groupBy?: (r: T) => [string, ReactNode, (string | null)?]
  /** Bản mẫu v315 (.gscroll): mỗi nhóm là một khối thu gọn được (summary.phead), nút Thu gọn tất cả trên thanh công cụ */
  fold?: boolean
  /** Bảng gọn trong khung chi tiết (bản mẫu .cttools/.cttbl): không cột chọn, không thao tác hàng loạt */
  plain?: boolean
  /** dải phụ trong nhóm (vd Môn): trả [khoá, nhãn] */
  subBy?: (r: T) => [string, ReactNode]
  /** nút riêng trên thanh công cụ của bảng (bên trái) */
  tools?: ReactNode
  /** bộ lọc hiện tại để Lưu bộ lọc (B7) */
  filters?: Record<string, string>; onFilters?: (f: Record<string, string>) => void
  empty?: ReactNode
  /** Bản mẫu v315 · thanh công cụ của bảng (.toolbar.tbc): ô tìm, bảng Lọc (các ô chọn), nút dữ liệu (Nhập / File mẫu), kiểu xem (Danh sách | Thẻ) */
  search?: { value: string; onChange: (v: string) => void; placeholder: string }
  filterBox?: ReactNode; fcount?: number; onClearFilters?: () => void
  dataTools?: ReactNode; view?: ReactNode
  /** Kiểu xem Thẻ: hiện nội dung này thay bảng (giữ thanh công cụ) */
  grid?: ReactNode
}) {
  const [fOpen, setFOpen] = useState(false)
  // Thẻ (tag) dùng chung — bảng item_tags (068), theo khoá danh sách = id của bảng; chưa có bảng thì bỏ qua
  const [tags, setTags] = useState<{ item_id: string; tag: string }[]>([])
  const [tagF, setTagF] = useState('')
  const [tagIn, setTagIn] = useState<string | null>(null)
  const loadTags = () => { supabase.from('item_tags').select('item_id, tag').eq('entity', id).then(({ data, error }) => { if (!error) setTags((data as { item_id: string; tag: string }[]) ?? []) }) }
  useEffect(loadTags, [id])
  const tagsOf = (k: string) => tags.filter(t => t.item_id === k).map(t => t.tag)
  const allTags = [...new Set(tags.map(t => t.tag))].sort((a, b) => a.localeCompare(b, 'vi'))
  const rows = tagF ? rows0.filter(r => tagsOf(rowKey(r)).includes(tagF)) : rows0
  const inTree = useContext(InTree)
  const [shut, setShut] = useState<Set<string>>(() => new Set(load<string[]>('stem-fold:' + id, [])))
  const putShut = (n: Set<string>) => { setShut(n); save('stem-fold:' + id, n.size ? [...n] : null) }
  const box = useRef<HTMLDivElement>(null)
  // ----- cột: thứ tự + ẩn/hiện (B7) -----
  const allKeys = cols.map(c => c.key)
  const [cfg, setCfg] = useState<{ order?: string[]; hide?: string[] }>(() => load('stem-tbl:' + id, {}))
  const order = cfg.order ? [...cfg.order.filter(k => allKeys.includes(k)), ...allKeys.filter(k => !cfg.order!.includes(k))] : allKeys
  const hide = new Set(cfg.hide ?? cols.filter(c => c.hidden).map(c => c.key))
  const lockKey = cols.find(c => c.name)?.key ?? cols[0]?.key
  const vis = order.map(k => cols.find(c => c.key === k)!).filter(c => c && (!hide.has(c.key) || c.key === lockKey))
  const putCfg = (c: typeof cfg) => { setCfg(c); save('stem-tbl:' + id, c.order || c.hide ? c : null) }
  // ----- Mở rộng (B8) -----
  const [wide, setWide] = useState<boolean>(() => load('stem-tblwide:' + id, false))
  // ----- sắp xếp (B4) -----
  const [srt, setSrt] = useState<{ k: string; d: 'asc' | 'desc' } | null>(null)
  // ----- chọn dòng (B1) -----
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [msg, setMsg] = useState('')
  const [more, setMore] = useState(false)
  const [pick, setPick] = useState(false)
  const keys = rows.map(rowKey)
  useEffect(() => { setSel(s => { const n = new Set([...s].filter(k => keys.includes(k))); return n.size === s.size ? s : n }) }, [keys.join('|')])

  // Chữ hiển thị trong ô (sau khi vẽ) → dùng cho sắp xếp mặc định, tổng, CSV, tooltip
  const [txt, setTxt] = useState<Record<string, Record<string, string>>>({})
  useLayoutEffect(() => {
    const t: Record<string, Record<string, string>> = {}
    box.current?.querySelectorAll<HTMLTableRowElement>('tbody tr[data-k]').forEach(tr => {
      const o: Record<string, string> = {}
      tr.querySelectorAll<HTMLTableCellElement>('td[data-c]').forEach(td => {
        const s = (td.innerText || td.textContent || '').replace(/\s*\n\s*/g, ' · ').trim(); o[td.dataset.c!] = s
        if (!td.classList.contains('raw') && s && td.title !== s) td.title = s
      })
      t[tr.dataset.k!] = o
    })
    if (JSON.stringify(t) !== JSON.stringify(txt)) setTxt(t)
  })
  const textOf = (r: T, c: Col<T>) => txt[rowKey(r)]?.[c.key] ?? ''
  const valOf = (r: T, c: Col<T>) => c.sort ? sortVal(c.sort(r) ?? null) : sortVal(textOf(r, c))

  // Nhóm + sắp xếp trong từng nhóm
  const groups = useMemo(() => {
    const gs: { k: string; label: ReactNode; c?: string | null; rows: T[] }[] = []
    rows.forEach(r => { const [k, label, c] = groupBy ? groupBy(r) : ['', '', null]; let g = gs.find(x => x.k === k); if (!g) gs.push(g = { k, label, c, rows: [] }); g.rows.push(r) })
    const c = srt && cols.find(x => x.key === srt.k)
    if (c) gs.forEach(g => { g.rows = [...g.rows].sort((a, b) => { const x = valOf(a, c), y = valOf(b, c); if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1; return vnCmp(x, y) * (srt!.d === 'desc' ? -1 : 1) }) })
    return gs
  }, [rows, srt, txt, groupBy])

  // Dòng tổng (B5)
  const sums = vis.map((c, i) => {
    if (i === 0) return <><b>{rows.length}</b> {noun}</>
    if (c.sum === false || NO_SUM.test(c.label) || rows.length < 2) return null
    const vals = rows.map(r => ({ v: valOf(r, c), t: textOf(r, c) })).filter(x => x.t && x.t !== '—')
    if (!vals.length) return null
    if (c.sum === 'status' || c.key === 'status') { const m = new Map<string, number>(); vals.forEach(x => m.set(x.t, (m.get(x.t) ?? 0) + 1))
      const L = [...m].sort((a, b) => b[1] - a[1]); return <span className="sxs" data-tip={L.map(([k, n]) => `${n} ${k.toLowerCase()}`).join(' · ')}>{L.map(([k, n]) => <span key={k} className="sx"><b>{n}</b> {L.length <= 2 ? k.toLowerCase() : k.split(' ')[0].toLowerCase()}</span>)}</span> }
    const fr = vals.map(x => x.t.match(/^(\d+)\s*\/\s*(\d+)\s*([^\d/]*)$/))
    if (c.sum === 'frac' || (c.sum == null && fr.every(Boolean))) { if (!fr.every(Boolean)) return null; const a = fr.reduce((s, m) => s + +m![1], 0), b = fr.reduce((s, m) => s + +m![2], 0); return <><b>{a}/{b}</b>{fr[0]![3] ? ' ' + fr[0]![3].trim() : ''}</> }
    const nums = vals.map(x => x.v).filter((v): v is number => typeof v === 'number')
    // chỉ cộng cột số thuần (vd "12", "12 tiết", "85%"); ngày và chữ lẫn số thì bỏ qua
    if (c.date || nums.length !== vals.length || (c.sum == null && vals.some(x => !/^-?[\d.,]+%?(\s+[^\d·/]+)?$/.test(x.t)))) return null
    const tot = nums.reduce((a, b) => a + b, 0), unit = vals[0].t.replace(/^-?[\d.,]+\s*/, '')
    return (c.sum === 'avg' || AVG.test(c.label)) ? <><span className="sl">TB</span> <b>{fmt(tot / nums.length)}{unit === '%' ? '%' : ''}</b></> : <><b>{fmt(tot)}</b>{unit && unit !== '%' ? ' ' + unit : ''}</>
  })

  // Thanh thao tác hàng loạt
  const chosen = rows.filter(r => sel.has(rowKey(r)))
  const allOn = rows.length > 0 && chosen.length === rows.length
  const toggleAll = () => setSel(allOn ? new Set() : new Set(keys))
  const exportCsv = (list: T[] = chosen, tag = 'da-chon') => {
    const q = (v: string) => /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v
    const csv = '﻿' + [vis.map(c => q(c.label)).join(','), ...list.map(r => vis.map(c => q(textOf(r, c))).join(','))].join('\r\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = `${id}-${tag}-${list.length}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000)
    setMsg(`Đã xuất ${list.length} ${noun} ra file .csv`)
  }
  const printList = () => {
    const esc = (s: string) => s.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]!))
    const w = window.open('', '_blank'); if (!w) return setMsg('Trình duyệt chặn cửa sổ in.')
    w.document.write(`<!doctype html><meta charset="utf-8"><title>Danh sách ${esc(noun)}</title><style>body{font:13px system-ui,sans-serif;margin:24px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}th{background:#f1f5f9}</style>
      <h3>Danh sách ${esc(noun)} (${chosen.length})</h3><table><thead><tr>${vis.map(c => `<th>${esc(c.label)}</th>`).join('')}</tr></thead><tbody>${chosen.map(r => `<tr>${vis.map(c => `<td>${esc(textOf(r, c))}</td>`).join('')}</tr>`).join('')}</tbody></table>`)
    w.document.close(); w.focus(); w.print()
  }
  const run = async (f: () => unknown, done?: string) => { setMore(false); const r = await f(); setMsg(typeof r === 'string' ? r : done ?? ''); setSel(new Set()) }
  const [askDel, setAskDel] = useState(false)

  // Lưu bộ lọc (B7)
  const [saved, setSaved] = useState<{ n: string; f: Record<string, string> }[]>(() => load('stem-flt:' + id, []))
  const [naming, setNaming] = useState<string | null>(null)
  const hasF = !!filters && Object.values(filters).some(Boolean)

  const n = vis.length
  const rowsOf = (rs: T[]) => <>{rs.map((r, ri) => { const k = rowKey(r), on = sel.has(k); const sb = subBy ? subBy(r) : null; const sb0 = subBy && ri > 0 ? subBy(rs[ri - 1])[0] : null
            return <Fragment key={k}>{sb && sb[0] !== sb0 && <tr className="band"><td colSpan={n + (plain ? 0 : 1)}>{sb[1]}</td></tr>}<tr data-k={k} className={on ? 'rsel' : ''} onClick={onOpen ? () => onOpen(r) : undefined} style={onOpen ? { cursor: 'pointer' } : undefined}>
              {!plain && <td className="chkc" onClick={e => e.stopPropagation()}><input type="checkbox" aria-label="Chọn dòng" checked={on} onChange={() => setSel(s => { const nx = new Set(s); nx.has(k) ? nx.delete(k) : nx.add(k); return nx })} /></td>}
              {vis.map(c => <td key={c.key} data-c={c.key} className={c.raw ? 'raw' : c.name ? 'tcell' : 'one'}>{c.cell(r)}{c.key === lockKey && tagsOf(k).length > 0 && <span className="tagchips">{tagsOf(k).map(t => <span key={t} className="chip tagchip">{t}<button type="button" aria-label={'Bỏ thẻ ' + t} onClick={async e => { e.stopPropagation(); await supabase.from('item_tags').delete().eq('entity', id).eq('item_id', k).eq('tag', t); loadTags() }}>✕</button></span>)}</span>}</td>)}
            </tr></Fragment> })}</>
  // Độ rộng cột theo loại (bản mẫu tính theo độ rộng tự nhiên): tên 26–30%, ngày 112px, trạng thái 140px, cột số 84px; cột chữ khác chia phần còn lại
  const colW = (c: Col<T>) => c.width ?? (c.name ? (n >= 8 ? '24%' : '28%') : c.date ? 112 : (c.sum === 'status' || c.key === 'status') ? 140 : c.sum === 'sum' || c.sum === 'avg' ? 88 : c.sum === 'frac' ? 96 : undefined)
  const colg = !wide && <colgroup>{!plain && <col style={{ width: 44 }} />}{vis.map(c => <col key={c.key} style={{ width: colW(c) }} />)}</colgroup>
  const thead = <thead>
          <tr>{!plain && <th className="chkc"><input type="checkbox" aria-label="Chọn tất cả" checked={allOn} ref={el => { if (el) el.indeterminate = chosen.length > 0 && !allOn }} onChange={toggleAll} /></th>}
            {vis.map(c => { const on = srt?.k === c.key ? srt.d : ''
              return <th key={c.key} className={'sortable' + (on ? ' sorted' : '')} aria-sort={on === 'asc' ? 'ascending' : on === 'desc' ? 'descending' : 'none'}
                title={on === 'asc' ? 'Đang xếp tăng dần — bấm để xếp giảm dần' : on === 'desc' ? 'Đang xếp giảm dần — bấm để bỏ sắp xếp' : 'Bấm để sắp xếp'}
                onClick={() => setSrt(!on ? { k: c.key, d: 'asc' } : on === 'asc' ? { k: c.key, d: 'desc' } : null)}>
                {c.label}<span className={'srt ' + on} aria-hidden="true"><svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path className="sd" d="M5 3v10M2.5 10.5 5 13l2.5-2.5" /><path className="su" d="M11 13V3M8.5 5.5 11 3l2.5 2.5" /></svg></span></th> })}</tr>
          <tr className="sumrow">{!plain && <th className="chkc" />}{sums.map((s, i) => <th key={vis[i].key}>{s}</th>)}</tr>
        </thead>
  // B8 · cột ngắn luôn đủ chỗ cho tên cột: bảng có độ rộng tối thiểu, hẹp hơn thì kéo ngang
  const minW = 44 + vis.reduce((a, c) => a + (c.name ? 240 : c.width && /px$/.test(c.width) ? parseInt(c.width) : 120), 0)
  const x = n >= 9 || wide
  return <div className={'dtable' + (wide ? ' wide' : '')} ref={box}>
    {plain ? <div className="cttools">
      {search && <input value={search.value} onChange={e => search.onChange(e.target.value)} placeholder={search.placeholder} aria-label={search.placeholder} />}
      <div className="dsbar btngrp" role="group" aria-label="Dữ liệu"><button type="button" className="btn sm" disabled={!rows.length} title="Tải toàn bộ danh sách ra file Excel (.csv)" onClick={() => exportCsv(rows, 'tat-ca')}><Ic n="download" /> Xuất</button>{dataTools}</div>
      <div className="btngrp tools"><span className="colpkw fwrap"><button type="button" className="btn sm" aria-expanded={pick} onClick={() => setPick(!pick)} title="Chọn cột hiện trên bảng"><Ic n="cols" /> Cột</button>
        {pick && <ColPicker cols={cols} order={order} hide={hide} lockKey={lockKey} onClose={() => setPick(false)} onSave={(o, h) => { putCfg({ order: o, hide: h }); setPick(false) }} onReset={() => { putCfg({}); setPick(false) }} />}</span>
        <button type="button" className={'btn sm' + (wide ? ' on' : '')} aria-pressed={wide} onClick={() => { setWide(!wide); save('stem-tblwide:' + id, !wide || null) }} title="Hiện đủ mọi cột"><span aria-hidden="true">↔</span> {wide ? 'Thu gọn' : 'Mở rộng'}</button></div>{tools}
    </div> :
    <div className={'toolbar tbc' + (inTree ? ' tbtight' : '')}>
      {search && <label className="search"><Ic n="search" /><input type="search" value={search.value} onChange={e => search.onChange(e.target.value)} placeholder={search.placeholder} aria-label={search.placeholder} /></label>}
      <span className="tbcount">{rows.length} {noun}</span>
      {onFilters && saved.length > 0 && <span className="savedf">{saved.map((s, i) => <span key={i} className="chip sf"><button type="button" onClick={() => onFilters(s.f)} data-tip="Áp dụng bộ lọc đã lưu">{s.n}</button>
        <button type="button" className="sfx" aria-label={'Xoá bộ lọc ' + s.n} onClick={() => { const v = saved.filter((_, j) => j !== i); setSaved(v); save('stem-flt:' + id, v.length ? v : null) }}>✕</button></span>)}</span>}
      <div className="btngrp tools">
        {!filterBox && allTags.length > 0 && <select className="btn sm" value={tagF} onChange={e => setTagF(e.target.value)} aria-label="Lọc theo thẻ"><option value="">Mọi thẻ</option>{allTags.map(t => <option key={t} value={t}>{t}</option>)}</select>}
        {filterBox && <div className="fwrap"><button type="button" className={'btn sm fbtn' + ((fcount || tagF) ? ' on' : '')} aria-expanded={fOpen} title="Bộ lọc" onClick={() => setFOpen(!fOpen)}><Ic n="filter" /> Lọc{fcount ? <em>{fcount}</em> : null}</button>
          <div className="fpanel" hidden={!fOpen} role="group" aria-label="Bộ lọc">{filterBox}
            {allTags.length > 0 && <label className="frow1"><span>Thẻ</span><select value={tagF} onChange={e => setTagF(e.target.value)} aria-label="Thẻ"><option value="">Mọi thẻ</option>{allTags.map(t => <option key={t} value={t}>{t}</option>)}</select></label>}
            <div className="fpfoot"><button type="button" className="btn sm ghost" disabled={!fcount} onClick={() => onClearFilters?.()}>Xoá bộ lọc</button><button type="button" className="btn sm" onClick={() => setFOpen(false)}>Xong</button></div></div></div>}
        {!grid && <span className="colpkw fwrap">
          <button type="button" className="btn sm" aria-expanded={pick} onClick={() => setPick(!pick)} title="Chọn cột hiện trên bảng"><Ic n="cols" /> Cột{cols.filter(c => hide.has(c.key) && c.key !== lockKey).length ? <em>{cols.filter(c => hide.has(c.key) && c.key !== lockKey).length} ẩn</em> : null}</button>
          {pick && <ColPicker cols={cols} order={order} hide={hide} lockKey={lockKey} onClose={() => setPick(false)}
            onSave={(o, h) => { putCfg({ order: o, hide: h }); setPick(false) }} onReset={() => { putCfg({}); setPick(false) }} />}
        </span>}
        {!grid && <button type="button" className={'btn sm' + (wide ? ' on' : '')} aria-pressed={wide} onClick={() => { setWide(!wide); save('stem-tblwide:' + id, !wide || null) }}
          title={wide ? 'Thu cột vừa khung' : 'Hiện đủ mọi cột'}><span aria-hidden="true">↔</span> {wide ? 'Thu gọn' : 'Mở rộng'}</button>}
        {!grid && fold && groupBy && groups.length > 1 && <button type="button" className="btn sm" onClick={() => putShut(groups.every(g => shut.has(g.k)) ? new Set() : new Set(groups.map(g => g.k)))}>{groups.every(g => shut.has(g.k)) ? 'Mở tất cả' : 'Thu gọn tất cả'}</button>}
      </div>
      {onFilters && (naming == null
        ? <button type="button" className="btn sm svfbtn" disabled={!hasF} title={hasF ? 'Lưu bộ lọc đang chọn để dùng lại' : 'Chọn điều kiện lọc hoặc gõ từ khoá trước'} onClick={() => setNaming('')}>Lưu bộ lọc</button>
        : <form className="sfname" onSubmit={e => { e.preventDefault(); const nm = naming.trim(); if (!nm) return; const v = [...saved.filter(s => s.n !== nm), { n: nm, f: filters ?? {} }]; setSaved(v); save('stem-flt:' + id, v); setNaming(null) }}>
          <input autoFocus value={naming} onChange={e => setNaming(e.target.value)} placeholder="Tên bộ lọc" aria-label="Tên bộ lọc" /><button type="submit" className="btn sm primary">Lưu</button><button type="button" className="btn sm ghost" onClick={() => setNaming(null)}>Huỷ</button></form>)}
      <div className="dsbar btngrp" role="group" aria-label="Dữ liệu">
        {!grid && <button type="button" className="btn sm" disabled={!rows.length} title="Tải toàn bộ danh sách ra file Excel (.csv)" onClick={() => exportCsv(rows, 'tat-ca')}><Ic n="download" /> Xuất</button>}
        {dataTools}</div>
      {tools}
      {view}
    </div>}
    {chosen.length > 0 && <div className="bulkbar" role="toolbar" aria-label="Thao tác với các dòng đã chọn">
      <label className="bkall"><input type="checkbox" checked={allOn} onChange={toggleAll} /> Đã chọn <b>{chosen.length}</b> {noun}</label>
      <button type="button" className="bkb" onClick={() => exportCsv()}><Ic n="download" /> Xuất file</button>
      {bulk.map(b => <button type="button" key={b.label} className="bkb" onClick={() => run(() => b.run(chosen), `${b.label}: ${chosen.length} ${noun}`)}>{b.label}</button>)}
      <span className="bkmore"><button type="button" className="btn sm" aria-expanded={more} onClick={() => setMore(!more)}>Thao tác khác <span aria-hidden="true">▾</span></button>
        {more && <div className="bkmenu" onMouseLeave={() => setMore(false)}>
          <button type="button" onClick={() => { setMore(false); printList() }}>In danh sách</button>
          {/* TODO(B1): chưa có bảng thẻ (tag) dùng chung trong CSDL — không tự tạo bảng */}
          <button type="button" onClick={() => { setMore(false); setTagIn('') }}>Thêm thẻ (tag)</button>
          <button type="button" disabled={!onArchive} data-tip={onArchive ? undefined : 'Mục này chưa có trạng thái lưu trữ (TODO)'} onClick={() => onArchive && run(() => onArchive(chosen), `Đã lưu trữ ${chosen.length} ${noun}`)}>Lưu trữ</button>
          <button type="button" className="danger" disabled={!onDelete} data-tip={onDelete ? undefined : 'Mục này không xoá hàng loạt (TODO)'} onClick={() => { setMore(false); setAskDel(true) }}>Xoá</button>
        </div>}</span>
      {tagIn != null && <form className="sfname" onSubmit={async e => { e.preventDefault(); const t = tagIn.trim(); if (!t) return
        const { error } = await supabase.from('item_tags').upsert(chosen.map(r => ({ entity: id, item_id: rowKey(r), tag: t })), { onConflict: 'org_id,entity,item_id,tag', ignoreDuplicates: true })
        setTagIn(null); if (error) return setMsg('Không gắn được thẻ: ' + error.message); loadTags(); setMsg(`Đã gắn thẻ “${t}” cho ${chosen.length} ${noun}`) }}>
        <input autoFocus list={'tags-' + id} value={tagIn} onChange={e => setTagIn(e.target.value)} placeholder="Tên thẻ" aria-label="Tên thẻ" /><datalist id={'tags-' + id}>{allTags.map(t => <option key={t} value={t} />)}</datalist>
        <button type="submit" className="btn sm primary">Gắn thẻ</button><button type="button" className="btn sm ghost" onClick={() => setTagIn(null)}>Huỷ</button></form>}
      <button type="button" className="bkx" onClick={() => setSel(new Set())}>Bỏ chọn</button>
    </div>}
    {askDel && onDelete && <div className="confirm"><Ic n="info" /><span>Xoá {chosen.length} {noun} đã chọn? Không hoàn tác được.</span><span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
      <button type="button" className="btn sm danger" onClick={() => { setAskDel(false); run(() => onDelete(chosen), `Đã xoá ${chosen.length} ${noun}`) }}>Xoá</button><button type="button" className="btn sm ghost" onClick={() => setAskDel(false)}>Thôi</button></span></div>}
    {msg && <p className="okmsg" role="status">{msg}</p>}
    {grid ? grid : !rows.length ? (empty ?? null) : fold && groupBy
      ? <div className="panel" style={{ padding: 0 }}><div className="gscroll">
        <div className="ghead"><table className="gtbl dt">{colg}{thead}</table></div>
        {groups.map(g => <details key={g.k} open={!shut.has(g.k)} onToggle={e => { const o = (e.currentTarget as HTMLDetailsElement).open; if (o === !shut.has(g.k)) return; const nx = new Set(shut); o ? nx.delete(g.k) : nx.add(g.k); putShut(nx) }}>
          <summary className="phead" style={cssVar(g.c)}><span className="chev"><Ic n="chev" /></span>{g.label}</summary>
          <table className="gtbl dt">{colg}<tbody>{rowsOf(g.rows)}</tbody></table></details>)}
      </div></div>
      : <div className="panel" style={{ padding: 0 }}><div className={'tblwrap' + (x ? ' xscroll' : '')} style={{ ['--tmin' as string]: (x && !wide ? Math.max(minW, n * 130) : minW) + 'px' }}>
      <table className={plain ? 'dt cttbl' : 'dt'} style={x && !wide ? { minWidth: 'var(--tmin)' } : undefined}>
        {colg}
        {thead}
        <tbody>{groups.map(g => <Fragment key={g.k}>
          {groupBy && <tr className="band"><td colSpan={n + (plain ? 0 : 1)}>{g.label} <small>{g.rows.length}</small></td></tr>}
          {rowsOf(g.rows)}
        </Fragment>)}</tbody>
      </table></div></div>}
  </div>
}

// Chọn cột kiểu Sapo: tick ẩn/hiện, kéo ⠿ đổi thứ tự, Quay về mặc định
function ColPicker<T>({ cols, order, hide, lockKey, onSave, onReset, onClose }: { cols: Col<T>[]; order: string[]; hide: Set<string>; lockKey?: string
  onSave: (order: string[], hide: string[]) => void; onReset: () => void; onClose: () => void }) {
  const [o, setO] = useState(order)
  const [h, setH] = useState(new Set(hide))
  const [drag, setDrag] = useState<string | null>(null)
  const lab = (k: string) => cols.find(c => c.key === k)?.label ?? k
  const vis = o.filter(k => !h.has(k) || k === lockKey)
  return <div className="fpanel colpk" role="dialog" aria-label="Điều chỉnh cột hiển thị">
    <header><b>Cột hiển thị</b><small className="sub">{vis.length} cột · kéo ⠿ để đổi thứ tự</small><button type="button" className="ib" aria-label="Đóng" onClick={onClose}>✕</button></header>
    <ul className="cpvis">{o.map(k => { const lock = k === lockKey, on = !h.has(k) || lock
      return <li key={k} draggable={!lock} className={(drag === k ? 'drag' : '') + (lock ? ' lock' : '')}
        onDragStart={() => setDrag(k)} onDragEnd={() => setDrag(null)}
        onDragOver={e => { if (!drag || drag === k || lock) return; e.preventDefault(); setO(prev => { const a = prev.filter(x => x !== drag); a.splice(a.indexOf(k) + (prev.indexOf(drag) < prev.indexOf(k) ? 1 : 0), 0, drag); return a }) }}>
        <span className="cpgrip" aria-hidden="true">{lock ? '' : '⠿'}</span>
        <label><input type="checkbox" checked={on} disabled={lock} onChange={() => setH(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n })} /> {lab(k)}</label>
        {lock && <small className="sub">cố định</small>}</li> })}</ul>
    <footer><button type="button" className="btn sm" onClick={onReset}>Quay về mặc định</button><span className="dtgrow" /><button type="button" className="btn sm ghost" onClick={onClose}>Huỷ</button>
      <button type="button" className="btn sm primary" onClick={() => onSave(o, [...h].filter(k => k !== lockKey))}>Lưu</button></footer>
  </div>
}
