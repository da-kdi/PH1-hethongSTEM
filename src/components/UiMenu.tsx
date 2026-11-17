import { useEffect, useRef, useState } from 'react'

// Bản mẫu v315 · nút “Aa” trên thanh trên: Giao diện (Hiện đại / Tiêu chuẩn), Cỡ chữ hiển thị (Nhỏ / Vừa / Lớn), Phông chữ.
// Lưu trên trình duyệt (stem-ui), áp cho mọi màn: <html data-skin>, zoom của body, biến --ui-font.
type UiPref = { skin?: 'modern' | 'classic'; size?: 's' | 'm' | 'l'; font?: string }
const UISIZE: [UiPref['size'], string, number][] = [['s', 'Nhỏ', .9], ['m', 'Vừa', 1], ['l', 'Lớn', 1.12]]
const UIFONT: [string, string, string?][] = [['', 'Segoe UI', '"Segoe UI","Open Sans",-apple-system,system-ui,Roboto,Arial,sans-serif'], ['Be Vietnam Pro', 'Be Vietnam Pro'], ['Lexend', 'Lexend'],
  ['Inter', 'Inter'], ['Roboto', 'Roboto'], ['Nunito', 'Nunito'], ['Open Sans', 'Open Sans']]
const KEY = 'stem-ui'
const load = (): UiPref => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} } }
const fontStack = (k: string) => UIFONT.find(x => x[0] === k)?.[2] ?? `"${k}","Segoe UI",system-ui,Arial,sans-serif`
function fontLoad(k: string) {
  if (!k) return; const id = 'gf-' + k.replace(/\s/g, ''); if (document.getElementById(id)) return
  const l = document.createElement('link'); l.id = id; l.rel = 'stylesheet'; l.href = `https://fonts.googleapis.com/css2?family=${k.replace(/ /g, '+')}:wght@400;500;600;700&display=swap`; document.head.appendChild(l)
}
const curFont = (p: UiPref) => p.font ?? ((p.skin ?? 'modern') === 'modern' ? 'Be Vietnam Pro' : '')
export function uiApply(p: UiPref = load()) {
  const skin = p.skin ?? 'modern'; document.documentElement.dataset.skin = skin
  const z = UISIZE.find(x => x[0] === (p.size ?? 'm'))?.[2] ?? 1
  ;(document.body.style as CSSStyleDeclaration & { zoom: string }).zoom = z === 1 ? '' : String(z)
  document.documentElement.style.setProperty('--vh100', z === 1 ? '100vh' : `calc(100vh / ${z})`)
  const fk = curFont(p); fontLoad(fk); document.documentElement.style.setProperty('--ui-font', fontStack(fk))
}
uiApply()

export function UiMenu() {
  const [p, setP] = useState<UiPref>(load)
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => { if (!open) return; const off = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }; document.addEventListener('mousedown', off); return () => document.removeEventListener('mousedown', off) }, [open])
  useEffect(() => { if (open) UIFONT.forEach(([k]) => fontLoad(k)) }, [open])
  const put = (x: UiPref) => { const n = { ...p, ...x }; setP(n); try { localStorage.setItem(KEY, JSON.stringify(n)) } catch { /* bỏ qua */ } uiApply(n) }
  const cf = curFont(p)
  return <div className="uiwrap" ref={box}>
    <button type="button" className={'bellbtn uibtn' + (open ? ' on' : '')} aria-label="Cỡ chữ và phông chữ" title="Cỡ chữ và phông chữ" aria-expanded={open} onClick={() => setOpen(!open)}><b>Aa</b></button>
    {open && <div className="toppanel uipanel" role="dialog" aria-label="Cỡ chữ và phông chữ">
      <b className="uih">Giao diện</b>
      <div className="uiskin">{([['modern', 'Hiện đại', 'Bo tròn, thoáng, có hiệu ứng'], ['classic', 'Tiêu chuẩn', 'Gọn, vuông vức như cũ']] as const).map(([k, n, d]) =>
        <button type="button" key={k} className={(p.skin ?? 'modern') === k ? 'on' : ''} onClick={() => put({ skin: k })}><i className={'sk sk-' + k}><b /><b /><b /></i><span><b>{n}</b><small>{d}</small></span></button>)}</div>
      <b className="uih">Cỡ chữ hiển thị</b>
      <div className="uisz">{UISIZE.map(([k, n, z]) => <button type="button" key={k} className={(p.size ?? 'm') === k ? 'on' : ''} onClick={() => put({ size: k })}><b style={{ fontSize: Math.round(15 * z) }}>Aa</b><span>{n}</span></button>)}</div>
      <b className="uih">Phông chữ</b>
      <div className="uifont">{UIFONT.map(([k, n]) => <button type="button" key={n} className={cf === k ? 'on' : ''} style={{ fontFamily: fontStack(k) }} onClick={() => put({ font: k })}>
        <span>Aa</span>{n}{cf === k && <svg className="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 5 5L20 7" /></svg>}</button>)}</div>
      <small className="uinote">Áp dụng cho mọi màn, lưu trên trình duyệt này.</small>
    </div>}
  </div>
}
