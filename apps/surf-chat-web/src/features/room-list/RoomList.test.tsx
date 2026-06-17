import { fireEvent, render } from "@testing-library/react";
import { MotionConfig } from "framer-motion";
import { describe, expect, it, vi } from "vitest";
import type { MatrixRoomSummary } from "@matrix-platform/matrix-core";
import { PreferencesProvider } from "../../app/providers/PreferencesProvider";
import { RoomList } from "./RoomList";

function makeRoom(overrides: Partial<MatrixRoomSummary> = {}): MatrixRoomSummary {
  return {
    id: "!room:server",
    name: "general",
    preview: "hello",
    time: "12:00",
    timestamp: 1_700_000_000_000,
    color: "#2f6f6d",
    unread: 0,
    kind: "channel",
    favourite: false,
    favouriteOrder: 0,
    memberCount: 2,
    topic: "",
    ...overrides,
  };
}

function renderRoomList(overrides: Partial<Parameters<typeof RoomList>[0]> = {}) {
  const props = {
    favourites: [] as MatrixRoomSummary[],
    channels: [makeRoom()],
    dms: [] as MatrixRoomSummary[],
    activeRoomId: null,
    collapsed: false,
    activeSpaceId: null,
    activeSpace: null,
    subspaces: [],
    parentSpaceName: null,
    onBack: vi.fn(),
    onSelectSpace: vi.fn(),
    onToggleCollapsed: vi.fn(),
    onSelectRoom: vi.fn(),
    onToggleFavourite: vi.fn(),
    onReorderFavourites: vi.fn(),
    onCreateChannel: vi.fn(),
    onCreateDm: vi.fn(),
    onCreateSubspace: vi.fn(),
    onLeaveSpace: vi.fn(),
    onOpenSettings: vi.fn(),
    onLeaveRoom: vi.fn(),
    ...overrides,
  };

  return render(
    <PreferencesProvider>
      <MotionConfig reducedMotion="always">
        <RoomList {...props} />
      </MotionConfig>
    </PreferencesProvider>,
  );
}

function channelsSection(container: HTMLElement) {
  const sections = Array.from(container.querySelectorAll(".room-section"));
  return (
    sections.find((section) =>
      section.querySelector(".room-section__title, .room-section__head-compact"),
    ) ?? null
  );
}

function channelsToggle(container: HTMLElement, collapsed: boolean) {
  const section = channelsSection(container);
  const selector = collapsed ? ".room-section__head-compact" : ".room-section__title";
  return section?.querySelector<HTMLButtonElement>(selector) ?? null;
}

describe("RoomList section collapse", () => {
  it("closes the channels section in the expanded sidebar", () => {
    const { container } = renderRoomList();
    const toggle = channelsToggle(container, false);

    expect(toggle?.getAttribute("aria-expanded")).toBe("true");
    expect(channelsSection(container)?.querySelector(".room-section__body.is-open")).toBeTruthy();

    fireEvent.click(toggle!);

    expect(toggle?.getAttribute("aria-expanded")).toBe("false");
    expect(channelsSection(container)?.querySelector(".room-section__body.is-open")).toBeNull();
  });

  it("keeps collapsed channel rows hidden in the icon-only sidebar", () => {
    const { container } = renderRoomList({ collapsed: true });
    const toggle = channelsToggle(container, true);

    expect(toggle?.getAttribute("aria-expanded")).toBe("true");
    expect(channelsSection(container)?.querySelector(".room-section__body.is-open")).toBeTruthy();

    fireEvent.click(toggle!);

    expect(toggle?.getAttribute("aria-expanded")).toBe("false");
    expect(channelsSection(container)?.querySelector(".room-section__body.is-open")).toBeNull();
  });

  it("shows channel icons again after reopening a collapsed section", () => {
    const { container } = renderRoomList({ collapsed: true });
    const toggle = channelsToggle(container, true);

    fireEvent.click(toggle!);
    fireEvent.click(toggle!);

    expect(toggle?.getAttribute("aria-expanded")).toBe("true");
    expect(channelsSection(container)?.querySelector(".room-section__body.is-open")).toBeTruthy();
  });
});
