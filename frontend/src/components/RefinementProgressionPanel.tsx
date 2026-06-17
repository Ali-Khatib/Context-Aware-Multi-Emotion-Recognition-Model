import type { RefinementProgression } from '../utils/payloadAnalysis'

type RefinementProgressionPanelProps = {
  data: RefinementProgression
  variant?: 'compact' | 'hero' | 'summary'
}

export function RefinementProgressionPanel({
  data,
  variant = 'hero',
}: RefinementProgressionPanelProps) {
  if (!data.steps.length) {
    return (
      <p className="text-xs text-violet-400/80">
        Run a full analysis to see how the group emotion changed across stages.
      </p>
    )
  }

  const hero = variant === 'hero'
  const summary = variant === 'summary'

  return (
    <div className="space-y-4">
      {!summary ? (
        <div>
          <p
            className={`font-bold uppercase tracking-widest text-fuchsia-300/90 ${
              hero ? 'text-xs' : 'text-[10px]'
            }`}
          >
            Group emotion — Stage 1 → 2 → 3
          </p>
          {data.stage3Live ? (
            <p
              className={`mt-1 text-violet-300/85 ${
                hero ? 'text-sm' : 'text-xs'
              }`}
            >
              How the group read evolved; Stage 3 is the final call for this photo.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-[10px] font-bold uppercase tracking-widest text-violet-400/90">
          Group read by stage
        </p>
      )}

      <div
        className={`grid gap-3 ${
          hero || summary ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1'
        }`}
      >
        {data.steps.map((step, idx) => {
          const isFinal = step.isFinal ?? step.key === 'stage3'
          const prev = idx > 0 ? data.steps[idx - 1] : null
          const emotionChanged =
            prev?.emotion &&
            step.emotion &&
            prev.emotion.toLowerCase() !== step.emotion.toLowerCase()

          return (
            <div
              key={step.key}
              className={`relative rounded-xl border px-3 py-3 ${
                isFinal && !summary
                  ? 'border-fuchsia-400/50 bg-fuchsia-950/40 ring-1 ring-fuchsia-400/25'
                  : isFinal && summary
                    ? 'border-fuchsia-400/40 bg-fuchsia-950/30'
                    : 'border-purple-500/30 bg-violet-950/35'
              }`}
            >
              {idx > 0 && (hero || summary) ? (
                <span
                  className="absolute -left-2 top-1/2 hidden -translate-y-1/2 text-fuchsia-300/60 sm:block"
                  aria-hidden
                >
                  →
                </span>
              ) : null}
              <p className="text-[10px] font-bold uppercase tracking-widest text-violet-400/90">
                {summary
                  ? step.key === 'stage1'
                    ? 'Stage 1'
                    : step.key === 'stage2'
                      ? 'Stage 2'
                      : 'Stage 3'
                  : step.title}
              </p>
              {!summary ? (
                <>
                  <p className="text-[11px] text-violet-500/85">{step.subtitle}</p>
                  {step.key === 'stage2' ? (
                    <p className="text-[9px] text-violet-500/70">
                      Avg includes Stage 1 agreement + correction lift
                    </p>
                  ) : null}
                </>
              ) : null}
              <p
                className={`mt-2 font-display font-bold capitalize text-white ${
                  hero || summary ? 'text-xl' : 'text-lg'
                }`}
              >
                {step.emotion ?? '—'}
              </p>
              {step.confidence != null ? (
                <p
                  className={`mt-1 font-mono font-semibold ${
                    summary || isFinal
                      ? 'text-emerald-400'
                      : 'text-violet-200/90'
                  } ${hero || summary ? 'text-sm' : 'text-xs'}`}
                >
                  {(step.confidence * 100).toFixed(0)}% avg confidence
                </p>
              ) : null}
              {!summary && emotionChanged ? (
                <p className="mt-1 text-[10px] text-amber-200/90">
                  Changed from {prev?.emotion}
                </p>
              ) : null}
              {!summary && !emotionChanged && prev?.emotion && step.emotion ? (
                <p className="mt-1 text-[10px] text-violet-400/75">
                  Same as{' '}
                  {prev.emotion === step.emotion ? 'previous stage' : prev.emotion}
                </p>
              ) : null}
              {summary && emotionChanged ? (
                <p className="mt-1 text-[10px] text-amber-200/90">
                  was {prev?.emotion}
                </p>
              ) : null}
              {isFinal && !summary ? (
                <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-emerald-300/95">
                  Final group emotion
                </p>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
