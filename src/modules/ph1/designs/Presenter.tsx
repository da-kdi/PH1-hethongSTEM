// Trình chiếu toàn màn hình kiểu Canva / PowerPoint (bản mẫu v315 · C4: presView, presFit, presFs)
//   Trang bìa + mỗi hoạt động một trang 16:9, tự co theo màn hình; thanh điều khiển; chế độ người trình bày (trang sau, ghi chú GV, đồng hồ);
//   phím tắt: ← → / PageUp PageDown / Space chuyển trang · Home End · B màn đen · W màn trắng · P người trình bày · F toàn màn hình · Esc thoát.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { BlockView, type Block } from './blocks'

export type PresAct = { title: string; minutes?: number; teacher?: string; student?: string; blocks?: Block[] }
export type PresDoc = { id: string; title: string; description: string | null; sessions: { title: string; activities: PresAct[] }[] }
type Slide = { cover: true } | { cover?: false; a: PresAct; sess: string; no: number; k: number }

const slidesOf = (d: PresDoc): Slide[] => { let k = 0
  return [{ cover: true }, ...d.sessions.flatMap(s => s.activities.map((a, i) => ({ a, sess: s.title, no: i + 1, k: k++ })))] }
const clock = (ms: number) => { const s = Math.floor(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` }

function Fit({ children, cls = '' }: { children: ReactNode; cls?: string }) {
  const box = useRef<HTMLDivElement>(null)
  const [sc, setSc] = useState(1)
  useLayoutEffect(() => {
    const el = box.current?.parentElement; if (!el) return
    const fit = () => { const r = el.getBoundingClientRect(); const mini = cls.includes('pmini'); const w = mini ? r.width : r.width - 16, h = mini ? r.width * 9 / 16 : r.height - 16; setSc(Math.max(0.1, Math.min(w / 1280, h / 720))) }
    fit(); const ro = new ResizeObserver(fit); ro.observe(el); return () => ro.disconnect()
  }, [cls])
  return <div ref={box} className={'pfit ' + cls} style={{ width: 1280 * sc, height: 720 * sc }}><div className="pslide" style={{ ['--sc' as string]: sc }}>{children}</div></div>
}

export function Presenter({ d, color, label, start = 0, onClose }: { d: PresDoc; color: string; label: string; start?: number; onClose: () => void }) {
  const sl = slidesOf(d)
  const [i, setI] = useState(Math.min(start, sl.length - 1))
  const [mode, setMode] = useState<'show' | 'presenter'>('show')
  const [blank, setBlank] = useState<'' | 'black' | 'white'>('')
  const [now, setNow] = useState(Date.now())
  const t0 = useRef(Date.now())
  const root = useRef<HTMLDivElement>(null)
  const [fs, setFs] = useState(false)
  const go = (n: number) => setI(Math.max(0, Math.min(sl.length - 1, n)))
  const toggleFs = () => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); else root.current?.requestFullscreen?.().catch(() => {}) }
  useEffect(() => { root.current?.focus(); root.current?.requestFullscreen?.().catch(() => {}); const t = setInterval(() => setNow(Date.now()), 1000)
    const fc = () => setFs(!!document.fullscreenElement); document.addEventListener('fullscreenchange', fc)
    return () => { clearInterval(t); document.removeEventListener('fullscreenchange', fc); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}) } }, [])
  const onKey = (e: React.KeyboardEvent) => {
    if (blank) { setBlank(''); e.preventDefault(); return }
    const k = e.key
    if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(k)) { e.preventDefault(); go(i + 1) }
    else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(k)) { e.preventDefault(); go(i - 1) }
    else if (k === 'Home') go(0); else if (k === 'End') go(sl.length - 1)
    else if (k === 'b' || k === 'B' || k === '.') setBlank('black'); else if (k === 'w' || k === 'W' || k === ',') setBlank('white')
    else if (k === 'p' || k === 'P') setMode(m => m === 'show' ? 'presenter' : 'show')
    else if (k === 'f' || k === 'F') toggleFs()
    else if (k === 'Escape') { e.preventDefault(); onClose() }
  }
  const body = (x: Slide) => x.cover
    ? <div className="pcover" style={{ ['--c' as string]: color }}><small>{label}</small><h1>{d.title}</h1>{d.description && <p>{d.description}</p>}
      <small>{d.sessions.length} buổi · {d.sessions.reduce((a, s) => a + s.activities.length, 0)} hoạt động</small></div>
    : <div className="pact" style={{ ['--c' as string]: color }}><span className="ptag">{x.sess} · Hoạt động {x.no}{x.a.minutes ? ` · ${x.a.minutes} phút` : ''}</span><h2>{x.a.title}</h2>
      {x.a.student && <div className="ptask"><b>Nhiệm vụ</b><p>{x.a.student}</p></div>}
      {(x.a.blocks ?? []).map((b, bi) => <div key={bi} className="pbk"><BlockView b={b} k={`${d.id}.p${x.k}.${bi}`} student /></div>)}</div>
  const x = sl[i], nx = sl[i + 1]
  const B = ({ on, title, onClick, children }: { on?: boolean; title: string; onClick: () => void; children: ReactNode }) =>
    <button type="button" className={'pcb' + (on ? ' on' : '')} title={title} aria-label={title} onClick={onClick}>{children}</button>
  const svg = (p: string) => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: p }} />
  return <div ref={root} className={'pres ' + mode} role="dialog" aria-label="Trình chiếu bài giảng" tabIndex={-1} onKeyDown={onKey}>
    <div className="pprog"><i style={{ width: `${(i + 1) / sl.length * 100}%` }} /></div>
    <div className="pstage" onClick={e => { if ((e.target as HTMLElement).closest('button, input, a, .pbk')) return; go(i + 1) }}>
      <div className="pmainbox"><Fit key={'m' + mode} cls="pmain">{body(x)}</Fit></div>
      {mode === 'presenter' && <aside className="pside">
        <div className="ptime"><span>Đã trình bày</span><b>{clock(now - t0.current)}</b>{!x.cover && x.a.minutes ? <small>Hoạt động dự kiến {x.a.minutes} phút</small> : null}</div>
        <div className="pnext"><span>Trang sau</span>{nx ? <Fit key={'n' + (i + 1)} cls="pmini">{body(nx)}</Fit> : <div className="pend">Hết bài giảng</div>}</div>
        <div className="pnotes"><b>Ghi chú giáo viên</b><p>{x.cover ? 'Giới thiệu bài học, yêu cầu cần đạt và sản phẩm cuối bài.' : x.a.teacher || '—'}</p></div></aside>}
    </div>
    {blank && <div className={'pblank ' + blank} onClick={() => setBlank('')}><small>Màn hình {blank === 'black' ? 'đen' : 'trắng'} · bấm hoặc nhấn phím bất kỳ để tiếp tục</small></div>}
    <div className="pctl">
      <B title="Trang trước (←)" onClick={() => go(i - 1)}>{svg('<path d="m15 6-6 6 6 6"/>')}</B>
      <span className="pno">{i + 1} / {sl.length}</span>
      <B title="Trang sau (→)" onClick={() => go(i + 1)}>{svg('<path d="m9 6 6 6-6 6"/>')}</B>
      <span className="pttl">{x.cover ? d.title : `${x.sess} · ${x.a.title}`}</span>
      <B on={mode === 'presenter'} title="Chế độ người trình bày (P)" onClick={() => setMode(m => m === 'show' ? 'presenter' : 'show')}>{svg('<rect x="2" y="4" width="13" height="10" rx="1"/><path d="M18 6h4v8h-4M6 18h9M10.5 14v4"/>')}</B>
      <B title="Màn đen (B)" onClick={() => setBlank('black')}>{svg('<rect x="3" y="5" width="18" height="14" rx="1" fill="currentColor"/>')}</B>
      <B on={fs} title={fs ? 'Thoát toàn màn hình (F)' : 'Toàn màn hình (F)'} onClick={toggleFs}>{svg(fs ? '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>' : '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>')}</B>
      <B title="Thoát trình chiếu (Esc)" onClick={onClose}>{svg('<path d="M6 6l12 12M18 6 6 18"/>')}</B>
    </div>
  </div>
}
