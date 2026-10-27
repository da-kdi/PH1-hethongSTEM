#!/usr/bin/env python3
"""Sinh src/modules/ph1/mau/mau.css từ CSS của bản mẫu giao diện (một file HTML), gói trong phạm vi .mau.
Dùng: python3 scripts/mau-css.py duong-dan/ph1-chuong-trinh-mau.html
- Bỏ chế độ tối của bản mẫu (app chưa có), chỉ giữ kiểu bìa "icon".
- :root / html / body của bản mẫu → .mau (biến màu, phông chữ đặt trên khung .mau)."""
import re, sys
src = open(sys.argv[1], encoding='utf-8').read()
css = re.sub(r'/\*.*?\*/', '', src[src.index('<style>') + 7:src.index('</style>')], flags=re.S)
def pref(sel):
    sel = sel.strip()
    if 'data-theme' in sel: return None
    m = re.match(r'\[data-cover="(\w+)"\]\s*(.*)', sel)
    if m:
        if m.group(1) != 'icon': return None
        return '.mau[data-cover="icon"] ' + m.group(2)
    if sel.startswith(':root') or sel in ('html', 'body'): return '.mau'
    if sel.startswith('body'): return '.mau' + sel[4:]
    return '.mau ' + sel
def process(block):
    out, i, n = [], 0, len(block)
    while i < n:
        if block[i].isspace(): i += 1; continue
        j = block.index('{', i); head = block[i:j].strip(); d, k = 0, j
        while True:
            if block[k] == '{': d += 1
            elif block[k] == '}':
                d -= 1
                if d == 0: break
            k += 1
        body = block[j + 1:k]; i = k + 1
        if head.startswith('@media'):
            if 'prefers-color-scheme' in head: continue
            inner = process(body)
            if inner.strip(): out.append(head + '{' + inner + '}')
        elif head.startswith('@keyframes') or head.startswith('@font-face'): out.append(head + '{' + body + '}')
        elif head.startswith('@'): out.append(head + '{' + process(body) + '}')
        else:
            sels = [x for x in (pref(s) for s in re.split(r',(?![^()]*\))', head)) if x]
            if sels: out.append(','.join(sels) + '{' + body.strip() + '}')
    return '\n'.join(out)
hdr = '/* Bản mẫu giao diện PH1 (ph1-chuong-trinh-mau.html), phạm vi .mau — SINH TỰ ĐỘNG bằng scripts/mau-css.py, không sửa tay.\n   Chỉnh riêng cho app: src/modules/ph1/mau/app.css */\n'
open('src/modules/ph1/mau/mau.css', 'w', encoding='utf-8').write(hdr + process(css) + '\n')
