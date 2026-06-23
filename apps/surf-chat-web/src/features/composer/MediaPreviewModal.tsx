import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { motion } from "framer-motion";
import { FileText, Plus, Trash2, X } from "lucide-react";
import { transition } from "@matrix-platform/ui";

export type MediaPreviewMode = "photo" | "file";

type Props = {
  files: File[];
  // Режим, выбранный при добавлении (скрепка «Фото/Видео» vs «Файл», зона DnD).
  mode: MediaPreviewMode;
  onSubmit: (files: File[], caption: string, asFile: boolean) => void | Promise<void>;
  onAddMore: (mode: MediaPreviewMode) => void;
  onRemove: (index: number) => void;
  onClose: () => void;
};

const MAX_FILES = 10;

export function MediaPreviewModal({ files, mode, onSubmit, onAddMore, onRemove, onClose }: Props) {
  const [caption, setCaption] = useState("");
  // «Отправить файлом» = оригинал без сжатия. Для режима «Файл» включён всегда.
  const [asFile, setAsFile] = useState(mode === "file");
  const [pending, setPending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, []);

  // Превью-ссылки на изображения/видео живут ровно столько, сколько открыта
  // модалка; пересоздаём при смене набора файлов и чистим за собой.
  const previews = useMemo(
    () =>
      files.map((file) => ({
        file,
        isImage: file.type.startsWith("image/"),
        isVideo: file.type.startsWith("video/"),
        url:
          file.type.startsWith("image/") || file.type.startsWith("video/")
            ? URL.createObjectURL(file)
            : null,
      })),
    [files],
  );

  useEffect(() => {
    return () => {
      for (const item of previews) {
        if (item.url) URL.revokeObjectURL(item.url);
      }
    };
  }, [previews]);

  const allMedia = previews.every((item) => item.isImage || item.isVideo);
  const canAddMore = files.length < MAX_FILES;

  const submit = async () => {
    if (pending || !files.length) return;
    setPending(true);
    try {
      await onSubmit(files, caption.trim(), asFile);
    } finally {
      setPending(false);
    }
  };

  const onCaptionKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  };

  const title =
    files.length > 1
      ? `Отправить ${files.length} ${plural(files.length, "файл", "файла", "файлов")}`
      : asFile
        ? "Отправить файл"
        : "Отправить фото";

  return (
    <motion.div
      className="surf-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="surf-dialog media-preview"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        initial={{ scale: 0.94, opacity: 0, y: 8 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.94, opacity: 0, y: 8 }}
        transition={transition.base}
      >
        <button className="surf-dialog__close" onClick={onClose} aria-label="Закрыть">
          <X size={18} />
        </button>

        <div className="surf-dialog__title">{title}</div>

        <div className={`media-preview__grid${files.length === 1 ? " media-preview__grid--single" : ""}`}>
          {previews.map((item, index) => (
            <div className="media-preview__item" key={index}>
              {item.isImage && item.url ? (
                <img src={item.url} alt={item.file.name} />
              ) : item.isVideo && item.url ? (
                <video src={item.url} muted />
              ) : (
                <div className="media-preview__file">
                  <FileText size={26} />
                  <span className="media-preview__file-name">{item.file.name}</span>
                  <span className="media-preview__file-size">{formatSize(item.file.size)}</span>
                </div>
              )}
              <button
                type="button"
                className="media-preview__remove"
                title="Убрать"
                onClick={() => onRemove(index)}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>

        {canAddMore && (
          <button
            type="button"
            className="media-preview__add"
            onClick={() => onAddMore(asFile ? "file" : "photo")}
          >
            <Plus size={16} /> Добавить ещё
          </button>
        )}

        <textarea
          ref={textareaRef}
          className="media-preview__caption"
          placeholder="Добавьте подпись…"
          value={caption}
          rows={1}
          onChange={(event) => setCaption(event.target.value)}
          onKeyDown={onCaptionKeyDown}
        />

        {allMedia && (
          <label className="poll-toggle">
            <input type="checkbox" checked={asFile} onChange={(event) => setAsFile(event.target.checked)} />
            <span className="media-preview__toggle-label">
              <FileText size={15} />
              Отправить файлом (оригинал, без сжатия)
            </span>
          </label>
        )}

        <button
          className="surf-btn surf-btn--primary surf-btn--block"
          onClick={() => void submit()}
          disabled={pending || !files.length}
        >
          {pending ? "Отправляем…" : "Отправить"}
        </button>
      </motion.div>
    </motion.div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} ГБ`;
}

function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}
