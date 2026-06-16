import type { MatrixClient } from "matrix-js-sdk";
import { describe, expect, it, vi } from "vitest";
import { mxcThumbnailUrl } from "./avatar";

describe("mxcThumbnailUrl", () => {
  it("resolves an mxc uri to a cropped square thumbnail", () => {
    const mxcUrlToHttp = vi.fn().mockReturnValue("https://media/thumb");
    const client = { mxcUrlToHttp } as unknown as MatrixClient;

    expect(mxcThumbnailUrl(client, "mxc://server/abc", 48)).toBe("https://media/thumb");
    expect(mxcUrlToHttp).toHaveBeenCalledWith("mxc://server/abc", 48, 48, "crop", false, true, true);
  });

  it("returns undefined when there is no mxc", () => {
    const mxcUrlToHttp = vi.fn();
    const client = { mxcUrlToHttp } as unknown as MatrixClient;

    expect(mxcThumbnailUrl(client, null, 48)).toBeUndefined();
    expect(mxcThumbnailUrl(client, undefined, 48)).toBeUndefined();
    expect(mxcUrlToHttp).not.toHaveBeenCalled();
  });

  it("returns undefined when the sdk yields null", () => {
    const client = { mxcUrlToHttp: vi.fn().mockReturnValue(null) } as unknown as MatrixClient;
    expect(mxcThumbnailUrl(client, "mxc://server/abc", 96)).toBeUndefined();
  });
});
