import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import * as api from '../api/client'
import type { AnalysisStatusDto, MetricsDto, StageDto } from '../api/types'
import { prepareImageForUpload } from '../utils/prepareUploadImage'

type AnalysisContextValue = {
  imageId: string | null
  imagePath: string | null
  analysisId: string | null
  status: AnalysisStatusDto | null
  stages: StageDto[]
  metrics: MetricsDto[]
  fullResults: Record<string, unknown> | null
  busy: boolean
  error: string | null
  previewUrl: string | null
  reportFileName: string | null
  reset: () => void
  setPreviewFromFile: (file: File | null) => void
  uploadAndStart: (file: File) => Promise<void>
  reloadArtifacts: () => Promise<void>
}

const AnalysisContext = createContext<AnalysisContextValue | null>(null)

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const [imageId, setImageId] = useState<string | null>(null)
  const [imagePath, setImagePath] = useState<string | null>(null)
  const [analysisId, setAnalysisId] = useState<string | null>(null)
  const [status, setStatus] = useState<AnalysisStatusDto | null>(null)
  const [stages, setStages] = useState<StageDto[]>([])
  const [metrics, setMetrics] = useState<MetricsDto[]>([])
  const [fullResults, setFullResults] = useState<Record<string, unknown> | null>(
    null,
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [reportFileName, setReportFileName] = useState<string | null>(null)
  const previewRef = useRef<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const applyPreview = useCallback((url: string | null) => {
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current)
      previewRef.current = null
    }
    if (url) previewRef.current = url
    setPreviewUrl(url)
  }, [])

  const setPreviewFromFile = useCallback(
    (file: File | null) => {
      applyPreview(file ? URL.createObjectURL(file) : null)
    },
    [applyPreview],
  )

  const clearPoll = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  const reset = useCallback(() => {
    clearPoll()
    applyPreview(null)
    setImageId(null)
    setImagePath(null)
    setAnalysisId(null)
    setStatus(null)
    setStages([])
    setMetrics([])
    setFullResults(null)
    setError(null)
    setBusy(false)
    setReportFileName(null)
  }, [applyPreview])

  const refreshArtifacts = useCallback(async (id: string) => {
    const [st, met, full] = await Promise.all([
      api.getStages(id).catch(() => []),
      api.getMetrics(id).catch(() => []),
      api.getFullResults(id).catch(() => null),
    ])
    setStages(st)
    setMetrics(met)
    setFullResults(full)
  }, [])

  useEffect(() => {
    if (!analysisId) return

    const tick = async () => {
      try {
        const s = await api.getStatus(analysisId)
        setStatus(s)
        if (
          s.status === 'RUNNING' ||
          s.status === 'PENDING' ||
          s.status === 'COMPLETED' ||
          s.status === 'FAILED'
        ) {
          await refreshArtifacts(analysisId)
        }
        if (s.status === 'COMPLETED') {
          clearPoll()
        } else if (s.status === 'FAILED') {
          setError(s.errorMessage ?? 'Analysis failed')
          clearPoll()
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Status poll failed')
      }
    }

    void tick()
    clearPoll()
    pollRef.current = setInterval(() => {
      void tick()
    }, 1500)

    return clearPoll
  }, [analysisId, refreshArtifacts])

  const reloadArtifacts = useCallback(async () => {
    if (!analysisId) return
    await refreshArtifacts(analysisId)
  }, [analysisId, refreshArtifacts])

  const beginAnalysisJob = useCallback(async (imgId: string) => {
    clearPoll()
    setError(null)
    setStages([])
    setMetrics([])
    setFullResults(null)
    setStatus(null)
    setAnalysisId(null)
    const { analysisId: aid } = await api.startAnalysis(imgId)
    setAnalysisId(aid)
    const initial = await api.getStatus(aid)
    setStatus(initial)
  }, [])

  const uploadAndStart = useCallback(async (file: File) => {
    setBusy(true)
    setReportFileName(file.name)
    try {
      const prepared = await prepareImageForUpload(file)
      const img = await api.uploadImage(prepared.file)
      setImageId(img.id)
      setImagePath(img.filePath)
      await beginAnalysisJob(img.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
      throw e
    } finally {
      setBusy(false)
    }
  }, [beginAnalysisJob])

  const value: AnalysisContextValue = {
    imageId,
    imagePath,
    analysisId,
    status,
    stages,
    metrics,
    fullResults,
    busy,
    error,
    previewUrl,
    reportFileName,
    reset,
    setPreviewFromFile,
    uploadAndStart,
    reloadArtifacts,
  }

  return (
    <AnalysisContext.Provider value={value}>{children}</AnalysisContext.Provider>
  )
}

export function useAnalysis() {
  const ctx = useContext(AnalysisContext)
  if (!ctx) {
    throw new Error('useAnalysis must be used inside AnalysisProvider')
  }
  return ctx
}
