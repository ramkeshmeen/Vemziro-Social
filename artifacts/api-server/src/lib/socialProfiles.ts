import { eq } from "drizzle-orm";
import { db, profilesTable } from "@workspace/db";

export async function ensureProfile(userId: string) {
  const [existing] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.id, userId))
    .limit(1);
  if (existing) return existing;

  const suffix = userId.replace(/[^a-z0-9]/gi, "").slice(-9).toLowerCase();
  const base = `member_${suffix || "new"}`;
  let username = base;
  let attempt = 1;
  while (
    (
      await db
        .select({ id: profilesTable.id })
        .from(profilesTable)
        .where(eq(profilesTable.username, username))
        .limit(1)
    ).length
  ) {
    username = `${base.slice(0, 26)}${attempt++}`;
  }

  await db
    .insert(profilesTable)
    .values({
      id: userId,
      username,
      displayName: "Vemziro member",
      avatarUrl: null,
      bio: null,
    })
    .onConflictDoNothing();
  const [created] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.id, userId))
    .limit(1);
  if (!created) throw new Error("Unable to create the member profile");
  return created;
}
