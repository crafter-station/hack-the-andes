import { afterEach, describe, expect, test } from "bun:test";

import { sendBadgeReadyEmail } from "./email";

const originalFetch = globalThis.fetch;
const originalApiKey = process.env.RESEND_API_KEY;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalApiKey) {
    process.env.RESEND_API_KEY = originalApiKey;
  } else {
    delete process.env.RESEND_API_KEY;
  }
});

describe("badge-ready email", () => {
  test("sends one idempotent, HTML-safe notification", async () => {
    process.env.RESEND_API_KEY = "test-key";
    let headers = new Headers();
    let body: Record<string, unknown> = {};
    const mockFetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
      headers = new Headers(init?.headers);
      body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(null, { status: 200 });
    };
    globalThis.fetch = Object.assign(mockFetch, {
      preconnect: originalFetch.preconnect,
    });

    await sendBadgeReadyEmail({
      applicationId: "application-123",
      email: "ada@example.com",
      firstName: "Ada <Admin>",
      badgeUrl: "https://example.com/badge.png?a=1&b=2",
      placement: "BLACK BOX · #07",
      badgePageUrl: "https://hacktheandes.com/badge",
      generationId: "run-456",
    });

    expect(headers.get("idempotency-key")).toBe(
      "participant-badge/application-123/run-456",
    );
    expect(body.from).toBe("hackathons@crafterstation.com");
    expect(body.reply_to).toBe("anthony@crafterstation.com");
    expect(body.html).toContain("Ada &lt;Admin&gt;");
    expect(body.html).toContain("a=1&amp;b=2");
    // The face, and a way to the card — not a flattened picture of one.
    expect(body.html).toContain("https://hacktheandes.com/badge");
    expect(body.html).toContain("chofex badge regenerate");
  });
});
