// Tooltip dùng chung (bản mẫu v315 · A7): mọi phần tử có data-tip="…" hiện ghi chú khi rê chuột / focus.
// Ghi chú dài đặt vào data-tip thay cho đoạn văn trên trang. Xuống dòng bằng "\n".
import { useEffect, useRef } from 'react'

export function TipLayer() {
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const tip = box.current!
    let on: HTMLElement | null = null
    const show = (el: HTMLElement) => {
      on = el; tip.textContent = el.dataset.tip ?? ''; tip.hidden = false
      const r = el.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight
      const x = Math.max(8, Math.min(r.left + r.width / 2 - tw / 2, innerWidth - tw - 8))
      let y = r.top - th - 8; if (y < 8) y = r.bottom + 8
      tip.style.left = x + 'px'; tip.style.top = y + 'px'
    }
    const hide = () => { on = null; tip.hidden = true }
    const over = (e: Event) => { const el = (e.target as HTMLElement | null)?.closest?.('[data-tip]') as HTMLElement | null; if (el && el.dataset.tip) { if (el !== on) show(el) } else if (on) hide() }
    document.addEventListener('mouseover', over); document.addEventListener('focusin', over)
    document.addEventListener('focusout', hide); document.addEventListener('scroll', hide, true)
    document.addEventListener('dragstart', hide); document.addEventListener('mousedown', hide)
    return () => {
      document.removeEventListener('mouseover', over); document.removeEventListener('focusin', over)
      document.removeEventListener('focusout', hide); document.removeEventListener('scroll', hide, true)
      document.removeEventListener('dragstart', hide); document.removeEventListener('mousedown', hide)
    }
  }, [])
  return <div ref={box} className="ctip" role="tooltip" hidden />
}
