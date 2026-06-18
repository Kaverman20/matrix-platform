import { useMemo } from "react";
import {
  computeTopLevelSpaceUnreads,
  type MatrixRoomGroups,
  type MatrixSpaceSummary,
} from "@matrix-platform/matrix-core";

export function useSpaceNavigation(
  roomGroups: MatrixRoomGroups,
  activeSpaceId: string | null,
  setActiveSpaceId: (spaceId: string | null) => void,
) {
  const effectiveActiveSpaceId = useMemo(
    () => (activeSpaceId && roomGroups.spaces.some((space) => space.id === activeSpaceId) ? activeSpaceId : null),
    [activeSpaceId, roomGroups.spaces],
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

  const subspaces = useMemo(
    () =>
      (activeSpace?.childSpaceIds ?? [])
        .map((id) => spacesById.get(id))
        .filter((space): space is MatrixSpaceSummary => Boolean(space)),
    [activeSpace, spacesById],
  );

  // Highlight the top-level ancestor in the rail even when a nested space is open.
  const railActiveSpaceId = useMemo(() => {
    let id: string | null = effectiveActiveSpaceId;
    const seen = new Set<string>();
    while (id && spaceParentId.has(id) && !seen.has(id)) {
      seen.add(id);
      id = spaceParentId.get(id) ?? null;
    }
    return id;
  }, [effectiveActiveSpaceId, spaceParentId]);

  const parentSpace = useMemo(() => {
    if (!effectiveActiveSpaceId) return null;
    const parentId = spaceParentId.get(effectiveActiveSpaceId);
    return parentId ? spacesById.get(parentId) ?? null : null;
  }, [effectiveActiveSpaceId, spaceParentId, spacesById]);

  const visibleRoomGroups = useMemo(
    () => ({
      favourites: roomGroups.favourites.filter((room) => !activeSpaceChildSet || activeSpaceChildSet.has(room.id)),
      channels: roomGroups.channels.filter((room) => !activeSpaceChildSet || activeSpaceChildSet.has(room.id)),
      dms: roomGroups.dms.filter((room) => !activeSpaceChildSet || activeSpaceChildSet.has(room.id)),
    }),
    [roomGroups.channels, roomGroups.dms, roomGroups.favourites, activeSpaceChildSet],
  );

  return {
    effectiveActiveSpaceId,
    activeSpace,
    activeSpaceChildSet,
    spacesById,
    spaceParentId,
    topLevelSpaces,
    topLevelSpaceUnreads,
    subspaces,
    railActiveSpaceId,
    parentSpace,
    visibleRoomGroups,
    setActiveSpaceId,
  };
}
