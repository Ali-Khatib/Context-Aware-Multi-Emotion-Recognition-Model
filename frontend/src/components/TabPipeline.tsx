import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ScrollReveal } from './ScrollReveal'
import { FaceOverlayImage } from './FaceOverlayImage'
import { ZoomableImage } from './ZoomableImage'
import { NewPhotoButton } from './TryAgainButton'
import { exportCsvUrl } from '../api/client'
import { useAnalysis } from '../context/AnalysisContext'
import {
  STAGE_REVEAL_STAGGER_MS,
  useStaggeredStageReveal,
} from '../hooks/useStaggeredStageReveal'
import { downloadAnalysisReport } from '../utils/downloadReport'
import {
  avgPredictionConfidence,
  countFaces,
  extractFaceOverlays,
  mergeOverlaysWithStage0,
  applyStage3OverlayConfidences,
  countStage2Refined,
  pipelineFinalFromStages,
  stage2GroupDominant,
  stage3FromPayload,
  stagePayload,
} from '../utils/payloadAnalysis'

const STAGE3_COMING_SOON = false
const PIPELINE_INCLUDES_STAGE3 = !STAGE3_COMING_SOON

function FinalStageChain() {
  if (!PIPELINE_INCLUDES_STAGE3) {
    return (
      <span className="inline-flex flex-wrap items-center justify-center gap-x-1 gap-y-0.5 font-medium text-violet-200">
        <span>Stage 0</span>
        <span className="text-fuchsia-400" aria-hidden>
          →
        </span>
        <span>1</span>
        <span className="text-fuchsia-400" aria-hidden>
          →
        </span>
        <span>2</span>
      </span>
    )
  }
  return (
    <span className="inline-flex flex-wrap items-center justify-center gap-x-1 gap-y-0.5 font-medium text-violet-200">
      <span>Stage 0</span>
      <span className="text-fuchsia-400" aria-hidden>
        →
      </span>
      <span>1</span>
      <span className="text-fuchsia-400" aria-hidden>
        →
      </span>
      <span>2</span>
      <span className="text-fuchsia-400" aria-hidden>
        →
      </span>
      <span className="text-fuchsia-200">3</span>
    </span>
  )
}

const NODES: {
  key: string
  label: string
  subtitle: string
  stageName: string | null
  comingSoon?: boolean
}[] = [
  { key: 'orig', label: 'Original', subtitle: 'Uploaded photo', stageName: null },
  {
    key: 's0',
    label: 'Detection',
    subtitle: 'Face detection',
    stageName: 'stage0',
  },
  {
    key: 's1',
    label: 'Stage 1',
    subtitle: 'Per-face emotions',
    stageName: 'stage1',
  },
  {
    key: 's2',
    label: 'Stage 2',
    subtitle: 'Group refinement',
    stageName: 'stage2',
  },
  {
    key: 's3',
    label: 'Stage 3',
    subtitle: 'Final multimodal refinement',
    stageName: STAGE3_COMING_SOON ? null : 'stage3',
    comingSoon: STAGE3_COMING_SOON,
  },
]

function stepReady(
  node: { stageName: string | null; comingSoon?: boolean },
  previewUrl: string | null,
  stages: { stageName: string }[],
  status: string | undefined,
): boolean {
  if (node.comingSoon) {
    return (
      status === 'COMPLETED' ||
      status === 'FAILED' ||
      stages.some((s) => s.stageName === 'stage2')
    )
  }
  if (node.stageName == null) return Boolean(previewUrl)
  return stages.some((s) => s.stageName === node.stageName)
}

function StageCard({
  children,
  revealed,
  className = '',
}: {
  children: ReactNode
  revealed: boolean
  className?: string
}) {
  return (
    <div
      className={`glass-card flex min-h-[420px] min-w-0 flex-col overflow-visible p-4 stage-panel ${
        revealed ? 'stage-panel--visible' : 'stage-panel--waiting'
      } ${className}`}
    >
      {children}
    </div>
  )
}

