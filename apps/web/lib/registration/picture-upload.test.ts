import { describe, expect, test } from "bun:test";

import { HttpError } from "./http";
import {
  handlePictureUpload,
  type PictureUploadDependencies,
} from "./picture-upload";

const dependencies = (): PictureUploadDependencies => ({
  authorize: async () => ({
    applicationId: "application-123",
    clerkUserId: "user-123",
    target: "application",
    pendingPicturePathname:
      "profile-pictures/user-123/application-123/upload-123.png",
  }),
  reserve: async () => undefined,
  issueToken: async () => "one-file-token",
  discard: async () => undefined,
  inspect: async () => ({
    contentType: "image/png" as const,
    size: 9,
    firstBytes: new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
    ]),
  }),
  record: async () => undefined,
  remove: async () => undefined,
  randomId: () => "upload-123",
});

describe("profile picture upload HTTP endpoint", () => {
  test("authenticates an accepted participant and grants one bounded upload", async () => {
    const events: Array<string> = [];
    const request = new Request("https://hack.example/api/v1/profile-picture", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contentType: "image/png", size: 9 }),
    });
    const adapters: PictureUploadDependencies = {
      ...dependencies(),
      authorize: async () => {
        events.push("authorize");
        return {
          applicationId: "application-123",
          clerkUserId: "user-123",
          target: "application",
        };
      },
      reserve: async () => {
        events.push("reserve");
      },
      issueToken: async (options) => {
        events.push("issue");
        expect(options).toEqual({
          pathname: "profile-pictures/user-123/application-123/upload-123.png",
          contentType: "image/png",
          maximumSizeInBytes: 5 * 1024 * 1024,
        });
        return "one-file-token";
      },
    };

    expect(await handlePictureUpload(request, adapters)).toEqual({
      pathname: "profile-pictures/user-123/application-123/upload-123.png",
      clientToken: "one-file-token",
    });
    expect(events).toEqual(["authorize", "reserve", "issue"]);
  });

  test("rejects files larger than 5 MB before reserving storage", async () => {
    const request = new Request("https://hack.example/api/v1/profile-picture", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contentType: "image/png",
        size: 5 * 1024 * 1024 + 1,
      }),
    });
    let reserved = false;
    const adapters: PictureUploadDependencies = {
      ...dependencies(),
      reserve: async () => {
        reserved = true;
      },
    };

    await expect(handlePictureUpload(request, adapters)).rejects.toMatchObject({
      status: 422,
      code: "VALIDATION_ERROR",
    });
    expect(reserved).toBe(false);
  });

  test("does not issue storage access when authorization or quota fails", async () => {
    const request = () =>
      new Request("https://hack.example/api/v1/profile-picture", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contentType: "image/png", size: 9 }),
      });
    let issued = false;
    const issueToken = async () => {
      issued = true;
      return "token";
    };

    await expect(
      handlePictureUpload(request(), {
        ...dependencies(),
        authorize: async () => {
          throw new HttpError(403, "PICTURE_UPLOAD_FORBIDDEN", "Not accepted");
        },
        issueToken,
      }),
    ).rejects.toMatchObject({ code: "PICTURE_UPLOAD_FORBIDDEN" });
    await expect(
      handlePictureUpload(request(), {
        ...dependencies(),
        reserve: async () => {
          throw new HttpError(429, "PICTURE_UPLOAD_RATE_LIMITED", "Quota used");
        },
        issueToken,
      }),
    ).rejects.toMatchObject({ code: "PICTURE_UPLOAD_RATE_LIMITED" });
    expect(issued).toBe(false);
  });

  test("discards the reservation when issuing storage access fails", async () => {
    const request = new Request("https://hack.example/api/v1/profile-picture", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contentType: "image/png", size: 9 }),
    });
    const tokenError = new Error("Storage is unavailable");
    let discardedPathname: string | undefined;
    const adapters: PictureUploadDependencies = {
      ...dependencies(),
      authorize: async () => ({
        applicationId: "application-123",
        clerkUserId: "user-123",
        target: "application",
      }),
      issueToken: async () => {
        throw tokenError;
      },
      discard: async (_identity, pathname) => {
        discardedPathname = pathname;
      },
    };

    await expect(handlePictureUpload(request, adapters)).rejects.toBe(
      tokenError,
    );
    expect(discardedPathname).toBe(
      "profile-pictures/user-123/application-123/upload-123.png",
    );
  });

  test("rejects replayed completion before reading Blob storage", async () => {
    const request = new Request("https://hack.example/api/v1/profile-picture", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        pathname: "profile-pictures/user-123/application-123/upload-123.png",
        url: "https://blob.example/upload-123.png",
      }),
    });
    let inspected = false;

    await expect(
      handlePictureUpload(request, {
        ...dependencies(),
        authorize: async () => ({
          applicationId: "application-123",
          clerkUserId: "user-123",
          target: "application",
        }),
        inspect: async () => {
          inspected = true;
          return dependencies().inspect({ pathname: "", url: "" });
        },
      }),
    ).rejects.toMatchObject({ code: "PICTURE_UPLOAD_NOT_PENDING" });
    expect(inspected).toBe(false);
  });

  test("deletes a completed upload when its bytes do not match its type", async () => {
    const request = new Request("https://hack.example/api/v1/profile-picture", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        pathname: "profile-pictures/user-123/application-123/upload-123.png",
        url: "https://blob.example/upload-123.png",
      }),
    });
    let removed: string | undefined;
    let discarded = false;
    let recorded = false;
    const adapters: PictureUploadDependencies = {
      ...dependencies(),
      inspect: async () => ({
        contentType: "image/png",
        size: 18,
        firstBytes: new TextEncoder().encode("not really a PNG"),
      }),
      remove: async (target) => {
        removed = target;
      },
      discard: async () => {
        discarded = true;
      },
      record: async () => {
        recorded = true;
        return undefined;
      },
    };

    await expect(handlePictureUpload(request, adapters)).rejects.toMatchObject({
      status: 415,
      code: "INVALID_PICTURE",
    });
    expect(removed).toBe(
      "profile-pictures/user-123/application-123/upload-123.png",
    );
    expect(discarded).toBe(true);
    expect(recorded).toBe(false);
  });
});
