import { useMemo } from "react";
import {
  computeDmUnreads,
  computeTopLevelSpaceUnreads,
  type MatrixRoomGroups,
  type MatrixSpaceSummary,
} from "@matrix-platform/matrix-core";
import type { SidebarView } from "../../app/chatUrl";

export function useSpaceNavigation(
  roomGroups: MatrixRoomGroups,
  activeSpaceId: string | null,
  sidebarView: SidebarView,
  setActiveSpaceId: (spaceId: string | null) => void,
) {
  const effectiveActiveSpaceId = useMemo(
    () =>
      sidebarView === "space" &&
      activeSpaceId &&
      roomGroups.spaces.some((space) => space.id === activeSpaceId)
        ? activeSpaceId
        : null,
    [activeSpaceId, roomGroups.spaces, sidebarView],
  );

  const activeSpace = useMemo(
    () => roomGroups.spaces.find((space) => space.id === effectiveActiveSpaceId) ?? null,
    [effectiveActiveSpaceId, roomGroups.spaces],
  );

  const activeSpaceChildSet = useMemo(
    () => (activeSpace ? new Set(activeSpace.childIds) : null),
    [activeSpace],
  );

  const spacesById = useMemo(
    () => new Map(roomGroups.spaces.map((space) => [space.id, space])),
    [roomGroups.spaces],
  );

  const spaceParentId = useMemo(() => {
    const parents = new Map<string, string>();
    for (const parent of roomGroups.spaces) {
      for (const childId of parent.childSpaceIds) parents.set(childId, parent.id);
    }
    return parents;
  }, [roomGroups.spaces]);

  const topLevelSpaces = useMemo(
    () => roomGroups.spaces.filter((space) => !space.nested),
    [roomGroups.spaces],
  );

  const topLevelSpaceUnreads = useMemo(
    () => computeTopLevelSpaceUnreads(roomGroups.spaces, roomGroups),
    [roomGroups],
  );

  const dmUnreads = useMemo(() => computeDmUnreads(roomGroups), [roomGroups]);

  const subspaces = useMemo(
    () =>
      (activeSpace?.childSpaceIds ?? [])
        .map((id) => spacesById.get(id))
        .filter((space): space is MatrixSpaceSummary => Boolean(space)),
    [activeSpace, spacesById],
  );

  const railActiveSpaceId = useMemo(() => {
    if (sidebarView !== "space" || !effectiveActiveSpaceId) return null;

    let id: string | null = effectiveActiveSpaceId;
    const seen = new Set<string>();
    while (id && spaceParentId.has(id) && !seen.has(id)) {
      seen.add(id);
      id = spaceParentId.get(id) ?? null;
    }
    return id;
  }, [effectiveActiveSpaceId, sidebarView, spaceParentId]);

  const parentSpace = useMemo(() => {
    if (!effectiveActiveSpaceId) return null;
    const parentId = spaceParentId.get(effectiveActiveSpaceId);
    return parentId ? spacesById.get(parentId) ?? null : null;
  }, [effectiveActiveSpaceId, spaceParentId, spacesById]);

  const visibleRoomGroups = useMemo(() => {
    if (sidebarView === "dms") {
      return {
        favourites: [] as typeof roomGroups.favourites,
        channels: [] as typeof roomGroups.channels,
        dms: roomGroups.dms,
      };
    }

    return {
      favourites: roomGroups.favourites.filter((room) => !activeSpaceChildSet || activeSpaceChildSet.has(room.id)),
      channels: roomGroups.channels.filter((room) => !activeSpaceChildSet || activeSpaceChildSet.has(room.id)),
      dms: roomGroups.dms.filter((room) => !activeSpaceChildSet || activeSpaceChildSet.has(room.id)),
    };
  }, [activeSpaceChildSet, roomGroups.channels, roomGroups.dms, roomGroups.favourites, sidebarView]);

  return {
    effectiveActiveSpaceId,
    activeSpace,
    activeSpaceChildSet,
    spacesById,
    spaceParentId,
    topLevelSpaces,
    topLevelSpaceUnreads,
    dmUnreads,
    subspaces,
    railActiveSpaceId,
    parentSpace,
    visibleRoomGroups,
    setActiveSpaceId,
  };
}
