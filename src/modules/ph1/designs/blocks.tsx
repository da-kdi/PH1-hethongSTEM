import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import { norm } from '../ui'
import { Empty, Ic, Search, Sel } from '../mau/kit'
import { SGLYPH } from '../mau/icons'
import { ACTS, AKIND, ART, DM, actDemo, actOf, cfgForm, cfgSummary, clone, gradeTxt, readCfg } from './acts'

// Thành phần dùng chung cho bài giảng (PH1 Soạn bài giảng, PH2 Bài giảng tập huấn): khối nội dung trình chiếu, bản chơi thử hoạt động, kho hoạt động.
export type Block = { type: string; [k: string]: any }
export const BLOCK_KIND: Record<string, [string, string]> = { text: ['Văn bản', 'edit'], image: ['Hình ảnh', 'img'], video: ['Video', 'play'], quiz: ['Trắc nghiệm', 'check'], short: ['Câu hỏi ngắn', 'info'], link: ['Liên kết', 'link'], activity: ['Hoạt động từ kho', 'game'] }
export const newBlock = (t: string): Block => t === 'quiz' ? { type: t, q: '', opts: ['', '', ''], ans: 0, explain: '' } : t === 'image' ? { type: t, src: '', caption: '' } : t === 'video' ? { type: t, url: '', title: '', start: '' }
  : t === 'link' ? { type: t, title: '', url: '' } : t === 'short' ? { type: t, q: '', hint: '' } : { type: t, text: '' }
export function videoInfo(url: string) {
  const u = String(url || '').trim(); let m
  if ((m = u.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/))) return { kind: 'YouTube', id: m[1], embed: 'https://www.youtube.com/embed/' + m[1] }
  if ((m = u.match(/vimeo\.com\/(\d+)/))) return { kind: 'Vimeo', id: m[1], embed: 'https://player.vimeo.com/video/' + m[1] }
  if (/drive\.google\.com/.test(u)) return { kind: 'Google Drive', id: '', embed: u.replace('/view', '/preview') }
  if (/^https?:\/\//.test(u)) { try { return { kind: new URL(u).hostname.replace(/^www\./, ''), id: '', embed: u } } catch { return null } }
  return null
}
// Bản chơi thử: chuỗi HTML của bộ chạy thử, React không chạm vào nội dung bên trong
export function ActDemo({ a, cfg, k }: { a: any; cfg: any; k: string }) {
  const ref = useRef<HTMLDivElement>(null); const sig = JSON.stringify(cfg)
  useEffect(() => { delete (DM as any)[k]; if (ref.current) ref.current.innerHTML = actDemo(a, cfg, k) }, [a.id, sig, k])
  return <div ref={ref} />
}
export function CoverDeco({ s }: { s: string | null | undefined }) {
  return <i className="cg"><svg viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: SGLYPH[s ?? ''] ?? SGLYPH.khtn }} /></i>
}

