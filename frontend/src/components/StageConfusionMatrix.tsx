import type { StageEmotionMatrix } from '../utils/payloadAnalysis'

type Props = {
  title: string
  matrix: StageEmotionMatrix
  stageNumber: 1 | 2 | 3
}

export function StageConfusionMatrix({ title, matrix, stageNumber }: Props) {
  const { labels, grid, faceCount } = matrix
  const maxVal = Math.max(1, ...grid.flat())

  return (
    <div className="rounded-xl border border-emerald-500/25 bg-violet-950/25 p-4 sm:p-5">
      <h4 className="text-sm font-bold text-emerald-200/95">{title}</h4>
      <p className="mt-2 text-xs leading-relaxed text-violet-300/85">
        7×7 grid with all emotions. Number on the{' '}
        <strong className="font-semibold text-emerald-100">diagonal</strong> =
        how many faces were labeled that emotion at Stage {stageNumber}.
        Off-diagonal stays 0 (same label on both axes).
      </p>
      <p className="mt-2 text-xs font-mono text-emerald-400/90">
        {faceCount} face{faceCount === 1 ? '' : 's'}
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="mx-auto border-collapse text-center text-[10px] sm:text-xs">
          <thead>
            <tr>
              <th className="border border-emerald-500/30 bg-emerald-950/40 p-1.5" />
              {labels.map((lab) => (
                <th
                  key={lab}
                  className="min-w-[2.5rem] border border-emerald-500/30 bg-emerald-950/40 px-1 py-2 font-semibold capitalize text-emerald-100/95"
                >
                  {lab}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {labels.map((rowLab, i) => (
              <tr key={rowLab}>
                <th className="border border-emerald-500/30 bg-emerald-950/40 px-2 py-1.5 text-left capitalize text-emerald-100/95">
                  {rowLab}
                </th>
                {labels.map((colLab, j) => {
                  const v = grid[i]![j]!
                  const isDiag = i === j
                  const intensity =
                    v === 0 ? 0 : 0.2 + (0.8 * v) / maxVal
                  return (
                    <td
                      key={`${rowLab}-${colLab}`}
                      className={`min-w-[2.5rem] border border-emerald-500/20 p-2 font-mono tabular-nums ${
                        v === 0
                          ? 'text-violet-600/50'
                          : 'font-bold text-emerald-50'
                      }`}
                      style={{
                        background:
                          v === 0
                            ? 'rgba(15,6,24,0.45)'
                            : isDiag
                              ? `rgba(52,211,153,${intensity})`
                              : 'rgba(15,6,24,0.45)',
                      }}
                      title={
                        isDiag && v > 0
                          ? `${v} face${v === 1 ? '' : 's'} labeled ${rowLab}`
                          : undefined
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
    </div>
  )
}
