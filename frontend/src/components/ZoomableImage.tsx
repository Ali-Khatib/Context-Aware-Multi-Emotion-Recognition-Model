import { useState, type ReactNode } from 'react'
import { ImageLightbox } from './ImageLightbox'

type ZoomableImageProps = {
  src: string
  alt?: string
  title: string
  className?: string
  imgClassName?: string
  footer?: ReactNode
}

export function ZoomableImage({
  src,
  alt = '',
  title,
  className = '',
  imgClassName = 'max-h-[220px] w-full object-contain',
  footer,
}: ZoomableImageProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        className={`block w-full cursor-zoom-in rounded-2xl border-0 bg-transparent p-0 text-left ${className}`}
        onDoubleClick={() => setOpen(true)}
        title="Double-click to enlarge"
        aria-label={`${title}. Double-click to enlarge.`}
      >
        <img src={src} alt={alt} className={imgClassName} draggable={false} />
      </button>
      <ImageLightbox
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        footer={footer}
      >
        <div className="flex min-h-[min(75vh,640px)] items-center justify-center rounded-xl bg-black/50 p-2">
          <img
            src={src}
            alt={alt}
            className="max-h-[min(82vh,900px)] w-full object-contain"
            draggable={false}
          />
        </div>
      </ImageLightbox>
    </>
  )
}
