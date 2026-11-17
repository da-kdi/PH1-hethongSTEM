// Nhập câu hỏi có sẵn (bản mẫu v315 · C5: qParse, docxLines, sheetToQText, qTemplate) — chạy hoàn toàn trên trình duyệt, không thêm thư viện.
//   Văn bản / Word: "Câu 1: …", phương án "A. … B. …", đáp án đúng đánh * trước phương án, hoặc dòng "Đáp án: B" (Word: gạch chân / tô đỏ / tô nền).
//   Excel / CSV: cột Câu hỏi | A | B | C | D | Đáp án | Mức độ | Giải thích.
import { readRows, norm as nrm, downloadXlsx } from '../../../lib/sheet'

export type Lv = 'nhan_biet' | 'thong_hieu' | 'van_dung' | 'van_dung_cao'
export const LV: Record<Lv, string> = { nhan_biet: 'Nhận biết', thong_hieu: 'Thông hiểu', van_dung: 'Vận dụng', van_dung_cao: 'Vận dụng cao' }
export type PQ = { text: string; opts: string[]; ans: number[]; key: string; expl: string; lv: Lv; type: 'single' | 'multi' | 'truefalse' | 'short' | 'essay'; err: string }
// Đáp án điền khuyết (068): dòng “Đáp án: …”, nhiều đáp án chấp nhận ngăn bằng / hoặc ;
export const shortKeys = (k: string) => k.split(/\s*[\/;|]\s*/).map(x => x.trim()).filter(Boolean)

const lvKey = (s: string): Lv | null => { const n = nrm(s)
  return /^(vdc|van dung cao)$/.test(n) ? 'van_dung_cao' : /^(vd|van dung)$/.test(n) ? 'van_dung' : /^(th|thong hieu)$/.test(n) ? 'thong_hieu' : /^(nb|nhan biet)$/.test(n) ? 'nhan_biet' : null }
const QSTART = /^\s*(?:câu|cau|question)\s*\d+\s*[:.)\-–]?/i

