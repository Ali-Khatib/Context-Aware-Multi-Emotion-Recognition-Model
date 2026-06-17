import { useMemo } from 'react'
import { exportCsvUrl } from '../api/client'
import { useAnalysis } from '../context/AnalysisContext'
import { ScrollReveal } from './ScrollReveal'
import { NewPhotoButton } from './TryAgainButton'
import { StageConfusionMatrix } from './StageConfusionMatrix'
import {
  ConfidenceBarChart,
  StageEmotionPieChart,
} from './ResultsCharts'
import { downloadAnalysisReport } from '../utils/downloadReport'
import { RefinementProgressionPanel } from './RefinementProgressionPanel'
import { Stage3RefinementPanel } from './Stage3RefinementPanel'
import {
  buildAllStageEmotionMatrices,
  dominantEmotionFromPayload,
  pipelineFinalFromStages,
  refinementProgressionFromStages,
  stage2GroupDominant,
  stage3FromPayload,
  stagePayload,
  stageConfidenceBars,
  stageEmotionDistributions,
} from '../utils/payloadAnalysis'

type TabResultsProps = {
  onNewPhoto: () => void
}

export function TabResults({ onNewPhoto }: TabResultsProps) {
  const {
    analysisId,
    status,
    stages,
    metrics,
    reportFileName,
  } = useAnalysis()

  const terminal =
    status?.status === 'COMPLETED' || status?.status === 'FAILED'

  const s1 = stagePayload(stages, 'stage1')
  const s2 = stagePayload(stages, 'stage2')
  const s3 = stagePayload(stages, 'stage3')
  const stage3Data = stage3FromPayload(s3)
  const pipelineFinal = pipelineFinalFromStages(stages)
  const refinementProgression = refinementProgressionFromStages(stages)
  const dominant =
    pipelineFinal.emotion ??
    stage2GroupDominant(s2) ??
    dominantEmotionFromPayload(s3 ?? s2 ?? s1)

  const confidenceBars = useMemo(
    () => stageConfidenceBars(refinementProgression, stage3Data),
    [refinementProgression, stage3Data],
  )

  const pieByStage = useMemo(
    () => stageEmotionDistributions(stage3Data, s1, s2, s3),
    [stage3Data, s1, s2, s3],
  )

  const stageMatrices = useMemo(
    () =>
      buildAllStageEmotionMatrices(
        s1,
        s2,
        s3,
        stage3Data.faceProgression,
      ),
    [s1, s2, s3, stage3Data.faceProgression],
  )

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
    <div className="mx-auto max-w-4xl px-4 pb-28 pt-8">
      <ScrollReveal className="mb-10 text-center">
        <h2 className="font-display text-3xl font-bold text-violet-50 sm:text-4xl">
          Results
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-violet-200/70 sm:text-base">
          Summary once, then one chart type each: matrices, pies, confidence.
        </p>
      </ScrollReveal>

      {!analysisId ? (
        <ScrollReveal>
          <p className="rounded-xl border border-violet-500/30 bg-violet-950/20 p-4 text-center text-sm text-violet-200/85">
            When a run exists, this tab fills automatically. Start from the
            Start tab.
          </p>
        </ScrollReveal>
      ) : (
        <>
          <ScrollReveal className="mb-6 flex flex-wrap justify-center gap-3">
            <NewPhotoButton onGoToStart={onNewPhoto} />
            <button
              type="button"
              disabled={!terminal}
              onClick={exportReport}
              className="rounded-xl border border-fuchsia-500/50 bg-gradient-to-r from-fuchsia-700/80 to-violet-800/80 px-5 py-2.5 text-sm font-bold text-white shadow-[0_0_28px_-10px_rgba(217,70,239,0.65)] transition hover:-translate-y-0.5 disabled:opacity-40"
            >
              Download full report (HTML)
            </button>
            {terminal ? (
              <a
                href={exportCsvUrl(analysisId)}
                download
                className="inline-flex items-center rounded-xl border border-purple-500/45 bg-purple-950/50 px-5 py-2.5 text-sm font-semibold text-violet-100 transition hover:border-fuchsia-400/50 hover:bg-purple-900/55"
              >
                Download table (CSV)
              </a>
            ) : (
              <span className="inline-flex items-center rounded-xl border border-purple-500/25 px-5 py-2.5 text-sm text-violet-500/80">
                Table export unlocks when the run finishes
              </span>
            )}
          </ScrollReveal>

          <ScrollReveal className="mb-8" delayMs={20}>
            <section className="glass-card border border-fuchsia-500/25 p-6 sm:p-8 space-y-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-fuchsia-300/90">
                  Final group emotion
                </p>
                <p className="mt-3 font-display text-4xl font-extrabold capitalize text-transparent bg-gradient-to-r from-fuchsia-200 to-violet-200 bg-clip-text sm:text-5xl">
                  {dominant ?? '—'}
                </p>
              </div>

              {refinementProgression.steps.length > 0 ? (
                <RefinementProgressionPanel
                  data={refinementProgression}
                  variant="summary"
                />
              ) : null}

              {stage3Data.groupEmotionRationale ? (
                <div className="rounded-xl border border-fuchsia-500/30 bg-fuchsia-950/25 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-fuchsia-300/80">
                    Why this photo
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-violet-50/95">
                    {stage3Data.groupEmotionRationale}
                  </p>
                </div>
              ) : null}
              {stage3Data.error ? (
                <p className="rounded-lg border border-red-500/35 bg-red-950/30 px-3 py-2 text-sm text-red-200/95">
                  Stage 3 fusion note: {stage3Data.error}
                </p>
              ) : null}
            </section>
          </ScrollReveal>

          {(stage3Data.live || stage3Data.faceProgression.length > 0) && (
            <ScrollReveal className="mb-8" delayMs={40}>
              <section className="glass-card p-6 sm:p-8">
                <h3 className="font-display text-lg font-bold text-fuchsia-100/95">
                  Per-face by stage
                </h3>
                <p className="mt-1 text-xs text-violet-400/80">
                  Each face — emotion and confidence at Stage 1, 2, and 3.
                </p>
                <div className="mt-4">
                  <Stage3RefinementPanel
                    data={stage3Data}
                    variant="table"
                  />
                </div>
              </section>
            </ScrollReveal>
          )}

          {/* 1 — One 7×7 matrix per stage */}
          <section className="glass-card mb-8 p-6 sm:p-8">
            <h3 className="font-display text-lg font-bold text-fuchsia-100/95">
              Confusion matrices — one per stage
            </h3>
            <p className="mt-1 text-xs text-violet-400/80">
              Stage 1, Stage 2, and Stage 3 each get a full 7×7 table (all
              emotions). Green = face counts.
            </p>
            <div className="mt-8 space-y-8">
              <StageConfusionMatrix
                title="Stage 1"
                stageNumber={1}
                matrix={stageMatrices.stage1}
              />
              <StageConfusionMatrix
                title="Stage 2"
                stageNumber={2}
                matrix={stageMatrices.stage2}
              />
              <StageConfusionMatrix
                title="Stage 3"
                stageNumber={3}
                matrix={stageMatrices.stage3}
              />
            </div>
          </section>

          {/* 2 — Pie chart per stage */}
          <section className="glass-card mb-8 p-6 sm:p-8">
            <h3 className="font-display text-lg font-bold text-fuchsia-100/95">
              Emotion mix by stage
            </h3>
            <p className="mt-1 text-xs text-violet-400/80">
              Pie chart of per-face emotion labels at each pass.
            </p>
            <div className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              <StageEmotionPieChart
                title="Stage 1"
                subtitle="Per-face read"
                slices={pieByStage.stage1}
              />
              <StageEmotionPieChart
                title="Stage 2"
                subtitle="After group refinement"
                slices={pieByStage.stage2}
              />
              <StageEmotionPieChart
                title="Stage 3"
                subtitle="Final multimodal"
                slices={pieByStage.stage3}
              />
            </div>
          </section>

          {/* 3 — Bar chart last */}
          <section className="glass-card p-6 sm:p-8">
            <h3 className="font-display text-lg font-bold text-fuchsia-100/95">
              Average confidence by stage
            </h3>
            <p className="mt-1 text-xs text-violet-400/80">
              Vertical bar chart — Y = confidence %, X = pipeline pass.
            </p>
            <div className="mt-6 rounded-xl border border-purple-500/30 bg-violet-950/30 p-5">
              <ConfidenceBarChart bars={confidenceBars} />
            </div>
          </section>
        </>
      )}
    </div>
  )
}
