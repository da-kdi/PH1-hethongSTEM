import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { errMsg, useRpcBool } from '../ph1/ui'
import { effectiveCatalog, useCatalog, useOrgs } from '../ph1/curriculum/api'
import { loadDB, mk, type DB } from './api'

// Nạp dữ liệu PH2 + danh mục môn (dùng chung PH1) + quyền quản lý
export function useP2(orgId: string | null) {
  const [catKey, setCatKey] = useState(0)
  const { all, hidden } = useCatalog(catKey)
  const { below } = useOrgs(orgId)
  const cat = effectiveCatalog(all, hidden, below)
  const [db, setDb] = useState<DB | null>(null)
  const [msg, setMsg] = useState('')
  const canManage = useRpcBool('curriculum_can_manage')
  async function reload() { try { setDb(await loadDB(orgId, all)) } catch (e) { setMsg(errMsg((e as Error).message)) } }
  useEffect(() => { reload() }, [orgId, all.length])
  const k = useMemo(() => (db ? mk(db, cat) : null), [db, cat])
  // Ghi CSDL: báo lỗi ở thanh thông báo, thành công thì nạp lại
  async function run(p: PromiseLike<{ error: { message: string } | null }>, ok?: string) {
    const { error } = await p; if (error) { setMsg(errMsg(error.message)); return false }
    if (ok) setMsg(ok); await reload(); return true
  }
  return { db, k, cat, msg, setMsg, reload, run, canManage, reloadCat: () => setCatKey(x => x + 1), supabase }
}
export type P2 = ReturnType<typeof useP2>
