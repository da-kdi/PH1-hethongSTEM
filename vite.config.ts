import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// BẢN TÁCH PH1 — không đi theo patch ghép về repo chính.
//   • VITE_BASE: đường dẫn gốc khi đặt dưới thư mục con (GitHub Pages: /PH1-hethongSTEM/)
//   • Chặn chạy/dựng khi .env trỏ vào CSDL Supabase của BẢN CHÍNH: bản PH1 chỉ dùng project riêng.
const MAIN_REF = 'tsvujwddjpnchkdxqjza'

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env }
  const url = env.VITE_SUPABASE_URL ?? ''
  if (!url) throw new Error('Thiếu VITE_SUPABASE_URL: sao .env.example thành .env và điền project Supabase RIÊNG của PH1.')
  if (url.includes(MAIN_REF)) throw new Error('VITE_SUPABASE_URL đang trỏ vào CSDL của BẢN CHÍNH. Bản PH1 phải dùng project Supabase riêng (xem docs/GHEP-VE-REPO-CHINH.md mục 2).')
  return { base: process.env.VITE_BASE ?? '/', plugins: [react()] }
})
