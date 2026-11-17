// Dùng: node scripts/mau-css.cjs docs/mockup/he-thong-stem.html src/modules/ph1/mau/mau.css
// Sinh mau.css từ CSS của bản mẫu (phạm vi .mau). Quy tắc như scripts/mau-css.py, thêm:
// - giao diện mặc định của bản mẫu v315 là :root[data-skin="modern"] → áp; skin khác bỏ
// - :root / html / body / #app ở đầu bộ chọn → .mau (khung nội dung của app)
const fs = require('fs')
const src = fs.readFileSync(process.argv[2], 'utf8')
const css = src.slice(src.indexOf('<style>') + 7, src.indexOf('</style>')).replace(/\/\*[\s\S]*?\*\//g, '')
function pref(sel) {
  let s = sel.trim(); if (!s) return null
  if (s.includes('data-theme')) return null
  const cv = s.match(/^\[data-cover="(\w+)"\]\s*(.*)$/s)
  if (cv) { if (cv[1] !== 'icon') return null; return '.mau[data-cover="icon"] ' + cv[2] }
  let base = '.mau', hit = false
  const r = s.match(/^:root((?:\[[^\]]*\])*)/)
  if (r) {
    const at = r[1]
    // giao diện: “Hiện đại” là mặc định (mọi skin trừ classic); “Tiêu chuẩn” khi <html data-skin="classic">
    if (/data-skin="modern"/.test(at)) base = ':root:not([data-skin="classic"]) .mau'
    else if (/data-skin="classic"/.test(at)) base = ':root[data-skin="classic"] .mau'
    else if (/data-skin/.test(at)) return null
    if (/data-cover/.test(at) && !/data-cover="icon"/.test(at)) return null
    s = s.slice(r[0].length).trimStart(); hit = true
  }
  for (;;) { const m = s.match(/^(html|body)((?:\.[\w-]+)*)(?=[\s>+~:]|$)/); if (!m) break; base += m[2]; s = s.slice(m[0].length).trimStart(); hit = true }
  if (s.startsWith('#app')) return base + s.slice(4)
  if (!s) return base
  if (!hit) return '.mau ' + s
  return base + (/^[>+~:]/.test(s) ? '' : ' ') + s
}
function splitSel(h) { const out = []; let d = 0, cur = ''; for (const c of h) { if (c === '(') d++; if (c === ')') d--; if (c === ',' && d === 0) { out.push(cur); cur = '' } else cur += c } out.push(cur); return out }
function proc(block) {
  const out = []; let i = 0; const n = block.length
  while (i < n) {
    if (/\s/.test(block[i])) { i++; continue }
    const j = block.indexOf('{', i); if (j < 0) break
    const head = block.slice(i, j).trim(); let d = 0, k = j
    for (;;) { if (block[k] === '{') d++; else if (block[k] === '}') { d--; if (d === 0) break } k++ }
    const body = block.slice(j + 1, k); i = k + 1
    if (head.startsWith('@media')) { if (head.includes('prefers-color-scheme')) continue; const inner = proc(body); if (inner.trim()) out.push(head + '{' + inner + '}') }
    else if (head.startsWith('@keyframes') || head.startsWith('@font-face')) out.push(head + '{' + body + '}')
    else if (head.startsWith('@')) out.push(head + '{' + proc(body) + '}')
    else { const sels = splitSel(head).map(pref).filter(Boolean); if (sels.length) out.push(sels.join(',') + '{' + body.trim() + '}') }
  }
  return out.join('\n')
}
const hdr = '/* Bản mẫu giao diện v315 (docs/mockup/he-thong-stem.html), phạm vi .mau — SINH TỰ ĐỘNG bằng scripts/mau-css.cjs, không sửa tay.\n   Chỉnh riêng cho app: src/modules/ph1/mau/app.css */\n'
fs.writeFileSync(process.argv[3], hdr + proc(css) + '\n')
