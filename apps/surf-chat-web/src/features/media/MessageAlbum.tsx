import type { MatrixMedia } from "@matrix-platform/matrix-core";
import { MessageMedia } from "./MessageMedia";

type Props = {
  media: MatrixMedia[];
  /** Открыть просмотрщик на картинке с этим индексом среди картинок альбома. */
  onOpenImageAt: (imageIndex: number) => void;
};

// «Пак» из нескольких вложений одним сообщением (как альбом в Telegram).
// Картинки/видео раскладываем сеткой, документы — вертикальным списком.
export function MessageAlbum({ media, onOpenImageAt }: Props) {
  const allVisual = media.every((item) => item.kind === "image" || item.kind === "video");
  // Индекс картинки среди картинок (видео/файлы в просмотрщик не попадают).
  const imageIndexOf = (upto: number) =>
    media.slice(0, upto).filter((m) => m.kind === "image").length;

  if (!allVisual) {
    return (
      <div className="message-album message-album--files">
        {media.map((item, index) => (
          <MessageMedia
            key={index}
            media={item}
            onOpen={item.kind === "image" ? () => onOpenImageAt(imageIndexOf(index)) : undefined}
          />
        ))}
      </div>
    );
  }

  // Сетка: 1 в ряд при одном элементе, иначе 2 колонки; нечётный последний
  // растягиваем на всю ширину — как в телеграмной раскладке.
  const columns = media.length === 1 ? 1 : 2;
  return (
    <div
      className="message-album message-album--grid"
      style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
    >
      {media.map((item, index) => {
        const lastOdd = columns === 2 && media.length % 2 === 1 && index === media.length - 1;
        return (
          <div
            className="message-album__cell"
            style={lastOdd ? { gridColumn: "1 / -1" } : undefined}
            key={index}
          >
            <MessageMedia
              media={item}
              onOpen={item.kind === "image" ? () => onOpenImageAt(imageIndexOf(index)) : undefined}
            />
          </div>
        );
      })}
    </div>
  );
}
