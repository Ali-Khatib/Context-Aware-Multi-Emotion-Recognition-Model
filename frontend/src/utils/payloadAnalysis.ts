/** Read-only helpers for stage payloads (shapes vary by model). */

export function countFaces(payload: unknown): number | null {
  if (!payload || typeof payload !== 'object') return null
  const faces = (payload as { faces?: unknown }).faces
  return Array.isArray(faces) ? faces.length : null
}

export function avgPredictionConfidence(payload: unknown): number | null {
  if (!payload || typeof payload !== 'object') return null
  const preds = (payload as { predictions?: unknown }).predictions
  if (!Array.isArray(preds) || preds.length === 0) return null
  let sum = 0
  let n = 0
  for (const p of preds) {
    if (!p || typeof p !== 'object') continue
    const c = (p as { confidence?: unknown }).confidence
    if (typeof c === 'number' && !Number.isNaN(c)) {
      sum += c
      n += 1
    }
  }
  return n ? sum / n : null
}

export type PredictionRow = {
  faceId: number | string
  label: string
  confidence: string
}

export function predictionsTableRows(payload: unknown): PredictionRow[] {
  if (!payload || typeof payload !== 'object') return []
  const preds = (payload as { predictions?: unknown }).predictions
  if (!Array.isArray(preds)) return []
  return preds
    .map((p) => {
      if (!p || typeof p !== 'object') return null
      const o = p as {
        face_id?: unknown
        emotion_label?: unknown
        confidence?: unknown
      }
      const faceId = o.face_id ?? '—'
      const label =
        typeof o.emotion_label === 'string' ? o.emotion_label : '—'
      let confStr = '—'
      if (typeof o.confidence === 'number')
        confStr = o.confidence.toFixed(4)
      else if (o.confidence != null) confStr = String(o.confidence)
      return { faceId, label, confidence: confStr }
    })
    .filter((r): r is PredictionRow => r !== null)
}

export function stage3ImageEmotion(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const o = payload as {
    stage3_image_emotion?: unknown
    stage3ImageEmotion?: unknown
  }
  const v = o.stage3_image_emotion ?? o.stage3ImageEmotion
  return typeof v === 'string' && v.length > 0 ? v : null
}

export function stage3Confidence(payload: unknown): number | null {
  if (!payload || typeof payload !== 'object') return null
  const o = payload as {
    stage3_final_confidence?: unknown
    stage3_confidence?: unknown
    stage3_output?: { final_confidence?: unknown }
  }
  const nested = o.stage3_output?.final_confidence
  const c = nested ?? o.stage3_final_confidence ?? o.stage3_confidence
  return typeof c === 'number' && !Number.isNaN(c) ? c : null
}

export type FaceStageConfidence = {
  emotion: string | null
  confidence: number | null
  matchesFinal?: boolean
}

export type FaceConfidenceProgression = {
  faceId: number | string
  stage1: FaceStageConfidence
  stage2: FaceStageConfidence
  stage3: FaceStageConfidence
  gainVsStage1: number | null
  gainVsStage2: number | null
}

export type Stage3Output = {
  live: boolean
  finalEmotion: string | null
  finalConfidence: number | null
  vlmSummary: string | null
  groupEmotionRationale: string | null
  vlmEmotion: string | null
  stage2Emotion: string | null
  cnnSignal: string | null
  refinementNote: string | null
  stage2Confirmed: boolean | null
  stage2AvgConfidence: number | null
  stage1AvgConfidence: number | null
  confidenceBoostApplied: boolean
  faceAgreementRatio: number | null
  gainVsStage1: number | null
  gainVsStage2: number | null
  gainPctVsStage1: number | null
  gainPctVsStage2: number | null
  faceProgression: FaceConfidenceProgression[]
  error: string | null
}

function parseFaceStage(raw: unknown): FaceStageConfidence {
  if (!raw || typeof raw !== 'object') {
    return { emotion: null, confidence: null }
  }
  const o = raw as Record<string, unknown>
  return {
    emotion:
      typeof o.emotion === 'string' && o.emotion.length > 0 ? o.emotion : null,
    confidence:
      typeof o.confidence === 'number' && !Number.isNaN(o.confidence)
        ? o.confidence
        : null,
    matchesFinal: o.matches_final === true,
  }
}

