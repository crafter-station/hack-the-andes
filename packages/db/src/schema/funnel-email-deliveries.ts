import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { auditTimestamps } from "./common";

export const funnelEmailDeliveries = pgTable(
  "funnel_email_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: varchar("clerk_user_id", { length: 255 }).notNull(),
    stage: varchar("stage", { length: 32 }).notNull(),
    scopeId: varchar("scope_id", { length: 255 }).notNull(),
    status: varchar("status", { length: 16 }).default("sending").notNull(),
    triggerRunId: text("trigger_run_id").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    error: text("error"),
    ...auditTimestamps(),
  },
  (table) => [
    uniqueIndex("funnel_email_deliveries_user_stage_scope_unique").on(
      table.clerkUserId,
      table.stage,
      table.scopeId,
    ),
    index("funnel_email_deliveries_status_index").on(table.status),
  ],
);

export type FunnelEmailDelivery = typeof funnelEmailDeliveries.$inferSelect;
