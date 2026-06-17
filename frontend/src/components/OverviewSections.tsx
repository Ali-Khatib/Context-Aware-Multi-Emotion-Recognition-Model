import { ScrollReveal } from './ScrollReveal'

export function OverviewSections() {
  return (
    <div className="mx-auto mt-16 max-w-3xl space-y-10 pb-10 text-left">
      <ScrollReveal>
        <section className="glass-card p-6 sm:p-8">
          <h3 className="font-display text-lg font-bold text-fuchsia-100/95">
            At a glance
          </h3>
          <ul className="mt-4 list-disc space-y-2.5 pl-5 text-sm leading-relaxed text-violet-100/88 marker:text-fuchsia-400/90">
            <li>
              Face detection, then three refinement passes, with the Stages tab
              updating as each step completes.
            </li>
            <li>
              The Report tab brings together dominant emotion, confidence by
              pass, prediction tables, and a confusion matrix when your run
              includes one.
            </li>
            <li>
              You can download an HTML snapshot report or a CSV of the stage
              table for coursework, demos, or your own archive.
            </li>
          </ul>
        </section>
      </ScrollReveal>

      <ScrollReveal delayMs={50}>
        <section className="glass-card p-6 sm:p-8">
          <h3 className="font-display text-lg font-bold text-fuchsia-100/95">
            What to expect
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-violet-100/85">
            After you choose a PNG or JPEG and start the run, the server
            orchestrates each pass in order. Small images usually move quickly;
            larger files or busy hardware can stretch the wait a bit. The full
            pipeline typically finishes within a few minutes, and you can
            watch status move from upload through the final metrics without
            refreshing the page.
          </p>
        </section>
      </ScrollReveal>

      <ScrollReveal delayMs={100}>
        <section className="glass-card p-6 sm:p-8">
          <h3 className="font-display text-lg font-bold text-fuchsia-100/95">
            Who it is for
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-violet-100/85">
            Students, instructors, and researchers who want a clear, repeatable
            walkthrough of group-level emotion cues. It is meant for
            interactive lab sessions and capstone demos: you bring a portrait,
            run the pipeline once, and discuss the staged outputs and numbers
            together.
          </p>
        </section>
      </ScrollReveal>

      <ScrollReveal delayMs={150}>
        <section className="glass-card p-6 sm:p-8">
          <h3 className="font-display text-lg font-bold text-fuchsia-100/95">
            Safety and Limits
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-violet-100/85">
            Use this tool for learning and research contexts, not for
            surveillance, enforcement, or automated decisions about people. Treat
            portraits respectfully, especially on shared lab machines, and
            follow your institution's rules for handling photos. The UI
            shows read-only snapshots: you cannot rewrite model scores or labels
            inside the app, which keeps the record aligned with what the
            pipeline actually produced.
          </p>
        </section>
      </ScrollReveal>

      <ScrollReveal delayMs={200}>
        <section className="glass-card p-6 sm:p-8">
          <h3 className="font-display text-lg font-bold text-fuchsia-100/95">
            Viewing the outputs
          </h3>
          <ul className="mt-4 list-disc space-y-2.5 pl-5 text-sm leading-relaxed text-violet-100/88 marker:text-fuchsia-400/90">
            <li>
              <span className="text-violet-100/95">Stages</span> shows the
              original preview, face count after detection, and average
              confidence where predictions exist—use it to narrate how the
              image moves through the pipeline.
            </li>
            <li>
              <span className="text-violet-100/95">Report</span> aggregates the
              final-pass labels, per-stage confidence bars, and stored accuracy
              rows so you can compare passes side by side.
            </li>
            <li>
              Exports bundle the same high-signal fields into files you can hand
              in with your write-up or slide deck.
            </li>
          </ul>
        </section>
      </ScrollReveal>
    </div>
  )
}
