import { ClientEvent, HttpApiEvent, SyncState, type MatrixClient, type Room } from "matrix-js-sdk";
import { describe, expect, it, vi } from "vitest";
import {
  setupDirectInviteAutoJoin,
  subscribeSessionLogout,
  subscribeSyncState,
} from "./lifecycle";

describe("subscribeSyncState", () => {
  it("fires onReady on Prepared and stops tracking", () => {
    const { client, emit, listeners } = fakeClient();
    const onReady = vi.fn();
    const onError = vi.fn();

    subscribeSyncState(client, { onReady, onError });
    emit(ClientEvent.Sync, SyncState.Prepared);

    expect(onReady).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
    // Listener removed itself after the first decisive state.
    expect(listeners(ClientEvent.Sync)).toHaveLength(0);
    emit(ClientEvent.Sync, SyncState.Syncing);
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it("fires onError on Error", () => {
    const { client, emit } = fakeClient();
    const onReady = vi.fn();
    const onError = vi.fn();

    subscribeSyncState(client, { onReady, onError });
    emit(ClientEvent.Sync, SyncState.Error);

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onReady).not.toHaveBeenCalled();
  });

  it("fires onReady synchronously when already synced", () => {
    const { client } = fakeClient({ syncState: SyncState.Syncing });
    const onReady = vi.fn();

    subscribeSyncState(client, { onReady, onError: vi.fn() });

    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it("unsubscribe stops further callbacks", () => {
    const { client, emit } = fakeClient();
    const onReady = vi.fn();

    const unsub = subscribeSyncState(client, { onReady, onError: vi.fn() });
    unsub();
    emit(ClientEvent.Sync, SyncState.Prepared);

    expect(onReady).not.toHaveBeenCalled();
  });
});

describe("subscribeSessionLogout", () => {
  it("invokes callback on SessionLoggedOut and unsubscribes", () => {
    const { client, emit, listeners } = fakeClient();
    const onLoggedOut = vi.fn();

    const unsub = subscribeSessionLogout(client, onLoggedOut);
    emit(HttpApiEvent.SessionLoggedOut);
    expect(onLoggedOut).toHaveBeenCalledTimes(1);

    unsub();
    expect(listeners(HttpApiEvent.SessionLoggedOut)).toHaveLength(0);
    emit(HttpApiEvent.SessionLoggedOut);
    expect(onLoggedOut).toHaveBeenCalledTimes(1);
  });
});

describe("setupDirectInviteAutoJoin", () => {
  it("joins existing DM invites and records m.direct", async () => {
    const joinRoom = vi.fn().mockResolvedValue(undefined);
    const setAccountData = vi.fn().mockResolvedValue(undefined);
    const room = fakeRoom("!dm:server", "@friend:server");
    const { client } = fakeClient({ rooms: [room], joinRoom, setAccountData });

    setupDirectInviteAutoJoin(client);
    await flush();

    expect(joinRoom).toHaveBeenCalledWith("!dm:server");
    expect(setAccountData).toHaveBeenCalledWith("m.direct", { "@friend:server": ["!dm:server"] });
  });

  it("joins invites arriving later via the Room event", async () => {
    const joinRoom = vi.fn().mockResolvedValue(undefined);
    const { client, emit } = fakeClient({ joinRoom, setAccountData: vi.fn().mockResolvedValue(undefined) });

    setupDirectInviteAutoJoin(client);
    emit(ClientEvent.Room, fakeRoom("!later:server", "@friend:server"));
    await flush();

    expect(joinRoom).toHaveBeenCalledWith("!later:server");
  });

  it("ignores rooms that are not invites", async () => {
    const joinRoom = vi.fn().mockResolvedValue(undefined);
    const room = fakeRoom("!joined:server", "@friend:server", "join");
    const { client } = fakeClient({ rooms: [room], joinRoom });

    setupDirectInviteAutoJoin(client);
    await flush();

    expect(joinRoom).not.toHaveBeenCalled();
  });
});

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function fakeRoom(roomId: string, inviter: string | null, membership = "invite"): Room {
  return {
    roomId,
    getDMInviter: () => inviter,
    getMyMembership: () => membership,
  } as unknown as Room;
}

function fakeClient({
  syncState = null,
  rooms = [],
  joinRoom = vi.fn(),
  setAccountData = vi.fn(),
}: {
  syncState?: SyncState | null;
  rooms?: Room[];
  joinRoom?: ReturnType<typeof vi.fn>;
  setAccountData?: ReturnType<typeof vi.fn>;
} = {}) {
  const handlers = new Map<string, Set<(...args: unknown[]) => void>>();

  const client = {
    on: (event: string, handler: (...args: unknown[]) => void) => {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)!.add(handler);
    },
    off: (event: string, handler: (...args: unknown[]) => void) => {
      handlers.get(event)?.delete(handler);
    },
    getSyncState: () => syncState,
    getRooms: () => rooms,
    joinRoom,
    getAccountData: () => undefined,
    setAccountData,
  } as unknown as MatrixClient;

  const emit = (event: string, ...args: unknown[]) => {
    for (const handler of [...(handlers.get(event) ?? [])]) handler(...args);
  };
  const listeners = (event: string) => [...(handlers.get(event) ?? [])];

  return { client, emit, listeners };
}
