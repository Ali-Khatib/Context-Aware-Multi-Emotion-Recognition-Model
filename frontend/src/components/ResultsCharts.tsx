import type { ConfidenceBar, EmotionSlice } from '../utils/payloadAnalysis'

const BAR_FILLS = ['#34d399', '#2dd4bf', '#4ade80']

const PIE_COLORS = [
  '#e879f9',
  '#a78bfa',
  '#67e8f9',
  '#34d399',
  '#fbbf24',
  '#fb7185',
  '#c084fc',
]

type StagePieProps = {
  title: string
  subtitle?: string
  slices: EmotionSlice[]
}

/** Vertical bar chart with X/Y axes — confidence % by pipeline pass. */
export function ConfidenceBarChart({ bars }: { bars: ConfidenceBar[] }) {
  if (!bars.length) {
    return (
      <p className="text-sm text-violet-400/80">
        Run a full analysis to see confidence by pass.
      </p>
    )
  }

  const width = 400
  const height = 300
  const pad = { top: 24, right: 24, bottom: 56, left: 52 }
  const chartW = width - pad.left - pad.right
  const chartH = height - pad.top - pad.bottom
  const yTicks = [0, 25, 50, 75, 100]
  const slotW = chartW / bars.length
  const barW = Math.min(64, slotW * 0.55)

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="mx-auto block h-auto w-full max-w-lg"
        role="img"
        aria-label="Average confidence by pipeline pass"
      >
        <line
          x1={pad.left}
          y1={pad.top}
          x2={pad.left}
          y2={pad.top + chartH}
          stroke="rgba(196,181,253,0.45)"
          strokeWidth="1.5"
        />
        <line
          x1={pad.left}
          y1={pad.top + chartH}
          x2={pad.left + chartW}
          y2={pad.top + chartH}
          stroke="rgba(196,181,253,0.45)"
          strokeWidth="1.5"
        />

        {yTicks.map((tick) => {
          const y = pad.top + chartH - (tick / 100) * chartH
          return (
            <g key={tick}>
              <line
                x1={pad.left - 4}
                y1={y}
                x2={pad.left + chartW}
                y2={y}
                stroke="rgba(168,85,247,0.12)"
                strokeWidth="1"
                strokeDasharray={tick === 0 ? undefined : '4 4'}
              />
              <text
                x={pad.left - 8}
                y={y + 4}
                textAnchor="end"
                fill="rgba(196,181,253,0.75)"
                fontSize="10"
                fontFamily="ui-monospace, monospace"
              >
                {tick}
              </text>
            </g>
          )
        })}

        <text
          x={16}
          y={pad.top + chartH / 2}
          fill="rgba(196,181,253,0.7)"
          fontSize="10"
          fontWeight="600"
          transform={`rotate(-90 16 ${pad.top + chartH / 2})`}
          textAnchor="middle"
        >
          Confidence (%)
        </text>

        {bars.map((bar, i) => {
          const pct = Math.min(100, Math.max(0, bar.confidence * 100))
          const barH = (pct / 100) * chartH
          const x = pad.left + slotW * i + (slotW - barW) / 2
          const y = pad.top + chartH - barH
          const label =
            bar.key === 'stage1'
              ? 'Stage 1'
              : bar.key === 'stage2'
                ? 'Stage 2'
                : bar.key === 'stage3'
                  ? 'Stage 3'
                  : bar.label

          return (
            <g key={bar.key}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={Math.max(barH, pct > 0 ? 2 : 0)}
                rx={4}
                fill={BAR_FILLS[i % BAR_FILLS.length]}
                opacity={0.92}
              />
              <text
                x={x + barW / 2}
                y={y - 6}
                textAnchor="middle"
                fill="#34d399"
                fontSize="12"
                fontWeight="700"
                fontFamily="ui-monospace, monospace"
              >
                {pct.toFixed(0)}%
              </text>
              <text
                x={x + barW / 2}
                y={pad.top + chartH + 20}
                textAnchor="middle"
                fill="rgba(196,181,253,0.9)"
                fontSize="10"
                fontWeight="600"
              >
                {label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export function StageEmotionPieChart({ title, subtitle, slices }: StagePieProps) {
  if (!slices.length) {
    return (
      <div className="flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-purple-500/30 bg-violet-950/30 p-4 sm:p-5">
        <h4 className="text-sm font-bold uppercase tracking-wider text-fuchsia-300/90">
          {title}
        </h4>
        {subtitle ? (
          <p className="mt-1 text-xs text-violet-400/75">{subtitle}</p>
        ) : null}
        <p className="mt-4 text-sm text-violet-400/80">No face labels yet.</p>
      </div>
    )
  }

  const total = slices.reduce((s, x) => s + x.count, 0)
  const size = 200
  const cx = size / 2
  const cy = size / 2
  const r = 72
  let angle = -90

  const paths = slices.map((slice, i) => {
    const share = slice.count / total
    const sweep = share * 360
    const start = angle
    angle += sweep
    const end = angle
    const large = sweep > 180 ? 1 : 0
    const rad = (deg: number) => (Math.PI * deg) / 180
    const x1 = cx + r * Math.cos(rad(start))
    const y1 = cy + r * Math.sin(rad(start))
    const x2 = cx + r * Math.cos(rad(end))
    const y2 = cy + r * Math.sin(rad(end))
    const d =
      slices.length === 1
        ? `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy}`
        : `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`
    return {
      d,
      color: PIE_COLORS[i % PIE_COLORS.length],
      slice,
      pct: Math.round(share * 100),
    }
  })

  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-purple-500/30 bg-violet-950/30 p-4 sm:p-5">
      <h4 className="text-sm font-bold uppercase tracking-wider text-fuchsia-300/90">
        {title}
      </h4>
      {subtitle ? (
        <p className="mt-1 text-xs text-violet-400/75">{subtitle}</p>
      ) : null}
      <div className="mt-4 flex min-w-0 flex-col items-center gap-4">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="mx-auto shrink-0"
          role="img"
          aria-label={title}
        >
          {paths.map((p, i) => (
            <path
              key={`${p.slice.emotion}-${i}`}
              d={p.d}
              fill={p.color}
              stroke="rgba(15,6,24,0.7)"
              strokeWidth="2"
            />
          ))}
          <circle cx={cx} cy={cy} r={26} fill="#0f0618" />
          <text
            x={cx}
            y={cy + 4}
            textAnchor="middle"
            fill="#e9d5ff"
            fontSize="10"
            fontWeight="700"
          >
            {total}
          </text>
        </svg>
        <ul className="w-full min-w-0 max-w-full space-y-1.5 text-xs">
          {paths.map((p, i) => (
            <li
              key={`legend-${p.slice.emotion}-${i}`}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2"
            >
              <span
                className="inline-block h-3 w-3 shrink-0 rounded-full"
                style={{ background: p.color }}
              />
              <span className="min-w-0 truncate capitalize text-violet-100">
                {p.slice.emotion}
              </span>
              <span className="shrink-0 font-mono tabular-nums text-violet-300">
                {p.slice.count} ({p.pct}%)
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
