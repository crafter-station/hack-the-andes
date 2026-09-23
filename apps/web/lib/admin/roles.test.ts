import { describe, expect, test } from "bun:test";

import {
  configuredAdminIdsFrom,
  grantsApplicationReviewAccess,
  userGrantsApplicationReviewAccess,
} from "./roles";

describe("grantsApplicationReviewAccess", () => {
  test("grants access for the application reviewer role", () => {
    expect(
      grantsApplicationReviewAccess({ roles: ["application_reviewer"] }),
    ).toBe(true);
  });

  test("preserves support for the legacy admin role", () => {
    expect(grantsApplicationReviewAccess({ role: "admin" })).toBe(true);
    expect(grantsApplicationReviewAccess({ roles: ["admin"] })).toBe(true);
  });

  test("rejects unrelated or malformed roles", () => {
    expect(grantsApplicationReviewAccess({ roles: ["participant"] })).toBe(
      false,
    );
    expect(
      grantsApplicationReviewAccess({ roles: "application_reviewer" }),
    ).toBe(false);
    expect(grantsApplicationReviewAccess({})).toBe(false);
  });
});

describe("userGrantsApplicationReviewAccess", () => {
  test("accepts configured break-glass administrators", () => {
    expect(
      userGrantsApplicationReviewAccess({
        clerkUserId: "user_admin",
        configuredAdminIds: configuredAdminIdsFrom(" user_other, user_admin "),
        publicMetadata: {},
        privateMetadata: {},
      }),
    ).toBe(true);
  });

  test("checks public and private Clerk role metadata", () => {
    const configuredAdminIds = configuredAdminIdsFrom(undefined);
    expect(
      userGrantsApplicationReviewAccess({
        clerkUserId: "user_reviewer",
        configuredAdminIds,
        publicMetadata: { roles: ["application_reviewer"] },
        privateMetadata: {},
      }),
    ).toBe(true);
    expect(
      userGrantsApplicationReviewAccess({
        clerkUserId: "user_reviewer",
        configuredAdminIds,
        publicMetadata: {},
        privateMetadata: { role: "admin" },
      }),
    ).toBe(true);
  });

  test("rejects participants without reviewer access", () => {
    expect(
      userGrantsApplicationReviewAccess({
        clerkUserId: "user_participant",
        configuredAdminIds: configuredAdminIdsFrom(undefined),
        publicMetadata: { roles: ["participant"] },
        privateMetadata: {},
      }),
    ).toBe(false);
  });
});