export function qParse(text: string, defLv: Lv = 'thong_hieu'): PQ[] {
  const lines = String(text ?? '').replace(/\r/g, '').split('\n')
    .flatMap(l => /^\s*\*?\s*A\s*[.)]\s/.test(l) && /\s\*?\s*B\s*[.)]\s/.test(l) ? l.split(/(?=\s\*?\s*[B-H]\s*[.)]\s)/).map(x => x.trim()) : [l])
  const marked = lines.some(l => QSTART.test(l)); const blocks: string[][] = []; let cur: string[] | null = null
  const push = () => { if (cur?.some(l => l.trim())) blocks.push(cur); cur = null }
  for (const l of lines) { if (marked && QSTART.test(l)) { push(); cur = [l]; continue }
    if (!marked && !l.trim()) { push(); continue } if (marked && !cur) continue; (cur ??= []).push(l) }
  push(); return blocks.map(b => qBlock(b, defLv))
}
function qBlock(b: string[], defLv: Lv): PQ {
  const q: PQ = { text: '', opts: [], ans: [], key: '', expl: '', lv: defLv, type: 'single', err: '' }; let mode = 'text'; let m: RegExpMatchArray | null
  for (const raw of b) { let l = raw.trim(); if (!l) continue
    if (!q.text && mode === 'text' && (m = l.match(/^(?:câu|cau|question)\s*\d+\s*[:.)\-–]?\s*(.*)$/i))) { l = m[1].trim(); if (!l) continue }
    if ((m = l.match(/^(?:đáp án|dap an|answer)\s*(?:đúng)?\s*[:：]\s*(.*)$/i))) { const v = m[1].trim()
      if (q.opts.length && /^[A-Ha-h](\s*[,;/&và]+\s*[A-Ha-h])*$/i.test(v)) q.ans = [...new Set((v.toUpperCase().match(/[A-H]/g) ?? []).map(c => c.charCodeAt(0) - 65))]; else q.key = v; mode = 'x'; continue }
    if ((m = l.match(/^(?:giải thích|giai thich|lời giải|loi giai|hướng dẫn giải)\s*[:：]\s*(.*)$/i))) { q.expl = m[1]; mode = 'expl'; continue }
    if ((m = l.match(/^(?:mức độ|muc do|mức)\s*[:：]\s*(.*)$/i))) { q.lv = lvKey(m[1]) ?? q.lv; continue }
    if ((m = l.match(/^(\*)?\s*([A-Ha-h])\s*[.)]\s*(.*?)\s*(\*|\(đúng\))?$/i)) && q.text && m[2].toUpperCase().charCodeAt(0) - 65 === q.opts.length) { q.opts.push(m[3]); if (m[1] || m[4]) q.ans.push(q.opts.length - 1); mode = 'opt'; continue }
    if (mode === 'expl') { q.expl += ' ' + l; continue }
    if (mode === 'opt') { q.opts[q.opts.length - 1] += ' ' + l; continue }
    const tg = l.match(/\[(NB|TH|VDC|VD)\]/i); if (tg) { q.lv = lvKey(tg[1]) ?? q.lv; l = l.replace(tg[0], '').trim() }
    q.text += (q.text ? '\n' : '') + l }
  const tf = q.opts.length === 2 && /^đúng$/i.test(q.opts[0].trim()) && /^sai$/i.test(q.opts[1].trim())
  if (q.opts.length >= 2) q.type = tf ? 'truefalse' : q.ans.length > 1 ? 'multi' : 'single'
  else if (/^(đúng|sai|đ|s)$/i.test(q.key)) { q.type = 'truefalse'; q.ans = [/^(đúng|đ)$/i.test(q.key) ? 0 : 1]; q.opts = ['Đúng', 'Sai']; q.key = '' }
  else q.type = q.key.trim() ? 'short' : 'essay'   // có “Đáp án: …” bằng chữ → điền khuyết; không có → tự luận
  q.err = !q.text ? 'Thiếu nội dung câu hỏi' : q.opts.length === 1 ? 'Cần ít nhất 2 phương án A, B…' : q.type === 'short' || q.type === 'essay' ? ''
    : !q.ans.length ? 'Chưa đánh dấu đáp án đúng (thêm * trước phương án đúng)' : q.opts.some(o => !o.trim()) ? 'Có phương án để trống' : q.opts.length > 8 ? 'Tối đa 8 phương án' : ''
  return q
}
export const qSer = (qs: PQ[]) => qs.map((q, i) => [`Câu ${i + 1}: ${q.text}`, ...(q.type !== 'truefalse' ? q.opts.map((o, k) => `${q.ans.includes(k) ? '*' : ''}${String.fromCharCode(65 + k)}. ${o}`) : []),
  q.type === 'truefalse' ? `Đáp án: ${q.ans[0] === 1 ? 'Sai' : 'Đúng'}` : q.type === 'short' ? `Đáp án: ${q.key}` : '', `Mức độ: ${LV[q.lv]}`, q.expl ? `Giải thích: ${q.expl}` : ''].filter(Boolean).join('\n')).join('\n\n')

// ----- Excel / CSV → văn bản câu hỏi -----
export function sheetToQText(rows: string[][]) {
  const n = (s: unknown) => nrm(String(s ?? '')); let h = rows.findIndex(r => r.some(c => /^(cau hoi|noi dung|noi dung cau hoi|question)$/.test(n(c))))
  let map: { q: number; ans: number; lv: number; ex: number; o: number[] }
  if (h >= 0) { const H = rows[h].map(n); const col = (re: RegExp) => H.findIndex(x => re.test(x))
    map = { q: col(/^(cau hoi|noi dung|noi dung cau hoi|question)$/), ans: col(/^(dap an dung|dap an|answer|key)$/), lv: col(/^(muc do|level)$/), ex: col(/^(giai thich|loi giai)$/),
      o: [...'abcdefgh'].map(L => H.findIndex(x => x === L || x === 'phuong an ' + L || x === 'dap an ' + L)) } }
  else { h = -1; map = { q: 0, o: [1, 2, 3, 4, -1, -1, -1, -1], ans: 5, lv: 6, ex: 7 } }
  return rows.slice(h + 1).filter(r => String(r[map.q] ?? '').trim()).map((r, i) => { const v = (k: number) => k >= 0 ? String(r[k] ?? '').trim() : ''
    return [`Câu ${i + 1}: ${v(map.q)}`, ...map.o.map((k, j) => v(k) ? `${String.fromCharCode(65 + j)}. ${v(k)}` : '').filter(Boolean), v(map.ans) ? `Đáp án: ${v(map.ans)}` : '',
      v(map.lv) ? `Mức độ: ${v(map.lv)}` : '', v(map.ex) ? `Giải thích: ${v(map.ex)}` : ''].filter(Boolean).join('\n') }).join('\n\n')
}

