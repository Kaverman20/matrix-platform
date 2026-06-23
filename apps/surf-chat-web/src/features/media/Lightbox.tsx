import { useEffect, useRef, useState } from "react";
import { Download, Forward, Minus, Plus, X } from "lucide-react";
import { useMatrix } from "../../app/providers/MatrixContext";
import { useAuthedBlob } from "../../components/useAuthedBlob";
import { ZOOM_MIN, ZOOM_MAX, ZOOM_STEP, clampZoom, clamp } from "./lightboxZoom";
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

/** Полноэкранный просмотрщик картинок: листание стрелками, автор/время слева
 * внизу, зум/сохранение/пересылка справа — в духе Telegram. */
export function Lightbox({ state, onClose }: Props) {
  const { client } = useMatrix();
  // Компонент перемонтируется на каждое открытие (key в ChatShell), поэтому
  // начальные индекс/зум берём прямо из пропа без эффектов сброса.
  const [index, setIndex] = useState(state?.index ?? 0);
  const [zoom, setZoom] = useState(ZOOM_MIN);
  // Сдвиг увеличенной картинки (панорамирование перетаскиванием).
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const movedRef = useRef(false);

  const total = state?.images.length ?? 0;
  const current = state?.images[index];
  const { src, failed } = useAuthedBlob(current?.url);

  const go = (delta: number) => {
    if (total <= 1) return;
    setZoom(ZOOM_MIN);
    setPan({ x: 0, y: 0 });
    setIndex((value) => (value + delta + total) % total);
  };

  useEffect(() => {
    if (!state) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // Перехват на capture-фазе + остановка, чтобы Esc закрывал именно
        // просмотрщик и не уходил в другие обработчики.
        event.preventDefault();
        event.stopPropagation();
        onClose();
      } else if (event.key === "ArrowLeft") {
        go(-1);
      } else if (event.key === "ArrowRight") {
        go(1);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
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

  // Меняем зум; при возврате к 1 сбрасываем панорамирование.
  const applyZoom = (next: number) => {
    const z = clampZoom(next);
    setZoom(z);
    if (z === ZOOM_MIN) setPan({ x: 0, y: 0 });
  };
  const zoomIn = () => applyZoom(zoom + ZOOM_STEP);
  const zoomOut = () => applyZoom(zoom - ZOOM_STEP);
  // Клик по картинке: зум ступенью, а на максимуме — сброс к 1 (как в Telegram).
  const toggleZoom = () => applyZoom(zoom >= ZOOM_MAX ? ZOOM_MIN : zoom + 1);

  // Панорамирование увеличенной картинки перетаскиванием.
  const onImgPointerDown = (event: React.PointerEvent<HTMLImageElement>) => {
    if (zoom <= ZOOM_MIN || event.button !== 0) return;
    event.preventDefault();
    movedRef.current = false;
    dragRef.current = { x: event.clientX, y: event.clientY, ox: pan.x, oy: pan.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onImgPointerMove = (event: React.PointerEvent<HTMLImageElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    movedRef.current = true;
    const maxX = ((zoom - 1) * window.innerWidth) / 2;
    const maxY = ((zoom - 1) * window.innerHeight) / 2;
    setPan({
      x: clamp(drag.ox + (event.clientX - drag.x), -maxX, maxX),
      y: clamp(drag.oy + (event.clientY - drag.y), -maxY, maxY),
    });
  };
  const onImgPointerUp = (event: React.PointerEvent<HTMLImageElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };
  // Клик зумит, но только если это был не drag (панорамирование).
  const onImgClick = () => {
    if (movedRef.current) {
      movedRef.current = false;
      return;
    }
    toggleZoom();
  };

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
            draggable={false}
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              cursor: zoom > ZOOM_MIN ? "grab" : "zoom-in",
              touchAction: "none",
            }}
            onPointerDown={onImgPointerDown}
            onPointerMove={onImgPointerMove}
            onPointerUp={onImgPointerUp}
            onPointerCancel={onImgPointerUp}
            onClick={onImgClick}
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
