import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MotionConfig } from "framer-motion";
import { describe, expect, it, vi } from "vitest";
import type { MatrixRoomSummary } from "@matrix-platform/matrix-core";
import { PreferencesProvider } from "../../app/providers/PreferencesProvider";
import { RoomList } from "./RoomList";

vi.mock("../../app/providers/MatrixContext", () => ({
  useMatrix: () => ({
    client: {
      getUserId: () => "@me:server",
      searchUserDirectory: vi.fn(async ({ term }: { term: string }) => ({
        results: term.includes("alice")
          ? [{ user_id: "@alice:server", display_name: "Alice" }]
          : [],
      })),
    },
  }),
}));

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
    topic: "team updates",
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
    sidebarView: "home" as const,
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
    onStartDmWithUser: vi.fn(),
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

describe("RoomList search", () => {
  function searchInput(container: HTMLElement) {
    return container.querySelector<HTMLInputElement>(".room-list__search input");
  }

  it("filters rooms by topic and preview", () => {
    const { container } = renderRoomList({
      channels: [
        makeRoom({ name: "general", preview: "hello" }),
        makeRoom({ id: "!ops:server", name: "ops", preview: "deploy", topic: "on-call" }),
      ],
    });

    fireEvent.change(searchInput(container)!, {
      target: { value: "on-call" },
    });

    const visibleNames = [...container.querySelectorAll(".room-row__top strong")].map(
      (node) => node.textContent,
    );
    expect(visibleNames).toEqual(["ops"]);
  });

  it("shows directory users and starts a DM from the sidebar", async () => {
    const onStartDmWithUser = vi.fn().mockResolvedValue(undefined);
    const { container } = renderRoomList({ onStartDmWithUser });

    fireEvent.change(searchInput(container)!, {
      target: { value: "alice" },
    });

    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("Alice"));

    await waitFor(() => {
      expect(onStartDmWithUser).toHaveBeenCalledWith("@alice:server");
    });
  });
});