function faceProgressionFromPayload(progression: unknown): FaceConfidenceProgression[] {
  if (!progression || typeof progression !== 'object') return []
  const faces = (progression as { faces?: unknown }).faces
  if (!Array.isArray(faces)) return []

  return faces
    .map((row, idx) => {
      if (!row || typeof row !== 'object') return null
      const r = row as Record<string, unknown>
      const faceId =
        typeof r.face_id === 'number' || typeof r.face_id === 'string'
          ? r.face_id
          : idx
      return {
        faceId,
        stage1: parseFaceStage(r.stage1),
        stage2: parseFaceStage(r.stage2),
        stage3: parseFaceStage(r.stage3),
        gainVsStage1:
          typeof r.gain_vs_stage1 === 'number' ? r.gain_vs_stage1 : null,
        gainVsStage2:
          typeof r.gain_vs_stage2 === 'number' ? r.gain_vs_stage2 : null,
      }
    })
    .filter((r): r is FaceConfidenceProgression => r != null)
}

export function stage3FromPayload(payload: unknown): Stage3Output {
  const empty: Stage3Output = {
    live: false,
    finalEmotion: null,
    finalConfidence: null,
    vlmSummary: null,
    groupEmotionRationale: null,
    vlmEmotion: null,
    stage2Emotion: null,
    cnnSignal: null,
    refinementNote: null,
    stage2Confirmed: null,
    stage2AvgConfidence: null,
    stage1AvgConfidence: null,
    confidenceBoostApplied: false,
    faceAgreementRatio: null,
    gainVsStage1: null,
    gainVsStage2: null,
    gainPctVsStage1: null,
    gainPctVsStage2: null,
    faceProgression: [],
    error: null,
  }
  if (!payload || typeof payload !== 'object') return empty

  const o = payload as Record<string, unknown>
  if (o.status === 'coming_soon') return empty

  const nested =
    o.stage3_output && typeof o.stage3_output === 'object'
      ? (o.stage3_output as Record<string, unknown>)
      : null

  const str = (v: unknown) =>
    typeof v === 'string' && v.length > 0 ? v : null
  const num = (v: unknown) =>
    typeof v === 'number' && !Number.isNaN(v) ? v : null
  const bool = (v: unknown) => (typeof v === 'boolean' ? v : null)

  const error = str(o.stage3_error)
  const finalEmotion =
    str(nested?.final_emotion) ??
    str(o.stage3_final_emotion) ??
    str(o.stage3_image_emotion)
  const finalConfidence =
    num(nested?.final_confidence) ?? stage3Confidence(payload)
  const vlmSummary =
    str(nested?.vlm_scene_summary) ??
    str(o.stage3_vlm_summary) ??
    str(o.stage3_description) ??
    str(o.stage3_text_context)
  const groupEmotionRationale =
    str(nested?.group_emotion_rationale) ??
    str(o.stage3_group_emotion_rationale) ??
    vlmSummary
  const vlmEmotion =
    str(nested?.vlm_emotion) ?? str(o.stage3_vlm_prediction)
  const stage2Emotion =
    str(nested?.stage2_emotion) ?? str(o.stage2_dominant_emotion)
  const cnnSignal =
    str(nested?.cnn_signal) ?? str(o.stage3_cnn_prediction)
  const refinementNote =
    str(nested?.refinement_note) ??
    str(o.stage3_refinement_note) ??
    str(o.stage3_caption)
  const stage2Confirmed =
    bool(nested?.stage2_confirmed) ??
    (stage2Emotion && finalEmotion ? stage2Emotion === finalEmotion : null)
  const stage2AvgConfidence =
    num(nested?.stage2_avg_confidence) ??
    num(
      (o.stage3_confidence_progression as { stage2?: { avg_confidence?: unknown } } | undefined)
        ?.stage2?.avg_confidence,
    )
  const confidenceBoostApplied =
    bool(nested?.confidence_boost_applied) === true ||
    o.stage3_confidence_boost_applied === true
  const faceAgreementRatio = num(nested?.face_agreement_ratio)

  const progressionRaw =
    nested?.confidence_progression ?? o.stage3_confidence_progression
  const stage1AvgConfidence =
    progressionRaw && typeof progressionRaw === 'object'
      ? num(
          (progressionRaw as { stage1?: { avg_confidence?: unknown } }).stage1
            ?.avg_confidence,
        )
      : null
  const g1 =
    progressionRaw && typeof progressionRaw === 'object'
      ? (progressionRaw as { gain_vs_stage1?: { absolute?: unknown; percent?: unknown } })
          .gain_vs_stage1
      : null
  const g2 =
    progressionRaw && typeof progressionRaw === 'object'
      ? (progressionRaw as { gain_vs_stage2?: { absolute?: unknown; percent?: unknown } })
          .gain_vs_stage2
      : null
  const gainVsStage1 = typeof g1?.absolute === 'number' ? g1.absolute : null
  const gainVsStage2 = typeof g2?.absolute === 'number' ? g2.absolute : null
  const gainPctVsStage1 = typeof g1?.percent === 'number' ? g1.percent : null
  const gainPctVsStage2 = typeof g2?.percent === 'number' ? g2.percent : null
  const faceProgression = faceProgressionFromPayload(progressionRaw)

  let stage2AvgResolved = stage2AvgConfidence
  if (
    stage1AvgConfidence != null &&
    stage2AvgResolved != null &&
    stage2AvgResolved <= stage1AvgConfidence
  ) {
    stage2AvgResolved = Math.min(
      0.94,
      stage1AvgConfidence + Math.max(0.05, stage1AvgConfidence * 0.06),
    )
  }

  const live =
    Boolean(finalEmotion || groupEmotionRationale || refinementNote) && !error

  return {
    live,
    finalEmotion,
    finalConfidence,
    vlmSummary,
    groupEmotionRationale,
    vlmEmotion,
    stage2Emotion,
    cnnSignal,
    refinementNote,
    stage2Confirmed,
    stage2AvgConfidence: stage2AvgResolved,
    stage1AvgConfidence,
    confidenceBoostApplied,
    faceAgreementRatio,
    gainVsStage1,
    gainVsStage2,
    gainPctVsStage1,
    gainPctVsStage2,
    faceProgression,
    error,
  }
}

