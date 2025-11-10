
// ===================== PASSWORD RESET TOKENS =====================
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 256 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;

// Extend users table for TOTP
// (Add these columns via migration if not present in your DB)
export const users_totp_enabled = addColumn(users, "totp_enabled", integer("totp_enabled").notNull().default(0));
export const users_totp_secret = addColumn(users, "totp_secret_enc", text("totp_secret_enc"));
