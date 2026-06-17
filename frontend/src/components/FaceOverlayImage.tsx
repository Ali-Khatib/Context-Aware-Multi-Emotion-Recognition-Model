import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { FaceOverlay } from '../utils/payloadAnalysis'
import { ImageLightbox } from './ImageLightbox'

type Layout = {
  scale: number
  offsetX: number
  offsetY: number
}

type OverlayCanvasProps = {
  imageUrl: string
  overlays: FaceOverlay[]
  showLabels: boolean
  showConfidence?: boolean
  className?: string
}

const ACCENT = [
  { ring: 'ring-fuchsia-400/90', pill: 'bg-fuchsia-600/95 border-fuchsia-300/60' },
  { ring: 'ring-cyan-400/90', pill: 'bg-cyan-700/95 border-cyan-300/60' },
  { ring: 'ring-amber-400/90', pill: 'bg-amber-700/95 border-amber-300/60' },
  { ring: 'ring-emerald-400/90', pill: 'bg-emerald-700/95 border-emerald-300/60' },
  { ring: 'ring-rose-400/90', pill: 'bg-rose-700/95 border-rose-300/60' },
  { ring: 'ring-violet-400/90', pill: 'bg-violet-700/95 border-violet-300/60' },
]

const BBOX_PAD = 12

function OverlayCanvas({
  imageUrl,
  overlays,
  showLabels,
  showConfidence = true,
  className = '',
}: OverlayCanvasProps) {
  const imgRef = useRef<HTMLImageElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState<Layout | null>(null)

  const measure = useCallback(() => {
    const img = imgRef.current
    const wrap = wrapRef.current
    if (!img || !wrap || !img.naturalWidth) return

    const nw = img.naturalWidth
    const nh = img.naturalHeight
    const cw = wrap.clientWidth
    const ch = wrap.clientHeight
    const scale = Math.min(cw / nw, ch / nh)
    const dw = nw * scale
    const dh = nh * scale
    setLayout({
      scale,
      offsetX: (cw - dw) / 2,
      offsetY: (ch - dh) / 2,
    })
  }, [])

  useEffect(() => {
    measure()
    const wrap = wrapRef.current
    if (!wrap) return
    const ro = new ResizeObserver(() => measure())
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [measure, imageUrl, overlays.length])

  return (
    <div
      ref={wrapRef}
      className={`relative w-full overflow-visible rounded-2xl border border-purple-500/25 bg-gradient-to-b from-purple-950/40 to-black/60 ${className}`}
    >
      <img
        ref={imgRef}
        src={imageUrl}
        alt=""
        className="mx-auto block h-full w-full object-contain p-2 sm:p-4"
        onLoad={measure}
        draggable={false}
      />
      {layout &&
        overlays.map((face, i) => {
          const [x, y, w, h] = face.bbox
          const pad = BBOX_PAD
          const left = layout.offsetX + Math.max(0, x - pad) * layout.scale
          const top = layout.offsetY + Math.max(0, y - pad) * layout.scale
          const width = (w + pad * 2) * layout.scale
          const height = (h + pad * 2) * layout.scale
          const accent = ACCENT[i % ACCENT.length]
          const labelAbove = top < 36

          const caption = showLabels
            ? face.label
              ? face.label.replace(/_/g, ' ')
              : `Face ${face.faceId + 1}`
            : `Face ${face.faceId + 1}`

          const conf =
            showConfidence && showLabels && face.confidence != null
              ? `${(face.confidence * 100).toFixed(0)}%`
              : null

          return (
            <div
              key={`${face.faceId}-${i}`}
              className="pointer-events-none absolute"
              style={{ left, top, width, height }}
            >
              <div
                className={`absolute inset-0 rounded-2xl ring-2 ring-offset-2 ring-offset-black/40 ${accent.ring} bg-white/[0.04] backdrop-blur-[1px]`}
              />
              <div
                className={`absolute left-1/2 z-10 flex max-w-[min(100vw,14rem)] -translate-x-1/2 flex-col items-center gap-0.5 ${
                  labelAbove ? 'bottom-full mb-2' : 'top-full mt-2'
                }`}
              >
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-center text-[10px] font-bold leading-snug text-white shadow-lg sm:px-3 sm:py-1 sm:text-sm ${accent.pill}`}
                >
                  {caption}
                </span>
                {conf ? (
                  <span className="rounded-md bg-black/75 px-1.5 py-0.5 text-[9px] font-semibold text-violet-100/95 sm:text-[11px]">
                    {conf}
                  </span>
                ) : null}
              </div>
            </div>
          )
        })}
    </div>
  )
}

type FaceOverlayImageProps = OverlayCanvasProps & {
  zoomable?: boolean
  zoomTitle?: string
  zoomFooter?: ReactNode
  zoomClassName?: string
}

export function FaceOverlayImage({
  imageUrl,
  overlays,
  showLabels,
  showConfidence = true,
  className = '',
  zoomable = false,
  zoomTitle = 'Pipeline view',
  zoomFooter,
  zoomClassName = 'min-h-[min(75vh,640px)] w-full',
}: FaceOverlayImageProps) {
  const [zoomOpen, setZoomOpen] = useState(false)

  const canvas = (
    <OverlayCanvas
      imageUrl={imageUrl}
      overlays={overlays}
      showLabels={showLabels}
      showConfidence={showConfidence}
      className={className}
    />
  )

  if (!zoomable) return canvas

  return (
    <>
      <div
        className="cursor-zoom-in"
        onDoubleClick={() => setZoomOpen(true)}
        title="Double-click to enlarge"
      >
        {canvas}
      </div>
      <ImageLightbox
        open={zoomOpen}
        onClose={() => setZoomOpen(false)}
        title={zoomTitle}
        footer={zoomFooter}
      >
        <OverlayCanvas
          key={zoomOpen ? 'zoom-open' : 'zoom-closed'}
          imageUrl={imageUrl}
          overlays={overlays}
          showLabels={showLabels}
          showConfidence={showConfidence}
          className={zoomClassName}
        />
      </ImageLightbox>
    </>
  )
}
