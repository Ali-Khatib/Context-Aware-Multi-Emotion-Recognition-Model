import { useId, useRef, useState } from 'react'
import { ScrollReveal } from './ScrollReveal'
import { OverviewSections } from './OverviewSections'
import { useAnalysis } from '../context/AnalysisContext'
import {
  MAX_UPLOAD_BYTES,
  UPLOAD_DIMENSION_LIMIT_LABEL,
  UPLOAD_SIZE_LIMIT_LABEL,
  prepareImageForUpload,
} from '../utils/prepareUploadImage'

type TabHomeProps = {
  onStartAnalysis: () => void
}

export function TabHome({ onStartAnalysis }: TabHomeProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preparingImage, setPreparingImage] = useState(false)
  const [pickError, setPickError] = useState<string | null>(null)
  const {
    uploadAndStart,
    busy,
    error,
    reset,
    analysisId,
    previewUrl,
    setPreviewFromFile,
  } = useAnalysis()

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-8 pt-10 text-center sm:px-6">
      <ScrollReveal>
        <p className="mb-3 text-sm font-semibold tracking-wide text-fuchsia-300/90 sm:text-base">
          From Individuals to Groups
        </p>
        <h1 className="font-display text-3xl font-extrabold leading-[1.08] tracking-tight sm:text-4xl md:text-5xl lg:text-6xl">
          <span className="text-gradient-hero">
            Context-Aware Multi-Emotion Recognition Model
          </span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-violet-200/80 sm:text-base">
          One group photo runs end to end: live status on Stages, then charts
          and exports on Report.
        </p>
      </ScrollReveal>

      <ScrollReveal className="mx-auto mt-12 w-full max-w-3xl lg:max-w-4xl" delayMs={70}>
        <div className="glass-card glass-card-hover p-8 sm:p-10 lg:p-12">
          <div className="mb-4 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                reset()
                setFile(null)
                setFileName(null)
                setPickError(null)
                setPreviewFromFile(null)
                if (inputRef.current) inputRef.current.value = ''
              }}
              className="rounded-lg border border-purple-500/40 bg-purple-950/40 px-3 py-1.5 text-xs font-semibold text-violet-200 transition hover:border-fuchsia-400/50 hover:bg-purple-900/50"
            >
              Clear session
            </button>
          </div>
          <label
            htmlFor={inputId}
            className="mb-3 block text-left text-base font-semibold text-violet-100 sm:text-lg"
          >
            Choose an image
          </label>
          <div
            className="mb-4 rounded-xl border border-violet-500/35 bg-violet-950/40 px-4 py-3 text-left"
            role="note"
            aria-label="Upload size limits"
          >
            <p className="text-sm font-bold text-violet-100">Upload limits</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-violet-200/90">
              <li>
                <span className="font-semibold text-fuchsia-200/95">
                  {UPLOAD_SIZE_LIMIT_LABEL}
                </span>{' '}
                (hard limit — uploads above this are rejected)
              </li>
              <li>
                <span className="font-semibold text-fuchsia-200/95">
                  {UPLOAD_DIMENSION_LIMIT_LABEL}
                </span>
              </li>
              <li>Formats: PNG or JPEG only</li>
            </ul>
            <p className="mt-2 text-xs text-violet-400/85">
              Larger files are resized automatically before upload when needed.
            </p>
          </div>
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept="image/png,image/jpeg"
            className="w-full rounded-2xl border border-dashed border-purple-400/40 bg-black/30 px-5 py-10 text-base text-violet-200/90 file:mr-4 file:rounded-lg file:border-0 file:bg-purple-600/80 file:px-5 file:py-2.5 file:text-base file:font-semibold file:text-white hover:border-fuchsia-400/50 sm:py-12"
            disabled={busy || preparingImage}
            onChange={async (e) => {
              const raw = e.target.files?.[0] ?? null
              setPickError(null)
              if (!raw) {
                setFile(null)
                setFileName(null)
                setPreviewFromFile(null)
                return
              }
              setPreparingImage(true)
              try {
                const prepared = await prepareImageForUpload(raw)
                setFile(prepared.file)
                setFileName(prepared.file.name)
                setPreviewFromFile(prepared.file)
              } catch (err) {
                setFile(null)
                setFileName(null)
                setPreviewFromFile(null)
                setPickError(
                  err instanceof Error ? err.message : 'Could not prepare image.',
                )
                if (inputRef.current) inputRef.current.value = ''
              } finally {
                setPreparingImage(false)
              }
            }}
          />
          {previewUrl ? (
            <div className="mt-6 overflow-hidden rounded-2xl border border-purple-500/30 bg-black/40">
              <img
                src={previewUrl}
                alt=""
                className="mx-auto max-h-[min(52vh,28rem)] w-full object-contain"
              />
            </div>
          ) : null}
          {preparingImage ? (
            <p className="mt-3 text-left text-sm text-violet-300/90">
              Preparing your image…
            </p>
          ) : null}
          {pickError ? (
            <p className="mt-3 rounded-lg border border-red-500/40 bg-red-950/40 p-3 text-left text-sm text-red-200/95">
              {pickError}
            </p>
          ) : null}
          {fileName ? (
            <p className="mt-3 text-left text-xs text-violet-300/80">
              Selected: {fileName}
              {file ? (
                <>
                  {' '}
                  —{' '}
                  <span
                    className={
                      file.size > MAX_UPLOAD_BYTES
                        ? 'font-semibold text-red-300'
                        : 'text-violet-200/90'
                    }
                  >
                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </span>{' '}
                  <span className="text-violet-500/70">
                    (limit: {MAX_UPLOAD_BYTES / (1024 * 1024)} MB)
                  </span>
                </>
              ) : null}
            </p>
          ) : null}
          {analysisId ? (
            <p className="mt-2 text-left text-xs text-emerald-300/90">
              Run id: {analysisId}
            </p>
          ) : null}
          {error ? (
            <p className="mt-3 rounded-lg border border-red-500/40 bg-red-950/40 p-3 text-left text-xs text-red-200/95">
              {error}
            </p>
          ) : null}
          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:justify-center">
            <button
              type="button"
              disabled={!file || busy || preparingImage}
              onClick={async () => {
                if (!file) return
                try {
                  await uploadAndStart(file)
                  onStartAnalysis()
                } catch {
                  /* error set in context */
                }
              }}
              className="w-full rounded-2xl bg-gradient-to-r from-fuchsia-600 via-violet-600 to-purple-700 px-10 py-4 text-base font-bold text-white shadow-[0_0_32px_-8px_rgba(217,70,239,0.65)] transition duration-300 ease-out hover:-translate-y-0.5 hover:shadow-[0_0_48px_-6px_rgba(192,132,252,0.75)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-400 disabled:opacity-45 sm:w-auto sm:min-w-[280px] sm:text-lg sm:py-5"
            >
              {busy
                ? 'Starting…'
                : preparingImage
                  ? 'Preparing image…'
                  : 'Start full analysis'}
            </button>
          </div>
        </div>
      </ScrollReveal>

      <OverviewSections />
    </div>
  )
}
