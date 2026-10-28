import { useEffect, useState, Suspense, type ComponentType } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { NAV, ROLE_LABEL, MODULE_OF, ENT_MODULE_OF, RoleKey, UPSELL_PORTALS, PHASE_OF, labelOf } from './lib/nav'
import { LockedModule } from './components/LockedModule'
import { useAccess, switchOrg } from './lib/auth'
import { useYears, yearLabel } from './lib/year'
import Bell from './components/Bell'
import { navigatePage, onHistoryPage } from './lib/history'
import MfaGate from './components/MfaGate'
import logo from './assets/kdi-logo.png'
import logoWhite from './assets/kdi-logo-white.png'
import { NavIcon } from './components/NavIcon'
import { MenuSearch, UserMenu } from './components/TopBar'
import Login, { SetPassword } from './pages/Login'
import { mustChangePassword } from './lib/login'
import { useBranding, DEFAULT_TITLE } from './lib/branding'
import LegalGate from './components/LegalGate'
import OfflineBar from './components/OfflineBar'
import HelpWidget from './components/HelpWidget'
// BẢN TÁCH PH1: chỉ nối các màn của Phân hệ 1 · Chương trình & học liệu (src/modules/ph1/pages.tsx).
// Repo chính giữ bảng trang đầy đủ; khi ghép về chỉ trộn PH1_PAGES vào các bảng đó (docs/GHEP-VE-REPO-CHINH.md).
import { PH1_PAGES } from './modules/ph1/pages'
import { PH2_PAGES } from './modules/ph2/pages'

type PageMap = Record<string, ComponentType<any>>
const PLATFORM_LIVE = new Set([...Object.keys(PH1_PAGES.platform ?? {}), ...Object.keys(PH2_PAGES.platform ?? {})])
// Tên trang cũ (liên kết nội bộ của trang Sở) → tên trong menu Quản trị nền tảng
const PLATFORM_ALIAS: Record<string, string> = {
  'KPI & Xếp hạng Xã/Phường': 'KPI & xếp hạng', 'Thiết bị & kho': 'Thiết bị & vật tư', 'Hiệu quả Phòng STEM': 'Hiệu quả sử dụng phòng STEM',
  'Dashboard điểm danh': 'Buổi dạy & điểm danh', 'Thời khoá biểu & xếp lịch': 'Thời khóa biểu & xếp lịch',
}
export const PAGES: Partial<Record<RoleKey, PageMap>> = Object.fromEntries((Object.keys(PH1_PAGES) as RoleKey[]).map(r => [r, { ...PH1_PAGES[r], ...(PH2_PAGES[r] ?? {}) }]))
// Khi dev: mục menu không có trang (thường do sửa chuỗi mã trong NAV thay vì thêm LABEL — xem lib/nav.ts)
if (import.meta.env.DEV) (Object.keys(PAGES) as RoleKey[]).filter(r => r !== 'platform').forEach(r =>
  NAV[r].flatMap(g => g.items).filter(i => !PAGES[r]![i]).forEach(i => console.warn(`[menu] ${r}: "${i}" không có trang`)))

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [recovery, setRecovery] = useState(false)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((e, s) => {
      setSession(s)
      if (e === 'PASSWORD_RECOVERY') setRecovery(true)   // mở từ liên kết "Quên mật khẩu"
    })
    return () => data.subscription.unsubscribe()
  }, [])
  if (session === undefined) return null
  if (!session) return <Login />
  // Quên mật khẩu; hoặc tài khoản mã lần đầu đăng nhập / vừa được trường đặt lại mật khẩu (bắt buộc đổi)
  if (recovery || mustChangePassword(session.user.user_metadata)) return <SetPassword forced={!recovery} onDone={() => setRecovery(false)} />
  return <MfaGate key={session.user.id}><LegalGate><Shell session={session} /></LegalGate></MfaGate>
}

