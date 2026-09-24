import { db } from "@chofex/db";
import { eq } from "@chofex/db/orm";
import { participants } from "@chofex/db/schema";

export const participantIdFor = async (
  clerkUserId: string,
  defaultName?: string,
): Promise<string> => {
  const [existing] = await db
    .select({ id: participants.id, name: participants.name })
    .from(participants)
    .where(eq(participants.clerkUserId, clerkUserId))
    .limit(1);
  const name = defaultName?.trim() || undefined;
  if (existing) {
    if (!existing.name && name) {
      await db
        .update(participants)
        .set({ name, updatedAt: new Date() })
        .where(eq(participants.id, existing.id));
    }
    return existing.id;
  }

  const [created] = await db
    .insert(participants)
    .values({ clerkUserId, name })
    .onConflictDoNothing()
    .returning({ id: participants.id });
  if (created) return created.id;

  const [concurrent] = await db
    .select({ id: participants.id })
    .from(participants)
    .where(eq(participants.clerkUserId, clerkUserId))
    .limit(1);
  if (!concurrent) throw new Error("Participant creation returned no row");
  return concurrent.id;
};
