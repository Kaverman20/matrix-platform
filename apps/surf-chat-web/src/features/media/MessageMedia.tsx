import { Download, FileText, ImageOff } from "lucide-react";
import type { MatrixMedia } from "@matrix-platform/matrix-core";
import { useMatrix } from "../../app/providers/MatrixContext";
import { useAuthedBlob } from "../../components/useAuthedBlob";
import { VoiceMessagePlayer } from "./VoiceMessagePlayer";
import "./message-media.css";

type Props = {
  media: MatrixMedia;
  /** Открыть полноэкранный просмотрщик (для картинок). */
  onOpen?: () => void;
};

export function MessageMedia({ media, onOpen }: Props) {
  const { client } = useMatrix();
  const previewUrl = media.kind === "image" || media.kind === "video" || media.kind === "audio"
    ? media.thumbUrl ?? media.url
    : undefined;
  const { failed, src } = useAuthedBlob(previewUrl);

  const downloadFile = async () => {
    if (!client) return;
    const token = client.getAccessToken();
    const response = await fetch(media.url, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = media.name;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);
  };

  if (media.kind === "image") {
    const ratio = media.width && media.height ? `${media.width} / ${media.height}` : undefined;

    if (failed) {
      return (
        <div className="message-media message-media--broken">
          <ImageOff size={22} />
          <span>{media.name}</span>
        </div>
      );
    }

    return (
      <button
        type="button"
        className="message-media message-media--image"
        style={ratio ? { aspectRatio: ratio } : undefined}
        onClick={() => src && onOpen?.()}
      >
        {src ? <img src={src} alt={media.name} /> : <span className="message-media__loader" />}
      </button>
    );
  }

  if (media.kind === "video") {
    return (
      <video
        className="message-media message-media--video"
        src={src}
        controls
        preload="metadata"
      />
    );
  }

  if (media.kind === "audio") {
    if (media.voice) {
      return (
        <div className="message-media message-media--voice">
          <VoiceMessagePlayer
            src={src}
            durationMs={media.durationMs}
            waveform={media.waveform}
            seed={media.url}
          />
        </div>
      );
    }

    return (
      <div className="message-media message-media--audio">
        <audio src={src} controls preload="metadata" />
      </div>
    );
  }

  return (
    <button type="button" className="message-media message-media--file" onClick={() => void downloadFile()}>
      <span className="message-media__file-icon">
        <FileText size={20} />
      </span>
      <span className="message-media__file-body">
        <strong>{media.name}</strong>
        {media.size ? <small>{formatSize(media.size)}</small> : null}
      </span>
      <span className="message-media__download">
        <Download size={16} />
      </span>
    </button>
  );
}

function formatSize(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

