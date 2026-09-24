import { describe, expect, test } from "bun:test";

import {
  initialsFor,
  truncate,
} from "@/components/credential/credential-model";

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
