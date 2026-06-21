import { CreateChannelModal } from "./CreateChannelModal";
import { CreateDmModal } from "./CreateDmModal";
import { CreateSpaceModal } from "./CreateSpaceModal";
import type { RoomCreation } from "./useRoomCreation";

type Props = {
  creation: RoomCreation;
  activeSpaceId: string | null;
  activeSpaceName: string | null;
};

export function CreateModals({ creation, activeSpaceId, activeSpaceName }: Props) {
  return (
    <>
      <CreateChannelModal
        creation={creation}
        activeSpaceId={activeSpaceId}
        activeSpaceName={activeSpaceName}
      />
      <CreateDmModal creation={creation} />
      <CreateSpaceModal creation={creation} />
    </>
  );
}
