import {
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { applications } from "./applications";
import { auditTimestamps } from "./common";
import { badgeGenerationStatus, pictureSource } from "./enums";

export const participantBadges = pgTable("participant_badges", {
  applicationId: uuid("application_id")
    .primaryKey()
    .references(() => applications.id, { onDelete: "cascade" }),
  status: badgeGenerationStatus("status").default("pending").notNull(),
  triggerRunId: text("trigger_run_id"),
  displayName: varchar("display_name", { length: 200 }),
  oneLiner: varchar("one_liner", { length: 120 }),
  linkUrl: text("link_url"),
  placement: varchar("placement", { length: 120 }),
  pictureSource: pictureSource("picture_source"),
  pictureUrl: text("picture_url"),
  customPictureUrl: text("custom_picture_url"),
  customPicturePathname: text("custom_picture_pathname"),
  pendingPicturePathname: text("pending_picture_pathname"),
  pendingPictureExpiresAt: timestamp("pending_picture_expires_at", {
    withTimezone: true,
  }),
  pictureUploadWindowStartedAt: timestamp("picture_upload_window_started_at", {
    withTimezone: true,
  }),
  pictureUploadCount: integer("picture_upload_count").default(0).notNull(),
  portraitUrl: text("portrait_url"),
  portraitPathname: text("portrait_pathname"),
  badgeUrl: text("badge_url"),
  badgePathname: text("badge_pathname"),
  error: text("error"),
  notificationSentAt: timestamp("notification_sent_at", {
    withTimezone: true,
  }),
  ...auditTimestamps(),
});

export type ParticipantBadge = typeof participantBadges.$inferSelect;
