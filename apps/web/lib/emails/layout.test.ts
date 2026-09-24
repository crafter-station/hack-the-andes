import { describe, expect, test } from "bun:test";

import { buildDecisionEmail } from "@/lib/admin/decision-email";
import { buildBadgeReadyEmail } from "@/lib/badges/email";
import { emailPalette, emailShell, RIDGE_BAND } from "@/lib/emails/layout";

describe("email shell", () => {
  test("sits on the landing's own ground", () => {
    // The event writes in one voice. The decision and badge emails used
    // to be bone with a blue band while the reminders were already dark
    // and Spanish, which is two events writing to one person.
    const html = emailShell({
      subject: "x",
      preheader: "y",
      stamp: "17–18 OCT 2026",
      blocks: [],
    });

    expect(html).toContain(emailPalette.page);
    expect(html).toContain(emailPalette.sheet);
    expect(html).toContain(RIDGE_BAND);
    expect(html).toContain('lang="es"');
  });

  test("points its images at the canonical host", () => {
    // A mail client has no page to resolve a relative path against, and
    // a preview deployment's host stops answering when it is torn down.
    expect(RIDGE_BAND.startsWith("https://hacktheandes.com/")).toBe(true);
  });

  test("escapes what a person typed", () => {
    const email = buildDecisionEmail({
      decision: "accepted",
      firstName: "Ada <Admin>",
      message: 'He said "yes" & meant it',
    });

    expect(email.html).toContain("Ada &lt;Admin&gt;");
    expect(email.html).toContain("&quot;yes&quot; &amp; meant it");
    expect(email.html).not.toContain("<Admin>");
  });

  test("gives an accepted participant the one thing to do next", () => {
    // Confirming attendance is what this email exists for, so it is the
    // button as well as the command: not everybody reading it is at a
    // terminal.
    const email = buildDecisionEmail({
      decision: "accepted",
      firstName: "Ada",
    });

    expect(email.html).toContain("chofex confirm");
    expect(email.html).toContain("Confirmar mi asistencia");
    expect(email.subject).toContain("Estás dentro");
  });

  test("sends the badge and links the card", () => {
    const email = buildBadgeReadyEmail({
      firstName: "Ada",
      badgeUrl: "https://blob.example/badge.png",
      number: "911",
      badgePageUrl: "https://hacktheandes.com/badge",
    });

    expect(email.html).toContain("https://blob.example/badge.png");
    expect(email.html).toContain("https://hacktheandes.com/badge");
    // Stamped with its own number, where a card carries one.
    expect(email.html).toContain("#911");
  });
});
