// Клиентское сжатие изображений перед отправкой (режим «Фото/Видео», как в
// Telegram): уменьшаем длинную сторону до MAX_DIMENSION и перекодируем в JPEG.
// GIF и не-изображения возвращаем как есть — анимацию пережимать нельзя, а видео
// браузер так не сожмёт.

const MAX_DIMENSION = 1280;
const JPEG_QUALITY = 0.82;

export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // Битый или неподдерживаемый формат — отправляем оригинал.
    return file;
  }

  const { width, height } = bitmap;
  const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
  );
  // Если сжатие не дало выигрыша (например, и так маленькая картинка) — оставляем
  // оригинал, чтобы не раздувать PNG-скриншоты перекодировкой в JPEG.
  if (!blob || blob.size >= file.size) return file;

  const name = file.name.replace(/\.[^./\\]+$/, "") + ".jpg";
  return new File([blob], name, { type: "image/jpeg", lastModified: file.lastModified });
}
