import type { MatrixClient } from "matrix-js-sdk";
import { describe, expect, it, vi } from "vitest";
import { getAccountProfile, saveAccountProfile, type AccountProfile } from "./profile";

describe("account profile", () => {
  it("reads current profile", async () => {
    const client = fakeClient({
      getProfileInfo: vi.fn().mockResolvedValue({
        displayname: "Oleg",
        avatar_url: "mxc://server/avatar",
      }),
    });

    await expect(getAccountProfile(client)).resolves.toEqual({
      userId: "@me:server",
      displayName: "Oleg",
      avatarMxc: "mxc://server/avatar",
      avatarUrl: "https://media/avatar",
    });
  });

  it("saves avatar and display name", async () => {
    const setAvatarUrl = vi.fn().mockResolvedValue(undefined);
    const setDisplayName = vi.fn().mockResolvedValue(undefined);
    const uploadContent = vi.fn().mockResolvedValue({ content_uri: "mxc://server/new-avatar" });
    const getProfileInfo = vi.fn().mockResolvedValue({ displayname: "New" });
    const client = fakeClient({ getProfileInfo, setAvatarUrl, setDisplayName, uploadContent });
    const current: AccountProfile = { userId: "@me:server", displayName: "Old" };
    const avatarFile = new File(["avatar"], "avatar.png", { type: "image/png" });

    await saveAccountProfile(client, current, {
      displayName: "New",
      avatarFile,
    });

    expect(uploadContent).toHaveBeenCalledWith(avatarFile, { type: "image/png" });
    expect(setAvatarUrl).toHaveBeenCalledWith("mxc://server/new-avatar");
    expect(setDisplayName).toHaveBeenCalledWith("New");
  });
});

function fakeClient({
  getProfileInfo = vi.fn(),
  setAvatarUrl = vi.fn(),
  setDisplayName = vi.fn(),
  uploadContent = vi.fn(),
}: {
  getProfileInfo?: ReturnType<typeof vi.fn>;
  setAvatarUrl?: ReturnType<typeof vi.fn>;
  setDisplayName?: ReturnType<typeof vi.fn>;
  uploadContent?: ReturnType<typeof vi.fn>;
}): MatrixClient {
  return {
    getUserId: () => "@me:server",
    getProfileInfo,
    mxcUrlToHttp: () => "https://media/avatar",
    setAvatarUrl,
    setDisplayName,
    uploadContent,
  } as unknown as MatrixClient;
}
