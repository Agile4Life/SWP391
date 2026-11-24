/**
 * Chuẩn bị ảnh (giấy tờ tùy thân, thường là ảnh chụp điện thoại khoảng 3–6 MB) để tải lên dưới dạng data URL.
 *
 * Ảnh được gửi trong JSON body ở dạng base64, làm dung lượng tăng thêm khoảng một phần ba. Hai ảnh gốc dễ vượt quá
 * giới hạn kích thước body của proxy (nginx trả HTTP 413) và giới hạn mỗi ảnh phía server, khiến request lỗi hoặc
 * không tới được quầy. Giấy tờ vẫn đọc rất rõ ở cạnh 1600 px nên mọi ảnh lớn đều được thu nhỏ và mã hóa lại thành JPEG
 * ngay trên trình duyệt trước; ảnh nhỏ được giữ nguyên khi gửi.
 */

export const MAX_UPLOAD_SIDE = 1600;
export const JPEG_QUALITY = 0.85;
/** Ảnh có dung lượng bằng hoặc nhỏ hơn ngưỡng này đã đủ gọn và giữ nguyên định dạng gốc. */
export const KEEP_AS_IS_BYTES = 300 * 1024;
const KEEP_AS_IS_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Kích thước sau khi thu nhỏ để cạnh dài nhất không quá `maxSide`; không bao giờ phóng to.
 */
export function fitWithin(width: number, height: number, maxSide = MAX_UPLOAD_SIDE): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxSide) return { width, height };
  const scale = maxSide / longest;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Đọc file thành data URL bằng FileReader. */
function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Giải mã ảnh thành nguồn vẽ được lên canvas (ưu tiên createImageBitmap, nếu không thì dùng thẻ img) kèm hàm
 * giải phóng.
 */
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
 * Tạo data URL cho `file`: giữ nguyên ảnh nếu đã nhỏ, ngược lại nén thành JPEG có cạnh dài tối đa 1600 px.
 * Từ chối (reject) khi trình duyệt không giải mã được tệp (ví dụ ảnh HEIC trên trình duyệt không hỗ trợ HEIC).
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
    // Nền trắng giúp ảnh PNG có nền trong suốt không bị chuyển thành đen khi lưu dạng JPEG.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(picture.source, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  } finally {
    picture.close();
  }
}
