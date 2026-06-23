export const ZOOM_MIN = 1;
export const ZOOM_MAX = 4;
export const ZOOM_STEP = 0.5;

/** Зажимает уровень зума в диапазон [ZOOM_MIN, ZOOM_MAX]. */
export const clampZoom = (value: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value));

/** Универсальный clamp (для ограничения панорамирования). */
export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
