import {
  integer,
  sqliteTable,
  text,
  primaryKey,
  index,
} from "drizzle-orm/sqlite-core";
export const leads = sqliteTable(
  "leads",
  {
    owner: text("owner").notNull(),
    id: text("id").notNull(),
    data: text("data").notNull(),
    revision: integer("revision").notNull().default(0),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.owner, t.id] })],
);
export const settings = sqliteTable("settings", {
  owner: text("owner").primaryKey(),
  data: text("data").notNull(),
});
export const stories = sqliteTable(
  "stories",
  {
    owner: text("owner").notNull(),
    id: text("id").notNull(),
    data: text("data").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.owner, t.id] })],
);
export const events = sqliteTable(
  "events",
  {
    owner: text("owner").notNull(),
    id: text("id").notNull(),
    kind: text("kind").notNull(),
    detail: text("detail").notNull(),
    at: integer("at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.owner, t.id] }),
    index("events_owner_at").on(t.owner, t.at),
  ],
);
export const webhookEvents = sqliteTable("webhook_events", {
  id: text("id").primaryKey(),
  state: text("state").notNull(),
  at: integer("at").notNull(),
});
export const outbox = sqliteTable(
  "outbox",
  {
    id: text("id").primaryKey(),
    owner: text("owner").notNull(),
    leadId: text("lead_id").notNull(),
    reply: text("reply").notNull(),
    status: text("status").notNull(),
    at: integer("at").notNull(),
  },
  (t) => [index("outbox_owner_status").on(t.owner, t.status)],
);

export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  used: integer("used").notNull(),
  expiresAt: integer("expires_at").notNull(),
});
