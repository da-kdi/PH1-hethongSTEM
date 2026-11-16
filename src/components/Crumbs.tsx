// Đường dẫn mục mẹ / mục con (bản mẫu v315 · A2): Nhóm / Mục / Tên bản ghi đang xem — bấm để quay lại. Bỏ số thứ tự (1., 1.1.).
import { Fragment, type ReactNode } from 'react'
import { useCrumbDetail } from '../lib/crumb'
import { NavIcon } from './NavIcon'

const strip = (s: string) => s.replace(/^[\d.]+\s*/, '').trim()
const FILE = <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6" /></svg>

export function Crumbs({ section, group, page, onSection, onGroup, onPage }: {
  section?: string; group?: string; page: string
  onSection?: () => void; onGroup?: () => void; onPage: () => void
}) {
  const det = useCrumbDetail()
  const top = section ?? group
  const items: { key: string; icon?: ReactNode; text: string; go?: () => void }[] = []
  if (top) items.push({ key: 'grp', icon: <NavIcon title={top} />, text: strip(top), go: section ? onSection : onGroup })
  if (section && group && strip(group) !== strip(section)) items.push({ key: 'sub', text: strip(group), go: onGroup })
  items.push({ key: 'sec', icon: FILE, text: page, go: det ? det.back : onPage })
  if (det) items.push({ key: 'det', text: det.title })
  return (
    <nav className="crumbs" aria-label="Đường dẫn">
      {items.map((x, i) => {
        const cur = i === items.length - 1
        return <Fragment key={x.key}>
          {i > 0 && <span className="crsep" aria-hidden="true">/</span>}
          <button type="button" className={'crumb' + (cur ? ' cur' : '')} data-crumb={x.key} title={x.text} aria-current={cur ? 'page' : undefined}
            onClick={() => { if (!cur) x.go?.() }}>{x.icon}<span>{x.text}</span></button>
        </Fragment>
      })}
    </nav>
  )
}
