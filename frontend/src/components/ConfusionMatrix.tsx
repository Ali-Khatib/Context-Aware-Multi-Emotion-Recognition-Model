import { parseConfusionMatrix } from '../utils/payloadAnalysis'

type Props = {
  raw: unknown
  caption?: string
  /** e.g. "Stage 1" — shown on row axis */
  fromStage?: string
  /** e.g. "Stage 2" — shown on column axis */
  toStage?: string
}

function compactLabels(
  labels: string[],
  grid: (number | null)[][],
): { labels: string[]; grid: number[][] } {
  const rowSum = (i: number) =>
    grid[i]!.reduce((s, v) => s + (v ?? 0), 0)
  const colSum = (j: number) =>
    grid.reduce((s, row) => s + (row[j] ?? 0), 0)

  const keep = labels
    .map((_, i) => i)
    .filter((i) => rowSum(i) > 0 || colSum(i) > 0)

  if (keep.length === labels.length) {
    return {
      labels,
      grid: grid.map((row) => row.map((v) => v ?? 0)),
    }
  }

  return {
    labels: keep.map((i) => labels[i]!),
    grid: keep.map((i) => keep.map((j) => grid[i]![j] ?? 0)),
  }
}

export function ConfusionMatrix({
  raw,
  caption,
  fromStage = 'Before',
  toStage = 'After',
}: Props) {
  const m = parseConfusionMatrix(raw)
  if (!m) {
    return (
      <div className="rounded-xl border border-purple-500/25 bg-violet-950/25 p-4">
        {caption ? (
          <p className="text-sm font-semibold text-fuchsia-200/95">{caption}</p>
        ) : null}
        <p className="mt-2 text-sm text-violet-400/80">
          No label-change data for this step yet.
        </p>
      </div>
    )
  }

  const n = m.labels.length
  const fullGrid: (number | null)[][] = Array.from({ length: n }, () =>
    Array.from({ length: n }, () => 0),
  )
  for (const c of m.cells) {
    if (c.row < n && c.col < n) fullGrid[c.row]![c.col] = Math.round(c.value)
  }

  const { labels, grid } = compactLabels(m.labels, fullGrid)
  const size = labels.length

  let total = 0
  let unchanged = 0
  let relabeled = 0
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      const v = grid[i]![j]!
      total += v
      if (i === j) unchanged += v
      else relabeled += v
    }
  }

  const maxVal = Math.max(1, ...grid.flat())

  return (
    <div className="rounded-xl border border-purple-500/25 bg-violet-950/25 p-4 sm:p-5">
      {caption ? (
        <h4 className="text-sm font-bold text-fuchsia-200/95">{caption}</h4>
      ) : null}

      <p className="mt-2 text-xs leading-relaxed text-violet-300/85">
        Each cell is how many <strong className="font-semibold text-violet-100">faces</strong>{' '}
        had the row emotion at {fromStage} and the column emotion at {toStage}.
        Diagonal = same label (no change).
      </p>

      <p className="mt-2 text-xs font-mono text-violet-400/90">
        {total} face{total === 1 ? '' : 's'} · {unchanged} unchanged ·{' '}
        {relabeled} relabeled
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="mx-auto min-w-[12rem] border-collapse text-center text-xs sm:text-sm">
          <thead>
            <tr>
              <th
                colSpan={size + 1}
                className="border border-purple-500/30 bg-purple-950/60 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-violet-300/90 sm:text-xs"
              >
                Column = emotion at {toStage}
              </th>
            </tr>
            <tr>
              <th className="border border-purple-500/30 bg-purple-950/50 p-2 text-[10px] font-semibold text-violet-400/90 sm:text-xs">
                Row ↓
                <br />
                <span className="font-normal normal-case text-violet-500/90">
                  {fromStage}
                </span>
              </th>
              {labels.map((lab) => (
                <th
                  key={lab}
                  className="border border-purple-500/30 bg-purple-950/50 px-2 py-2 font-semibold capitalize text-fuchsia-200/95"
                >
                  {lab}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {labels.map((rowLab, i) => (
              <tr key={rowLab}>
                <th className="border border-purple-500/30 bg-purple-950/50 px-2 py-2 text-left capitalize text-fuchsia-200/95">
                  {rowLab}
                </th>
                {labels.map((_, j) => {
                  const v = grid[i]![j]!
                  const isDiag = i === j
                  const isChange = !isDiag && v > 0
                  const intensity =
                    v === 0 ? 0 : 0.12 + (0.55 * v) / maxVal
                  return (
                    <td
                      key={j}
                      className={`border border-purple-500/25 p-2 font-mono tabular-nums ${
                        v === 0
                          ? 'text-violet-600/70'
                          : isDiag
                            ? 'font-bold text-emerald-100'
                            : 'font-bold text-amber-100'
                      }`}
                      style={{
                        background:
                          v === 0
                            ? 'rgba(15,6,24,0.35)'
                            : isDiag
                              ? `rgba(52,211,153,${intensity})`
                              : isChange
                                ? `rgba(251,191,36,${intensity})`
                                : `rgba(168,85,247,${intensity})`,
                      }}
                      title={
                        v === 0
                          ? `${rowLab} → ${labels[j]}: none`
                          : `${v} face${v === 1 ? '' : 's'}: ${rowLab} → ${labels[j]}`
                      }
                    >
                      {v}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-violet-400/80 sm:text-xs">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded border border-emerald-500/40 bg-emerald-500/35" />
          Unchanged (diagonal)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded border border-amber-500/40 bg-amber-500/35" />
          Relabeled (off-diagonal)
        </span>
      </div>
    </div>
  )
}
