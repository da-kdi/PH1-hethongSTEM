import { useState, type ReactNode } from 'react'
import { Empty, VCard } from './ui'
import { catName, gradeLabel, type CatItem, type Curriculum } from './curriculum/api'

// Xem theo tầng: tổng quan các chương trình → (bấm) bảng khối × môn của chương trình → (bấm ô) danh sách mục.
// Dùng cho Học liệu, Soạn bài giảng… Mỗi mục cho biết chương trình / khối / môn của nó qua keyOf.
export type DrillKey = { prog: string | null; grade: number | null; subject: string | null }
export type DrillPath = { prog?: string; grade?: number | null; subject?: string | null }

export function useDrill() { return useState<DrillPath>({}) }

export function Drill<T>({ items, keyOf, progs, cat, path, setPath, unit, weight, weightUnit, icon, renderItems, extraCards }: {
  items: T[]; keyOf: (t: T) => DrillKey; progs: Curriculum[]; cat: CatItem[]; path: DrillPath; setPath: (p: DrillPath) => void
  unit: string; weight?: (t: T) => number; weightUnit?: string; icon?: ReactNode; renderItems: (list: T[]) => ReactNode; extraCards?: ReactNode
}) {
  const NONE = '_'
  const pid = (t: T) => keyOf(t).prog ?? NONE
  const sum = (list: T[]) => (weight ? list.reduce((a, t) => a + weight(t), 0) : 0)
  const prog = progs.find(p => p.id === path.prog)
  const crumbs = (
    <nav className="p1-crumbs" aria-label="Đường dẫn">
      <button type="button" onClick={() => setPath({})}>Tất cả chương trình</button>
      {path.prog && <><span>›</span><button type="button" onClick={() => setPath({ prog: path.prog })}>{prog ? `${prog.code} · ${prog.name}` : 'Chưa gắn chương trình'}</button></>}
      {path.prog && path.subject !== undefined && <><span>›</span><b>{catName(cat, 'subject', path.subject) || 'Môn khác'} · {path.grade != null ? gradeLabel(path.grade) : 'mọi khối'}</b></>}
    </nav>
  )

  // Tầng 1: các chương trình
  if (!path.prog) {
    const ids = Array.from(new Set(items.map(pid)))
    const order = [...progs.filter(p => ids.includes(p.id)).map(p => p.id), ...(ids.includes(NONE) ? [NONE] : [])]
    if (!order.length) return <>{extraCards}<Empty>Chưa có {unit} nào.</Empty></>
    return (
      <div className="p1-grid">
        {order.map(id => { const p = progs.find(x => x.id === id); const list = items.filter(t => pid(t) === id)
          const grades = Array.from(new Set(list.map(t => keyOf(t).grade).filter(g => g != null))) as number[]
          const subs = Array.from(new Set(list.map(t => keyOf(t).subject).filter(Boolean))) as string[]
          return <VCard key={id} color={p?.color ?? '#94a3b8'} code={p?.code ?? '—'} icon={icon} title={p?.name ?? 'Chưa gắn chương trình'}
            subtitle={grades.length ? 'Khối ' + grades.sort((a, b) => a - b).join(', ') : undefined}
            chips={[`${list.length} ${unit}`, weight ? `${sum(list)} ${weightUnit ?? ''}` : '', `${subs.length} môn`]}
            desc={subs.map(s => catName(cat, 'subject', s)).join(' · ')} onClick={() => setPath({ prog: id })} more="Mở ›" />
        })}
        {extraCards}
      </div>
    )
  }

  const inProg = items.filter(t => pid(t) === path.prog)
  // Tầng 3: danh sách mục của một môn · khối
  if (path.subject !== undefined) {
    const list = inProg.filter(t => (keyOf(t).subject ?? null) === path.subject && (keyOf(t).grade ?? null) === (path.grade ?? null))
    return <>{crumbs}{list.length ? renderItems(list) : <Empty>Không có {unit} nào.</Empty>}</>
  }
  // Tầng 2: bảng khối × môn của chương trình
  const grades = Array.from(new Set(inProg.map(t => keyOf(t).grade ?? null))).sort((a, b) => (a ?? 99) - (b ?? 99))
  const subs = Array.from(new Set(inProg.map(t => keyOf(t).subject ?? null)))
  const cell = (g: number | null, s: string | null) => inProg.filter(t => (keyOf(t).grade ?? null) === g && (keyOf(t).subject ?? null) === s)
  return (
    <>
      {crumbs}
      <div className="p1-matrixwrap">
        <table className="p1-matrix">
          <thead><tr><th>Khối \ Môn</th>{subs.map(s => <th key={s ?? NONE}>{catName(cat, 'subject', s) || 'Môn khác'}</th>)}<th>Cộng</th></tr></thead>
          <tbody>{grades.map(g => (
            <tr key={g ?? NONE}><th>{g != null ? gradeLabel(g) : 'Chưa rõ khối'}</th>
              {subs.map(s => { const l = cell(g, s); return <td key={s ?? NONE}>{l.length ? <button type="button" onClick={() => setPath({ prog: path.prog, grade: g, subject: s })}
                style={{ borderColor: (prog?.color ?? '#2a78d6') + '66', background: (prog?.color ?? '#2a78d6') + '12' }}>
                <b>{l.length}</b> {unit}{weight ? <small>{sum(l)} {weightUnit}</small> : null}</button> : <span className="sub">—</span>}</td> })}
              <td><b>{inProg.filter(t => (keyOf(t).grade ?? null) === g).length}</b></td></tr>))}</tbody>
        </table>
      </div>
      <p className="sub">Bấm một ô để xem {unit} của môn · khối đó.</p>
    </>
  )
}
