import { useCallback, useState } from 'react'
import { AmbientBlobs } from './components/AmbientBlobs'
import { TabHome } from './components/TabHome'
import { TabPipeline } from './components/TabPipeline'
import { TabResults } from './components/TabResults'

type TabId = 'home' | 'pipeline' | 'results'

const TABS: { id: TabId; label: string }[] = [
  { id: 'home', label: 'Start' },
  { id: 'pipeline', label: 'Stages' },
  { id: 'results', label: 'Report' },
]

function App() {
  const [tab, setTab] = useState<TabId>('home')

  const goPipeline = useCallback(() => setTab('pipeline'), [])
  const goStart = useCallback(() => setTab('home'), [])

  return (
    <div className="relative flex min-h-dvh flex-col">
      <AmbientBlobs />

      <header className="sticky top-0 z-20 border-b border-purple-500/20 bg-[#07040f]/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-left">
            <p className="text-xs font-semibold text-fuchsia-300/90 sm:text-sm">
              Bahçeşehir University · Capstone Project
            </p>
            <p className="font-display text-base font-bold leading-snug text-violet-50 sm:text-lg">
              Context-Aware Multi-Emotion Recognition Model
            </p>
          </div>
          <nav
            className="flex flex-wrap gap-2"
            aria-label="Primary"
          >
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition duration-300 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-400 ${
                  tab === t.id
                    ? 'bg-gradient-to-r from-fuchsia-600/90 to-violet-700/90 text-white shadow-[0_0_28px_-8px_rgba(192,132,252,0.7)]'
                    : 'border border-purple-500/35 bg-purple-950/30 text-violet-200/90 hover:-translate-y-0.5 hover:border-fuchsia-400/40 hover:bg-purple-900/40 hover:shadow-[0_12px_40px_-24px_rgba(147,51,234,0.55)]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="relative z-10 flex-1">
        {tab === 'home' ? <TabHome onStartAnalysis={goPipeline} /> : null}
        {tab === 'pipeline' ? <TabPipeline onNewPhoto={goStart} /> : null}
        {tab === 'results' ? <TabResults onNewPhoto={goStart} /> : null}
      </main>

      <footer className="relative z-10 border-t border-purple-500/25 bg-black/50 py-8 text-center text-sm text-violet-300/75 backdrop-blur-md">
        <div className="mx-auto max-w-3xl px-4">
          <p className="font-semibold text-violet-200/90">
            Bahçeşehir University · Capstone Project
          </p>
          <p className="mt-2">
            The browser talks to a local service on your machine; numbers and
            charts are read-only snapshots of each run.
          </p>
          <p className="mt-4 text-xs text-violet-400/70">
            Educational and research use. The analysis service must be running
            for runs to finish successfully.
          </p>
          <p className="mt-6 text-sm text-violet-200/85">
            <span className="font-semibold text-violet-100/95">Ali Khatib</span>
            {' · '}
            <a
              className="text-fuchsia-300/90 underline decoration-fuchsia-500/40 underline-offset-2 transition hover:text-fuchsia-200"
              href="mailto:ali.khatib@bahcesehir.edu.tr"
            >
              ali.khatib@bahcesehir.edu.tr
            </a>
          </p>
          <p className="mt-2 text-sm text-violet-200/85">
            <span className="font-semibold text-violet-100/95">
              Kareem Hijazi
            </span>
            {' · '}
            <a
              className="text-fuchsia-300/90 underline decoration-fuchsia-500/40 underline-offset-2 transition hover:text-fuchsia-200"
              href="mailto:kareem.hijazi@bahcesehir.edu.tr"
            >
              kareem.hijazi@bahcesehir.edu.tr
            </a>
          </p>
        </div>
      </footer>
    </div>
  )
}

export default App
