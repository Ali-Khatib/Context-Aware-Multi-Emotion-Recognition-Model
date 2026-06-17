import type { AnalysisStatusDto, MetricsDto, StageDto } from '../api/types'
import {
  avgPredictionConfidence,
  countFaces,
  dominantEmotionFromPayload,
  parseConfusionMatrix,
  predictionsTableRows,
  refinementProgressionFromStages,
  stage3FromPayload,
  stagePayload,
} from './payloadAnalysis'

function esc(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function matrixHtml(raw: unknown): string {
  const m = parseConfusionMatrix(raw)
  if (!m) return '<p>No confusion matrix for this run.</p>'
  const n = m.labels.length
  const grid: (number | null)[][] = Array.from({ length: n }, () =>
    Array.from({ length: n }, () => null),
  )
  for (const c of m.cells) {
    if (c.row < n && c.col < n) grid[c.row]![c.col] = c.value
  }
  let rows = ''
  for (let i = 0; i < n; i++) {
    rows += '<tr>'
    rows += `<th>${esc(m.labels[i] ?? '')}</th>`
    for (let j = 0; j < n; j++) {
      const v = grid[i]![j]
      const opacity = v == null ? 0.15 : 0.2 + (0.8 * (v ?? 0)) / m.maxVal
      const text = v == null ? '—' : String(v)
      rows += `<td style="background:rgba(168,85,247,${opacity});text-align:center;padding:10px">${esc(text)}</td>`
    }
    rows += '</tr>'
  }
  let header = '<tr><th></th>'
  for (const lab of m.labels) {
    header += `<th>${esc(lab)}</th>`
  }
  header += '</tr>'
  return `<table class="mx"><thead>${header}</thead><tbody>${rows}</tbody></table>`
}

export function downloadAnalysisReport(opts: {
  analysisId: string
  status: AnalysisStatusDto | null
  stages: StageDto[]
  metrics: MetricsDto[]
  fileLabel?: string | null
}) {
  const { analysisId, status, stages, metrics, fileLabel } = opts
  const s0 = stagePayload(stages, 'stage0')
  const s1 = stagePayload(stages, 'stage1')
  const s2 = stagePayload(stages, 'stage2')
  const s3 = stagePayload(stages, 'stage3')
  const stage3 = stage3FromPayload(s3)
  const progression = refinementProgressionFromStages(stages)
  const lastPred = s3 ?? s2 ?? s1
  const faces = countFaces(s0)
  const dom = dominantEmotionFromPayload(lastPred)
  const rows = predictionsTableRows(lastPred)

  let classRows = ''
  for (const r of rows) {
    classRows += `<tr><td>${esc(String(r.faceId))}</td><td>${esc(r.label)}</td><td>${esc(r.confidence)}</td></tr>`
  }

  const firstCm = metrics.find((m) => m.confusionMatrix != null)?.confusionMatrix

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>Analysis report</title>
<style>
body{font-family:system-ui,sans-serif;background:#0f0618;color:#e9d5ff;padding:24px;max-width:960px;margin:0 auto}
h1{color:#f0abfc} h2{color:#ddd6fe;margin-top:28px}
table{border-collapse:collapse;width:100%;margin:12px 0}
th,td{border:1px solid rgba(168,85,247,.35);padding:8px;text-align:left}
th{background:rgba(88,28,135,.4)}
.note{font-size:13px;opacity:.85;margin-top:8px}
.mx th,.mx td{font-size:13px}
</style></head><body>
<h1>Emotion analysis report</h1>
<p><strong>Run reference:</strong> ${esc(analysisId)}</p>
${fileLabel ? `<p><strong>File:</strong> ${esc(fileLabel)}</p>` : ''}
<p><strong>Outcome:</strong> ${esc(status?.status ?? '—')}</p>
${status?.errorMessage ? `<p class="note"><strong>Note:</strong> ${esc(status.errorMessage)}</p>` : ''}

<h2>Summary</h2>
<ul>
<li>Faces detected: ${faces ?? '—'}</li>
<li>Dominant emotion (highest confidence in final stage table): ${dom ? esc(dom) : '—'}</li>
${stage3.live && stage3.finalEmotion ? `<li>Stage 3 final verdict: ${esc(stage3.finalEmotion)}${stage3.finalConfidence != null ? ` (${stage3.finalConfidence.toFixed(4)} confidence)` : ''}</li>` : ''}
${stage3.groupEmotionRationale ? `<li>Why this photo: ${esc(stage3.groupEmotionRationale)}</li>` : ''}
${stage3.refinementNote && stage3.refinementNote !== stage3.groupEmotionRationale ? `<li>Stage 3 note: ${esc(stage3.refinementNote)}</li>` : ''}
</ul>

<h2>Group emotion across stages (Stage 1 → 2 → 3)</h2>
<table><thead><tr><th>Pass</th><th>Group emotion</th></tr></thead><tbody>
${progression.steps.map((s) => `<tr><td>${esc(s.title)}</td><td>${s.emotion ? esc(s.emotion) : '—'}</td></tr>`).join('') || '<tr><td colspan="2">No stage data.</td></tr>'}
</tbody></table>

<h2>Confidence by stage</h2>
<ul>
<li>Average confidence by stage: face detection ${avgPredictionConfidence(s0) != null ? (avgPredictionConfidence(s0)!).toFixed(4) : '—'}, stage 1 ${avgPredictionConfidence(s1) != null ? (avgPredictionConfidence(s1)!).toFixed(4) : '—'}, stage 2 ${avgPredictionConfidence(s2) != null ? (avgPredictionConfidence(s2)!).toFixed(4) : '—'}, stage 3 ${avgPredictionConfidence(s3) != null ? (avgPredictionConfidence(s3)!).toFixed(4) : '—'}</li>
</ul>

<h2>Classification (final stage predictions)</h2>
<table><thead><tr><th>Face</th><th>Label</th><th>Confidence</th></tr></thead><tbody>${classRows || '<tr><td colspan="3">No prediction rows.</td></tr>'}</tbody></table>

<h2>Confusion matrix</h2>
${matrixHtml(firstCm ?? null)}

<p class="note">Exported report — values are read-only.</p>
</body></html>`

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `emotion-report-${analysisId.slice(0, 8)}.html`
  a.rel = 'noopener'
  a.click()
  URL.revokeObjectURL(a.href)
}
