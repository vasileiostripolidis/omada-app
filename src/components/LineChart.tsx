import { useState } from 'react'

type Pt = { x: string; label: string; v: number | null }
// Γράφημα εξέλιξης: αθλητής (συνεχής γραμμή) + μέσος όρος ομάδας (διακεκομμένη αναφορά)
export default function LineChart({ title, unit, points, avg, decimals = 1, higherBetter = true, height = 170 }:
  { title: string; unit?: string | null; points: Pt[]; avg?: (number | null)[]; decimals?: number; higherBetter?: boolean; height?: number }) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 320, H = height, pl = 34, pr = 10, pt = 14, pb = 24
  const vals = [...points.map((p) => p.v), ...(avg || [])].filter((v): v is number => v != null)
  const last = [...points].reverse().find((p) => p.v != null)
  const first = points.find((p) => p.v != null)
  if (!vals.length) return <div className="card chart"><div className="chart-t">{title}</div><div className="muted" style={{ padding: '30px 0', textAlign: 'center' }}>Χωρίς μετρήσεις</div></div>
  let lo = Math.min(...vals), hi = Math.max(...vals)
  const minSpan = Math.max(Math.abs((lo + hi) / 2) * 0.06, 0.5)
  if (hi - lo < minSpan) { const m = (lo + hi) / 2; lo = m - minSpan / 2; hi = m + minSpan / 2 }
  const pad = (hi - lo) * 0.15; lo -= pad; hi += pad
  const n = points.length
  const x = (i: number) => pl + (n === 1 ? (W - pl - pr) / 2 : (i * (W - pl - pr)) / (n - 1))
  const y = (v: number) => pt + (1 - (v - lo) / (hi - lo)) * (H - pt - pb)
  const path = (arr: (number | null)[]) => arr.map((v, i) => (v == null ? null : `${x(i)},${y(v)}`)).filter(Boolean).map((p, i) => (i ? 'L' : 'M') + p).join(' ')
  const fmt = (v: number) => v.toLocaleString('el-GR', { maximumFractionDigits: decimals, minimumFractionDigits: 0 })
  const ticks = [lo + pad, (lo + hi) / 2, hi - pad]
  const delta = first && last && first !== last ? (last.v! - first.v!) : null
  const good = delta != null && (higherBetter ? delta > 0 : delta < 0)
  return (
    <div className="card chart">
      <div className="row between" style={{ alignItems: 'flex-start' }}>
        <div><div className="chart-t">{title}</div><div className="chart-v num">{last ? fmt(last.v!) : '—'}<span className="muted"> {unit}</span></div></div>
        {delta != null && Math.abs(delta) > 0 && <span className={'badge ' + (good ? 'b-ok' : 'b-warn')}>{delta > 0 ? '▲' : '▼'} {fmt(Math.abs(delta))} {unit}</span>}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`${title}: εξέλιξη ανά μήνα`} onMouseLeave={() => setHover(null)}>
        {ticks.map((t, i) => <g key={i}><line x1={pl} x2={W - pr} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth="1" />
          <text x={pl - 6} y={y(t) + 3} textAnchor="end" fontSize="9" fill="var(--muted)">{fmt(t)}</text></g>)}
        {points.map((p, i) => (n <= 8 || i % Math.ceil(n / 8) === 0 || i === n - 1) && <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize="9" fill="var(--muted)">{p.label}</text>)}
        {avg && <path d={path(avg)} fill="none" stroke="#8b95a8" strokeWidth="2" strokeDasharray="4 4" strokeLinecap="round" />}
        <path d={path(points.map((p) => p.v))} fill="none" stroke="var(--navy)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => p.v != null && <circle key={i} cx={x(i)} cy={y(p.v)} r={hover === i ? 5 : 4} fill="var(--navy)" stroke="#fff" strokeWidth="2" />)}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={pt} y2={H - pb} stroke="var(--muted)" strokeWidth="1" strokeDasharray="2 3" />}
        {points.map((_, i) => <rect key={i} x={x(i) - (W - pl - pr) / Math.max(1, n - 1) / 2} y={0} width={Math.max(14, (W - pl - pr) / Math.max(1, n - 1))} height={H} fill="transparent" onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)} />)}
      </svg>
      {hover != null && <div className="chart-tip"><b>{points[hover].x}</b> · Αθλητής: <b>{points[hover].v != null ? fmt(points[hover].v!) : '—'}</b>{avg && <> · Μ.Ο. ομάδας: {avg[hover] != null ? fmt(avg[hover]!) : '—'}</>} {unit}</div>}
      {avg && <div className="chart-legend"><span><i style={{ background: 'var(--navy)' }} />Αθλητής</span><span><i className="dash" />Μέσος όρος ομάδας</span></div>}
    </div>
  )
}
