import { auth, clerkClient } from "@clerk/nextjs/server";

import {
  configuredAdminIdsFrom,
  userGrantsApplicationReviewAccess,
} from "@/lib/admin/roles";
import { HttpError } from "@/lib/registration/http";

export interface AdminIdentity {
  readonly clerkUserId: string;
}

export const getAdminIdentity = async (): Promise<AdminIdentity | null> => {
  const authentication = await auth();
  if (!authentication.userId) return null;

  const configuredAdminIds = configuredAdminIdsFrom(
    process.env.ADMIN_CLERK_USER_IDS,
  );
  if (configuredAdminIds.has(authentication.userId)) {
    return { clerkUserId: authentication.userId };
  }

  const clerk = await clerkClient();
  const user = await clerk.users.getUser(authentication.userId);
  const hasAccess = userGrantsApplicationReviewAccess({
    clerkUserId: authentication.userId,
    configuredAdminIds,
    publicMetadata: user.publicMetadata,
    privateMetadata: user.privateMetadata,
  });
  if (hasAccess) {
    return { clerkUserId: authentication.userId };
  }
  return null;
};

export const requireAdminIdentity = async (): Promise<AdminIdentity> => {
  const identity = await getAdminIdentity();
  if (!identity) {
    throw new HttpError(403, "ADMIN_REQUIRED", "Administrator access required");
  }
  return identity;
};
