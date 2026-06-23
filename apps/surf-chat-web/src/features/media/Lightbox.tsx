import { useEffect, useState } from "react";
import { Download, Forward, Minus, Plus, X } from "lucide-react";
import { useMatrix } from "../../app/providers/MatrixContext";
import { useAuthedBlob } from "../../components/useAuthedBlob";
import "./lightbox.css";

export type LightboxImage = { url: string; name: string };

export type LightboxState = {
  images: LightboxImage[];
  index: number;
  author?: string;
  time?: string;
  own?: boolean;
  /** Переслать показанную картинку (если проброшен обработчик). */
  onForward?: (image: LightboxImage) => void;
};

type Props = {
  state: LightboxState | null;
  onClose: () => void;
};

const ZOOM_MIN = 1;
const ZOOM_MAX = 4;
const ZOOM_STEP = 0.5;

const clampZoom = (value: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value));

/** Полноэкранный просмотрщик картинок: листание стрелками, автор/время слева
 * внизу, зум/сохранение/пересылка справа — в духе Telegram. */
export function Lightbox({ state, onClose }: Props) {
  const { client } = useMatrix();
  // Компонент перемонтируется на каждое открытие (key в ChatShell), поэтому
  // начальные индекс/зум берём прямо из пропа без эффектов сброса.
  const [index, setIndex] = useState(state?.index ?? 0);
  const [zoom, setZoom] = useState(ZOOM_MIN);

  const total = state?.images.length ?? 0;
  const current = state?.images[index];
  const { src, failed } = useAuthedBlob(current?.url);

  const go = (delta: number) => {
    if (total <= 1) return;
    setZoom(ZOOM_MIN);
    setIndex((value) => (value + delta + total) % total);
  };

  useEffect(() => {
    if (!state) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowLeft") go(-1);
      else if (event.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, total]);

  if (!state || !current) return null;

  const download = async () => {
    if (!client) return;
    const token = client.getAccessToken();
    const response = await fetch(current.url, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = current.name || "image";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);
  };

  const zoomIn = () => setZoom((value) => clampZoom(value + ZOOM_STEP));
  const zoomOut = () => setZoom((value) => clampZoom(value - ZOOM_STEP));
  // Клик по картинке: зум, а на максимуме — сброс к 1 (как в Telegram).
  const toggleZoom = () => setZoom((value) => (value >= ZOOM_MAX ? ZOOM_MIN : clampZoom(value + 1)));

  return (
    <div className="lightbox" onMouseDown={onClose}>
      <button type="button" className="lightbox__close" title="Закрыть (Esc)" onClick={onClose}>
        <X size={22} />
      </button>

      {total > 1 && (
        <>
          <button
            type="button"
            className="lightbox__nav lightbox__nav--prev"
            title="Назад (←)"
            onMouseDown={(event) => {
              event.stopPropagation();
              go(-1);
            }}
          >
            ‹
          </button>
          <button
            type="button"
            className="lightbox__nav lightbox__nav--next"
            title="Вперёд (→)"
            onMouseDown={(event) => {
              event.stopPropagation();
              go(1);
            }}
          >
            ›
          </button>
        </>
      )}

      <div className="lightbox__stage" onMouseDown={(event) => event.stopPropagation()}>
        {failed ? (
          <div className="lightbox__error">Не удалось загрузить изображение</div>
        ) : src ? (
          <img
            className="lightbox__image"
            src={src}
            alt={current.name}
            style={{ transform: `scale(${zoom})`, cursor: zoom >= ZOOM_MAX ? "zoom-out" : "zoom-in" }}
            onClick={toggleZoom}
          />
        ) : (
          <span className="lightbox__loader" />
        )}
      </div>

      <div className="lightbox__bar" onMouseDown={(event) => event.stopPropagation()}>
        <div className="lightbox__meta">
          {state.author && <strong>{state.author}</strong>}
          <span>
            {state.time}
            {total > 1 ? ` · ${index + 1} из ${total}` : ""}
          </span>
        </div>
        <div className="lightbox__actions">
          <button type="button" title="Уменьшить" onClick={zoomOut} disabled={zoom <= ZOOM_MIN}>
            <Minus size={18} />
          </button>
          <button type="button" title="Увеличить" onClick={zoomIn} disabled={zoom >= ZOOM_MAX}>
            <Plus size={18} />
          </button>
          <button type="button" title="Сохранить" onClick={() => void download()}>
            <Download size={18} />
          </button>
          {state.onForward && (
            <button type="button" title="Переслать" onClick={() => state.onForward?.(current)}>
              <Forward size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
