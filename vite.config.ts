import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// VITE_BASE: đường dẫn gốc khi đặt dưới thư mục con (bản tách PH1 trên GitHub Pages: /PH1-hethongSTEM/)
export default defineConfig({ base: process.env.VITE_BASE ?? '/', plugins: [react()] })
