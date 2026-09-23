import { HttpError } from "./http";

/**
 * The size an avatar is fetched at, by what is going to look at it.
 *
 * A list of candidates wants a thumbnail. A credential does not: its
 * photo window is 490px and the emailed badge screens an 800px portrait,
 * and both were being fed a 112px image — 2.5 KB upscaled four times,
 * which is why the halftone came out as mush. 460 is what GitHub
 * actually serves; asking for more returns the same bytes.
 */
export const AVATAR_THUMBNAIL = 112;
export const AVATAR_PORTRAIT = 460;

export const githubAvatarUrl = (
  githubUrl: string | null | undefined,
  size: number = AVATAR_THUMBNAIL,
): string | undefined => {
  if (!githubUrl) return undefined;
  try {
    const url = new URL(githubUrl);
    const isGitHub =
      url.protocol === "https:" &&
      (url.hostname === "github.com" || url.hostname === "www.github.com");
    if (!isGitHub) return undefined;
    const [username] = url.pathname.split("/").filter(Boolean);
    if (!username) return undefined;
    return `https://github.com/${encodeURIComponent(username)}.png?size=${size}`;
  } catch {
    return undefined;
  }
};

export const confirmedPictureUrl = (
  source: "clerk" | "github" | "upload",
  options: {
    readonly clerkPictureUrl?: string;
    readonly githubUrl?: string | null;
    readonly uploadedPictureUrl?: string | null;
  },
): string => {
  let url: string | undefined;
  if (source === "clerk") url = options.clerkPictureUrl;
  if (source === "github") {
    url = githubAvatarUrl(options.githubUrl, AVATAR_PORTRAIT);
  }
  if (source === "upload") url = options.uploadedPictureUrl ?? undefined;
  if (url) return url;
  throw new HttpError(
    422,
    "PICTURE_SOURCE_UNAVAILABLE",
    `The selected ${source} picture is not available`,
  );
};
