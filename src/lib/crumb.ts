// Đường dẫn trên thanh trên cùng (bản mẫu v315 · A2): trang chi tiết báo tên bản ghi đang xem + hàm quay lại.
// Thanh trên đọc qua useCrumbDetail(); khi có bản ghi, body có lớp "hascrumb" để ẩn nút "← Danh sách…" trong trang.
import { useEffect, useRef, useSyncExternalStore } from 'react'

type Detail = { title: string; back: () => void }
let cur: Detail | null = null
const subs = new Set<() => void>()
const emit = () => { document.body.classList.toggle('hascrumb', !!cur); subs.forEach(f => f()) }

export function useDetailCrumb(title: string | null | undefined, back: (() => void) | undefined) {
  const ref = useRef(back)
  ref.current = back
  useEffect(() => {
    if (!title) return
    const me: Detail = { title, back: () => ref.current?.() }
    cur = me; emit()
    return () => { if (cur === me) { cur = null; emit() } }
  }, [title])
}

export const useCrumbDetail = () => useSyncExternalStore(f => { subs.add(f); return () => { subs.delete(f) } }, () => cur)
