import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { STATUS, errText, fmtDate, loadContent, vName, type Content, type Curriculum, type Labels, type Version } from './api'

type Step = { no: number; name: string; org_name: string; role_name: string | null }
type Req = { id: string; status: string; current_step: number; steps: Step[]; requested_by: string | null; created_at: string; decided_at: string | null }
type Act = { request_id: string; step_no: number; decision: string; note: string | null; at: string; profiles: { full_name: string } | null }

export function VStatusPill({ s }: { s: Version['status'] }) {
  const [icon, label, tone] = STATUS[s]
  return <span className={'gpill ' + tone}><i aria-hidden="true">{icon}</i>{label}</span>
}

// Phiên bản & phê duyệt: vòng đời, hồ sơ duyệt (engine 022), ban hành, tạo phiên bản mới, so sánh
export function VersionsPanel({ cur, versions, selected, onSelect, canManage, isOwner, userId, labels, reload, setMsg, setInfo }: {
  cur: Curriculum; versions: Version[]; selected: Version | null; onSelect: (id: string) => void; canManage: boolean; isOwner: boolean
  userId: string | null; labels: Labels; reload: () => void; setMsg: (m: string) => void; setInfo: (m: string) => void
}) {
  const [reqs, setReqs] = useState<Req[]>([])
  const [acts, setActs] = useState<Act[]>([])
  const [canAct, setCanAct] = useState<Record<string, boolean>>({})
  const [note, setNote] = useState('')
  const [from, setFrom] = useState(() => new Date().toISOString().slice(0, 10))
  const [cmp, setCmp] = useState<[string, string] | null>(null)
  const manage = canManage && isOwner && !cur.archived_at
  const open = versions.find(v => ['draft', 'pending', 'approved', 'rejected'].includes(v.status)) ?? null

  async function loadReqs() {
    if (!selected) return
    const { data } = await supabase.from('approval_requests').select('id, status, current_step, steps, requested_by, created_at, decided_at')
      .eq('ref_table', 'curriculum_versions').eq('ref_id', selected.id).order('created_at', { ascending: false })
    const rs = (data as Req[]) ?? []; setReqs(rs)
    if (rs.length) {
      const a = await supabase.from('approval_actions').select('request_id, step_no, decision, note, at, profiles:actor(full_name)').in('request_id', rs.map(r => r.id)).order('at')
      setActs((a.data as unknown as Act[]) ?? [])
    } else setActs([])
    const pend = rs.find(r => r.status === 'pending')
    if (pend) { const c = await supabase.rpc('approval_can_act', { p_request: pend.id }); setCanAct({ [pend.id]: c.data === true }) } else setCanAct({})
  }
  useEffect(() => { loadReqs() }, [selected?.id, selected?.status])

  const done = (m: string) => { setInfo(m); setMsg(''); setNote(''); reload() }
  async function setStatus(status: string, okMsg: string) {
    if (!selected) return
    const { error } = await supabase.from('curriculum_versions').update({ status, ...(note.trim() ? { change_note: note.trim() } : {}) }).eq('id', selected.id)
    if (error) setMsg(errText(error.message)); else done(okMsg)
  }
  async function decide(r: Req, decision: 'approve' | 'reject') {
    if (decision === 'reject' && !note.trim()) return setMsg('Nhập lý do trả lại vào ô ghi chú.')
    const { error } = await supabase.rpc('approval_decide', { p_request: r.id, p_decision: decision, p_note: note.trim() || null })
    if (error) setMsg(errText(error.message)); else done(decision === 'approve' ? 'Đã duyệt bước hiện tại.' : 'Đã trả lại để sửa.')
  }
  async function withdraw(r: Req) {
    const { error } = await supabase.rpc('approval_cancel', { p_request: r.id, p_note: note.trim() || null })
    if (error) setMsg(errText(error.message)); else done('Đã rút hồ sơ — phiên bản trở lại để sửa.')
  }
  async function publish() {
    if (!selected) return
    if (!confirm(`Ban hành ${vName(selected)}, hiệu lực từ ${fmtDate(from)}? ${cur.current_version_id ? 'Phiên bản đang hiệu lực sẽ hết hiệu lực.' : ''}`)) return
    const { error } = await supabase.rpc('curriculum_publish', { p_version: selected.id, p_effective_from: from })
    if (error) setMsg(errText(error.message)); else done('Đã ban hành. Đơn vị đã kế thừa chương trình này được báo có phiên bản mới.')
  }
  async function newVersion() {
    const label = prompt('Nhãn phiên bản mới (vd năm học 2027–2028), để trống nếu không cần:', '')
    if (label === null) return
    const { data, error } = await supabase.rpc('curriculum_new_version', { p_curriculum: cur.id, p_from: selected?.id ?? null, p_label: label, p_note: null })
    if (error) return setMsg(errText(error.message))
    done('Đã tạo phiên bản mới từ ' + (selected ? vName(selected) : 'bản gần nhất') + '.'); onSelect(data as string)
  }
  async function discard() {
    if (!selected || !confirm(`Xoá ${vName(selected)} (bản chưa ban hành)?`)) return
    const { error } = await supabase.from('curriculum_versions').delete().eq('id', selected.id)
    if (error) setMsg(errText(error.message)); else done('Đã xoá phiên bản.')
  }
  async function saveMeta(p: Partial<Version>) {
    if (!selected) return
    const { error } = await supabase.from('curriculum_versions').update(p).eq('id', selected.id)
    if (error) setMsg(errText(error.message)); else { setMsg(''); reload() }
  }

  const pend = reqs.find(r => r.status === 'pending')
  const s = selected?.status
  return (
    <div className="cur-versions">
      <table>
        <thead><tr><th>Phiên bản</th><th>Trạng thái</th><th>Hiệu lực</th><th>Ghi chú thay đổi</th><th></th></tr></thead>
        <tbody>
          {versions.map(v => (
            <tr key={v.id} className={v.id === selected?.id ? 'cur-sel' : ''}>
              <td><b>{vName(v)}</b><br /><small className="sub">tạo {fmtDate(v.created_at)}{v.based_on_version_id ? ` · từ phiên bản ${versions.find(x => x.id === v.based_on_version_id)?.version_no ?? '?'}` : ''}</small></td>
              <td><VStatusPill s={v.status} /></td>
              <td>{v.effective_from ? `${fmtDate(v.effective_from)}${v.effective_to ? ` → ${fmtDate(v.effective_to)}` : ' →'}` : '—'}</td>
              <td>{v.change_note ?? <span className="sub">—</span>}</td>
              <td className="actions"><button type="button" onClick={() => onSelect(v.id)} disabled={v.id === selected?.id}>{v.id === selected?.id ? 'Đang xem' : 'Xem'}</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      {selected && (
        <div className="panel">
          <h3>{vName(selected)} <VStatusPill s={selected.status} /></h3>
          {manage && (s === 'draft' || s === 'rejected') && <div className="formgrid">
            <label className="field"><span>Nhãn phiên bản</span><input defaultValue={selected.label ?? ''} onBlur={e => e.target.value !== (selected.label ?? '') && saveMeta({ label: e.target.value.trim() || null })} /></label>
            <label className="field" style={{ gridColumn: 'span 3' }}><span>Ghi chú thay đổi</span><input defaultValue={selected.change_note ?? ''} onBlur={e => e.target.value !== (selected.change_note ?? '') && saveMeta({ change_note: e.target.value.trim() || null })} /></label>
          </div>}
          {s === 'rejected' && <p className="msg">Phiên bản bị trả lại hoặc đã rút — sửa nội dung rồi gửi duyệt lại.</p>}

          {pend && <ApprovalTrail req={pend} />}
          {reqs.length > 0 && <details><summary>Lịch sử duyệt ({acts.length})</summary>
            <ul className="cur-log">{acts.map((a, k) => <li key={k}><b>{({ approve: 'Duyệt', reject: 'Trả lại', comment: 'Ý kiến', cancel: 'Rút' } as Record<string, string>)[a.decision] ?? a.decision}</b>
              {' '}bước {a.step_no} · {a.profiles?.full_name ?? '—'} · {new Date(a.at).toLocaleString('vi-VN')}{a.note ? ` — ${a.note}` : ''}</li>)}</ul></details>}

          {(manage || (pend && canAct[pend.id])) && <label className="field"><span>Ghi chú (gửi duyệt / ý kiến duyệt / lý do trả lại)</span><input value={note} onChange={e => setNote(e.target.value)} /></label>}
          <div className="actions">
            {manage && (s === 'draft' || s === 'rejected') && cur.require_approval && <button type="button" className="primary" onClick={() => setStatus('pending', 'Đã gửi duyệt. Người duyệt nhận thông báo trong Hộp phê duyệt.')}>Gửi duyệt</button>}
            {pend && canAct[pend.id] && <><button type="button" className="primary" onClick={() => decide(pend, 'approve')}>Duyệt</button><button type="button" className="danger" onClick={() => decide(pend, 'reject')}>Trả lại</button></>}
            {pend && pend.requested_by === userId && <button type="button" onClick={() => withdraw(pend)}>Rút hồ sơ</button>}
            {manage && (s === 'approved' || ((s === 'draft' || s === 'rejected') && !cur.require_approval)) && <>
              <label className="field cur-inline"><span>Hiệu lực từ</span><input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
              <button type="button" className="primary" onClick={publish}>Ban hành</button></>}
            {manage && !open && <button type="button" onClick={newVersion}>Tạo phiên bản mới từ bản này</button>}
            {manage && (s === 'draft' || s === 'rejected') && <button type="button" className="danger" onClick={discard}>Xoá phiên bản</button>}
            {versions.length > 1 && <button type="button" onClick={() => setCmp([versions.find(v => v.id !== selected.id && v.status !== 'draft')?.id ?? versions.find(v => v.id !== selected.id)!.id, selected.id])}>So sánh…</button>}
          </div>
          {!cur.require_approval && manage && <p className="sub">Chương trình này ban hành không cần duyệt (đổi ở Thông tin chung).</p>}
        </div>
      )}
      {cmp && <Compare versions={versions} pair={cmp} setPair={setCmp} labels={labels} />}
    </div>
  )
}

function ApprovalTrail({ req }: { req: Req }) {
  return (
    <ol className="cur-trail" aria-label="Các bước duyệt">
      {req.steps.map(s => {
        const st = req.status === 'approved' || s.no < req.current_step ? 'done' : s.no === req.current_step ? (req.status === 'rejected' ? 'bad' : 'now') : 'todo'
        return <li key={s.no} className={st}><b>{st === 'done' ? '✓' : st === 'now' ? '⏳' : st === 'bad' ? '✕' : '○'} {s.name}</b><small>{s.role_name ? `${s.role_name} · ` : ''}{s.org_name}</small></li>
      })}
    </ol>
  )
}

// So sánh hai phiên bản: chủ đề / bài học / chuẩn đầu ra thêm, bỏ, đổi (khớp theo mã, nếu không có thì theo thứ tự)
function Compare({ versions, pair, setPair, labels }: { versions: Version[]; pair: [string, string]; setPair: (p: [string, string] | null) => void; labels: Labels }) {
  const [a, setA] = useState<Content | null>(null), [b, setB] = useState<Content | null>(null)
  useEffect(() => { loadContent(pair[0]).then(setA); loadContent(pair[1]).then(setB) }, [pair[0], pair[1]])
  const pick = (k: 0 | 1) => (
    <select value={pair[k]} onChange={e => setPair(k === 0 ? [e.target.value, pair[1]] : [pair[0], e.target.value])} aria-label={k === 0 ? 'Bản cũ' : 'Bản mới'}>
      {versions.map(v => <option key={v.id} value={v.id}>{vName(v)}</option>)}</select>)
  type Row = { kind: string; key: string; old?: string; now?: string }
  const rows: Row[] = []
  if (a && b) {
    const diff = <T,>(kind: string, xs: T[], ys: T[], key: (t: T, i: number) => string, show: (t: T) => string) => {
      const mx = new Map(xs.map((x, i) => [key(x, i), show(x)])), my = new Map(ys.map((y, i) => [key(y, i), show(y)]))
      for (const [k, v] of mx) if (!my.has(k)) rows.push({ kind, key: k, old: v }); else if (my.get(k) !== v) rows.push({ kind, key: k, old: v, now: my.get(k) })
      for (const [k, v] of my) if (!mx.has(k)) rows.push({ kind, key: k, now: v })
    }
    const unitKey = (c: Content) => (id: string | null) => { const u = c.units.find(x => x.id === id); return u ? u.code || `#${u.seq}` : '' }
    diff(labels.unit, a.units, b.units, (u, i) => u.code || `#${i + 1}`, u => `${u.title} · ${u.periods} tiết${u.grade != null ? ` · khối ${u.grade}` : ''}`)
    diff(labels.lesson, a.lessons, b.lessons, l => `${unitKey(a)(l.unit_id) || unitKey(b)(l.unit_id)}/${l.code || '#' + l.seq}`, l => `${l.title} · ${l.periods} tiết`)
    diff('Chuẩn đầu ra', a.outcomes, b.outcomes, o => o.code || o.description.slice(0, 40), o => o.description)
    diff('Tiêu chí đánh giá', a.assessments, b.assessments, x => x.title, x => `${x.title} · ${x.criteria.length} dòng tiêu chí${x.weight != null ? ` · ${x.weight}%` : ''}`)
  }
  return (
    <div className="panel">
      <div className="bar"><h3>So sánh</h3><span>{pick(0)} → {pick(1)}</span><button type="button" onClick={() => setPair(null)}>Đóng</button></div>
      {!a || !b ? <p className="sub">Đang tải…</p> : rows.length === 0 ? <p className="sub">Hai phiên bản giống nhau.</p> : (
        <table>
          <thead><tr><th>Mục</th><th>Thay đổi</th><th>Bản cũ</th><th>Bản mới</th></tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i}><td>{r.kind} <small className="sub">{r.key}</small></td>
            <td>{r.old === undefined ? <span className="gpill good">+ Thêm</span> : r.now === undefined ? <span className="gpill bad">− Bỏ</span> : <span className="gpill warn">~ Đổi</span>}</td>
            <td>{r.old ?? ''}</td><td>{r.now ?? ''}</td></tr>)}</tbody>
        </table>
      )}
    </div>
  )
}