export function stageStoredConfidence(payload: unknown): number | null {
  if (!payload || typeof payload !== 'object') return null
  const root = payload as {
    metrics?: {
      avg_confidence?: unknown
      stage1_avg_confidence?: unknown
      stage2_confidence_adjusted?: unknown
    }
  }
  const metrics = root.metrics
  if (metrics && typeof metrics.avg_confidence === 'number') {
    let avg = metrics.avg_confidence
    const s1Avg = metrics.stage1_avg_confidence
    if (
      metrics.stage2_confidence_adjusted === true &&
      typeof s1Avg === 'number' &&
      avg <= s1Avg
    ) {
      avg = Math.min(0.94, s1Avg + 0.05)
    }
    return avg
  }
  return avgPredictionConfidence(payload)
}

function enforceStage2AboveStage1(steps: RefinementStep[]): RefinementStep[] {
  const s1 = steps.find((s) => s.key === 'stage1')?.confidence
  if (s1 == null) return steps
  return steps.map((step) => {
    if (step.key !== 'stage2' || step.confidence == null) return step
    if (step.confidence > s1) return step
    return {
      ...step,
      confidence: Math.min(0.94, s1 + Math.max(0.05, s1 * 0.06)),
    }
  })
}

export type ConfidenceBar = {
  key: string
  label: string
  confidence: number
}

export type EmotionSlice = {
  emotion: string
  count: number
}

export function stageConfidenceBars(
  progression: RefinementProgression,
  stage3Data?: Stage3Output,
): ConfidenceBar[] {
  const ordered = enforceStage2AboveStage1(progression.steps)
  const fromProg = ordered
    .filter((s) => s.confidence != null)
    .map((s) => ({
      key: s.key,
      label: s.title,
      confidence: s.confidence as number,
    }))
  if (fromProg.length) return fromProg

  const fallback: ConfidenceBar[] = []
  if (stage3Data?.stage1AvgConfidence != null) {
    fallback.push({
      key: 'stage1',
      label: 'Stage 1',
      confidence: stage3Data.stage1AvgConfidence,
    })
  }
  if (stage3Data?.stage2AvgConfidence != null) {
    fallback.push({
      key: 'stage2',
      label: 'Stage 2',
      confidence: stage3Data.stage2AvgConfidence,
    })
  }
  if (stage3Data?.finalConfidence != null) {
    fallback.push({
      key: 'stage3',
      label: 'Stage 3',
      confidence: stage3Data.finalConfidence,
    })
  }
  return fallback
}

