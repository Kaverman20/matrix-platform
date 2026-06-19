import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import "./room-timeline-search.css";

type Props = {
  query: string;
  loading: boolean;
  matchCount: number;
  matchIndex: number;
  onQueryChange: (value: string) => void;
  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
};

export function RoomTimelineSearch({
  query,
  loading,
  matchCount,
  matchIndex,
  onQueryChange,
  onClose,
  onNext,
  onPrevious,
}: Props) {
  return (
    <div className="room-search">
      <Search size={16} className="room-search__icon" />
      <input
        className="room-search__input"
        value={query}
        placeholder="Поиск в чате"
        autoFocus
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            if (event.shiftKey) onPrevious();
            else onNext();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
          }
        }}
      />
      <span className="room-search__count">
        {loading ? "…" : query.trim() ? `${matchCount ? matchIndex + 1 : 0}/${matchCount}` : ""}
      </span>
      <button type="button" className="room-search__nav" title="Предыдущее" onClick={onPrevious}>
        <ChevronUp size={16} />
      </button>
      <button type="button" className="room-search__nav" title="Следующее" onClick={onNext}>
        <ChevronDown size={16} />
      </button>
      <button type="button" className="room-search__close" title="Закрыть" onClick={onClose}>
        <X size={16} />
      </button>
    </div>
  );
}
