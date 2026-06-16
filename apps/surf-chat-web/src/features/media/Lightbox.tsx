import { X } from "lucide-react";

type Props = {
  /** Image source to show, or null to render nothing. */
  src: string | null;
  onClose: () => void;
};

/** Full-screen image viewer overlay. Click the backdrop or the close button to
 * dismiss; clicking the image itself does not close it. */
export function Lightbox({ src, onClose }: Props) {
  if (!src) return null;

  return (
    <div className="lightbox" onMouseDown={onClose}>
      <img
        className="lightbox__image"
        src={src}
        alt=""
        onMouseDown={(event) => event.stopPropagation()}
      />
      <button type="button" className="lightbox__close" title="Закрыть" onClick={onClose}>
        <X size={20} />
      </button>
    </div>
  );
}