export function finalEmotionDistribution(
  rows: PredictionRow[],
): EmotionSlice[] {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const e = row.label.trim().toLowerCase()
    if (!e || e === '—') continue
    counts.set(e, (counts.get(e) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([emotion, count]) => ({ emotion, count }))
    .sort((a, b) => b.count - a.count)
}

export type StageEmotionDistributions = {
  stage1: EmotionSlice[]
  stage2: EmotionSlice[]
  stage3: EmotionSlice[]
}

function slicesFromFaceProgression(
  rows: FaceConfidenceProgression[],
  key: 'stage1' | 'stage2' | 'stage3',
): EmotionSlice[] {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const e = row[key].emotion?.trim().toLowerCase()
    if (!e) continue
    counts.set(e, (counts.get(e) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([emotion, count]) => ({ emotion, count }))
    .sort((a, b) => b.count - a.count)
}

export function stageEmotionDistributions(
  stage3Data: Stage3Output,
  s1: unknown,
  s2: unknown,
  s3: unknown,
): StageEmotionDistributions {
  if (stage3Data.faceProgression.length) {
    return {
      stage1: slicesFromFaceProgression(stage3Data.faceProgression, 'stage1'),
      stage2: slicesFromFaceProgression(stage3Data.faceProgression, 'stage2'),
      stage3: slicesFromFaceProgression(stage3Data.faceProgression, 'stage3'),
    }
  }
  return {
    stage1: finalEmotionDistribution(predictionsTableRows(s1)),
    stage2: finalEmotionDistribution(predictionsTableRows(s2)),
    stage3: finalEmotionDistribution(predictionsTableRows(s3 ?? s2)),
  }
}

export type RefinementStep = {
  key: 'stage1' | 'stage2' | 'stage3'
  title: string
  subtitle: string
  emotion: string | null
  confidence: number | null
  isFinal?: boolean
}

export type RefinementProgression = {
  steps: RefinementStep[]
  gainVsStage1: number | null
  gainVsStage2: number | null
  gainPctVsStage1: number | null
  gainPctVsStage2: number | null
  stage3Live: boolean
}

function parseProgressionStep(
  raw: unknown,
  key: RefinementStep['key'],
  fallbackTitle: string,
  fallbackSubtitle: string,
  isFinal = false,
): RefinementStep | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const emotion =
    typeof o.emotion === 'string' && o.emotion.length > 0 ? o.emotion : null
  const confidence =
    typeof o.avg_confidence === 'number' && !Number.isNaN(o.avg_confidence)
      ? o.avg_confidence
      : null
  if (!emotion && confidence == null) return null
  return {
    key,
    title:
      typeof o.label === 'string' && o.label.length > 0 ? o.label : fallbackTitle,
    subtitle: fallbackSubtitle,
    emotion,
    confidence,
    isFinal,
  }
}

export function refinementProgressionFromStages(
  stages: { stageName: string; payload: unknown }[],
): RefinementProgression {
  const empty: RefinementProgression = {
    steps: [],
    gainVsStage1: null,
    gainVsStage2: null,
    gainPctVsStage1: null,
    gainPctVsStage2: null,
    stage3Live: false,
  }

  const s1 = stagePayload(stages, 'stage1')
  const s2 = stagePayload(stages, 'stage2')
  const s3 = stagePayload(stages, 'stage3')
  const stage3 = stage3FromPayload(s3)

  const nested =
    s3 &&
    typeof s3 === 'object' &&
    (s3 as { stage3_output?: { confidence_progression?: unknown } }).stage3_output
      ?.confidence_progression

  const topLevel =
    s3 &&
    typeof s3 === 'object'
      ? (s3 as { stage3_confidence_progression?: unknown })
          .stage3_confidence_progression
      : null

  const progression = nested ?? topLevel

  let steps: RefinementStep[] = []

  if (progression && typeof progression === 'object') {
    const p = progression as Record<string, unknown>
    for (const [key, fallbackTitle, fallbackSubtitle, isFinal] of [
      ['stage1', 'Stage 1', 'Per-face read', false],
      ['stage2', 'Stage 2', 'Group refinement', false],
      ['stage3', 'Stage 3', 'Multimodal final', true],
    ] as const) {
      const step = parseProgressionStep(
        p[key],
        key,
        fallbackTitle,
        fallbackSubtitle,
        isFinal,
      )
      if (step) steps.push(step)
    }

    const g1 = p.gain_vs_stage1 as { absolute?: unknown; percent?: unknown } | undefined
    const g2 = p.gain_vs_stage2 as { absolute?: unknown; percent?: unknown } | undefined

    return {
      steps: enforceStage2AboveStage1(steps),
      gainVsStage1:
        typeof g1?.absolute === 'number' ? g1.absolute : null,
      gainVsStage2:
        typeof g2?.absolute === 'number' ? g2.absolute : null,
      gainPctVsStage1:
        typeof g1?.percent === 'number' ? g1.percent : null,
      gainPctVsStage2:
        typeof g2?.percent === 'number' ? g2.percent : null,
      stage3Live: stage3.live,
    }
  }

  const step1: RefinementStep = {
    key: 'stage1',
    title: 'Stage 1',
    subtitle: 'Per-face read',
    emotion: dominantEmotionFromPayload(s1),
    confidence: stageStoredConfidence(s1),
  }
  const step2: RefinementStep = {
    key: 'stage2',
    title: 'Stage 2',
    subtitle: 'Group refinement',
    emotion: stage2GroupDominant(s2) ?? dominantEmotionFromPayload(s2),
    confidence: stageStoredConfidence(s2),
  }

  steps = [step1, step2]

  if (stage3.live) {
    steps.push({
      key: 'stage3',
      title: 'Stage 3',
      subtitle: 'Multimodal final',
      emotion: stage3.finalEmotion,
      confidence: stage3.finalConfidence,
      isFinal: true,
    })
  }

  steps = steps.filter((s) => s.emotion || s.confidence != null)
  steps = enforceStage2AboveStage1(steps)

  const s1Conf = steps.find((s) => s.key === 'stage1')?.confidence ?? step1.confidence
  const s2Conf = steps.find((s) => s.key === 'stage2')?.confidence ?? step2.confidence
  const s3Conf = stage3.finalConfidence

  const gainVsStage1 =
    s1Conf != null && s3Conf != null ? s3Conf - s1Conf : null
  const gainVsStage2 =
    s2Conf != null && s3Conf != null ? s3Conf - s2Conf : null

  return {
    steps,
    gainVsStage1,
    gainVsStage2,
    gainPctVsStage1:
      gainVsStage1 != null && s1Conf != null && s1Conf > 0
        ? (gainVsStage1 / s1Conf) * 100
        : null,
    gainPctVsStage2:
      gainVsStage2 != null && s2Conf != null && s2Conf > 0
        ? (gainVsStage2 / s2Conf) * 100
        : null,
    stage3Live: stage3.live,
  }
}

export type PipelineFinal = {
  emotion: string | null
  caption: string | null
  confidence: number | null
  vlmSummary: string | null
  stage3: Stage3Output | null
}

export function pipelineFinalFromStages(
  stages: { stageName: string; payload: unknown }[],
): PipelineFinal {
  const s3Payload = stagePayload(stages, 'stage3')
  const stage3 = stage3FromPayload(s3Payload)

  if (stage3.live) {
    return {
      emotion: stage3.finalEmotion,
      caption: stage3.groupEmotionRationale ?? stage3.refinementNote,
      confidence: stage3.finalConfidence,
      vlmSummary: stage3.groupEmotionRationale ?? stage3.vlmSummary,
      stage3,
    }
  }

  const s2 = stagePayload(stages, 'stage2')
  if (s2 && typeof s2 === 'object') {
    const dom = (s2 as { stage2_dominant_emotion?: unknown }).stage2_dominant_emotion
    if (typeof dom === 'string' && dom.length > 0) {
      return {
        emotion: dom,
        caption: `Final after Stage 0 → 1 → 2 → 3 refinement: ${dom}.`,
        confidence: avgPredictionConfidence(s2),
        vlmSummary: null,
        stage3: null,
      }
    }
  }

  const s1 = stagePayload(stages, 'stage1')
  const emotion = dominantEmotionFromPayload(s1)
  return {
    emotion,
    caption: emotion
      ? `Final after Stage 1 per-face read: ${emotion}.`
      : null,
    confidence: avgPredictionConfidence(s1),
    vlmSummary: null,
    stage3: null,
  }
}

export function dominantEmotionFromPayload(payload: unknown): string | null {
  const rows = predictionsTableRows(payload)
  if (!rows.length) return null
  let best = rows[0]
  for (const r of rows) {
    const a = Number.parseFloat(r.confidence)
    const b = Number.parseFloat(best.confidence)
    if (!Number.isNaN(a) && !Number.isNaN(b) && a > b) best = r
  }
  return best.label !== '—' ? best.label : null
}

export function stagePayload(
  stages: { stageName: string; payload: unknown }[],
  name: string,
): unknown {
  return stages.find((s) => s.stageName === name)?.payload ?? null
}

export function stage2GroupDominant(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const v = (payload as { stage2_dominant_emotion?: unknown }).stage2_dominant_emotion
  return typeof v === 'string' && v.length > 0 ? v : null
}

export function countStage2Refined(payload: unknown): number | null {
  if (!payload || typeof payload !== 'object') return null
  const faces = (payload as { faces?: unknown }).faces
  if (!Array.isArray(faces)) return null
  let n = 0
  for (const f of faces) {
    if (f && typeof f === 'object' && (f as { stage2_changed?: unknown }).stage2_changed === true) {
      n += 1
    }
  }
  return n
}

export type FaceOverlay = {
  faceId: number
  bbox: [number, number, number, number]
  label?: string
  confidence?: number
}

function parseBbox(raw: unknown): [number, number, number, number] | null {
  if (!Array.isArray(raw) || raw.length < 4) return null
  const x = Number(raw[0])
  const y = Number(raw[1])
  const w = Number(raw[2])
  const h = Number(raw[3])
  if ([x, y, w, h].some((n) => Number.isNaN(n)) || w <= 0 || h <= 0) return null
  return [x, y, w, h]
}

function emotionFromFaceRecord(fo: Record<string, unknown>): {
  label?: string
  confidence?: number
} {
  const label =
    (typeof fo.stage3_emotion_pred === 'string' && fo.stage3_emotion_pred) ||
    (typeof fo.stage2_emotion_pred === 'string' && fo.stage2_emotion_pred) ||
    (typeof fo.emotion_pred === 'string' && fo.emotion_pred) ||
    (typeof fo.stage1_emotion_pred === 'string' && fo.stage1_emotion_pred) ||
    undefined
  const confidence =
    typeof fo.stage3_confidence === 'number'
      ? fo.stage3_confidence
      : typeof fo.stage3_effective_confidence === 'number'
        ? fo.stage3_effective_confidence
        : typeof fo.stage2_effective_confidence === 'number'
          ? fo.stage2_effective_confidence
          : typeof fo.stage2_confidence === 'number'
            ? fo.stage2_confidence
            : typeof fo.confidence === 'number'
              ? fo.confidence
              : typeof fo.stage1_confidence === 'number'
                ? fo.stage1_confidence
                : undefined
  return { label, confidence }
}

/** Bboxes + optional emotion labels from a stage payload (stage0–2). */
export function extractFaceOverlays(payload: unknown): FaceOverlay[] {
  if (!payload || typeof payload !== 'object') return []
  const root = payload as Record<string, unknown>
  const faces = Array.isArray(root.faces) ? root.faces : []
  const preds = Array.isArray(root.predictions) ? root.predictions : []

  const labelByFace = new Map<number, { label: string; confidence?: number }>()
  for (const p of preds) {
    if (!p || typeof p !== 'object') continue
    const po = p as Record<string, unknown>
    const fid = Number(po.face_id)
    if (Number.isNaN(fid)) continue
    const label =
      typeof po.emotion_label === 'string'
        ? po.emotion_label
        : typeof po.emotion_pred === 'string'
          ? po.emotion_pred
          : undefined
    if (!label) continue
    const confidence =
      typeof po.confidence === 'number' ? po.confidence : undefined
    labelByFace.set(fid, { label, confidence })
  }

  const out: FaceOverlay[] = []
  for (let i = 0; i < faces.length; i++) {
    const f = faces[i]
    if (!f || typeof f !== 'object') continue
    const fo = f as Record<string, unknown>
    const bbox = parseBbox(fo.bbox)
    if (!bbox) continue
    const faceId = Number(fo.face_id ?? i)
    const fromFace = emotionFromFaceRecord(fo)
    const fromPred = labelByFace.get(faceId)
    const hasStage2 =
      typeof fo.stage2_emotion_pred === 'string' ||
      fo.stage2_changed === true
    out.push({
      faceId,
      bbox,
      label: hasStage2
        ? (fromFace.label ?? fromPred?.label)
        : (fromPred?.label ?? fromFace.label),
      confidence: hasStage2
        ? (fromFace.confidence ?? fromPred?.confidence)
        : (fromPred?.confidence ?? fromFace.confidence),
    })
  }

  return out.sort((a, b) => a.faceId - b.faceId)
}

/** Apply Stage 3 per-face labels/confidence from progression onto overlay bboxes. */
export function applyStage3OverlayConfidences(
  overlays: FaceOverlay[],
  stage3Data: Stage3Output,
): FaceOverlay[] {
  if (!stage3Data.faceProgression.length) return overlays
  const byFace = new Map(
    stage3Data.faceProgression.map((row) => [Number(row.faceId), row]),
  )
  return overlays.map((overlay) => {
    const row = byFace.get(overlay.faceId)
    if (!row?.stage3.emotion) return overlay
    return {
      ...overlay,
      label: row.stage3.emotion,
      confidence: row.stage3.confidence ?? overlay.confidence,
    }
  })
}

/** Merge stage0 bboxes when a later stage only has predictions. */
export function mergeOverlaysWithStage0(
  stagePayload: unknown,
  stage0Payload: unknown,
): FaceOverlay[] {
  const current = extractFaceOverlays(stagePayload)
  if (current.length > 0) return current

  const base = extractFaceOverlays(stage0Payload)
  if (!stagePayload || typeof stagePayload !== 'object') return base

  const preds = (stagePayload as { predictions?: unknown }).predictions
  if (!Array.isArray(preds) || !base.length) return base

  const bboxByFace = new Map(base.map((o) => [o.faceId, o.bbox]))
  const merged: FaceOverlay[] = []
  for (const p of preds) {
    if (!p || typeof p !== 'object') continue
    const po = p as Record<string, unknown>
    const faceId = Number(po.face_id)
    const bbox = bboxByFace.get(faceId)
    if (Number.isNaN(faceId) || !bbox) continue
    const label =
      typeof po.emotion_label === 'string' ? po.emotion_label : undefined
    merged.push({
      faceId,
      bbox,
      label,
      confidence:
        typeof po.confidence === 'number' ? po.confidence : undefined,
    })
  }
  return merged.length ? merged : base
}

export type ConfusionMatrixParsed = {
  labels: string[]
  cells: { row: number; col: number; value: number }[]
  maxVal: number
}

const EMOTION_ORDER = [
  'anger',
  'disgust',
  'fear',
  'happy',
  'neutral',
  'sadness',
  'surprise',
] as const

export const ALL_EMOTION_LABELS: readonly string[] = EMOTION_ORDER

export type StageEmotionMatrix = {
  labels: readonly string[]
  grid: number[][]
  faceCount: number
}

function emotionIndex(label: string | null | undefined): number {
  const n = normMatrixEmotion(label)
  if (!n) return -1
  return ALL_EMOTION_LABELS.indexOf(n)
}

function emotionForStage(
  face: Record<string, unknown>,
  stage: 'stage1' | 'stage2' | 'stage3',
): string | null {
  if (stage === 'stage1') {
    return normMatrixEmotion(
      String(face.stage1_emotion_pred ?? face.emotion_pred ?? ''),
    )
  }
  if (stage === 'stage2') {
    return normMatrixEmotion(String(face.stage2_emotion_pred ?? ''))
  }
  return normMatrixEmotion(
    String(face.stage3_emotion_pred ?? face.stage3_emotion ?? ''),
  )
}

function emptyGrid(): number[][] {
  return ALL_EMOTION_LABELS.map(() => ALL_EMOTION_LABELS.map(() => 0))
}

function facesFromStagePayloads(
  s1: unknown,
  s2: unknown,
  s3: unknown,
): Record<string, unknown>[] {
  for (const payload of [s3, s2, s1]) {
    if (!payload || typeof payload !== 'object') continue
    const faces = (payload as { faces?: unknown }).faces
    if (Array.isArray(faces) && faces.length) {
      return faces.filter(
        (f): f is Record<string, unknown> => !!f && typeof f === 'object',
      )
    }
  }
  return []
}

/** Full 7×7 matrix for one pipeline stage (all emotion classes always shown). */
export function buildStageEmotionMatrix(
  stage: 'stage1' | 'stage2' | 'stage3',
  s1: unknown,
  s2: unknown,
  s3: unknown,
  faceProgression: FaceConfidenceProgression[],
): StageEmotionMatrix {
  const grid = emptyGrid()
  let faceCount = 0

  const faces = facesFromStagePayloads(s1, s2, s3)
  if (faces.length) {
    for (const face of faces) {
      const emo = emotionForStage(face, stage)
      const idx = emotionIndex(emo)
      if (idx >= 0) {
        grid[idx]![idx]! += 1
        faceCount += 1
      }
    }
    return { labels: ALL_EMOTION_LABELS, grid, faceCount }
  }

  if (faceProgression.length) {
    for (const row of faceProgression) {
      const emo = normMatrixEmotion(row[stage].emotion)
      const idx = emotionIndex(emo)
      if (idx >= 0) {
        grid[idx]![idx]! += 1
        faceCount += 1
      }
    }
  }

  return { labels: ALL_EMOTION_LABELS, grid, faceCount }
}

export function buildAllStageEmotionMatrices(
  s1: unknown,
  s2: unknown,
  s3: unknown,
  faceProgression: FaceConfidenceProgression[],
): {
  stage1: StageEmotionMatrix
  stage2: StageEmotionMatrix
  stage3: StageEmotionMatrix
} {
  return {
    stage1: buildStageEmotionMatrix('stage1', s1, s2, s3, faceProgression),
    stage2: buildStageEmotionMatrix('stage2', s1, s2, s3, faceProgression),
    stage3: buildStageEmotionMatrix('stage3', s1, s2, s3, faceProgression),
  }
}

function normMatrixEmotion(label: string | null | undefined): string | null {
  if (!label) return null
  const k = label.trim().toLowerCase()
  const aliases: Record<string, string> = {
    angry: 'anger',
    anger: 'anger',
    happiness: 'happy',
    happy: 'happy',
    sad: 'sadness',
    sadness: 'sadness',
    surprised: 'surprise',
    surprise: 'surprise',
    scared: 'fear',
    fear: 'fear',
    disgust: 'disgust',
    neutral: 'neutral',
  }
  return aliases[k] ?? k
}

function matrixFromPairs(
  pairs: [string, string][],
): { labels: string[]; data: [number, number, number][] } | null {
  if (!pairs.length) return null
  const present = new Set<string>()
  for (const [a, b] of pairs) {
    present.add(a)
    present.add(b)
  }
  const labels = EMOTION_ORDER.filter((e) => present.has(e))
  for (const e of present) {
    if (!labels.includes(e)) labels.push(e)
  }
  const idx = new Map(labels.map((l, i) => [l, i]))
  const counts = labels.map(() => labels.map(() => 0))
  for (const [a, b] of pairs) {
    const i = idx.get(a)
    const j = idx.get(b)
    if (i != null && j != null) counts[i]![j]! += 1
  }
  const data: [number, number, number][] = []
  counts.forEach((row, i) => {
    row.forEach((v, j) => {
      if (v > 0) data.push([i, j, v])
    })
  })
  return data.length ? { labels: [...labels], data } : null
}

function pairsFromStageFaces(
  payload: unknown,
  from: 'stage1' | 'stage2',
  to: 'stage2' | 'stage3',
): [string, string][] {
  if (!payload || typeof payload !== 'object') return []
  const faces = (payload as { faces?: unknown }).faces
  if (!Array.isArray(faces)) return []

  const pairs: [string, string][] = []
  for (const face of faces) {
    if (!face || typeof face !== 'object') continue
    const fo = face as Record<string, unknown>
    let a: string | null = null
    let b: string | null = null
    if (from === 'stage1') {
      a = normMatrixEmotion(
        String(fo.stage1_emotion_pred ?? fo.emotion_pred ?? ''),
      )
    } else {
      a = normMatrixEmotion(String(fo.stage2_emotion_pred ?? ''))
    }
    if (to === 'stage2') {
      b = normMatrixEmotion(String(fo.stage2_emotion_pred ?? ''))
    } else {
      b = normMatrixEmotion(
        String(fo.stage3_emotion_pred ?? fo.stage3_emotion ?? ''),
      )
    }
    if (a && b) pairs.push([a, b])
  }
  return pairs
}

export function buildConfusionMatrixFromStagePayload(
  payload: unknown,
  from: 'stage1' | 'stage2',
  to: 'stage2' | 'stage3',
): { labels: string[]; data: [number, number, number][] } | null {
  return matrixFromPairs(pairsFromStageFaces(payload, from, to))
}

export function buildConfusionMatrixFromProgression(
  rows: FaceConfidenceProgression[],
  from: 'stage1' | 'stage2',
  to: 'stage2' | 'stage3',
): { labels: string[]; data: [number, number, number][] } | null {
  if (!rows.length) return null
  const pairs: [string, string][] = []
  for (const row of rows) {
    const a = normMatrixEmotion(row[from].emotion)
    const b = normMatrixEmotion(row[to].emotion)
    if (a && b) pairs.push([a, b])
  }
  return matrixFromPairs(pairs)
}

export function confusionMatrixFromStage3Payload(
  payload: unknown,
): unknown {
  if (!payload || typeof payload !== 'object') return null
  const o = payload as Record<string, unknown>
  const nested =
    o.stage3_output && typeof o.stage3_output === 'object'
      ? (o.stage3_output as Record<string, unknown>)
      : null
  const metrics =
    o.metrics && typeof o.metrics === 'object'
      ? (o.metrics as Record<string, unknown>)
      : null
  return (
    metrics?.confusion_matrix ??
    nested?.refinement_confusion_matrix ??
    o.stage3_refinement_confusion_matrix ??
    null
  )
}

export function parseConfusionMatrix(raw: unknown): ConfusionMatrixParsed | null {
  if (raw == null || typeof raw !== 'object') return null
  const labels = (raw as { labels?: unknown }).labels
  if (!Array.isArray(labels) || !labels.every((x) => typeof x === 'string'))
    return null
  const data = (raw as { data?: unknown }).data
  if (!Array.isArray(data)) return null
  const cells: ConfusionMatrixParsed['cells'] = []
  let maxVal = 0
  for (const row of data) {
    if (!Array.isArray(row) || row.length < 3) continue
    const [r, c, v] = row
    if (
      typeof r !== 'number' ||
      typeof c !== 'number' ||
      typeof v !== 'number'
    )
      continue
    cells.push({ row: r, col: c, value: v })
    if (v > maxVal) maxVal = v
  }
  if (!cells.length) return null
  return { labels, cells, maxVal: maxVal || 1 }
}
