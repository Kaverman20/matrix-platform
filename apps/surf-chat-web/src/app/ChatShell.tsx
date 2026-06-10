import { AnimatePresence, motion } from "framer-motion";
import { EventTimeline, type MatrixClient } from "matrix-js-sdk";
import {
  AlignLeft,
  ArrowLeft,
  Bell,
  Boxes,
  Camera,
  ChevronRight,
  FileText,
  Globe,
  Hash,
  Lock,
  LogOut,
  MessageSquare,
  PanelRight,
  Pin,
  Phone,
  Plus,
  Search,
  UserPlus,
  Users,
  Video,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { transition } from "@matrix-platform/ui";
import {
  buildForwardData,
  colorForId,
  removeReaction,
  sendReaction,
  type MatrixForwardData,
  type MatrixMedia,
  type MatrixMessage,
  type MatrixMessageReference,
} from "@matrix-platform/matrix-core";
import { useMatrix } from "./providers/MatrixContext";
import { Composer, type ComposerHandle } from "../features/composer/Composer";
import { ForwardModal } from "../features/forward/ForwardModal";
import {
  MessageContextMenu,
  type MessageAction,
} from "../features/message-actions/MessageContextMenu";
import { RoomList } from "../features/room-list/RoomList";
import { useRoomGroups } from "../features/room-list/useRoomGroups";
import { EmptyState } from "../features/timeline/EmptyState";
import { Timeline } from "../features/timeline/Timeline";
import { usePinnedMessages } from "../features/timeline/usePinnedMessages";
import { useTimelineMessages } from "../features/timeline/useTimelineMessages";
import "./chat-shell.css";

const ROOM_LIST_WIDTH = 304;
const ROOM_LIST_MAX = 440;
const ROOM_LIST_COLLAPSED_WIDTH = 84;
const ROOM_LIST_COLLAPSE_THRESHOLD = 200;
const RAIL_WIDTH = 72;
const RIGHT_PANEL_WIDTH = 320;

type RightPanelSection = "overview" | "members" | "media" | "notifications";
type ChatView = "flat" | "bubbles";
type CreateChannelType = "private" | "public";
type UserDirectoryEntry = {
  user_id: string;
  display_name?: string;
  avatar_url?: string;
};

export function ChatShell() {
  const { client, logout } = useMatrix();
  const roomGroups = useRoomGroups(client);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<MatrixMessageReference | null>(null);
  const [editingMessage, setEditingMessage] = useState<MatrixMessageReference | null>(null);
  const [pendingForward, setPendingForward] = useState<MatrixForwardData[] | null>(null);
  const [forwarding, setForwarding] = useState<MatrixForwardData[] | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [chatView, setChatView] = useState<ChatView>(
    () => (localStorage.getItem("surf-chat:view") as ChatView) || "flat",
  );
  const [showRightPanel, setShowRightPanel] = useState(false);
  const [rightPanelSection, setRightPanelSection] = useState<RightPanelSection>("overview");
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null);
  const [roomListCollapsed, setRoomListCollapsed] = useState(false);
  const [roomListWidth, setRoomListWidth] = useState(ROOM_LIST_WIDTH);
  const [roomListResizing, setRoomListResizing] = useState(false);
  const roomListWidthRef = useRef(roomListWidth);
  const roomListLastWidth = useRef(ROOM_LIST_WIDTH);
  const [messageMenu, setMessageMenu] = useState<{
    message: MatrixMessage;
    x: number;
    y: number;
  } | null>(null);
  const [pinnedIndex, setPinnedIndex] = useState(0);
  const [highlightMessageId, setHighlightMessageId] = useState<string | null>(null);
  const [optimisticPinnedIds, setOptimisticPinnedIds] = useState<string[] | null>(null);
  const [creatingSpace, setCreatingSpace] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState("");
  const [newSpaceType, setNewSpaceType] = useState<"private" | "public">("private");
  const [spaceAvatarFile, setSpaceAvatarFile] = useState<File | null>(null);
  const [spaceAvatarPreview, setSpaceAvatarPreview] = useState<string | null>(null);
  const [creatingSpacePending, setCreatingSpacePending] = useState(false);
  const [creatingChannel, setCreatingChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelType, setNewChannelType] = useState<CreateChannelType>("private");
  const [creatingChannelPending, setCreatingChannelPending] = useState(false);
  const [creatingDm, setCreatingDm] = useState(false);
  const [dmQuery, setDmQuery] = useState("");
  const [dmResults, setDmResults] = useState<UserDirectoryEntry[]>([]);
  const [dmSearching, setDmSearching] = useState(false);
  const [selectedDmUserId, setSelectedDmUserId] = useState<string | null>(null);
  const [creatingDmPending, setCreatingDmPending] = useState(false);
  const favouritePersistTimer = useRef<number | null>(null);
  const composerRef = useRef<ComposerHandle | null>(null);
  const highlightTimer = useRef<number | null>(null);
  const spaceAvatarInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    localStorage.setItem("surf-chat:view", chatView);
  }, [chatView]);

  useEffect(() => {
    return () => {
      if (spaceAvatarPreview) {
        URL.revokeObjectURL(spaceAvatarPreview);
      }
    };
  }, [spaceAvatarPreview]);

  const allRooms = useMemo(
    () => [
      ...roomGroups.favourites,
      ...roomGroups.channels,
      ...roomGroups.dms,
    ],
    [roomGroups.channels, roomGroups.dms, roomGroups.favourites],
  );
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
  const visibleRoomGroups = useMemo(
    () => ({
      favourites: roomGroups.favourites.filter((room) => !activeSpaceChildSet || activeSpaceChildSet.has(room.id)),
      channels: roomGroups.channels.filter((room) => !activeSpaceChildSet || activeSpaceChildSet.has(room.id)),
      dms: roomGroups.dms.filter((room) => !activeSpaceChildSet || activeSpaceChildSet.has(room.id)),
    }),
    [roomGroups.channels, roomGroups.dms, roomGroups.favourites, activeSpaceChildSet],
  );

  const activeRoom = useMemo(() => {
    return allRooms.find((room) => room.id === activeRoomId) ?? null;
  }, [activeRoomId, allRooms]);
  const messages = useTimelineMessages(client, activeRoomId);
  const pinnedMessages = usePinnedMessages(client, activeRoomId, optimisticPinnedIds);
  const activeMatrixRoom = useMemo(
    () => (client && activeRoomId ? client.getRoom(activeRoomId) : null),
    [activeRoomId, client],
  );
  const roomMembers = useMemo(() => {
    if (!client || !activeMatrixRoom) return [];
    const me = client.getUserId();

    return activeMatrixRoom
      .getMembers()
      .filter((member) => member.membership === "join" || member.membership === "invite")
      .map((member) => ({
        id: member.userId,
        name: member.name || member.userId,
        userId: member.userId,
        avatarUrl: memberAvatarUrl(client, member),
        color: activeRoom ? activeRoom.color : "#8b7f99",
        me: member.userId === me,
      }))
      .sort((left, right) => Number(right.me) - Number(left.me) || left.name.localeCompare(right.name));
  }, [activeMatrixRoom, activeRoom, client]);
  const roomMedia = useMemo(
    () =>
      messages
        .filter((message): message is MatrixMessage & { media: MatrixMedia } => Boolean(message.media))
        .map((message) => ({
          id: message.id,
          media: message.media,
          author: message.own ? "Вы" : message.author,
          time: message.time,
        })),
    [messages],
  );
  const canPinMessages = useMemo(() => {
    if (!client || !activeMatrixRoom) return false;

    const powerLevels = activeMatrixRoom
      .getLiveTimeline()
      .getState(EventTimeline.FORWARDS)
      ?.getStateEvents("m.room.power_levels", "")
      ?.getContent() as
        | {
            users?: Record<string, number>;
            users_default?: number;
            events?: Record<string, number>;
            state_default?: number;
          }
        | undefined;

    const me = client.getUserId();
    const myLevel = Number((me && powerLevels?.users?.[me]) ?? powerLevels?.users_default ?? 0);
    const requiredLevel = Number(powerLevels?.events?.["m.room.pinned_events"] ?? powerLevels?.state_default ?? 50);
    return myLevel >= requiredLevel;
  }, [activeMatrixRoom, client]);

  const messageReference = (message: MatrixMessage): MatrixMessageReference => ({
    id: message.id,
    sender: message.sender,
    author: message.own ? "Вы" : message.author,
    text: message.text,
  });

  const startReply = (message: MatrixMessage) => {
    setEditingMessage(null);
    setPendingForward(null);
    setReplyTo(messageReference(message));
  };

  const startEdit = (message: MatrixMessage) => {
    setReplyTo(null);
    setPendingForward(null);
    setEditingMessage(messageReference(message));
  };

  const clearComposerMode = () => {
    setReplyTo(null);
    setEditingMessage(null);
    setPendingForward(null);
  };

  const selectRoom = (roomId: string) => {
    setActiveRoomId(roomId);
    setRightPanelSection("overview");
    setPinnedIndex(0);
    setHighlightMessageId(null);
    setOptimisticPinnedIds(null);
    clearComposerMode();
  };

  const composerKey = [
    activeRoom?.id ?? "none",
    editingMessage
      ? `edit:${editingMessage.id}`
      : pendingForward
        ? `forward:${pendingForward.map((item) => item.sender + item.preview).join("|")}`
        : replyTo
          ? `reply:${replyTo.id}`
          : "plain",
  ].join(":");

  const openMessageMenu = (message: MatrixMessage, x: number, y: number) => {
    setMessageMenu({ message, x, y });
  };

  const handleMessageAction = (action: MessageAction, message: MatrixMessage) => {
    if (!client || !activeRoomId) return;

    if (action === "reply") startReply(message);
    if (action === "edit") startEdit(message);
    if (action === "copy" && message.text) void navigator.clipboard.writeText(message.text);
    if (action === "forward") {
      setForwarding([buildForwardData(client, activeRoomId, message)]);
    }
    if (action === "pin") {
      void togglePinnedMessage(message);
    }
    if (action === "delete" && window.confirm("Удалить сообщение?")) {
      void client.redactEvent(activeRoomId, message.id);
    }
  };

  const togglePinnedMessage = async (message: MatrixMessage) => {
    if (!client || !activeRoomId) return;

    const room = client.getRoom(activeRoomId);
    if (!room) return;

    const currentPinned = optimisticPinnedIds
      ?? (room.currentState.getStateEvents("m.room.pinned_events", "")?.getContent().pinned as string[] | undefined)
      ?? (room
        .getLiveTimeline()
        .getState(EventTimeline.FORWARDS)
        ?.getStateEvents("m.room.pinned_events", "")
        ?.getContent().pinned as string[] | undefined)
      ?? [];

    const nextPinned = currentPinned.includes(message.id)
      ? currentPinned.filter((id) => id !== message.id)
      : [...currentPinned, message.id];

    setOptimisticPinnedIds(nextPinned);

    try {
      await client.sendStateEvent(activeRoomId, "m.room.pinned_events" as never, { pinned: nextPinned } as never, "");
    } catch (error) {
      setOptimisticPinnedIds(currentPinned);
      console.error("[pin-message]", error);
      window.alert("Не удалось изменить закреплённые сообщения. Проверьте права в комнате.");
    }
  };

  const focusPinnedMessage = (messageId: string) => {
    const node = document.querySelector<HTMLElement>(`[data-mid="${CSS.escape(messageId)}"]`);
    if (!node) return;

    node.scrollIntoView({ block: "center", behavior: "smooth" });
    setHighlightMessageId(messageId);
    if (highlightTimer.current) {
      window.clearTimeout(highlightTimer.current);
    }
    highlightTimer.current = window.setTimeout(() => setHighlightMessageId(null), 1700);
  };

  const cyclePinnedMessage = () => {
    if (pinnedMessages.length === 0) return;
    const index = pinnedIndex % pinnedMessages.length;
    const current = pinnedMessages[index];
    if (!current?.id) return;

    focusPinnedMessage(current.id);
    setPinnedIndex((index + 1) % pinnedMessages.length);
  };

  const toggleReaction = (message: MatrixMessage, key: string) => {
    if (!client || !activeRoomId) return;
    const existing = message.reactions.find((reaction) => reaction.key === key && reaction.mine);

    if (existing?.myEventId) {
      void removeReaction(client, activeRoomId, existing.myEventId);
    } else {
      void sendReaction(client, activeRoomId, message.id, key);
    }
  };

  const selectForwardRoom = (roomId: string) => {
    if (!forwarding?.length) return;
    setActiveRoomId(roomId);
    setPinnedIndex(0);
    setHighlightMessageId(null);
    setOptimisticPinnedIds(null);
    setPendingForward(forwarding);
    setReplyTo(null);
    setEditingMessage(null);
    setForwarding(null);
  };

  const toggleRoomListCollapse = () => {
    if (roomListCollapsed) {
      setRoomListCollapsed(false);
      setRoomListWidth(roomListLastWidth.current);
      roomListWidthRef.current = roomListLastWidth.current;
    } else {
      roomListLastWidth.current = roomListWidth;
      setRoomListCollapsed(true);
      setRoomListWidth(ROOM_LIST_COLLAPSED_WIDTH);
      roomListWidthRef.current = ROOM_LIST_COLLAPSED_WIDTH;
    }
  };

  const startRoomListResize = (event: React.PointerEvent) => {
    event.preventDefault();
    setRoomListResizing(true);

    const onMove = (moveEvent: PointerEvent) => {
      const nextWidth = Math.min(
        ROOM_LIST_MAX,
        Math.max(ROOM_LIST_COLLAPSED_WIDTH, moveEvent.clientX - RAIL_WIDTH),
      );
      roomListWidthRef.current = nextWidth;
      setRoomListWidth(nextWidth);
      setRoomListCollapsed(nextWidth < ROOM_LIST_COLLAPSE_THRESHOLD);
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setRoomListResizing(false);

      const nextWidth = roomListWidthRef.current;
      if (nextWidth < ROOM_LIST_COLLAPSE_THRESHOLD) {
        setRoomListWidth(ROOM_LIST_COLLAPSED_WIDTH);
        roomListWidthRef.current = ROOM_LIST_COLLAPSED_WIDTH;
        setRoomListCollapsed(true);
      } else {
        roomListLastWidth.current = nextWidth;
        setRoomListCollapsed(false);
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const toggleFavouriteRoom = (roomId: string) => {
    if (!client) return;
    const room = allRooms.find((item) => item.id === roomId);
    if (!room) return;

    if (room.favourite) {
      void client.deleteRoomTag(roomId, "m.favourite");
    } else {
      void client.setRoomTag(roomId, "m.favourite", { order: 0.5 });
    }
  };

  const openCreateSpace = () => {
    if (spaceAvatarPreview) {
      URL.revokeObjectURL(spaceAvatarPreview);
    }
    setNewSpaceName("");
    setNewSpaceType("private");
    setSpaceAvatarFile(null);
    setSpaceAvatarPreview(null);
    setCreatingSpace(true);
  };

  const closeCreateSpace = () => {
    setCreatingSpace(false);
    setCreatingSpacePending(false);
  };

  const openCreateChannel = () => {
    setNewChannelName("");
    setNewChannelType("private");
    setCreatingChannel(true);
  };

  const closeCreateChannel = () => {
    setCreatingChannel(false);
    setCreatingChannelPending(false);
  };

  const openCreateDm = () => {
    setDmQuery("");
    setDmResults([]);
    setSelectedDmUserId(null);
    setCreatingDm(true);
  };

  const closeCreateDm = () => {
    setCreatingDm(false);
    setCreatingDmPending(false);
    setDmSearching(false);
  };

  const pickSpaceAvatar = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (spaceAvatarPreview) {
      URL.revokeObjectURL(spaceAvatarPreview);
    }
    setSpaceAvatarFile(file);
    setSpaceAvatarPreview(file ? URL.createObjectURL(file) : null);
    event.target.value = "";
  };

  const createSpace = async () => {
    const name = newSpaceName.trim();
    if (!client || !name || creatingSpacePending) return;

    setCreatingSpacePending(true);
    const server = client.getDomain() ?? "";
    const isPublic = newSpaceType === "public";

    try {
      let avatarMxc: string | undefined;
      if (spaceAvatarFile) {
        try {
          const upload = await client.uploadContent(spaceAvatarFile, { type: spaceAvatarFile.type });
          avatarMxc = (upload as { content_uri?: string }).content_uri;
        } catch (error) {
          console.error("[space-avatar-upload]", error);
        }
      }

      const spaceResult = await client.createRoom({
        name,
        creation_content: { type: "m.space" },
        preset: (isPublic ? "public_chat" : "private_chat") as never,
        ...(isPublic ? { visibility: "public" as never } : {}),
        ...(avatarMxc
          ? { initial_state: [{ type: "m.room.avatar", state_key: "", content: { url: avatarMxc } }] }
          : {}),
      } as never);

      const spaceId = (spaceResult as { room_id: string }).room_id;
      const generalResult = await client.createRoom({
        name: "general",
        room_version: "10",
        initial_state: [
          {
            type: "m.room.join_rules",
            state_key: "",
            content: {
              join_rule: "restricted",
              allow: [{ type: "m.room_membership", room_id: spaceId }],
            },
          },
          { type: "m.space.parent", state_key: spaceId, content: { canonical: true, via: [server] } },
        ],
      } as never);

      const generalRoomId = (generalResult as { room_id: string }).room_id;
      await client.sendStateEvent(spaceId, "m.space.child" as never, { via: [server] } as never, generalRoomId);

      closeCreateSpace();
      setActiveSpaceId(spaceId);
      setActiveRoomId(generalRoomId);
    } catch (error) {
      console.error("[create-space]", error);
      window.alert("Не удалось создать пространство.");
    } finally {
      setCreatingSpacePending(false);
    }
  };

  const createChannel = async () => {
    const name = newChannelName.trim();
    if (!client || !name || creatingChannelPending) return;

    setCreatingChannelPending(true);
    const server = client.getDomain() ?? "";
    const isPublic = newChannelType === "public";

    try {
      const initialState: Array<{ type: string; state_key: string; content: Record<string, unknown> }> = [];

      if (effectiveActiveSpaceId) {
        if (isPublic) {
          initialState.push({
            type: "m.space.parent",
            state_key: effectiveActiveSpaceId,
            content: { canonical: true, via: [server] },
          });
        } else {
          initialState.push(
            {
              type: "m.room.join_rules",
              state_key: "",
              content: {
                join_rule: "restricted",
                allow: [{ type: "m.room_membership", room_id: effectiveActiveSpaceId }],
              },
            },
            {
              type: "m.space.parent",
              state_key: effectiveActiveSpaceId,
              content: { canonical: true, via: [server] },
            },
          );
        }
      }

      const result = await client.createRoom({
        name,
        preset: (isPublic ? "public_chat" : "private_chat") as never,
        ...(isPublic ? { visibility: "public" as never } : {}),
        ...(initialState.length > 0 ? { initial_state: initialState as never } : {}),
      } as never);

      const roomId = (result as { room_id: string }).room_id;

      if (effectiveActiveSpaceId) {
        await client.sendStateEvent(
          effectiveActiveSpaceId,
          "m.space.child" as never,
          { via: [server] } as never,
          roomId,
        );
      }

      closeCreateChannel();
      setActiveRoomId(roomId);
    } catch (error) {
      console.error("[create-channel]", error);
      window.alert("Не удалось создать канал.");
    } finally {
      setCreatingChannelPending(false);
    }
  };

  const createDirectChat = async () => {
    if (!client || !selectedDmUserId || creatingDmPending) return;

    const existingRoomId = findDirectRoomId(client, selectedDmUserId);
    if (existingRoomId) {
      closeCreateDm();
      setActiveRoomId(existingRoomId);
      return;
    }

    setCreatingDmPending(true);
    try {
      const result = await client.createRoom({
        is_direct: true,
        invite: [selectedDmUserId],
        preset: "trusted_private_chat" as never,
      } as never);

      const roomId = (result as { room_id: string }).room_id;
      await ensureDirectRoomAccountData(client, selectedDmUserId, roomId);

      closeCreateDm();
      setActiveRoomId(roomId);
    } catch (error) {
      console.error("[create-dm]", error);
      window.alert("Не удалось создать личный чат.");
    } finally {
      setCreatingDmPending(false);
    }
  };

  const reorderFavouriteRooms = (rooms: typeof roomGroups.favourites) => {
    if (!client) return;
    if (favouritePersistTimer.current) {
      window.clearTimeout(favouritePersistTimer.current);
    }
    favouritePersistTimer.current = window.setTimeout(() => {
      rooms.forEach((room, index) => {
        const order = rooms.length > 1 ? index / (rooms.length - 1) : 0;
        void client.setRoomTag(room.id, "m.favourite", { order });
      });
    }, 180);
  };

  const activeRoomRef = useRef(activeRoom);
  const forwardingRef = useRef(forwarding);
  const lightboxRef = useRef(lightbox);
  const messageMenuRef = useRef(messageMenu);

  useEffect(() => {
    activeRoomRef.current = activeRoom;
    forwardingRef.current = forwarding;
    lightboxRef.current = lightbox;
    messageMenuRef.current = messageMenu;
  }, [activeRoom, forwarding, lightbox, messageMenu]);

  useEffect(() => {
    return () => {
      if (highlightTimer.current) {
        window.clearTimeout(highlightTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!client || !creatingDm) return;

    const term = dmQuery.trim();
    const myUserId = client.getUserId();

    if (term.length < 2) return;

    let alive = true;

    const timer = window.setTimeout(() => {
      setDmSearching(true);
      void client.searchUserDirectory({ term, limit: 8 })
        .then((response) => {
          if (!alive) return;

          const results = (response.results ?? [])
            .filter((entry) => entry.user_id !== myUserId)
            .map((entry) => ({
              user_id: entry.user_id,
              display_name: entry.display_name,
              avatar_url: entry.avatar_url,
            }));

          setDmResults(results);
          setSelectedDmUserId((current) => (
            current && results.some((entry) => entry.user_id === current)
              ? current
              : results[0]?.user_id ?? null
          ));
        })
        .catch((error) => {
          if (!alive) return;
          console.error("[search-user-directory]", error);
          setDmResults([]);
          setSelectedDmUserId(null);
        })
        .finally(() => {
          if (!alive) return;
          setDmSearching(false);
        });
    }, 180);

    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [client, creatingDm, dmQuery]);

  useEffect(() => {
    if (!creatingSpace && !creatingChannel && !creatingDm) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (creatingDm) {
          closeCreateDm();
          return;
        }
        if (creatingChannel) {
          closeCreateChannel();
          return;
        }
        closeCreateSpace();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [creatingChannel, creatingDm, creatingSpace]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;

      if (forwardingRef.current) {
        event.preventDefault();
        setForwarding(null);
        return;
      }
      if (lightboxRef.current) {
        event.preventDefault();
        setLightbox(null);
        return;
      }
      if (messageMenuRef.current) {
        event.preventDefault();
        setMessageMenu(null);
        return;
      }
      if (composerRef.current?.escape()) {
        event.preventDefault();
        return;
      }
      if (activeRoomRef.current) {
        event.preventDefault();
        setActiveRoomId(null);
        setPinnedIndex(0);
        setHighlightMessageId(null);
        setOptimisticPinnedIds(null);
        setRightPanelSection("overview");
        setMessageMenu(null);
        clearComposerMode();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="chat-shell">
      <nav className="space-rail">
        <button
          className={`space-rail__home${effectiveActiveSpaceId === null ? " is-active" : ""}`}
          title="Все чаты"
          onClick={() => setActiveSpaceId(null)}
        >
          {effectiveActiveSpaceId === null && <span className="space-rail__indicator" />}
          S
        </button>
        <div className="space-rail__spaces">
          {roomGroups.spaces.map((space) => (
            <button
              key={space.id}
              className={`space-rail__item${effectiveActiveSpaceId === space.id ? " is-active" : ""}`}
              style={{ background: space.color }}
              title={space.name}
              onClick={() => setActiveSpaceId(space.id)}
            >
              {effectiveActiveSpaceId === space.id && <span className="space-rail__indicator" />}
              {space.label}
            </button>
          ))}
        </div>
        <button
          className="space-rail__item space-rail__item--add"
          title="Создать пространство"
          onClick={openCreateSpace}
        >
          <Plus size={20} />
        </button>
        <button
          className="space-rail__logout"
          title="Выйти"
          onClick={() => void logout()}
        >
          <LogOut size={18} />
        </button>
      </nav>

      <motion.div
        className="chat-shell__room-list"
        animate={{
          width: roomListWidth,
          minWidth: roomListWidth,
          flexBasis: roomListWidth,
        }}
        transition={roomListResizing ? { duration: 0 } : transition.slow}
      >
        <RoomList
          favourites={visibleRoomGroups.favourites}
          channels={visibleRoomGroups.channels}
          dms={visibleRoomGroups.dms}
          activeRoomId={activeRoomId}
          collapsed={roomListCollapsed}
          activeSpaceId={effectiveActiveSpaceId}
          onToggleCollapsed={toggleRoomListCollapse}
          onSelectRoom={selectRoom}
          onToggleFavourite={toggleFavouriteRoom}
          onReorderFavourites={reorderFavouriteRooms}
          onCreateChannel={openCreateChannel}
          onCreateDm={openCreateDm}
        />
        <div
          className={`chat-shell__room-list-resizer${roomListResizing ? " is-active" : ""}`}
          onPointerDown={startRoomListResize}
        />
      </motion.div>

      <main className={`chat-main${activeRoom ? "" : " is-empty"}`}>
        {activeRoom ? (
          <>
            <header className="chat-main__header">
              <div className="chat-main__title">
                {activeRoom.kind === "channel" && <Hash size={18} strokeWidth={2.5} />}
                <h1>{activeRoom.name}</h1>
              </div>
              <div className="chat-main__actions">
                <button
                  type="button"
                  className="icon-button"
                  title={chatView === "bubbles" ? "Вид: пузыри -> плоский" : "Вид: плоский -> пузыри"}
                  onClick={() => setChatView((value) => (value === "bubbles" ? "flat" : "bubbles"))}
                >
                  {chatView === "bubbles" ? <AlignLeft size={18} /> : <MessageSquare size={18} />}
                </button>
                <button type="button" className="icon-button" title="Звонок">
                  <Phone size={18} />
                </button>
                <button type="button" className="icon-button" title="Видео">
                  <Video size={18} />
                </button>
                <button
                  type="button"
                  className={`icon-button${showRightPanel ? " is-active" : ""}`}
                  title="Информация"
                  onClick={() => setShowRightPanel((value) => !value)}
                >
                  <PanelRight size={18} />
                </button>
              </div>
            </header>
            <AnimatePresence initial={false}>
              {pinnedMessages.length > 0 && (() => {
                const currentIndex = pinnedMessages.length > 0 ? pinnedIndex % pinnedMessages.length : 0;
                const current = pinnedMessages[currentIndex];
                if (!current) return null;

                return (
                  <motion.button
                    type="button"
                    className="pinned-bar"
                    onClick={cyclePinnedMessage}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={transition.fast}
                  >
                    {pinnedMessages.length > 1 && (
                      <div className="pinned-bar__segments">
                        {pinnedMessages.map((message, index) => (
                          <span
                            key={message.id}
                            className={`pinned-bar__segment${index === currentIndex ? " is-active" : ""}`}
                          />
                        ))}
                      </div>
                    )}
                    <Pin size={15} className="pinned-bar__icon" />
                    <div className="pinned-bar__body">
                      <span className="pinned-bar__label">
                        Закреплённое{pinnedMessages.length > 1 ? ` · ${currentIndex + 1}/${pinnedMessages.length}` : ""}
                      </span>
                      <span className="pinned-bar__text">{current.text ?? "Сообщение"}</span>
                    </div>
                  </motion.button>
                );
              })()}
            </AnimatePresence>
            <AnimatePresence mode="wait">
              <Timeline
                key={activeRoom.id}
                highlightMessageId={highlightMessageId}
                messages={messages}
                onOpenImage={setLightbox}
                onOpenMessageMenu={openMessageMenu}
                onToggleReaction={toggleReaction}
                room={activeRoom}
                view={chatView}
              />
            </AnimatePresence>
            <Composer
              ref={composerRef}
              key={composerKey}
              roomId={activeRoom.id}
              editingMessage={editingMessage}
              pendingForward={pendingForward}
              replyTo={replyTo}
              onCancelEdit={() => setEditingMessage(null)}
              onCancelForward={() => setPendingForward(null)}
              onCancelReply={() => setReplyTo(null)}
              onSent={clearComposerMode}
            />
          </>
        ) : (
          <section className="chat-main__placeholder">
            <EmptyState />
          </section>
        )}
      </main>
      <AnimatePresence initial={false}>
        {activeRoom && showRightPanel && (
          <motion.aside
            className="right-panel"
            initial={{ width: 0 }}
            animate={{ width: RIGHT_PANEL_WIDTH }}
            exit={{ width: 0 }}
            transition={transition.slow}
          >
            <div className="right-panel__inner">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={`${activeRoom.id}:${rightPanelSection}`}
                  className="right-panel__content"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={transition.fast}
                >
                  <div className="right-panel__avatar" style={{ background: activeRoom.color }}>
                    {activeRoom.avatarUrl ? (
                      <img
                        className="right-panel__avatar-img"
                        src={activeRoom.avatarUrl}
                        alt=""
                        onError={hideImage}
                      />
                    ) : null}
                    <span className="right-panel__avatar-fallback">
                      {activeRoom.kind === "channel" ? <Hash size={34} /> : activeRoom.name.slice(0, 1).toUpperCase()}
                    </span>
                  </div>
                  <strong className="right-panel__name">{activeRoom.name}</strong>
                  <span className="right-panel__sub">
                    {activeRoom.kind === "channel" ? "Канал" : "Личный чат"} · {membersLabel(activeRoom.memberCount)}
                  </span>
                  {activeRoom.topic && <div className="right-panel__topic">{activeRoom.topic}</div>}

                  {rightPanelSection === "overview" ? (
                    <div className="right-panel__rows">
                      <button type="button" className="right-panel__row" onClick={() => setRightPanelSection("members")}>
                        <Users size={18} />
                        <span>Участники</span>
                        <em>{roomMembers.length}</em>
                        <ChevronRight size={16} />
                      </button>
                      <button type="button" className="right-panel__row" onClick={() => setRightPanelSection("media")}>
                        <FileText size={18} />
                        <span>Файлы и медиа</span>
                        <em>{roomMedia.length}</em>
                        <ChevronRight size={16} />
                      </button>
                      <button
                        type="button"
                        className="right-panel__row"
                        onClick={() => setRightPanelSection("notifications")}
                      >
                        <Bell size={18} />
                        <span>Уведомления</span>
                        <em>{activeRoom.unread > 0 ? activeRoom.unread : "По умолчанию"}</em>
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="right-panel__section-head">
                        <button
                          type="button"
                          className="right-panel__back"
                          onClick={() => setRightPanelSection("overview")}
                        >
                          <ArrowLeft size={16} />
                        </button>
                        <strong className="right-panel__section-title">
                          {rightPanelSection === "members"
                            ? "Участники"
                            : rightPanelSection === "media"
                              ? "Файлы и медиа"
                              : "Уведомления"}
                        </strong>
                      </div>

                      {rightPanelSection === "members" ? (
                        <div className="right-panel__list">
                          {roomMembers.map((member) => (
                            <div key={member.id} className="right-panel__member">
                              <div className="right-panel__member-avatar" style={{ background: member.color }}>
                                {member.avatarUrl ? (
                                  <img
                                    className="right-panel__member-avatar-img"
                                    src={member.avatarUrl}
                                    alt=""
                                    onError={hideImage}
                                  />
                                ) : null}
                                <span className="right-panel__member-avatar-fallback">
                                  {(member.name[0] || "?").toUpperCase()}
                                </span>
                              </div>
                              <div className="right-panel__member-body">
                                <strong>{member.name}</strong>
                                <span>{member.me ? "Вы" : member.userId}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : rightPanelSection === "media" ? (
                        roomMedia.length > 0 ? (
                          <div className="right-panel__list">
                            {roomMedia.map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                className="right-panel__media"
                                onClick={() => item.media.kind === "image" && setLightbox(item.media.url)}
                              >
                                <div className="right-panel__media-preview">
                                  {item.media.kind === "image" && item.media.thumbUrl ? (
                                    <img src={item.media.thumbUrl} alt="" />
                                  ) : (
                                    <span>{mediaKindLabel(item.media.kind)}</span>
                                  )}
                                </div>
                                <div className="right-panel__media-body">
                                  <strong>{item.media.name}</strong>
                                  <span>
                                    {item.author} · {item.time}
                                  </span>
                                </div>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="right-panel__empty">
                            <FileText size={18} />
                            <span>В этой комнате пока нет файлов и медиа.</span>
                          </div>
                        )
                      ) : (
                        <div className="right-panel__cards">
                          <div className="right-panel__card">
                            <span>Режим комнаты</span>
                            <strong>По умолчанию</strong>
                          </div>
                          <div className="right-panel__card">
                            <span>Непрочитанные</span>
                            <strong>{activeRoom.unread}</strong>
                          </div>
                          <div className="right-panel__card">
                            <span>Избранное</span>
                            <strong>{activeRoom.favourite ? "Да" : "Нет"}</strong>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {messageMenu && (
        <MessageContextMenu
          canPin={canPinMessages}
          message={messageMenu.message}
          x={messageMenu.x}
          y={messageMenu.y}
            onAction={handleMessageAction}
            onReact={toggleReaction}
            onClose={() => setMessageMenu(null)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {forwarding && (
          <ForwardModal
            rooms={allRooms}
            title={forwarding.length > 1 ? `Переслать (${forwarding.length}) в...` : "Переслать в..."}
            onClose={() => setForwarding(null)}
            onSelectRoom={selectForwardRoom}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {lightbox && (
          <motion.div
            className="lightbox"
            onMouseDown={() => setLightbox(null)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transition.fast}
          >
            <motion.img
              className="lightbox__image"
              src={lightbox}
              alt=""
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={transition.fast}
              onMouseDown={(event) => event.stopPropagation()}
            />
            <button type="button" className="lightbox__close" title="Закрыть">
              <X size={20} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {creatingChannel && (
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeCreateChannel}
          >
            <motion.div
              className="spacemodal"
              role="dialog"
              aria-modal="true"
              aria-label="Создать канал"
              onClick={(event) => event.stopPropagation()}
              initial={{ scale: 0.94, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 8 }}
              transition={transition.base}
            >
              <button className="spacemodal__close" onClick={closeCreateChannel} aria-label="Закрыть">
                <X size={18} />
              </button>

              <div className="spacemodal__heading">Новый канал</div>

              <div
                className="spacemodal__avatar spacemodal__avatar--static"
                style={{ background: colorForId(newChannelName || effectiveActiveSpaceId || "channel") }}
              >
                {newChannelName.trim() ? newChannelName.trim()[0].toUpperCase() : <Hash size={34} />}
              </div>

              <input
                autoFocus
                className="spacemodal__name"
                placeholder="Название канала"
                value={newChannelName}
                onChange={(event) => setNewChannelName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && newChannelName.trim()) {
                    void createChannel();
                  }
                }}
              />

              <div className="spacemodal__toggle">
                <button
                  type="button"
                  className={newChannelType === "private" ? "is-active" : ""}
                  onClick={() => setNewChannelType("private")}
                >
                  {newChannelType === "private" && (
                    <motion.span className="seg-pill" layoutId="channel-seg" transition={transition.base} />
                  )}
                  <span className="seg-label"><Lock size={15} /> Приватный</span>
                </button>
                <button
                  type="button"
                  className={newChannelType === "public" ? "is-active" : ""}
                  onClick={() => setNewChannelType("public")}
                >
                  {newChannelType === "public" && (
                    <motion.span className="seg-pill" layoutId="channel-seg" transition={transition.base} />
                  )}
                  <span className="seg-label"><Globe size={15} /> Публичный</span>
                </button>
              </div>

              <p className="spacemodal__hint">
                {effectiveActiveSpaceId
                  ? `Канал будет создан внутри пространства ${activeSpace?.name ?? "без названия"}.`
                  : "Канал появится в общем списке чатов."}{" "}
                {newChannelType === "private"
                  ? "Для приватного канала доступ будет ограничен."
                  : "Для публичного канала можно открыть общий доступ."}
              </p>

              <button
                className="spacemodal__create"
                onClick={() => void createChannel()}
                disabled={!newChannelName.trim() || creatingChannelPending}
              >
                {creatingChannelPending ? "Создаём..." : "Создать канал"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {creatingDm && (
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeCreateDm}
          >
            <motion.div
              className="spacemodal"
              role="dialog"
              aria-modal="true"
              aria-label="Создать личный чат"
              onClick={(event) => event.stopPropagation()}
              initial={{ scale: 0.94, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 8 }}
              transition={transition.base}
            >
              <button className="spacemodal__close" onClick={closeCreateDm} aria-label="Закрыть">
                <X size={18} />
              </button>

              <div className="spacemodal__heading">Новый личный чат</div>

              <div
                className="spacemodal__avatar spacemodal__avatar--static"
                style={{ background: colorForId(selectedDmUserId || dmQuery || "dm") }}
              >
                <UserPlus size={32} />
              </div>

              <label className="spacemodal__search">
                <Search size={16} />
                <input
                  autoFocus
                  className="spacemodal__searchInput"
                  placeholder="Имя или Matrix ID"
                  value={dmQuery}
                  onChange={(event) => {
                    const value = event.target.value;
                    setDmQuery(value);
                    const trimmed = value.trim();
                    if (trimmed.length < 2) {
                      setDmResults([]);
                      setSelectedDmUserId(null);
                      setDmSearching(false);
                    } else {
                      setDmSearching(true);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && selectedDmUserId) {
                      event.preventDefault();
                      void createDirectChat();
                    }
                  }}
                />
              </label>

              <div className="spacemodal__userlist">
                {dmQuery.trim().length < 2 ? (
                  <div className="spacemodal__empty">Введите хотя бы 2 символа, чтобы найти пользователя.</div>
                ) : dmSearching ? (
                  <div className="spacemodal__empty">Ищем пользователей...</div>
                ) : dmResults.length > 0 ? (
                  dmResults.map((entry) => {
                    const active = entry.user_id === selectedDmUserId;
                    return (
                      <button
                        key={entry.user_id}
                        type="button"
                        className={`spacemodal__user${active ? " is-active" : ""}`}
                        onClick={() => setSelectedDmUserId(entry.user_id)}
                      >
                        <span
                          className="spacemodal__userAvatar"
                          style={{ background: colorForId(entry.user_id) }}
                        >
                          {(entry.display_name || entry.user_id)[0]?.toUpperCase() ?? "?"}
                        </span>
                        <span className="spacemodal__userBody">
                          <strong>{entry.display_name || entry.user_id}</strong>
                          {entry.display_name && <span>{entry.user_id}</span>}
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <div className="spacemodal__empty">Никого не нашли.</div>
                )}
              </div>

              <p className="spacemodal__hint">
                Если личный чат с этим пользователем уже есть, мы просто откроем существующий.
              </p>

              <button
                className="spacemodal__create"
                onClick={() => void createDirectChat()}
                disabled={!selectedDmUserId || creatingDmPending}
              >
                {creatingDmPending ? "Создаём..." : "Создать личный чат"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {creatingSpace && (
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeCreateSpace}
          >
            <motion.div
              className="spacemodal"
              role="dialog"
              aria-modal="true"
              aria-label="Создать пространство"
              onClick={(event) => event.stopPropagation()}
              initial={{ scale: 0.94, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 8 }}
              transition={transition.base}
            >
              <button className="spacemodal__close" onClick={closeCreateSpace} aria-label="Закрыть">
                <X size={18} />
              </button>

              <div className="spacemodal__heading">Новое пространство</div>

              <button
                type="button"
                className="spacemodal__avatar"
                style={spaceAvatarPreview ? undefined : { background: colorForId(newSpaceName || "space") }}
                onClick={() => spaceAvatarInputRef.current?.click()}
                title="Загрузить картинку"
              >
                {spaceAvatarPreview ? (
                  <img className="spacemodal__avatarImg" src={spaceAvatarPreview} alt="" />
                ) : newSpaceName.trim() ? (
                  newSpaceName.trim()[0].toUpperCase()
                ) : (
                  <Boxes size={34} />
                )}
                <span className="spacemodal__avatarCam">
                  <Camera size={16} />
                </span>
              </button>

              <input
                ref={spaceAvatarInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={pickSpaceAvatar}
              />

              <input
                autoFocus
                className="spacemodal__name"
                placeholder="Название пространства"
                value={newSpaceName}
                onChange={(event) => setNewSpaceName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && newSpaceName.trim()) {
                    void createSpace();
                  }
                }}
              />

              <div className="spacemodal__toggle">
                <button
                  type="button"
                  className={newSpaceType === "private" ? "is-active" : ""}
                  onClick={() => setNewSpaceType("private")}
                >
                  {newSpaceType === "private" && (
                    <motion.span className="seg-pill" layoutId="space-seg" transition={transition.base} />
                  )}
                  <span className="seg-label"><Lock size={15} /> Приватное</span>
                </button>
                <button
                  type="button"
                  className={newSpaceType === "public" ? "is-active" : ""}
                  onClick={() => setNewSpaceType("public")}
                >
                  {newSpaceType === "public" && (
                    <motion.span className="seg-pill" layoutId="space-seg" transition={transition.base} />
                  )}
                  <span className="seg-label"><Globe size={15} /> Публичное</span>
                </button>
              </div>

              <p className="spacemodal__hint">
                {newSpaceType === "private"
                  ? "Доступ по группе или приглашению."
                  : "Войти может любой сотрудник."}{" "}
                Внутри создастся канал #general.
              </p>

              <button
                className="spacemodal__create"
                onClick={() => void createSpace()}
                disabled={!newSpaceName.trim() || creatingSpacePending}
              >
                {creatingSpacePending ? "Создаём..." : "Создать пространство"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function membersLabel(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} участник`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} участника`;
  return `${count} участников`;
}

function findDirectRoomId(client: MatrixClient, targetUserId: string): string | null {
  const direct = (client.getAccountData("m.direct" as never)?.getContent() ?? {}) as Record<string, string[]>;
  const explicit = Array.isArray(direct[targetUserId]) ? direct[targetUserId] : [];

  for (const roomId of explicit) {
    const room = client.getRoom(roomId);
    if (room && room.getMyMembership() === "join") return roomId;
  }

  const me = client.getUserId();
  for (const room of client.getRooms()) {
    if (room.isSpaceRoom()) continue;
    if (room.getMyMembership() !== "join") continue;
    const members = room.getJoinedMembers();
    if (members.length !== 2) continue;
    const hasTarget = members.some((member) => member.userId === targetUserId);
    const hasMe = members.some((member) => member.userId === me);
    if (hasTarget && hasMe) return room.roomId;
  }

  return null;
}

async function ensureDirectRoomAccountData(client: MatrixClient, targetUserId: string, roomId: string): Promise<void> {
  const content = {
    ...((client.getAccountData("m.direct" as never)?.getContent() ?? {}) as Record<string, string[]>),
  };
  const roomIds = new Set(content[targetUserId] ?? []);
  roomIds.add(roomId);
  content[targetUserId] = Array.from(roomIds);
  await client.setAccountData("m.direct" as never, content as never);
}

function mediaKindLabel(kind: MatrixMedia["kind"]): string {
  switch (kind) {
    case "image":
      return "IMG";
    case "video":
      return "VID";
    case "audio":
      return "AUD";
    default:
      return "FILE";
  }
}

function hideImage(event: React.SyntheticEvent<HTMLImageElement>): void {
  event.currentTarget.style.display = "none";
}

function memberAvatarUrl(
  client: NonNullable<ReturnType<typeof useMatrix>["client"]>,
  member: ReturnType<NonNullable<ReturnType<typeof useMatrix>["client"]>["getRoom"]> extends infer T
    ? T extends { getMember(userId: string): infer M | null }
      ? M
      : never
    : never,
): string | undefined {
  const mxc = member?.getMxcAvatarUrl?.();
  if (!mxc) return undefined;
  return client.mxcUrlToHttp(mxc, 48, 48, "crop", false, true, true) ?? undefined;
}
