/** Matches backend ImageController + Spring multipart (10 MiB). */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

/** Longest edge (px) — keeps pipeline fast; faces still detect fine. */
export const MAX_IMAGE_EDGE_PX = 2048

export const UPLOAD_MAX_SIZE_MB = 10
export const UPLOAD_SIZE_LIMIT_LABEL = `${UPLOAD_MAX_SIZE_MB} MB maximum file size`
export const UPLOAD_DIMENSION_LIMIT_LABEL = `${MAX_IMAGE_EDGE_PX} px maximum (longest side)`

/** Stay under Spring multipart + controller limit (10 MiB). */
const TARGET_MAX_BYTES = 8 * 1024 * 1024

export type PrepareImageResult = {
  file: File
  originalBytes: number
  finalBytes: number
  originalWidth: number
  originalHeight: number
  finalWidth: number
  finalHeight: number
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read this image file.'))
    }
    img.src = url
  })
}

function fitInside(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number } {
  if (width <= maxEdge && height <= maxEdge) {
    return { width, height }
  }
  const scale = maxEdge / Math.max(width, height)
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Could not encode image.'))
      },
      type,
      quality,
    )
  })
}

async function renderToJpegBlob(
  img: HTMLImageElement,
  width: number,
  height: number,
  quality: number,
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not available in this browser.')
  ctx.drawImage(img, 0, 0, width, height)
  return canvasToBlob(canvas, 'image/jpeg', quality)
}

async function encodeUnderBudget(
  img: HTMLImageElement,
  width: number,
  height: number,
  maxBytes: number,
): Promise<{ blob: Blob; width: number; height: number }> {
  const qualities = [0.92, 0.85, 0.78, 0.7, 0.62, 0.55, 0.48, 0.4]
  let last: Blob | null = null
  let w = width
  let h = height

  for (const q of qualities) {
    const blob = await renderToJpegBlob(img, w, h, q)
    last = blob
    if (blob.size <= maxBytes) return { blob, width: w, height: h }
  }

  for (let pass = 0; pass < 4 && last && last.size > maxBytes; pass++) {
    w = Math.max(320, Math.round(w * 0.75))
    h = Math.max(320, Math.round(h * 0.75))
    last = await renderToJpegBlob(img, w, h, 0.72)
    if (last.size <= maxBytes) return { blob: last, width: w, height: h }
  }

  if (!last) throw new Error('Could not compress image enough.')
  if (last.size > MAX_UPLOAD_BYTES) {
    throw new Error(
      'Image is still too large after compression. Try a smaller photo or crop the image.',
    )
  }
  return { blob: last, width: w, height: h }
}

function buildOutputName(originalName: string): string {
  const base = originalName.replace(/\.[^.]+$/, '') || 'upload'
  return `${base}.jpg`
}

/**
 * Resize and/or re-encode so the file fits server limits (10 MB, max edge).
 */
export async function prepareImageForUpload(file: File): Promise<PrepareImageResult> {
  const originalBytes = file.size
  const img = await loadImage(file)
  const originalWidth = img.naturalWidth
  const originalHeight = img.naturalHeight

  const { width: targetW, height: targetH } = fitInside(
    originalWidth,
    originalHeight,
    MAX_IMAGE_EDGE_PX,
  )

  const tooLarge = originalBytes > TARGET_MAX_BYTES
  const tooBigDimensions =
    originalWidth > MAX_IMAGE_EDGE_PX || originalHeight > MAX_IMAGE_EDGE_PX

  if (!tooLarge && !tooBigDimensions) {
    return {
      file,
      originalBytes,
      finalBytes: originalBytes,
      originalWidth,
      originalHeight,
      finalWidth: originalWidth,
      finalHeight: originalHeight,
    }
  }

  const { blob, width: finalW, height: finalH } = await encodeUnderBudget(
    img,
    targetW,
    targetH,
    TARGET_MAX_BYTES,
  )
  const outFile = new File([blob], buildOutputName(file.name), {
    type: 'image/jpeg',
    lastModified: Date.now(),
  })

  return {
    file: outFile,
    originalBytes,
    finalBytes: outFile.size,
    originalWidth,
    originalHeight,
    finalWidth: finalW,
    finalHeight: finalH,
  }
}
