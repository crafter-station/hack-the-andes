import { describe, expect, test } from "bun:test";

import {
  credentialNumber,
  fnv1a,
  initialsFor,
  truncate,
} from "@/components/credential/credential-model";

describe("credentialNumber", () => {
  test("gives one person the same seat, always", () => {
    // It is derived, not recorded, so determinism across processes and
    // deploys is the only thing making it a seat rather than a random
    // number that changes when the server restarts.
    for (const name of ["Emmy Pardo", "Ada Lovelace", "a", ""]) {
      expect(credentialNumber(name)).toBe(credentialNumber(name));
    }
  });

  test("is always three digits", () => {
    for (let index = 0; index < 400; index += 1) {
      expect(credentialNumber(`Persona ${index}`)).toMatch(/^\d{3}$/);
    }
  });

  test("spreads people across the range", () => {
    // A constant would satisfy the two tests above and make every badge
    // #000.
    const seen = new Set<string>();
    for (let index = 0; index < 400; index += 1) {
      seen.add(credentialNumber(`Persona ${index}`));
    }

    expect(seen.size).toBeGreaterThan(250);
  });
});

describe("fnv1a", () => {
  test("matches the reference vectors", () => {
    // Pinned against the published FNV-1a 32-bit values rather than
    // against this implementation's own output, so a rewrite that is
    // self-consistent but wrong still fails.
    expect(fnv1a("")).toBe(0x811c9dc5);
    expect(fnv1a("a")).toBe(0xe40c292c);
    expect(fnv1a("foobar")).toBe(0xbf9cf968);
  });
});

describe("initialsFor", () => {
  test("takes a letter from each of the first two words", () => {
    expect(initialsFor("Emmy Pardo")).toBe("EP");
    expect(initialsFor("ada lovelace")).toBe("AL");
  });

  test("falls back to two letters of a single name", () => {
    // A slot designed for two characters showing one reads as a bug.
    expect(initialsFor("Prince")).toBe("PR");
  });

  test("splits on punctuation as well as spaces", () => {
    expect(initialsFor("jean-luc")).toBe("JL");
    expect(initialsFor("ana_maria")).toBe("AM");
  });

  test("answers rather than throwing on an empty name", () => {
    // `acceptedByClerkUser` refuses a nameless application, so this
    // should be unreachable — but it is the last thing between a data
    // problem and a crashed render.
    expect(initialsFor("")).toBe("??");
    expect(initialsFor("   ")).toBe("??");
  });
});

describe("truncate", () => {
  test("leaves what already fits", () => {
    expect(truncate("Emmy Pardo", 20)).toBe("Emmy Pardo");
  });

  test("marks what it cut", () => {
    const cut = truncate("Una biografía considerablemente larga", 12);

    expect(cut).toHaveLength(12);
    expect(cut.endsWith("…")).toBe(true);
  });
});
