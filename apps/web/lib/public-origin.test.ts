import { expect, test } from "bun:test";

import { publicRequestOrigin } from "./public-origin";

test("prefers the forwarded public host over the bind address", () => {
  const request = new Request("https://0.0.0.0:3000/api/v1/me", {
    headers: {
      "x-forwarded-host": "hacktheandes.com",
      "x-forwarded-proto": "https",
    },
  });

  expect(publicRequestOrigin(request)).toBe("https://hacktheandes.com");
});

test("does not advertise the container bind address as an OAuth resource", () => {
  const request = new Request("https://0.0.0.0:3000/api/v1/me");

  expect(publicRequestOrigin(request)).toBe("https://hacktheandes.com");
});

test("keeps explicit public request origins", () => {
  const request = new Request("https://hack.example/api/v1/me");

  expect(publicRequestOrigin(request)).toBe("https://hack.example");
});