function Shell({ session }: { session: Session }) {
  const access = useAccess(session)
  const [role, setRole] = useState<RoleKey | null>(null)
  const [page, setPage] = useState('')
  const [collapsed, setCollapsed] = useState(false)
  // Nhóm menu đang thu gọn (nhớ theo trình duyệt)
  const [closed, setClosed] = useState<Set<string>>(() => { try { return new Set(JSON.parse(localStorage.getItem('menu.closed') ?? '[]')) } catch { return new Set() } })
  const toggleGroup = (key: string) => setClosed(prev => {
    const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key)
    try { localStorage.setItem('menu.closed', JSON.stringify([...next])) } catch { /* bỏ qua */ }
    return next
  })
  const [teachers, setTeachers] = useState<{ id: string; full_name: string; profile_id: string | null }[]>([])
  const [actingTeacher, setActingTeacher] = useState<string | null>(null)
  const [students, setStudents] = useState<{ id: string; full_name: string; profile_id: string | null; classes: { name: string } | null }[]>([])
  const [actingStudent, setActingStudent] = useState<string | null>(null)
  const [changingPw, setChangingPw] = useState(false)
  const yrs = useYears(access.profile?.org_id)

  // Bản tách PH1: bỏ cổng không có mục nào (phụ huynh, giám khảo)
  const views: RoleKey[] = access.portals.filter(v => NAV[v].length > 0)

  useEffect(() => {
    if (!access.loading && !role && views.length) {
      // Tải lại trang: mở lại đúng trang đang xem (lưu trong lịch sử trình duyệt) nếu vẫn còn quyền
      const st = (history.state ?? {}) as { role?: RoleKey; page?: string }
      const keep = st.role && views.includes(st.role) && NAV[st.role].some(g => g.items.includes(st.page ?? ''))
      const r = keep ? st.role! : views[0], p = keep ? st.page! : NAV[views[0]][0].items[0]
      navigatePage(r, p, true); setRole(r); setPage(p)
    }
  }, [access.loading, views.length])

  // Nút Back/Forward của trình duyệt: chuyển giữa các trang đã mở trong ứng dụng
  useEffect(() => {
    onHistoryPage(s => {
      const r = s.role as RoleKey | undefined
      if (r && s.page && views.includes(r) && NAV[r].some(g => g.items.includes(s.page!))) { setRole(r); setPage(s.page) }
    })
    return () => onHistoryPage(null)
  }, [views.join(',')])

  useEffect(() => {
    if (access.profile?.org_id) supabase.from('teachers').select('id, full_name, profile_id').order('full_name').then(({ data }) => setTeachers(data ?? []))
    // Học sinh: hồ sơ của chính mình; quản trị: danh sách để xem thử giao diện học sinh
    if (access.profile?.org_id && access.portals.includes('student'))
      supabase.from('students').select('id, full_name, profile_id, classes(name)').order('student_code').then(({ data }) => setStudents((data as any) ?? []))
  }, [access.profile?.org_id, access.portals.length])

  // Tự đăng xuất khi không thao tác (cài đặt ở Bảo mật tài khoản)
  useEffect(() => {
    if (!access.idleMinutes) return
    let last = Date.now()
    const touch = () => { last = Date.now() }
    const ev = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll']
    ev.forEach(e => window.addEventListener(e, touch, { passive: true }))
    const t = setInterval(() => { if (Date.now() - last > access.idleMinutes * 60000) supabase.auth.signOut() }, 30000)
    return () => { ev.forEach(e => window.removeEventListener(e, touch)); clearInterval(t) }
  }, [access.idleMinutes])

  const brand = useBranding(access.profile?.org_id, !!role && role !== 'platform')

  if (access.loading) return null
  if (changingPw) return <SetPassword onDone={() => setChangingPw(false)} />
  if (access.profile?.locked_at) {
    return (
      <div className="login"><form onSubmit={e => e.preventDefault()}>
        <img src={logo} alt="KDI education" /><h1>Tài khoản đã bị khoá</h1>
        <p>Tài khoản <b>{(session.user.user_metadata?.login as string | undefined) ?? session.user.email}</b> đã bị khoá{access.profile.locked_reason ? `: ${access.profile.locked_reason}` : ''}. Liên hệ KDI Education để được hỗ trợ.</p>
        <button type="button" onClick={() => supabase.auth.signOut()}>Đăng xuất</button>
      </form></div>
    )
  }
  if (!access.profile?.org_id || views.length === 0) {
    return (
      <div className="login"><form onSubmit={e => e.preventDefault()}>
        <img src={logo} alt="KDI education" /><h1>Đang chờ cấp quyền</h1>
        <p>Tài khoản <b>{(session.user.user_metadata?.login as string | undefined) ?? session.user.email}</b> chưa được gán vào trường hoặc chưa có vai trò. Hãy nhờ quản trị trường gán trong mục Tài khoản.</p>
        {access.orgs.filter(o => !o.active).length > 0 && <>
          <p>Bạn có vai trò ở các đơn vị sau, chọn để vào làm việc:</p>
          {access.orgs.filter(o => !o.active).map(o => (
            <button type="button" key={o.org_id} className="primary" onClick={() => switchOrg(o.org_id)}>{o.name}</button>
          ))}
        </>}
        <button type="button" onClick={() => supabase.auth.signOut()}>Đăng xuất</button>
      </form></div>
    )
  }
  if (!role) return null

  // Mọi lần đổi trang đi qua show() để ghi vào lịch sử trình duyệt
  const show = (r: RoleKey, p: string) => { navigatePage(r, p); setRole(r); setPage(p) }
  const changeRole = (r: RoleKey) => show(r, NAV[r][0].items[0])
  // Mở một trang từ thông báo (có thể ở giao diện khác)
  const openFrom = (portal: RoleKey | null, target: string) => {
    const p = portal && views.includes(portal) ? portal : role
    if (!NAV[p].some(g => g.items.includes(target))) return
    show(p, target)
  }
  const myTeacher = teachers.find(t => t.profile_id === session.user.id)?.id ?? null
  const teacherId = role === 'teacher' ? (access.isAdmin ? actingTeacher ?? teachers[0]?.id ?? null : myTeacher) : null
  const myStudent = students.find(s => s.profile_id === session.user.id)?.id ?? null
  const studentId = role === 'student' ? (access.isAdmin ? actingStudent ?? students.find(s => s.classes?.name === 'Lớp 9A')?.id ?? students[0]?.id ?? null : myStudent) : null

  // Mục được vai trò xem (không xét gói) và mục có trong gói. Cổng Trường/Sở: mục chưa có trong gói hiện mờ;
  // cổng khác: ẩn hẳn như trước.
  const roleOk = (i: string) => role !== 'school_admin' || !MODULE_OF[i] || access.permitted(MODULE_OF[i])
  const inPlan = (i: string) => role === 'platform' || !ENT_MODULE_OF[i] || access.entitled(ENT_MODULE_OF[i])
  const locked = new Set(NAV[role].flatMap(g => g.items).filter(i => UPSELL_PORTALS.has(role) && roleOk(i) && !inPlan(i)))
  const groups = NAV[role]
    .map(g => ({ ...g, items: g.items.filter(i => roleOk(i) && (inPlan(i) || locked.has(i))) }))
    .filter(g => g.items.length)
  // Gom các nhóm cùng phân hệ (section) thành một khối cây: phân hệ → nhóm con → mục
  const blocks: { section?: string; groups: typeof groups }[] = []
  groups.forEach(g => {
    const last = blocks[blocks.length - 1]
    if (g.section && last?.section === g.section) last.groups.push(g)
    else blocks.push({ section: g.section, groups: [g] })
  })
  const Page: ComponentType<any> | undefined = PAGES[role]?.[page]
  const goPage = (p: string) => show(role, role === 'platform' ? PLATFORM_ALIAS[p] ?? p : p)
  // Tài khoản mã: hiện tên đăng nhập thay cho email nội bộ
  const email = (session.user.user_metadata?.login as string | undefined) ?? session.user.email ?? ''

  return (
    <div className={'app' + (collapsed ? ' collapsed' : '')}>
      <nav className="side" aria-label="Menu chính">
        <div className="sidebrand">
          {brand?.logo_dark ? <img src={brand.logo_dark} alt={brand.display_name ?? 'Logo'} /> : brand?.logo ? <img src={brand.logo} alt={brand.display_name ?? 'Logo'} className="onchip" /> : <img src={logoWhite} alt="KDI education" />}
          <b>{ROLE_LABEL[role]}</b>
        </div>
        {role !== 'department' && role !== 'platform' && role !== 'parent' && <label className="yearpick">
          <span>Năm học · học kỳ</span>
          <select value={yrs.year?.id ?? ''} onChange={e => e.target.value === '__manage' ? (role === 'school_admin' ? show(role, 'Năm học & học kỳ') : null) : yrs.select(e.target.value)}
            aria-label="Chọn năm học và học kỳ">
            {yrs.years.length === 0 && <option value="">Chưa có năm học</option>}
            {yrs.years.map(y => <option key={y.id} value={y.id}>{yearLabel(y)}{y.is_current ? ' (hiện tại)' : ''}</option>)}
            {role === 'school_admin' && access.canView('periods') && <option value="__manage">Quản lý năm học…</option>}
          </select>
        </label>}
        {role !== 'department' && role !== 'platform' && role !== 'parent' && yrs.year && !yrs.year.is_current && <p className="yearwarn">Đang xem học kỳ không phải hiện tại</p>}
        {blocks.map(b => {
          // Một nhóm thường, hoặc một phân hệ (cấp 1) chứa các nhóm con (cấp 2)
          const head = (key: string, title: string, items: string[], sub = false) => {
            const shut = closed.has(key)
            return (
              <button className={'grouphead' + (sub ? ' subhead' : '') + (shut ? ' shut' : '')} onClick={() => toggleGroup(key)} aria-expanded={!shut}
                aria-controls={'grp-' + key.replace(/[^\p{L}\p{N}]+/gu, '-')}>
                {!sub && <NavIcon title={title} />}<span>{title}
                  {items.length > 0 && items.every(i => locked.has(i)) && <small className="locknote">Chưa có trong gói</small>}</span>
                {shut && items.includes(page) && <i className="dot" aria-label="Đang mở trang trong nhóm này" />}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
              </button>
            )
          }
          const list = (key: string, items: string[]) => (
            <div id={'grp-' + key.replace(/[^\p{L}\p{N}]+/gu, '-')} hidden={closed.has(key)}>
              {items.map(i => <button key={i} className={(i === page ? 'on' : '') + (locked.has(i) ? ' locked' : '')} onClick={() => show(role, i)}
                title={locked.has(i) ? 'Chưa có trong gói dịch vụ của đơn vị' : undefined}>
                {labelOf(role, i)}{role === 'platform' && !PLATFORM_LIVE.has(i) && i !== 'Sơ đồ hệ thống' && <small className="navtag">Khung</small>}
                {locked.has(i) && <svg className="navlock" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="Chưa có trong gói"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>}
              </button>)}
            </div>
          )
          if (!b.section) {
            const key = role + ':' + b.groups[0].title
            return <div key={key} className="navgroup">{head(key, b.groups[0].title, b.groups[0].items)}{list(key, b.groups[0].items)}</div>
          }
          const key = role + '§' + b.section
          const all = b.groups.flatMap(g => g.items)
          return (
            <div key={key} className="navgroup">
              {head(key, b.section, all)}
              <div id={'grp-' + key.replace(/[^\p{L}\p{N}]+/gu, '-')} hidden={closed.has(key)} className="navsub">
                {b.groups.map(g => {
                  const k = role + ':' + g.title
                  return <div key={k}>{head(k, g.title, g.items, true)}{list(k, g.items)}</div>
                })}
              </div>
            </div>
          )
        })}
        
      </nav>
      <div className="content">
        <header className="top">
          <button className="toggle" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? 'Hiện menu' : 'Ẩn menu'} aria-expanded={!collapsed}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /></svg>
          </button>
          <img src={brand?.logo ?? logo} alt={brand?.display_name ?? 'KDI education'} />
          <span className="title">{role === 'platform' ? DEFAULT_TITLE : brand?.display_name ?? DEFAULT_TITLE}</span>
          <MenuSearch entries={groups.flatMap(g => g.items.map(item => ({ item, label: labelOf(role, item), group: g.section ? `${g.section} › ${g.title}` : g.title })))} onGo={i => show(role, i)} />
          <div className="user">
            <Bell open={openFrom} portals={views} orgId={access.profile.org_id} />
            <UserMenu name={access.profile.full_name} email={email}
              roleLabel={access.roles.map(r => r.name).join(', ') || ROLE_LABEL[role]}
              orgs={access.orgs} views={views.map(v => ({ key: v, label: ROLE_LABEL[v] }))} view={role} onView={k => changeRole(k as RoleKey)}
              acting={access.isAdmin && role === 'teacher' ? { label: 'Xem với tư cách giáo viên', value: teacherId ?? '', options: teachers.map(t => ({ id: t.id, label: t.full_name })), onChange: setActingTeacher }
                : access.isAdmin && role === 'student' ? { label: 'Xem với tư cách học sinh', value: studentId ?? '', options: students.map(s => ({ id: s.id, label: `${s.classes?.name ?? ''} · ${s.full_name}` })), onChange: setActingStudent }
                : null}
              onPassword={() => setChangingPw(true)} onSignOut={() => supabase.auth.signOut()} />
          </div>
        </header>
        <main className="main">
          <h1>{labelOf(role, page)}</h1>
          {locked.has(page) ? <LockedModule name={labelOf(role, page)} phase={PHASE_OF[ENT_MODULE_OF[page]] ?? null} entitlement={access.entitlement} go={goPage} />
            : Page ? <Suspense fallback={<p className="sub">Đang tải…</p>}><Page key={page + (yrs.year?.id ?? '') + (studentId ?? '')} teacherId={teacherId} studentId={studentId} orgId={access.profile.org_id} userName={access.profile.full_name} go={goPage} name={page}
            year={yrs.year} years={yrs.years} reloadYears={yrs.reload} selectYear={yrs.select} /></Suspense> : <p className="sub">Màn hình này sẽ được xây dựng ở bước tiếp theo.</p>}
        </main>
        <OfflineBar go={() => show(role, role === 'platform' ? 'Ứng dụng di động & ngoại tuyến' : 'Ứng dụng di động')} />
        <HelpWidget role={role} page={labelOf(role, page)} brand={{ name: brand?.display_name ?? null, support: brand?.support_text ?? null }} go={groups.some(g => g.items.includes('Hỗ trợ từ KDI')) ? (p: string) => show(role, p) : undefined}
          menu={groups.flatMap(g => g.items.map(i => `${g.section ? g.section + ' › ' : ''}${g.title} › ${labelOf(role, i)}`))} />
      </div>
    </div>
  )
}

