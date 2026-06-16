import { describe, expect, it, vi } from "vitest";
import { makePasswordAuthCallback } from "./uia";

describe("makePasswordAuthCallback", () => {
  it("submits the password against the UIA session from the 401 probe", async () => {
    const getPassword = vi.fn().mockResolvedValue("hunter2");
    const makeRequest = vi
      .fn()
      .mockRejectedValueOnce({ data: { session: "sess-1" } }) // no-auth probe
      .mockResolvedValueOnce(undefined); // authenticated retry

    const callback = makePasswordAuthCallback("@u:hs", getPassword);
    await callback(makeRequest);

    expect(makeRequest).toHaveBeenNthCalledWith(1, null);
    expect(makeRequest).toHaveBeenNthCalledWith(2, {
      type: "m.login.password",
      identifier: { type: "m.id.user", user: "@u:hs" },
      password: "hunter2",
      session: "sess-1",
    });
  });

  it("does not ask for a password when the server needs no auth", async () => {
    const getPassword = vi.fn();
    const makeRequest = vi.fn().mockResolvedValue(undefined);

    await makePasswordAuthCallback("@u:hs", getPassword)(makeRequest);

    expect(getPassword).not.toHaveBeenCalled();
    expect(makeRequest).toHaveBeenCalledTimes(1);
  });
});
