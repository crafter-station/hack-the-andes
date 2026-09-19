import { afterEach, expect, mock, test } from "bun:test";
import { Effect } from "effect";

mock.module("../src/auth.js", () => ({
  authentication: async (forceRefresh = false) => {
    if (forceRefresh) {
      throw new Error("Clerk OAuth token endpoint returned 401");
    }
    return { accessToken: "legacy-access" };
  },
}));

const { getCurrentUser } = await import("../src/api-client.js");

const originalFetch = globalThis.fetch;
const originalToken = process.env.CHOFEX_TOKEN;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalToken === undefined) {
    delete process.env.CHOFEX_TOKEN;
  } else {
    process.env.CHOFEX_TOKEN = originalToken;
  }
});

test("keeps the original 401 when a legacy refresh against the current issuer fails", async () => {
  delete process.env.CHOFEX_TOKEN;
  globalThis.fetch = async () =>
    Response.json(
      {
        version: 1,
        ok: false,
        requestId: "request-legacy-401",
        error: {
          code: "AUTHENTICATION_REQUIRED",
          message:
            "This CLI is signed in to a retired Clerk application. Update with `chofex update` or `npm install --global chofex-cli@latest`, then run `chofex logout` and `chofex login`.",
          retryable: false,
        },
      },
      { status: 401 },
    );

  const error = await Effect.runPromise(
    Effect.flip(getCurrentUser({ apiUrl: "https://hack.example" })),
  );

  expect(error.code).toBe("AUTHENTICATION_REQUIRED");
  expect(error.requestId).toBe("request-legacy-401");
  expect(error.message).toContain("chofex update");
});
