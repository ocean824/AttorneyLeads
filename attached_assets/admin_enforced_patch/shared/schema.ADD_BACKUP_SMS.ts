
// ===================== USERS: phone for SMS fallback =====================
// Add this column to your existing `users` table in shared/schema.ts
export const users_phone = addColumn(users, "phone", varchar("phone", { length: 32 }));

// ===================== BACKUP CODES =====================
export const userBackupCodes = pgTable("user_backup_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  codeHash: varchar("code_hash", { length: 256 }).notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type UserBackupCode = typeof userBackupCodes.$inferSelect;