type TabPipelineProps = {
  onNewPhoto: () => void
}

export function TabPipeline({ onNewPhoto }: TabPipelineProps) {
  const {
    analysisId,
    status,
    stages,
    error,
    previewUrl,
    metrics,
    reportFileName,
    reloadArtifacts,
  } = useAnalysis()

  const stage0Payload = useMemo(
    () => stagePayload(stages, 'stage0'),
    [stages],
  )
  const stage1Payload = useMemo(
    () => stagePayload(stages, 'stage1'),
    [stages],
  )
  const stage2Payload = useMemo(
    () => stagePayload(stages, 'stage2'),
    [stages],
  )
  const stage3Payload = useMemo(
    () => stagePayload(stages, 'stage3'),
    [stages],
  )
  const stage3Data = useMemo(
    () => stage3FromPayload(stage3Payload),
    [stage3Payload],
  )
  const finalOverlays = useMemo(() => {
    const source = stage3Payload ?? stage2Payload
    if (!source) return []
    const base = mergeOverlaysWithStage0(source, stage0Payload)
    return applyStage3OverlayConfidences(base, stage3Data)
  }, [stage3Payload, stage2Payload, stage0Payload, stage3Data])
  const terminal =
    status?.status === 'COMPLETED' || status?.status === 'FAILED'

  const pipelineFinal = useMemo(
    () => pipelineFinalFromStages(stages),
    [stages],
  )
  const hasStage3 = stages.some((s) => s.stageName === 'stage3')
  const finalReady =
    terminal &&
    (hasStage3 || stages.some((s) => s.stageName === 'stage2'))

  useEffect(() => {
    if (!analysisId) return
    void reloadArtifacts()
  }, [analysisId, reloadArtifacts])

  const maxReadyIndex = useMemo(() => {
    let max = -1
    for (let i = 0; i < NODES.length; i++) {
      if (stepReady(NODES[i], previewUrl, stages, status?.status)) max = i
    }
    return max
  }, [previewUrl, stages, status?.status])

  const revealedThrough = useStaggeredStageReveal(analysisId, maxReadyIndex)

  const [finalRevealed, setFinalRevealed] = useState(false)
  useEffect(() => {
    setFinalRevealed(false)
  }, [analysisId])
  useEffect(() => {
    if (!analysisId || !finalReady) return
    if (revealedThrough < NODES.length - 1) return
    let cancelled = false
    const t = window.setTimeout(() => {
      if (!cancelled) setFinalRevealed(true)
    }, STAGE_REVEAL_STAGGER_MS)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [analysisId, finalReady, revealedThrough])

  const showFinalContent =
    finalReady && Boolean(previewUrl) && finalRevealed

  const exportReport = () => {
    if (!analysisId) return
    downloadAnalysisReport({
      analysisId,
      status,
      stages,
      metrics,
      fileLabel: reportFileName,
    })
  }

  return (
    <div className="mx-auto w-full max-w-[1920px] px-2 pb-24 pt-8 sm:px-4">
      <ScrollReveal className="mb-8 text-center">
        <h2 className="font-display text-3xl font-bold text-violet-50 sm:text-4xl">
          Pipeline stages
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-violet-200/70">
          Stages 0–2 refine per-face and group signals; Stage 3 reads the whole
          scene with a vision model and has the final say.
        </p>
      </ScrollReveal>

      {!analysisId ? (
        <ScrollReveal>
          <p className="rounded-xl border border-amber-500/30 bg-amber-950/25 p-4 text-center text-sm text-amber-100/90">
            Start on the Start tab: upload a photo and run analysis.
          </p>
        </ScrollReveal>
      ) : (
        <>
          <ScrollReveal className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="glass-card px-4 py-3 text-left">
              <p className="text-xs uppercase tracking-wider text-fuchsia-300/80">
                Status
              </p>
              <p className="text-lg font-bold text-fuchsia-100">
                {status?.status ?? '…'}
              </p>
              {error || status?.errorMessage ? (
                <p className="mt-1 max-w-md text-xs text-red-300/95">
                  {error ?? status?.errorMessage}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <NewPhotoButton onGoToStart={onNewPhoto} />
              <button
                type="button"
                disabled={!terminal}
                onClick={exportReport}
                className="rounded-xl border border-fuchsia-500/50 bg-gradient-to-r from-fuchsia-700/80 to-violet-800/80 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
              >
                Download report (HTML)
              </button>
              {terminal ? (
                <a
                  href={exportCsvUrl(analysisId)}
                  download
                  className="rounded-xl border border-purple-500/45 bg-purple-950/50 px-4 py-2 text-sm font-semibold text-violet-100"
                >
                  CSV
                </a>
              ) : null}
            </div>
          </ScrollReveal>

          {/* All 5 steps in one row on large screens — no sideways scroll */}
          <div className="grid grid-cols-1 gap-4 min-[900px]:grid-cols-3 min-[1400px]:grid-cols-5">
            {NODES.map((node, idx) => {
              const ready = stepReady(
                node,
                previewUrl,
                stages,
                status?.status,
              )
              const revealed = idx <= revealedThrough
              const showContent = ready && revealed

              if (node.comingSoon) {
                return (
                  <StageCard
                    key={node.key}
                    revealed={revealed}
                    className="border border-dashed border-violet-500/40 bg-violet-950/25"
                  >
                    <p className="text-[10px] font-bold uppercase tracking-widest text-violet-400/90">
                      Step {idx}
                    </p>
                    <p className="mt-1 font-display text-lg font-bold text-violet-300/90">
                      {node.label}
                    </p>
                    <p className="text-xs text-violet-500/85">{node.subtitle}</p>
                    <p className="mt-auto rounded-xl border border-amber-500/35 bg-amber-950/30 py-10 text-center text-sm text-amber-100/90">
                      Coming soon
                    </p>
                  </StageCard>
                )
              }

              const payload = node.stageName
                ? stagePayload(stages, node.stageName)
                : null
              const isStage3 = node.stageName === 'stage3'
              const overlaySource =
                node.stageName === 'stage1'
                  ? stage1Payload ?? payload
                  : isStage3
                    ? stage3Payload ?? stage2Payload ?? payload
                    : payload
              const overlaysRaw =
                overlaySource && node.stageName != null
                  ? node.stageName === 'stage0'
                    ? extractFaceOverlays(overlaySource)
                    : mergeOverlaysWithStage0(overlaySource, stage0Payload)
                  : []
              const overlays =
                isStage3 &&
                (stage3Data.live || stage3Data.faceProgression.length > 0)
                  ? applyStage3OverlayConfidences(overlaysRaw, stage3Data)
                  : overlaysRaw
              const showOverlay =
                Boolean(previewUrl) &&
                node.stageName != null &&
                showContent &&
                (node.stageName === 'stage0' || overlays.length > 0)
              const faces =
                node.stageName === 'stage0' && payload
                  ? countFaces(payload)
                  : null
              const avg =
                node.stageName && payload && node.stageName !== 'stage0'
                  ? avgPredictionConfidence(payload)
                  : null
              const groupDom =
                node.stageName === 'stage2' && payload
                  ? stage2GroupDominant(payload)
                  : null
              const refinedCount =
                node.stageName === 'stage2' && payload
                  ? countStage2Refined(payload)
                  : null
              const zoomFooter =
                faces != null ||
                groupDom != null ||
                refinedCount != null ||
                avg != null ? (
                  <div className="flex flex-wrap justify-center gap-x-6 gap-y-1 text-center">
                    {faces != null ? (
                      <span>
                        Faces: <strong className="text-white">{faces}</strong>
                      </span>
                    ) : null}
                    {groupDom != null ? (
                      <span>
                        Group mood:{' '}
                        <strong className="capitalize text-white">{groupDom}</strong>
                      </span>
                    ) : null}
                    {refinedCount != null ? (
                      <span>
                        Faces updated:{' '}
                        <strong className="text-white">{refinedCount}</strong>
                      </span>
                    ) : null}
                    {avg != null && node.stageName === 'stage1' ? (
                      <span>
                        Avg conf.:{' '}
                        <strong className="font-mono text-white">
                          {avg.toFixed(3)}
                        </strong>
                      </span>
                    ) : null}
                  </div>
                ) : undefined

              return (
                <StageCard key={node.key} revealed={revealed}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-violet-400/90">
                    Step {idx}
                  </p>
                  <p className="mt-1 font-display text-lg font-bold leading-tight text-fuchsia-100">
                    {node.label}
                  </p>
                  <p className="text-xs text-violet-400/80">{node.subtitle}</p>

                  <div className="relative mt-3 min-h-[240px] flex-1">
                    {previewUrl && node.stageName == null && showContent ? (
                      <ZoomableImage
                        src={previewUrl}
                        title="Original — Uploaded photo"
                        className="flex h-full min-h-[240px] items-center justify-center rounded-2xl border border-purple-500/25 bg-black/50 p-1"
                        imgClassName="max-h-[220px] w-full object-contain"
                      />
                    ) : null}

                    {isStage3 && previewUrl && showContent && !showOverlay ? (
                      <p className="flex h-full min-h-[200px] items-center justify-center text-center text-xs text-violet-400/80">
                        No faces detected
                      </p>
                    ) : null}

                    {showOverlay && previewUrl ? (
                      <FaceOverlayImage
                        imageUrl={previewUrl}
                        overlays={overlays}
                        showLabels={node.stageName !== 'stage0'}
                        showConfidence={node.stageName !== 'stage0'}
                        className="h-full min-h-[240px] w-full"
                        zoomable
                        zoomTitle={`${node.label} — ${node.subtitle}`}
                        zoomFooter={zoomFooter}
                      />
                    ) : null}

                    {node.stageName != null &&
                    showContent &&
                    !showOverlay &&
                    !isStage3 &&
                    previewUrl ? (
                      <p className="flex h-full items-center justify-center text-center text-xs text-violet-400/80">
                        No faces detected
                      </p>
                    ) : null}

                    {!showContent ? (
                      <p className="flex h-full min-h-[200px] items-center justify-center text-sm text-violet-500/80">
                        {ready && !revealed ? 'Preparing view…' : 'Waiting…'}
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-3 space-y-1 border-t border-purple-500/20 pt-2 text-xs sm:text-sm">
                    {faces != null ? (
                      <p className="text-violet-200/90">
                        Faces{' '}
                        <span className="font-bold text-white">{faces}</span>
                      </p>
                    ) : null}
                    {groupDom != null ? (
                      <p className="text-violet-200/90">
                        Group mood{' '}
                        <span className="font-bold capitalize text-white">
                          {groupDom}
                        </span>
                      </p>
                    ) : null}
                    {refinedCount != null ? (
                      <p className="text-violet-200/90">
                        Faces updated{' '}
                        <span className="font-bold text-white">{refinedCount}</span>
                      </p>
                    ) : null}
                    {avg != null && node.stageName === 'stage1' ? (
                      <p className="text-violet-200/90">
                        Avg conf.{' '}
                        <span className="font-bold text-white">
                          {avg.toFixed(3)}
                        </span>
                      </p>
                    ) : null}
                    <p
                      className={`font-semibold ${
                        showContent
                          ? 'text-emerald-300/90'
                          : ready
                            ? 'text-amber-300/80'
                            : 'text-violet-500/70'
                      }`}
                    >
                      {showContent ? 'Ready' : ready ? 'Queued' : 'Pending'}
                    </p>
                  </div>
                </StageCard>
              )
            })}
          </div>

          <section
            className={`glass-card mx-auto mt-10 max-w-4xl overflow-hidden p-0 stage-panel ${
              showFinalContent
                ? 'stage-panel--visible'
                : 'stage-panel--waiting'
            }`}
          >
              <div className="border-b border-purple-500/25 bg-violet-950/40 px-5 py-3 text-center">
                <p className="text-xs font-bold uppercase tracking-widest text-fuchsia-300/90">
                  Final result
                </p>
                <p className="mt-1 text-sm text-violet-300/80">
                  {stage3Data.live ? (
                    <>
                      <FinalStageChain />
                      <span className="mt-1 block text-fuchsia-200/95">
                        Stage 3 multimodal refinement — final verdict
                      </span>
                    </>
                  ) : (
                    <>
                      After <FinalStageChain /> group refinement
                    </>
                  )}
                </p>
              </div>
              {showFinalContent ? (
                <>
                  <div className="bg-black/55 p-4">
                    {finalOverlays.length > 0 && previewUrl ? (
                      <FaceOverlayImage
                        imageUrl={previewUrl}
                        overlays={finalOverlays}
                        showLabels
                        showConfidence
                        className="min-h-[min(50vh,22rem)] w-full"
                        zoomable
                        zoomTitle={
                          PIPELINE_INCLUDES_STAGE3
                            ? 'Final result — Stage 0 → 1 → 2 → 3'
                            : 'Final result — Stage 2 refinement'
                        }
                        zoomClassName="min-h-[min(82vh,720px)] w-full"
                        zoomFooter={
                          stage3Data.groupEmotionRationale ||
                          pipelineFinal.emotion ? (
                            <div className="space-y-3 text-center">
                              {pipelineFinal.emotion ? (
                                <p className="font-display text-2xl font-bold capitalize text-fuchsia-100 sm:text-3xl">
                                  {pipelineFinal.emotion}
                                </p>
                              ) : null}
                              {stage3Data.groupEmotionRationale ? (
                                <p className="text-left text-sm leading-relaxed text-violet-100/95">
                                  {stage3Data.groupEmotionRationale}
                                </p>
                              ) : null}
                            </div>
                          ) : undefined
                        }
                      />
                    ) : previewUrl ? (
                      <ZoomableImage
                        src={previewUrl}
                        title="Final result"
                        className="flex justify-center"
                        imgClassName="max-h-[min(50vh,22rem)] w-full object-contain"
                        footer={
                          pipelineFinal.emotion ? (
                            <p className="text-center font-display text-xl font-bold capitalize text-fuchsia-100">
                              {pipelineFinal.emotion}
                            </p>
                          ) : undefined
                        }
                      />
                    ) : null}
                  </div>
                  {(stage3Data.groupEmotionRationale || pipelineFinal.emotion) && (
                    <div className="border-t border-purple-500/25 px-5 py-4">
                      {pipelineFinal.emotion ? (
                        <p className="text-center font-display text-2xl font-bold capitalize text-fuchsia-100 sm:text-3xl">
                          {pipelineFinal.emotion}
                        </p>
                      ) : null}
                      {stage3Data.groupEmotionRationale ? (
                        <p className="mt-3 text-sm leading-relaxed text-violet-100/90">
                          {stage3Data.groupEmotionRationale}
                        </p>
                      ) : null}
                      <p className="mt-3 text-center text-[11px] text-violet-500/80">
                        Face table, confidence breakdown, and confusion matrix
                        are on the Results tab.
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <p className="px-5 py-12 text-center text-sm text-violet-500/80">
                  {terminal && finalReady
                    ? 'Final result unavailable for this run.'
                    : 'Final image and caption appear after all stages finish.'}
                </p>
              )}
          </section>
        </>
      )}
    </div>
  )
}
