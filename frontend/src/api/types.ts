export type ImageDto = {
  id: string
  filePath: string
  uploadTimestamp: string
}

export type AnalysisStatusDto = {
  analysisId: string
  status: string
  errorMessage?: string | null
  updatedAt: string
}

export type StageDto = {
  id: string
  stageName: string
  payload: unknown
}

export type MetricsDto = {
  id: string
  stageId: string
  accuracy?: number | null
  avgConfidence?: number | null
  confusionMatrix?: unknown
}