// ----- ZIP tối giản (đọc/ghi .docx) bằng DecompressionStream có sẵn trong trình duyệt -----
async function unzipEntry(buf: ArrayBuffer, name: string): Promise<string | null> {
  const v = new DataView(buf); let e = buf.byteLength - 22
  while (e >= 0 && v.getUint32(e, true) !== 0x06054b50) e--
  if (e < 0) return null
  const n = v.getUint16(e + 10, true); let p = v.getUint32(e + 16, true)
  for (let i = 0; i < n; i++) {
    const method = v.getUint16(p + 10, true), csize = v.getUint32(p + 20, true), fl = v.getUint16(p + 28, true), xl = v.getUint16(p + 30, true), cl = v.getUint16(p + 32, true), off = v.getUint32(p + 42, true)
    const fname = new TextDecoder().decode(new Uint8Array(buf, p + 46, fl))
    if (fname === name) {
      const lfl = v.getUint16(off + 26, true), lxl = v.getUint16(off + 28, true); const data = new Uint8Array(buf, off + 30 + lfl + lxl, csize)
      if (method === 0) return new TextDecoder().decode(data)
      const ds = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
      return await new Response(ds).text()
    }
    p += 46 + fl + xl + cl
  }
  return null
}
const CRC = (() => { const t = new Uint32Array(256); for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[i] = c >>> 0 } return t })()
const crc32 = (d: Uint8Array) => { let c = 0xffffffff; for (const b of d) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
function zipStore(files: [string, string][]): Blob {
  const enc = new TextEncoder(); const parts: Uint8Array[] = []; const cen: Uint8Array[] = []; let off = 0
  for (const [name, text] of files) {
    const nb = enc.encode(name), d = enc.encode(text), crc = crc32(d)
    const h = new DataView(new ArrayBuffer(30)); h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint32(14, crc, true); h.setUint32(18, d.length, true); h.setUint32(22, d.length, true); h.setUint16(26, nb.length, true)
    parts.push(new Uint8Array(h.buffer), nb, d)
    const c = new DataView(new ArrayBuffer(46)); c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint32(16, crc, true); c.setUint32(20, d.length, true); c.setUint32(24, d.length, true); c.setUint16(28, nb.length, true); c.setUint32(42, off, true)
    cen.push(new Uint8Array(c.buffer), nb); off += 30 + nb.length + d.length
  }
  const size = cen.reduce((a, x) => a + x.length, 0)
  const e = new DataView(new ArrayBuffer(22)); e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, size, true); e.setUint32(16, off, true)
  return new Blob([...parts, ...cen, new Uint8Array(e.buffer)] as BlobPart[], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
}

// Word: đọc từng đoạn; phương án gạch chân / tô đỏ / tô nền được hiểu là đáp án đúng
export async function docxText(buf: ArrayBuffer): Promise<string> {
  const xml = await unzipEntry(buf, 'word/document.xml'); if (!xml) throw new Error('Không đọc được file Word (.docx)')
  const doc = new DOMParser().parseFromString(xml, 'application/xml'); const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
  const tag = (el: Element | Document, n: string) => Array.from(el.getElementsByTagNameNS(W, n)); const out: string[] = []
  for (const p of tag(doc, 'p')) { let t = ''; const mk: [number, number][] = []
    for (const r of tag(p, 'r')) { const s = tag(r, 't').map(x => x.textContent).join('') + (tag(r, 'tab').length ? ' ' : ''); const pr = tag(r, 'rPr')[0]
      const u = pr && tag(pr, 'u')[0]; const col = pr && tag(pr, 'color')[0]?.getAttributeNS(W, 'val')
      const hi = !!pr && ((!!u && u.getAttributeNS(W, 'val') !== 'none') || /^(FF0000|C00000|E00000|EE0000)$/i.test(col ?? '') || tag(pr, 'highlight').length > 0)
      if (hi && s.trim()) mk.push([t.length, t.length + s.length]); t += s }
    if (mk.length) { const starts = [...t.matchAll(/(^|\s)([A-H])\s*[.)]\s/g)].map(m => (m.index ?? 0) + m[1].length)
      if (starts.length) { let o = ''; let last = 0; starts.forEach((s0, i) => { const e0 = starts[i + 1] ?? t.length; o += t.slice(last, s0) + (mk.some(([a, b]) => a < e0 && b > s0) ? '*' : ''); last = s0 }); t = o + t.slice(last) } }
    out.push(t) }
  return out.join('\n')
}
export async function fileToQText(f: File): Promise<string> {
  if (/\.docx$/i.test(f.name)) return docxText(await f.arrayBuffer())
  if (/\.(xlsx|csv)$/i.test(f.name)) return sheetToQText(await readRows(f))
  if (/\.txt$/i.test(f.name)) return f.text()
  throw new Error('Chỉ nhận file Word (.docx), Excel (.xlsx), .csv hoặc .txt')
}

