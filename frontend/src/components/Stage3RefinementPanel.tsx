import type { Stage3Output } from '../utils/payloadAnalysis'

type Stage3RefinementPanelProps = {
  data: Stage3Output
  variant?: 'compact' | 'full' | 'results' | 'table'
}

function SignalChip({
  label,
  value,
  highlight,
}: {
  label: string
  value: string | null
  highlight?: boolean
}) {
  if (!value) return null
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] sm:text-xs ${
        highlight
          ? 'border-fuchsia-400/50 bg-fuchsia-950/50 text-fuchsia-100'
          : 'border-purple-500/35 bg-violet-950/40 text-violet-200/90'
      }`}
    >
      <span className="opacity-70">{label}</span>
      <span className="font-semibold capitalize">{value}</span>
    </span>
  )
}

function fmtPct(conf: number | null | undefined): string {
  if (conf == null || Number.isNaN(conf)) return '—'
  return `${(conf * 100).toFixed(0)}%`
}

function PerFaceStageTable({ data }: { data: Stage3Output }) {
  if (!data.faceProgression.length) {
    return (
      <p className="text-sm text-violet-400/80">
        No per-face rows for this run yet.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-purple-500/30 bg-violet-950/25">
      <p className="border-b border-purple-500/25 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-fuchsia-300/80">
        Per-face — Stage 1 → 2 → 3
      </p>
      <table className="w-full min-w-[32rem] text-left text-xs">
        <thead>
          <tr className="border-b border-purple-500/20 text-[10px] uppercase tracking-wider text-violet-400/90">
            <th className="px-3 py-2 font-semibold">Face</th>
            <th className="px-2 py-2 font-semibold">Stage 1</th>
            <th className="px-2 py-2 font-semibold">Stage 2</th>
            <th className="px-2 py-2 font-semibold">Stage 3</th>
          </tr>
        </thead>
        <tbody>
          {data.faceProgression.map((row) => (
            <tr
              key={String(row.faceId)}
              className="border-b border-purple-500/15 last:border-0"
            >
              <td className="px-3 py-2 font-mono text-violet-200">
                #{row.faceId}
              </td>
              <td className="px-2 py-2">
                <span className="capitalize text-violet-100">
                  {row.stage1.emotion ?? '—'}
                </span>
                <span className="ml-1 font-mono font-semibold text-emerald-400">
                  {fmtPct(row.stage1.confidence)}
                </span>
              </td>
              <td className="px-2 py-2">
                <span className="capitalize text-violet-100">
                  {row.stage2.emotion ?? '—'}
                </span>
                <span className="ml-1 font-mono font-semibold text-emerald-400">
                  {fmtPct(row.stage2.confidence)}
                </span>
              </td>
              <td className="px-2 py-2">
                <span
                  className={`capitalize ${
                    row.stage3.matchesFinal
                      ? 'text-emerald-200'
                      : 'text-amber-200/90'
                  }`}
                >
                  {row.stage3.emotion ?? '—'}
                </span>
                <span className="ml-1 font-mono font-semibold text-emerald-400">
                  {fmtPct(row.stage3.confidence)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ConfidenceStep({
  label,
  pct,
  highlight,
}: {
  label: string
  pct: string
  highlight?: boolean
}) {
  return (
    <div
      className={`rounded-lg border px-2.5 py-2 text-center ${
        highlight
          ? 'border-emerald-400/45 bg-emerald-950/35'
          : 'border-purple-500/30 bg-violet-950/30'
      }`}
    >
      <p className="text-[9px] font-bold uppercase tracking-wider text-violet-400/90">
        {label}
      </p>
      <p
        className={`mt-0.5 font-mono text-sm font-bold text-emerald-400 ${
          highlight ? '' : ''
        }`}
      >
        {pct}
      </p>
    </div>
  )
}

export function Stage3RefinementPanel({
  data,
  variant = 'full',
}: Stage3RefinementPanelProps) {
  if (data.error) {
    return (
      <p className="rounded-lg border border-red-500/35 bg-red-950/30 px-3 py-2 text-xs text-red-200/95">
        Stage 3 could not finish: {data.error}
      </p>
    )
  }

  if (variant === 'table') {
    if (!data.live) {
      return (
        <p className="text-sm text-violet-400/80">
          Per-face breakdown appears after Stage 3 finishes.
        </p>
      )
    }
    return <PerFaceStageTable data={data} />
  }

  if (!data.live) {
    return (
      <p className="text-xs text-violet-400/80">
        Stage 3 multimodal refinement has not run yet.
      </p>
    )
  }

  const compact = variant === 'compact'
  const resultsOnly = variant === 'results'
  const why = data.groupEmotionRationale
  const s1Conf = data.stage1AvgConfidence
  const s2Conf = data.stage2AvgConfidence
  const s3Conf = data.finalConfidence
  const hasAvgProgression =
    s1Conf != null || s2Conf != null || s3Conf != null
  const hasFaceRows = data.faceProgression.length > 0

  return (
    <div className="space-y-3">
      {!resultsOnly && data.finalEmotion ? (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-fuchsia-300/80">
            Final group emotion
          </p>
          <p
            className={`font-display font-bold capitalize text-fuchsia-100 ${
              compact ? 'text-xl' : 'text-2xl sm:text-3xl'
            }`}
          >
            {data.finalEmotion}
          </p>
        </div>
      ) : null}

      {hasAvgProgression && !resultsOnly ? (
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-950/20 px-3 py-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-300/85">
            Avg confidence — Stage 1 → 2 → 3
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <ConfidenceStep label="Stage 1" pct={fmtPct(s1Conf)} />
            <ConfidenceStep label="Stage 2" pct={fmtPct(s2Conf)} />
            <ConfidenceStep
              label="Stage 3"
              pct={fmtPct(s3Conf)}
              highlight
            />
          </div>
          {data.confidenceBoostApplied ? (
            <p className="mt-2 text-[11px] text-emerald-300/90">
              All faces match — confidence raised after scene fusion
            </p>
          ) : null}
        </div>
      ) : null}

      {hasFaceRows && !compact && !resultsOnly ? (
        <PerFaceStageTable data={data} />
      ) : null}

      {why ? (
        <div className="rounded-xl border border-fuchsia-500/30 bg-fuchsia-950/25 px-3 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-fuchsia-300/80">
            Why this photo reads as {data.finalEmotion ?? 'that'}
          </p>
          <p
            className={`mt-1 leading-relaxed text-violet-50/95 ${
              compact ? 'text-xs' : 'text-sm'
            }`}
          >
            {why}
          </p>
        </div>
      ) : null}

      {!resultsOnly ? (
        <div className="flex flex-wrap gap-1.5">
          <SignalChip label="Stage 2" value={data.stage2Emotion} />
          <SignalChip label="VLM" value={data.vlmEmotion} />
          <SignalChip label="Final" value={data.finalEmotion} highlight />
        </div>
      ) : null}
    </div>
  )
}
