/**
 * Prepares a photo (an identity document, usually a phone picture of 3-6 MB) for upload as a data URL.
 *
 * Photos are sent inside a JSON body as base64, which adds a third to their size. Two full-size pictures easily pass the
 * proxy's body limit (nginx rejects with HTTP 413) and the server's per-image limit, so the request fails or never
 * reaches the desk. Documents stay perfectly readable at 1600 px, so every picture is scaled down and re-encoded as JPEG
 * in the browser first; small pictures are sent as they are.
 */

export const MAX_UPLOAD_SIDE = 1600;
export const JPEG_QUALITY = 0.85;
/** Pictures at or under this size already fit comfortably and keep their original encoding. */
export const KEEP_AS_IS_BYTES = 300 * 1024;
const KEEP_AS_IS_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Size after scaling so that the longer side is at most `maxSide`; never enlarges. */
export function fitWithin(width: number, height: number, maxSide = MAX_UPLOAD_SIDE): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxSide) return { width, height };
  const scale = maxSide / longest;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the file'));
    reader.readAsDataURL(file);
  });
}

async function decode(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file);
    return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return { source: image, width: image.naturalWidth, height: image.naturalHeight, close: () => undefined };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Data URL for `file`: the original when it is already small, otherwise a JPEG no larger than 1600 px on its long side.
 * Rejects when the browser cannot decode the file (for example a HEIC picture in a browser without HEIC support).
 */
export async function fileToUploadDataUrl(file: File): Promise<string> {
  if (file.size <= KEEP_AS_IS_BYTES && KEEP_AS_IS_TYPES.includes(file.type)) return readAsDataUrl(file);
  const picture = await decode(file);
  try {
    const { width, height } = fitWithin(picture.width, picture.height);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is not available');
    // A white backdrop keeps transparent PNGs from turning black when saved as JPEG.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(picture.source, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  } finally {
    picture.close();
  }
}