// File mẫu
const SAMPLE = [['Nước sôi ở bao nhiêu độ C (ở áp suất thường)?', '90', '100', '110', '120', 'B', 'Nhận biết', 'Ở áp suất 1 atm nước sôi ở 100°C.'],
  ['Những vật nào sau đây dẫn điện tốt?', 'Dây đồng', 'Thước nhựa', 'Đinh sắt', 'Tờ giấy', 'A, C', 'Thông hiểu', ''],
  ['Pin mặt trời biến quang năng thành điện năng.', 'Đúng', 'Sai', '', '', 'A', 'Nhận biết', '']]
export async function qTemplate(kind: 'xlsx' | 'docx') {
  if (kind === 'xlsx') return downloadXlsx('mau-cau-hoi.xlsx', ['Câu hỏi', 'A', 'B', 'C', 'D', 'Đáp án', 'Mức độ', 'Giải thích'].map((l, i) => ({ key: 'c' + i, label: l, width: i === 0 ? 48 : i === 7 ? 36 : 14 })), SAMPLE, 'Câu hỏi')
  const x = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
  const para = (s: string, o: { b?: boolean; u?: boolean } = {}) => `<w:p><w:r>${o.b || o.u ? `<w:rPr>${o.b ? '<w:b/>' : ''}${o.u ? '<w:u w:val="single"/><w:color w:val="C00000"/>' : ''}</w:rPr>` : ''}<w:t xml:space="preserve">${x(s)}</w:t></w:r></w:p>`
  const body = [para('MẪU NHẬP CÂU HỎI', { b: true }), para('Mỗi câu bắt đầu bằng "Câu 1:", phương án A. B. C. D.; đáp án đúng gạch chân (hoặc tô đỏ, hoặc đánh * phía trước).'), para(''),
    ...SAMPLE.flatMap((r, i) => [para(`Câu ${i + 1}: ${r[0]}`, { b: true }), ...r.slice(1, 5).filter(Boolean).map((o, k) => para(`${'ABCD'[k]}. ${o}`, { u: r[5].includes('ABCD'[k]) })), para(`Mức độ: ${r[6]}`), ...(r[7] ? [para(`Giải thích: ${r[7]}`)] : []), para('')])].join('')
  const blob = zipStore([
    ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'],
    ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'],
    ['word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`]])
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'mau-cau-hoi.docx'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
