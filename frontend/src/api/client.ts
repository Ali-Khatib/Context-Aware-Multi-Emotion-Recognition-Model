import type {
  AnalysisStatusDto,
  ImageDto,
  MetricsDto,
  StageDto,
} from './types'

const BASE = import.meta.env.VITE_API_BASE ?? '/api'

function errorFromBody(text: string, fallback: string): string {
  try {
    const parsed = JSON.parse(text) as { message?: string; type?: string }
    if (parsed.message) return parsed.message
    if (parsed.type) return `${parsed.type}: ${parsed.message ?? fallback}`
  } catch {
    /* not JSON */
  }
  return text.trim() || fallback
}

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(
      errorFromBody(text, `${res.status} ${res.statusText}`),
    )
  }
  return res.json() as Promise<T>
}

export async function uploadImage(file: File): Promise<ImageDto> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${BASE}/images/upload`, {
    method: 'POST',
    body: form,
  })
  return parseJson<ImageDto>(res)
}

export async function startAnalysis(imageId: string): Promise<{ analysisId: string }> {
  const res = await fetch(`${BASE}/analysis/start/${imageId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  })
  return parseJson(res)
}

export async function getStatus(analysisId: string): Promise<AnalysisStatusDto> {
  const res = await fetch(`${BASE}/analysis/${analysisId}/status`)
  return parseJson<AnalysisStatusDto>(res)
}

export async function getStages(analysisId: string): Promise<StageDto[]> {
  const res = await fetch(`${BASE}/analysis/${analysisId}/stages`)
  return parseJson<StageDto[]>(res)
}

export async function getMetrics(analysisId: string): Promise<MetricsDto[]> {
  const res = await fetch(`${BASE}/analysis/${analysisId}/metrics`)
  return parseJson<MetricsDto[]>(res)
}

export async function getFullResults(
  analysisId: string,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE}/analysis/${analysisId}/results`)
  return parseJson(res)
}

export function exportCsvUrl(analysisId: string): string {
  return `${BASE}/analysis/${analysisId}/export`
}