// ===== Kho hoạt động =====
type Opt = [string, string]
export type StoreProps = {
  target: { label: string; onCancel: () => void; onAdd: (a: any, cfg: any) => void } | null
  addTo: { title: string; docLabel: string; partLabel: string; docs: (Opt & { 2?: string })[]; partsOf: (id: string) => Opt[]; onAdd: (id: string, part: number, a: any, cfg: any) => void; button: string }
  newFrom: { title: string; label: string; hint: string; options: Opt[]; onNew: (id: string, a: any, cfg: any) => void; button: string; footBtn: string }
}
export function ActStore({ target, addTo, newFrom }: StoreProps) {
  const [f, setF] = useState({ q: '', kind: '', subj: '', grade: '' })
  const [openId, setOpenId] = useState<string | null>(null)
  const [cfg, setCfg] = useState<any>(null)
  const [editCfg, setEditCfg] = useState(false)
  const [pick, setPick] = useState<'' | 'add' | 'new'>('')
  const [pd, setPd] = useState(''); const [pa, setPa] = useState('0'); const [pl, setPl] = useState('')
  const cfRef = useRef<HTMLDivElement>(null)
  const qq = norm(f.q); const subs = Array.from(new Set(ACTS.flatMap((a: any) => a.subj as string[])))
  const ok = (a: any) => (!qq || norm(a.title + ' ' + a.subj.join(' ') + ' ' + a.tags.join(' ')).includes(qq)) && (!f.kind || a.kind === f.kind) && (!f.subj || a.subj.includes(f.subj)) && (!f.grade || a.grades.includes(+f.grade))
  const games = ACTS.filter((a: any) => a.kind === 'game' && ok(a)), inter = ACTS.filter((a: any) => a.kind !== 'game' && ok(a))
  const a: any = openId ? actOf(openId) : null
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenId(null) }; addEventListener('keydown', h); return () => removeEventListener('keydown', h) }, [])
  useEffect(() => { if (editCfg && cfRef.current && a) cfRef.current.innerHTML = cfgForm(a, cfg) }, [editCfg, openId, JSON.stringify(cfg)])
  const card = (x: any) => { const [kn, ki] = (AKIND as any)[x.kind]
    return <button type="button" key={x.id} className="acard" onClick={() => { setOpenId(x.id); setCfg(clone(x.cfg)); setPick(''); setEditCfg(false) }}>
      <span className="aart" dangerouslySetInnerHTML={{ __html: (ART as any)[x.art] }} /><span className="abody"><b>{x.title}</b><small>{x.subj.join(' · ')}</small>
        <span className="achips"><span className="achip"><Ic n={ki} /> {kn}</span><span className="achip">{gradeTxt(x.grades)}</span></span><span className="amore">Xem chi tiết <Ic n="chev" /></span></span></button> }
  const dSel = addTo.docs.find(x => x[0] === pd) ?? addTo.docs[0]
  const partOpts = dSel ? addTo.partsOf(dSel[0]) : []
  return <>
    {target && <div className="note infonote"><Ic n="info" /> Đang chọn hoạt động để thêm vào <b>{target.label}</b> — mở một hoạt động rồi bấm “Thêm vào hoạt động đang soạn”. <button type="button" className="btn sm" onClick={target.onCancel}>Huỷ chọn</button></div>}
    <div className="toolbar"><Search value={f.q} onChange={q => setF({ ...f, q })} placeholder="Tìm trò chơi, mô phỏng, giáo cụ…" />
      <Sel label="Tất cả loại" value={f.kind} onChange={v => setF({ ...f, kind: v })} options={Object.entries(AKIND as Record<string, string[]>).map(([k, [n]]) => [k, n])} />
      <Sel label="Tất cả môn" value={f.subj} onChange={v => setF({ ...f, subj: v })} options={subs.map(s => [s, s])} />
      <Sel label="Tất cả khối" value={f.grade} onChange={v => setF({ ...f, grade: v })} options={[6, 7, 8, 9].map(g => [String(g), 'Khối ' + g])} />
      {(f.q || f.kind || f.subj || f.grade) && <button type="button" className="btn sm ghost" onClick={() => setF({ q: '', kind: '', subj: '', grade: '' })}>Xoá lọc</button>}</div>
    {games.length > 0 && <section className="asec"><h2>iGame</h2><p>Trò chơi ôn tập như đua xe, lật thẻ, vòng quay — chỉ cần thay câu hỏi theo bài mình dạy.</p><div className="agrid">{games.map(card)}</div></section>}
    {inter.length > 0 && <section className="asec"><h2>Nội dung tương tác</h2><p>Mô phỏng, giáo cụ ảo và slide để học sinh tự thao tác, quan sát ngay trên màn hình.</p><div className="agrid">{inter.map(card)}</div></section>}
    {!games.length && !inter.length && <Empty>Không có hoạt động phù hợp bộ lọc.</Empty>}
    {a && (() => { const [kn, ki, kc] = (AKIND as any)[a.kind]
      return <><div className="amask" onClick={() => setOpenId(null)} /><div className="amodal" role="dialog" aria-modal="true" aria-label={a.title} style={{ ['--kc' as string]: kc }}>
        <div className="ahero"><span className="aart" dangerouslySetInnerHTML={{ __html: (ART as any)[a.art] }} /><div><div className="achips"><span className="achip code">{a.id}</span><span className="achip k"><Ic n={ki} /> {kn}</span></div><h2>{a.title}</h2></div>
          <button type="button" className="btn sm ghost aclose" aria-label="Đóng" onClick={() => setOpenId(null)}>✕</button></div>
        <div className="abodyw">
          <div className="acfg"><Ic n="sliders" /><div><b>GV cấu hình được</b><p>{a.config}</p></div><button type="button" className="btn sm" onClick={() => setEditCfg(!editCfg)}>{editCfg ? 'Đóng tùy chỉnh' : <><Ic n="edit" /> Tùy chỉnh</>}</button></div>
          {editCfg && <div className="cfbox"><div ref={cfRef} /><div className="formact"><button type="button" className="btn sm ghost" onClick={() => setCfg(clone(a.cfg))}>Về mặc định</button>
            <button type="button" className="btn sm primary" onClick={() => { setCfg(readCfg(a, clone(cfg))) }}>Áp dụng vào bản chơi thử</button></div></div>}
          <div className="achips tags">{a.tags.map((t: string) => <span key={t} className="achip">{t}</span>)}<i className="sep" />{a.grades.map((g: number) => <span key={g} className="achip">THCS {g}</span>)}{a.subj.map((s: string) => <span key={s} className="achip">{s}</span>)}</div>
          <div className="atry"><Ic n="game" /><b>Dùng thử ngay tại đây</b><small>— thao tác thoải mái; dữ liệu kho không đổi</small></div>
          <ActDemo a={a} cfg={cfg} k={'kho-' + a.id} />
        </div>
        {pick === 'add' && <div className="apick"><b>{addTo.title}</b>
          <label className="fld"><span>{addTo.docLabel}</span><select value={dSel?.[0] ?? ''} onChange={e => { setPd(e.target.value); setPa('0') }}>{addTo.docs.map(x => <option key={x[0]} value={x[0]}>{x[1]}</option>)}</select></label>
          <label className="fld"><span>{addTo.partLabel}</span><select value={pa} onChange={e => setPa(e.target.value)}>{partOpts.map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select></label>
          <div className="formact"><button type="button" className="btn sm ghost" onClick={() => setPick('')}>Huỷ</button><button type="button" className="btn sm primary" disabled={!dSel || !partOpts.length} onClick={() => { setOpenId(null); addTo.onAdd(dSel![0], +pa, a, cfg) }}><Ic n="plus" /> Thêm</button></div></div>}
        {pick === 'new' && <div className="apick"><b>{newFrom.title}</b>
          <label className="fld"><span>{newFrom.label}</span><select value={pl || newFrom.options[0]?.[0] || ''} onChange={e => setPl(e.target.value)}>{newFrom.options.map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select></label>
          <small className="hint">{newFrom.hint}</small>
          <div className="formact"><button type="button" className="btn sm ghost" onClick={() => setPick('')}>Huỷ</button><button type="button" className="btn sm primary" disabled={!newFrom.options.length} onClick={() => { setOpenId(null); newFrom.onNew(pl || newFrom.options[0][0], a, cfg) }}><Ic n="rocket" /> {newFrom.button}</button></div></div>}
        <div className="afoot">{target ? <button type="button" className="btn primary big" onClick={() => { setOpenId(null); target.onAdd(a, cfg) }}><Ic n="plus" /> Thêm vào hoạt động đang soạn ({target.label.split(' · ')[0]})</button>
          : <button type="button" className="btn primary big" disabled={!addTo.docs.length} onClick={() => setPick('add')}><Ic n="plus" /> {addTo.button}</button>}
          <button type="button" className="btn big" onClick={() => setPick('new')}><Ic n="rocket" /> {newFrom.footBtn}</button></div>
      </div></> })()}
  </>
}

// ===== Khối nội dung =====
export function ActBlock({ b, k, student }: { b: Block; k: string; student: boolean }) {
  const a: any = actOf(b.act); if (!a) return <Empty>Hoạt động không còn trong kho.</Empty>
  if (student) return <ActDemo a={a} cfg={b.cfg} k={k} />
  const [kn, ki] = (AKIND as any)[a.kind]
  return <div className="abk"><span className="aart sm" dangerouslySetInnerHTML={{ __html: (ART as any)[a.art] }} /><div><b>{a.title}</b><small><Ic n={ki} /> {kn} · {a.id} · {cfgSummary(a, b.cfg)}</small></div>
    <details className="abk-try"><summary className="btn sm"><Ic n="play" /> Chạy thử</summary><ActDemo a={a} cfg={b.cfg} k={k} /></details></div>
}
export function BlockView({ b, k, student }: { b: Block; k: string; student: boolean }) {
  const [pick, setPick] = useState<number | null>(null)
  if (b.type === 'activity') return <ActBlock b={b} k={k} student={student} />
  if (b.type === 'text') return <div className="bk-text">{b.text ? String(b.text).split('\n').map((l, i) => <Fragment key={i}>{i > 0 && <br />}{l}</Fragment>) : <span className="sub">(trống)</span>}</div>
  if (b.type === 'image') return <figure className="bk-img">{b.src ? <img src={b.src} alt={b.caption || 'Hình minh hoạ'} /> : <div className="bk-ph"><Ic n="img" /><span>Chưa có hình</span></div>}{b.caption && <figcaption>{b.caption}</figcaption>}</figure>
  if (b.type === 'video') { const v = videoInfo(b.url)
    if (student && v) return <div className="bk-video"><iframe src={v.embed} title={b.title || 'Video'} style={{ width: '100%', aspectRatio: '16/9', border: 0, borderRadius: 10 }} allow="accelerometer; encrypted-media; picture-in-picture" allowFullScreen /></div>
    return <div className="bk-video"><div className="bk-vframe"><span className="bk-play"><Ic n="play" /></span><div><b>{b.title || 'Video'}</b><small>{v ? v.kind + (b.start ? ' · bắt đầu ' + b.start : '') : 'Chưa có đường dẫn'}</small></div></div>
      {v && <a className="btn sm" href={b.url} target="_blank" rel="noreferrer"><Ic n="external" /> Mở video</a>}</div> }
  if (b.type === 'quiz') return <div className="bk-quiz"><b className="q">{b.q || 'Câu hỏi'}</b><div className="opts">{(b.opts as string[]).map((o, i) => { const show = student && pick != null
    return <button type="button" key={i} className={'opt' + (show && i === b.ans ? ' right' : '') + (show && pick === i && i !== b.ans ? ' wrong' : '') + (!student && i === b.ans ? ' key' : '')} disabled={!student} onClick={() => setPick(i)}><span className="ol">{'ABCDEF'[i]}</span>{o}</button> })}</div>
    {student && pick != null ? <p className={'fb ' + (pick === b.ans ? 'ok' : 'no')}>{pick === b.ans ? 'Chính xác!' : 'Chưa đúng — đáp án ' + 'ABCDEF'[b.ans] + '.'} {b.explain}</p> : !student && b.explain ? <p className="sub" style={{ margin: 0 }}>Giải thích: {b.explain}</p> : null}</div>
  if (b.type === 'short') return <div className="bk-quiz"><b className="q">{b.q || 'Câu hỏi'}</b>{student ? <textarea rows={2} placeholder="Câu trả lời của em…" aria-label="Câu trả lời" /> : <p className="sub" style={{ margin: 0 }}>Gợi ý đáp án: {b.hint || '—'}</p>}</div>
  if (b.type === 'link') return <a className="bk-link" href={b.url || '#'} target="_blank" rel="noreferrer"><Ic n="link" /><span><b>{b.title || b.url || 'Liên kết'}</b><small>{b.url}</small></span><Ic n="external" /></a>
  return null
}
export function BlockEdit({ b, bi, n, k, set, move, del, setMsg }: { b: Block; bi: number; n: number; k: string; set: (p: Partial<Block>) => void; move: (d: -1 | 1) => void; del: () => void; setMsg: (m: string) => void }) {
  const f = (key: string, ph: string, val?: string) => <input defaultValue={val ?? b[key] ?? ''} key={key + (val ?? b[key] ?? '')} placeholder={ph} aria-label={ph} onBlur={e => e.target.value !== (val ?? b[key] ?? '') && set({ [key]: e.target.value })} />
  let body: ReactNode = null
  if (b.type === 'activity') body = <ActBlock b={b} k={k} student={false} />
  if (b.type === 'text') body = <textarea rows={3} placeholder="Nội dung…" defaultValue={b.text || ''} onBlur={e => e.target.value !== b.text && set({ text: e.target.value })} />
  if (b.type === 'image') body = <div className="bk-imgedit">{b.src ? <img src={b.src} alt="" /> : <div className="bk-ph"><Ic n="img" /><span>Chưa có hình</span></div>}<div className="bk-col">
    <label className="btn sm"><Ic n="upload" /> Tải ảnh lên<input type="file" accept="image/*" hidden onChange={e => { const file = e.target.files?.[0]; if (!file) return; if (file.size > 1.5e6) return setMsg('Ảnh lớn hơn 1,5 MB — chọn ảnh nhỏ hơn')
      const r = new FileReader(); r.onload = () => set({ src: r.result as string }); r.readAsDataURL(file) }} /></label>
    {f('src', 'hoặc dán đường dẫn ảnh https://…', String(b.src ?? '').startsWith('data:') ? '' : b.src)}{f('caption', 'Chú thích ảnh')}</div></div>
  if (b.type === 'video') { const v = videoInfo(b.url)
    body = <>{f('url', 'Dán link YouTube, Vimeo, Google Drive…')}<div className="bk-row">{f('title', 'Tiêu đề video')}{f('start', 'Bắt đầu từ (vd 1:20)')}</div>
      {b.url && <small className={v ? 'sub' : 'err'}>{v ? 'Nhận dạng: ' + v.kind + (v.id ? ' · mã ' + v.id : '') : 'Link chưa hợp lệ'}</small>}</> }
  if (b.type === 'quiz') body = <>{f('q', 'Câu hỏi')}<div className="bk-opts">{(b.opts as string[]).map((o, i) => <div key={i} className="bk-opt">
      <input type="radio" name={`ans-${k}`} checked={b.ans === i} onChange={() => set({ ans: i })} aria-label={`Đáp án đúng ${'ABCDEF'[i]}`} /><span className="ol">{'ABCDEF'[i]}</span>
      <input defaultValue={o} key={o} aria-label={`Phương án ${'ABCDEF'[i]}`} onBlur={e => e.target.value !== o && set({ opts: b.opts.map((x: string, j: number) => j === i ? e.target.value : x) })} />
      {b.opts.length > 2 && <button type="button" className="btn sm ghost" aria-label="Bỏ phương án" onClick={() => { const opts = b.opts.filter((_: string, j: number) => j !== i); set({ opts, ans: b.ans >= opts.length ? 0 : b.ans }) }}>✕</button>}</div>)}
    {b.opts.length < 6 && <button type="button" className="btn sm ghost" onClick={() => set({ opts: [...b.opts, ''] })}><Ic n="plus" /> Phương án</button>}</div>
    {f('explain', 'Giải thích đáp án (hiện sau khi học sinh chọn)')}<small className="sub">Chọn nút tròn ở phương án đúng.</small></>
  if (b.type === 'short') body = <>{f('q', 'Câu hỏi')}{f('hint', 'Gợi ý đáp án cho giáo viên')}</>
  if (b.type === 'link') body = <div className="bk-row">{f('title', 'Tên liên kết')}{f('url', 'https://…')}</div>
  return <div className="bk ed"><div className="bk-h"><span className="tag"><Ic n={BLOCK_KIND[b.type]?.[1] ?? 'info'} /> {BLOCK_KIND[b.type]?.[0] ?? b.type}</span>
    <span className="bk-tools"><button type="button" className="btn sm ghost" aria-label="Lên" disabled={!bi} onClick={() => move(-1)}>↑</button><button type="button" className="btn sm ghost" aria-label="Xuống" disabled={bi >= n - 1} onClick={() => move(1)}>↓</button>
      <button type="button" className="btn sm ghost" aria-label="Xoá khối" onClick={del}><Ic n="trash" /></button></span></div>{body}</div>
}

// ===== Trình soạn bài giảng =====
