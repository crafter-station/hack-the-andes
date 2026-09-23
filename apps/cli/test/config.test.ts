import { expect, test } from "bun:test";

import { config } from "../src/config.js";

test("uses the canonical domain for API requests and participant links", () => {
  expect(config.apiUrl).toBe("https://hacktheandes.com");
  expect(config.publicSiteUrl).toBe("https://hacktheandes.com");
  expect(config.oauthClientId).toBe("HddO78wKpq5PFIEl");
  expect(config.authorizationUrl).toBe(
    "https://clerk.hacktheandes.com/oauth/authorize",
  );
});
