import { AuthType, type AuthDict, type MatrixError, type UIAuthCallback } from "matrix-js-sdk";

/**
 * Build a User-Interactive Auth callback that authenticates with the account
 * password — used by {@link setupEncryptionRecovery} to upload cross-signing
 * keys (most homeservers require UIA for that endpoint).
 *
 * It first probes the endpoint with no auth to obtain the UIA `session`, then
 * submits the password against that session. This covers password-based UIA;
 * OIDC/next-gen auth will need a different callback (the OpenBao rework).
 */
export function makePasswordAuthCallback(userId: string, password: string): UIAuthCallback<void> {
  return async (makeRequest) => {
    let session: string | undefined;
    try {
      // No-auth probe: a server that needs UIA answers 401 with a session id.
      await makeRequest(null);
      return;
    } catch (error) {
      session = (error as MatrixError | undefined)?.data?.session as string | undefined;
    }

    await makeRequest({
      type: AuthType.Password,
      identifier: { type: "m.id.user", user: userId },
      password,
      session: session ?? "",
    } as AuthDict);
  };
}
