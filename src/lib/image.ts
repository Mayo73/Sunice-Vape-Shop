const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
const MAX_INPUT_BYTES = 15 * 1024 * 1024
const MAX_DIMENSION = 1200
const QUALITY = 0.82

export interface PreparedImage {
  blob: Blob
  extension: string
  contentType: string
}

/**
 * Phone cameras produce 4000px, 6MB files. Uploading those would be slow on a
 * mobile connection and slower still for every customer loading the shop, so
 * pictures are scaled down in the browser before they ever leave the device.
 *
 * WebP is used when the browser can encode it (all current mobile browsers can)
 * and JPEG otherwise. The storage bucket caps uploads at 5MB either way.
 */
export async function prepareImage(file: File): Promise<PreparedImage> {
  if (!ACCEPTED.includes(file.type)) {
    throw new Error('Pick a JPEG, PNG, WebP or AVIF image.')
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error('That image is larger than 15 MB.')
  }

  const bitmap = await loadBitmap(file)
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('This browser cannot process images.')
  ctx.drawImage(bitmap, 0, 0, width, height)
  if ('close' in bitmap) bitmap.close()

  let blob = await toBlob(canvas, 'image/webp', QUALITY)
  let contentType = 'image/webp'
  let extension = 'webp'

  if (!blob || blob.type !== 'image/webp') {
    blob = await toBlob(canvas, 'image/jpeg', QUALITY)
    contentType = 'image/jpeg'
    extension = 'jpg'
  }
  if (!blob) throw new Error('Could not process that image.')

  return { blob, extension, contentType }
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      // Honours the EXIF orientation flag, so portrait photos are not sideways.
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      // Fall through to the <img> path below.
    }
  }

  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}
