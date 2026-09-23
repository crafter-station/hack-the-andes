import { describe, expect, test } from "bun:test";

import { escapeXml } from "./image";

describe("badge image", () => {
  test("escapes participant names before placing them in markup", () => {
    // The name reaches the badge-ready email's HTML, which is the one
    // place left that interpolates it into markup by hand.
    expect(escapeXml('Ada <script> & "Grace"')).toBe(
      "Ada &lt;script&gt; &amp; &quot;Grace&quot;",
    );
  });
});
