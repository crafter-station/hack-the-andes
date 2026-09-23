import { describe, expect, test } from "bun:test";

import nextConfig from "./next.config";

describe("web response security headers", () => {
  test("protects every route from framing and MIME sniffing", async () => {
    const configuredHeaders = await nextConfig.headers?.();
    const globalHeaders = configuredHeaders?.find(
      (entry) => entry.source === "/:path*",
    )?.headers;
    const values = new Map(
      globalHeaders?.map((header) => [header.key, header.value]),
    );

    expect(values.get("Content-Security-Policy")).toContain(
      "frame-ancestors 'none'",
    );
    expect(values.get("Content-Security-Policy")).toContain(
      "object-src 'none'",
    );
    expect(values.get("Strict-Transport-Security")).toContain(
      "max-age=31536000",
    );
    expect(values.get("X-Content-Type-Options")).toBe("nosniff");
    expect(values.get("X-Frame-Options")).toBe("DENY");
  });
});
